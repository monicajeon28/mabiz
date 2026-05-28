# Loop 6 - Agent D: 빠른 시작 가이드 (2026-05-28)

**대상**: 엔지니어, QA, 배포 담당자  
**소요 시간**: 10분 (배포) + 5분 (테스트)

---

## ⚡ 5분 통합 가이드

### 1단계: 환경 변수 설정

**.env.local 또는 .env.production** 에 추가:

```bash
# Webhook 서명 (선택, 없으면 검증 스킵)
WEBHOOK_SECRET=your-webhook-secret-here

# SMS 설정 (Loop 5에서 상속)
ALIGO_API_KEY=your-aligo-key
ALIGO_USER_ID=your-aligo-user-id
ALIGO_SENDER_PHONE=02-1234-5678
```

### 2단계: 크루즈닷몰 Webhook 설정

**크루즈닷몰 관리자 → Webhook 설정**:

```
URL: https://your-domain.com/api/webhook/cruisedot-payment
Method: POST
Content-Type: application/json
```

### 3단계: cURL 테스트

```bash
curl -X POST http://localhost:3000/api/webhook/cruisedot-payment \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "payment_123",
    "customer_name": "김철수",
    "customer_phone": "010-1234-5678",
    "customer_email": "kim@example.com",
    "customer_age": 45,
    "cruise_type": "europe",
    "departure_date": "2026-06-15",
    "cabin_price": 2500,
    "cabin_type": "balcony"
  }'
```

**예상 응답**:
```json
{
  "success": true,
  "contactId": "cly9ab1de2f",
  "day0SmsSent": true,
  "processingTime": 245
}
```

---

## 📊 성과 지표

| 지표 | 목표 |
|------|------|
| Contact 자동생성율 | 95%+ |
| Day 0 SMS 발송율 | 95%+ |
| Webhook 응답시간 | <500ms |
| 에러율 | <1% |

---

**배포 준비 완료!**
