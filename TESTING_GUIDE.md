# Track 4 테스트 구현 가이드

> **최종 진행 상태**: Jest API 테스트 5개 케이스 + Cypress E2E 테스트 5개 시나리오 + 수동 테스트 체크리스트 완성

## 1. 테스트 설정 현황

### 1.1 설치된 패키지
- Jest (29.7.0) — Unit 테스트
- Cypress (13.6.6) — E2E 테스트
- @testing-library/react — React 컴포넌트 테스트 유틸
- ts-jest — TypeScript 지원

### 1.2 설정 파일
- `jest.config.js` — Jest 설정
- `jest.setup.js` — Jest 초기화
- `cypress.config.ts` — Cypress 설정
- `cypress/support/e2e.ts` — E2E 테스트 헬퍼

## 2. Unit 테스트: Partner Dashboard B2C API

### 파일 위치
`src/app/api/partner/dashboard/b2c/__tests__/route.test.ts`

### 5가지 핵심 테스트 케이스

#### Test Case 1: 미인증 요청 → 403
```typescript
it('should return 403 when requirePartnerContext returns null', async () => {
  (passportAuth.requirePartnerContext as jest.Mock).mockResolvedValue(null);
  const res = await GET(req);
  expect(res.status).toBe(403);
  expect(data.error).toBe('인증이 필요합니다');
});
```

- **목표**: 미인증 사용자 차단
- **검증**: HTTP 403 Forbidden 응답
- **DB 영향**: 없음

#### Test Case 2: 권한 없음 → 조직 필터링
```typescript
it('should only return data for authorized organization', async () => {
  const mockCtx = {
    sessionUser: { role: 'affiliate', userId: 'user-1' },
    organizationId: 'org-1',
  };
  // affiliateSale.aggregate where절에 organizationId 필터 확인
  expect(aggregateCall.where.organizationId).toBe('org-1');
});
```

- **목표**: 조직별 데이터 격리
- **검증**: DB 쿼리에 organizationId 필터 포함
- **DB 영향**: 프로덕션 공유 DB, 테스트 후 롤백

#### Test Case 3: 자신의 데이터만 조회
```typescript
it('should return personal sales data only for non-admin users', async () => {
  const mockCtx = {
    sessionUser: { role: 'affiliate', userId: 'user-2' },
    organizationId: 'org-2',
  };
  const findManyCall = (prisma.affiliateSale.findMany as jest.Mock).mock.calls[0][0];
  expect(findManyCall.where.organizationId).toBe('org-2');
});
```

- **목표**: 각 사용자는 자신의 조직만 접근
- **검증**: prisma.affiliateSale.findMany()에 organizationId 필터 적용
- **DB 영향**: 읽기 전용, 롤백 필요 없음

#### Test Case 4: 월별 필터링
```typescript
it('should filter data by month parameter', async () => {
  const req = new Request('...?month=2026-05');
  // startDate: 2026-05-01, endDate: 2026-06-01
  expect(whereClause.gte.getFullYear()).toBe(2026);
  expect(whereClause.gte.getMonth()).toBe(4); // May (0-indexed)
});
```

- **목표**: 월 파라미터로 날짜 범위 필터링
- **검증**: startDate, endDate 계산 정확성
- **형식**: 월 파라미터는 `YYYY-MM` (예: 2026-05)

#### Test Case 5: 응답 필드 검증
```typescript
it('should return required fields in response', async () => {
  expect(data.data).toHaveProperty('totalSalesAmount');
  expect(data.data).toHaveProperty('salesCount');
  expect(data.data).toHaveProperty('passportPnr');
  expect(data.data.trends).toHaveProperty('totalSalesAmount');
});
```

- **목표**: 응답 스키마 일관성 보장
- **필드**:
  - `totalSalesAmount` (number) — 월간 총 매출액
  - `salesCount` (number) — 월간 총 거래 건수
  - `reservationCount` (number) — 예약 건수
  - `recentSales` (array) — 최근 10개 매출
  - `passportPnr` (array) — 진행 중인 여권/PNR
  - `passportSummary` (object) — 여권 상태별 카운트
  - `pnrSummary` (object) — PNR 상태별 카운트
  - `trends` (object) — MoM 증감률 (%)

### 실행 명령어
```bash
# 모든 테스트 실행
npm test

# 특정 테스트만 실행
npm test -- route.test.ts

# 감시 모드 (파일 변경 시 자동 재실행)
npm run test:watch

# 커버리지 리포트 생성
npm run test:coverage
```

## 3. E2E 테스트: Partner Dashboard 사용자 흐름

### 파일 위치
`cypress/e2e/partner-dashboard.cy.ts`

### 5가지 핵심 시나리오

#### Scenario 1: 대시보드 카드 표시
```typescript
it('should display dashboard cards with correct statistics', () => {
  cy.get('[data-testid="dashboard-header"]').should('be.visible')
  cy.get('[data-testid="total-sales-card"]').should('exist')
  cy.get('[data-testid="total-sales-amount"]').then(($el) => {
    const text = $el.text().replace(/[^0-9]/g, '')
    expect(parseInt(text)).to.be.a('number')
  })
});
```

- **사용자 행동**: 대시보드 페이지 방문
- **검증 항목**:
  - 총 매출액 숫자 형식 확인
  - 매출 건수 표시
  - 예약 건수 표시
  - 트렌드 화살표(↑/↓/→) 표시

#### Scenario 2: 상세 페이지 이동
```typescript
it('should navigate to detail page when clicking recent sales row', () => {
  cy.get('[data-testid="sales-row"]').first().click()
  cy.url().should('include', '/partner/dashboard/detail')
  cy.get('[data-testid="detail-header"]', { timeout: 5000 }).should('be.visible')
});
```

- **사용자 행동**: 최근 매출 행 클릭
- **검증 항목**:
  - URL 변경 확인
  - 상세 페이지 로드 완료
  - 여권/PNR 정보 표시

#### Scenario 3: 월별 필터링
```typescript
it('should filter data when month is selected', () => {
  cy.get('[data-testid="month-selector"]').click()
  cy.get('[data-testid="month-option-2026-04"]').click()
  cy.url().should('include', 'month=2026-04')
});
```

- **사용자 행동**: 월 선택 드롭다운에서 이전 월 선택
- **검증 항목**:
  - URL 파라미터 업데이트 (month=2026-04)
  - 페이지 데이터 새로고침 (1초 이내)
  - 통계 수치 변경

#### Scenario 4: 페이지 선택 및 라우팅
```typescript
it('should navigate to detail page with correct parameters', () => {
  cy.get('[data-testid="sales-row"]').first().then(($row) => {
    const saleId = $row.attr('data-sale-id')
    cy.wrap($row).click()
    cy.url().should('include', `/detail/${saleId}`)
  })
});
```

- **사용자 행동**: 매출 기록 선택 및 상세 조회
- **검증 항목**:
  - URL에 saleId 파라미터 포함
  - 상세 페이지 데이터 로드
  - 잘못된 ID 입력 시 에러 처리

#### Scenario 5: 뒤로가기 네비게이션
```typescript
it('should navigate back to dashboard when back button is clicked', () => {
  cy.get('[data-testid="sales-row"]').first().click()
  cy.url().should('include', '/partner/dashboard/detail')
  cy.get('[data-testid="back-button"]').click()
  cy.url().should('include', '/partner/dashboard')
});
```

- **사용자 행동**: 상세 페이지 → 뒤로가기 버튼 클릭
- **검증 항목**:
  - 대시보드로 정상 복귀
  - 월 필터 유지 (예: month=2026-05 파라미터 유지)
  - 스크롤 위치 유지 (선택사항)
  - 브라우저 뒤로가기도 작동

### 필수 data-testid 속성

다음 요소들에 `data-testid` 속성을 추가해야 Cypress 테스트가 작동합니다:

```html
<!-- 대시보드 -->
<div data-testid="dashboard-header">...</div>
<div data-testid="total-sales-card">...</div>
<span data-testid="total-sales-amount">1,000,000</span>
<span data-testid="sales-trend">+10%</span>

<!-- 최근 매출 테이블 -->
<table data-testid="recent-sales-table">
  <tr data-testid="sales-row" data-sale-id="sale-123">
    <td data-testid="product-name">크루즈</td>
    <td data-testid="sale-amount">100,000</td>
    <td data-testid="sale-date">2026-05-16</td>
  </tr>
</table>

<!-- 상세 페이지 -->
<div data-testid="detail-header">...</div>
<div data-testid="back-button">뒤로가기</div>

<!-- 월 선택 -->
<select data-testid="month-selector">
  <option data-testid="month-option-2026-05">2026년 5월</option>
  <option data-testid="month-option-2026-04">2026년 4월</option>
</select>

<!-- 로딩 및 에러 -->
<div data-testid="dashboard-loading">로딩 중...</div>
<div data-testid="error-message">오류가 발생했습니다</div>
<button data-testid="retry-button">재시도</button>
```

### 실행 명령어
```bash
# E2E 테스트 실행 (헤드리스 모드)
npx cypress run

# E2E 테스트 인터랙티브 모드 (브라우저 렌더링)
npx cypress open

# 특정 테스트 파일만 실행
npx cypress run --spec "cypress/e2e/partner-dashboard.cy.ts"

# 특정 브라우저로 실행
npx cypress run --browser chrome
npx cypress run --browser firefox
```

## 4. 수동 테스트 체크리스트

### 파일 위치
`MANUAL_TESTING_CHECKLIST.md`

### 주요 항목
1. **권한 검증** — 대리점A는 A의 데이터만 조회 가능
2. **월별 필터링** — 월 선택 시 정확한 날짜 범위 필터링
3. **성능** — 대시보드 2초, 필터링 1초 이내 로드
4. **에러 처리** — 네트워크 오류, 세션 만료, 데이터 없음 등
5. **데이터 검증** — 응답 필드가 모두 포함되고 형식 정확

## 5. 통합 테스트 흐름

### Step 1: Unit 테스트 (Jest)
```bash
npm test
```

**목표**:
- API 로직 검증 (인증, 권한, 필터링, 응답)
- 동기화 로직 검증 (여권+PNR → finalConfirmStatus)
- 트렌드 계산 검증

**기대값**: 모든 테스트 PASS

### Step 2: E2E 테스트 (Cypress)
```bash
npm run dev  # 터미널 1: 개발 서버 시작
npx cypress open  # 터미널 2: Cypress 인터랙티브 모드
```

**목표**:
- 사용자 UI 흐름 검증
- 라우팅 검증
- 데이터 표시 검증
- 에러 상황 처리 검증

**기대값**: 모든 시나리오 통과

### Step 3: 수동 테스트
테스트 환경에서:
- 대리점 로그인 → 자신의 매출 확인 ✓
- 관리자 로그인 → 전체 매출 확인 ✓
- 월별 필터링 → 데이터 업데이트 확인 ✓
- 성능 모니터링 → 로드 시간 확인 ✓

## 6. 테스트 데이터 준비 (프로덕션 공유 DB)

### 테스트 계정
```
대리점A (org-1):
  - Email: affiliate-a@example.com
  - Password: test123

대리점B (org-2):
  - Email: affiliate-b@example.com
  - Password: test123

관리자 (admin):
  - Email: admin@example.com
  - Password: admin123
```

### 테스트 매출 데이터
```sql
-- 대리점A 5월 매출 5건
INSERT INTO "CrmAffiliateSale" (
  "organizationId", "affiliateUserId", "orderId", "productName", 
  "saleAmount", "commissionAmount", "commissionRate", "status", "createdAt"
) VALUES
('org-1', 'user-a-1', 'order-001', '크루즈패키지', 100000, 10000, 0.1, 'CONFIRMED', '2026-05-16');

-- 대리점B 5월 매출 3건
INSERT INTO "CrmAffiliateSale" (...)
VALUES ('org-2', 'user-b-1', 'order-002', '투어패키지', 50000, 4000, 0.08, 'CONFIRMED', '2026-05-16');
```

## 7. CI/CD 통합

### GitHub Actions (예시)
```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm ci
      - run: npm test -- --coverage
      - run: npm run build
      - run: npx cypress run
```

### 수동 실행 (아직 CI/CD 미설정)
```bash
# 모든 테스트 실행
npm test && npx cypress run
```

## 8. 커밋 전 체크리스트

- [ ] `npm test` 모두 PASS
- [ ] `npx cypress run` 모두 PASS
- [ ] 수동 테스트 체크리스트 완료
- [ ] 콘솔 에러 없음
- [ ] 코드 커버리지 > 80%
- [ ] 성능 메트릭 확인 (LCP < 2.5s)

## 9. 트러블슈팅

### Jest 에러: "Cannot find module '@/lib/prisma'"
```bash
# jest.config.js의 moduleNameMapper 확인
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

### Cypress 에러: "Cannot find element [data-testid]"
- 페이지의 HTML에 `data-testid` 속성이 있는지 확인
- Cypress UI에서 스크린샷 확인

### 테스트 타임아웃
```bash
# Cypress 타임아웃 증가 (cypress.config.ts)
defaultCommandTimeout: 10000,
requestTimeout: 10000,
```

### DB 권한 오류
- 테스트 계정이 올바른 organizationId를 가졌는지 확인
- RLS 정책이 설정되지 않았는지 확인

## 10. 다음 단계

### Phase 2 (선택사항)
- [ ] API 통합 테스트 추가 (real DB)
- [ ] Performance 테스트 (Lighthouse)
- [ ] Security 테스트 (OWASP Top 10)
- [ ] Load 테스트 (동시 사용자 1000+)

### Phase 3 (배포)
- [ ] Staging 환경에서 E2E 테스트
- [ ] Production 환경 감시 설정
- [ ] 배포 후 Smoke 테스트

---

**최종 작성일**: 2026-05-16  
**테스트 담당자**: 모니카  
**상태**: 구현 완료, 실행 대기
