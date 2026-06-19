export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/contract-expiry-check
 * 조직 계약 만료 임박 알림 자동 발송
 * Vercel Cron: 매일 09:00 KST (00:00 UTC)
 */
export async function GET(req: NextRequest) {
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken) {
    return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const tokenBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expectedToken, 'utf8');
  if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 86400000);

  // 만료 30일 이내, 아직 알림 미발송 조직 조회
  const orgs = await prisma.organization.findMany({
    where: {
      status: 'ACTIVE',
      contractEndDate: { lte: in30days, gt: now },
      renewalAlertSent: false,
    },
    select: {
      id: true,
      name: true,
      contractEndDate: true,
      members: {
        where: { isActive: true, role: { in: ['OWNER', 'AGENT'] } },
        select: { id: true, displayName: true },
      },
    },
  });

  logger.info('[contract-expiry-check] 대상 조직', { count: orgs.length });

  let notified = 0;
  for (const org of orgs) {
    try {
      const days = Math.ceil((org.contractEndDate!.getTime() - now.getTime()) / 86400000);

      // 관리자 알림 생성
      await prisma.adminNotification.create({
        data: {
          notificationType: 'CONTRACT_EXPIRY',
          title: `계약 만료 임박: ${org.name}`,
          content: `${org.name} 조직의 계약이 ${days}일 후 만료됩니다. 재계약 진행이 필요합니다.`,
          priority: days <= 7 ? 'high' : 'normal',
          metadata: { organizationId: org.id, daysLeft: days } as any,
        },
      });

      // 알림 발송 완료 플래그
      await prisma.organization.update({
        where: { id: org.id },
        data: { renewalAlertSent: true },
      });

      notified++;
      logger.info('[contract-expiry-check] 알림 생성', { orgId: org.id, days });
    } catch (err) {
      logger.error('[contract-expiry-check] 조직 알림 실패', { orgId: org.id, err });
    }
  }

  return NextResponse.json({ ok: true, checked: orgs.length, notified });
}
