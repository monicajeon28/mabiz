/**
 * Supabase Client (Anon Key 사용)
 *
 * 사용 가능 환경:
 * - React Components (클라이언트)
 * - Browser-side APIs
 * - NextAuth 통합
 *
 * 특징:
 * - SUPABASE_ANON_KEY는 공개 키 (브라우저에 노출 OK)
 * - RLS 정책이 자동으로 적용됨
 * - 사용자의 인증 상태(JWT)에 따라 접근 제어
 *
 * 주의:
 * - Service Role Key는 절대 사용 금지
 * - 민감한 작업(암호 변경 등)은 API Routes에서 수행
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '❌ Supabase 환경변수 누락:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL (필수, 공개)\n' +
      '- SUPABASE_ANON_KEY (필수, .env.local 또는 Vercel)\n\n' +
      '참고: "NEXT_PUBLIC_" 접두사는 클라이언트에서도 접근 가능함을 의미'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'supabase.auth.token',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      fetch: async (url, init) => {
        // 로깅 (개발 환경)
        if (process.env.NODE_ENV === 'development') {
          const method = (init?.method || 'GET').toUpperCase();
          const urlObj = new URL(url.toString());
          console.log(`[Supabase Client] ${method} ${urlObj.pathname}`);
        }

        const response = await fetch(url, init);

        // RLS 정책 위반 에러 로깅
        if (
          response.status === 403 ||
          response.status === 401 ||
          response.status === 404
        ) {
          if (process.env.NODE_ENV === 'development') {
            try {
              const json = await response.clone().json();
              console.error(
                `[Supabase RLS Error] ${response.status}:`,
                json.message
              );
            } catch (e) {
              // JSON 파싱 실패 무시
            }
          }
        }

        return response;
      },
    },
  });

  return supabaseClient;
}

/**
 * React Hook: Supabase 클라이언트 사용
 *
 * 예시:
 * const supabase = useSupabaseClient();
 * const { data } = await supabase.from('Contact').select('*');
 */
export function useSupabaseClient(): SupabaseClient {
  return getSupabaseClient();
}

/**
 * 현재 세션 사용자 정보 조회
 *
 * 예시:
 * const { user, role } = await getCurrentUser();
 */
export async function getCurrentUser() {
  const client = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    console.error('현재 사용자 정보 조회 실패:', error);
    return null;
  }

  return {
    id: user?.id,
    email: user?.email,
    role: (user?.user_metadata as any)?.role || 'CUSTOMER',
    user_metadata: user?.user_metadata,
  };
}

/**
 * RLS 정책 테스트 (개발 환경)
 *
 * 예시:
 * await testRLSPolicy('Contact');
 */
export async function testRLSPolicy(tableName: string) {
  const client = getSupabaseClient();

  try {
    const { data, error } = await (client as any)
      .from(tableName)
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error(`[RLS Test] ${tableName}: 정책 위반 또는 접근 거부`, error);
      return false;
    }

    console.log(`[RLS Test] ${tableName}: ✅ 접근 가능`);
    return true;
  } catch (err) {
    console.error(`[RLS Test] ${tableName}: 예외 발생`, err);
    return false;
  }
}

/**
 * 로그아웃 (세션 삭제)
 */
export async function signOut() {
  const client = getSupabaseClient();
  await client.auth.signOut();
  // localStorage 정리
  if (typeof window !== 'undefined') {
    localStorage.removeItem('supabase.auth.token');
  }
}

export const supabase = getSupabaseClient();
