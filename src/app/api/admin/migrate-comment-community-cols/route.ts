/**
 * POST /api/admin/migrate-comment-community-cols  (일회용 운영 마이그레이션)
 *
 * 목적: 후기→커뮤니티 Q&A(티키타카) 전환을 위한 CrmLandingComment 신규 4컬럼 + 인덱스를 운영DB에 추가.
 *   parentId(String?) / authorRole(default 'visitor') / likeCount(default 0) / status(default 'visible')
 *   + FK(parentId→id, ON DELETE CASCADE) + 인덱스(landingPageId, parentId)
 *   prisma migrate가 Vercel 빌드에서 자동적용 안 되므로(수동 운영) 배포된 앱이 운영DB에 직접 적용.
 *   모든 DDL이 IF NOT EXISTS — 여러 번 호출/이미 적용돼도 무해(멱등).
 *
 * 인증: CRON_SECRET (Bearer). 미설정 503.
 *   curl -X POST https://<운영도메인>/api/admin/migrate-comment-community-cols \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * ⚠️ 커뮤니티 Q&A 코드 배포와 동시(직전)에 실행. 컬럼 없는 상태로 신규 코드가 select하면 500.
 */
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function checkColumn(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}`;
  return rows.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ ok: false, error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const steps: string[] = [];
    await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingComment" ADD COLUMN IF NOT EXISTS "parentId" TEXT`);
    steps.push('parentId');
    await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingComment" ADD COLUMN IF NOT EXISTS "authorRole" TEXT NOT NULL DEFAULT 'visitor'`);
    steps.push('authorRole');
    await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingComment" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0`);
    steps.push('likeCount');
    await prisma.$executeRawUnsafe(`ALTER TABLE "CrmLandingComment" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'visible'`);
    steps.push('status');

    // FK(자기참조, 답글→질문) — 존재 시 무해하게 스킵
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'CrmLandingComment_parentId_fkey'
        ) THEN
          ALTER TABLE "CrmLandingComment"
            ADD CONSTRAINT "CrmLandingComment_parentId_fkey"
            FOREIGN KEY ("parentId") REFERENCES "CrmLandingComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;`);
    steps.push('parentId_fkey');

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CrmLandingComment_landingPageId_parentId_idx" ON "CrmLandingComment" ("landingPageId", "parentId")`);
    steps.push('idx_landingPageId_parentId');

    const ok =
      (await checkColumn('CrmLandingComment', 'parentId')) &&
      (await checkColumn('CrmLandingComment', 'authorRole')) &&
      (await checkColumn('CrmLandingComment', 'likeCount')) &&
      (await checkColumn('CrmLandingComment', 'status'));

    logger.log('[admin/migrate-comment-community-cols] 완료', { ok });
    return NextResponse.json({ ok: true, colsOk: ok, steps });
  } catch (err) {
    logger.error('[admin/migrate-comment-community-cols]', { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { ok: false, error: (err as { code?: string })?.code ?? 'UNKNOWN', message: '마이그레이션 실패' },
      { status: 500 },
    );
  }
}
