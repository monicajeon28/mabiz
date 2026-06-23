# Supabase RLS (Row Level Security) 설정 가이드

**상태**: P0 긴급 | **우선순위**: 24시간 내 완료  
**작성일**: 2026-06-24 | **담당**: 보안 팀  
**목표**: RLS 정책 완전 활성화 + 자동 검증

---

## 📋 현황 분석

### 기존 상태
```
✅ 코드: RLS 체크 로직 구현됨 (src/app/api/cron/full-backup.ts)
❌ DB: RLS 정책 미설정 (테이블에 정책 없음)
⚠️ 리스크: 누구나 service_role_key 없이 데이터 접근 가능
```

### 민감 데이터 테이블
```sql
-- 1. crm_backup (연락처 민감 정보)
-- 2. admin_message (관리자 히스토리)
-- 3. contact_backup (Contact 스냅샷)
-- 4. payment_log (결제 로그)
-- 5. user_session (세션 데이터)
-- 6. integration_log (API 로그)
-- 7. organization_secret (API 키)
```

---

## Phase 1: 사전 준비

### Step 1-1: Supabase 프로젝트 확인
```
1. 브라우저 열기: https://app.supabase.com
2. 프로젝트 선택: monicajeon28 (또는 해당 프로젝트명)
3. Settings > Database > Connection Info 확인
   - Project URL: https://[PROJECT_ID].supabase.co
   - API Key (anon): pk_anon_xxxxxxxxxxxx
   - API Key (service_role): sk_service_role_xxxxxxxxxxxx
```

### Step 1-2: 환경변수 확인
```bash
# .env 또는 .env.local 확인
cat .env | grep SUPABASE

# 예상 출력:
# SUPABASE_URL=https://[PROJECT_ID].supabase.co
# SUPABASE_ANON_KEY=pk_anon_xxxxxxxxxxxx
# SUPABASE_SERVICE_ROLE_KEY=sk_service_role_xxxxxxxxxxxx
```

### Step 1-3: 권한 확인
```
Supabase 대시보드 > Settings > Authentication
✅ Service Role (RLS 우회 가능)는 환경변수에만 저장
❌ Anon Key는 클라이언트에만 노출
```

---

## Phase 2: RLS 정책 설정 (Supabase 대시보드)

### Step 2-1: SQL Editor 열기
```
1. Supabase 대시보드 좌측 메뉴
2. "SQL Editor" 클릭
3. "New Query" 버튼
```

### Step 2-2: 테이블별 RLS 정책 복사 & 실행

#### Policy 1: crm_backup (연락처 백업)
```sql
-- ============================================
-- crm_backup RLS 정책
-- ============================================

-- RLS 활성화
ALTER TABLE crm_backup ENABLE ROW LEVEL SECURITY;

-- 정책 1: Service Role 전체 접근 (백업용)
CREATE POLICY "service_role_full_access"
ON crm_backup
FOR ALL
USING (
  -- Service Role (CRON 작업용): 항상 허용
  auth.jwt() ->> 'role' = 'service_role'
  OR current_user_id IS NULL
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR current_user_id IS NULL
);

-- 정책 2: 익명 사용자 차단
CREATE POLICY "block_anonymous_users"
ON crm_backup
FOR ALL
USING (auth.jwt() IS NOT NULL)
WITH CHECK (false);

-- 정책 3: 조직 관리자만 조회 (향후 구현)
CREATE POLICY "org_admin_select"
ON crm_backup
FOR SELECT
USING (
  auth.uid()::text = (
    SELECT user_id FROM organization
    WHERE id = crm_backup.org_id
    AND role = 'GLOBAL_ADMIN'
    LIMIT 1
  )
);

-- 인덱스: organizationId + created_at (검색 성능)
CREATE INDEX IF NOT EXISTS idx_crm_backup_org_created
ON crm_backup(org_id, created_at DESC);
```

**실행 방법:**
1. 위 SQL 전체 복사
2. Supabase SQL Editor에 붙여넣기
3. "Run" 버튼 (또는 Ctrl+Enter)
4. 성공 메시지 확인: "ALTER TABLE | Created policy"

#### Policy 2: admin_message (관리자 히스토리)
```sql
-- ============================================
-- admin_message RLS 정책
-- ============================================

ALTER TABLE admin_message ENABLE ROW LEVEL SECURITY;

-- 정책 1: Service Role + 조직 관리자 조회
CREATE POLICY "admin_only_access"
ON admin_message
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR auth.uid()::text = (
    SELECT user_id FROM organization
    WHERE id = admin_message.org_id
    AND role = 'GLOBAL_ADMIN'
    LIMIT 1
  )
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
);

-- 정책 2: 다른 조직원 차단
CREATE POLICY "block_cross_org"
ON admin_message
FOR ALL
USING (false)
WITH CHECK (false);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_admin_message_org_type
ON admin_message(org_id, message_type);
```

#### Policy 3: contact_backup (Contact 백업)
```sql
-- ============================================
-- contact_backup RLS 정책
-- ============================================

ALTER TABLE contact_backup ENABLE ROW LEVEL SECURITY;

-- 정책 1: Service Role 우회 허용
CREATE POLICY "service_role_backup"
ON contact_backup
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 정책 2: 익명 차단
CREATE POLICY "block_anon"
ON contact_backup
FOR ALL
USING (auth.jwt() IS NOT NULL)
WITH CHECK (false);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_contact_backup_org
ON contact_backup(org_id, created_at DESC);
```

#### Policy 4: payment_log (결제 로그)
```sql
-- ============================================
-- payment_log RLS 정책
-- ============================================

ALTER TABLE payment_log ENABLE ROW LEVEL SECURITY;

-- 정책 1: Service Role + 결제 권한자
CREATE POLICY "payment_authorized"
ON payment_log
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR EXISTS (
    SELECT 1 FROM user_organization
    WHERE user_id = auth.uid()::text
    AND org_id = payment_log.org_id
    AND (role = 'GLOBAL_ADMIN' OR role = 'FINANCE_ADMIN')
  )
)
WITH CHECK (false);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payment_log_org_date
ON payment_log(org_id, created_at DESC);
```

#### Policy 5: user_session (세션 데이터)
```sql
-- ============================================
-- user_session RLS 정책
-- ============================================

ALTER TABLE user_session ENABLE ROW LEVEL SECURITY;

-- 정책 1: 본인 세션만 조회/수정
CREATE POLICY "user_own_session"
ON user_session
FOR ALL
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 정책 2: Service Role 우회
CREATE POLICY "service_role_session"
ON user_session
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_session_user_date
ON user_session(user_id, created_at DESC);
```

#### Policy 6: integration_log (API 로그)
```sql
-- ============================================
-- integration_log RLS 정책
-- ============================================

ALTER TABLE integration_log ENABLE ROW LEVEL SECURITY;

-- 정책 1: Service Role만 기록
CREATE POLICY "service_role_log"
ON integration_log
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (true);

-- 정책 2: 조직 관리자 조회
CREATE POLICY "admin_view_logs"
ON integration_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_organization
    WHERE user_id = auth.uid()::text
    AND org_id = integration_log.org_id
    AND role = 'GLOBAL_ADMIN'
  )
)
WITH CHECK (false);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_integration_log_org_date
ON integration_log(org_id, created_at DESC);
```

#### Policy 7: organization_secret (API 키)
```sql
-- ============================================
-- organization_secret RLS 정책 (가장 엄격)
-- ============================================

ALTER TABLE organization_secret ENABLE ROW LEVEL SECURITY;

-- 정책 1: 조직 관리자만 조회 (암호화된 값만)
CREATE POLICY "admin_only_secrets"
ON organization_secret
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_organization
    WHERE user_id = auth.uid()::text
    AND org_id = organization_secret.org_id
    AND role = 'GLOBAL_ADMIN'
  )
)
WITH CHECK (false);

-- 정책 2: API 키 절대 업데이트/삭제 (파이프라인만 삽입)
CREATE POLICY "service_role_insert_only"
ON organization_secret
FOR INSERT
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (true);

-- 정책 3: 다른 조직원 차단
CREATE POLICY "block_cross_org_secrets"
ON organization_secret
FOR ALL
USING (false)
WITH CHECK (false);

-- 인덱스 (암호화된 키 검색용)
CREATE INDEX IF NOT EXISTS idx_organization_secret_hash
ON organization_secret(org_id, secret_name);
```

### Step 2-3: 정책 실행 순서
```
1️⃣ crm_backup (백업 핵심)
2️⃣ admin_message (관리자 로그)
3️⃣ contact_backup (연락처 스냅샷)
4️⃣ payment_log (결제 로그)
5️⃣ user_session (세션)
6️⃣ integration_log (API 로그)
7️⃣ organization_secret (API 키 - 가장 엄격)

⚠️ 주의: 각 정책마다 "Run" 버튼 클릭
```

---

## Phase 3: 검증 (자동 스크립트)

### Step 3-1: 로컬에서 검증 스크립트 실행
```bash
# 프로젝트 루트에서
npx node scripts/validate-rls.mjs

# 예상 출력:
# ✅ crm_backup: RLS enabled, 3 policies found
# ✅ admin_message: RLS enabled, 2 policies found
# ✅ contact_backup: RLS enabled, 2 policies found
# ✅ payment_log: RLS enabled, 2 policies found
# ✅ user_session: RLS enabled, 2 policies found
# ✅ integration_log: RLS enabled, 2 policies found
# ✅ organization_secret: RLS enabled, 3 policies found
# ✅ All RLS policies active
```

### Step 3-2: Supabase 대시보드에서 시각적 확인
```
1. 좌측 메뉴 > "Table Editor"
2. 각 테이블 선택 > "Row Level Security" 탭
3. 상태 확인:
   ✅ RLS enabled: 초록색 토글
   ✅ Policies: 정책 목록 표시
```

### Step 3-3: API 테스트 (curl)
```bash
# Anon 키로 접근 시도 (차단되어야 함)
curl -X GET 'https://[PROJECT_ID].supabase.co/rest/v1/crm_backup?limit=1' \
  -H 'Authorization: Bearer pk_anon_xxxxxxxxxxxx'

# 예상 응답: 403 Forbidden (또는 빈 배열)
# {"message":"The request violated a row level security policy"}

# Service Role 키로 접근 (성공해야 함)
curl -X GET 'https://[PROJECT_ID].supabase.co/rest/v1/crm_backup?limit=1' \
  -H 'Authorization: Bearer sk_service_role_xxxxxxxxxxxx'

# 예상 응답: 200 OK + 데이터 배열
# [{"id": "...", "org_id": "...", ...}]
```

---

## Phase 4: 코드 변경 (필요시)

### Step 4-1: 환경변수 확인 (.env)
```bash
# ✅ 이미 설정되어 있어야 함:
SUPABASE_SERVICE_ROLE_KEY=sk_service_role_xxxxxxxxxxxx

# ❌ 절대 노출되면 안 됨:
# NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY (이건 쓰면 안됨!)
```

### Step 4-2: API 호출 점검
```typescript
// ✅ 올바른 방법 (서버 컴포넌트/API)
import { createClient } from '@supabase/supabase-js';

// 서버 전용 키 사용
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ✅ 서버 환경변수만 사용
);

// ❌ 잘못된 방법 (클라이언트)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // ❌ Anon만 사용
);
// 이 경우 RLS가 적용되어 데이터 접근 차단됨
```

### Step 4-3: 백업 Cron 검증 (src/app/api/cron/full-backup.ts)
```typescript
// 기존 코드가 이미 service_role_key 사용 중인지 확인
const response = await supabase
  .from('crm_backup')
  .select('*')
  .limit(1);

// ✅ 정상: RLS 활성화 후에도 계속 동작
// ❌ 오류 발생: 정책 설정 재확인
```

---

## Phase 5: 모니터링 & 롤백

### Step 5-1: RLS 문제 발생 시
```sql
-- RLS 비활성화 (긴급 복구용)
ALTER TABLE crm_backup DISABLE ROW LEVEL SECURITY;

-- 또는 특정 정책만 삭제
DROP POLICY IF EXISTS "service_role_full_access" ON crm_backup;

-- 정책 조회
SELECT * FROM pg_policies WHERE tablename = 'crm_backup';
```

### Step 5-2: 모니터링 (주간)
```bash
# 매주 금요일 확인
# 1. Supabase 대시보드 > Database > Security
# 2. 모든 테이블에 RLS enabled 확인
# 3. /api/cron/full-backup 정상 실행 확인
```

---

## Phase 6: 배포 (Vercel)

### Step 6-1: 환경변수 설정
```
Vercel 대시보드 > Settings > Environment Variables

Key: SUPABASE_SERVICE_ROLE_KEY
Value: sk_service_role_xxxxxxxxxxxx
Environments: Production + Preview
```

### Step 6-2: 배포 확인
```bash
# 배포 후 확인
curl https://mabizcruisedot.com/api/cron/full-backup \
  -H "Authorization: Bearer $CRON_SECRET"

# 예상: 200 OK + 백업 완료 메시지
```

---

## 체크리스트

- [ ] **Phase 1**: Supabase 프로젝트 확인
- [ ] **Phase 2**: 7개 테이블 RLS 정책 복사 & 실행
- [ ] **Phase 3**: 자동 검증 스크립트 실행 (0 에러)
- [ ] **Phase 4**: API 코드 검증 (service_role 키 사용)
- [ ] **Phase 5**: 롤백 계획 확인
- [ ] **Phase 6**: Vercel 환경변수 설정 & 배포 확인

---

## 참고자료

- [Supabase RLS 공식 문서](https://supabase.com/docs/guides/auth/row-level-security)
- [JWT 클레임 확인](https://supabase.com/docs/guides/auth/managing-user-data)
- [pg_policies 조회](https://www.postgresql.org/docs/current/sql-createpolicy.html)

---

**작성일**: 2026-06-24 | **상태**: P0 (24시간 내) | **담당**: 보안 팀
