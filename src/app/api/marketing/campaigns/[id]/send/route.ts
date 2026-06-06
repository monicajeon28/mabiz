import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { sendSms, getOrgSmsConfig } from '@/lib/aligo';
import { sendEmail, getOrgEmailConfig } from '@/lib/email';

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
        organizationId: resolveOrgId(ctx),
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

    // 배경 작업으로 발송 시작 (비동기 처리)
    // 상태 업데이트는 sendCampaignAsync 내부에서 관리하여 레이스 컨디션 방지
    sendCampaignAsync(id, campaign, members, resolveOrgId(ctx)).catch((err) => {
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
async function sendCampaignAsync(
  campaignId: string,
  campaign: any,
  members: any[],
  organizationId: string
) {
  try {
    // 상태를 SENDING으로 업데이트 (발송 시작)
    await prisma.crmMarketingCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING' },
    });

    // 발송 설정 미리 로드 (배치마다 재조회 방지)
    const [smsConfig, emailConfig] = await Promise.all([
      campaign.sendSms ? getOrgSmsConfig(organizationId) : Promise.resolve(null),
      campaign.sendEmail ? getOrgEmailConfig(organizationId) : Promise.resolve(null),
    ]);

    const BATCH_SIZE = 50;
    const CONCURRENT_BATCHES = 3;

    const batches = chunk(members, BATCH_SIZE);

    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES);

      await Promise.all(
        batchGroup.map((batch) => processBatch(campaignId, campaign, batch, organizationId, smsConfig, emailConfig))
      );
    }

    await prisma.crmMarketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENT',
        sentCount: members.length,
      },
    });

    logger.info('[sendCampaignAsync] Campaign sent successfully', {
      campaignId,
      sentCount: members.length,
    });
  } catch (err) {
    logger.error('[sendCampaignAsync] Error', { err, campaignId });

    await prisma.crmMarketingCampaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    });
  }
}

// 배치 처리
async function processBatch(
  campaignId: string,
  campaign: any,
  members: any[],
  organizationId: string,
  smsConfig: Awaited<ReturnType<typeof getOrgSmsConfig>>,
  emailConfig: Awaited<ReturnType<typeof getOrgEmailConfig>>
) {
  const promises = members.map((member) =>
    processRecipient(campaignId, campaign, member, organizationId, smsConfig, emailConfig)
  );

  await Promise.all(promises);
}

// 개별 수신자 처리
async function processRecipient(
  campaignId: string,
  campaign: any,
  member: any,
  organizationId: string,
  smsConfig: Awaited<ReturnType<typeof getOrgSmsConfig>>,
  emailConfig: Awaited<ReturnType<typeof getOrgEmailConfig>>
) {
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
  } catch (err) {
    logger.error('[processRecipient] Error', { err, campaignId, recipientId: contact.id });
  }
}
