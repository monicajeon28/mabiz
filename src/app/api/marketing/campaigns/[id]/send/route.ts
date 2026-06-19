import { NextRequest, NextResponse, after } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

import { logger } from '@/lib/logger';
import { sendSms, getOrgSmsConfig, detectMessageType } from '@/lib/aligo';
import { sendEmail, getOrgEmailConfig } from '@/lib/email';

type CampaignRecord = NonNullable<
  Awaited<ReturnType<typeof prisma.crmMarketingCampaign.findFirst>>
>;
type MemberWithContact = Prisma.ContactGroupMemberGetPayload<{
  include: { contact: { select: { id: true; phone: true; email: true; name: true } } };
}>;

// 배치 처리 유틸리티
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ── POST /api/marketing/campaigns/[id]/send — 캠페인 발송 시작 ────────
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '이 기능을 사용할 권한이 없어요.' }, { status: 403 });
    }

    const { id } = await context.params;

    // stale SENDING 복구: 해당 캠페인 ID만 대상으로 한정 (API-SEND-STALE-SWEEP-001)
    // 전체 조직 스윕 금지 — GLOBAL_ADMIN이 다른 조직 캠페인을 FAILED 전환하는 것 방지
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.crmMarketingCampaign.updateMany({
      where: {
        id,
        status: 'SENDING',
        updatedAt: { lt: staleThreshold },
      },
      data: { status: 'FAILED' },
    });

    // 캠페인 조회
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId ?? undefined,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // API-SEND-CROSSORG-AUDIT-001: GLOBAL_ADMIN이 다른 조직 캠페인을 발송하는 경우 감사 로그
    if (ctx.role === 'GLOBAL_ADMIN') {
      logger.info('[POST send] GLOBAL_ADMIN cross-org send triggered', {
        actorId: ctx.userId,
        campaignId: id,
        targetOrgId: campaign.organizationId,
      });
    }

    // organizationId 유효성 검증: 빈 문자열이면 getOrgSmsConfig('') 호출 방지 (LIB-TYPES-013)
    if (!campaign.organizationId) {
      return NextResponse.json(
        { ok: false, message: '캠페인의 조직 정보가 없습니다.' },
        { status: 400 }
      );
    }

    // 그룹 멤버 조회 (cross-org 멤버 유출 방지: contact.organizationId 필터 추가)
    // SEND-017: 전량 메모리 로드 방지 — take:5000 안전 상한 적용
    const members = await prisma.contactGroupMember.findMany({
      where: {
        groupId: campaign.groupId,
        contact: { organizationId: campaign.organizationId ?? undefined },
      },
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            email: true,
            name: true,
          },
        },
      },
      take: 5000,
    });

    // [SEND-5000-CAP-SILENT-SKIP-001] 5000명 초과 시 무음 누락 방지 — 명시적 오류 반환
    if (members.length === 5000) {
      logger.warn('[send] 그룹 멤버 5000명 상한 도달 — 초과 수신자 누락 방지를 위해 발송 차단', { campaignId: id });
      return NextResponse.json(
        { ok: false, message: '그룹 멤버가 5000명을 초과합니다. 그룹을 분할 후 재발송해주세요.' },
        { status: 400 }
      );
    }

    if (members.length === 0) {
      return NextResponse.json(
        { ok: false, message: '그룹에 멤버가 없습니다.' },
        { status: 400 }
      );
    }

    // CAS(Compare-And-Swap): PENDING/DRAFT 상태인 경우에만 SENDING으로 원자적 전환 (TOCTOU 방지)
    const cas = await prisma.crmMarketingCampaign.updateMany({
      where: {
        id,
        status: { in: ['PENDING', 'DRAFT'] },
        organizationId: campaign.organizationId,
      },
      data: { status: 'SENDING', totalCount: members.length },
    });
    if (cas.count === 0) {
      return NextResponse.json(
        { ok: false, message: '이미 발송 중이거나 발송 완료된 캠페인입니다.' },
        { status: 409 }
      );
    }

    // after(): 응답 반환 후에도 서버리스 런타임을 유지시켜 발송 완료 보장 (SEND-011)
    // fire-and-forget .catch()만으로는 Vercel이 응답 직후 실행 컨텍스트를 종료할 수 있음
    after(
      sendCampaignAsync(id, campaign, members, campaign.organizationId).catch((err) => {
        logger.error('[sendCampaignAsync]', { err, campaignId: id });
      })
    );

    return NextResponse.json({
      ok: true,
      message: '캠페인 발송이 시작되었습니다.',
      campaign: {
        id: campaign.id,
        title: campaign.title,
        totalCount: members.length,
        status: 'SENDING',
      },
    });
  } catch (err) {
    logger.error('[POST /api/marketing/campaigns/[id]/send]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// 비동기 발송 처리
// 상태는 POST 핸들러에서 동기적으로 SENDING으로 설정됨. 여기서는 발송 처리만 담당.
async function sendCampaignAsync(
  campaignId: string,
  campaign: CampaignRecord,
  members: MemberWithContact[],
  organizationId: string
) {
  try {
    // 발송 설정 미리 로드 (배치마다 재조회 방지)
    const [smsConfig, emailConfig] = await Promise.all([
      campaign.sendSms ? getOrgSmsConfig(organizationId) : Promise.resolve(null),
      campaign.sendEmail ? getOrgEmailConfig(organizationId) : Promise.resolve(null),
    ]);

    // SEND-013: executeMonth를 함수 진입 시 한 번만 계산 (배치 처리 중 월 경계 이슈 방지)
    const executeMonth = new Date().toISOString().slice(0, 7);

    const BATCH_SIZE = 10;
    const CONCURRENT_BATCHES = 1;

    const batches = chunk(members, BATCH_SIZE);
    let totalSent = 0;
    let totalFailed = 0;
    // [SEND-BLOCKED-AS-FAILED-001] BLOCKED 카운트 분리 집계 (수신거부/야간차단)
    let totalBlocked = 0;

    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES);

      const batchResults = await Promise.all(
        batchGroup.map((batch) => processBatch(campaignId, campaign, batch, organizationId, smsConfig, emailConfig, executeMonth))
      );
      batchResults.forEach((r) => {
        totalSent += r.sent;
        totalFailed += r.failed;
        // [SEND-BLOCKED-AS-FAILED-001] BLOCKED는 totalBlocked에만 합산 (failedCount 오집계 방지)
        totalBlocked += r.blocked;
      });

      // 중간 진행 상태 저장
      // [SEND-BLOCKED-AS-FAILED-001] blockedCount 필드가 스키마에 없으므로 failedCount에서 분리.
      // BLOCKED 건은 failedCount에 포함하지 않아 오집계를 방지하고, logger.info로만 추적.
      await prisma.crmMarketingCampaign.update({
        where: { id: campaignId },
        data: {
          sentCount: { increment: batchResults.reduce((s, r) => s + r.sent, 0) },
          failedCount: { increment: batchResults.reduce((s, r) => s + r.failed, 0) },
        },
      });
    }

    // 발송 완료 - sentCount/failedCount는 increment로 이미 저장됐으므로 status만 업데이트
    await prisma.crmMarketingCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENT' },
    });

    // [SEND-BLOCKED-AS-FAILED-001] 발송 완료 로그에 blockedCount 포함 — 사후 추적용
    logger.info('[sendCampaignAsync] Campaign sent successfully', {
      campaignId,
      sentCount: totalSent,
      failedCount: totalFailed,
      blockedCount: totalBlocked,
    });
  } catch (err) {
    logger.error('[sendCampaignAsync] Error', { err, campaignId });

    // DB-30: 실패 시 ExecutionLog 기준으로 sentCount 재동기화 (increment 누적 오차 방지)
    const actualSentCount = await prisma.executionLog.count({
      where: { campaignId, status: 'SENT' },
    }).catch(() => undefined);

    await prisma.crmMarketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        ...(actualSentCount !== undefined ? { sentCount: actualSentCount } : {}),
      },
    });
  }
}

// 배치 처리 - 성공/실패/차단 수신자 수 반환
// [SEND-BLOCKED-AS-FAILED-001] BLOCKED(수신거부/야간차단)를 FAILED와 구분
async function processBatch(
  campaignId: string,
  campaign: CampaignRecord,
  members: MemberWithContact[],
  organizationId: string,
  smsConfig: Awaited<ReturnType<typeof getOrgSmsConfig>>,
  emailConfig: Awaited<ReturnType<typeof getOrgEmailConfig>>,
  executeMonth: string
): Promise<{ sent: number; failed: number; blocked: number }> {
  const results = await Promise.all(
    members.map((member) =>
      processRecipient(campaignId, campaign, member, organizationId, smsConfig, emailConfig, executeMonth)
    )
  );
  return {
    sent: results.filter((r) => r === 'sent').length,
    failed: results.filter((r) => r === 'failed').length,
    blocked: results.filter((r) => r === 'blocked').length,
  };
}

// Aligo result_code 중 BLOCKED 판정 코드 (수신거부·야간차단·스팸필터)
// -97: 야간 수신 거부, -98: 수신거부 등록, -99: 스팸/차단
const ALIGO_BLOCKED_CODES = new Set([-97, -98, -99]);

// 개별 수신자 처리 - 'sent' | 'blocked' | 'failed' 반환
// [SEND-BLOCKED-AS-FAILED-001] BLOCKED를 FAILED와 구분해 오집계 방지
async function processRecipient(
  campaignId: string,
  campaign: CampaignRecord,
  member: MemberWithContact,
  organizationId: string,
  smsConfig: Awaited<ReturnType<typeof getOrgSmsConfig>>,
  emailConfig: Awaited<ReturnType<typeof getOrgEmailConfig>>,
  executeMonth: string  // SEND-013: 월 경계 오차 방지 — 호출 시점에 한 번만 계산된 값을 전달
): Promise<'sent' | 'blocked' | 'failed'> {
  const contact = member.contact;
  let smsSent = false;
  let emailSent = false;
  // [SEND-BLOCKED-AS-FAILED-001] BLOCKED 판정 플래그 (수신거부/야간차단/스팸)
  let smsBlocked = false;

  try {
    // SMS 발송
    // [DB-SEND-EMPTY-PHONE-SEND-001] 공백 전화번호 trim으로 Aligo API 오류 방지
    const trimmedPhone = contact.phone?.trim();
    if (campaign.sendSms && campaign.smsBody && trimmedPhone && smsConfig?.isActive) {
      const text = campaign.smsBody.replace(/\{name\}/g, contact.name ?? '고객');
      const result = await sendSms({
        config: { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone },
        receiver: trimmedPhone,
        msg: text,
        msgType: detectMessageType(text),
        organizationId,
        contactId: contact.id,
        channel: 'MANUAL',
      });
      smsSent = result.result_code === 1;
      // [SEND-BLOCKED-AS-FAILED-001] BLOCKED 코드 감지 — FAILED 집계에서 분리
      if (!smsSent && typeof result.result_code === 'number' && ALIGO_BLOCKED_CODES.has(result.result_code)) {
        smsBlocked = true;
        logger.info('[processRecipient] SMS BLOCKED (수신거부/야간차단)', {
          campaignId,
          contactId: contact.id,
          result_code: result.result_code,
        });
      }
    }

    // 이메일 발송
    if (campaign.sendEmail && campaign.emailSubject && campaign.emailBody && contact.email && emailConfig) {
      const html = campaign.emailBody.replace(/\{name\}/g, contact.name ?? '고객');
      emailSent = await sendEmail({
        smtpHost: emailConfig.smtpHost,
        smtpPort: emailConfig.smtpPort,
        smtpUser: emailConfig.smtpUser,
        smtpPassEncrypted: emailConfig.smtpPassEncrypted,
        senderName: emailConfig.senderName,
        senderEmail: emailConfig.senderEmail,
        to: contact.email,
        subject: campaign.emailSubject,
        html,
      });
    }

    // 발송 기록은 SmsLog (sendSms 내부에서 자동 기록) 및 EmailLog에서 처리

    // ExecutionLog upsert: 캠페인 발송 이력 기록 (월별 중복 방지)
    // SEND-012: channel을 발송 결과 기반으로 결정 (캠페인 플래그 기반 → 실제 발송 채널 기반)
    // SEND-013: executeMonth를 외부에서 전달받아 월 경계 불일치 방지
    // SEND-015: sendEmail=false인 경우도 정확히 반영하는 폴백 로직
    const actualChannel = smsSent ? 'SMS' : emailSent ? 'EMAIL' : (campaign.sendSms ? 'SMS' : campaign.sendEmail ? 'EMAIL' : 'SMS');
    // [SEND-BLOCKED-AS-FAILED-001] ExecutionStatus enum에 BLOCKED 없음 → 'FAILED' 유지.
    // smsBlocked=true인 경우 logErr에 원인 코드를 기록해 사후 추적 가능하게 함.
    const executionStatus = (smsSent || emailSent) ? 'SENT' : 'FAILED';
    try {
      await prisma.executionLog.upsert({
        where: {
          uq_execution_monthly: {
            sourceType: 'CAMPAIGN',
            sourceId: campaignId,
            contactId: contact.id,
            executeMonth,
          },
        },
        create: {
          organizationId,
          sourceType: 'CAMPAIGN',
          sourceId: campaignId,
          sourceName: campaign.title,
          contactId: contact.id,
          channel: actualChannel,
          status: executionStatus,
          executeMonth,
          scheduledAt: campaign.sendAt,
          sentAt: new Date(),
          campaignId,
        },
        update: {
          status: executionStatus,
          sentAt: new Date(),
        },
      });
    } catch (logErr) {
      logger.error('[processRecipient] ExecutionLog upsert failed', {
        logErr,
        campaignId,
        contactId: contact.id,
        // [SEND-BLOCKED-AS-FAILED-001] BLOCKED 여부를 로그에 포함해 사후 추적 가능
        smsBlocked,
      });
    }

    // [SEND-BLOCKED-AS-FAILED-001] BLOCKED 여부를 호출자에게 전달해 집계 분리
    const outcome: 'sent' | 'blocked' | 'failed' =
      smsSent || emailSent ? 'sent' : smsBlocked ? 'blocked' : 'failed';
    logger.info('[processRecipient] done', { campaignId, contactId: contact.id, smsSent, emailSent, smsBlocked, outcome });
    return outcome;
  } catch (err) {
    logger.error('[processRecipient] Error', { err, campaignId, recipientId: contact.id });
    return 'failed';
  }
}
