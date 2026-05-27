# Real-Time Channel Optimization System (PHASE 7-2/4)

**마비즈 CRM 실시간 채널 최적화 시스템**

- **작성일**: 2026-05-27
- **버전**: 1.0
- **상태**: 구현 완료
- **기대 효과**: ROI +15-25%, CPA -10-20%, 자동화율 +80%

---

## 📋 목차

1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [핵심 컴포넌트](#핵심-컴포넌트)
4. [의사결정 로직](#의사결정-로직)
5. [API 명세](#api-명세)
6. [사용 예시](#사용-예시)
7. [성과 추적](#성과-추적)
8. [운영 가이드](#운영-가이드)

---

## 개요

### 목표

기존 정적 채널 규칙을 **동적 실시간 최적화**로 전환:

```
Before: "SMS 40% + Kakao 35% + Email 25%" (고정)
        ↓
After:  "매 30분마다 실제 성과 데이터로 재계산"
        SMS: 35% → 45% (개방율 32% > 30%)
        Kakao: 35% → 38% (ROI 2.1 우수)
        Email: 25% → 20% (ROI 1.8 낮음)
```

### 핵심 기능

| 기능 | 설명 | 기대 효과 |
|------|------|---------|
| **실시간 채널 최적화** | 30분마다 ROI 기반 재배분 | ROI +15% |
| **Thompson Sampling** | Bayesian 다중 선택 알고리즘 | 신뢰도 자동 학습 |
| **예산 자동 배분** | 주간 예산 재배분 (제약: 10-60%) | 효율 +20% |
| **최적 송시시간** | 시간대/요일/채널별 학습 | 개방율 +20-35% |
| **오퍼 최적화** | 각 고객에 최적 할인율 추천 | 수용율 +15-30% |

---

## 아키텍처

### 시스템 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│              Real-Time Channel Optimization                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ 캠페인 성과 데이터 (지난 30분)                            │
│  │  └─ SMS/Kakao/Email 전송, 개방, 클릭, 전환                │
│  │                                                            │
│  ├─ RealtimeChannelOptimizer (350줄)                        │
│  │  ├─ getRecentMetrics(): 30분 데이터 수집                 │
│  │  ├─ getOptimalChannelMix(): 최적 채널 조합 계산          │
│  │  └─ applyAllocationToCampaign(): 캠페인 적용             │
│  │                                                            │
│  ├─ ThompsonSamplingBandit (300줄)                         │
│  │  ├─ selectArm(): 최적 채널 선택 (Bayesian)              │
│  │  ├─ updateReward(): 성과 피드백 반영                     │
│  │  └─ getConfidence(): 신뢰도 점수 (0-100)                │
│  │                                                            │
│  ├─ BudgetAllocator (300줄)                                │
│  │  ├─ allocateBudget(): 월간 예산 배분                    │
│  │  ├─ rebalanceBasedOnLastWeek(): 주간 재배분            │
│  │  └─ suggestAllocationShift(): 예산 이동 제안             │
│  │                                                            │
│  ├─ OptimalSendTimeOptimizer (250줄)                       │
│  │  ├─ findBestSendTime(): 최적 시간 찾기                  │
│  │  ├─ findBestSendTimeByDayOfWeek(): 요일별 최적 시간     │
│  │  └─ findBestSendTimeForSegment(): 세그먼트 집계         │
│  │                                                            │
│  ├─ OfferOptimizer (250줄)                                 │
│  │  ├─ predictBestOffer(): 최적 오퍼 예측                  │
│  │  ├─ findBestOfferAmongCandidates(): A/B 테스트         │
│  │  └─ recordOfferTest(): 성과 기록                         │
│  │                                                            │
│  └─ Cron Job (200줄)                                        │
│     └─ POST /api/cron/realtime-optimization                │
│        30분마다 실행 (모든 조직 최적화)                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

```
┌─────────────────────┐
│  CampaignRecipient  │
│  (SMS/Kakao/Email)  │
│  - sentAt           │
│  - openedAt         │
│  - clickedAt        │
│  - convertedAt      │
│  - cost             │
└──────────┬──────────┘
           │
           ├─────────────────────┬──────────────────┬────────────────────┐
           │                     │                  │                    │
           ↓                     ↓                  ↓                    ↓
     ┌──────────┐         ┌──────────┐      ┌──────────┐         ┌──────────┐
     │   SMS    │         │  Kakao   │      │  Email   │         │ Segment  │
     │ Metrics  │         │ Metrics  │      │ Metrics  │         │ Profile  │
     └────┬─────┘         └────┬─────┘      └────┬─────┘         └────┬─────┘
          │                    │                  │                    │
          └────────────────────┼──────────────────┼────────────────────┘
                               │
                               ↓
                    ┌─────────────────────┐
                    │ Channel Optimizer   │
                    │  (30분마다)         │
                    │                     │
                    │ 계산 결과:          │
                    │ SMS: 35% → 45%      │
                    │ Kakao: 38%          │
                    │ Email: 17%          │
                    └────────┬────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ↓                 ↓
            ┌────────────────┐  ┌─────────────┐
            │ 활성 캠페인    │  │ 대시보드    │
            │ 재배분 적용    │  │ 시각화      │
            └────────────────┘  └─────────────┘
```

---

## 핵심 컴포넌트

### 1. RealtimeChannelOptimizer (350줄)

**역할**: 실시간 ROI 기반 채널 최적화

```typescript
const optimizer = new RealtimeChannelOptimizer('org-123');

// 최근 30분 메트릭 조회
const metrics = await optimizer.getRecentMetrics();
// [{
//   channel: 'SMS',
//   sent: 1250,
//   opened: 400,
//   clicked: 80,
//   converted: 20,
//   cost: 12500,
//   roi: 1.5,
//   openRate: 32.0,
//   ...
// }, ...]

// 최적 채널 조합 계산
const channelMix = await optimizer.getOptimalChannelMix();
// {
//   timestamp: Date,
//   allocation: { SMS: 45, KAKAO: 38, EMAIL: 17 },
//   confidence: 0.78,
//   metrics: [...],
//   recommendations: [
//     "SMS 개방율 32% > 30% → SMS +50%",
//     "Kakao ROI 2.1 > Email → Kakao 선호"
//   ],
//   nextUpdateAt: Date
// }
```

**의사결정 규칙**:

| Rule | 조건 | 결과 |
|------|------|------|
| Rule 1 | SMS 개방율 > 30% | SMS 할당 +50% (최대 60%) |
| Rule 2 | Kakao ROI > Email ROI | 예산 Kakao로 이동 (최대 15%) |
| Rule 3 | Email 전환율 > SMS | Email을 확인 메시지에 사용 |
| Rule 4 | 채널 실패율 > 5% | 해당 채널 할당 -20% |

**제약조건**:

```
최소 할당: 10% (채널 다양성 유지)
최대 할당: 60% (과도한 의존도 방지)
업데이트: 30분마다
신뢰도: 샘플 수 기반 (MIN_SAMPLES=10)
```

---

### 2. Thompson Sampling Bandit (300줄)

**역할**: Bayesian 다중 선택 최적화 (자동 A/B 테스트)

#### 원리

```
베타 분포로 각 arm의 성공 확률을 모델링:

P(arm | data) ∝ Beta(successes + α, failures + β)

예: SMS (456 성공, 244 실패)
    Beta(456+1, 244+1) → 65% 성공률

매 선택마다:
1. 각 arm에서 Beta 분포 샘플링
2. 가장 높은 샘플 선택 (exploitation)
3. 20% 확률로 랜덤 선택 (exploration)
4. 결과 피드백 → Beta 업데이트
```

#### 사용 예시

```typescript
const bandit = new ThompsonSamplingBandit('contact-123');

// 최적 채널 선택
const channel = await bandit.selectArm();
// 'SMS' | 'KAKAO' | 'EMAIL'

// 성과 피드백 (메시지 클릭/전환 감지)
await bandit.updateReward('SMS', true); // 성공

// 현재 상태 조회
const state = bandit.getState();
// {
//   arms: {
//     SMS: { successes: 456, failures: 244, successRate: 0.652 },
//     ...
//   },
//   explorationRate: 0.2
// }

// 신뢰도 (0-100)
const confidence = bandit.getConfidence(); // 78%
```

#### 장점

- **자동 학습**: 데이터 수집만으로 최적화
- **수렴 보장**: Bayesian 이론으로 증명
- **탐색/활용 균형**: 20% 탐색으로 새로운 패턴 발견
- **개별화**: 연락처/세그먼트별 독립 학습

---

### 3. BudgetAllocator (300줄)

**역할**: 월간 예산 최적 배분 + 주간 재배분

#### 배분 전략

```
1. 과거 3개월 ROI 점수 계산 (0-100)
   - CPA 낮을수록 높음
   - 전환율 높을수록 높음

2. ROI 점수로 가중치 계산
   예: SMS 50, Kakao 52, Email 45
   가중치: 36%, 37%, 27%

3. A/B 테스트 5% 예약

4. 나머지 95%를 가중치대로 배분
   예: 월 $10,000 예산
   - SMS: $3,420 (34%)
   - Kakao: $3,515 (35%)
   - Email: $2,565 (26%)
   - A/B: $500 (5%)

5. 제약 조건 적용
   최소: 10%, 최대: 60%
```

#### 사용 예시

```typescript
const allocator = new BudgetAllocator('org-123', 10000); // $10K 월 예산

// 예산 배분
const allocation = await allocator.allocateBudget();
// {
//   totalBudget: 10000,
//   allocations: [
//     {
//       channel: 'SMS',
//       amount: 3500,
//       percentage: 35,
//       expectedReach: 350000,
//       expectedCPA: 10
//     },
//     ...
//   ],
//   abTestBudget: 500,
//   recommendations: [
//     "Kakao가 가장 높은 ROI (52%)",
//     "예상 월 수익: $250K"
//   ],
//   nextReviewDate: Date
// }

// 예산 이동 제안
const shift = await allocator.suggestAllocationShift('SMS', 'KAKAO', 500);
// {
//   proposedAllocation: [...],
//   estimatedImpact: {
//     revenueIncrease: 1500,
//     cpaSavings: 750
//   }
// }
```

#### 매월 검토 체크리스트

- [ ] 각 채널 ROI 점수 재계산
- [ ] 예산 배분 업데이트
- [ ] 새로운 최소/최대 제약 적용 (필요시)
- [ ] A/B 테스트 결과 반영
- [ ] 다음 달 예산 승인

---

### 4. OptimalSendTimeOptimizer (250줄)

**역할**: 채널/고객/세그먼트별 최적 송시시간 학습

#### 학습 대상

1. **개별 연락처** (contact-level)
   - "홍길동은 매일 오전 9시에 SMS를 열어본다"
   - 6개월 데이터 기반

2. **세그먼트** (segment-level)
   - "20-30대 직장인은 점심 12시 개방율이 최고"
   - 세그먼트 평균

3. **채널별** (channel-specific)
   - SMS: 아침 9시 (개방율 32%)
   - Kakao: 점심 12시 (개방율 38%)
   - Email: 오전 8시 (개방율 25%)

#### 사용 예시

```typescript
const optimizer = new OptimalSendTimeOptimizer('contact-123');

// 연락처 최적 시간
const bestTime = await optimizer.findBestSendTime('SMS');
// {
//   hour: 9,
//   confidence: 0.85,
//   openRate: 32.1,
//   clickRate: 6.5,
//   reasoning: "과거 30개 샘플에서 오전 9시 개방율 최고"
// }

// 요일별 최적 시간
const tuesdayBest = await optimizer.findBestSendTimeByDayOfWeek('SMS', 2);
// {
//   hour: 10,
//   dayOfWeek: 2,
//   openRate: 35.2,
//   reasoning: "화요일은 오전 10시 개방율 35%"
// }

// 세그먼트 집계
const segmentTime = await OptimalSendTimeOptimizer
  .findBestSendTimeForSegment('segment-123', 'KAKAO');
// { hour: 12, confidence: 0.7, ... }
```

#### 최적 시간 활용

```
캠페인 생성 시:
1. 세그먼트/연락처 선택
2. 채널 선택
3. 자동으로 최적 시간 제안
   "카카오로 홍길동에게 보낼 시: 12시 (개방율 38%)"
4. 승인 → 자동 스케줄

매월 재학습:
- 최근 6개월 데이터 다시 분석
- 계절 추이 반영 (5월 vs 12월 다름)
- 신뢰도 점수 업데이트
```

---

### 5. OfferOptimizer (250줄)

**역할**: 개인화 오퍼 최적화 (L1 렌즈 기반)

#### 오퍼 옵션

| 타입 | 내용 | 평균 수용율 |
|------|------|----------|
| discount_5 | 5% 할인 | 60% |
| discount_10 | 10% 할인 | 65% |
| discount_15 | 15% 할인 | 75% |
| discount_20 | 20% 할인 | 85% |
| free_shipping | 배송비 무료 | 70% |
| trial_extension | 체험 연장 | 60% |
| bundle_offer | Buy 1 Get 1 | 80% |
| bonus_points | 포인트 보너스 | 75% |

#### 의사결정 규칙

```
Rule 1: L1 렌즈 (가격 민감도)
└─ 높음 (>70): 할인 선호 → 15-20% 할인
└─ 중간: 10% 할인 또는 배송비 무료
└─ 낮음 (<30): 편의성 오퍼 (배송비 무료)

Rule 2: LTV (고객 생명주기 가치)
└─ VIP (>$2K): 번들 오퍼 또는 포인트 보너스
└─ 상위 (>$500): 10% 할인
└─ 신규 (<$100): 5% 할인

Rule 3: 구매 빈도
└─ 높음 (>2회/월): 로열티 포인트
└─ 중간: 할인

Rule 4: 메시지 유형
└─ PROMOTIONAL: 큰 할인 가능
└─ TRANSACTIONAL: 작은 할인만
```

#### 사용 예시

```typescript
const optimizer = new OfferOptimizer('contact-123', 'org-456');

// 최적 오퍼 예측
const offer = await optimizer.predictBestOffer('PROMOTIONAL');
// {
//   type: 'discount_15',
//   value: 15,
//   label: '15% 할인',
//   acceptProbability: 0.82,
//   expectedLift: 25,
//   reasoning: '높은 가격 민감도 + 중상 LTV → 15% 할인',
//   confidence: 0.78
// }

// 여러 오퍼 A/B 테스트
const best = await optimizer.findBestOfferAmongCandidates([
  'discount_10',
  'discount_15',
  'free_shipping'
]);
// { type: 'discount_15', acceptProbability: 0.82, ... }

// 테스트 결과 기록 (학습)
await optimizer.recordOfferTest('discount_15', true, 125000); // 성공, $125K 수익
```

#### A/B 테스트 자동화

```
Week 1: 3개 오퍼 동시 테스트
├─ Variant A: 10% 할인 (33%)
├─ Variant B: 15% 할인 (33%)
└─ Variant C: 배송비 무료 (33%)

Week 2: 우승 오퍼 확대 (80%), 다른 오퍼 축소 (20%)
└─ 15% 할인: 80% (승자)
└─ 새 오퍼 테스트: 20% (탐색)

매월 결과 정리:
- 수용율 순위
- 평균 거래액 영향도
- L1 렌즈별 최적 오퍼
```

---

## 의사결정 로직

### 통합 최적화 플로우

```
매 30분마다:

1. 지난 30분 캠페인 성과 수집
   └─ SMS/Kakao/Email 별도 집계

2. 각 채널 ROI 계산
   └─ ROI = (revenue - cost) / cost

3. 채널 최적화
   ├─ Rule 1-4 적용 → 할당 % 변경
   ├─ 제약 (10%-60%) 적용
   └─ 신뢰도 점수 계산

4. Thompson Sampling 업데이트
   └─ 각 arm의 Beta 분포 업데이트

5. 활성 캠페인 재배분
   └─ 새로운 채널 할당 적용

6. 대시보드 업데이트
   └─ 실시간 시각화

7. 주간 재검토 (월요일)
   ├─ 예산 재배분
   └─ 성과 리포팅
```

### 신뢰도 점수

```
신뢰도 = 최근 샘플 수 / 최소 샘플 수 × 100

예:
- 10개 샘플 → 100% 신뢰도
- 5개 샘플 → 50% 신뢰도
- 2개 샘플 → 20% 신뢰도 (권장 변경 크기 제한)

규칙:
- >80% 신뢰도: 적극적 변경 (±50%)
- 50-80%: 보수적 변경 (±30%)
- <50%: 미미한 변경 (±10%)
```

---

## API 명세

### 1. POST /api/cron/realtime-optimization

**실시간 최적화 실행** (30분마다 자동)

#### 요청

```bash
curl -X POST http://localhost:3000/api/cron/realtime-optimization \
  -H "Authorization: Bearer {CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"type": "quick"}'
```

#### 파라미터

```typescript
{
  type: "full" | "quick"; // 기본: quick
  // full: 모든 조직 (5-10분)
  // quick: 활성 캠페인만 (1-2분)
}
```

#### 응답

```json
{
  "ok": true,
  "type": "quick",
  "timestamp": "2026-05-27T10:30:00Z",
  "result": {
    "organizationsProcessed": 5,
    "channelMixesUpdated": 12,
    "banditUpdates": 248,
    "budgetRebalances": 1,
    "errors": [],
    "nextRunAt": "2026-05-27T11:00:00Z"
  }
}
```

### 2. GET /api/analytics/optimization

**대시보드 데이터 조회**

#### 응답

```json
{
  "currentAllocation": {
    "SMS": 45,
    "KAKAO": 38,
    "EMAIL": 17
  },
  "lastUpdateAt": "2026-05-27T10:15:00Z",
  "nextUpdateAt": "2026-05-27T10:45:00Z",
  "confidence": 78,
  "banditStats": {
    "SMS": {
      "successes": 456,
      "failures": 244,
      "successRate": 0.652
    },
    ...
  },
  "recommendations": [...],
  "projectedImpact": {
    "monthlyRevenue": 250000,
    "revenueIncrease": 37500,
    "expectedCPA": 45,
    "cpaSavings": 6750
  }
}
```

### 3. POST /api/channel-optimizer/predict-best-time

**최적 송시시간 예측**

#### 요청

```json
{
  "contactId": "contact-123",
  "channel": "SMS",
  "segmentId": "segment-456", // 선택
  "dayOfWeek": 3 // 선택, 0-6
}
```

#### 응답

```json
{
  "hour": 9,
  "dayOfWeek": 3,
  "confidence": 0.85,
  "openRate": 32.1,
  "clickRate": 6.5,
  "reasoning": "과거 30개 샘플에서 오전 9시 개방율 최고"
}
```

### 4. POST /api/offer-optimizer/predict

**최적 오퍼 예측**

#### 요청

```json
{
  "contactId": "contact-123",
  "organizationId": "org-456",
  "messageType": "PROMOTIONAL"
}
```

#### 응답

```json
{
  "type": "discount_15",
  "value": 15,
  "label": "15% 할인",
  "acceptProbability": 0.82,
  "expectedLift": 25,
  "reasoning": "높은 가격 민감도 + 중상 LTV → 15% 할인",
  "confidence": 0.78
}
```

---

## 사용 예시

### 예시 1: 캠페인 생성 시 자동 최적화

```typescript
// 1. 캠페인 생성
const campaign = await createCampaign({
  name: '5월 렌탈 프로모션',
  channels: ['SMS', 'KAKAO', 'EMAIL'],
  recipients: segment.members, // 100명
});

// 2. 현재 최적 채널 할당 조회
const optimizer = new RealtimeChannelOptimizer('org-123');
const mix = await optimizer.getOptimalChannelMix();
// { SMS: 45%, KAKAO: 38%, EMAIL: 17% }

// 3. 채널별 메시지 구성
const messages = await createChannelMessages(campaign.id, {
  SMS: { text: "렌탈 50% 할인...", recipients: Math.floor(100 * 0.45) },
  KAKAO: { text: "...", recipients: Math.floor(100 * 0.38) },
  EMAIL: { text: "...", recipients: Math.floor(100 * 0.17) },
});

// 4. 최적 송시시간 적용
for (const recipient of campaign.recipients) {
  const timeOptimizer = new OptimalSendTimeOptimizer(recipient.id);
  const bestTime = await timeOptimizer.findBestSendTime('SMS');
  
  await scheduleMessage(messages.SMS.id, recipient.id, {
    sendAt: calculateNextOccurrence(bestTime.hour),
  });
}

// 5. 최적 오퍼 적용
const offerOptimizer = new OfferOptimizer(recipient.id, 'org-123');
const offer = await offerOptimizer.predictBestOffer('PROMOTIONAL');

await updateMessageContent(messages.SMS.id, {
  body: `렌탈 ${offer.label} - 자세히보기...`,
  metadata: { offer: offer.type },
});
```

### 예시 2: 주간 성과 검토

```typescript
// 1. 지난주 성과 메트릭 조회
const lastWeekMetrics = await getMetricsForDateRange(
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  new Date()
);

// 2. 채널별 ROI 분석
const smsRoi = lastWeekMetrics.SMS.revenue / lastWeekMetrics.SMS.cost;
const kakaoRoi = lastWeekMetrics.KAKAO.revenue / lastWeekMetrics.KAKAO.cost;
const emailRoi = lastWeekMetrics.EMAIL.revenue / lastWeekMetrics.EMAIL.cost;

console.log('SMS ROI:', smsRoi.toFixed(2)); // 1.5
console.log('Kakao ROI:', kakaoRoi.toFixed(2)); // 2.1
console.log('Email ROI:', emailRoi.toFixed(2)); // 1.8

// 3. 예산 재배분
const allocator = new BudgetAllocator('org-123', 10000);
const newAllocation = await allocator.rebalanceBasedOnLastWeek();

console.log('기존 배분: SMS 40% / Kakao 35% / Email 25%');
console.log('신규 배분:');
newAllocation.allocations.forEach(a => {
  console.log(`  ${a.channel}: ${a.percentage}% ($${a.amount})`);
});

// 4. A/B 테스트 우승 오퍼 확대
const abResult = await getABTestResult('offer-test-week-20');
if (abResult.winner === 'discount_15') {
  await updateCampaignOffer('campaign-123', 'discount_15', { allocation: 80 });
  console.log('15% 할인 확대 적용 (80%)');
}
```

### 예시 3: Thompson Sampling 학습 추적

```typescript
const bandit = new ThompsonSamplingBandit('contact-123', 'segment-456');

// 매일 매 캠페인마다:
for (const message of dailyMessages) {
  const channel = await bandit.selectArm();
  // → 'SMS' 또는 'KAKAO' 또는 'EMAIL'
  
  const messageId = await sendMessage(channel, message);
  
  // 3일 뒤 성과 확인
  setTimeout(async () => {
    const result = await checkMessageResult(messageId);
    if (result.clicked || result.converted) {
      await bandit.updateReward(channel, true);
      console.log(`${channel} 성공 기록`);
    } else {
      await bandit.updateReward(channel, false);
    }
  }, 3 * 24 * 60 * 60 * 1000);
}

// 주간 성과 리포팅
const state = bandit.getState();
console.log('Thompson Sampling 상태:');
console.log('SMS:', state.arms.SMS.successRate.toFixed(2));
console.log('KAKAO:', state.arms.KAKAO.successRate.toFixed(2));
console.log('EMAIL:', state.arms.EMAIL.successRate.toFixed(2));
console.log('신뢰도:', bandit.getConfidence() + '%');
```

---

## 성과 추적

### KPI 정의

| KPI | 기준 | 목표 | 추적주기 |
|-----|------|------|---------|
| **ROI** | (수익 - 비용) / 비용 | +15-25% | 주간 |
| **CPA** | 총 비용 / 전환수 | -10-20% | 주간 |
| **개방율** | 개방수 / 전송수 | +20-35% | 실시간 |
| **클릭율** | 클릭수 / 전송수 | +15-25% | 주간 |
| **전환율** | 전환수 / 전송수 | +10-20% | 주간 |
| **채널 최적화율** | 최적화된 캠페인 / 전체 | 80%+ | 월간 |
| **자동화율** | 수동 개입 시간 단축 | 40% | 월간 |

### 대시보드 모니터링

```
실시간 모니터링 (analytics/optimization):
├─ 현재 채널 할당 (%)
├─ Thompson Sampling 통계
│  ├─ SMS 성공률
│  ├─ KAKAO 성공률
│  └─ EMAIL 성공률
├─ 실시간 추천사항 (3-5개)
├─ A/B 테스트 결과 (우승/패자)
└─ 예상 월 효과
   ├─ 월 수익: +$37.5K
   ├─ CPA 절감: -$6,750
   └─ ROI 개선: +15%
```

### 주간 리포팅

```markdown
# 주간 최적화 리포팅 (2026-05-20 ~ 2026-05-26)

## 채널 성과 분석

| 채널 | 전송 | 개방율 | 클릭율 | 전환율 | ROI | 추이 |
|------|------|--------|--------|--------|-----|------|
| SMS | 25K | 32% | 6.5% | 2.2% | 1.52 | ↑ +5% |
| Kakao | 22K | 38% | 7.8% | 2.8% | 2.15 | ↑ +3% |
| Email | 15K | 22% | 4.2% | 1.5% | 1.68 | → |

## Thompson Sampling 수렴 상태

- SMS: 652/900 성공 (72%) | 신뢰도 92%
- Kakao: 680/900 성공 (76%) | 신뢰도 94% ← 최고 성과
- Email: 580/900 성공 (64%) | 신뢰도 88%

## 예산 배분 변경

기존: SMS 35% / Kakao 35% / Email 30%
신규: SMS 32% / Kakao 42% / Email 26%
근거: Kakao ROI 2.15 > SMS 1.52 → Kakao +7%

## 예상 효과 (월간)

- 수익: +$37.5K (+15%)
- CPA: -$6,750 (-15%)
- 자동화: 320시간 절감 (월 수동작업 40%↓)

## 다음주 계획

- [ ] Email 성과 모니터 (4.2% 클릭율 개선 필요)
- [ ] 최적 송시시간 A/B 확대
- [ ] 오퍼 최적화 (L1 렌즈별 할인율 미세조정)
```

---

## 운영 가이드

### 1. 초기 설정

```typescript
// .env.local
CRON_SECRET=your-secret-key

// 크론 스케줄 (30분마다)
*/30 * * * * curl -X POST http://localhost:3000/api/cron/realtime-optimization \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### 2. 대시보드 접근

```
메뉴: Analytics → 실시간 채널 최적화
URL: /analytics/optimization

확인 항목:
- 현재 채널 할당 %
- Thompson Sampling 신뢰도
- 실시간 추천사항
- A/B 테스트 결과
- 예상 월 효과
```

### 3. 수동 개입

```typescript
// 예산 이동 제안 (자동이 아닌 경우)
const shift = await allocator.suggestAllocationShift('SMS', 'KAKAO', 500);

if (shift.estimatedImpact.revenueIncrease > 1000) {
  console.log('추천: Kakao로 $500 이동 → +$1,500 수익');
  await approveAllocationShift(shift);
}

// 채널 강제 조정 (비상 상황)
await forceChannelAllocation('org-123', {
  SMS: 30,
  KAKAO: 40,
  EMAIL: 30,
});
```

### 4. 문제 해결

#### 문제: "신뢰도가 계속 50% 이하"

```
원인: 샘플 부족 (<10개/30분)
해결:
1. 캠페인 빈도 증가 (최소 하루 3회 전송)
2. 세그먼트 크기 증가 (최소 100명)
3. 신뢰도 임계값 낮춤 (50% 이상에서 진행)
```

#### 문제: "특정 채널이 계속 최저 할당 (10%)"

```
원인: 지속적 저성과 또는 기술 문제
해결:
1. 채널 성과 상세 분석
   └─ Kakao가 장애 상태는 아닌지?
2. 메시지 콘텐츠 검토
   └─ 채널별 톤/길이 최적화되었나?
3. 수신자 세그먼트 검토
   └─ 채널 사용률 높은 그룹인가?
4. 일시적으로 할당 증가 테스트 (20%)
```

#### 문제: "메모리 사용량 급증"

```
원인: 대량 캠페인 처리 중 Redis 과부하
해결:
1. 배치 크기 감소 (10 → 5 조직)
2. 처리 간격 증가 (30분 → 60분)
3. 오래된 메트릭 정리 (30일 이상)
4. Redis 메모리 모니터링 설정
```

### 5. 성능 최적화

```typescript
// 처리 시간 목표
대상: 전체 조직 최적화 < 10분

모니터링:
- CronJob 실행 시간 로깅
- 채널 당 평균 처리 시간
- DB 쿼리 성능

최적화:
1. 인덱스 추가
   CREATE INDEX idx_campaign_recipient_channel_created
   ON campaign_recipients(channel, created_at DESC);

2. 배치 쿼리 최적화
   └─ group_by 대신 SQL window function

3. 캐싱
   └─ Redis에 최근 메트릭 캐싱 (TTL: 5분)
```

---

## 마무리

이 시스템은 **자동 학습 기반의 자체 최적화 마케팅 시스템**입니다.

- **30분마다**: 실제 성과 데이터로 채널 최적화
- **Bayesian**: 신뢰도 높은 의사결정
- **투명성**: 모든 추천사항에 근거 제시
- **안전성**: 제약 조건으로 과도한 변화 방지

**기대 효과**: 월 $250K → $287.5K (+$37.5K, +15%)
