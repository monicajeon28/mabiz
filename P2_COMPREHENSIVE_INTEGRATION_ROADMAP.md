# P2 통합 실행 로드맵 (Comprehensive Integration Roadmap)

## Executive Summary (경영진 요약)

**프로젝트**: P2 `/api/auth/me` 호출 최적화 (7개 페이지 + 미들웨어)  
**목표**: 일일 1,550회 중복 API 호출 제거 → 월 46,500회 쿼리 감소  
**기대효과**: 페이지 로딩 200-300ms 단축, DB 연결 풀 5-10% 절감, 보안 강화  
**범위**: 5개 에이전트 병렬 작업 (Alpha/Beta/Gamma/Delta/Epsilon)  
**일정**: 6시간 (Phase 1-5, Wave 1-9)  
**리스크**: 낮음 (Layout 검증 신뢰 기반, 1개 커밋 롤백으로 복구 가능)  
**배포**: Vercel 스테이징 (1시간) → 프로덕션 (Blue-Green 배포)

---

## 1. 통합 타임라인 (Integrated Timeline)

### Phase 1: 미들웨어 기반 인증 (2시간) — Agent α (Architecture)

**Wave 1-1: 미들웨어 헤더 주입** (1시간)
```
목표: X-User-Role, X-Org-ID, X-Is-Admin 헤더 주입
담당: Agent α (API 아키텍처)

Step 1: middleware.ts 수정 (25분)
  - [ ] 세션 쿠키 검증 (기존 로직 유지)
  - [ ] 역할 정보 헤더로 주입
    - X-User-Role: 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES'
    - X-Org-ID: organizationId 또는 ''
    - X-Is-Admin: 'true' | 'false'
  - [ ] 단위 테스트 3개 작성
  - 검증: middleware 테스트 100% PASS

Step 2: 역할 검증 유틸 작성 (25분)
  - 파일: src/lib/middleware-auth.ts (신규)
  - [ ] validateRoleFromSession() 함수
  - [ ] isPathAllowedForRole() 함수
  - [ ] RBAC 규칙 매트릭스
  - 검증: 4가지 역할별 경로 규칙 테스트

Step 3: 타입 정의 (10분)
  - [ ] AuthHeader 타입 (Zod validation)
  - [ ] 폴백 처리 (헤더 누락 시)

⏱️ 예상 시간: 1시간 (병렬 불가 — 순차)
```

**Wave 1-2: 경로별 리다이렉트 규칙** (1시간) — Agent β (Performance)

```
목표: RBAC 규칙 정의 및 미들웨어 적용
담당: Agent β (성능 최적화)

Step 1: 경로 규칙 매트릭스 (30분)
  - [ ] /admin/* → GLOBAL_ADMIN 필수
  - [ ] /dashboard/team/* → OWNER 이상 필수
  - [ ] /dashboard/* → AGENT 이상 필수
  - [ ] /pnr/* → PUBLIC (공개 경로, 헤더 주입만)
  - [ ] /payments/* → OWNER 이상 필수
  - 우선순위: 더 구체적 패턴부터 검증

Step 2: 미들웨어에 규칙 적용 (30min)
  - [ ] ADMIN_ROUTE 패턴 매칭
  - [ ] GLOBAL_ADMIN 검증
  - [ ] 권한 없음 시 /sign-in 리다이렉트
  - [ ] 401 vs 403 응답 분리

검증:
  - [ ] GLOBAL_ADMIN으로 /admin/* 접근 → 200 OK
  - [ ] AGENT로 /admin/* 접근 → 403 Forbidden
  - [ ] 비로그인 사용자 → /sign-in 리다이렉트

⏱️ 예상 시간: 1시간
```

**Wave 1 병렬 작업**:
- Wave 1-1과 1-2는 **직렬** (1-1 완료 후 1-2 시작)
- Agent α와 β가 순차적으로 작업
- **총 2시간**

---

### Phase 2: Layout 레벨 권한 검증 (1시간) — Agent γ (UX)

**목표**: 페이지 접근 전 서버에서 권한 검증

```
Step 1: Admin Layout 생성 (20분)
  파일: src/app/(dashboard)/admin/layout.tsx (신규)
  ```typescript
  import { redirect } from "next/navigation";
  import { getMabizSession } from "@/lib/auth";

  export default async function AdminLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const ctx = await getMabizSession();
    
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      redirect("/");
    }

    return children;
  }
  ```
  - [ ] 코드 작성 (10분)
  - [ ] 테스트 (10분): GLOBAL_ADMIN 접근 OK, 타인 접근 리다이렉트

Step 2: Team Layout 생성 (선택) (20분)
  파일: src/app/(dashboard)/team/layout.tsx (신규)
  - [ ] OWNER 이상만 /dashboard/team/* 접근
  - [ ] AGENT는 /dashboard로 리다이렉트

Step 3: 통합 테스트 (20분)
  - [ ] 모든 역할별 접근 제어 테스트
  - [ ] 다중 탭 시나리오
  - [ ] 권한 변경 반영 (DB 변경 후 새로고침)

⏱️ 예상 시간: 1시간
⚠️ 종속성: Phase 1-2 완료 필수
```

---

### Phase 3: 페이지별 /api/auth/me 제거 (2시간) — Agent δ (Security)

**목표**: 7개 페이지에서 클라이언트 권한 검증 useEffect 제거

#### Wave 3-1: HIGH PRIORITY Pages (1.5시간)

**Page 1: `/pnr/[reservationId]` — 1,000회/일 호출** ⭐ HIGHEST
```
파일: src/app/pnr/[reservationId]/page.tsx

현재 상태:
  - useEffect에서 /api/auth/me 호출 (154줄 근처)
  - isAdminMode 상태에 의존

변경 사항:
  - [ ] useEffect 제거 (fetch('/api/auth/me'))
  - [ ] isAdminMode 제거 (클라이언트 판단 불가)
  - [ ] 공개 고객 경로는 그대로 유지
  - ⚠️ 관리자 PNR 조회는 별도 경로 필요 (/dashboard/pnr/[id])

테스트:
  - [ ] 비로그인 상태에서 공개 고객 조회
  - [ ] 전화번호 검증 성공/실패
  - [ ] 객실 배정 제출
  - 로딩 시간: 이전 2,500ms → 목표 1,800ms (28% 단축)

⏱️ 예상 시간: 45분
```

**Page 2: `/admin/partner-applications` — 100회/일 호출**
```
파일: src/app/(dashboard)/admin/partner-applications/page.tsx

현재:
  - useEffect에서 /api/auth/me 호출 (333줄)
  - authChecked 상태로 데이터 로드 게이팅

변경:
  - [ ] useEffect 권한 검증 완전 제거 (라인 329-349)
  - [ ] authChecked 상태 변수 제거 (라인 322)
  - [ ] loadApplications useEffect 수정 (라인 370-374)
    - authChecked 의존성 제거
    - 즉시 로드하도록 변경
  - [ ] Layout에서 이미 GLOBAL_ADMIN 검증됨 → 페이지는 신뢰

테스트:
  - [ ] GLOBAL_ADMIN 접근 → 페이지 로드 (< 500ms)
  - [ ] AGENT 접근 → 리다이렉트
  - [ ] 신청서 승인/반려 버튼 기능 정상

⏱️ 예상 시간: 20분
```

**Page 3: `/admin/affiliate-sales-by-partner` — 50회/일 호출**
```
파일: src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx

변경:
  - [ ] useEffect 권한 검증 제거 (라인 79-98)
  - [ ] authChecked 상태 제거 (라인 76)
  - [ ] handleLoad useEffect 수정 (라인 151-154)

⏱️ 예상 시간: 15분
```

**Wave 3-1 병렬화**:
- Page 1: Agent δ 담당 (45분)
- Page 2 + Page 3: 동시 진행 가능 (35분)
- **순차 작업이지만 Page 2와 3은 동시 처리 가능**
- **Wave 3-1 총 50분**

#### Wave 3-2: MEDIUM PRIORITY Pages (30분)

**Page 4: `/team/affiliate` — 200회/일 호출**
```
파일: src/app/(dashboard)/team/affiliate/page.tsx

현재:
  - 3개 useEffect에서 각각 /api/auth/me 호출 (244줄 근처)

변경:
  - [ ] 3회 호출 모두 제거
  - [ ] 중복 역할 검증 제거
  - [ ] 데이터 로드 의존성 단순화

⏱️ 예상 시간: 15분
```

**Page 5: `/payments` — 100회/일 호출**
```
파일: src/app/(dashboard)/payments/page.tsx

변경:
  - [ ] /api/auth/me 호출 제거 (128줄 근처)
  - [ ] isAdmin 상태 제거
  - [ ] 헤더의 X-Is-Admin으로 초기값 설정

⏱️ 예상 시간: 15분
```

**Wave 3-2 총 30분**

**Phase 3 총합**:
- Wave 3-1: 50분 (HIGH: PNR + Partner Apps + Affiliate Sales)
- Wave 3-2: 30분 (MEDIUM: Team Affiliate + Payments)
- **총 1시간 20분 → 목표 2시간에 포함**

---

### Phase 4: 보안 & 성능 검증 (1시간) — Agent ε (Integration)

**Wave 4-1: 자동화 테스트** (30분)

```
Jest 테스트 실행 (src/app/api/__tests__/p2-security.test.ts)

TRACK A: RBAC 우회 방지 (10개 테스트)
  - [ ] /api/admin/* GLOBAL_ADMIN only
  - [ ] /api/team/* FREE_SALES 차단
  - [ ] 미인증 요청 → 401
  
TRACK B: PII 노출 방지 (5개 테스트)
  - [ ] 연락처 마스킹 확인
  - [ ] 서류 접근 제한 확인
  - [ ] PII 접근 로그 기록

TRACK C: 세션 무효화 (3개 테스트)
  - [ ] 로그아웃 후 API 접근 불가
  - [ ] 권한 변경 즉시 반영
  - [ ] 다중 탭 동기화

TRACK D: CSRF & Origin (2개 테스트)
  - [ ] Cross-Origin 요청 차단
  - [ ] POST CSRF 토큰 검증

TRACK E: 토큰 위조 (4개 테스트)
  - [ ] 위조된 JWT 거부
  - [ ] 만료된 토큰 거부
  - [ ] 토큰 재사용 방지
  - [ ] 토큰 서명 검증

명령어:
  npm test -- src/app/api/__tests__/p2-security.test.ts --coverage

목표: 
  - [ ] 24개 테스트 모두 PASS
  - [ ] 커버리지 >= 90% (RBAC 경로)

⏱️ 예상 시간: 30분
```

**Wave 4-2: 성능 & 접근성 검증** (30분)

```
Step 1: Lighthouse 성능 테스트 (15분)
  - [ ] 모든 페이지 점수 >= 90
  - [ ] Core Web Vitals 확인
    - LCP: < 2.5s
    - CLS: < 0.1
    - INP: < 200ms
  - [ ] /api/auth/me 호출 0 확인 (Network 탭)

Step 2: UX 검증 체크리스트 (15분)
  - [ ] PNR 조회: 공개 고객 경로 정상
  - [ ] 파트너 신청: GLOBAL_ADMIN만 접근
  - [ ] 제휴사 현황: OWNER+ 접근
  - [ ] 결제 현황: 정산금 정보 비노출
  - [ ] 다중 탭 세션 동기화
  - [ ] 모바일/태블릿 호환성
  - [ ] 접근성 (키보드 네비, 스크린 리더)

⏱️ 예상 시간: 30분
```

**Phase 4 총합**: 1시간

---

### Phase 5: 배포 & 모니터링 (1시간) — Agent ε (Integration)

**Wave 5-1: 스테이징 배포** (30분)

```
Step 1: 빌드 & 배포 (15min)
  - [ ] npm run build 성공
  - [ ] Vercel 스테이징 환경 배포
  - [ ] 환경 변수 확인

Step 2: 스테이징 QA (15min)
  - [ ] 모든 페이지 로드 가능
  - [ ] 역할별 접근 제어 정상
  - [ ] API 응답 시간 개선 확인 (기준선 수집)
  - [ ] 에러율 모니터링 (1시간)

Go/No-Go 의사결정:
  - [ ] 에러율 < 1%? (성공 → 다음 단계)
  - [ ] PII 노출 0건? (성공 → 다음 단계)
  - [ ] API 응답 시간 개선? (성공 → 다음 단계)

⏱️ 예상 시간: 30분
```

**Wave 5-2: 프로덕션 배포 & 모니터링** (30분)

```
Step 1: Blue-Green 배포 (10min)
  - [ ] Vercel 프로덕션 배포 (자동 Blue-Green)
  - [ ] 트래픽 10% → 50% → 100% 단계적 증가
  - [ ] 각 단계마다 5-10분 모니터링

Step 2: 성능 메트릭 모니터링 (20min)
  - [ ] 401/403 에러율 (기준선 대비 ±0.1% 이내)
  - [ ] API 응답 시간 (개선 확인)
  - [ ] 페이지 로드 시간 (200-300ms 단축)
  - [ ] DB 연결 풀 사용률 (5-10% 감소)
  - [ ] 사용자 피드백 (Slack, 이메일)

임계값 (즉시 롤백):
  - PII 노출 > 0건
  - RBAC 우회 성공
  - 에러율 > 5% 증가
  - LCP > 3초

24시간 모니터링:
  - [ ] Day 1: 즉시 모니터링 (1시간)
  - [ ] Day 2-3: 안정성 확인 (daily check)

⏱️ 예상 시간: 30분 (배포 중) + 24시간 (지속 모니터링)
```

**Phase 5 총합**: 1시간 배포 + 24시간 모니터링

---

## 2. 병렬화 기회 (Parallelization Opportunities)

### 5명 에이전트 병렬 작업 계획

```
Timeline (6시간)
├─ Alpha (Architecture)
│  ├─ Phase 1-1: 미들웨어 헤더 주입 (1시간) [15:00-16:00]
│  └─ Phase 3: 페이지 1 수정 + 테스트 (45분, Wave 3-1 중) [16:00-16:45]
│
├─ Beta (Performance)
│  ├─ Phase 1-2: 경로 규칙 & 미들웨어 (1시간) [16:00-17:00] ← Alpha 1-1 완료 후
│  └─ Phase 4-2: 성능 & 접근성 검증 (30분) [17:30-18:00]
│
├─ Gamma (UX)
│  ├─ Phase 2: Layout 레벨 권한 검증 (1시간) [16:00-17:00] ← Alpha 1-1 완료 후
│  └─ Phase 4-1: 자동화 테스트 (30분, 부분) [17:30-18:00]
│
├─ Delta (Security)
│  ├─ Phase 3-1: Pages 1-3 수정 (50분) [16:00-16:50] ← Beta 1-2 완료 후
│  └─ Phase 3-2: Pages 4-5 수정 (30분) [16:50-17:20]
│
└─ Epsilon (Integration)
   ├─ Phase 4-1: 보안 테스트 orchestration (30분) [17:20-17:50]
   └─ Phase 5: 배포 & 모니터링 (1시간) [17:50-18:50]

병렬 가능 구간:
  1. Phase 1-1과 2 (미들웨어 헤더 주입 후 Layout 생성) → 가능
  2. Phase 3-1과 3-2 (고우선순위와 중우선순위) → 가능 (의존성 없음)
  3. Phase 4-1과 4-2 (테스트와 검증) → 가능 (의존성 없음)

의존성 관계:
  Phase 1-1 → Phase 1-2 (순차)
  Phase 1-2 → Phase 3 (순차)
  Phase 2 || Phase 1-1 (병렬)
  Phase 4 || Phase 3 (병렬 가능하지만, 순차 권장 — 테스트는 구현 후)
  Phase 5 || Phase 4 (순차 — 배포는 검증 완료 후)

최적화 스케줄:
  15:00-16:00  | Phase 1-1 (Alpha)
  16:00-17:00  | Phase 1-2 (Beta) + Phase 2 (Gamma)
  16:00-16:50  | Phase 3-1 (Delta) ← Phase 1-2 완료 의존
  16:50-17:20  | Phase 3-2 (Delta)
  17:20-17:50  | Phase 4-1 (Epsilon)
  17:50-18:00  | Phase 4-2 (Beta/Epsilon)
  18:00-18:50  | Phase 5 (Epsilon)

실제 총 시간: 3시간 50분 (6시간 → 3.8시간)
```

---

## 3. Wave 기반 배포 계획 (Wave-based Deployment)

### Wave 구조 (All-or-Nothing 방지)

```
Wave 1: 미들웨어 기반 인증 (1-2시간)
  ├─ 미들웨어 헤더 주입 (go/no-go: 테스트 100% PASS)
  ├─ 경로 규칙 적용 (go/no-go: RBAC 테스트 4개 PASS)
  └─ Layout 레벨 권한 검증 (go/no-go: 역할별 접근 제어 정상)
  결과: 기반 인프라 완료, 페이지 변경 전 모든 검증 완료

Wave 2: HIGH Priority 페이지 (1시간)
  ├─ Page 1: PNR 조회 (go/no-go: 공개 고객 경로 정상)
  ├─ Page 2: 파트너 신청 (go/no-go: GLOBAL_ADMIN만 접근)
  └─ Page 3: 어필리에이트 판매 (go/no-go: 차트 렌더링 정상)
  결과: 월 34,500회 쿼리 제거 (가장 큰 감소)

Wave 3: MEDIUM Priority 페이지 (30분)
  ├─ Page 4: 제휴사 현황 (go/no-go: 필터 변경 성능 확인)
  └─ Page 5: 결제 현황 (go/no-go: 정산금 정보 비노출)
  결과: 월 9,000회 쿼리 추가 제거

Wave 4: 보안 & 성능 검증 (1시간)
  ├─ RBAC 우회 테스트 (24개 Jest 테스트)
  ├─ PII 노출 테스트 (마스킹 확인)
  ├─ 세션 무효화 테스트 (다중 탭)
  └─ 성능 메트릭 확인 (Lighthouse)
  결과: 모든 보안 검증 완료

Wave 5: 배포 & 모니터링 (1시간)
  ├─ 스테이징 배포 (30min) → go/no-go
  └─ 프로덕션 배포 (Blue-Green) → 24시간 모니터링

각 Wave 사이 Go/No-Go:
  Wave 1 완료 → Wave 2 시작 여부 결정
  Wave 2 완료 → Wave 3 시작 여부 결정
  Wave 3 완료 → Wave 4 시작 여부 결정
  Wave 4 완료 → Wave 5 (배포) 시작 여부 결정

Roll-forward 가능:
  Wave 1 FAIL → 미들웨어 수정 후 재시작
  Wave 2 FAIL → 특정 페이지만 롤백 (Wave 3 진행 가능)
  Wave 3 FAIL → Wave 3만 재작업 (Wave 2는 유지)
  Wave 4 FAIL → 배포 연기, 보안 팀 재검토
  Wave 5 FAIL → 즉시 롤백 (1개 커밋 revert)
```

---

## 4. 의존성 및 게이팅 (Dependencies & Gates)

### Phase 간 의존성 (Explicit)

```
Phase 1-1 (Middleware Headers)
  └─ Phase 1-2 (Path Rules) [필수]
      └─ Phase 2 (Layout Auth) [권장]
           └─ Phase 3 (Page Refactoring) [필수]
                └─ Phase 4 (Testing) [필수]
                     └─ Phase 5 (Deployment) [필수]

Phase 2는 Phase 1-1과 병렬 가능 (독립적)
Phase 4는 Phase 3과 병렬 가능하지만 순차 권장
```

### Go/No-Go 기준점 (Decision Gates)

```
Gate 1: Phase 1-1 완료 후
  조건: middleware.ts 테스트 100% PASS
  YES → Phase 1-2 시작
  NO  → middleware 수정 후 재테스트

Gate 2: Phase 1-2 완료 후
  조건: RBAC 테스트 4개 모두 PASS (GLOBAL_ADMIN/OWNER/AGENT/FREE_SALES)
  YES → Phase 2 & Phase 3 시작
  NO  → 경로 규칙 재검토

Gate 3: Phase 2 + 3 완료 후
  조건: 
    - npm run build 성공
    - 모든 페이지 /api/auth/me 호출 0
    - DevTools Network 탭 확인
  YES → Phase 4 시작
  NO  → 페이지별 수정 재검토

Gate 4: Phase 4 완료 후
  조건:
    - Jest 테스트 24개 모두 PASS
    - 성능 개선 확인 (LCP < 2.5s)
    - 모든 역할 접근 제어 정상
  YES → 스테이징 배포 (Phase 5-1)
  NO  → 테스트 실패 원인 분석

Gate 5: 스테이징 배포 후 (1시간 모니터링)
  조건:
    - 에러율 < 1%
    - PII 노출 0건
    - API 응답 시간 개선 확인
  YES → 프로덕션 배포 (Phase 5-2)
  NO  → 스테이징에서 문제 해결, 프로덕션 배포 미루기

Gate 6: 프로덕션 배포 후 (24시간 모니터링)
  조건:
    - 401/403 에러율 ±0.1% 이내
    - LCP 개선 유지 (200-300ms)
    - 사용자 피드백 부정적 없음
  YES → 배포 완료
  NO  → 즉시 롤백 (1개 커밋 revert)

즉시 롤백 트리거:
  - PII 노출 > 0건 → CRITICAL
  - RBAC 우회 성공 → CRITICAL
  - 무한 리다이렉트 루프 → CRITICAL
  - 에러율 > 5% 증가 → HIGH
```

---

## 5. 위험 요소 및 대응 (Risk Mitigation)

### Risk Matrix

```
| 위험 요소 | 확률 | 영향 | 심각도 | 대응 |
|----------|------|------|--------|------|
| API 권한 검증 미흡 | 중 | 높음 | P0 | Wave 4 자동화 테스트 강화 (TRACK A 10개) |
| 다중 탭 권한 불일치 | 중 | 중 | P1 | Wave 4 세션 동기화 테스트 (TRACK C 3개) |
| PII 노출 | 낮음 | 매우 높음 | P0 | Wave 4 PII 테스트 (TRACK B 5개) + 모니터링 |
| 성능 악화 (LCP > 3s) | 낮음 | 중 | P2 | Wave 4 Lighthouse 벤치마크 |
| 다중 조직 권한 캐시 | 중 | 중 | P1 | Wave 5 모니터링: 권한 변경 전파 확인 |
| Layout 캐시 문제 | 낮음 | 중 | P2 | ISR 비활성화, 온디맨드 재검증 |
| 배포 중 트래픽 증가 | 낮음 | 중 | P2 | Blue-Green 배포, 트래픽 낮은 시간 선택 |
| 미들웨어 성능 저하 | 낮음 | 중 | P2 | 미들웨어 캐싱 검토, 응답 시간 모니터링 |

대응 우선순위:
  P0 (즉시 해결): API 권한, PII 노출
  P1 (배포 전 해결): 다중 탭, 다중 조직 권한
  P2 (배포 후 모니터링): 성능, Layout 캐시
```

### Contingency Plan

```
Scenario A: Phase 1-2 RBAC 테스트 실패
  원인: 경로 패턴 매칭 오류
  대응:
    1. ROUTE_RULES 매트릭스 재검토
    2. 정규식 테스트 추가 (edge case)
    3. 예시: /admin/v2/* 등 미처리 경로 확인
  시간: 30분 추가

Scenario B: Phase 3 페이지 수정 후 빌드 실패
  원인: 타입 오류, import 누락
  대응:
    1. npm run build 에러 메시지 확인
    2. 해당 파일 타입 수정
    3. 테스트 재실행
  시간: 15분 추가

Scenario C: Wave 4 Jest 테스트 2-3개 실패
  원인: Mock 설정 오류, 실제 버그
  대응:
    1. 실패 테스트 로그 분석
    2. 실제 코드 버그인지 테스트 설정 오류인지 판단
    3. 해당 API/페이지 수정
  시간: 30분 추가

Scenario D: 스테이징 배포 후 에러율 > 1%
  원인: 미들웨어 성능 저하, 특정 역할의 예외 처리
  대응:
    1. 에러 로그 분석 (Sentry)
    2. 가장 많은 에러의 원인 파악
    3. 해당 경로/API 수정
    4. 스테이징 재배포
  시간: 45분 추가

Scenario E: 프로덕션 배포 후 PII 노출 감지
  원인: 마스킹 로직 누락
  대응:
    1. 즉시 롤백 (git revert [commit-hash])
    2. 원인 분석 (권한별 마스킹 확인)
    3. 코드 수정
    4. 테스트 추가
    5. 재배포
  시간: 1시간

Scenario F: 사용자가 "페이지가 빈 화면 표시" 보고
  원인: Hydration Mismatch, 권한 변경 미반영
  대응:
    1. 해당 사용자의 역할/세션 확인
    2. 브라우저 콘솔 에러 확인
    3. 캐시 문제인지 로직 오류인지 판단
    4. 필요시 next/image 최적화, revalidatePath() 추가
  시간: 30분

종합 대응 시간:
  최악의 경우 (Scenario A-F 모두 발생): +3시간
  합리적 시나리오 (1-2개 발생): +1시간
  최선의 경우: 추가 시간 없음
```

---

## 6. 최종 검증 체크리스트 (Pre-Deployment)

### 코드 검토 (Code Review) — 3인

```
[Alpha 리뷰]
  [ ] middleware.ts 헤더 주입 로직 정확성
  [ ] AuthHeader 타입 정의 완성도
  [ ] 예외 처리 (헤더 누락 시) 신뢰성

[Beta 리뷰]
  [ ] ROUTE_RULES 매트릭스 완성도 (7개 경로 모두 포함)
  [ ] 권한 계층 함수 (GLOBAL_ADMIN > OWNER > AGENT) 정확성
  [ ] 리다이렉트 로직 (401 vs 403) 구분

[Gamma 리뷰]
  [ ] Layout 컴포넌트 권한 검증 로직
  [ ] 페이지 로드 순서 (server component → client component)
  [ ] 재검증 메커니즘 (세션 만료 감지)

[Delta 리뷰]
  [ ] 페이지 5개 모두 /api/auth/me 호출 완전 제거
  [ ] authChecked 상태 변수 제거
  [ ] 의존성 배열 수정 정확성

[Epsilon 리뷰]
  [ ] 전체 통합 로직 (Phase 1-5 조화)
  [ ] 배포 체크리스트 완성도
  [ ] 모니터링 대시보드 설정
```

### 테스트 검증 (Test Coverage)

```
[ ] 단위 테스트
    [ ] middleware.ts: 3개 테스트
    [ ] RBAC 함수: 4개 테스트
    [ ] 각 페이지: 20개 테스트 (5개 × 4가지)
    목표: 90% 라인 커버리지

[ ] 통합 테스트
    [ ] Jest: 24개 보안 테스트 (TRACK A-E)
    [ ] E2E: 각 페이지별 역할별 (28개 시나리오)
    목표: 모두 PASS

[ ] 성능 테스트
    [ ] Lighthouse: 90점 이상 (모든 페이지)
    [ ] Core Web Vitals: LCP < 2.5s, CLS < 0.1
    [ ] /api/auth/me 호출: 0 확인

[ ] 보안 테스트
    [ ] RBAC 우회 시도 (5개 시나리오)
    [ ] PII 노출 확인 (3개 필드: phone, email, passport)
    [ ] 세션 만료 후 API 접근 불가
    [ ] 토큰 위조 거부

[ ] 접근성 테스트
    [ ] 키보드 네비게이션 (Tab, Enter, Esc)
    [ ] 스크린 리더 호환성 (NVDA, JAWS)
    [ ] 색상 명도 대비 (WCAG AA)

[ ] 다중 탭 테스트
    [ ] 탭 A 로그아웃 → 탭 B 새로고침 (리다이렉트 100ms 이내)
    [ ] 탭 A 권한 변경 → 탭 B 반영 (next-auth 세션 갱신)
    [ ] 탭 A 조직 전환 → 탭 B 동기화
```

### 배포 준비 (Deployment Readiness)

```
인프라:
  [ ] Vercel 스테이징 환경 준비
  [ ] 환경 변수 설정 (DATABASE_URL, NEXTAUTH_SECRET 등)
  [ ] 모니터링 대시보드 (Datadog, LogRocket) 설정
  [ ] 알람 규칙 생성 (PII 노출, RBAC 우회, 에러율 급증)

문서:
  [ ] 배포 계획 문서 완성
  [ ] 롤백 절차 명시화 (자동 롤백 스크립트 준비)
  [ ] 운영팀 대기 모드 안내 (긴급 번호, 담당자 배정)
  [ ] 영업팀 공지 (새 어드민 PNR 경로: /dashboard/pnr/[id])

팀:
  [ ] 개발팀 최종 리뷰 (코드 리뷰 완료)
  [ ] QA팀 서명 (통합 테스트 PASS)
  [ ] 보안팀 승인 (RBAC, PII 검증)
  [ ] 운영팀 준비 (24시간 모니터링 준비)

커뮤니케이션:
  [ ] Slack 채널 생성 (#p2-deployment)
  [ ] 배포 일정 공지 (전사 안내)
  [ ] 사용자 가이드 배포 (새 관리자 경로)
  [ ] 핫라인 정보 공유 (장애 발생 시 연락처)
```

---

## 7. 배포 후 모니터링 (Post-Deployment Monitoring)

### Day 1: 즉시 모니터링 (1시간)

```
배포 직후 (T+0-5분):
  [ ] 기본 기능 확인
    [ ] 모든 페이지 로드 가능
    [ ] 403 리다이렉트 정상
    [ ] 데이터 표시 정상

배포 후 15분 (T+15분):
  [ ] 에러 로그 확인 (Sentry)
    [ ] 401/403 에러율 (기준선 대비 ±0.1%)
    [ ] 500 에러 0 (신규 에러 없음)
    [ ] Hydration Mismatch 0

배포 후 30분 (T+30분):
  [ ] 성능 메트릭 수집
    [ ] 페이지 로드 시간 (기준선 대비 개선)
    [ ] API 응답 시간 (개선 확인)
    [ ] DB 쿼리 시간 (감소 확인)

배포 후 1시간 (T+1시간):
    [ ] 종합 판정
      [ ] 에러율 정상? → YES
      [ ] PII 노출 없음? → YES
      [ ] 성능 개선 유지? → YES
      [ ] 사용자 피드백 없음? → YES
    GO → 24시간 모니터링 진행
    NO-GO → 원인 분석, 필요시 롤백
```

### Day 2-3: 안정성 모니터링

```
Daily Check (매일 아침):
  [ ] 에러율 (과거 24시간)
  [ ] 성능 메트릭 (LCP, CLS, INP)
  [ ] 사용자 피드백 (Slack #p2-deployment)
  [ ] 권한 검증 오류 (로그 분석)

주간 리포트:
  [ ] 전체 메트릭 요약
    - /api/auth/me 호출 감소: 1,550회/일 → 0 (100%)
    - 페이지 로딩 개선: 평균 200-300ms
    - DB 연결 풀 절감: 5-10%
    - 사용자 만족도: NPS 점수
  [ ] 이슈 분석 및 해결 현황
  [ ] 향후 개선 사항

모니터링 종료:
  [ ] 7일 이상 안정적 운영 → 모니터링 해제
  [ ] 이슈 발생 시 → 추가 모니터링
```

### 롤백 기준 (Rollback Criteria)

```
즉시 롤백 필수 (CRITICAL):
  [ ] PII 노출 > 0건 (보안 위반)
  [ ] RBAC 우회 성공 (권한 검증 실패)
  [ ] 무한 리다이렉트 루프 (사용자 차단)
  [ ] 에러율 > 5% 증가 (시스템 장애)

주의 모니터링 (HIGH):
  [ ] 다중 탭 권한 불일치 (사용자 혼동)
  [ ] API 응답 시간 > 100% 증가 (성능 악화)
  [ ] 로그아웃 후 세션 동기화 > 5초 (UX 나쁨)

롤백 절차:
  1. 즉시 판정 (에러 로그 확인)
  2. 이해관계자 알림 (Slack, 이메일)
  3. 롤백 실행: git revert [commit-hash]
  4. Vercel 배포 (자동)
  5. 1시간 모니터링
  6. 원인 분석 (보안팀)
  7. 수정 후 재배포 (다음 일정)
```

---

## 8. 최종 로드맵 요약 (Final Summary)

### 시간 배분

```
Phase 1: 미들웨어 기반 인증     2시간  (40%)
Phase 2: Layout 레벨 검증      1시간  (17%)
Phase 3: 페이지별 수정         1.5시간 (25%)
Phase 4: 보안 & 성능 검증      1시간  (17%)
Phase 5: 배포 & 모니터링       1시간  (17%)
─────────────────────────────────────────
총 6시간 + 24시간 모니터링

병렬화 이후:
  실제 소요 시간: ~4시간 (5명 동시 작업)
```

### 5명 에이전트 역할

```
Alpha (Architecture): 미들웨어 헤더 주입, 경로 규칙 협력
Beta (Performance): 경로 규칙 & 미들웨어, 성능 검증
Gamma (UX): Layout 인증, 사용자 경험 검증
Delta (Security): 페이지 리팩토링, 보안 검증
Epsilon (Integration): 전체 통합, 배포 & 모니터링
```

### 기대효과 (Expected Outcomes)

```
성능:
  - /api/auth/me 호출: 1,550회/일 → 0 (월 46,500회 제거)
  - 페이지 로딩 시간: 200-300ms 단축
  - DB 쿼리 시간: 50-70ms 절감 (월 $50-100 절약)
  - DB 연결 풀: 5-10% 사용률 감소

보안:
  - RBAC 검증: 클라이언트 → 서버 이동 (더 안전)
  - PII 보호: 마스킹 강화 (권한별)
  - 세션 무효화: 즉시 반영 (다중 탭)

사용자 경험:
  - 로딩 속도: 체감상 "더 빠름"
  - 권한 검증: 레이아웃에서 즉시 처리 (깜박임 없음)
  - 에러 메시지: 더 명확함 (서버 → 클라이언트)

운영:
  - 배포: 1개 커밋으로 롤백 가능 (리스크 낮음)
  - 모니터링: 자동화된 알람 규칙 (24시간 대응)
  - 문서화: 완벽한 구현 가이드 (다른 프로젝트 참고)
```

---

## Appendix: 커밋 메시지 템플릿

```bash
# Phase 1-1: 미들웨어 헤더 주입
git commit -m "feat(middleware): P2 Step 1 - X-User-Role/Org-ID 헤더 주입
- middleware.ts: getAuthContext() → 역할 정보 헤더 추가
- src/lib/middleware-auth.ts: 신규 유틸 함수 (validateRoleFromSession)
- 단위 테스트 3개 추가 (middleware.test.ts)
- 성능: 420회/일 → 0 (월 12,600회 쿼리 절감)

Co-Authored-By: Alpha <noreply@anthropic.com>
Co-Authored-By: Beta <noreply@anthropic.com>"

# Phase 1-2: 경로 규칙 및 미들웨어 적용
git commit -m "feat(middleware): P2 Step 2 - RBAC 경로 규칙 적용
- middleware.ts: /admin/*, /dashboard/team/* 경로 검증 추가
- src/lib/middleware-auth.ts: ROUTE_RULES 매트릭스 구현
- 통합 테스트 7개 추가
- 보안: 클라이언트 권한 검증 제거 (서버로 이동)

Co-Authored-By: Beta <noreply@anthropic.com>
Co-Authored-By: Gamma <noreply@anthropic.com>"

# Phase 2: Layout 레벨 권한 검증
git commit -m "feat(layouts): P2 Step 3 - Admin/Team Layout 권한 검증
- src/app/(dashboard)/admin/layout.tsx: 신규 (GLOBAL_ADMIN 검증)
- src/app/(dashboard)/team/layout.tsx: 신규 (OWNER+ 검증)
- 레이아웃 테스트 8개 추가
- UX: 권한 없는 사용자 즉시 리다이렉트 (100ms 단축)

Co-Authored-By: Gamma <noreply@anthropic.com>
Co-Authored-By: Delta <noreply@anthropic.com>"

# Phase 3: 페이지별 /api/auth/me 제거
git commit -m "refactor(pages): P2 Step 4 - /api/auth/me 제거 (7개 페이지)
- src/app/pnr/[reservationId]/page.tsx: useEffect 제거, isAdminMode 제거
- src/app/(dashboard)/admin/partner-applications/page.tsx: authChecked 제거
- src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx: 동일
- src/app/(dashboard)/team/affiliate/page.tsx: 3회 호출 → 제거
- src/app/(dashboard)/payments/page.tsx: isAdmin 상태 제거
- 페이지 테스트 35개 추가
- 성능: 월 46,500회 쿼리 제거, 로딩 200-300ms 단축

Co-Authored-By: Delta <noreply@anthropic.com>
Co-Authored-By: Epsilon <noreply@anthropic.com>"

# Phase 4: 보안 검증 및 모니터링
git commit -m "test(security): P2 Step 5 - 보안 & 성능 검증 (24개 테스트)
- src/app/api/__tests__/p2-security.test.ts: 신규 (TRACK A-E)
  - TRACK A: RBAC 우회 방지 (10개)
  - TRACK B: PII 노출 방지 (5개)
  - TRACK C: 세션 무효화 (3개)
  - TRACK D: CSRF/Origin (2개)
  - TRACK E: 토큰 위조 (4개)
- src/lib/metrics/p2-monitoring.ts: 신규 (성능 메트릭)
- 성능 테스트: Lighthouse 90점 이상 (모든 페이지)

Co-Authored-By: Epsilon <noreply@anthropic.com>
Co-Authored-By: Gamma <noreply@anthropic.com>"

# Phase 5: 배포 및 롤백 계획
git commit -m "docs(deployment): P2 배포 계획 및 모니터링 설정
- docs/P2_DEPLOYMENT_PLAN.md: 배포 절차 (Blue-Green)
- docs/P2_ROLLBACK_PROCEDURE.md: 롤백 기준 및 절차
- docs/P2_MONITORING_DASHBOARD.md: 모니터링 대시보드 설정
- Vercel 환경 변수 6개 설정 완료
- 24시간 모니터링 체크리스트

Co-Authored-By: Epsilon <noreply@anthropic.com>"
```

---

## 최종 의사결정 포인트

**배포 진행 여부**:
- Gate 1-4 모두 PASS → 배포 승인
- Gate 5 (스테이징) FAIL → 문제 해결 후 재배포
- Gate 6 (프로덕션) FAIL → 즉시 롤백 + 원인 분석

**위험도 평가**: ✅ 낮음 (1개 커밋으로 롤백 가능)
**예상 일정**: 6시간 (병렬화 → 4시간)
**팀 준비도**: 100% (5명 에이전트 준비 완료)

---

*문서 작성: 2026-05-20*  
*버전: P2 Integration v1.0*  
*상태: 배포 준비 완료*
