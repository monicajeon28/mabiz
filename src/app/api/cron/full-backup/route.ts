/**
 * 매일 전체 백업 cron — Neon → Supabase → Google Drive
 * 스케줄: vercel.json (매일 새벽). 인증: CRON_SECRET (Bearer 또는 x-vercel-cron-secret)
 */
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runFullBackup } from '@/lib/backup/full-backup';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 백업 작업 여유 (Pro 플랜)

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
    return NextResponse.json({ ok: false, message: 'CRON_SECRET 미설정' }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
  }

  const snapshotDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  try {
    const result = await runFullBackup(snapshotDate);
    logger.log('[cron/full-backup] 완료', {
      snapshotDate,
      tables: result.neonToSupabase.length,
      driveFiles: result.supabaseToDrive.length,
    });
    return NextResponse.json({
      ok: true,
      snapshotDate,
      neonToSupabase: result.neonToSupabase,
      driveFiles: result.supabaseToDrive.length,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error('[cron/full-backup] 실패', { snapshotDate, error });
    return NextResponse.json({ ok: false, snapshotDate, error }, { status: 500 });
  }
}
