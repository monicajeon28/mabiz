/**
 * 서류 Drive 동기화 cron — 모든 AffiliateSale의 SalesDocument → Google Drive
 * 스케줄: vercel.json (매일 새벽). 인증: CRON_SECRET
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { syncAllDocumentsToDrive } from '@/lib/affiliate/document-drive-sync';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ')
    ? auth.slice(7)
    : (req.headers.get('x-vercel-cron-secret') ?? '');
  if (token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, message: 'CRON_SECRET 미설정' }, { status: 500 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
  }

  // 활성 AffiliateSale이 있는 프로필만 조회
  const profiles = await prisma.gmAffiliateProfile.findMany({
    where: { isActive: true },
    select: { id: true, affiliateCode: true },
  });

  logger.log('[cron/sync-documents] 시작', { profileCount: profiles.length });

  let synced = 0;
  let failed = 0;

  for (const profile of profiles) {
    const result = await syncAllDocumentsToDrive(profile.id);
    if (result.ok) {
      synced += result.results?.synced ?? 0;
    } else {
      failed++;
      logger.error('[cron/sync-documents] 프로필 동기화 실패', {
        profileId: profile.id,
        affiliateCode: profile.affiliateCode,
        error: result.error,
      });
    }
  }

  logger.log('[cron/sync-documents] 완료', { profileCount: profiles.length, synced, failed });
  return NextResponse.json({ ok: true, profileCount: profiles.length, synced, failed });
}
