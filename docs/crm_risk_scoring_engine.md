# CRM Risk Scoring 엔진 완전가이드 (2026-05-26)

**작성:** CRM Analytics 전문가  
**상태:** ✅ 완료  
**버전:** 1.0 (마비즈 CRM 특화)

---

## 🎯 Risk Scoring 개요

### 목표
고객의 이탈 위험, 저가치, 고위험을 **0-100점 점수**로 자동 감지하고, 임계값별 자동 개입

### 가중치 구성
```
Risk Score = 20% × Churn Risk + 30% × Value Risk + 25% × Engagement Risk + 15% × Complaint Risk + 10% × Payment Risk + 10% × Anomaly Risk

범위: 0 (안전) ~ 100 (위험)
```

---

## 📊 6가지 Risk 차원

### 1️⃣ Churn Risk (이탈 위험도) - 가중치 20%

**계산식:**
```
Churn Score = 40% × RecencyScore + 30% × FrequencyScore + 20% × InactivityDaysScore + 10% × LastContactSentimentScore

RecencyScore: 마지막 접촉일까지의 일수
- 0-7일: 0점
- 8-30일: 10점
- 31-60일: 25점
- 61-90일: 50점
- 90일 이상: 100점

FrequencyScore: 1년 내 구매 횟수
- 3회 이상: 0점
- 2회: 20점
- 1회: 50점
- 0회: 100점

InactivityDaysScore: 마지막 활동 이후 경과일수
- 0-30일: 0점
- 31-60일: 20점
- 61-90일: 40점
- 91-180일: 70점
- 180일 이상: 100점

LastContactSentimentScore: 마지막 콜/SMS 감정
- 긍정적: 0점
- 중립: 25점
- 부정적: 100점
```

**예시 (고객 A):**
```
마지막 접촉: 75일 전 (RecencyScore = 50)
1년 내 구매: 1회 (FrequencyScore = 50)
마지막 활동: 80일 전 (InactivityScore = 40)
감정: 중립 (SentimentScore = 25)

Churn Score = 40% × 50 + 30% × 50 + 20% × 40 + 10% × 25
            = 20 + 15 + 8 + 2.5 = 45.5점
```

---

### 2️⃣ Value Risk (저가치 위험도) - 가중치 30%

**계산식:**
```
Value Score = 50% × LTVScore + 30% × AOVScore + 20% × ChurnRiskAdjustment

LTVScore: 생명주기 가치
- $1,500+: 0점
- $1,000-1,499: 20점
- $500-999: 40점
- $100-499: 70점
- $0-99: 100점

AOVScore: 평균 거래액
- $500+: 0점
- $400-499: 15점
- $300-399: 30점
- $200-299: 60점
- $0-199: 100점

ChurnRiskAdjustment: 이탈 위험도에 따른 조정
- Churn Score < 30: +0
- Churn Score 30-50: +15
- Churn Score > 50: +30
```

**예시 (고객 B):**
```
LTV: $750 (LTVScore = 40)
AOV: $375 (AOVScore = 30)
Churn Score: 45점 (Adjustment = 15)

Value Score = 50% × 40 + 30% × 30 + 20% × 15
            = 20 + 9 + 3 = 32점
```

---

### 3️⃣ Engagement Risk (낮은 참여도) - 가중치 25%

**계산식:**
```
Engagement Score = 30% × EmailOpenScore + 25% × SMSResponseScore + 20% × CallAnswerScore + 15% × WebsiteVisitScore + 10% × SocialScore

EmailOpenScore: 이메일 열기율 (최근 10개)
- 80%+: 0점
- 60-79%: 20점
- 40-59%: 40점
- 20-39%: 60점
- 0-19%: 100점

SMSResponseScore: SMS 응답율 (최근 20건)
- 70%+: 0점
- 50-69%: 20점
- 30-49%: 40점
- 10-29%: 60점
- 0-9%: 100점

CallAnswerScore: 콜 응답율
- 90%+: 0점
- 70-89%: 20점
- 50-69%: 40점
- 30-49%: 60점
- 0-29%: 100점

WebsiteVisitScore: 월간 방문 횟수
- 10+: 0점
- 5-9: 20점
- 2-4: 40점
- 1: 60점
- 0: 100점

SocialScore: SNS 상호작용 (좋아요/댓글/공유)
- 5+/월: 0점
- 3-4/월: 20점
- 1-2/월: 40점
- 0/월: 100점
```

**예시 (고객 C):**
```
이메일 열기율: 45% (EmailOpenScore = 40)
SMS 응답율: 62% (SMSResponseScore = 20)
콜 응답율: 75% (CallAnswerScore = 20)
월간 방문: 3회 (WebsiteVisitScore = 40)
SNS 상호작용: 0 (SocialScore = 100)

Engagement Score = 30% × 40 + 25% × 20 + 20% × 20 + 15% × 40 + 10% × 100
                 = 12 + 5 + 4 + 6 + 10 = 37점
```

---

### 4️⃣ Complaint Risk (불평/불만) - 가중치 15%

**계산식:**
```
Complaint Score = 40% × ComplaintCountScore + 30% × ComplaintSentimentScore + 30% × ResolutionTimeScore

ComplaintCountScore: 최근 6개월 불평 건수
- 0건: 0점
- 1건: 15점
- 2건: 40점
- 3건: 70점
- 4+건: 100점

ComplaintSentimentScore: 불평 심각도
- 경미한 불평: 0-30점
- 중간 불평: 30-60점
- 심각한 불평: 60-100점

ResolutionTimeScore: 해결 시간
- 24시간 이내: 0점
- 1-3일: 20점
- 4-7일: 40점
- 1-2주: 70점
- 2주 이상: 100점
```

**예시 (고객 D):**
```
불평 건수: 1건 (ComplaintCountScore = 15)
심각도: 중간 불평 (ComplaintSentimentScore = 45)
해결 시간: 2일 (ResolutionTimeScore = 20)

Complaint Score = 40% × 15 + 30% × 45 + 30% × 20
                = 6 + 13.5 + 6 = 25.5점
```

---

### 5️⃣ Payment Risk (결제 위험도) - 가중치 10%

**계산식:**
```
Payment Score = 50% × LatePaymentScore + 30% × RefundHistoryScore + 20% × ChargbackScore

LatePaymentScore: 지연 결제 이력
- 0회: 0점
- 1회: 20점
- 2회: 40점
- 3회: 70점
- 4+회: 100점

RefundHistoryScore: 환불/취소율
- 0%: 0점
- 1-2%: 15점
- 3-5%: 40점
- 6-10%: 70점
- 10%+: 100점

ChargebackScore: 분쟁 청구 건수
- 0건: 0점
- 1건: 50점
- 2+건: 100점
```

---

### 6️⃣ Anomaly Risk (이상징후) - 가중치 10%

**계산식:**
```
Anomaly Score = 30% × LocationChangeScore + 25% × BehaviorChangeScore + 25% × CompetitorMentionScore + 20% × PromoAbuseScore

LocationChangeScore: IP 주소/위치 변화
- 없음: 0점
- 국내 변화: 15점
- 국외 변화: 50점
- 일주일에 여러 번: 100점

BehaviorChangeScore: 최근 행동 패턴 급변
- 안정적: 0점
- 약간 변화: 20점
- 중간 변화: 50점
- 급격한 변화: 100점

CompetitorMentionScore: 경쟁사 언급 감지
- 언급 없음: 0점
- SNS 1회 언급: 40점
- SNS 2회+ 또는 콜 언급: 80점
- 경쟁사로 전환 기록: 100점

PromoAbuseScore: 프로모션 남용
- 정상 사용: 0점
- 1회 남용 시도: 30점
- 2회+ 남용 시도: 100점
```

---

## 🎚️ Risk Score 임계값 및 자동 개입

### 임계값 매트릭스

```
Risk Score    상태    자동 개입                     우선순위
────────────────────────────────────────────────────────
90-100       위험 🔴  - 자동 전화 통지              P0
            (이탈예상)  - $30 이상 쿠폰 발급
                      - 에이전트 직접 담당

70-89        경고 🟡  - SMS 재활성화 시퀀스        P1
            (높은위험)  - Day 0-3: 가치 재강조
                      - VIP 멤버십 제안

50-69        주의 🟠  - 이메일 재접근              P2
            (중간위험)  - "그동안 어디 가셨어요?"
                      - 신상품 소개

30-49        안전 🟢  - 정기 팔로우업             P3
            (낮은위험)  - 월 1회 체크인
                      - 일반 뉴스레터

0-29         충성 💚  - VIP 프로그램                P4
            (매우안전)  - 친구추천 인센티브
                      - 프리미엄 콘텐츠
```

---

## 📱 자동 개입 시퀀스

### Tier 1: 위험 (90-100점)

```
Day 0 (감지):
1. 자동 전화 통지 (상담사 배정)
2. $30 쿠폰 자동 발급
3. 우선순위 태그 추가
4. VP 영업팀에 알림 (Slack)

Day 1:
- 콜 기록 및 관심사 분석
- L0 부재중 고객 재활성화 스크립트 적용

Day 3:
- SMS Day0-3 + PASONA + L6 손실회피
- "이번달만 추가 20% 할인" (FOMO)

Day 7:
- Grant Cardone Follow-up (5-12회 접촉)
- 개인화된 오퍼 (이전 구매 패턴 기반)
```

### Tier 2: 경고 (70-89점)

```
Day 0:
1. SMS 발송: "요즘 어떠신가요?" (PASONA P)
2. 이메일: VIP 멤버십 제안
3. 콜 스케줄 생성

Day 2:
- SMS: 가치 재강조 (PASONA S)
- 전환 고객 사례 공유

Day 5:
- 1:1 콜 ("준비는 괜찮으신가요?" - L2)
- 다음 여행 날짜 예약

Day 14:
- 결과 추적 (전환 여부)
- 점수 재계산
```

### Tier 3: 주의 (50-69점)

```
Day 0:
1. 이메일: "그동안 어디 가셨어요?"
2. 자동 태그: "재접근_필요"

Day 3:
- SMS: 신상품 소개 + 클릭 유도

Day 7:
- 이메일: 계절 패키지 추천

Day 21:
- 결과 추적
```

---

## 🔄 점수 재계산 주기

```
실시간 (< 5분):
- 새로운 콜/SMS 응답
- 불평 접수

일일 배치 (자정):
- 이메일 열기율 업데이트
- SMS 응답률 계산
- 웹사이트 방문 집계

주간 배치 (월요일 9:00):
- LTV/AOV 재계산
- Churn 패턴 분석
- 새로운 위험군 감지

월간 배치 (1일 00:00):
- 6개월 불평 이력 집계
- 결제 지연 기록 정리
- 이상징후 분석
```

---

## 📊 Risk Score 분포 추적

### Dashboard Widget

```
Risk Score 분포 (500명 고객):

100-90: 12명  (2.4%) 🔴 위험
80-70:  18명  (3.6%) 🟡 경고
60-50:  45명  (9.0%) 🟠 주의
40-30:  165명 (33%) 🟢 안전
0-20:   260명 (52%) 💚 충성

조치 현황:
🔴 자동 콜 배정: 12명 (100%)
🟡 SMS 발송: 18명 (100%)
🟠 이메일 발송: 45명 (95%)
```

### 월별 추이

```
5월: 평균 Risk 65점 (높음)
6월: 평균 Risk 58점 (중간)
7월: 평균 Risk 45점 (낮음) ← L0/L6/L9 개입 효과
8월: 평균 Risk 38점 (목표 달성)
```

---

## 🛠️ 구현 함수 (TypeScript)

```typescript
// src/lib/analytics/risk-scoring.ts

interface RiskFactors {
  churnScore: number;      // 0-100
  valueScore: number;      // 0-100
  engagementScore: number; // 0-100
  complaintScore: number;  // 0-100
  paymentScore: number;    // 0-100
  anomalyScore: number;    // 0-100
}

function calculateRiskScore(factors: RiskFactors): number {
  return (
    factors.churnScore * 0.20 +
    factors.valueScore * 0.30 +
    factors.engagementScore * 0.25 +
    factors.complaintScore * 0.15 +
    factors.paymentScore * 0.10 +
    factors.anomalyScore * 0.10
  );
}

function getRiskTier(score: number): 'SAFE' | 'WARNING' | 'ALERT' | 'CRITICAL' {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'ALERT';
  if (score >= 50) return 'WARNING';
  return 'SAFE';
}

async function triggerAutoIntervention(contactId: string, score: number) {
  const tier = getRiskTier(score);
  
  switch(tier) {
    case 'CRITICAL':
      // 자동 전화 배정
      await assignToAgent(contactId, 'URGENT');
      await issueCoupon(contactId, 30);
      await slackNotify('HIGH_RISK_CUSTOMER', { contactId, score });
      break;
    case 'ALERT':
      // SMS 재활성화
      await sendSMSSequence(contactId, 'REACTIVATION_3DAY');
      break;
    // ... 이하 생략
  }
}
```

---

**마비즈 CRM Risk Scoring 엔진 v1.0**
