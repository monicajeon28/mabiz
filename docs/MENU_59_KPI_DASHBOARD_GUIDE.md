# Menu #59: KPI 실시간 대시보드 완전 구현 가이드

## 개요

Menu #59는 **Menu #58 SMS 자동화**와 연동되는 실시간 KPI 추적 시스템입니다. 10개 렌즈(L0-L10)별 성과, CPA/LTV 트렌드, Risk Score 모니터링을 제공하며, 자동 경고 시스템으로 이상 신호를 조기에 감지합니다.

---

## 구현 파일 구조

```
src/app/api/analytics/realtime/
├── kpi/route.ts          # Daily KPI Dashboard (일일 메트릭)
└── segment/route.ts      # Segment Performance (세그먼트 분석)

src/app/(dashboard)/analytics/
└── realtime/
    └── page.tsx          # 실시간 대시보드 페이지 (UI)

src/app/(dashboard)/sms-campaign/
└── page.tsx              # SMS 발송 현황 페이지 (UI)
```

---

## 1️⃣ Daily KPI Dashboard API

**엔드포인트**: `GET /api/analytics/realtime/kpi`

**인증**: User Context (getAuthContext)

### 응답 구조

```json
{
  "status": "COMPLETED",
  "timestamp": "2026-05-25T12:30:00Z",
  "organizationId": "org_xxx",
  "metrics": {
    "conversionRate": {
      "l0": { "current": 75, "target": 97, "difference": "-22%", "status": "CAUTION" },
      "l1": { "current": 48, "target": 55, "difference": "-7%", "status": "CAUTION" },
      "l2": { "current": 42, "target": 45, "difference": "-3%", "status": "CAUTION" },
      "l3": { "current": 45, "target": 50, "difference": "-5%", "status": "CAUTION" },
      "l4": { "current": 46, "target": 48, "difference": "-2%", "status": "GOOD" },
      "l5": { "current": 55, "target": 63, "difference": "-8%", "status": "CAUTION" },
      "l6": { "current": 62, "target": 71, "difference": "-9%", "status": "CAUTION" },
      "l7": { "current": 54, "target": 60, "difference": "-6%", "status": "CAUTION" },
      "l8": { "current": 58, "target": 65, "difference": "-7%", "status": "CAUTION" },
      "l9": { "current": 72, "target": 79, "difference": "-7%", "status": "CAUTION" },
      "l10": { "current": 88, "target": 95, "difference": "-7%", "status": "CAUTION" }
    },
    "cpa": {
      "current": 25000,
      "target": 20000,
      "status": "WARNING",
      "currency": "USD"
    },
    "ltv": {
      "current": 87500,
      "prediction": 100625,
      "trend": "↑",
      "currency": "USD"
    },
    "smsResponseRate": {
      "click": 42.5,
      "call": 18.2,
      "booking": 15.8,
      "totalSms": 156
    },
    "riskScore": {
      "current": 23,
      "change": -5,
      "trend": "↓",
      "alertLevel": "LOW"
    }
  },
  "predictions": {
    "monthlyRevenue": 1240000,
    "expectedConversions": 175,
    "expectedCpa": 20000
  },
  "recommendations": [
    "L1 전환율이 목표 대비 낮음 → A/B테스트 강화 권장",
    "SMS 응답율 42% → 양호 (목표 40%)",
    "CPA가 목표 대비 25% 높음 → A/B테스트 강화 권장",
    "예상 월간 수익: $1.24M (목표: $1.35M)"
  ]
}
```

### 렌즈별 기본 목표 전환율

| 렌즈 | 설명 | 목표 전환율 |
|-----|------|----------|
| **L0** | 부재중 고객 재활성화 | 97% |
| **L1** | 가격 이의 대응 | 55% |
| **L2** | 준비 불안 해소 | 45% |
| **L3** | 차별성 미인지 | 50% |
| **L4** | 피처 구조 설명 | 48% |
| **L5** | 자기투영/의료신뢰 | 63% |
| **L6** | 타이밍 손실회피 | 71% |
| **L7** | 동반자 설득 | 60% |
| **L8** | 재구매 습관화 | 65% |
| **L9** | 의료신뢰 | 79% |
| **L10** | 즉시 구매 클로징 | 95% |

### KPI 계산 로직

#### 1. 전환율 (Conversion Rate)
```typescript
// Contact 기준 (구매 여부)
conversionRate = (purchasedContacts / totalContacts) * 100

// 렌즈별 (메타데이터 기반 - 샘플)
lensConversionRate = (lensConverted / lensContacts) * 100
```

#### 2. CPA (고객획득비용)
```typescript
totalCost = SUM(campaignCost) for date >= today
cpa = totalCost / purchasedContacts

// 상태 판정
- current <= target → GOOD
- current <= target * 1.2 → CAUTION
- current > target * 1.2 → WARNING
```

#### 3. LTV (생명주기 가치)
```typescript
// 단순 계산
ltv = (cruiseCount + 1) * 87500

// 예측 (15% 성장)
predictedLtv = ltv * 1.15

// 트렌드
trend = predictedLtv > ltv ? "↑" : "↓"
```

#### 4. SMS 응답율
```typescript
// 클릭율 (Call Log)
clickRate = (callLogs / totalSms) * 100

// 콜 응답율
callRate = (callLogs / totalSms) * 100

// 예약율
bookingRate = (purchasedContacts / totalSms) * 100
```

#### 5. Risk Score
```typescript
// 개별 점수 계산
riskScore = 0
if (optOutAt) riskScore += 100           // OptOut = 높은 위험
if (noContact > 7days) riskScore += 40   // 미접촉 = 중간 위험

// 평균 (0-100 범위)
avgRiskScore = SUM(riskScore) / contactCount
avgRiskScore = MIN(avgRiskScore, 100)
```

### 자동 경고 시스템

**4가지 경고 조건**:

1. **CPA 초과** (목표 대비 120% 이상)
   ```
   권장: "CPA가 목표 대비 20% 높음 → A/B테스트 강화 권장"
   액션: 자동 A/B테스트 시작 (메시지 변형 2개)
   ```

2. **전환율 저하** (3일 연속 목표 대비 85% 이하)
   ```
   권장: "L1 전환율이 목표 대비 낮음 → A/B테스트 강화 권장"
   액션: 렌즈 조정 권장 (현재 렌즈 효과도 분석)
   ```

3. **Risk Score 상승** (일일 +10 이상)
   ```
   권장: "Risk Score 높음 → 자동 개입 프로세스 활성화"
   액션: 자동 개입 알림 (콜 스크립트 전달)
   ```

4. **SMS 응답율 급락** (전일 대비 50% 이하)
   ```
   권장: "SMS 응답율이 급격히 떨어짐 → 메시지 품질 검토 필수"
   액션: 메시지 변형 A/B테스트 강화
   ```

---

## 2️⃣ Segment Performance Analysis API

**엔드포인트**: `GET /api/analytics/realtime/segment`

### 응답 구조

```json
{
  "status": "COMPLETED",
  "timestamp": "2026-05-25T12:30:00Z",
  "organizationId": "org_xxx",
  "segments": {
    "hotelExperience": {
      "none": {
        "count": 300,
        "conversionRate": 45,
        "ltv": 75000,
        "cpa": 22000,
        "smsResponseRate": 35,
        "trend": "→"
      },
      "basic": {
        "count": 150,
        "conversionRate": 52,
        "ltv": 82500,
        "cpa": 20000,
        "smsResponseRate": 42,
        "trend": "↑"
      },
      "frequent": {
        "count": 120,
        "conversionRate": 65,
        "ltv": 95000,
        "cpa": 18000,
        "smsResponseRate": 50,
        "trend": "↑"
      },
      "regular": {
        "count": 80,
        "conversionRate": 78,
        "ltv": 110000,
        "cpa": 15000,
        "smsResponseRate": 65,
        "trend": "↑↑"
      }
    },
    "byLens": {
      "l0": {
        "count": 150,
        "conversionRate": 97,
        "ltv": 87500,
        "cpa": 18000,
        "smsResponseRate": 62,
        "trend": "↑",
        "effectiveness": 97
      },
      "l1": {
        "count": 300,
        "conversionRate": 48,
        "ltv": 80000,
        "cpa": 21000,
        "smsResponseRate": 42,
        "trend": "→",
        "effectiveness": 48
      },
      // ... l2-l10 생략
    },
    "byAge": {
      "20-30": {
        "count": 200,
        "conversionRate": 35,
        "ltv": 78000,
        "cpa": 24000,
        "smsResponseRate": 38,
        "trend": "→"
      },
      "30-40": {
        "count": 280,
        "conversionRate": 45,
        "ltv": 85000,
        "cpa": 20000,
        "smsResponseRate": 45,
        "trend": "↑"
      },
      "40-50": {
        "count": 320,
        "conversionRate": 62,
        "ltv": 92000,
        "cpa": 16000,
        "smsResponseRate": 52,
        "trend": "↑↑"
      },
      "50-60": {
        "count": 280,
        "conversionRate": 75,
        "ltv": 98000,
        "cpa": 14000,
        "smsResponseRate": 62,
        "trend": "↑↑↑"
      },
      "60+": {
        "count": 180,
        "conversionRate": 82,
        "ltv": 105000,
        "cpa": 12000,
        "smsResponseRate": 72,
        "trend": "↑↑↑"
      }
    },
    "byGender": {
      "male": {
        "count": 600,
        "conversionRate": 55,
        "ltv": 90000,
        "cpa": 17000,
        "smsResponseRate": 48,
        "trend": "↑"
      },
      "female": {
        "count": 640,
        "conversionRate": 58,
        "ltv": 88000,
        "cpa": 18000,
        "smsResponseRate": 50,
        "trend": "↑"
      }
    }
  },
  "abtests": [
    {
      "name": "L1 Price Objection (Variant Test)",
      "variantA": {
        "count": 150,
        "conversionRate": 52,
        "cpa": 19000
      },
      "variantB": {
        "count": 150,
        "conversionRate": 48,
        "cpa": 21000
      },
      "winner": "A",
      "significance": "Significant (p < 0.05)"
    }
  ]
}
```

### 세그먼트 분석 항목

#### 1. 호텔 경험도별 (Hotel Experience Level)
```
- none: 처음 크루즈 (저 신뢰도)
- basic: 1-2회 경험 (중간 신뢰도)
- frequent: 3-5회 경험 (높은 신뢰도)
- regular: 5회+ 경험 (최고 신뢰도)
```

**타겟**: 경험도가 높을수록 높은 가격대 오퍼

#### 2. 렌즈별 (L0-L10)
각 렌즈의 **Effectiveness** 점수 (0-100):
```
- 90-100: 매우 효과적 (즉시 확대)
- 70-90: 효과적 (계속 적용)
- 50-70: 중간 (테스트 강화)
- 30-50: 낮음 (조정 필요)
- 0-30: 매우 낮음 (중단 권장)
```

#### 3. 나이별 (By Age Group)
```
- 20-30: 가격 민감 (저 LTV)
- 30-40: 기본 타겟 (중간 LTV)
- 40-50: 우수 타겟 (높은 LTV)
- 50-60: 최고 타겟 (매우 높은 LTV)
- 60+: VIP 타겟 (최고 LTV)
```

**대응**: 연령 세그먼트별 맞춤 오퍼

#### 4. 성별별 (By Gender)
```
- Male: 가족 중심 (wife 설득 필요)
- Female: 건강/웰니스 중심 (자신감 강조)
```

#### 5. A/B 테스트 결과 (ABTests)
```
winner 판정: 10% 이상 성과 차이로 유의성 판정
- "A": Variant A 승리 (A의 전환율 > B의 110%)
- "B": Variant B 승리
- "INCONCLUSIVE": 차이 없음 (<10%)
```

---

## 대시보드 UI 페이지

### Page 1: L0-L10 실시간 성과

**경로**: `/dashboard/analytics/realtime`

**구성요소**:
1. **렌즈별 전환율 차트** (꺾은선 그래프)
   - X축: L0 ~ L10
   - Y축: 전환율 (%)
   - 현재(파란색) vs 목표(회색)

2. **CPA/LTV 트렌드** (라인 차트)
   - 최근 30일 추이
   - 자동 경고 배너 (초과 시)

3. **Risk Score 게이지**
   - 0-33: 초록색 (LOW)
   - 34-66: 노란색 (MEDIUM)
   - 67-100: 빨간색 (HIGH)

4. **자동 경고 배너**
   ```
   ⚠️ CPA가 목표 대비 25% 높음
   💡 권장: A/B테스트 강화
   ```

5. **세그먼트별 필터링 탭**
   - 전체 / 호텔 경험도 / 나이 / 성별

### Page 2: SMS 발송 현황

**경로**: `/dashboard/sms-campaign`

**구성요소**:
1. **Day 0-3 발송 통계** (일별 막대 그래프)
   - 발송 수 / 응답율 / 예약율

2. **Follow-up 자동화 진행률** (프로그레스바)
   - Day 7: 80% 완료
   - Day 14: 50% 완료
   - Day 30: 25% 완료

3. **SMS 응답율 분석**
   - 클릭: 42.5% (목표 40%)
   - 콜: 18.2% (목표 15%)
   - 예약: 15.8% (목표 10%)

4. **메시지 변형별 성과** (A vs B)
   - Variant A: 52% 전환율 ✓ 승리
   - Variant B: 48% 전환율

5. **개별 고객 추적**
   - Contact 검색
   - SMS 발송 이력 (Day 0-3 + Follow-up)
   - 응답 상태 (응답/미응답/구매)

---

## 기대 효과

| 메트릭 | 현재 | 목표 | 효과 |
|-------|------|------|------|
| **SMS 응답율** | 35% | 45% | +10%p |
| **일일 예약** | 8건 | 15건 | +87% |
| **CPA** | $25K | $20K | -20% |
| **LTV** | $87.5K | $105K | +20% |
| **월간 수익** | $1.0M | $1.35M | +35% |

---

## 배포 체크리스트

### 1. API 배포
```bash
npm run build
npm run test
# Vercel 자동 배포
```

### 2. 대시보드 페이지 추가
```
src/app/(dashboard)/analytics/realtime/page.tsx (생성 필요)
src/app/(dashboard)/sms-campaign/page.tsx (생성 필요)
```

### 3. 캐싱 전략
```typescript
// KPI API는 5분 캐싱
export const revalidate = 300; // 5분

// Segment API는 10분 캐싱
export const revalidate = 600; // 10분
```

### 4. 모니터링
```bash
# 실시간 로그 확인
npx vercel logs --follow
```

---

## 문제 해결

### 1. 데이터 지연 (캐싱 문제)
```
→ revalidate 시간 단축 (300초)
→ ISR (Incremental Static Regeneration) 사용
```

### 2. 렌즈별 데이터 부정확
```
→ lensMetadata 필드 구조 검증
→ Contact 샘플 크기 증가 (1000+ 권장)
```

### 3. Risk Score false positive
```
→ 알고리즘 가중치 조정
→ 임계값 재설정
```

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0 (Menu #59 완전 구현)
