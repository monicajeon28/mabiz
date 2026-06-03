# AutoFeedbackGenerator API 명세서

## 개요
`POST /api/tools/auto-feedback`는 Contact의 렌즈(L0-L10)를 감지하고, PASONA Day 0-3 SMS 시퀀스를 자동으로 생성하여 `ScheduledSms`에 등록하는 API입니다.

**파일**: `src/app/api/tools/auto-feedback/route.ts` (315줄)

---

## 요청 명세

### Endpoint
```
POST /api/tools/auto-feedback
```

### 헤더
- **Authorization**: Bearer token (getAuthContext 자동 추출)
- **x-user-role**: AGENT, OWNER, GLOBAL_ADMIN (FREE_SALES 제외)
- **x-org-id**: Organization ID

### Body
```json
{
  "contactId": "cuid_format_id",
  "dryRun": false
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `contactId` | string | ✅ | Contact ID |
| `dryRun` | boolean | ❌ | true면 미리보기만 (DB 저장 X) |

---

## 응답 명세

### 성공 (dryRun=false)
```json
{
  "ok": true,
  "lens": "L6",
  "confidenceScore": 0.87,
  "smsCount": 4,
  "created": [
    {
      "id": "sms_cuid_1",
      "day": 0,
      "phase": "P_A",
      "tone": "urgent",
      "scheduledAt": "2026-06-03T10:02:00.000Z",
      "status": "PENDING"
    },
    {
      "id": "sms_cuid_2",
      "day": 1,
      "phase": "S",
      "tone": "empathetic",
      "scheduledAt": "2026-06-04T10:30:00.000Z",
      "status": "PENDING"
    },
    // ...day 2, day 3
  ]
}
```

### 성공 (dryRun=true, 미리보기)
```json
{
  "ok": true,
  "dryRun": true,
  "lens": "L6",
  "confidenceScore": 0.87,
  "messages": [
    {
      "day": 0,
      "phase": "P_A",
      "tone": "urgent",
      "expectedMetric": "open_rate",
      "expectedRate": 0.65,
      "scheduledAt": "2026-06-03T10:02:00.000Z",
      "message": "고객님, 최근에 저희와 연락이 끊긴 지 7일이 지났습니다. [본문]"
    }
    // ...day 1, 2, 3
  ],
  "schedule": [
    {
      "day": 0,
      "delayMinutes": 120,
      "label": "P (절박감) + A (공감)",
      "phase": "P_A"
    }
    // ...day 1, 3, 7
  ]
}
```

### 에러 응답

#### 1. 권한 없음 (403)
```json
{
  "ok": false,
  "message": "권한이 없습니다."
}
```

#### 2. 필수 필드 누락 (400)
```json
{
  "ok": false,
  "message": "contactId는 필수입니다."
}
```

#### 3. Contact 찾을 수 없음 (404)
```json
{
  "ok": false,
  "message": "고객을 찾을 수 없거나 권한이 없습니다."
}
```

#### 4. SMS 거부 (400) - GDPR
```json
{
  "ok": false,
  "message": "해당 고객은 SMS 수신을 거부하셨습니다.",
  "code": "SMS_OPT_OUT"
}
```

#### 5. 중복 SMS (400)
```json
{
  "ok": false,
  "message": "이미 SMS가 예약되어 있습니다.",
  "code": "SMS_ALREADY_SCHEDULED"
}
```

#### 6. 렌즈 감지 실패 (500)
```json
{
  "ok": false,
  "message": "고객 분석에 실패했습니다. 관리자에게 문의하세요.",
  "code": "LENS_DETECTION_FAILED"
}
```

#### 7. PASONA 템플릿 없음 (404)
```json
{
  "ok": false,
  "message": "렌즈 L6에 대한 PASONA 템플릿이 없습니다.",
  "code": "NO_TEMPLATE_FOR_LENS"
}
```

#### 8. 메시지 생성 실패 (500)
```json
{
  "ok": false,
  "message": "메시지 생성에 실패했습니다.",
  "code": "SEQUENCE_GENERATION_FAILED"
}
```

#### 9. DB 저장 실패 (500)
```json
{
  "ok": false,
  "message": "메시지 저장에 실패했습니다.",
  "code": "DATABASE_ERROR"
}
```

---

## 파이프라인 상세 설명

### 1단계: 인증 (getAuthContext)
- `x-user-role` 검증: FREE_SALES 제외
- `x-org-id` 추출: Organization 격리

### 2단계: Contact 조회 (buildContactWhere)
- 권한: Manager는 자신의 Contact만
- Admin/Owner는 조직 전체
- **선택 필드**: id, name, organizationId, lastContactedAt, optOutAt

### 3단계: GDPR 검증
- `contact.optOutAt` 확인
- SMS 거부 고객은 400 + SMS_OPT_OUT 반환

### 4단계: 중복 SMS 확인
- **조건**: contactId 동일 + status IN ["PENDING", "RETRY"] + createdAt >= 24시간 이내
- 중복 발견 시 400 + SMS_ALREADY_SCHEDULED 반환

### 5단계: 렌즈 감지 (LensDetectionEngine)
- **ONE-TIME**: 기존 렌즈가 있으면 재감지 X (일관성 보장)
- 렌즈 없으면 500 + LENS_DETECTION_FAILED 반환
- primaryLens = null이면 400 + LENS_NOT_DETERMINED 반환

### 6단계: PASONA 생성 (getPasonaTemplate)
- **Day**: [0, 1, 2, 3]
- **Ebbinghaus 망각곡선 기반**:
  - Day 0: 2시간 후 (P_A: Problem + Agitate)
  - Day 1: 다음날 10시간 후 (S: Solution)
  - Day 2: 2일 후 14시간 (O_N: Offer + Narrow)
  - Day 3: 3일 후 14시간 (O_N: Offer + Narrow)

### 7단계: 변수 치환 (personalize)
**기본 변수**:
- `{{name}}` → contact.name (기본값: "고객")
- `{{daysSince}}` → days since lastContactedAt

**보험 변수** (없으면 안전한 기본값 사용):
- `{{discount}}` → "15" (%)
- `{{remaining}}` → "소수" (개)
- `{{hours}}` → "24" (시간)
- `{{link}}` → "" (Empty safe)

### 8단계: 메시지 유효성 검증
- 메시지 길이 > 0
- phase, tone, expectedMetric, expectedRate 기본값 적용
- 모든 템플릿이 null이면 404 + NO_TEMPLATE_FOR_LENS

### 9단계: dryRun 분기
- **dryRun=true**: 미리보기만 반환 (DB 저장 X)
- **dryRun=false**: ScheduledSms 4개 트랜잭션 등록

### 10단계: ScheduledSms 등록 (트랜잭션)
```typescript
prisma.$transaction([
  { contactId, message, scheduledAt, status: "PENDING", channel: "FUNNEL", createdByUserId },
  // ... day 1, 2, 3
])
```

### 11단계: 로깅 및 응답
- 성공 로그: contactId, lens, confidenceScore, count, days[]
- 응답: created 배열 (id, day, phase, tone, scheduledAt, status)

---

## 보안 설계

| 요구사항 | 구현 방식 |
|---------|---------|
| **권한 제어** | buildContactWhere(ctx) 자동 격리 |
| **GDPR** | optOutAt 체크 + SMS_OPT_OUT 반환 |
| **PII 보호** | 변수 치환만 (암호화 미적용, 필요시 추후) |
| **중복 방지** | 24시간 내 PENDING/RETRY SMS 체크 |
| **멱등성** | 4개 SMS atomic 트랜잭션 |

---

## 사용 예시

### cURL
```bash
curl -X POST http://localhost:3000/api/tools/auto-feedback \
  -H "Authorization: Bearer token" \
  -H "x-user-role: AGENT" \
  -H "x-org-id: org_abc123" \
  -H "Content-Type: application/json" \
  -d '{"contactId": "contact_xyz789", "dryRun": false}'
```

### JavaScript/Fetch
```javascript
const res = await fetch('/api/tools/auto-feedback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'x-user-role': 'AGENT',
    'x-org-id': orgId
  },
  body: JSON.stringify({
    contactId: 'contact_xyz789',
    dryRun: false
  })
});

const data = await res.json();
if (data.ok) {
  console.log(`✓ ${data.smsCount}개 SMS 생성됨`);
  data.created.forEach(c => {
    console.log(`  Day ${c.day}: ${c.phase} @ ${c.scheduledAt}`);
  });
}
```

### TypeScript
```typescript
interface AutoFeedbackRequest {
  contactId: string;
  dryRun?: boolean;
}

interface AutoFeedbackResponse {
  ok: boolean;
  lens?: string;
  confidenceScore?: number;
  smsCount?: number;
  created?: Array<{
    id: string;
    day: number;
    phase: string;
    tone: string;
    scheduledAt: string;
    status: string;
  }>;
  message?: string;
  code?: string;
}

const response = await fetch('/api/tools/auto-feedback', {
  method: 'POST',
  body: JSON.stringify(req)
}) as Response;

const data: AutoFeedbackResponse = await response.json();
```

---

## 기대 효과

| 메트릭 | 현재 | 목표 | 증가율 |
|--------|------|------|--------|
| SMS 자동화율 | 0% | 95%+ | ↑∞ |
| 운영 시간 | 20분/고객 | 1분/고객 | ↓95% |
| 클로징율 | 15% | 30-35% | ↑100-133% |
| 월 예상 수익 | - | +$76K-152K | +$76K-152K |

---

## 주요 수정 사항 (2026-06-03)

✅ GDPR SMS 거부 여부 (optOutAt) 검증
✅ 중복 SMS 방지 (24시간 이내 PENDING/RETRY 체크)
✅ 렌즈 감지 try-catch 추가
✅ 메시지 유효성 검증
✅ DB 트랜잭션 에러 처리
✅ 로깅 강화 (confidenceScore, days[] 포함)
✅ 응답 포맷 통일 (smsCount 추가, tone 포함)

---

## 배포 체크리스트

- [x] 모든 import 확인 (7개 의존성)
- [x] 권한 제어 구현 (buildContactWhere)
- [x] GDPR 검증 (optOutAt)
- [x] 중복 방지 (existingScheduled 체크)
- [x] 렌즈 감지 (LensDetectionEngine)
- [x] PASONA 생성 (getPasonaTemplate)
- [x] 변수 치환 (personalize)
- [x] dryRun 분기
- [x] 트랜잭션 처리
- [x] 에러 처리 (8가지 시나리오)
- [x] 로깅 (시작, 완료, 에러)
- [x] 응답 포맷 (ok, lens, created)

---

## 다음 단계

1. **Cron 통합**: sms-day0-init, sms-day1-objection, sms-day2-value, sms-day3-action이 자동 발송
2. **UI 연동**: Contact 상세 페이지에 "Auto SMS 생성" 버튼 추가
3. **Analytics**: SMS 성과 추적 (open_rate, click_rate, conversion_rate)
4. **A/B 테스트**: PASONA Day 0-3 변형별 성과 비교
