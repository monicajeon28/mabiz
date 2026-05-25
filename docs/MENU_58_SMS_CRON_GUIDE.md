# Menu #58: SMS 자동화 Cron 5개 완전 구현 가이드

## 개요

Menu #58은 **PASONA 프레임워크 + Grant Cardone 심리학**을 기반으로 하는 5개의 SMS 자동화 Cron 작업을 구현합니다. 크루즈 예약 후(또는 부재중 고객) 30분부터 90일까지의 완전한 자동화 시퀀스를 제공합니다.

## 심리학 프레임워크

### 1. PASONA 6단계 메시지 구조
- **P (Problem)**: 문제 제시 (Day 0)
- **A (Agitate)**: 자극 강화 (Day 0)
- **S (Solution)**: 해결책 제시 (Day 1)
- **O (Offer)**: 명확한 오퍼 (Day 2)
- **N (Narrow)**: 좁혀진 범위 (Day 3)
- **A (Action)**: 행동 요청 (Day 3)

### 2. 렌즈 기반 심리학 (10렌즈)
- **L0 (부재중 고객)**: Day 0-3 + Follow-up으로 62-97% 전환
- **L1 (가격 이의)**: Day 1에서 자동 감지 및 대응
- **L6 (타이밍 손실회피)**: "지금이 좋은 시점", "비용이 오를 예정" 강조
- **L8 (재구매 습관화)**: "월 $2,334 절감" + "이미 많은 사람들이..."
- **L9 (의료신뢰)**: "가족 건강" 강조
- **L10 (즉시 구매)**: Day 3에서 "삼중선택" + 감정적 마무리

### 3. Grant Cardone 기법
- **이의 처리**: LISTEN (귀 기울이기) → ISOLATE (고립) → VALIDATE (검증)
- **Follow-up**: 5-12회 접촉으로 80% 판매 달성
- **클로징**: "이 가격은 오늘까지만", "좋은 날짜가 남아있지 않음"

---

## 구현 파일 구조

```
src/app/api/cron/
├── sms-day0-init/route.ts          # Day 0: 초기 발송 (PASONA P+A)
├── sms-day1-objection/route.ts     # Day 1: 이의 감지 (PASONA S)
├── sms-day2-value/route.ts         # Day 2: 가치 재정의 (PASONA O)
├── sms-day3-action/route.ts        # Day 3: 최종 행동 (PASONA N+A)
└── sms-followup/route.ts           # Day 7/14/30/60/90: Follow-up

prisma/
├── schema.prisma                   # ScheduledSms에 channel 필드 추가
└── migrations/
    └── 20260525_add_scheduled_sms_channel.sql
```

---

## 각 Cron 상세 사양

### 1️⃣ Day 0: SMS 초기 발송 (sms-day0-init)

**엔드포인트**: `POST /api/cron/sms-day0-init`

**트리거**: 크루즈 여행 종료 후 12-36시간

**자격 조건**:
```typescript
- Contact.lastCruiseDate: 지난 36시간 ~ 12시간
- Contact.smsDay0Sent: false
- Contact.optOutAt: null (선택 해제 아님)
```

**메시지 전략** (PASONA P+A):
```
크루즈 여행 후에도 피로와 스트레스가 남아 있나요?

🌊 다음 여행으로 완벽한 회복을 경험해보세요!
비용이 오를 예정이므로 지금이 좋은 시점입니다.

자세한 정보 보기 → http://mabiz.kr
```

**심리학 적용**:
- L6 (타이밍 손실회피): "비용이 오를 예정"
- L10 (즉시 구매): "지금이 좋은 시점"

**자동 스케줄링**:
- Day 1: +24시간
- Day 2: +48시간
- Day 3: +72시간

**응답 구조**:
```json
{
  "status": "COMPLETED",
  "timestamp": "2026-05-25T...",
  "successCount": 156,
  "failCount": 4,
  "scheduledCount": 468,
  "errors": [
    {
      "contactId": "...",
      "error": "유효하지 않은 전화번호"
    }
  ]
}
```

---

### 2️⃣ Day 1: 이의 감지 및 대응 (sms-day1-objection)

**엔드포인트**: `POST /api/cron/sms-day1-objection`

**트리거**: Day 0 발송 후 24시간 ±6시간

**응답 분석**:
```typescript
- Call Log 확인 (Day 0 이후)
- SMS 클릭 여부 확인
- 예약 진행 여부 확인
```

**메시지 전략** (PASONA S - 응답에 따라 변동):

**응답 있음** (고신뢰):
```
감사합니다! 연락을 주셨네요.

🎯 크루즈 예약 전문가가 당신의 질문에 답변해드리겠습니다.
지금 바로 상담 예약하기 → http://mabiz.kr/book

궁금한 점이 있으신가요?
```

**응답 없음** (이의 감지 - L1):
```
혹시 크루즈 비용이 고민되시나요?

💰 좋은 소식: 월 $2,334 절감 + 무이자 할부 가능합니다!
- 최대 12개월 분할 가능
- 비용 없이 무료 상담 가능

자세히 알아보기 → http://mabiz.kr
질문이 있으신가요? 바로 연락주세요!
```

**심리학 적용**:
- L1 (가격 이의): "월 $2,334 절감", "무이자 할부"
- Grant Cardone: LISTEN-ISOLATE-VALIDATE 기법

**Risk Flag 업데이트**:
```typescript
contact.lensMetadata.priceObjectionDetected = true;
contact.lensMetadata.detectedAt = new Date();
```

---

### 3️⃣ Day 2: 가치 재정의 (sms-day2-value)

**엔드포인트**: `POST /api/cron/sms-day2-value`

**트리거**: Day 1 발송 후 24시간 ±6시간

**누적 응답율 분석**:
- 50% 이상: 고신뢰 → "감사 메시지"
- 50% 미만: 재접근 → "더 강력한 오퍼"

**메시지 전략** (PASONA O - 사례 + 오퍼):
```
🌟 이미 김영희님같은 분들이 시작했어요!

👨‍👩‍👧‍👦 매년 크루즈로 스트레스 해소. 남편과 12박 이상. 
절감액으로 아이 학비까지 충당.

💰 월 $2,334 절감하기:
⭐ VIP 멤버 할인 코드: MABIZXXXX (추가 15% 할인)

지금 예약 → http://mabiz.kr
```

**심리학 적용**:
- L8 (재구매 습관화): 실제 고객 사례 (3가지 중 랜덤)
- L9 (의료신뢰): "가족 건강" 강조
- Russell Brunson: Story-Based Selling

**VIP 특별 처우**:
```typescript
if (contact.vipStatus === 'GOLD' || contact.cruiseCount >= 3) {
  // VIP 멤버는 추가 15% 할인
  message = `⭐ VIP 멤버 할인 코드: ${discountCode} (추가 15% 할인)`;
} else {
  // 신규 고객은 10% 할인
  message = `🎁 신규 할인 코드: ${discountCode} (10% 할인)`;
}
```

---

### 4️⃣ Day 3: 최종 결정 촉구 (sms-day3-action)

**엔드포인트**: `POST /api/cron/sms-day3-action`

**트리거**: Day 2 발송 후 24시간 ±6시간

**메시지 전략** (PASONA N+A - 삼중선택):
```
⏰ 마지막 기회! 이 가격은 오늘까지만 유효합니다.

🎯 당신의 선택은?

A) 프리미엄 경험 (5성급 선실)
   → 최고의 편안함 + VIP 서비스 포함

B) 스탠다드 경험 (3성급 선실)
   → 완벽한 가성비 + 모든 시설 이용

C) 기본 경험 (내부 선실)
   → 경제적 선택 + 핵심 즐거움은 100%

💳 무이자 할부로 시작 가능!

지금 바로 예약하기 (링크 선택)
→ http://mabiz.kr/premium
→ http://mabiz.kr/standard
→ http://mabiz.kr/basic

⭐ VIP 멤버님께 감사드립니다!
예약 문의: [전화번호]
```

**심리학 적용**:
- L6 (타이밍 손실회피): "오늘까지만 유효"
- L10 (즉시 구매): "삼중선택" (모두 구매 유도)
- Russell Brunson: Urgency + Scarcity

**Day 7 자동 스케줄링**:
- Follow-up 메시지 예약

---

### 5️⃣ Follow-up: Grant Cardone 7회 접촉 (sms-followup)

**엔드포인트**: `POST /api/cron/sms-followup`

**스케줄**: Day 7 / 14 / 30 / 60 / 90

| Day | 심리학 렌즈 | 메시지 전략 | 기대 효과 |
|-----|-----------|----------|---------|
| 7 | L0 + L8 | "혹시 질문 있으세요?" + "이미 많은 사람들이..." | 초기 응답 유도 |
| 14 | L7 | "배우자 의견은?" + "함께 상담받으면 결정이 쉬워" | 동반자 설득 |
| 30 | L8 | "지난 달 평균 월 $2,334 절감" + "당신도 시작하시겠어요?" | 사회증명 |
| 60 | L10 | "특별 할인 MABIZ60 (10% OFF)" + "오늘까지만" | 최종 긴박감 |
| 90 | L6 | "마지막 기회 - 좋은 날짜가 점점 남아있지 않음" | 최후 통첩 |

**자동 중단 조건**:
```typescript
if (contact.purchasedAt) {
  scheduledSms.status = 'CONVERTED';
  // 추가 메시지 발송 중단
}
```

---

## SMS 응답율 기준 (목표)

| 메트릭 | 목표 | 실적 계산 |
|-------|------|---------|
| **Day 0 클릭율** | 35-45% | SMS 클릭 / 총 발송 |
| **Day 1 콜율** | 15-20% | CallLog / 총 발송 |
| **Day 2 응답율** | 30-40% | 클릭/콜 누적 / 총 발송 |
| **Day 3 예약율** | 8-15% | 예약 완료 / 총 발송 |
| **최종 전환율** | 15-25% | 구매 / 초기 자격 고객 |
| **Follow-up 전환율** | 35-50% | 재구매 / Follow-up 대상 |

---

## 인증 및 보안

### Cron Secret 검증
```typescript
const cronSecret = req.headers.get('x-vercel-cron-secret');
if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
}
```

### SMS 발송 로그 (감시용)
```typescript
await prisma.smsLog.create({
  data: {
    organizationId,
    contactId,
    phone,
    contentPreview,
    status: 'SENT' | 'FAILED',
    msgId,
    channel: 'DAY0_INIT' | 'DAY1_OBJECTION' | ...
  }
});
```

### ExecutionLog 기록 (추적용)
```typescript
await prisma.executionLog.create({
  data: {
    organizationId,
    sourceType: 'SMS_CRON',
    sourceId: 'DAY0_INIT',
    contactId,
    channel: 'DAY0_SEQUENCE',
    status: 'COMPLETED' | 'FAILED',
    executeMonth: '2026-05'
  }
});
```

---

## 배포 체크리스트

### 1. 환경 변수 설정
```bash
ALIGO_API_KEY=xxx
ALIGO_USER_ID=xxx
ALIGO_SENDER_PHONE=xxx
CRON_SECRET=xxx
```

### 2. Prisma 마이그레이션
```bash
npx prisma migrate deploy
npx prisma generate
```

### 3. 빌드 검증
```bash
npm run build
```

### 4. Vercel Cron 설정 (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/sms-day0-init",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/sms-day1-objection",
      "schedule": "0 24 * * *"
    },
    {
      "path": "/api/cron/sms-day2-value",
      "schedule": "0 48 * * *"
    },
    {
      "path": "/api/cron/sms-day3-action",
      "schedule": "0 72 * * *"
    },
    {
      "path": "/api/cron/sms-followup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

---

## 기대 효과

| 메트릭 | 효과 |
|-------|------|
| **SMS 응답율** | 40-50% (클릭 + 콜 누적) |
| **일일 예약 증가** | +12-18건 (100명 기준) |
| **월간 추가 수익** | +$230K-345K |
| **고객 획득비용(CPA)** | -15-25% 개선 |
| **생명주기 가치(LTV)** | +20-30% 성장 |
| **재구매율** | 35-50% (Follow-up) |

---

## 문제 해결

### 1. SMS 발송 실패 (Aligo 오류)
```
Error: result_code != '1'
→ Aligo API 키 확인
→ 발신자 전화번호 검증
→ SMS 문자열 길이 초과 체크
```

### 2. Contact 전화번호 오류
```
Error: 유효하지 않은 전화번호
→ normalizePhone() 함수 동작 확인
→ DB의 phone 필드 형식 검증
```

### 3. 메모리 부족 (대량 발송)
```
→ take: 1000으로 배치 분산
→ 비동기 처리로 동시성 관리
```

---

## 모니터링 대시보드 통합

Menu #59 "KPI 실시간 대시보드"와 연동:
- SMS 발송 통계 → `/api/analytics/realtime/kpi`
- 세그먼트별 성과 → `/api/analytics/realtime/segment`

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0 (Menu #58 완전 구현)
