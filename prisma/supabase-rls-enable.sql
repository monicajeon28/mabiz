-- ============================================================
-- Supabase RLS 활성화 마이그레이션
-- 프로젝트: mvfyydlcyxxblgznmrxz (jmonica-tech's Project)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 목적: public 스키마 전체 테이블 RLS 활성화
-- ============================================================

-- 1단계: public 스키마 모든 테이블에 RLS 활성화
DO $$
DECLARE
    tbl text;
    tbl_count int := 0;
BEGIN
    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        tbl_count := tbl_count + 1;
        RAISE NOTICE 'RLS 활성화: %', tbl;
    END LOOP;

    RAISE NOTICE '완료: % 개 테이블에 RLS 활성화', tbl_count;
END $$;


-- 2단계: 서버(service_role)는 RLS를 자동 우회하므로 앱은 그대로 동작
-- anon(비인증) 사용자는 이제 어떤 테이블도 접근 불가
-- authenticated(로그인) 사용자는 별도 policy 필요 시 아래 패턴 사용:

-- 예시: Contact 테이블 — 자기 조직 데이터만 조회 허용
-- CREATE POLICY "org_isolation" ON public."Contact"
--   FOR ALL
--   TO authenticated
--   USING (auth.jwt() ->> 'org_id' = "organizationId")
--   WITH CHECK (auth.jwt() ->> 'org_id' = "organizationId");


-- 3단계: 현재 RLS 상태 확인 (실행 후 검증용)
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
