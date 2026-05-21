/**
 * User 생성 시 Neon + Supabase 동시 저장
 */

import pg from 'pg';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const { Client: PgClient } = pg;

interface UserData {
  phone: string;
  password: string;
  name?: string;
  role?: string;
  email?: string;
  mallUserId?: string;
}

/**
 * Neon과 Supabase에 동시에 User 생성
 */
export async function createUserWithSync(userData: UserData) {
  try {
    // 1. Neon에 생성
    const neonUser = await prisma.gmUser.create({
      data: {
        phone: userData.phone,
        password: userData.password,
        name: userData.name || null,
        role: userData.role || 'user',
        email: userData.email || null,
        mallUserId: userData.mallUserId || null,
        isLocked: false,
        onboarded: false,
      },
      select: {
        id: true,
        phone: true,
        password: true,
        name: true,
        role: true,
        email: true,
        mallUserId: true,
        isLocked: true,
      },
    });

    logger.log('[UserSync] Neon User 생성', { id: neonUser.id, phone: neonUser.phone });

    // 2. Supabase에도 동시 저장
    try {
      const supabaseUrl = process.env.SUPABASE_BACKUP_URL;
      if (!supabaseUrl) {
        logger.warn('[UserSync] SUPABASE_BACKUP_URL 미설정 - 백업 불가');
        return neonUser;
      }

      const supabaseClient = new PgClient({ connectionString: supabaseUrl });
      await supabaseClient.connect();

      await supabaseClient.query(`
        INSERT INTO "User" (
          id, phone, password, name, role, email, "mallUserId", "isLocked",
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        neonUser.id,
        neonUser.phone,
        neonUser.password,
        neonUser.name,
        neonUser.role,
        neonUser.email,
        neonUser.mallUserId,
        neonUser.isLocked,
      ]);

      await supabaseClient.end();
      logger.log('[UserSync] Supabase 동기화 완료', { id: neonUser.id });
    } catch (err) {
      logger.error('[UserSync] Supabase 동기화 실패', {
        error: err instanceof Error ? err.message : String(err),
        userId: neonUser.id,
      });
      // Neon은 성공했으니 계속 진행
    }

    return neonUser;
  } catch (err) {
    logger.error('[UserSync] User 생성 실패', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * 기존 User를 Supabase에 동기화
 */
export async function syncUserToSupabase(userId: number) {
  try {
    // Neon에서 User 조회
    const user = await prisma.gmUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        password: true,
        name: true,
        role: true,
        email: true,
        mallUserId: true,
        isLocked: true,
      },
    });

    if (!user) {
      logger.warn('[UserSync] User를 찾을 수 없음', { userId });
      return null;
    }

    const supabaseUrl = process.env.SUPABASE_BACKUP_URL;
    if (!supabaseUrl) {
      logger.warn('[UserSync] SUPABASE_BACKUP_URL 미설정');
      return user;
    }

    const supabaseClient = new PgClient({ connectionString: supabaseUrl });
    await supabaseClient.connect();

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

    await supabaseClient.end();
    logger.log('[UserSync] Supabase 동기화 완료', { userId });

    return user;
  } catch (err) {
    logger.error('[UserSync] 동기화 실패', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    throw err;
  }
}
