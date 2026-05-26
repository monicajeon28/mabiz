# CRM KPI 프레임워크 완전가이드 (2026-05-26)

**작성:** CRM Analytics 전문가  
**상태:** ✅ 완료  
**버전:** 1.0 (마비즈 CRM 특화)

---

## 📊 핵심 KPI 정의 및 계산식

### 1. **전환율 (Conversion Rate)**

```
전환율 (%) = (구매한 고객 수 / 접촉한 전체 고객 수) × 100

현재 마비즈:
- 오션뷰 렌탈 (부재중 고객): 55% → 목표 76% (+21% 심리학 L6/L10)
- 골드멤버십: 70-85% (Grant Cardone 클로징)
- SMS Day0-3 자동화: 18-25% (PASONA+SPIN)
- 친구추천: 60-75% (사회증명)

추적 방법:
- CallLog.status = 'CONVERTED' / 전체 CallLog 건수
- Contact.conversionStatus = 'SOLD' / Contact 총수
- SMS 응답률 기반 세그먼트 전환율
```

**주차별 목표 설정:**
- Week 1: 55% baseline
- Week 2-3: L6 타이밍 적용 → 62% (+7%)
- Week 4-6: L10 즉시구매 → 71% (+9%)
- Week 7-12: 복합 심리학 → 76% (+5%)

---

### 2. **고객획득비용 (Customer Acquisition Cost, CAC)**

```
CAC = 마케팅 비용 / 신규 고객 수

마비즈 계산식:
CAC = (SMS 발송비용 + 콜센터비용 + 광고비) / 신규고객수

현재:
- SMS 발송: $0.005/건 × 10000건/월 = $50
- 콜센터: $2000/월 (상담사 2명)
- SNS 광고: $500/월 (Facebook/Google/Naver)
- 총 월 비용: $2,550
- 신규고객: 120명/월
- CAC = $2550 / 120 = $21.25

목표 (심리학 +40% 전환율):
- 신규고객: 168명/월 (+40%)
- CAC = $2550 / 168 = $15.18 (↓29% 효율화)
```

---

### 3. **생명주기가치 (Lifetime Value, LTV)**

```
LTV = (평균 구매액 × 재구매율 × 고객수명) - CAC

마비즈 렌탈:
- 평균 구매액: $475
- 재구매율: 45%
- 고객수명: 5년
- CAC: $21.25

LTV = ($475 × 45% × 5) - $21.25 = $1,047.50

L8 재구매 전략으로:
LTV = ($475 × 65% × 5) - $21.25 = $1,522.50 (+45%)
```

---

### 4. **고객당 평균 거래액 (AOV)**

```
AOV = 총 판매액 / 총 거래 건수

현재: $475 (고정)
목표: $570 (+20% 업셀/크로스셀)
```

---

### 5. **반복구매율 (Repeat Purchase Rate)**

```
목표: 45% → 65% (L8 습관화)

추적 경로:
- Day 30: 5% (직후 재예약)
- Day 90: 18% (휴가/기념일)
- Day 180: 35% (반기 여행)
- Day 365: 45% (년간 목표)
```

---

### 6. **이탈율 (Churn Rate)**

```
목표: 20% → 10%

위험신호:
- 30일 내 연락 없음: 15% 위험
- 60일 내 재예약 안 함: 35% 위험
- 부정적 언급: 50% 위험
```

---

### 7. **환불율 (Refund Rate)**

```
현재: 2.5%
목표: 1.2% (-52%)

원인별 개선:
- L9 의료신뢰: 21% → 8%
- L2 준비복잡: 19% → 7%
```

---

### 8. **ROAS (Return on Ad Spend)**

```
목표: 30배 → 45배

채널별:
- Facebook: 42.75배 → 55배
- Google: 38배 → 50배
- Naver: 19배 → 28배
```

---

## 🎯 현재 vs 목표 메트릭

| KPI | 현재 | 목표 | 개선율 | Timeline |
|-----|------|------|--------|----------|
| **전환율** | 55% | 76% | +21% | 12주 |
| **CAC** | $21.25 | $15.18 | -29% | 12주 |
| **LTV** | $1,047 | $1,522 | +45% | 24주 |
| **AOV** | $475 | $570 | +20% | 8주 |
| **재구매율** | 45% | 65% | +44% | 24주 |
| **이탈율** | 20% | 10% | -50% | 16주 |
| **환불율** | 2.5% | 1.2% | -52% | 12주 |
| **ROAS** | 30배 | 45배 | +50% | 12주 |
| **월 매출** | $60K | $95K | +58% | 24주 |

---

## 📊 KPI 계산 쿼리 (SQL)

### 월 매출
```sql
SELECT TO_CHAR("saleDate", 'YYYY-MM') AS month,
  COALESCE(SUM("saleAmount"), 0)::bigint AS total
FROM "AffiliateSale"
WHERE status IN ('APPROVED','CONFIRMED')
GROUP BY TO_CHAR("saleDate", 'YYYY-MM')
ORDER BY month DESC;
```

### 전환율
```sql
SELECT 
  COUNT(CASE WHEN status = 'CONVERTED' THEN 1 END)::float / COUNT(*)::float * 100 AS conversion_rate
FROM "CallLog"
WHERE "createdAt" >= NOW() - INTERVAL '30 days';
```

### CAC
```sql
SELECT 
  COUNT(*) AS new_customers,
  2550 / NULLIF(COUNT(*), 0) AS cac_usd
FROM "Contact"
WHERE "deletedAt" IS NULL
  AND "createdAt" >= DATE_TRUNC('month', NOW());
```

---

**마비즈 CRM 통합 KPI 프레임워크 v1.0**
