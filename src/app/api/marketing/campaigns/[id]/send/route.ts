import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

import { logger } from '@/lib/logger';
import { sendSms, getOrgSmsConfig } from '@/lib/aligo';
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
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await context.params;

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

    // 상태 확인 (PENDING 또는 DRAFT 모두 허용)
    if (!['PENDING', 'DRAFT'].includes(campaign.status)) {
      return NextResponse.json(
        { ok: false, message: '이미 발송 중이거나 발송 완료된 캠페인입니다.' },
        { status: 409 }
      );
    }

    // 그룹 멤버 조회
    const members = await prisma.contactGroupMember.findMany({
      where: { groupId: campaign.groupId },
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
    });

    if (members.length === 0) {
      return NextResponse.json(
        { ok: false, message: '그룹에 멤버가 없습니다.' },
        { status: 400 }
      );
    }

    // SENDING 상태를 동기적으로 설정 (레이스 컨디션 방지)
    await prisma.crmMarketingCampaign.update({
      where: { id },
      data: { status: 'SENDING', totalCount: members.length },
    });

    // 배경 작업으로 발송 시작 (비동기 처리)
    sendCampaignAsync(id, campaign, members, campaign.organizationId).catch((err) => {
      logger.error('[sendCampaignAsync]', { err, campaignId: id });
    });

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

    const BATCH_SIZE = 10;
    const CONCURRENT_BATCHES = 1;

    const batches = chunk(members, BATCH_SIZE);
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES);

      const batchResults = await Promise.all(
        batchGroup.map((batch) => processBatch(campaignId, campaign, batch, organizationId, smsConfig, emailConfig))
      );
      batchResults.forEach((r) => { totalSent += r.sent; totalFailed += r.failed; });

      // 중간 진행 상태 저장
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

    logger.info('[sendCampaignAsync] Campaign sent successfully', {
      campaignId,
      sentCount: totalSent,
    });
  } catch (err) {
    logger.error('[sendCampaignAsync] Error', { err, campaignId });

    await prisma.crmMarketingCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    });
  }
}

// 배치 처리 - 성공한 수신자 수 반환
async function processBatch(
  campaignId: string,
  campaign: CampaignRecord,
  members: MemberWithContact[],
  organizationId: string,
  smsConfig: Awaited<ReturnType<typeof getOrgSmsConfig>>,
  emailConfig: Awaited<ReturnType<typeof getOrgEmailConfig>>
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.all(
    members.map((member) =>
      processRecipient(campaignId, campaign, member, organizationId, smsConfig, emailConfig)
    )
  );
  return { sent: results.filter(Boolean).length, failed: results.filter((v) => !v).length };
}

// 개별 수신자 처리 - 성공 여부 반환
async function processRecipient(
  campaignId: string,
  campaign: CampaignRecord,
  member: MemberWithContact,
  organizationId: string,
  smsConfig: Awaited<ReturnType<typeof getOrgSmsConfig>>,
  emailConfig: Awaited<ReturnType<typeof getOrgEmailConfig>>
): Promise<boolean> {
  const contact = member.contact;
  let smsSent = false;
  let emailSent = false;

  try {
    // SMS 발송
    if (campaign.sendSms && campaign.smsBody && contact.phone && smsConfig?.isActive) {
      const text = campaign.smsBody.replace(/\{name\}/g, contact.name ?? '고객');
      const result = await sendSms({
        config: { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone },
        receiver: contact.phone,
        msg: text,
        msgType: text.length > 90 ? 'LMS' : 'SMS',
        organizationId,
        contactId: contact.id,
        channel: 'MANUAL',
      });
      smsSent = result.result_code === 1;
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

    logger.info('[processRecipient] done', { campaignId, contactId: contact.id, smsSent, emailSent });
    return smsSent || emailSent;
  } catch (err) {
    logger.error('[processRecipient] Error', { err, campaignId, recipientId: contact.id });
    return false;
  }
}
