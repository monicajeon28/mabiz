import { createClient } from '@supabase/supabase-js';

// 서버 사이드 전용 (service role — 파일 업로드/삭제)
// 클라이언트 컴포넌트에서 직접 import 금지
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
