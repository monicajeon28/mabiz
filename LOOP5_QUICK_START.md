# Loop 5-D 빠른 시작 가이드

## 📋 구현된 것

### 1️⃣ SMS 서비스 (`src/lib/loop5-sms-service.ts`)
```typescript
import { 
  generateDayNMessage,
  sendDay0Sms, sendDay1Sms, sendDay2Sms, sendDay3Sms,
  retryFailedLoop5Sms 
} from '@/lib/loop5-sms-service';

// 메시지 생성
const msg = generateDayNMessage('A', 0, 'a', '김철수');
// "김철수님, 크루즈닷이에요. 신혼부부를 위한 특별한 제안입니다..."

// Day 0 SMS 발송
const result = await sendDay0Sms(
  'org_123',        // organizationId
  'contact_456',    // contactId
  'A',              // segment
  '010-1234-1234',  // phoneNumber
  '김철수',         // contactName
  'a'               // variant
);
// { success: true, smsId: 'msg_...', retryable: false }
```

### 2️⃣ Email 서비스 (`src/lib/loop5-email-service.ts`)
```typescript
import { 
  sendDay0Email, 
  sendDay2Email 
} from '@/lib/loop5-email-service';

// Day 0 환영 이메일
await sendDay0Email(
  'org_123',
  'contact_456',
  'kim@example.com',
  'A',
  '김철수',
  'a'
);

// Day 2 긴박감 이메일
await sendDay2Email(
  'org_123',
  'contact_456',
  'kim@example.com',
  'A',
  '김철수',
  'a'
);
```

### 3️⃣ Contact Form Webhook

```
POST /api/webhook/loop5-contact-form

{
  "name": "김철수",
  "phone": "01012341234",
  "email": "kim@example.com",
  "ageRange": "40-50",
  "preferenceType": "family",
  "organizationId": "org_123",
  "variant": "a"
}

응답:
{
  "ok": true,
  "contactId": "cuid_...",
  "segment": "B",
  "variant": "a",
  "smsId": "msg_...",
  "emailSent": true,
  "message": "신청 완료!"
}
```

### 4️⃣ Cron Jobs (자동 발송)

```bash
# Day 1 (24시간 후)
GET /api/cron/loop5-day1-sender
Authorization: Bearer $CRON_SECRET

# Day 2 (48시간 후)
GET /api/cron/loop5-day2-sender
Authorization: Bearer $CRON_SECRET

# Day 3 (72시간 후)
GET /api/cron/loop5-day3-sender
Authorization: Bearer $CRON_SECRET
```

### 5️⃣ 성과 조회 API

```
GET /api/loop5/sms-stats?organizationId=org_123&days=7

응답:
{
  "totalSent": 847,
  "totalDelivered": 824,
  "successRate": 97.3,
  "byDay": {
    0: {sent: 200, delivered: 195, rate: 97.5},
    1: {sent: 200, delivered: 198, rate: 99.0},
    2: {sent: 200, delivered: 194, rate: 97.0},
    3: {sent: 247, delivered: 237, rate: 96.0}
  },
  "bySegment": {
    A: {sent: 170, delivered: 165, rate: 97.1},
    B: {sent: 168, delivered: 165, rate: 98.2},
    // ...
  },
  "responseRate": 35.2,
  "conversionRate": 12.1
}
```

---

## 🚀 배포 절차

### 1단계: 환경 변수 설정

```env
# .env.local

# Aligo SMS
ALIGO_API_KEY=your_api_key_here
ALIGO_USER_ID=your_user_id_here
ALIGO_SENDER_PHONE=010-xxxx-xxxx

# SMTP Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Cron 보안
CRON_SECRET=your_secure_cron_secret_here

# Email Encryption
EMAIL_ENCRYPT_KEY=your_32_char_encryption_key_here
```

### 2단계: Prisma Migration

```bash
# 1. 스키마 확인
npx prisma validate

# 2. Migration 생성 (DB 연결 필요)
npx prisma migrate dev --name "loop5_sms_automation"

# 3. Prisma Client 생성
npx prisma generate
```

### 3단계: SMS 발송 테스트

```bash
# curl로 Contact Form 제출 테스트
curl -X POST http://localhost:3000/api/webhook/loop5-contact-form \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트 사용자",
    "phone": "01012341234",
    "email": "test@example.com",
    "ageRange": "40-50",
    "preferenceType": "family",
    "organizationId": "org_test_123",
    "variant": "a"
  }'
```

### 4단계: Cron Job 스케줄 설정 (Vercel/Hosting)

배포 플랫폼의 Cron 설정에 추가:

```
Day 1: 0 9 * * * (매일 09:00 UTC)
  GET /api/cron/loop5-day1-sender
  Header: Authorization: Bearer $CRON_SECRET

Day 2: 0 17 * * * (매일 17:00 UTC)
  GET /api/cron/loop5-day2-sender
  Header: Authorization: Bearer $CRON_SECRET

Day 3: 0 1 * * * (매일 01:00 UTC)
  GET /api/cron/loop5-day3-sender
  Header: Authorization: Bearer $CRON_SECRET
```

### 5단계: 모니터링 대시보드 설정

Dashboard에서 실시간 모니터링:
```
GET /api/loop5/sms-stats?organizationId=YOUR_ORG_ID&days=7
```

---

## 📊 Segment 분류 매핑

```typescript
const ageRanges = ['20-30', '40-50', '50-60', '60+', '70+'];
const preferences = ['romance', 'family', 'culture', 'luxury', 'health'];

// 자동 분류 규칙
{
  '20-30': { romance: 'A', family: 'B', culture: 'B', luxury: 'B', health: 'A' },
  '40-50': { romance: 'B', family: 'B', culture: 'C', luxury: 'D', health: 'B' },
  '50-60': { romance: 'C', family: 'B', culture: 'C', luxury: 'D', health: 'C' },
  '60+': { romance: 'D', family: 'B', culture: 'C', luxury: 'D', health: 'E' },
  '70+': { romance: 'E', family: 'E', culture: 'E', luxury: 'E', health: 'E' }
}
```

---

## 🔄 전체 흐름

```
사용자가 폼 제출
    ↓
/api/webhook/loop5-contact-form (자동)
    ├─ Segment 분류 (A-E)
    ├─ Contact 생성
    ├─ Day 0 SMS 발송 (즉시)
    └─ Day 0 Email 발송 (즉시)

[24시간 후]
    ↓
Cron: /api/cron/loop5-day1-sender (자동)
    └─ Day 1 SMS 일괄 발송

[48시간 후]
    ↓
Cron: /api/cron/loop5-day2-sender (자동)
    ├─ Day 2 SMS 일괄 발송
    └─ Day 2 Email 일괄 발송

[72시간 후]
    ↓
Cron: /api/cron/loop5-day3-sender (자동)
    └─ Day 3 SMS 일괄 발송 (최종 클로징)

[계속 모니터링]
    ↓
Dashboard: /api/loop5/sms-stats
    └─ 실시간 성과 추적
```

---

## 🧪 테스트 체크리스트

- [ ] Contact Form 제출 → SMS 즉시 발송
- [ ] Contact Form 제출 → Email 즉시 발송
- [ ] Day 1 Cron 수동 실행 → SMS 발송
- [ ] Day 2 Cron 수동 실행 → SMS + Email 발송
- [ ] Day 3 Cron 수동 실행 → SMS 발송
- [ ] 성과 API 호출 → 정확한 통계 반환
- [ ] Segment별 메시지 검증 (5가지)
- [ ] A/B Variant 검증 (variant a vs b)
- [ ] 에러 처리 (잘못된 폰번, 이메일)
- [ ] 재시도 로직 (PENDING → 재발송)

---

## 📞 문제 해결

### SMS가 발송되지 않음

```bash
# 1. Aligo 계정 확인
echo $ALIGO_API_KEY
echo $ALIGO_USER_ID

# 2. 크레딧 확인
# Aligo 관리자 페이지 → 크레딧 조회

# 3. 로그 확인
# /src/app/api/webhook/loop5-contact-form console.log 추가

# 4. PartnerSmsLog 상태 확인
SELECT * FROM "PartnerSmsLog" 
WHERE organizationId = 'org_123' 
ORDER BY createdAt DESC 
LIMIT 10;
```

### Email이 발송되지 않음

```bash
# 1. SMTP 설정 확인
echo $SMTP_HOST
echo $SMTP_USER

# 2. Email 암호화 키 확인
echo $EMAIL_ENCRYPT_KEY # 32자 이상

# 3. OrgEmailConfig 확인
SELECT * FROM "OrgEmailConfig" 
WHERE organizationId = 'org_123';
```

### Cron Job이 실행되지 않음

```bash
# 1. CRON_SECRET 확인
echo $CRON_SECRET

# 2. Authorization 헤더 확인
curl -X GET http://localhost:3000/api/cron/loop5-day1-sender \
  -H "Authorization: Bearer incorrect_secret"
# 401 Unauthorized 응답 확인

# 3. Cron 스케줄 확인 (배포 플랫폼)
```

---

## 📈 성과 목표 재확인

| 메트릭 | 목표 |
|--------|------|
| SMS 응답율 | 30% → 40% |
| Day 0-3 자동화율 | 100% |
| SMS 도달률 | 98%+ |
| Segment 맞춤화 | 5가지 (A-E) |
| A/B 테스트 | 2가지 variant (a, b) |

---

## 🔗 관련 문서

- [`LOOP5_IMPLEMENTATION_SUMMARY.md`](./LOOP5_IMPLEMENTATION_SUMMARY.md) - 전체 구현 상세
- [`src/lib/loop5-sms-service.ts`](./src/lib/loop5-sms-service.ts) - SMS 서비스
- [`src/lib/loop5-email-service.ts`](./src/lib/loop5-email-service.ts) - Email 서비스
- [`src/app/api/webhook/loop5-contact-form/route.ts`](./src/app/api/webhook/loop5-contact-form/route.ts) - Webhook

---

**마지막 업데이트**: 2026-05-28  
**상태**: ✅ 프로덕션 준비 완료 (migration 제외)
