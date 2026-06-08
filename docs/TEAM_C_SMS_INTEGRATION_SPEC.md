# Team C: Aligo SMS 통합 스펙 (여권 독촉용)

**목적**: 여권 제출 요청 SMS를 배치로 발송하고, 중복 발송을 방지하며, 모든 발송 기록을 추적하는 시스템 구축

**생성일**: 2026-06-08  
**상태**: Phase 1 분석 → Phase 2-3 설계 + 구현 완료 → Phase 5 검증 중

---

## 📋 구현 완료 항목

### 1. passport-sms.ts (신규 파일)
**경로**: `src/lib/passport-sms.ts`

#### 기능
- **SMS 템플릿 관리** (3가지)
  - `basic`: 초기 안내 (발급 직후)
  - `reminder`: 재알림 (7-14일 후)
  - `urgent`: 긴급 (출발 3-5일 전)

- **메시지 생성**: `renderSmsMessage()` — 변수 자동 치환
  - {customerName} → 고객명
  - {tripName} → 여행명
  - {daysLeft} → 남은 일수
  - {linkUrl} → 여권 제출 링크

- **배치 발송**: `sendSmsBatch()` — 10명씩 병렬 + 200ms 딜레이
  - 동기 처리 아님 (비동기)
  - 각 배치별로 Promise.all() 실행
  - Aligo API 초당 500건 제한 준수
  - 각 발송마다 logPassportSms() 호출 → SmsLog 자동 기록

- **중복 발송 방지**: `isDuplicateWithin24h()` — 24시간 내 중복 체크
  - GmPassportRequestLog 기반 조회
  - sentAt 시간 범위로 검사

- **로깅**: `logPassportSms()` — SmsLog 테이블에 기록
  - status: SENT | FAILED | BLOCKED
  - passportRequestId 자동 저장
  - resultCode, msgId 저장

- **검증**: `validateMessageLength()` — SMS/LMS 자동 판정
  - SMS: 최대 90자
  - LMS: 최대 1000자

#### 스펙
```typescript
interface PassportSmsRecipient {
  id: string;              // GmPassportRequestLog.id
  phone: string;
  customerName: string;
  tripName?: string;
  daysLeft?: number;
}

interface SendSmsBatchResult {
  successCount: number;
  failureCount: number;
  totalCount: number;
  errors: Array<{ id: string; phone: string; reason: string }>;
  sentAt: string;
}
```

---

### 2. Prisma Schema 업데이트
**파일**: `prisma/schema.prisma`

#### SmsLog 모델 수정
```prisma
model SmsLog {
  id                String    @id @default(cuid())
  organizationId    String
  contactId         String?
  passportRequestId String?   // ✅ 신규 필드
  phone             String
  contentPreview    String
  msg               String    @default("")
  status            String    @default("SENT")
  blockReason       String?
  resultCode        String?
  msgId             String?
  channel           String    @default("FUNNEL")
  sentAt            DateTime  @default(now())
  // ... (기타 필드)

  @@index([organizationId, sentAt])
  @@index([contactId, sentAt])
  @@index([passportRequestId, sentAt])  // ✅ 신규 인덱스
  @@index([msgId])
}
```

#### 마이그레이션
- 명령: `npx prisma migrate dev --name add_passport_sms_request_id`
- 상태: 진행 중

---

## 🔗 Team A와의 협력 항목

### Route: `/api/passport/send-sms` (POST)

**현재 상태**: 기존 구현 완료 (`src/app/api/passport/send-sms/route.ts`)

**요청 스펙** (변경 없음)
```typescript
interface SendSmsRequest {
  tripId: number;
  userIds: number[];                    // GM 고객 ID 배열
  templateType?: 'basic' | 'reminder' | 'urgent';
}
```

**응답 스펙** (변경 없음)
```typescript
interface SendSmsResponse {
  ok: boolean;
  successCount: number;
  failureCount: number;
  sentAt: string;
  estimatedCost: string;
  errors?: Array<{ userId: number; error: string }>;
}
```

**Team C 제안**: passport-sms.ts의 배치 함수 활용
- 현재는 순차 발송 (for loop)
- 개선안: sendSmsBatch() 함수로 병렬화
  ```typescript
  const recipients = users.map(u => ({
    id: passportLog.id,
    phone: u.phone,
    customerName: u.name,
    tripName: trip.cruiseName,
    daysLeft: calculateDays(trip.departureDate)
  }));
  
  const batchResult = await sendSmsBatch(
    smsConfig,
    recipients,
    templateType,
    linkUrl,
    organizationId
  );
  ```

**통합 시점**: Team A에서 route.ts 개선 시 passport-sms.ts import 필요

---

## ✅ 검증 체크리스트

- [ ] Prisma generate 완료
- [ ] npx tsc --noEmit 통과 (에러 0개)
- [ ] Prisma migration 생성 및 적용
- [ ] passport-sms.ts 모든 함수 타입 검증
- [ ] logPassportSms() 호출 시 organizationId, contentPreview 자동 저장
- [ ] 템플릿 3가지 메시지 길이 확인 (90자 이내 → SMS, 초과 → LMS)
- [ ] 배치 성능 테스트 (100명 예상 10-15초)
- [ ] 중복 발송 방지 테스트 (24시간 내 같은 ID 체크)
- [ ] SmsLog에 passportRequestId 자동 저장 확인

---

## 📊 성능 기준

| 항목 | 목표 | 달성 여부 |
|------|------|----------|
| **배치 처리** | 10명 / 배치 | ✅ 구현 |
| **배치 간 딜레이** | 200ms | ✅ 구현 |
| **100명 발송 시간** | 10-15초 | 예상 |
| **병렬도** | 배치 내 Promise.all() | ✅ 구현 |
| **API 제한 준수** | 초당 500건 | ✅ 설계 |
| **중복 발송 방지** | 24시간 1회 | ✅ 구현 |
| **로깅 정확도** | 100% (모든 발송 기록) | ✅ 구현 |

---

## 🚀 향후 확장 (Phase 2)

1. **템플릿 DB 저장** (Option C)
   - SMS 템플릿을 `SmsTemplate` 테이블로 관리
   - 관리자 UI에서 실시간 템플릿 변경 가능

2. **자동 재시도**
   - 실패한 발송을 Redis 큐에 저장
   - 백그라운드 크론으로 재시도 (Day 3, 7, 14)

3. **A/B 테스트**
   - 템플릿별 성과 추적
   - 오픈율 / 클릭율 / 전환율 측정

4. **분석 대시보드**
   - 채널별 성공률 (SMS vs LMS)
   - 고객 세그먼트별 성과
   - 템플릿 효과도 비교

---

## 📝 참고: 기존 send-sms/route.ts와의 차이

### 기존 (순차 발송)
```typescript
for (const userId of userIds) {
  // 1명씩 발송 → Promise.all() 없음
  // 예상 시간: 100명 = 약 100초+
}
```

### 신규 (배치 + 병렬)
```typescript
const recipients = [...];
const batchResult = await sendSmsBatch(...);
// 10명씩 배치 → 각 배치 내 Promise.all()
// 예상 시간: 100명 = 약 10-15초
```

**10배 성능 향상** ⚡

---

**문의**: Team A와 협력 시 이 문서를 참고하여 route.ts 개선 추진
