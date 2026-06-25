export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/affiliate-managers/re-sync
 *
 * 크루즈닷에 동기화되지 않은 OWNER(지사장) 자동 감지 → 크루즈닷으로 자동 전송.
 * organizations 페이지 마운트 시 백그라운드에서 자동 호출됨 (멱등, 중복 안전).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  void req;
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const provisionUrl = process.env.INTERNAL_PROVISION_URL;
  const cruisedotBaseUrl = process.env.CRUISEDOT_BASE_URL ?? '';
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET ?? '';

  if (!provisionUrl) {
    logger.warn('[re-sync] INTERNAL_PROVISION_URL 미설정 — 스킵');
    return NextResponse.json({ ok: true, synced: 0, message: 'INTERNAL_PROVISION_URL 미설정' });
  }

  // gm-{Int} 형식 userId를 가진 OWNER 조회 (provision.ts로 생성된 지사장)
  const owners = await prisma.organizationMember.findMany({
    where: {
      role: 'OWNER',
      userId: { startsWith: 'gm-' },
      isActive: true,
    },
    select: {
      userId: true,
      displayName: true,
      phone: true,
      email: true,
    },
  });

  const results: { affiliateCode: string; status: 'synced' | 'skipped' | 'error'; reason?: string }[] = [];

  for (const owner of owners) {
    const gmUserId = parseInt(owner.userId.replace('gm-', ''), 10);
    if (isNaN(gmUserId)) continue;

    // GmAffiliateProfile 조회
    const profile = await prisma.gmAffiliateProfile.findFirst({
      where: { userId: gmUserId },
      select: { id: true, affiliateCode: true },
    });

    if (!profile) {
      results.push({ affiliateCode: '(없음)', status: 'skipped', reason: 'GmAffiliateProfile 없음' });
      continue;
    }

    // 해당 프로필의 첫 번째 활성 링크 조회
    const link = await prisma.gmAffiliateLink.findFirst({
      where: { managerId: profile.id, status: 'ACTIVE' },
      select: { code: true },
    });
    const linkCode = link?.code ?? profile.affiliateCode;

    const affiliatePayload = [
      {
        role: 'manager',
        partnerId: owner.userId,
        affiliateCode: profile.affiliateCode,
        linkCode,
        linkUrl: `${cruisedotBaseUrl}?ref=${linkCode}`,
        name: owner.displayName ?? '',
        phone: owner.phone ?? '',
        email: owner.email ?? null,
      },
    ];

    try {
      const res = await fetch(`${provisionUrl}/api/integration/affiliate/mabiz-upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': secret,
        },
        body: JSON.stringify({ affiliates: affiliatePayload, contractId: profile.id }),
      });

      if (res.ok) {
        results.push({ affiliateCode: profile.affiliateCode, status: 'synced' });
        logger.info('[re-sync] 크루즈닷 동기화 성공', { affiliateCode: profile.affiliateCode });
      } else {
        const errText = await res.text().catch(() => '');
        results.push({ affiliateCode: profile.affiliateCode, status: 'error', reason: `HTTP ${res.status}: ${errText.slice(0, 100)}` });
        logger.warn('[re-sync] 크루즈닷 동기화 실패', { affiliateCode: profile.affiliateCode, status: res.status });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ affiliateCode: profile.affiliateCode, status: 'error', reason: msg });
      logger.error('[re-sync] 네트워크 오류', { affiliateCode: profile.affiliateCode, err: msg });
    }
  }

  const synced = results.filter(r => r.status === 'synced').length;
  const errors = results.filter(r => r.status === 'error').length;

  logger.info('[re-sync] 완료', { total: owners.length, synced, errors });

  return NextResponse.json({ ok: true, synced, errors, results });
}
