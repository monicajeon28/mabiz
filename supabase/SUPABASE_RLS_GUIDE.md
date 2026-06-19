# Supabase RLS (Row Level Security) 완전 가이드

**프로젝트**: mabiz-crm (크루즈닷)  
**Supabase 프로젝트**: cnynywuxapxvythbcagz (GMcruise)  
**마지막 업데이트**: 2026-06-19

---

## 📋 목차

1. [RLS 개요](#1-rls-개요)
2. [역할 정의](#2-역할-정의)
3. [정책 설계](#3-정책-설계)
4. [환경변수 설정](#4-환경변수-설정)
5. [배포 체크리스트](#5-배포-체크리스트)
6. [테스트 계획](#6-테스트-계획)
7. [모니터링](#7-모니터링)

---

## 1. RLS 개요

### 현재 상태 (문제점)

```
❌ RLS 비활성화 → 누구나 모든 데이터 접근 가능
❌ 민감한 정보 노출 (비밀번호, 여권번호, 신용카드)
❌ 멀티테넌트 데이터 격리 없음 → A조직이 B조직 데이터 조회 가능
```

### 해결 방안 (RLS 활성화)

```
✅ 테이블별 RLS 정책 설정
✅ 역할별 접근 제어 (RBAC)
✅ 민감한 컬럼 마스킹 (암호화된 컬럼 제외)
✅ organizationId 기반 데이터 격리
```

---

## 2. 역할 정의

| 역할 | 설명 | 권한 | 예시 |
|------|------|------|------|
| **GLOBAL_ADMIN** | 시스템 관리자 | 모든 조직/데이터 조회+수정 | 모니카, 저스틴 |
| **AGENT** | 판매원 | 소속 조직 데이터만 조회 | 유진, 영호 |
| **BRANCH_MANAGER** | 지점장 | 소속 지점 데이터만 조회 | 지점장 |
| **CUSTOMER** | 일반 고객 | 본인 정보만 조회 (제한적) | - |
| **PUBLIC** | 미인증 사용자 | 접근 거부 | - |

---

## 3. 정책 설계

### 3.1 Organization 테이블

```sql
-- GLOBAL_ADMIN: 전체 조회
SELECT * FROM "Organization"  ✅

-- AGENT: 소속 조직만
SELECT * FROM "Organization"
  WHERE id IN (SELECT organizationId FROM "OrganizationMember" ...)  ✅

-- PUBLIC: 거부
SELECT * FROM "Organization"  ❌
```

### 3.2 Contact 테이블

```sql
-- GLOBAL_ADMIN: 전체 + 민감 컬럼 (password, passportNumber)
SELECT id, name, phone, email, password, passportNumber
  FROM "Contact"  ✅

-- AGENT: 소속 조직 + 공개 컬럼만
SELECT id, name, phone, email
  FROM "Contact"
  WHERE organizationId = 'org-xxx'  ✅
  -- password, passportNumber는 NULL로 마스킹

-- PUBLIC: 거부
SELECT * FROM "Contact"  ❌
```

### 3.3 정책 적용 테이블 목록

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| Organization | ✅ 역할별 | ✅ GLOBAL_ADMIN | ✅ GLOBAL_ADMIN | ✅ GLOBAL_ADMIN |
| Contact | ✅ 역할별 | ✅ AGENT+ | ✅ AGENT+ | ✅ GLOBAL_ADMIN |
| ContactGroup | ✅ 역할별 | ✅ AGENT+ | ✅ AGENT+ | ✅ AGENT+ |
| Document | ✅ 역할별 | ✅ AGENT+ | ✅ AGENT+ | ✅ GLOBAL_ADMIN |
| Partner | ✅ 역할별 | ✅ AGENT+ | ✅ AGENT+ | ✅ GLOBAL_ADMIN |
| SmsTemplate | ✅ 역할별 | ✅ AGENT+ | ✅ AGENT+ | ✅ GLOBAL_ADMIN |
| ScheduledSms | ✅ 역할별 | ✅ AGENT+ | ✅ AGENT+ | ❌ GLOBAL_ADMIN만 |
| OrganizationMember | ✅ 역할별 | ✅ BRANCH_MANAGER+ | ❌ 제한 | ❌ 제한 |

---

## 4. 환경변수 설정

### 4.1 .env.local (로컬 개발, **git 제외**)

```bash
# Supabase - 현재 .env.local에 있음 (유지)
SUPABASE_URL="https://cnynywuxapxvythbcagz.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5..."  # 공개, 클라이언트용

# ⚠️ 주의: SERVICE_ROLE_KEY는 .env.local에만 존재
# git에 절대 커밋하지 말 것!
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5..."  # 서버 전용, 비밀
```

### 4.2 .gitignore (이미 설정됨)

```bash
# .gitignore 확인
grep -E "env|SECRET|KEY|token" .gitignore

# 결과 예시:
# .env.local
# .env.*.local
# .env.production.local
# *.pem
```

### 4.3 Vercel 환경변수 설정 (프로덕션)

Vercel 콘솔 → Settings → Environment Variables

| 변수 | 값 | 환경 | 노출 |
|------|-----|------|------|
| **SUPABASE_URL** | https://cnynywuxapxvythbcagz.supabase.co | All | ✅ 공개 |
| **SUPABASE_ANON_KEY** | eyJ... | All | ✅ 공개 (브라우저) |
| **SUPABASE_SERVICE_ROLE_KEY** | eyJ... | API Only | ❌ 비밀 (서버 전용) |

**설정 방법:**

```bash
# 1. Vercel CLI로 로그인
vercel login

# 2. 환경변수 추가
vercel env add SUPABASE_SERVICE_ROLE_KEY
# 값 입력: [SERVICE_ROLE_KEY 복사&붙여넣기]
# Environment: Production

vercel env add SUPABASE_URL
# 값: https://cnynywuxapxvythbcagz.supabase.co
# Environment: Production

vercel env add SUPABASE_ANON_KEY
# 값: eyJ...
# Environment: Production
```

### 4.4 Supabase 콘솔에서 확인

1. Supabase 콘솔 로그인
   - URL: https://app.supabase.com
   - 프로젝트: GMcruise (cnynywuxapxvythbcagz)

2. Project Settings → API
   - **URL**: https://cnynywuxapxvythbcagz.supabase.co
   - **anon (public) key**: 공개, 클라이언트용
   - **service_role key**: 비밀, 서버용만

3. Authentication → Providers
   - OAuth: Google, GitHub 등 추가 설정

---

## 5. 배포 체크리스트

### Phase 1: Supabase 콘솔 (수동)

- [ ] Supabase 프로젝트 cnynywuxapxvythbcagz 로그인
- [ ] SQL Editor에서 마이그레이션 파일 실행
  ```bash
  supabase/migrations/20260619_enable_rls_policies.sql
  ```
- [ ] RLS 정책 생성 확인
  ```sql
  SELECT policyname FROM pg_policies WHERE schemaname = 'public';
  ```
- [ ] 각 테이블 RLS 활성화 확인
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = true;
  ```

### Phase 2: Vercel 환경변수 등록

- [ ] Vercel 콘솔 → Settings → Environment Variables
- [ ] SUPABASE_SERVICE_ROLE_KEY 추가 (Production)
- [ ] SUPABASE_URL 추가 (Production)
- [ ] SUPABASE_ANON_KEY 추가 (Production)

### Phase 3: Next.js API 업데이트

```typescript
// lib/supabase-server.ts (서버 전용)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 서버만
  {
    auth: {
      persistSession: false,
    },
  }
);

// lib/supabase-client.ts (클라이언트)
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!, // 공개, 브라우저 OK
);
```

### Phase 4: 정책 테스트

```typescript
// api/test/rls-test.ts
import { supabase } from '@/lib/supabase-server';

// 테스트 1: GLOBAL_ADMIN은 전체 조회 가능
const { data: allContacts } = await supabase
  .from('Contact')
  .select('*')
  .eq('organizationId', 'org-xxx');
// 결과: ✅ 전체 데이터 반환

// 테스트 2: AGENT는 소속 조직만 조회
// (JWT에서 역할 확인하고 정책 적용)

// 테스트 3: PUBLIC은 거부
const { error } = await supabase
  .from('Contact')
  .select('*');
// 결과: ❌ 정책 위반 (401 Unauthorized)
```

---

## 6. 테스트 계획

### 6.1 단위 테스트 (Unit)

```typescript
// __tests__/supabase-rls.test.ts

describe('Supabase RLS Policies', () => {
  // Test Case 1: GLOBAL_ADMIN SELECT
  test('GLOBAL_ADMIN can select all contacts', async () => {
    const admin = createAdminClient(); // SERVICE_ROLE_KEY 사용
    const { data, error } = await admin
      .from('Contact')
      .select('*');
    
    expect(error).toBeNull();
    expect(data).toHaveLength(greaterThan(0));
  });

  // Test Case 2: AGENT SELECT (organizationId 필터)
  test('AGENT can only select own organization contacts', async () => {
    const agent = createUserClient('AGENT'); // ANON_KEY + JWT
    const { data, error } = await agent
      .from('Contact')
      .select('*');
    
    expect(error).toBeNull();
    expect(data).toEqual(
      data.filter(c => c.organizationId === 'agent-org-id')
    );
  });

  // Test Case 3: PUBLIC denied
  test('PUBLIC user cannot access contacts', async () => {
    const anon = createAnonClient(); // 로그인 안 함
    const { error } = await anon
      .from('Contact')
      .select('*');
    
    expect(error?.code).toBe('PGRST116'); // 정책 위반
  });
});
```

### 6.2 통합 테스트 (Integration)

```typescript
// __tests__/supabase-integration.test.ts

describe('RLS Integration Tests', () => {
  // Test Case 4: INSERT 권한
  test('AGENT can insert contact into own org', async () => {
    const agent = createUserClient('AGENT');
    const { data, error } = await agent
      .from('Contact')
      .insert({
        name: 'Test Contact',
        organizationId: 'agent-org-id',
      });
    
    expect(error).toBeNull();
    expect(data[0].id).toBeDefined();
  });

  // Test Case 5: UPDATE 권한
  test('AGENT can update own org contact', async () => {
    const agent = createUserClient('AGENT');
    const { data, error } = await agent
      .from('Contact')
      .update({ name: 'Updated' })
      .eq('id', 'contact-id')
      .eq('organizationId', 'agent-org-id');
    
    expect(error).toBeNull();
  });

  // Test Case 6: 민감한 컬럼 마스킹
  test('AGENT cannot access password or passportNumber', async () => {
    const agent = createUserClient('AGENT');
    const { data } = await agent
      .from('Contact')
      .select('id, name, password, passportNumber');
    
    // password와 passportNumber는 NULL 또는 마스킹됨
    expect(data[0].password).toBeNull();
    expect(data[0].passportNumber).toBeNull();
  });
});
```

### 6.3 성능 테스트 (Performance)

```bash
# RLS 정책 실행 시간 모니터링
SELECT
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%WHERE%OrganizationMember%'
ORDER BY mean_exec_time DESC
LIMIT 10;

# 결과 예상:
# mean_exec_time < 5ms (서브쿼리 포함)
# mean_exec_time < 1ms (단순 필터)
```

---

## 7. 모니터링

### 7.1 Supabase 콘솔 모니터링

1. **Logs 탭**
   - SQL 쿼리 실행 로그 확인
   - 정책 위반 에러 추적

2. **Database 탭**
   - 테이블 크기
   - 인덱스 사용량
   - RLS 오버헤드

### 7.2 Next.js 로깅

```typescript
// lib/supabase-server.ts
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      fetch: async (url, init) => {
        console.log(`[Supabase] ${init?.method} ${url}`);
        const response = await fetch(url, init);
        if (!response.ok) {
          console.error(`[Supabase Error] ${response.status} ${response.statusText}`);
        }
        return response;
      },
    },
  }
);
```

### 7.3 알림 설정

- **정책 위반 에러 (401, 403)**: Slack 알림
- **느린 쿼리 (>100ms)**: 로그 수집 및 분석
- **접근 패턴 이상**: 비정상 접근 탐지

---

## 📝 FAQ

### Q1: RLS 활성화하면 성능이 저하되나?

**A**: RLS 정책 검사는 각 쿼리마다 1-5ms 오버헤드 추가됨. 대규모 쿼리(100k+ 행)에서는 더 높을 수 있음.

**최적화 방법:**
- 인덱스 추가: `CREATE INDEX idx_contact_org ON "Contact"(organizationId);`
- 정책 단순화: 서브쿼리 대신 조인 사용
- 배치 쿼리 활용: 여러 행을 한 번에 처리

### Q2: 민감한 컬럼(password, passportNumber)을 여전히 SELECT로 가져올 수 있나?

**A**: 아니오. RLS 정책에서 명시적으로 제외하거나 마스킹함.

```sql
-- password는 SELECT에서 제외
SELECT id, name, email FROM "Contact"  -- password 없음
  WHERE organizationId = 'org-xxx';

-- 복호화가 필요하면 저장프로시저 사용
SECURITY DEFINER
  SELECT decryptData(password) FROM "Contact"
  WHERE id = 'contact-id'
  AND organizationId = 'org-xxx';
```

### Q3: 로컬 개발(localhost:3000)에서 RLS를 테스트하려면?

**A**: .env.local에 SERVICE_ROLE_KEY를 추가하고 로컬 Supabase 프로젝트를 사용.

```bash
# supabase-cli 설치
npm install -g @supabase/cli

# 로컬 Supabase 시작
supabase start

# 마이그레이션 적용
supabase db push

# 로컬 anon_key 및 service_role_key 자동 생성됨
```

### Q4: 기존 데이터(현재 Neon DB의 Contacts)를 Supabase로 마이그레이션하려면?

**A**: Supabase는 백업용 이므로, Neon을 메인 DB로 유지하고 필요시 Supabase에 동기화.

```typescript
// cron job: 매일 자정에 Contact 데이터 Supabase로 복제
const syncContactsToSupabase = async () => {
  const contacts = await prisma.contact.findMany();
  
  const { error } = await supabase
    .from('Contact')
    .upsert(contacts, { onConflict: 'id' });
  
  if (error) console.error('Sync failed:', error);
};
```

---

## ✅ 완료 체크리스트

```
마이그레이션 준비 (2026-06-19)
- [✅] RLS 정책 SQL 작성
  - supabase/migrations/20260619_enable_rls_policies.sql
- [✅] 14개 주요 테이블 RLS 활성화
  - Organization, Contact, ContactGroup, Document, Partner, ...
- [✅] 역할별 정책 설계 (GLOBAL_ADMIN / AGENT / BRANCH_MANAGER)
- [✅] 민감한 컬럼 마스킹 (View 기반)

배포 준비
- [ ] Supabase 콘솔에서 SQL 실행 (Phase 1)
- [ ] Vercel 환경변수 등록 (Phase 2)
- [ ] Next.js API 클라이언트 업데이트 (Phase 3)
- [ ] 정책 테스트 (Phase 4)
- [ ] 모니터링 설정

테스트
- [ ] 단위 테스트 작성 (Unit)
- [ ] 통합 테스트 작성 (Integration)
- [ ] 성능 테스트 (Performance)

모니터링
- [ ] Supabase 로그 활성화
- [ ] Next.js 에러 로깅 추가
- [ ] Slack 알림 설정
```

---

## 📚 참고 자료

- [Supabase RLS 공식 문서](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS 정책](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT 역할 기반 접근 제어](https://supabase.com/docs/guides/auth/managing-user-data#using-webhooks)
- [민감한 데이터 암호화](https://supabase.com/docs/guides/database/encrypting-data)

---

**마지막 업데이트**: 2026-06-19  
**담당자**: mabiz-crm Agent  
**상태**: 🟡 대기 (Supabase 콘솔 수동 실행 필요)
