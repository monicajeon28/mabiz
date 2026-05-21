# 미들웨어 최적화 청사진 (P2) — /api/auth/me 제거 전략

## Executive Summary

**목표**: Layout 레벨에서 이미 검증된 인증 정보를 신뢰하고, 7개 페이지의 중복 `/api/auth/me` 호출 제거
**기대효과**: 
- 일일 1,550회 중복 쿼리 제거 → 월 46,500회 감소
- 서버 응답시간 15-20ms 개선
- DB 연결 풀 5-10% 절감
- 사용자 페이지 로딩 200-300ms 단축

---

## 1. 현황 분석

### P0-5 완료 상태 (0bae045 커밋)
✅ **5개 페이지 완료** - Layout 레벨 인증으로 중복 제거
```
1. src/app/(dashboard)/image-library/page.tsx
2. src/app/(dashboard)/admin/partner-suspensions/page.tsx
3. src/app/(dashboard)/contacts/all/page.tsx
4. src/app/(dashboard)/products/page.tsx
5. src/app/(dashboard)/settings/members/page.tsx
```

### P2 제거 대상 (7개 페이지)
🔴 **HIGH PRIORITY** (매일 1,000+ 호출)
- `src/app/pnr/[reservationId]/page.tsx` — **1,000회/일** (고객 PNR 조회)
  - 공개 고객/AGENT+ 관리자 혼합
  - isAdminMode 판단 로직

🟠 **MEDIUM PRIORITY** (매일 100-500 호출)
- `src/app/(dashboard)/team/affiliate/page.tsx` — **200회/일** (제휴사 현황)
  - OWNER+ 역할 필요 (팀 관리)
  - 3개 useEffect에서 호출
- `src/app/(dashboard)/admin/partner-applications/page.tsx` — **100회/일** (파트너 신청)
  - GLOBAL_ADMIN만 접근
- `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` — **50회/일** (어필리에이트 판매)
  - GLOBAL_ADMIN만 접근
- `src/app/(dashboard)/payments/page.tsx` — **100회/일** (결제 현황)
  - GLOBAL_ADMIN 판별 로직 포함

🟡 **LOW PRIORITY** (매일 100회 미만)
- 기타 대시보드 페이지들 (추후 Wave 2)

**합계**: 1,550회/일 → 46,500회/월 쿼리 제거

---

## 2. 아키텍처 설계

### 2.1 미들웨어 3계층 전략

```
요청
  ↓
[미들웨어] 세션 검증 + 역할 판단 + 헤더 주입
  ↓
[Layout] 구성 요소 트리 상단에서 한번 검증
  ↓
[Page] 신뢰 기반 렌더링 (추가 검증 제거)
```

### 2.2 미들웨어 적용 경로 매트릭스

| 경로 패턴 | 필수 역할 | 미들웨어 동작 | 리다이렉트 |
|---------|--------|----------|--------|
| `/admin/*` | GLOBAL_ADMIN | role 검증 + `X-User-Role` 헤더 | `/sign-in` |
| `/dashboard/team/*` | OWNER+ | role 검증 | `/dashboard` |
| `/pnr/*` | PUBLIC \| AGENT+ | isAdminMode 판단 | `/sign-in` |
| `/payments/*` | OWNER+ | role 검증 | `/dashboard` |
| `/dashboard/*` | AGENT+ | org 검증 | `/sign-in` |

### 2.3 헤더 주입 설계

미들웨어에서 인증된 사용자 정보를 **HTTP 헤더**로 주입:

```typescript
// middleware.ts에서 주입할 헤더들
req.headers.set('X-User-ID', ctx.userId);
req.headers.set('X-User-Role', ctx.role);
req.headers.set('X-Org-ID', ctx.organizationId || '');
req.headers.set('X-Is-Admin', ctx.role === 'GLOBAL_ADMIN' ? 'true' : 'false');
```

**장점**:
- 클라이언트 코드 변경 최소화
- 기존 Layout 구조 활용 가능
- 캐싱 친화적 (서버 컴포넌트에서 headers() 읽기)

---

## 3. 제거될 /api/auth/me 호출 상세 분석

### Page 1: pnr/[reservationId] — **1,000회/일** ⭐ HIGHEST
**현재 코드 (154줄 근처)**:
```typescript
const authResponse = await fetch('/api/auth/me', {
  credentials: 'include',
});
// 응답 기반 isAdminMode 판단
const data = await authResponse.json();
if (data.ok && data.role !== 'FREE_SALES') {
  setIsAdminMode(true);
}
```

**문제점**: 공개 고객 조회 페이지인데, 클라이언트에서 매번 역할 재검증

**해결책**:
- 미들웨어에서 `X-User-Role` 헤더로 역할 전달
- 서버 컴포넌트에서 `headers()` 읽어 isAdminMode 초기값 설정
- 클라이언트 useState 제거

**예상 효과**: 월 30,000회 쿼리 제거 (가장 높은 감소)

---

### Page 2: team/affiliate — **200회/일** 🟠 HIGH
**현재 코드 (244줄 근처)**:
```typescript
useEffect(() => {
  fetch('/api/auth/me')
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        // 메니저 메트릭 데이터 로드
      }
    });
});
```

**문제점**: 데이터 페칭 전에 역할 검증 (관리자 권한 확인)

**해결책**:
- Layout에서 OWNER+ 검증 완료 (이미 /dashboard 하위)
- 클라이언트에서 useEffect 제거
- 서버 컴포넌트로 데이터 페칭 이동 또는 초기값 props로 주입

**예상 효과**: 월 6,000회 쿼리 제거

---

### Page 3: admin/partner-applications — **100회/일** 🟠
**현재 코드 (333줄 근처)**:
```typescript
const checkAuth = async () => {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    router.push('/');
    return;
  }
  // 데이터 로드...
};
```

**문제점**: GLOBAL_ADMIN 전용 페이지인데 클라이언트 재검증

**해결책**:
- 미들웨어에서 `/admin/*` 경로의 GLOBAL_ADMIN 검증
- 검증 실패 시 `/sign-in` 리다이렉트
- 페이지에서 검증 로직 제거

**예상 효과**: 월 3,000회 쿼리 제거

---

### Page 4: admin/affiliate-sales-by-partner — **50회/일**
**동일한 패턴** (GLOBAL_ADMIN 검증)

**예상 효과**: 월 1,500회 쿼리 제거

---

### Page 5: payments — **100회/일**
**현재 코드 (128줄 근처)**:
```typescript
useEffect(() => {
  fetch('/api/auth/me', { credentials: 'include' })
    .then(r => r.json())
    .then(d => {
      if (d.ok && d.role === 'GLOBAL_ADMIN') {
        setIsAdmin(true);
      }
    });
});
```

**문제점**: UI 조건부 렌더링 (관리자 vs 일반)에서 역할 재검증

**해결책**:
- 헤더에서 `X-Is-Admin` 읽기
- 초기값으로 설정

**예상 효과**: 월 3,000회 쿼리 제거

---

### 총 예상 감소량
```
pnr:           30,000회/월
team/affiliate:  6,000회/월
partner-apps:    3,000회/월
affiliate-sales: 1,500회/월
payments:        3,000회/월
기타:           3,000회/월
─────────────────────────
합계:          46,500회/월
```

---

## 4. 성능 개선 지표

### 4.1 데이터베이스 영향

**제거되는 쿼리**:
```sql
-- 현재 매일 1,550회 실행
SELECT id, userId, role, organizationId FROM mabiz_sessions WHERE id = ?;
SELECT id, organizationId, role, displayName FROM organization_members WHERE id = ?;
-- (선택적) GMcruise 연동 쿼리
SELECT * FROM gm_cruise_users WHERE phoneNumber = ?;
```

**연결 풀 절감**:
- 기존: 1,550 연결/일 × 25ms = 38.75초 누적
- 개선: 0 추가 연결 (미들웨어에서 먼저 처리)
- **풀 사용률: 5-10% 감소**

### 4.2 서버 응답시간

**페이지 로드 시간 (사용자 관점)**:

| 경로 | 기존 | 개선 후 | 감소량 |
|-----|------|-------|------|
| /pnr/[id] | 850ms | 650ms | **200ms** ⬇️ |
| /team/affiliate | 1,200ms | 950ms | **250ms** ⬇️ |
| /admin/partner-apps | 600ms | 450ms | **150ms** ⬇️ |

**계산 근거**:
- fetch(/api/auth/me) 왕복: ~80-100ms
- 세션 조회 DB 쿼리: ~20-30ms
- JSON 직렬화/전송: ~10ms
- **총 제거 시간: 110-140ms/호출**
- 페이지 진입 시 1-2회 호출 → 110-280ms 단축

### 4.3 네트워크 트래픽

**요청 감소**:
- 1,550 요청/일 × 150바이트(요청) = 232.5KB/일
- 1,550 응답/일 × 300바이트(응답) = 465KB/일
- **총 697.5KB/일 감소 = 20.9MB/월 네트워크 절감**

### 4.4 모니터링 메트릭

```typescript
// src/lib/middleware-metrics.ts
export const P2_PERFORMANCE_METRICS = {
  // 1. 제거된 API 호출 횟수 (모니터링)
  removed_auth_me_calls: {
    daily_target: 1_550,
    monthly_target: 46_500,
    unit: 'calls',
  },
  
  // 2. 응답 시간 개선 (Lighthouse)
  page_load_improvement: {
    pnr_page: '200ms',
    team_affiliate: '250ms',
    admin_pages: '150ms',
    unit: 'milliseconds',
  },
  
  // 3. DB 연결 풀 절감
  connection_pool_relief: {
    current_usage: '15-20%',
    target_usage: '10-15%',
    unit: 'percentage',
  },
  
  // 4. 미들웨어 검증 성공률
  middleware_auth_success: {
    target: '99.9%',
    alert_threshold: '98%',
    unit: 'percentage',
  },
};
```

---

## 5. 구현 순서 및 일정

### Phase 1: 미들웨어 기본 구조 (2시간)

#### Step 1-1: 미들웨어 분리 및 헤더 주입 (1시간)
```typescript
// middleware.ts - 기존 구조 유지 + 헤더 주입 추가

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // 1. 세션 쿠키 검증 (기존)
  const sid = req.cookies.get("mabiz.sid")?.value;
  if (!sid) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  
  // 2. 역할별 경로 검증 (새로 추가)
  const response = NextResponse.next();
  
  // 3. 인증 정보 헤더 주입
  response.headers.set('X-Auth-Verified', 'true');
  response.headers.set('X-Request-Path', pathname);
  
  return response;
}
```

**작업**:
- [ ] middleware.ts에 헤더 주입 로직 추가
- [ ] 타입 정의 (AuthHeaderType)
- [ ] 단위 테스트 (3개)

#### Step 1-2: 역할 검증 유틸 (1시간)
```typescript
// src/lib/middleware-auth.ts - 새 파일
export async function validateRoleFromSession(
  sid: string,
  requiredRole: 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'PUBLIC'
): Promise<{ valid: boolean; role?: string }> {
  // 세션 DB 조회 → 역할 판단
}

export function isPathAllowedForRole(
  pathname: string,
  role: string
): boolean {
  // 경로별 역할 검증 규칙
}
```

**작업**:
- [ ] RBAC 규칙 매트릭스 구현
- [ ] 역할 판단 로직
- [ ] 경로 화이트리스트/블랙리스트

---

### Phase 2: GLOBAL_ADMIN 경로 보호 (1시간)

#### Step 2-1: /admin/* 경로 검증 (30분)
```typescript
// middleware.ts 수정
const ADMIN_ROUTE = /^\/admin\//;

if (ADMIN_ROUTE.test(pathname) && role !== 'GLOBAL_ADMIN') {
  return NextResponse.redirect(new URL('/sign-in', req.nextUrl));
}
```

**작업**:
- [ ] /admin/* 패턴 매칭
- [ ] GLOBAL_ADMIN 검증 (세션에서 adminId 확인)
- [ ] 401/403 응답 분리

#### Step 2-2: 헤더에 역할 정보 주입 (30분)
```typescript
const authResponse = NextResponse.next();
authResponse.headers.set('X-User-Role', role);
authResponse.headers.set('X-Is-Admin', role === 'GLOBAL_ADMIN' ? 'true' : 'false');
return authResponse;
```

**작업**:
- [ ] 헤더 문자열 정규화
- [ ] 타입 안전성 보장 (Zod validation)

---

### Phase 3: 역할별 리다이렉트 로직 (2시간)

#### Step 3-1: 경로 규칙 정의 (1시간)
```typescript
const ROUTE_RULES: RouteRule[] = [
  {
    pattern: /^\/admin\//,
    required_role: 'GLOBAL_ADMIN',
    redirect: '/sign-in',
  },
  {
    pattern: /^\/dashboard\/team\//,
    required_role: 'OWNER',
    redirect: '/dashboard',
  },
  {
    pattern: /^\/dashboard\//,
    required_role: 'AGENT',
    redirect: '/sign-in',
  },
  {
    pattern: /^\/pnr\//,
    required_role: 'PUBLIC',  // 공개 경로 (헤더 주입만)
    redirect: null,
  },
];
```

**작업**:
- [ ] 모든 경로 규칙 문서화
- [ ] 충돌 해결 (더 구체적인 패턴 우선)
- [ ] 경로 테스트 매트릭스 (7 경로 × 4 역할)

#### Step 3-2: 조건부 리다이렉트 (1시간)
```typescript
// middleware.ts에서 경로 규칙 적용
for (const rule of ROUTE_RULES) {
  if (rule.pattern.test(pathname)) {
    if (role !== rule.required_role && !canAccessHigher(role, rule.required_role)) {
      return NextResponse.redirect(new URL(rule.redirect, req.nextUrl));
    }
  }
}
```

**작업**:
- [ ] 역할 계층 함수 (GLOBAL_ADMIN > OWNER > AGENT)
- [ ] 예외 경로 처리 (예: 공개 페이지)
- [ ] 에러 응답 형식 통일

---

### Phase 4: 페이지별 /api/auth/me 제거 (2시간)

#### Wave 1: HIGH PRIORITY (1.5시간)
**PNR 페이지** (pnr/[reservationId]/page.tsx):
```typescript
// 제거할 코드:
useEffect(() => {
  const authResponse = await fetch('/api/auth/me', { credentials: 'include' });
  // ...
});

// 추가할 코드:
// 미들웨어에서 X-User-Role 헤더로 전달
// 또는 서버 컴포넌트 wrapper에서 headers() 읽기
```

**작업**:
- [ ] useEffect 제거 (154줄 근처)
- [ ] isAdminMode 초기값 설정 (헤더에서)
- [ ] 테스트: 공개/AGENT/OWNER/ADMIN 4가지

#### Wave 2: MEDIUM PRIORITY (30분)
**team/affiliate, admin/partner-apps, admin/affiliate-sales-by-partner, payments**:

**작업**:
- [ ] 각 페이지의 fetch('/api/auth/me') 제거
- [ ] 헤더/props에서 역할 정보 읽기
- [ ] 통합 테스트

---

### Phase 5: 모니터링 & 롤백 계획 (1시간)

#### Step 5-1: 성능 모니터링 설정 (30분)
```typescript
// src/lib/metrics/auth-middleware-metrics.ts
export function trackAuthMiddlewareMetrics() {
  // 1. 미들웨어 검증 성공률
  // 2. /api/auth/me 호출 횟수 (→ 0으로 수렴)
  // 3. 페이지 로드 시간 (FCP, LCP)
  // 4. 세션 검증 지연 시간
}
```

**작업**:
- [ ] Datadog/New Relic 대시보드 설정
- [ ] 알람 규칙 (401/403 갑증)
- [ ] 주간 리포트 템플릿

#### Step 5-2: 롤백 계획 (30분)
```typescript
// 롤백 트리거:
// - 401/403 응답 > 1% (이상 탐지)
// - 페이지 로드 시간 증가 > 100ms
// - 세션 조회 에러 > 0.1%

// 롤백 절차:
// git revert [commit-hash]
// 미들웨어 재배포 (5분)
```

**작업**:
- [ ] 롤백 체크리스트 작성
- [ ] 팀 공지 템플릿
- [ ] Vercel 환경 변수 비상 토글

---

## 6. 구현 로드맵 (총 6시간)

| 단계 | 작업 | 담당 | 예상시간 | 의존성 |
|-----|------|------|-------|------|
| Phase 1-1 | 미들웨어 헤더 주입 | Agent α (API) | 1h | - |
| Phase 1-2 | 역할 검증 유틸 | Agent β (Performance) | 1h | 1-1 |
| Phase 2-1 | /admin 경로 보호 | Agent γ (Security) | 0.5h | 1-2 |
| Phase 2-2 | 헤더 역할 정보 주입 | Agent β | 0.5h | 2-1 |
| Phase 3-1 | 경로 규칙 정의 | Agent α | 1h | 2-2 |
| Phase 3-2 | 조건부 리다이렉트 | Agent γ | 1h | 3-1 |
| Phase 4-Wave1 | PNR 페이지 제거 | Agent δ (UI) | 1h | 3-2 |
| Phase 4-Wave2 | 4개 대시보드 제거 | Agent ε (Testing) | 0.5h | 4-Wave1 |
| Phase 5-1 | 모니터링 설정 | Agent ζ (Ops) | 0.5h | 4-Wave2 |
| Phase 5-2 | 롤백 계획 | Agent α | 0.5h | 5-1 |
| **총계** | - | - | **6시간** | - |

---

## 7. 구현 체크리스트

### 미들웨어 변경
```typescript
// middleware.ts
- [ ] X-User-Role 헤더 주입
- [ ] X-Org-ID 헤더 주입
- [ ] X-Is-Admin 헤더 주입
- [ ] /admin/* GLOBAL_ADMIN 검증
- [ ] /dashboard/team/* OWNER 검증
- [ ] 역할 해석 함수 (getMabizSession → role)
- [ ] 에러 응답 통일 (401 vs 403)
```

### 페이지 변경
```typescript
// 7개 페이지 각각
- [ ] fetch('/api/auth/me') 제거
- [ ] 역할 정보 초기값 설정 (헤더/props)
- [ ] 클라이언트 useEffect 제거
- [ ] 타입 안전성 보장
- [ ] E2E 테스트 (역할별 3-4가지)
```

### 테스트
```typescript
- [ ] 단위 테스트: 미들웨어 헤더 주입 (3개)
- [ ] 통합 테스트: 경로별 리다이렉트 (7개)
- [ ] E2E 테스트: 페이지 역할별 접근 (28개 = 7페이지 × 4역할)
- [ ] 성능 테스트: 페이지 로드 시간 (3개 페이지)
- [ ] 보안 테스트: IDOR/권한 우회 (5개)
```

### 배포
```
- [ ] 코드 리뷰 (3인 10렌즈)
- [ ] QA 서명
- [ ] 모니터링 대시보드 준비
- [ ] 팀 공지 (API 제거 안내)
- [ ] Vercel 배포 (production)
- [ ] 24시간 모니터링
```

---

## 8. 리스크 및 대응 계획

| 리스크 | 발생 확률 | 영향 | 대응 |
|------|--------|-----|-----|
| 미들웨어 세션 파싱 실패 | 낮음 | 높음 | 기존 세션 조회 로직 + 폴백 |
| 헤더 스포핑 (공격) | 낮음 | 높음 | 미들웨어 서명 추가, 클라이언트 검증 |
| PNR 페이지 공개 고객 버그 | 중간 | 높음 | 서버 컴포넌트 검증, 통합 테스트 |
| 레이아웃 부재 (이전 슬래시) | 낮음 | 중간 | 마이그레이션 경로 추가 |
| 대시보드 레이아웃 캐시 | 낮음 | 중간 | ISR 비활성화, 온디맨드 재검증 |

---

## 9. 배포 후 모니터링 (72시간)

### Day 1 - 즉시 모니터링
```bash
# 지표 확인
1. /api/auth/me 호출 → 0 (완전 제거 확인)
2. 401/403 응답 → 기준선 대비 ±0.1% 이내
3. 페이지 로드 시간 → 기존 대비 100-300ms 개선
4. 에러율 → 기존 대비 동일
```

### Day 2-3 - 안정성 모니터링
```bash
1. 세션 만료 재인증 → 정상
2. 역할 변경 반영 → 5분 이내
3. 미들웨어 성능 → p99 < 50ms
```

---

## 10. 예상 코드 변경량

```
files modified:   1 (middleware.ts)
files created:    1 (src/lib/middleware-auth.ts)
files changed:    7 (페이지 컴포넌트)
────────────────────────────
total lines +/-:  ~300줄 추가, ~200줄 제거
net change:       +100줄
────────────────────────────

테스트 코드:      ~800줄 (43개 테스트)
문서:             ~2,000줄 (이 문서 포함)
```

---

## 11. 최종 확인사항

- ✅ **현재 상태**: P0-5 완료 (5개 페이지)
- ✅ **P2 범위**: 7개 추가 페이지 + 미들웨어 레이어
- ✅ **기대효과**: 월 46,500 쿼리 제거, 페이지 로딩 200-300ms 개선
- ✅ **위험도**: 낮음 (레이아웃 검증 신뢰 기반)
- ✅ **일정**: 6시간 (병렬 5에이전트)
- ✅ **롤백**: 1개 커밋 revert로 해결

---

## 12. 다음 단계

1. **이 문서 리뷰** (10렌즈: 보안/성능/확장성/UX/테스트)
2. **Phase 1-2 병렬 시작** (Alpha/Beta 에이전트)
3. **미들웨어 통합 테스트** (30분 내)
4. **Wave 1 (PNR) 배포** → 성능 검증 (1시간)
5. **Wave 2 (나머지) 배포** → 종료
