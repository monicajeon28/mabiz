# CRM Attribution Modeling 완전가이드 (2026-05-26)

**작성:** CRM Analytics 전문가  
**상태:** ✅ 완료  
**버전:** 1.0 (마비즈 CRM 특화)

---

## 📊 Attribution 개요

### 목표
고객의 구매 여정에서 **각 터치포인트의 기여도**를 측정하고, 최적의 마케팅 채널 배분 결정

### 마비즈 고객 여정 예시

```
고객 A의 구매 경로:
─────────────────────────────────────────────────────

Day 1: Facebook 광고 클릭 (첫 접촉)
       ↓
Day 3: Google 검색 → 웹사이트 방문
       ↓
Day 5: SMS 발송 (Day0-3 자동화)
       ↓
Day 7: 전화 콜 (상담사: 영미)
       ↓
Day 8: 구매 완료! ✅ ($475)

어느 채널이 공로를 세워야 할까?
→ First-touch? Facebook ($475 모두 배분)
→ Last-touch? Phone ($475 모두 배분)
→ Multi-touch? 4개 채널에 공정하게 배분
```

---

## 🎯 5가지 Attribution 모델

### 1️⃣ First-Touch Attribution (첫 접촉)

**규칙:** 구매 전환의 100%를 첫 번째 터치포인트에 배분

```
Facebook 광고 → 100% 크레딧
(Google, SMS, 전화는 0%)

공식: Credit = Purchase Amount (전액)
```

**마비즈 적용 예:**
```
Facebook 광고: $68,400 매출 × 45% (Facebook 첫 접촉율) = $30,780
Google 검색: $68,400 × 30% = $20,520
SNS 추천: $68,400 × 20% = $13,680
기타: $68,400 × 5% = $3,420

결론: Facebook이 가장 좋은 채널처럼 보임
(실제로는 마지막 추동력은 전화!)
```

**장점:**
- 간단하고 이해하기 쉬움
- 인지도 높은 채널 파악 가능

**단점:**
- 중간 터치포인트 무시
- 의사결정자 (Phone)의 역할 미반영

---

### 2️⃣ Last-Touch Attribution (마지막 접촉)

**규칙:** 구매 전환의 100%를 마지막 터치포인트에 배분

```
전화 상담사 → 100% 크레딧
(Facebook, Google, SMS는 0%)

공식: Credit = Purchase Amount (전액)
```

**마비즈 적용 예:**
```
전화: $68,400 × 65% (Phone 최종 접촉율) = $44,460
SMS: $68,400 × 20% = $13,680
이메일: $68,400 × 10% = $6,840
기타: $68,400 × 5% = $3,420

결론: 전화 상담사의 가치가 과장됨
(Facebook의 인지도 생성 역할 무시)
```

**장점:**
- 즉시적 전환 드라이버 파악
- 상담사 성과 측정 가능

**단점:**
- 인지 구축 채널 가치 무시
- 장기 고객 여정 미반영

---

### 3️⃣ Linear Attribution (선형 분배)

**규칙:** 각 터치포인트에 동일하게 배분

```
Facebook (25%) + Google (25%) + SMS (25%) + Phone (25%)

공식: Credit = Purchase Amount / Number of Touchpoints
```

**마비즈 적용 예:**
```
Customer A: 4개 터치포인트
Facebook: $475 / 4 = $118.75
Google: $118.75
SMS: $118.75
Phone: $118.75

월 합계:
Facebook: $118.75 × 200명 = $23,750
Google: $23,750
SMS: $23,750
Phone: $23,750
```

**장점:**
- 모든 채널의 역할 인정
- 이해하기 쉬움

**단점:**
- 터치포인트 순서 무시 (첫/마지막이 더 중요한데도)
- 채널별 실제 영향력 반영 미흡

---

### 4️⃣ Time-Decay Attribution (시간 감쇠)

**규칙:** 구매에 가까울수록 더 많은 크레딧 배분

```
시간이 지날수록 기여도 감소 (지수 감쇠)

공식: Credit = Purchase Amount × (decay^days_before_purchase) / sum(decay^days)

decay = 0.5 (반감기: 매일 50% 감소)
```

**마비즈 적용 예:**

```
Customer A의 8일 여정:
─────────────────────────────────────────────

Day 1: Facebook ($475 × 0.5^7 / total) = $1.86
       decay값 = 0.00781

Day 3: Google ($475 × 0.5^5 / total) = $7.41
       decay값 = 0.03125

Day 5: SMS ($475 × 0.5^3 / total) = $29.69
       decay값 = 0.125

Day 7: Phone ($475 × 0.5^1 / total) = $118.75
       decay값 = 0.5

---

합계 decay = 0.66406

Facebook: $1.86 (0.4%)
Google: $7.41 (1.6%)
SMS: $29.69 (6.3%)
Phone: $436.04 (91.8%)
```

**마비즈 월간 적용:**
```
Facebook: $1.86 × 300명 = $558
Google: $7.41 × 300명 = $2,223
SMS: $29.69 × 300명= $8,907
Phone: $436.04 × 300명 = $130,812

Phone 편향이 심함!
```

**장점:**
- 최근 터치포인트의 중요성 반영
- 그래도 초기 인지 역할 인정

**단점:**
- Phone의 역할이 과장됨
- 여전히 임의의 decay 파라미터 사용

---

### 5️⃣ **Position-Based Attribution (위치 기반) ⭐ 권장**

**규칙:** 첫/마지막 터치포인트에 40%씩, 중간에 20% 배분

```
First Touch (40%) + Middle Touches (20%) + Last Touch (40%)

공식:
- First touchpoint: Purchase × 0.4
- Last touchpoint: Purchase × 0.4
- Middle touchpoints: Purchase × 0.2 / (number of middle touches)
```

**마비즈 적용 예 (Customer A):**

```
Day 1: Facebook (First) = $475 × 40% = $190
Day 3: Google (Middle) = $475 × 20% / 2 = $47.50
Day 5: SMS (Middle) = $475 × 20% / 2 = $47.50
Day 7: Phone (Last) = $475 × 40% = $190

합계: $190 + $47.50 + $47.50 + $190 = $475 ✅
```

**마비즈 월간 적용:**
```
300명 고객, 평균 4개 터치포인트 가정:

Facebook (First): $190 × 300 = $57,000
Google (Middle): $47.50 × 300 = $14,250
SMS (Middle): $47.50 × 300 = $14,250
Phone (Last): $190 × 300 = $57,000

---
총 매출: $142,500

Facebook 역할: $57,000 (40%)
Phone 역할: $57,000 (40%)
SMS + Google: $28,500 (20%)
```

**장점:** ✅
- 첫 인지(Facebook)와 최종 결정(Phone) 모두 인정
- 직관적이고 공정함
- 마케팅-영업 협력 강조

**단점:**
- 실제 터치포인트 수 편차 미반영

---

## 🎯 마비즈 권장 모델: Hybrid Attribution

### 채널별 맞춤형 모델 조합

```
┌─────────────────────────────────────────────────┐
│ 마비즈 Hybrid Attribution (권장)                │
├─────────────────────────────────────────────────┤
│                                                 │
│ Awareness 채널: First-Touch 40% + Linear 60%  │
│ ├─ Facebook 광고                              │
│ ├─ Google 검색                                │
│ └─ SNS 추천                                   │
│    → Facebook의 인지 생성 역할 강조            │
│                                                 │
│ Engagement 채널: Linear 100%                  │
│ ├─ SMS (Day0-3)                               │
│ ├─ 이메일                                     │
│ └─ 웹사이트 방문                              │
│    → 여러 터치의 균등한 역할                  │
│                                                 │
│ Conversion 채널: Last-Touch 40% + Linear 60% │
│ ├─ 전화 상담                                  │
│ ├─ 직접 방문                                  │
│ └─ 온라인 결제                                │
│    → 최종 의사결정자의 역할 강조              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 계산 예시 (Customer A)

```
Customer A: $475 구매

Phase 1 - Awareness (Day 1):
Facebook → First-Touch 40% + Linear 60%
= $475 × 0.4 + ($475 × 0.6 / 4 touchpoints)
= $190 + $71.25 = $261.25

Phase 2 - Engagement (Day 3-5):
Google → Linear = $475 × 0.6 / 4 = $71.25
SMS → Linear = $475 × 0.6 / 4 = $71.25

Phase 3 - Conversion (Day 7):
Phone → Last-Touch 40% + Linear 60%
= $475 × 0.4 + ($475 × 0.6 / 4 touchpoints)
= $190 + $71.25 = $261.25

재분배 후:
Facebook: $261.25 (55%)
Phone: $261.25 (55%)
Google: $71.25 (-23%)
SMS: $71.25 (-23%)
← 실제 여정의 흐름 반영!
```

---

## 📊 마비즈 월간 Attribution 분석

### 가정
```
월 300명 신규 고객
평균 구매가: $475
평균 터치포인트: 4개
```

### Position-Based 결과

```
채널              First Touch  Middle  Last Touch  합계
─────────────────────────────────────────────────────
Facebook 광고    $57,000 ✅   $7,125  $0         $64,125
Google 검색      $0           $14,250 $0         $14,250
SNS 추천         $0           $7,125  $0         $7,125
SMS (Day0-3)     $0           $14,250 $0         $14,250
전화상담         $0           $7,125  $57,000 ✅ $64,125
직접 방문        $0           $0      $0         $0
─────────────────────────────────────────────────────
합계             $57,000      $49,875 $57,000    $142,500 (월 매출)
```

### 인사이트

1. **Facebook이 진짜 주인공**
   - 첫 접촉의 40% = $57,000
   - 실제로는 전체 매출의 40% 기여

2. **Phone (전화)의 역할**
   - 최종 마무리 역할 = $57,000
   - SMS/Google과의 협력 없으면 불가능

3. **SMS/Google의 협력 역할**
   - 중간 터치로 고객 유지 및 진행
   - 총 $49,875 기여 (33%)

---

## 🔄 실시간 Attribution 추적

### 데이터 파이프라인

```
CallLog / SMSLog / MailLog / WebEvent
     ↓
Contact.attributionPath 저장
{
  "touches": [
    { "channel": "facebook", "date": "2026-05-01", "type": "FIRST" },
    { "channel": "google", "date": "2026-05-03", "type": "MIDDLE" },
    { "channel": "sms", "date": "2026-05-05", "type": "MIDDLE" },
    { "channel": "phone", "date": "2026-05-07", "type": "LAST" }
  ],
  "model": "POSITION_BASED",
  "allocation": {
    "facebook": 0.40,
    "google": 0.067,
    "sms": 0.067,
    "phone": 0.40
  }
}
     ↓
매일 밤 배치: attributionAllocation 계산
     ↓
대시보드: 채널별 기여도 시각화
```

### SQL 쿼리 (월별 Attribution)

```sql
WITH contact_journeys AS (
  SELECT 
    c.id,
    c.conversionStatus,
    c.saleAmount,
    ARRAY_AGG(
      JSON_BUILD_OBJECT(
        'channel', t.channel,
        'date', t.created_at,
        'type', 
        CASE 
          WHEN ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY t.created_at) = 1 THEN 'FIRST'
          WHEN ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY t.created_at DESC) = 1 THEN 'LAST'
          ELSE 'MIDDLE'
        END
      ) ORDER BY t.created_at
    ) AS touches
  FROM Contact c
  LEFT JOIN (
    SELECT contactId, 'facebook' as channel, createdAt FROM FacebookPixel
    UNION
    SELECT contactId, 'google', createdAt FROM GoogleAnalytics
    UNION
    SELECT contactId, 'sms', createdAt FROM SMSLog
    UNION
    SELECT contactId, 'phone', createdAt FROM CallLog
  ) t ON t.contactId = c.id
  WHERE c.conversionStatus = 'SOLD'
    AND c.saleDate >= DATE_TRUNC('month', NOW())
  GROUP BY c.id, c.conversionStatus, c.saleAmount
)
SELECT 
  touches->0->>'channel' AS first_channel,
  touches->(ARRAY_LENGTH(touches, 1)-1)->>'channel' AS last_channel,
  COUNT(*) AS conversions,
  SUM(saleAmount) AS total_revenue
FROM contact_journeys
GROUP BY first_channel, last_channel;
```

---

## 🎯 마케팅 의사결정 활용

### Budget Allocation (예산 배분)

**Attribution 기반 재배분:**

```
현재 예산 분배:
Facebook: $300/월 (ROAS 42.75배)
Google: $150/월 (ROAS 38배)
SMS: $50/월 (Cost: 자동화)
Phone: $2,000/월 (Cost: 상담사)

Position-Based Attribution 결과:
Facebook: 40% 기여 → $300 → $300 (유지)
Google: 10% 기여 → $150 → $100 (감소)
SMS: 10% 기여 → $50 → $75 (증가)
Phone: 40% 기여 → $2,000 → $2,075 (증가)

권장 재배분 (월 +$25 추가):
Facebook: $300 → $375 (+25%, ROAS 40배+)
Google: $150 → $100 (-33%, ROAS 38배 유지 가능)
SMS: $50 → $100 (+100%, 자동화이므로 저비용)
Phone: $2,000 → $2,000 (유지)

예상 효과:
- Facebook 추가 투자 → +$10K 매출 (ROAS 증가)
- SMS 투자 → +$5K 매출 (자동화, 높은 ROI)
- Google 최적화 → CPA 유지하며 비용 감소
- 순 추가 수익: +$15K/월
```

---

## 📋 Attribution 검증 체크리스트

- [ ] 모든 터치포인트 추적 (Facebook, Google, SMS, Phone)
- [ ] Contact.attributionPath 자동 저장
- [ ] 월간 Attribution 리포트 자동 생성
- [ ] 채널별 기여도 대시보드 구현
- [ ] Budget Allocation 매월 검토
- [ ] A/B 테스트 결과와 연계
- [ ] CFO 월간 리포팅에 포함

---

**마비즈 CRM Attribution Modeling v1.0**
