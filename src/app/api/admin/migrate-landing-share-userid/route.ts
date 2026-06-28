/**
 * POST /api/admin/migrate-landing-share-userid  (일회용 운영 마이그레이션)
 *
 * 목적: 운영 DB의 CrmLandingShare 에 sharedToUserId 컬럼이 없어
 *       GET /api/landing-pages 가 Prisma P2022 로 500 나는 문제를 영구 해결.
 *       (scripts/apply-landing-share-userid.mjs 와 100% 동일한 idempotent SQL —
 *        로컬에 운영 DATABASE_URL 이 없어도 배포된 앱이 운영 DB에 직접 적용)
 *
 * 인증: CRON_SECRET (Bearer). 미설정 시 fail-closed(503).
 *   curl -X POST https://<운영도메인>/api/admin/migrate-landing-share-userid \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * 안전성: 모든 DDL 이 IF [NOT] EXISTS 라 여러 번 호출/이미 적용돼도 무해.
 *   ⚠️ 4단계(구 2컬럼 UNIQUE DROP)는 새 share 코드 배포 후에만 의미가 있으나,
 *      현재 HEAD share 코드는 이미 3컬럼 upsert 라 즉시 실행 안전.
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
async function indexExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE indexname = ${name}`;
  return rows.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    // 인증 — CRON_SECRET fail-closed
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

    const log: string[] = [];
    const newIdx = 'CrmLandingShare_landingPageId_sharedToOrgId_sharedToUserId_key';

    // 1) 컬럼 추가('' 백필 — 기존 행은 조직/전체 공유로 유지)
    const hadCol = await checkColumn('CrmLandingShare', 'sharedToUserId');
    if (!hadCol) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "CrmLandingShare" ADD COLUMN IF NOT EXISTS "sharedToUserId" TEXT NOT NULL DEFAULT ''`,
      );
      log.push('sharedToUserId 컬럼 추가');
    } else log.push('sharedToUserId 컬럼 이미 존재');

    // 2) 신규 3컬럼 UNIQUE INDEX (소형 테이블 — 비concurrent 순간 락. 기존행 모두 '' 라 충돌 없음)
    if (!(await indexExists(newIdx))) {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${newIdx}" ON "CrmLandingShare"("landingPageId","sharedToOrgId","sharedToUserId")`,
      );
      log.push('3컬럼 UNIQUE INDEX 생성');
    } else log.push('3컬럼 UNIQUE INDEX 이미 존재');

    // 3) 보조 인덱스
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CrmLandingShare_sharedToUserId_idx" ON "CrmLandingShare"("sharedToUserId")`,
    );
    log.push('sharedToUserId 보조 인덱스 확인');

    // 4) 구 2컬럼 유니크 제거 (constraint/index 양쪽 커버)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "CrmLandingShare" DROP CONSTRAINT IF EXISTS "CrmLandingShare_landingPageId_sharedToOrgId_key"`,
    );
    await prisma.$executeRawUnsafe(
      `DROP INDEX IF EXISTS "CrmLandingShare_landingPageId_sharedToOrgId_key"`,
    );
    log.push('구 2컬럼 유니크 제거');

    // 최종 검증
    const colOk = await checkColumn('CrmLandingShare', 'sharedToUserId');
    const idxOk = await indexExists(newIdx);

    logger.log('[admin/migrate-landing-share-userid] 완료', { colOk, idxOk });
    return NextResponse.json({ ok: true, colOk, idxOk, steps: log });
  } catch (err) {
    logger.error('[admin/migrate-landing-share-userid]', {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: (err as { code?: string })?.code ?? 'UNKNOWN', message: '마이그레이션 실패' },
      { status: 500 },
    );
  }
}
