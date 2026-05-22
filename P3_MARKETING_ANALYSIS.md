# Menu #25-26 마케팅 자동화/대시보드 P3 이슈 분석

**분석일**: 2026-05-22  
**범위**: 3개 페이지 (page.tsx, sales/page.tsx, campaigns/page.tsx)  
**10렌즈 P3 분류**

---

## Page 1: marketing/page.tsx (293줄)

### 현재 컴포넌트 구조
```
MarketingDashboardPage (293줄)
├─ KpiCard (30줄, memo 적용됨)
└─ SkeletonCard (2줄)
```

### P3 이슈 (7개)

| # | 렌즈 | 문제 | 개선 방안 | 복잡도 |
|---|------|------|---------|--------|
| P3-1 | Maintainability | KpiCard와 SkeletonCard 컴포넌트 분리 필요 | src/components/marketing/KpiCard.tsx 신규 | 중 |
| P3-2 | Maintainability | 트렌드 차트 로직이 page.tsx에 포함됨 | src/components/marketing/TrendChart.tsx 신규 | 중 |
| P3-3 | Maintainability | 퍼널 차트 로직이 page.tsx에 포함됨 | src/components/marketing/FunnelChart.tsx 신규 | 중 |
| P3-4 | Scalability | TOP 5 테이블 컴포넌트 분리 필요 | src/components/marketing/TopPagesTable.tsx 신규 | 중 |
| P3-5 | Testing | KpiCard에 대한 단위 테스트 없음 | src/components/marketing/__tests__/KpiCard.test.tsx | 하 |
| P3-6 | Compatibility | TypeScript any 타입 없음 | 이미 완료 (type 정의됨) | - |
| P3-7 | Business | Dashboard 데이터 새로고침 주기 설정 없음 | 수동 새로고침만 가능 | 하 |

---

## Page 2: marketing/sales/page.tsx (390줄)

### 현재 컴포넌트 구조
```
MarketingSalesPage (390줄)
├─ BarChart (30줄)
├─ KpiCard (20줄)
├─ SkeletonRow (10줄)
├─ StatusBadge (20줄)
├─ RecentPaymentTable (50줄)
└─ RecentPaymentCard (30줄)
```

### P3 이슈 (4개)

| # | 렌즈 | 문제 | 개선 방안 | 복잡도 |
|---|------|------|---------|--------|
| P3-8 | Maintainability | SkeletonRow 컴포넌트 분리 필요 | src/components/marketing/SkeletonRow.tsx 신규 | 하 |
| P3-9 | Maintainability | StatusBadge 컴포넌트 분리 필요 | src/components/marketing/StatusBadge.tsx 신규 | 하 |
| P3-10 | Maintainability | BarChart 컴포넌트 분리 필요 | src/components/marketing/SalesBarChart.tsx 신규 | 중 |
| P3-11 | Testing | maskPhone 함수에 단위 테스트 필요 | src/lib/__tests__/marketing-utils.test.ts | 중 |

---

## Page 3: marketing/campaigns/page.tsx (188줄)

### 현재 컴포넌트 구조
```
MarketingCampaignsPage (188줄)
├─ STATUS_BADGE_STYLES (상수)
└─ handleDelete (함수)
```

### P3 이슈 (2개)

| # | 렌즈 | 문제 | 개선 방안 | 복잡도 |
|---|------|------|---------|--------|
| P3-12 | Maintainability | 캠페인 테이블 행 컴포넌트 분리 필요 | src/components/marketing/CampaignRow.tsx 신규 | 하 |
| P3-13 | Error Handling | CSRF 토큰 fetch 실패 시 silent fail | 에러 토스트 또는 폴백 처리 | 하 |

---

## P3 우선순위 정렬

### 높음 (직접적 가독성 개선)
1. P3-1: KpiCard 분리 (재사용 예정)
2. P3-2: TrendChart 분리
3. P3-3: FunnelChart 분리
4. P3-4: TopPagesTable 분리

### 중간 (테스트/검증)
5. P3-10: SalesBarChart 분리
6. P3-11: maskPhone 테스트

### 낮음 (보조)
7. P3-8: SkeletonRow 분리
8. P3-9: StatusBadge 분리
9. P3-12: CampaignRow 분리
10. P3-13: CSRF 토큰 에러 처리
11. P3-5: KpiCard 테스트 (P3-1 후)
12. P3-6: 타입 검증 (완료)
13. P3-7: 자동 새로고침 (비즈니스 요구사항 필요)

---

## 구현 계획

### Wave 1: 대시보드 컴포넌트 분리 (4개)
- P3-1: KpiCard.tsx
- P3-2: TrendChart.tsx
- P3-3: FunnelChart.tsx
- P3-4: TopPagesTable.tsx

### Wave 2: 매출 컴포넌트 분리 + 테스트 (4개)
- P3-8: SkeletonRow.tsx
- P3-9: StatusBadge.tsx
- P3-10: SalesBarChart.tsx
- P3-11: marketing-utils.test.ts

### Wave 3: 캠페인 개선 (2개)
- P3-12: CampaignRow.tsx
- P3-13: CSRF 에러 처리

### Wave 4: 테스트 추가 (2개)
- P3-5: KpiCard.test.tsx
- P3-7: 자동 새로고침 (비즈니스 의사결정 필요)

---

## 신규 파일 생성 목록

```
src/components/marketing/
├─ KpiCard.tsx (30줄)
├─ SkeletonCard.tsx (5줄)
├─ TrendChart.tsx (40줄)
├─ FunnelChart.tsx (45줄)
├─ TopPagesTable.tsx (50줄)
├─ SalesBarChart.tsx (35줄)
├─ SkeletonRow.tsx (15줄)
├─ StatusBadge.tsx (25줄)
├─ CampaignRow.tsx (35줄)
└─ __tests__/
    ├─ KpiCard.test.tsx (80줄)
    └─ SalesBarChart.test.tsx (60줄)

src/lib/__tests__/
└─ marketing-utils.test.ts (100줄)
```

---

## 예상 효과

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| 최대 파일 크기 | 390줄 (sales) | 200줄 이하 |
| 컴포넌트 재사용성 | 낮음 | 중상 |
| 테스트 커버리지 | 0% | 60%+ |
| 유지보수 용이성 | 중간 | 높음 |

---

## 다음 단계

1. **Step 3 (Phase 6)**: 이 분석에 대한 사용자 승인
2. **Step 4 (Phase 3-4)**: Wave 1-4 구현
3. **Step 5 (Phase 5-6)**: 코드 리뷰 + 최종 검증
