/**
 * POST /api/sync/users-to-supabase
 * Neon의 User를 Supabase에 동기화 (백업)
 *
 * 요청:
 * {
 *   "userIds": [1, 3, 21] 또는 "all"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import pg from 'pg';

const { Client } = pg;

export async function POST(req: NextRequest) {
  try {
    const ctx = await getMabizSession();

    // GLOBAL_ADMIN만 접근 가능
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });
    }

    const body = await req.json() as { userIds?: number[] | string };
    const userIds = body.userIds;

    // Neon에서 User 조회
    let neonUsers;

    if (userIds === 'all') {
      neonUsers = await prisma.$queryRaw<Array<{
        id: number;
        phone: string | null;
        password: string;
        name: string | null;
        role: string;
        email: string | null;
        mallUserId: string | null;
        isLocked: boolean;
      }>>`
        SELECT id, phone, password, name, role, email, "mallUserId", "isLocked"
        FROM "User"
        WHERE role IN ('admin', 'sales', 'presales')
      `;
    } else if (Array.isArray(userIds) && userIds.length > 0) {
      neonUsers = await prisma.$queryRaw<Array<{
        id: number;
        phone: string | null;
        password: string;
        name: string | null;
        role: string;
        email: string | null;
        mallUserId: string | null;
        isLocked: boolean;
      }>>`
        SELECT id, phone, password, name, role, email, "mallUserId", "isLocked"
        FROM "User"
        WHERE id = ANY(${userIds})
      `;
    } else {
      return NextResponse.json({
        ok: false,
        error: 'userIds가 필요합니다 (배열 또는 "all")',
      }, { status: 400 });
    }

    if (!neonUsers || neonUsers.length === 0) {
      return NextResponse.json({
        ok: true,
        message: '동기화할 사용자 없음',
        synced: 0,
      });
    }

    // Supabase 연결
    const supabaseUrl = process.env.SUPABASE_BACKUP_URL;
    if (!supabaseUrl) {
      return NextResponse.json({
        ok: false,
        error: 'SUPABASE_BACKUP_URL 환경변수 없음',
      }, { status: 500 });
    }

    const supabaseClient = new Client({ connectionString: supabaseUrl });
    let synced = 0;
    let errors: string[] = [];

    try {
      await supabaseClient.connect();
      logger.log('[Sync] Supabase 연결 성공');

      // 각 User를 Supabase에 삽입/업데이트
      for (const user of neonUsers) {
        try {
          await supabaseClient.query(`
            INSERT INTO "User" (
              id, phone, password, name, role, email, "mallUserId", "isLocked",
              "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              phone = $2,
              password = $3,
              name = $4,
              role = $5,
              email = $6,
              "mallUserId" = $7,
              "isLocked" = $8,
              "updatedAt" = NOW()
          `, [
            user.id,
            user.phone,
            user.password,
            user.name,
            user.role,
            user.email,
            user.mallUserId,
            user.isLocked,
          ]);
          synced++;
          logger.log('[Sync] User 동기화 완료', { id: user.id, phone: user.phone });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`ID ${user.id}: ${msg}`);
          logger.error('[Sync] User 동기화 실패', { id: user.id, error: msg });
        }
      }
    } finally {
      await supabaseClient.end();
    }

    logger.log('[Sync] 완료', { synced, total: neonUsers.length, errors: errors.length });

    return NextResponse.json({
      ok: true,
      message: `${synced}명 동기화 완료`,
      synced,
      total: neonUsers.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    logger.error('[Sync] 오류', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      ok: false,
      error: '동기화 실패',
    }, { status: 500 });
  }
}
