# SMS Day 0-3 자동화 구현 가이드

## 개요

PASONA 4단계 + 에빙하우스 망각곡선 기반 SMS Day 0-3 자동화 시스템 구현

**기대 효과**: 콜 전환율 32% → SMS 자동화 포함 65% (+103%)

---

## 📚 기본 원리

### 에빙하우스 망각곡선 스케줄

| 단계 | 발송타이밍 | 기억곡선 | PASONA | 목표 응답율 |
|------|-----------|--------|--------|-----------|
| **Day 0** | 콜 후 2시간 | 50%→80% | P + A | 28-35% |
| **Day 1** | 다음날 10시 | 30%→70% | S | 18-25% |
| **Day 3** | 3일 후 14시 | 15%→75% | O + N | 15-20% |
| **Day 7** | 7일 후 10시 | 5% 재참여 | A(Follow) | 10-15% |

### 심리학 렌즈

- **L6 타이밍/손실회피**: 가격↑, 자리↓, 나이↑ 프레이밍
- **L10 즉시구매 클로징**: 삼중선택, 감정적 마무리
- **L8 재구매/습관화**: 가족추억, 아동성장 강조
- **L9 의료신뢰**: 의료진, 건강안심 강조

---

## 🔧 구현 구조

### 1. 데이터베이스 모델

**CrmMarketingMessage** 테이블

```
- id: 메시지 ID (cuid)
- contactId: 고객 ID (FK)
- organizationId: 조직 ID (FK)
- templateId: 템플릿 ID ("A1_default", "A2_variantb" 등)
- segment: 세그먼트 ("newlywed", "family", "couple")
- variant: A/B 변형 ("default", "variantb")
- day: 발송 Day (0, 1, 3, 7)
- scheduledTime: 예정 발송 시간
- sentTime: 실제 발송 시간
- status: "pending" → "sent" → "clicked" → "converted"
- content: SMS 콘텐츠 (변수 치환됨)
- psychologyLenses: ["L6", "L10"]
- clickCount: 클릭 횟수
- metadata: JSON (phase, ebbinghaus, emotionalTrigger 등)
```

### 2. API 라우트

#### POST `/api/sms/automation/schedule-day0-3`

콜 완료 후 Day 0-3 메시지 스케줄링

**요청**
```json
{
  "contactId": "contact_123",
  "organizationId": "org_456",
  "segment": "newlywed",
  "callTime": "2026-05-26T14:30:00Z",
  "firstName": "김태희"
}
```

**응답**
```json
{
  "status": "success",
  "messagesScheduled": 3,
  "messages": [
    {
      "id": "msg_001",
      "day": 0,
      "templateId": "A1_default",
      "scheduledTime": "2026-05-26T16:30:00Z",
      "status": "pending"
    },
    ...
  ]
}
```

#### GET `/api/sms/automation/send-scheduled`

Cron job (15분마다 실행)이 호출 → 스케줄 시간 도달 메시지 발송

**응답**
```json
{
  "success": true,
  "processedCount": 150,
  "sentCount": 145,
  "failedCount": 5,
  "details": [...]
}
```

#### POST `/api/sms/automation/track-click`

SMS 링크 클릭 추적

**요청**
```json
{
  "messageId": "msg_001",
  "contactId": "contact_123",
  "timestamp": "2026-05-26T14:45:00Z"
}
```

#### GET `/api/sms/automation/metrics`

대시보드 메트릭 조회

**요청**
```
GET /api/sms/automation/metrics?organizationId=org_456&days=7
```

**응답**
```json
{
  "totalSent": 450,
  "totalClicked": 135,
  "totalConverted": 65,
  "clickRate": "30%",
  "conversionRate": "14.4%",
  "byDay": {
    "0": { "sent": 150, "clicked": 45, "rate": "30%" },
    "1": { "sent": 150, "clicked": 33, "rate": "22%" },
    "3": { "sent": 150, "clicked": 53, "rate": "35%" }
  },
  "bySegment": {
    "newlywed": { "sent": 150, "clicked": 45, "converted": 20 },
    "family": { "sent": 150, "clicked": 52, "converted": 28 },
    "couple": { "sent": 150, "clicked": 38, "converted": 17 }
  },
  "abTestResults": {
    "default": { "clickRate": "28%", "conversionRate": "12%" },
    "variantb": { "clickRate": "32%", "conversionRate": "16%" }
  }
}
```

### 3. SMS 메시지 템플릿

`docs/sms-templates.json` (12개 템플릿)

```json
{
  "id": "A1_default",
  "segment": "newlywed",
  "day": 0,
  "variant": "default",
  "phase": "P_A",
  "content": "안녕하세요, {{firstName}}님!...",
  "psychology": ["L6_timing_loss_aversion", "L10_immediate_purchase"],
  "expectedClickRate": 0.30,
  "cta": { "text": "예약하기", "url": "/booking/quick-apply?..." }
}
```

---

## 🚀 배포 단계

### Step 1: 데이터베이스 마이그레이션

```bash
# Prisma 마이그레이션 생성
npx prisma migrate dev --name add_crm_marketing_message

# 또는 기존 마이그레이션 적용
npx prisma migrate deploy
```

### Step 2: 환경변수 설정

`.env.local` 또는 Vercel 설정에 추가:

```bash
# Cron 시크릿 (선택사항)
CRON_SECRET=your_secret_key_here

# Aligo SMS 설정 (기존)
ALIGO_KEY=...
ALIGO_USER_ID=...
```

### Step 3: 배포

```bash
# 로컬 테스트
npm run test:sms-automation

# Git에 커밋
git add .
git commit -m "feat(sms): SMS Day 0-3 자동화 구현"

# Vercel에 배포
git push origin main
```

### Step 4: Vercel Cron 확인

https://vercel.com/projects/YOUR_PROJECT/crons

- `/api/sms/automation/send-scheduled` - 15분마다 실행 확인

---

## 📊 사용 예시

### 1. 고객과 콜 완료 후 자동화 트리거

```typescript
// src/components/CallEndComponent.tsx

async function handleCallEnd(contactId: string, organizationId: string) {
  const response = await fetch('/api/sms/automation/schedule-day0-3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactId,
      organizationId,
      segment: contact.segment, // "newlywed" | "family" | "couple"
      callTime: new Date().toISOString(),
      firstName: contact.name.split(' ')[0]
    })
  });

  const result = await response.json();
  if (result.status === 'success') {
    alert(`✅ ${result.messagesScheduled}개 메시지 자동 스케줄됨`);
  }
}
```

### 2. SMS 클릭 추적 (링크에 매개변수 추가)

SMS에 포함된 CTA URL 예:
```
/booking/quick-apply?segment=newlywed&variant=A1_default&day=0&messageId=msg_123
```

링크 클릭 시:
```typescript
// src/app/booking/quick-apply/page.tsx

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const messageId = params.get('messageId');

  if (messageId) {
    fetch('/api/sms/automation/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        timestamp: new Date().toISOString()
      })
    });
  }
}, []);
```

### 3. 대시보드에서 메트릭 조회

```typescript
// src/components/SmsAutomationDashboard.tsx

const [metrics, setMetrics] = useState(null);

useEffect(() => {
  fetch(`/api/sms/automation/metrics?organizationId=${orgId}&days=7`)
    .then(r => r.json())
    .then(setMetrics);
}, [orgId]);

return (
  <div>
    <h3>총 발송: {metrics?.totalSent}</h3>
    <h3>클릭율: {metrics?.clickRate}</h3>
    <h3>전환율: {metrics?.conversionRate}</h3>
  </div>
);
```

---

## ✅ 검증 체크리스트

- [x] Prisma 모델 추가 (CrmMarketingMessage)
- [x] 마이그레이션 파일 생성
- [x] API 라우트 4개 구현 (schedule, send-scheduled, track-click, metrics)
- [x] SMS 템플릿 JSON (12개 메시지)
- [x] 유틸리티 함수 (계산, 로드, 변수치환)
- [x] Vercel Cron 설정 (15분 간격)
- [x] 테스트 스크립트
- [x] 심리학 렌즈 매핑 완료
- [x] A/B 테스트 50%/50% 자동 분배
- [x] 에빙하우스 일정 정확 계산

---

## 🔄 운영 절차

### 주간 리포팅

```sql
SELECT 
  day,
  segment,
  variant,
  COUNT(*) as sent_count,
  SUM(CASE WHEN "clickCount" > 0 THEN 1 ELSE 0 END) as clicked_count,
  SUM(CASE WHEN "conversionTime" IS NOT NULL THEN 1 ELSE 0 END) as converted_count
FROM "CrmMarketingMessage"
WHERE "organizationId" = $1
  AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY day, segment, variant
ORDER BY day, segment;
```

### A/B 테스트 우승자 선정

메트릭에서 각 Day별 variant의 전환율 비교:
- Default vs VariantB
- 더 높은 전환율의 변형을 프로덕션에 고정

### 메시지 최적화

낮은 클릭율 day/segment 조합:
- 콘텐츠 재검토
- 타이밍 조정
- 심리학 렌즈 변경

---

## 📞 FAQ

**Q: Day 1에서 아무 메시지도 발송되지 않는 경우?**
- Cron 실행 이력 확인
- DB에서 status='pending'인 메시지 확인
- Aligo SMS 설정 확인

**Q: 변수 치환이 안 되는 경우?**
- `{{firstName}}`이 정확한 케이스인지 확인
- 템플릿 로드 성공 여부 확인

**Q: 클릭 추적이 안 되는 경우?**
- URL에 messageId 파라미터 포함 확인
- track-click API 응답 확인

---

## 🎯 다음 단계

1. **Neon DB 마이그레이션** (기존 스키마 적용)
2. **테스트 고객 50명 × 3세그먼트** (150명) 선정
3. **Day 0-3 일정 자동화 검증** (7일 모니터링)
4. **A/B 테스트 결과 분석** (14일째)
5. **우승자 메시지 프로덕션 확대** (전체 고객군)

---

**최종 업데이트**: 2026-05-26
**상태**: ✅ Phase 2 (API & DB) 완료, Phase 3 (QA) 준비
**예상 효과**: 콜 32% → 65% 전환율 (+103%)
