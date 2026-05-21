# P2 에이전트 퀵스타트 가이드 (5-Agent Quick Start)

## 🎯 목표 (5분 안에 파악)

P2 최적화: `/api/auth/me` 호출 1,550회/일 제거 → 로딩 200-300ms 단축

---

## 📋 5명 역할 분담

### Agent α (Architecture)
**담당**: 미들웨어 아키텍처  
**작업**: Phase 1-1 (1시간)
```
Task 1: middleware.ts에 X-User-Role, X-Org-ID, X-Is-Admin 헤더 주입
Task 2: src/lib/middleware-auth.ts 신규 생성 (역할 검증 유틸)
Task 3: 단위 테스트 3개 작성 + PASS

Go/No-Go: 모든 테스트 PASS → Beta에게 인수
```

**파일 목록**:
- `src/middleware.ts` (수정)
- `src/lib/middleware-auth.ts` (신규)
- `src/app/api/__tests__/middleware.test.ts` (신규)

---

### Agent β (Performance)
**담당**: 경로 규칙 및 성능 최적화  
**작업**: Phase 1-2 (1시간)
```
Task 1: ROUTE_RULES 매트릭스 정의 (7개 경로)
  - /admin/* → GLOBAL_ADMIN only
  - /dashboard/team/* → OWNER+
  - /dashboard/* → AGENT+
  - /pnr/* → PUBLIC
  - /payments/* → OWNER+

Task 2: middleware.ts에 경로 검증 로직 추가
Task 3: 통합 테스트 7개 + PASS
Task 4: Phase 4-2 성능 검증 (Lighthouse, Core Web Vitals)

Go/No-Go: RBAC 테스트 4개 모두 PASS → Gamma에게 인수
```

**파일 목록**:
- `src/middleware.ts` (수정, Alpha 작업 기반)
- `src/lib/middleware-auth.ts` (수정, Alpha 작업 기반)

---

### Agent γ (UX)
**담당**: Layout 레벨 인증 및 사용자 경험  
**작업**: Phase 2 (1시간) + Phase 4-1 보안 테스트 일부
```
Task 1: src/app/(dashboard)/admin/layout.tsx 신규 생성
  ```typescript
  const ctx = await getMabizSession();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    redirect("/");
  }
  ```

Task 2: src/app/(dashboard)/team/layout.tsx 신규 생성 (OWNER 검증)
Task 3: Layout 테스트 8개 + PASS
Task 4: 24개 Jest 테스트 중 TRACK C (세션 무효화) 실행 감시

Go/No-Go: 모든 역할별 접근 제어 정상 → Delta에게 인수
```

**파일 목록**:
- `src/app/(dashboard)/admin/layout.tsx` (신규)
- `src/app/(dashboard)/team/layout.tsx` (신규)

---

### Agent δ (Security)
**담당**: 페이지 리팩토링 및 보안 검증  
**작업**: Phase 3 (1.5시간) + Phase 4-1 보안 테스트
```
Task 1: 5개 페이지에서 /api/auth/me 호출 제거
  Page 1: src/app/pnr/[reservationId]/page.tsx (45분)
    - useEffect 제거 (154줄)
    - isAdminMode 제거
    
  Page 2: src/app/(dashboard)/admin/partner-applications/page.tsx (20분)
    - useEffect 제거 (329-349줄)
    - authChecked 제거 (322줄)
    
  Page 3: src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx (15분)
    - 동일 처리
    
  Page 4: src/app/(dashboard)/team/affiliate/page.tsx (15분)
    - 3회 호출 제거
    
  Page 5: src/app/(dashboard)/payments/page.tsx (15분)
    - isAdmin 상태 제거

Task 2: 각 페이지별 테스트 5개 추가 (역할별 접근, 기능성)
Task 3: 24개 Jest 테스트 중 TRACK A-B (RBAC, PII) 주도

Go/No-Go: npm run build 성공, 모든 페이지 로드 가능 → Epsilon에게 인수
```

**파일 목록**:
- `src/app/pnr/[reservationId]/page.tsx` (수정)
- `src/app/(dashboard)/admin/partner-applications/page.tsx` (수정)
- `src/app/(dashboard)/admin/affiliate-sales-by-partner/page.tsx` (수정)
- `src/app/(dashboard)/team/affiliate/page.tsx` (수정)
- `src/app/(dashboard)/payments/page.tsx` (수정)

---

### Agent ε (Integration)
**담당**: 전체 통합, 테스트 오케스트레이션, 배포  
**작업**: Phase 4 (1시간) + Phase 5 (1시간)
```
Task 1: 24개 Jest 테스트 전체 실행 및 감시
  npm test -- src/app/api/__tests__/p2-security.test.ts
  목표: 모두 PASS + 커버리지 90%

Task 2: npm run build 확인
  조건: 빌드 성공, 에러 0

Task 3: 성능 벤치마크 (DevTools + Lighthouse)
  조건: LCP < 2.5s, CLS < 0.1, /api/auth/me 호출 0

Task 4: 스테이징 배포 (30분)
  Vercel 스테이징 환경 배포
  1시간 모니터링 (에러율, 응답 시간)
  Go/No-Go: 에러율 < 1% → 프로덕션 배포 승인

Task 5: 프로덕션 배포 (Blue-Green, 30분)
  트래픽 10% → 50% → 100%
  24시간 모니터링 준비

Go/No-Go: 모든 게이트 PASS → 배포 완료

Task 6: 24시간 모니터링
  Day 1: 즉시 모니터링 (1시간)
  Day 2-3: Daily check
```

**파일 목록**:
- `src/app/api/__tests__/p2-security.test.ts` (신규, Jest 테스트)

---

## 🔄 작업 순서 (Critical Path)

```
15:00-16:00 | Alpha: Phase 1-1 (middleware 헤더 주입)
            |
16:00-17:00 | Beta: Phase 1-2 (경로 규칙) || Gamma: Phase 2 (Layout)
            |                              Delta: Phase 3-1 (Pages 1-3)
            |
16:50-17:20 | Delta: Phase 3-2 (Pages 4-5)
            |
17:20-17:50 | Epsilon: Phase 4-1 (Jest 테스트)
            | Beta: Phase 4-2 (Lighthouse)
            |
17:50-18:50 | Epsilon: Phase 5 (배포 & 모니터링)
```

**병렬 가능**:
- Alpha (1-1)과 Gamma (2): 독립적 (헤더 주입 완료 후 Layout 생성)
- Beta (1-2)와 Delta (3-1): 직렬 (경로 규칙 완료 후 페이지 수정)
- Beta (1-2)와 Gamma (2): 병렬 가능 (Alpha 1-1 완료 후)

---

## ✅ Go/No-Go 체크리스트

### Gate 1: Alpha 완료 후
```
[ ] middleware.ts 헤더 주입 (X-User-Role, X-Org-ID, X-Is-Admin)
[ ] 단위 테스트 3개 모두 PASS
[ ] 타입 정의 완성 (AuthHeader)

→ YES: Beta & Gamma 시작
→ NO:  Alpha 수정 후 재테스트
```

### Gate 2: Beta 완료 후
```
[ ] ROUTE_RULES 매트릭스 완성 (7개 경로)
[ ] RBAC 통합 테스트 7개 모두 PASS
[ ] 역할별 리다이렉트 정상 (4가지)

→ YES: Delta 시작 (Phase 3)
→ NO:  Beta 규칙 재검토 후 재테스트
```

### Gate 3: Gamma 완료 후
```
[ ] admin/layout.tsx 생성 + GLOBAL_ADMIN 검증
[ ] team/layout.tsx 생성 + OWNER 검증
[ ] Layout 테스트 8개 모두 PASS

→ YES: Delta는 이미 시작 (병렬)
→ NO:  Gamma Layout 수정 후 재테스트
```

### Gate 4: Delta 완료 후
```
[ ] npm run build 성공
[ ] 모든 페이지 /api/auth/me 호출 0 (DevTools 확인)
[ ] 5개 페이지 모두 로드 가능
[ ] 페이지 테스트 35개 모두 PASS

→ YES: Epsilon Phase 4 시작
→ NO:  Delta 페이지 수정 후 재빌드
```

### Gate 5: Epsilon Phase 4 완료 후
```
[ ] Jest 테스트 24개 모두 PASS
[ ] 커버리지 >= 90% (RBAC 경로)
[ ] Lighthouse 점수 >= 90 (모든 페이지)
[ ] Core Web Vitals 개선 확인 (LCP < 2.5s)

→ YES: 스테이징 배포 (Phase 5)
→ NO:  테스트 실패 원인 분석, 코드 수정
```

### Gate 6: 스테이징 배포 후 (1시간 모니터링)
```
[ ] 에러율 < 1%
[ ] PII 노출 0건
[ ] API 응답 시간 개선
[ ] 사용자 피드백 부정적 0

→ YES: 프로덕션 배포
→ NO:  스테이징에서 문제 해결
```

### Gate 7: 프로덕션 배포 후 (24시간 모니터링)
```
Day 1:
[ ] 401/403 에러율 정상 범위
[ ] LCP 개선 유지 (200-300ms)
[ ] 사용자 피드백 없음

Day 2-3:
[ ] 메트릭 안정성 확인
[ ] 권한 검증 정상 작동

→ YES: 배포 완료
→ NO:  즉시 롤백 (git revert)
```

---

## 💻 주요 명령어

### Alpha

```bash
# 테스트 작성 및 실행
npm test -- src/app/api/__tests__/middleware.test.ts
npm test -- src/app/api/__tests__/middleware.test.ts --coverage

# TypeScript 컴파일 확인
npm run type-check
```

### Beta

```bash
# RBAC 테스트
npm test -- src/lib/middleware-auth.test.ts

# 경로 패턴 테스트 (정규식)
npm test -- src/middleware.test.ts --testNamePattern="RBAC|path"
```

### Gamma

```bash
# Layout 테스트
npm test -- src/app/__tests__/admin.layout.test.ts
npm test -- src/app/__tests__/team.layout.test.ts

# 통합 테스트 (권역별 접근)
npm test -- src/app/__tests__/rbac-integration.test.ts
```

### Delta

```bash
# 빌드 확인
npm run build

# 페이지 테스트
npm test -- src/app/pnr/__tests__/page.test.ts
npm test -- src/app/admin/__tests__/partner-applications.test.ts

# 전체 페이지 로드 확인
npm run dev
# 브라우저에서 각 페이지 접근 + DevTools Network 탭 확인
```

### Epsilon

```bash
# 보안 테스트 실행
npm test -- src/app/api/__tests__/p2-security.test.ts
npm test -- src/app/api/__tests__/p2-security.test.ts --coverage

# 전체 테스트
npm test

# 빌드 및 성능 검증
npm run build
npm run dev
# Lighthouse 실행 (DevTools → Lighthouse tab)

# 배포
npm run deploy:staging  # Vercel 스테이징
npm run deploy:prod     # Vercel 프로덕션 (Blue-Green)
```

---

## 🆘 문제 해결 (Troubleshooting)

### Alpha가 헤더 주입 완료 후 Beta가 타입 오류 발생
```
원인: AuthHeader 타입 정의 누락
해결:
1. src/lib/middleware-auth.ts에서 export type AuthHeader 정의
2. src/middleware.ts에서 import하여 사용
```

### Beta가 RBAC 테스트 실패
```
원인: 권한 계층 함수 오류 (GLOBAL_ADMIN > OWNER > AGENT)
해결:
1. isPathAllowedForRole() 함수 재검토
2. 권한 우선순위 정의: GLOBAL_ADMIN(100) > OWNER(50) > AGENT(20)
3. 각 경로별 최소 필요 권한 확인
```

### Delta가 npm run build 실패
```
원인: 페이지 컴포넌트 타입 오류
해결:
1. 삭제한 useState, useEffect 타입 확인
2. 남은 상태 변수들의 타입 안전성 검증
3. 각 페이지별 개별 빌드 테스트: npx tsc --noEmit src/app/pnr/[id]/page.tsx
```

### Epsilon이 Jest 테스트 실패
```
원인: Mock 설정 오류
해결:
1. jest.mock() 경로 확인
2. Mock 반환값이 실제 구조와 일치하는지 확인
3. 개별 테스트 실행: npm test -- --testNamePattern="A1"
```

### 프로덕션 배포 후 에러 발생
```
→ 즉시 롤백:
git revert [commit-hash]
npm run deploy:prod

→ 원인 분석:
Sentry 로그 확인 (에러 타입별)
사용자 피드백 수집 (Slack)
```

---

## 📞 긴급 연락

**Alpha (Architecture)**: 미들웨어 관련
**Beta (Performance)**: 경로/성능 관련
**Gamma (UX)**: Layout/UX 관련
**Delta (Security)**: 페이지/보안 관련
**Epsilon (Integration)**: 전체 통합/배포 관련

**전체 조율**: Epsilon (마스터)

---

## 🎓 참고 문서

- `P2_COMPREHENSIVE_INTEGRATION_ROADMAP.md` (전체 로드맵)
- `P2_PAGES_1_2_WORK_INSTRUCTIONS.md` (페이지 상세 지시서)
- `MIDDLEWARE_OPTIMIZATION_BLUEPRINT_P2.md` (미들웨어 설계)
- `P2_UX_VERIFICATION_CHECKLIST.md` (UX 검증)
- `P2_SECURITY_VALIDATION.md` (보안 검증)

---

*작성: 2026-05-20*  
*상태: 배포 준비 완료*
