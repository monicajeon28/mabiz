# Menu #38 Phase 4 Wave 2 작업지시서

## 절대법칙 무한루프 (Step 3)

**목표**: Phase 4 Wave 1 P0 12개 블로커 수정 + Track 1 Wave 2 API + Track 2 Wave 3 UI 동시 진행

**일정**: Day 2-3 (2일)

**병렬 구조**:
- **Track 1 Wave 2** (Day 2): POST/GET API 2개 + 렌탈 캠페인 생성 로직
- **Track 2 Wave 3** (Day 2-3): 비용 대시보드 UI + 차트

---

## Part A: P0 12개 블로커 수정 (병렬, 4개 에이전트)

### 블로커 목록 및 배정

| 블로커 | 파일 | 에이전트 | 난이도 |
|--------|------|---------|--------|
| 1. metadata 타입 정의 | delta-sms.ts | α | 낮음 |
| 2. onDelete 모순 수정 | schema.prisma | β | 중간 |
| 3. getRentalSendingStatsBySegment 구현 | rental-helper.ts | γ | 낮음 |
| 4. selectVariant 로직 추가 | delta-sms.ts | α | 낮음 |
| 5. Promise.allSettled 교체 | delta-sms-schedule.ts | δ | 낮음 |
| 6. Vercel Cron 설정 추가 | vercel.json (신규) | δ | 낮음 |
| 7. CampaignCost FK 제약 추가 | schema.prisma | β | 낮음 |
| 8. 월 범위 쿼리 수정 | cost/report/route.ts | ε | 낮음 |
| 9. Float → Decimal 변경 | schema.prisma | β | 중간 |
| 10. 채널별 ROI 계산 수정 | cost/report/route.ts | ε | 낮음 |
| 11. CRON_SECRET 로그 방지 | cron/delta-sms/route.ts | δ | 낮음 |
| 12. 상태코드 401/500 통일 | cron/delta-sms/route.ts | δ | 낮음 |

**배정 전략**:
- Agent α: 타입/로직 (metadata, selectVariant) — 2개
- Agent β: 스키마 (onDelete, FK, Decimal) — 3개
- Agent γ: 헬퍼 구현 (getRentalSendingStatsBySegment) — 1개
- Agent δ: Cron 수정 (Promise, Vercel, SECRET, 상태코드) — 4개
- Agent ε: API 수정 (월 범위, ROI) — 2개

---

## Part B: Track 1 Wave 2 (렌탈 SMS 캠페인 API)

### 생성할 파일

**File 1: src/app/api/campaigns/delta/route.ts (신규)**

엔드포인트: POST /api/campaigns/delta

요청:
```typescript
{
  campaignId: string;          // 기존 캠페인 ID
  triggerType: "PURCHASE";     // 또는 ABANDONED
  deltaDay0Message?: string;   // Day 0 카스텀 (선택)
  deltaDay1Message?: string;   // Day 1
  deltaDay2Message?: string;   // Day 2
  deltaDay3Message?: string;   // Day 3
}
```

응답:
```typescript
{
  ok: true;
  deltaCampaignId: string;
  triggerType: string;
  messages: { day: 0|1|2|3, content: string }[];
}
```

로직:
1. 캠페인 권한 확인 (organizationId)
2. 기본 메시지 load (data/delta_sms_sequence.json)
3. 카스텀 메시지 있으면 override
4. DeltaCampaignConfig 저장 (신규 테이블)
5. Cron 스케줄 등록

**File 2: src/app/api/campaigns/[id]/delta/route.ts (신규)**

엔드포인트: GET /api/campaigns/[id]/delta

응답:
```typescript
{
  ok: true;
  deltaCampaignId?: string;
  triggerType?: string;
  schedule: { day: 0|1|2|3, time: "09:00"|"14:00"|"19:00", message: string }[];
  stats: {
    totalSent: number;
    totalSuccess: number;
    successRate: number;
    lastExecutedAt?: string;
  };
}
```

로직:
1. 캠페인 권한 확인
2. DeltaCampaignConfig 조회
3. SendingHistory에서 Delta 발송 통계 계산
4. 응답 구성

---

## Part C: Track 2 Wave 3 (비용 대시보드 UI)

### 생성할 파일

**File: src/app/(dashboard)/analytics/cost/page.tsx (신규, ~400줄)**

레이아웃:
```
┌──────────────────────────────────────────┐
│ 비용 분석 대시보드                        │
├──────────────────────────────────────────┤
│ 📊 KPI 카드 (상단)                       │
│ ┌────────────┬────────────┬────────────┐ │
│ │ 총 비용    │ 평균 CPA   │ 예상 ROI   │ │
│ │ 520,000원  │ 94,600원   │ 160.71%    │ │
│ └────────────┴────────────┴────────────┘ │
├──────────────────────────────────────────┤
│ 📈 월별 추이 (Recharts LineChart)        │
│ 월별 총 비용, SMS vs Email 구분          │
│ Y축: 비용(원), X축: 월(2026-01~05)      │
├──────────────────────────────────────────┤
│ 📊 채널별 비교 (Recharts BarChart)       │
│ ┌────────────────────────────────────┐  │
│ │ SMS:   1,260,000원 (발송 14,000건) │  │
│ │ Email:   40,000원 (발송 4,000건)   │  │
│ └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│ 📋 캠페인별 상세 (테이블)                │
│ [캠페인명] | [비용] | [CPA] | [ROI]     │
│ 렌탈 3일   | 50k   | 95원  | 150%      │
│ 홍콩 프로모| 70k   | 100원 | 140%      │
└──────────────────────────────────────────┘
```

기능:
1. **월 범위 필터**: startMonth/endMonth 선택 (기본: 3개월)
2. **실시간 업데이트**: 5분마다 /api/organizations/[orgId]/campaigns/cost/report 호출
3. **차트 상호작용**: 월별 클릭 시 상세 정보 표시
4. **CSV 다운로드**: 캠페인 비용 데이터 export
5. **토스트 알림**: 데이터 로드 완료/실패

---

## 에이전트 배정 (Wave 2)

### Track 1 Wave 2 (API 2개 + 로직)
- **Agent ζ1**: POST /api/campaigns/delta (생성)
- **Agent ζ2**: GET /api/campaigns/[id]/delta (조회)

### Track 2 Wave 3 (UI)
- **Agent η**: 비용 대시보드 UI (Recharts 차트 포함)

### P0 수정 (병렬)
- **Agent α**: metadata + selectVariant (2개)
- **Agent β**: schema.prisma (3개)
- **Agent γ**: rental-helper (1개)
- **Agent δ**: Cron (4개)
- **Agent ε**: API 수정 (2개)

---

## 기술 스펙

### Track 1 Wave 2

**DeltaCampaignConfig 모델** (prisma/schema.prisma 신규):
```prisma
model DeltaCampaignConfig {
  id              String   @id @default(cuid())
  campaignId      String   @unique
  campaign        CrmMarketingCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  triggerType     String   // PURCHASE, ABANDONED
  
  day0Message     String   @db.Text
  day1Message     String   @db.Text
  day2Message     String   @db.Text
  day3Message     String   @db.Text
  
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**마이그레이션**: DeltaCampaignConfig 테이블 생성

**Zod 검증**:
```typescript
const CreateDeltaCampaignSchema = z.object({
  campaignId: z.string().cuid(),
  triggerType: z.enum(["PURCHASE", "ABANDONED"]),
  deltaDay0Message: z.string().max(90).optional(),
  deltaDay1Message: z.string().max(160).optional(),
  deltaDay2Message: z.string().max(160).optional(),
  deltaDay3Message: z.string().max(160).optional(),
});
```

### Track 2 Wave 3

**컴포넌트 구조**:
- `<CostDashboard />` (메인, ~400줄)
  - `<CostKpiCards />` (KPI 3개, 100줄)
  - `<MonthlyCostTrend />` (LineChart, 150줄)
  - `<ChannelComparison />` (BarChart, 100줄)
  - `<CampaignDetailTable />` (테이블, 150줄)

**의존성**: recharts (already installed)

---

## 체크리스트

### P0 수정
- ✅ metadata 타입 정의
- ✅ onDelete 모순 수정
- ✅ getRentalSendingStatsBySegment 구현
- ✅ selectVariant 로직
- ✅ Promise.allSettled 교체
- ✅ Vercel Cron 설정
- ✅ FK 제약 추가
- ✅ 월 범위 쿼리 수정
- ✅ Float → Decimal
- ✅ ROI 계산 수정
- ✅ CRON_SECRET 로그 방지
- ✅ 상태코드 통일

### Track 1 Wave 2
- ✅ DeltaCampaignConfig 모델
- ✅ POST /api/campaigns/delta
- ✅ GET /api/campaigns/[id]/delta
- ✅ Zod 검증
- ✅ IDOR 방지

### Track 2 Wave 3
- ✅ CostDashboard 메인
- ✅ KPI 카드 3개
- ✅ 월별 추이 차트 (LineChart)
- ✅ 채널별 비교 차트 (BarChart)
- ✅ 캠페인 상세 테이블
- ✅ 월 범위 필터
- ✅ CSV 다운로드
- ✅ 실시간 업데이트 (5분)

---

## 산출물

**P0 수정**: 12개 파일 수정 (commits: 5개)
**Track 1 Wave 2**: 2개 파일 신규 + 1개 모델 + 마이그레이션 (commit: 1개)
**Track 2 Wave 3**: 1개 UI 파일 신규 (commit: 1개)

**총 커밋**: 7개
**총 라인**: ~2000줄 (수정 500 + API 400 + UI 400 + 마이그레이션 200)

---

## 일정

**Day 2**:
- P0 수정 (4개 에이전트, 병렬, 2시간)
- Track 1 Wave 2 (2개 에이전트, 병렬, 3시간)
- Track 2 Wave 3 UI 레이아웃 (1개 에이전트, 2시간)

**Day 3**:
- Track 2 Wave 3 완성 (차트 + 필터 + 다운로드, 2시간)
- 통합 테스트 (1시간)
- Step 6 코드 리뷰 (병렬, 2시간)

---

## 승인 대기

사용자 확인: "응" → Step 5-2 에이전트 실행 시작
