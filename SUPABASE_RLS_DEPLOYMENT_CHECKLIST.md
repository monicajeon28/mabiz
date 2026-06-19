# Supabase RLS (Row Level Security) 배포 체크리스트

**프로젝트**: mabiz-crm (마비즈 CRM)  
**Supabase 프로젝트**: cnynywuxapxvythbcagz (GMcruise)  
**배포 일자**: 2026-06-19  
**상태**: 🟡 준비 완료 (수동 배포 필요)

---

## 📋 배포 단계별 체크리스트

### Phase 1: Supabase 콘솔 (SQL 마이그레이션)

**담당**: 관리자 (모니카 또는 저스틴)  
**소요시간**: ~15분  
**위험도**: ⚠️ 중간 (프로덕션 DB 변경)

#### 1.1 Supabase 로그인

- [ ] https://app.supabase.com 접속
- [ ] 프로젝트 선택: **GMcruise** (cnynywuxapxvythbcagz)
- [ ] SQL Editor 열기

#### 1.2 RLS 마이그레이션 실행

```sql
-- 경로: supabase/migrations/20260619_enable_rls_policies.sql

-- 다음 순서로 복사&붙여넣기:
1. 14개 테이블 RLS 활성화 (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
2. 역할별 정책 생성 (CREATE POLICY ...)
3. View 생성 (contact_public, contact_admin)
4. 검증 쿼리 실행 (SELECT ... FROM pg_policies)
```

**실행 버튼**: 🔘 SQL 실행

#### 1.3 결과 검증

```sql
-- 활성화된 RLS 테이블 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;

-- 기대 결과: 14개 테이블 (Organization, Contact, ContactGroup, Document, Partner, ...)
```

- [ ] RLS 활성화된 테이블: **14개** 이상
- [ ] 에러 메시지: **0개**

#### 1.4 백업 생성 (선택)

```bash
# Supabase 자동 백업 (1일마다)
# 또는 수동 백업:
# Supabase 콘솔 → Backups → Create Manual Backup
```

- [ ] 마이그레이션 전 백업 생성 (선택사항)

---

### Phase 2: Vercel 환경변수 등록

**담당**: DevOps 또는 관리자  
**소요시간**: ~10분  
**위험도**: ✅ 낮음 (환경변수만 추가)

#### 2.1 Vercel 콘솔 접속

```bash
# Option 1: 웹 콘솔 사용
https://vercel.com/dashboard

# Option 2: CLI 사용
vercel login
vercel env list
```

- [ ] Vercel 로그인
- [ ] 프로젝트 선택: **mabiz**

#### 2.2 SUPABASE_SERVICE_ROLE_KEY 추가

```bash
# CLI 방법
vercel env add SUPABASE_SERVICE_ROLE_KEY

# 입력 값:
# Variable name: SUPABASE_SERVICE_ROLE_KEY
# Variable value: [Supabase 콘솔에서 복사]
#   → Settings → API → Service Role Key → Copy
# Environments: Production (또는 All)
```

- [ ] Supabase 콘솔 → Settings → API → Service Role Key 복사
- [ ] Vercel에 SUPABASE_SERVICE_ROLE_KEY 추가
- [ ] Environment: **Production** (서버 전용)

#### 2.3 SUPABASE_URL 추가

```bash
vercel env add SUPABASE_URL
# Value: https://cnynywuxapxvythbcagz.supabase.co
# Environments: Production
```

- [ ] SUPABASE_URL 추가
- [ ] 값: `https://cnynywuxapxvythbcagz.supabase.co`

#### 2.4 SUPABASE_ANON_KEY 추가

```bash
vercel env add SUPABASE_ANON_KEY
# Value: [Supabase 콘솔 → API → anon key]
# Environments: All (클라이언트도 접근)
```

- [ ] SUPABASE_ANON_KEY 추가
- [ ] Supabase 콘솔 → Settings → API → anon (public) key 복사
- [ ] Environment: **All**

#### 2.5 NEXT_PUBLIC_SUPABASE_URL 추가

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Value: https://cnynywuxapxvythbcagz.supabase.co
# Environments: All
```

- [ ] NEXT_PUBLIC_SUPABASE_URL 추가
- [ ] 값: `https://cnynywuxapxvythbcagz.supabase.co`

#### 2.6 환경변수 확인

```bash
vercel env list
```

**기대 결과:**
```
Environment Variables (Production)
Name                          | Value
SUPABASE_SERVICE_ROLE_KEY     | eyJ... (비밀, 마스킹됨)
SUPABASE_URL                  | https://cnynywuxapxvythbcagz.supabase.co
SUPABASE_ANON_KEY             | eyJ...
NEXT_PUBLIC_SUPABASE_URL      | https://cnynywuxapxvythbcagz.supabase.co
```

- [ ] 4개 환경변수 모두 등록됨
- [ ] Environment: **Production** 설정 확인

---

### Phase 3: Next.js 라이브러리 배포

**담당**: 개발자  
**소요시간**: ~5분  
**위험도**: ✅ 낮음 (라이브러리 추가)

#### 3.1 파일 확인

```bash
# 생성된 파일 목록
ls -la src/lib/supabase-*.ts
src/app/api/test/rls-validation/route.ts
supabase/migrations/20260619_enable_rls_policies.sql
supabase/SUPABASE_RLS_GUIDE.md
```

- [ ] `src/lib/supabase-server.ts` (서버용)
- [ ] `src/lib/supabase-client.ts` (클라이언트용)
- [ ] `src/app/api/test/rls-validation/route.ts` (테스트 API)

#### 3.2 .env.local 확인 (로컬)

```bash
# D:\mabiz-crm\.env.local

# 기존 변수 (이미 있음)
SUPABASE_URL="https://cnynywuxapxvythbcagz.supabase.co"
SUPABASE_ANON_KEY="eyJ..."

# 추가 필요 (새로 추가)
SUPABASE_SERVICE_ROLE_KEY="eyJ..."  # Supabase 콘솔에서 복사
NEXT_PUBLIC_SUPABASE_URL="https://cnynywuxapxvythbcagz.supabase.co"

# ⚠️ 주의: .env.local은 git에 커밋하지 말 것!
git status | grep ".env.local"  # 결과: (출력 없음)
```

- [ ] SUPABASE_SERVICE_ROLE_KEY 추가 (.env.local)
- [ ] NEXT_PUBLIC_SUPABASE_URL 추가 (.env.local)
- [ ] .env.local은 git에 추가 안 함 (.gitignore 확인)

#### 3.3 TSC 검증

```bash
# 타입 체크 (npm run build 제외)
npx tsc --noEmit

# 기대 결과: 0 errors
```

- [ ] TypeScript 컴파일 에러: **0개**
- [ ] 경고: 무시 가능

---

### Phase 4: 정책 테스트

**담당**: QA 또는 개발자  
**소요시간**: ~20분  
**위험도**: ✅ 낮음 (읽기 전용 테스트)

#### 4.1 로컬 테스트 (localhost:3000)

```bash
# dev 서버 시작
npm run dev

# 브라우저에서 API 테스트
# GET /api/test/rls-validation?table=Contact&role=AGENT
```

**브라우저 접속:**
```
http://localhost:3000/api/test/rls-validation?table=Contact&role=AGENT
```

**기대 응답:**
```json
{
  "table": "Contact",
  "role": "AGENT",
  "tests": [
    {
      "name": "SELECT from Contact",
      "role": "AGENT",
      "status": "ALLOWED",
      "code": 200,
      "message": "조회 가능",
      "allowed": true
    }
  ],
  "validation": {
    "role": "AGENT",
    "expected": true,
    "actual": true,
    "correct": true,
    "message": "✅ AGENT의 권한이 올바르게 설정됨"
  },
  "summary": {
    "passed": 1,
    "failed": 0,
    "total": 1
  }
}
```

- [ ] Contact 테이블 SELECT 허용 (AGENT)
- [ ] 응답 상태: **200 OK**
- [ ] Validation: **correct: true**

#### 4.2 역할별 테스트

```bash
# 전체 테이블 & 역할 테스트
# POST /api/test/rls-validation
```

**cURL 예시:**
```bash
curl -X POST http://localhost:3000/api/test/rls-validation \
  -H "Content-Type: application/json" \
  -d '{
    "tables": ["Contact", "Organization", "ContactGroup", "Document"],
    "roles": ["GLOBAL_ADMIN", "AGENT", "BRANCH_MANAGER"]
  }'
```

**기대 결과:**
- [ ] GLOBAL_ADMIN: 모든 테이블 SELECT 허용
- [ ] AGENT: 소속 조직 데이터만 SELECT 허용
- [ ] BRANCH_MANAGER: 소속 지점 데이터만 SELECT 허용
- [ ] 성공률: **90%** 이상

#### 4.3 프로덕션 테스트 (vercel.app)

```bash
# 배포 후 프로덕션 테스트
https://mabiz-crm.vercel.app/api/test/rls-validation?table=Contact&role=AGENT
```

- [ ] 프로덕션 배포 완료
- [ ] 프로덕션 환경변수 적용됨
- [ ] 테스트 API 응답: **200 OK**

---

### Phase 5: 모니터링 설정

**담당**: DevOps 또는 관리자  
**소요시간**: ~15분  
**위험도**: ✅ 낮음 (모니터링만)

#### 5.1 Supabase 로그 활성화

```bash
# Supabase 콘솔 → Logs
# 다음 로그 활성화:
# - Postgres Logs
# - API Logs
# - Auth Logs
```

- [ ] Supabase 콘솔 → Logs 탭 열기
- [ ] Postgres Logs 활성화
- [ ] API Logs 활성화

#### 5.2 RLS 정책 성능 모니터링

```sql
-- Supabase SQL Editor에서 실행
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%WHERE%OrganizationMember%'
  OR query LIKE '%RLS%'
ORDER BY mean_time DESC
LIMIT 20;
```

**기대 결과:**
- [ ] 평균 응답시간: **< 5ms**
- [ ] 느린 쿼리(> 100ms): **0개**

#### 5.3 에러 트래킹 설정 (Sentry 또는 LogRocket)

```typescript
// src/app/api/test/rls-validation/route.ts에 이미 에러 로깅 추가됨
// 추가 설정 (선택):
// - Sentry integration
// - DataDog monitoring
// - CloudWatch logs
```

- [ ] 에러 로깅 테스트
- [ ] Slack 알림 설정 (선택사항)

---

## 🔐 보안 검증

### Checklist: 환경변수 보안

- [ ] .env.local이 git에 있지 않음
  ```bash
  git ls-files | grep ".env.local"  # 결과: (출력 없음)
  ```

- [ ] SUPABASE_SERVICE_ROLE_KEY가 코드에 하드코딩되지 않음
  ```bash
  grep -r "SERVICE_ROLE_KEY.*=" src/ --include="*.ts" --include="*.tsx"
  # 결과: (출력 없음)
  ```

- [ ] 환경변수 로깅 제거
  ```bash
  grep -r "console.log.*SECRET\|console.log.*SERVICE_ROLE" src/ --include="*.ts"
  # 결과: (출력 없음)
  ```

### Checklist: RLS 정책 검증

- [ ] 모든 민감한 테이블에 RLS 활성화됨
  ```sql
  SELECT COUNT(*) FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = true;
  -- 결과: 14 (또는 그 이상)
  ```

- [ ] 정책이 올바르게 적용됨
  ```sql
  SELECT COUNT(*) FROM pg_policies 
  WHERE schemaname = 'public';
  -- 결과: 40+ (대략 14테이블 × 3정책)
  ```

- [ ] PUBLIC 역할은 거부됨
  ```sql
  -- 테스트: 정책 없는 역할이 SELECT를 시도하면 거부됨
  SELECT * FROM "Contact";  -- ❌ 정책 위반 (401/403)
  ```

---

## ⚠️ 롤백 계획

**만약 문제 발생 시:**

### Quick Rollback (5분 내)

```sql
-- Supabase SQL Editor에서 실행
-- RLS 비활성화 (긴급)
ALTER TABLE "Organization" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" DISABLE ROW LEVEL SECURITY;
-- ... (모든 테이블)
```

- [ ] RLS 비활성화
- [ ] 사용자에게 공지
- [ ] 이슈 분석

### Full Rollback (30분 내)

```bash
# 마지막 백업에서 복구
# Supabase 콘솔 → Backups → Restore
```

- [ ] Supabase에서 백업 복구
- [ ] DB 연결 재시작
- [ ] 애플리케이션 테스트

---

## 📊 최종 체크리스트

### Before Deployment

- [ ] **Phase 1**: Supabase RLS 마이그레이션 완료
  - [ ] 14개 테이블 RLS 활성화
  - [ ] 정책 생성 완료
  - [ ] 에러: 0개

- [ ] **Phase 2**: Vercel 환경변수 등록 완료
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY
  - [ ] NEXT_PUBLIC_SUPABASE_URL

- [ ] **Phase 3**: Next.js 라이브러리 생성 완료
  - [ ] src/lib/supabase-server.ts
  - [ ] src/lib/supabase-client.ts
  - [ ] src/app/api/test/rls-validation/route.ts

- [ ] **Phase 4**: 정책 테스트 완료
  - [ ] 로컬 테스트: ✅
  - [ ] 역할별 테스트: ✅
  - [ ] 프로덕션 테스트: ✅

- [ ] **Phase 5**: 모니터링 설정 완료
  - [ ] Supabase 로그 활성화
  - [ ] 성능 모니터링 설정
  - [ ] 에러 트래킹 설정

### Security Verification

- [ ] 환경변수 보안
  - [ ] .env.local은 git에 없음
  - [ ] SERVICE_ROLE_KEY는 코드에 없음
  - [ ] 로깅에서 민감 정보 제거

- [ ] RLS 정책 검증
  - [ ] 모든 민감한 테이블 RLS 활성화
  - [ ] 정책이 올바르게 적용됨
  - [ ] PUBLIC 역할은 거부됨

---

## 📝 배포 후 조치

### 1. 팀 공지 (배포 완료)

```
[공지] Supabase RLS 보안 강화 배포 완료

배포 일자: 2026-06-19
환경: Production (mabiz-crm.vercel.app)

주요 변경사항:
- RLS (Row Level Security) 정책 활성화
- 민감한 데이터(비밀번호, 여권번호) 마스킹
- 역할별 접근 제어 (GLOBAL_ADMIN / AGENT / BRANCH_MANAGER)

영향 범위:
- 데이터 조회 성능: 1-5ms 오버헤드 추가 (무시할 수준)
- API 응답시간: 영향 없음
- 보안: 대폭 강화됨 ✅

테스트 방법:
GET /api/test/rls-validation?table=Contact&role=AGENT

문제 발생 시:
- Slack: #tech-support
- 이메일: tech@cruisedot.com
```

### 2. 문서 업데이트

- [ ] SUPABASE_RLS_GUIDE.md 링크를 wiki에 추가
- [ ] 온보딩 문서에 "RLS 정책" 섹션 추가
- [ ] API 문서에서 권한 관련 내용 업데이트

### 3. 정기 모니터링

```bash
# 매주 금요일: 성능 리포트
SELECT
  tablename,
  rowsecurity,
  reltuples AS row_count
FROM pg_tables
JOIN pg_class ON pg_tables.tablename = pg_class.relname
WHERE schemaname = 'public'
ORDER BY reltuples DESC;

# 매월: 정책 감사
SELECT
  tablename,
  policyname,
  permissive,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

- [ ] 주간 성능 리포트 수집
- [ ] 월간 정책 감사
- [ ] 분기별 보안 리뷰

---

## 📚 참고 자료

- [Supabase RLS 가이드](supabase/SUPABASE_RLS_GUIDE.md)
- [환경변수 보안 규칙](supabase/ENV_SECURITY_RULES.md)
- [마이그레이션 SQL](supabase/migrations/20260619_enable_rls_policies.sql)
- [테스트 API](src/app/api/test/rls-validation/route.ts)

---

**마지막 업데이트**: 2026-06-19  
**상태**: 🟡 준비 완료  
**다음 단계**: Phase 1 실행 (Supabase 콘솔 SQL 마이그레이션)
