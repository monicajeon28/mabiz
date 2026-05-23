import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

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
        organizationId: ctx.organizationId!,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 상태 확인
    if (campaign.status !== 'PENDING') {
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
    sendCampaignAsync(id, campaign, members, ctx.organizationId!).catch((err) => {
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

    const BATCH_SIZE = 100;
    const CONCURRENT_BATCHES = 3;

    // 배치로 나누기
    const batches = chunk(members, BATCH_SIZE);

    // 동시성 제어하면서 배치 처리
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES);

      await Promise.all(
        batchGroup.map((batch) => processBatch(campaignId, campaign, batch, organizationId))
      );
    }

    // 발송 완료 후 통계 업데이트
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
      total: members.length,
    });
  } catch (err) {
    logger.error('[sendCampaignAsync] Error', { err, campaignId });

    // 실패 시 상태 업데이트
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
  organizationId: string
) {
  const promises = members.map((member) =>
    processRecipient(campaignId, campaign, member, organizationId)
  );

  await Promise.all(promises);
}

// 개별 수신자 처리
async function processRecipient(
  campaignId: string,
  campaign: any,
  member: any,
  organizationId: string
) {
  try {
    const contact = member.contact;

    // TODO: 실제 이메일/SMS 발송 로직
    // if (campaign.sendEmail && contact.email) {
    //   await sendEmail(contact.email, campaign);
    // }
    // if (campaign.sendSms && contact.phone) {
    //   await sendSms(contact.phone, campaign);
    // }
    // if (campaign.includeLanding) {
    //   await generateLandingLink(contact.id, campaign);
    // }

    logger.info('[processRecipient] Message created', {
      campaignId,
      recipientId: contact.id,
      name: contact.name,
    });
  } catch (err) {
    logger.error('[processRecipient] Error', { err, campaignId, recipientId: member.contact.id });
  }
}
