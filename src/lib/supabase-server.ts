/**
 * Supabase Server Client (Service Role Key 사용)
 *
 * 사용 가능 환경:
 * - API Routes (app/api/)
 * - Server Actions
 * - Middleware (경고: JWT 검증 필요)
 *
 * 주의:
 * - SUPABASE_SERVICE_ROLE_KEY는 .env.local (로컬) 또는 Vercel Secret (프로덕션)에만 저장
 * - git에 절대 커밋하지 말 것!
 * - RLS 정책을 우회할 수 있으므로 신뢰할 수 있는 작업에만 사용
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

let supabaseServer: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (supabaseServer) {
    return supabaseServer;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      '❌ Supabase 환경변수 누락:\n' +
      '- SUPABASE_URL (필수)\n' +
      '- SUPABASE_SERVICE_ROLE_KEY (필수, .env.local 또는 Vercel Secret)\n\n' +
      '설정 위치:\n' +
      '- 로컬: .env.local (git 제외)\n' +
      '- 프로덕션: Vercel Settings → Environment Variables (API Only)'
    );
  }

  supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: async (url, init) => {
        // 로깅 (개발 환경)
        if (process.env.NODE_ENV === 'development') {
          const method = (init?.method || 'GET').toUpperCase();
          const urlObj = new URL(url.toString());
          logger.info(`[Supabase] ${method} ${urlObj.pathname}`);
        }

        const response = await fetch(url, init);

        // 에러 로깅
        if (!response.ok && process.env.NODE_ENV === 'development') {
          const text = await response.clone().text();
          logger.error(`[Supabase Error] ${response.status}:`, { text });
        }

        return response;
      },
    },
  });

  return supabaseServer;
}

/**
 * 특정 역할(role)로 클라이언트 생성 (테스트용)
 *
 * 예시:
 * const agentClient = getSupabaseServerClientAsRole('AGENT', 'user-123');
 * const { data } = await agentClient.from('Contact').select('*');
 */
export function getSupabaseServerClientAsRole(
  role: 'GLOBAL_ADMIN' | 'AGENT' | 'BRANCH_MANAGER' | 'CUSTOMER',
  userId: string
): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase 환경변수 누락');
  }

  const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // JWT 페이로드 (role 포함)
  // 참고: 실제 환경에서는 Auth 시스템에서 JWT 발급
  // setAuth was removed in supabase-js v2 — cast required for backward compat
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client.auth as any).setAuth({
    access_token: `fake-jwt-${role}-${userId}`,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      role: role,
      email: `${role.toLowerCase()}@example.com`,
      user_metadata: {
        role: role,
      },
    },
  });

  return client;
}

/**
 * 환경변수 검증 (시작 시 호출)
 */
export function validateSupabaseEnv(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.warn(
      `⚠️  Supabase 환경변수 누락: ${missing.join(', ')}\n` +
      '설정: .env.local (로컬) 또는 Vercel Secret (프로덕션)'
    );
  }

  // 프로덕션 환경에서만 강제
  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    throw new Error(`❌ Supabase 필수 환경변수 누락: ${missing.join(', ')}`);
  }
}

export const supabase = getSupabaseServerClient();
