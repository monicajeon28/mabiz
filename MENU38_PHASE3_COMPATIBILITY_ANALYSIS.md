# Menu #38 Phase 3 호환성/안정성 분석
## SendingHistory → ExecutionLog API 마이그레이션

**작성일**: 2026-05-18  
**상태**: Phase 3 사전 분석 완료  
**위험도**: 중간 (데이터 손실 가능, 점진적 완화 가능)

---

## 1. 현재 상태: 두 모델의 병행

### 1.1 SendingHistory (Phase 2, 기존)
```prisma
model SendingHistory {
  // 식별자
  id: String @id
  organizationId: String
  
  // 메타정보
  sendingType: String      // TEMPLATE | AUTOMATION | CAMPAIGN
  sourceId: String?        // templateId | automationId | campaignId
  campaignId: String?
  
  // 수신자 & 채널
  contactId: String
  phone: String?           // 스냅샷
  email: String?           // 스냅샷
  channel: String          // SMS | EMAIL
  
  // 메시지 내용 (직접 저장)
  subject: String?         // ⭐ EMAIL 제목
  body: String             // ⭐ 메시지 본문 (S3 아님)
  
  // 상태 & 실패 추적
  status: SendingStatus    // ENUM
  failureReason: SendingFailureReason?
  failureUserMsg: String?
  messageId: String?
  deliveredAt: DateTime?
  
  // 재시도
  retryCount: Int
  maxRetries: Int
  nextRetryAt: DateTime?
  failureMessage: String?
  
  // 채널별 상세 추적
  emailStatus: String?     // ⭐ PENDING | SENT | BOUNCE | COMPLAINT
  emailSentAt: DateTime?
  emailOpenedAt: DateTime?
  smsStatus: String?       // ⭐ PENDING | SENT | DELIVERY_FAIL
  smsSentAt: DateTime?
  
  // 상호작용
  linkClickedAt: DateTime?
  registeredAt: DateTime?
  landingPageViewId: String?
  
  // Webhook 추적
  webhookAttempts: Int
  lastWebhookAt: DateTime?
  
  // 타이밍
  scheduledAt: DateTime
  sentAt: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
  
  // 커스텀 메타데이터
  metadata: Json?          // ⭐ 임의의 추가 속성
}
```

**필드 통계**:
- 총 36개 필드
- ⭐ 고위험 필드 (손실 가능): subject, body, emailStatus, smsStatus, metadata

---

### 1.2 ExecutionLog (Phase 0+2, 신규)
```prisma
model ExecutionLog {
  // 식별자
  id: String @id
  organizationId: String
  
  // 발송 소스 (통합)
  sourceType: String       // FUNNEL_SEQUENCE | AUTOMATION_RULE | CAMPAIGN
  sourceId: String         // sequenceId | ruleId | campaignId
  sourceName: String       // 규칙/시퀀스/캠페인명 (스냅샷)
  campaignId: String?      // 캠페인인 경우만
  
  // 수신자 (Contact 스냅샷)
  contactId: String
  email: String?           // 스냅샷
  phone: String?           // 스냅샷
  
  // 채널 & 상태
  channel: String          // SMS | EMAIL
  status: ExecutionStatus  // ENUM (SendingStatus와 동일)
  
  // 발송 일정 (월별 반복 지원)
  executeMonth: String     // YYYY-MM 형식
  scheduledAt: DateTime
  sentAt: DateTime?
  nextRetryAt: DateTime?
  
  // 메시지 참조
  contentUrl: String?      // ⚠️ S3/Blob URL (subject + body JSON)
  messageId: String?
  
  // 실패 추적
  failureReason: ExecutionFailureReason?
  failureUserMsg: String?
  retryCount: Int
  maxRetries: Int
  
  // 상호작용 추적
  emailOpenedAt: DateTime?
  linkClickedAt: DateTime?
  registeredAt: DateTime?
  landingPageViewId: String?
  
  // 타이밍
  createdAt: DateTime
  updatedAt: DateTime
}
```

**필드 통계**:
- 총 23개 필드 (SendingHistory보다 13개 적음)
- 메시지 본문 저장 안 함 (contentUrl로 참조만)
- 채널별 상세 상태 없음
- 메타데이터 없음
- 월별 반복 지원 (executeMonth)

---

## 2. 필드별 호환성 매트릭스

| # | 필드 | SendingHistory | ExecutionLog | 호환성 | 주의사항 | 영향도 |
|---|------|---|---|---|---|---|
| 1 | id | ✅ | ✅ | 100% | 동일 | - |
| 2 | organizationId | ✅ | ✅ | 100% | 동일 | - |
| 3 | sendingType / sourceType | ✅ TEMPLATE/AUTOMATION/CAMPAIGN | ✅ FUNNEL_SEQUENCE/AUTOMATION_RULE/CAMPAIGN | 90% | 매핑 필요 (TEMPLATE → ?) | P1 |
| 4 | sourceId | ✅ | ✅ | 100% | 동일 | - |
| 5 | sourceName | ❌ | ✅ | N/A | ExecutionLog만 있음 (새로 추가) | - |
| 6 | campaignId | ✅ | ✅ | 100% | 동일 | - |
| 7 | contactId | ✅ | ✅ | 100% | 동일 | - |
| 8 | contact.name | ❌ 저장X | ❌ 저장X | 0% | Contact 조인 필요 (느림) | **P0** |
| 9 | contact.phone | ✅ | ✅ | 100% | 스냅샷 동일 | - |
| 10 | contact.email | ✅ | ✅ | 100% | 스냅샷 동일 | - |
| 11 | phone | ✅ | ✅ | 100% | 중복 (contactId 스냅샷) | - |
| 12 | email | ✅ | ✅ | 100% | 중복 (contactId 스냅샷) | - |
| 13 | channel | ✅ | ✅ | 100% | 동일 | - |
| 14 | **subject** | ✅ 직접 저장 | ❌ contentUrl (JSON) | 70% | S3 조회 필요 → 느림 | **P0** |
| 15 | **body** | ✅ 직접 저장 | ❌ contentUrl (JSON) | 70% | S3 조회 필요 → 느림 | **P0** |
| 16 | status | ✅ SendingStatus | ✅ ExecutionStatus | 100% | 동일 Enum | - |
| 17 | failureReason | ✅ SendingFailureReason (8개) | ✅ ExecutionFailureReason (9개) | 95% | 매핑 필수 (INVALID_CONTACT) | P1 |
| 18 | failureUserMsg | ✅ | ✅ | 100% | 동일 | - |
| 19 | messageId | ✅ | ✅ | 100% | 동일 | - |
| 20 | deliveredAt | ✅ | ❌ | 0% | ExecutionLog에 없음 | P2 |
| 21 | retryCount | ✅ | ✅ | 100% | 동일 | - |
| 22 | maxRetries | ✅ | ✅ | 100% | 동일 | - |
| 23 | nextRetryAt | ✅ | ✅ | 100% | 동일 | - |
| 24 | failureMessage | ✅ | ❌ | 0% | ExecutionLog에 없음 | P2 |
| 25 | **emailStatus** | ✅ 저장 | ❌ | 0% | 추적 불가 (세분화) | **P0** |
| 26 | emailSentAt | ✅ | ❌ | 0% | ExecutionLog는 sentAt만 | P2 |
| 27 | emailOpenedAt | ✅ | ✅ | 100% | 동일 | - |
| 28 | **smsStatus** | ✅ 저장 | ❌ | 0% | 추적 불가 (세분화) | **P0** |
| 29 | smsSentAt | ✅ | ❌ | 0% | ExecutionLog는 sentAt만 | P2 |
| 30 | linkClickedAt | ✅ | ✅ | 100% | 동일 | - |
| 31 | registeredAt | ✅ | ✅ | 100% | 동일 | - |
| 32 | landingPageViewId | ✅ | ✅ | 100% | 동일 | - |
| 33 | webhookAttempts | ✅ | ❌ | 0% | ExecutionLog에 없음 | P2 |
| 34 | lastWebhookAt | ✅ | ❌ | 0% | ExecutionLog에 없음 | P2 |
| 35 | scheduledAt | ✅ | ✅ | 100% | 동일 | - |
| 36 | sentAt | ✅ | ✅ | 100% | 동일 | - |
| 37 | createdAt | ✅ | ✅ | 100% | 동일 | - |
| 38 | executeMonth | ❌ | ✅ | N/A | ExecutionLog만 있음 (월별 반복) | - |
| 39 | **metadata** | ✅ Json 저장 | ❌ | 0% | 임의 메타데이터 손실 | **P0** |

---

## 3. 핵심 호환성 이슈 (Priority별)

### P0 Blocker: 응답 포맷 100% 호환성 불가

#### 이슈 A: contact 정보 조인 (현재 API가 포함)
**현재 응답** (SendingHistory):
```json
{
  "id": "sh_123",
  "contact": {
    "id": "c_456",
    "name": "김철수",           // ⚠️ Contact 테이블 조인
    "phone": "010-1234-5678",
    "email": "kim@example.com"
  },
  "campaign": { "id": "...", "title": "..." },
  "channel": "SMS",
  "status": "SENT",
  "sentAt": "2025-01-15T10:00:00Z",
  "failureReason": null,
  "failureUserMsg": null,
  "retryCount": 0,
  "maxRetries": 3,
  "createdAt": "2025-01-15T09:00:00Z"
}
```

**ExecutionLog 매핑 방법**:
```javascript
// Option A: Contact 조인 (느림, 호환성 100%)
const log = await prisma.executionLog.findMany({
  include: {
    contact: {
      select: { id: true, name: true, phone: true, email: true }
    }
  }
})
// 발송 당시의 contact.name이 없음 (ExecutionLog는 스냅샷만 저장)
// → Contact 테이블 조인 → "현재" name 반환 (과거와 다를 수 있음)
// 위험도: 높음 (데이터 정합성 문제)

// Option B: contact 필드 스냅샷 저장 (마이그레이션)
// ExecutionLog에 contactName 필드 추가 필요
// 마이그레이션 비용: 높음 (기존 데이터)
```

**권장사항**:
- ✅ **A방식**: 과거 데이터는 Contact 테이블 조인, 미래는 ExecutionLog에 저장
- 비용: 쿼리 느림 (Contact LEFT JOIN), 데이터 정합성 위험

---

#### 이슈 B: subject, body 필드 손실
**현재 API** (sending-history/route.ts):
```typescript
const serialized = histories.map((h) => ({
  id: h.id,
  contact: h.contact,
  campaign: h.campaign,
  channel: h.channel,
  status: h.status,
  sentAt: h.sentAt,
  failureReason: h.failureReason,
  failureUserMsg: h.failureUserMsg,
  retryCount: h.retryCount,
  maxRetries: h.maxRetries,
  createdAt: h.createdAt,
  // 🚫 응답에 subject, body 없음 (이미 제외됨!)
}));
```

**분석**:
- ✅ **이미 응답에 포함되지 않음!** (subject, body 필드 없음)
- → ExecutionLog로 마이그레이션 가능
- contentUrl로 필요 시 조회 (별도 API)

---

#### 이슈 C: metadata 필드 손실
**현재 API**:
- metadata 필드를 응답에 포함하지 않음

**ExecutionLog 상태**:
- metadata 필드 없음 (스키마에 없음)

**선택지**:
- a) null 반환 → 호환성 100% (meta 정보 손실)
- b) ExecutionLog에 metadata 필드 추가 → 마이그레이션 필요
- c) 무시 (사용자 요청 올 때까지)

---

### P1: Enum 매핑 불완전

#### SendingFailureReason (8개) → ExecutionFailureReason (9개)

```
SendingFailureReason:
- INVALID_EMAIL
- INVALID_PHONE
- OPT_OUT
- QUOTA_EXCEEDED
- SYSTEM_ERROR
- PROVIDER_ERROR
- NETWORK_ERROR
- BOUNCE

ExecutionFailureReason (+ 1개 추가):
- INVALID_EMAIL
- INVALID_PHONE
- INVALID_CONTACT    // ⚠️ 자동화/퍼널용 (새로 추가)
- OPT_OUT
- QUOTA_EXCEEDED
- SYSTEM_ERROR
- PROVIDER_ERROR
- NETWORK_ERROR
- BOUNCE
```

**역 매핑 전략** (ExecutionLog → SendingHistory):
```javascript
const enum_map = {
  ExecutionFailureReason.INVALID_EMAIL -> SendingFailureReason.INVALID_EMAIL
  ExecutionFailureReason.INVALID_PHONE -> SendingFailureReason.INVALID_PHONE
  ExecutionFailureReason.INVALID_CONTACT -> SendingFailureReason.INVALID_PHONE  // ⚠️ 손실
  ExecutionFailureReason.OPT_OUT -> SendingFailureReason.OPT_OUT
  // ... 나머지 동일
}
```

**문제**: INVALID_CONTACT → INVALID_PHONE 매핑 시
- "이메일 유효하지 않음" vs "휴대폰 유효하지 않음" 혼동 가능
- API 응답의 failureReason이 부정확

**해결책**:
- a) 매핑 + 경고 로그 (감시)
- b) SendingHistory API에만 SendingFailureReason 사용
- c) ExecutionLog API는 ExecutionFailureReason 사용 (분기)

---

### P2: 채널별 상세 상태 추적 불가

**SendingHistory**:
- emailStatus: PENDING | SENT | BOUNCE | COMPLAINT (세분화)
- smsStatus: PENDING | SENT | DELIVERY_FAIL (세분화)

**ExecutionLog**:
- status: 통합 (PENDING | SENT | FAILED | ... )
- 채널별 세분화 불가

**클라이언트 영향**:
- 이메일 반송 추적 불가 (BOUNCE vs 일반 FAILED)
- SMS 배송 실패 원인 분석 불가

---

## 4. 점진적 마이그레이션 전략 (Phase 3a + 3b)

### Phase 3a: 하이브리드 (권장)
**목표**: 기존 클라이언트 100% 호환성 유지

```
┌─────────────────────────┐
│  SendingHistory API     │ ← 그대로 유지 (feature flag OFF)
│  /api/campaigns/        │
│  sending-history        │
└────────────┬────────────┘
             │ (응답 포맷 100% 동일)
             ▼
┌─────────────────────────┐
│  ExecutionLog 도입      │ ← 백그라운드 기록만
│  (Phase 0/2 기능용)     │
└─────────────────────────┘
```

**구현**:
1. ExecutionLog API 개발 (내부용)
2. SendingHistory API는 기존 그대로
3. Feature flag로 ExecutionLog 사용 제어
4. 데이터 검증 (SendingHistory ↔ ExecutionLog)
5. 로그 분석 (응답 차이 모니터링)

**기간**: 2-3주

---

### Phase 3b: 완전 마이그레이션
**목표**: SendingHistory 완전 제거

```
┌─────────────────────────┐
│  SendingHistory 레거시  │
│  (읽기 전용)            │
└────────────┬────────────┘
             │ (점진적 마이그레이션)
             ▼
┌─────────────────────────┐
│  ExecutionLog API       │ ← 신규 (응답 포맷 95%)
│  /api/campaigns/        │
│  execution-logs         │
└─────────────────────────┘
```

**변경 사항**:
1. API 엔드포인트 변경: `/sending-history` → `/execution-logs`
2. 응답 포맷 변경:
   - metadata → null (또는 제거)
   - emailStatus, smsStatus → 제거
   - deliveredAt, failureMessage → 제거
   - subject, body → contentUrl로만 제공
3. Enum 분기: ExecutionFailureReason 사용
4. Contact 조인 추가 (느림)

**호환성**: 95% (메타데이터, 채널별 상태 손실)

**기간**: 2주 (마이그레이션 + 테스트)

---

## 5. 호환성 테스트 체크리스트

### 5.1 응답 포맷 호환성 (Phase 3a)

```
[ ] 기본 필드 (id, status, sentAt, createdAt) 동일
[ ] Contact 필드 (name, phone, email) 동일
[ ] Campaign 필드 (id, title) 동일
[ ] Enum 값 (status, failureReason) 동일
[ ] NULL 처리 (failureReason, failureUserMsg) 동일
[ ] 날짜 포맷 (ISO 8601) 동일
[ ] 페이지네이션 (limit, offset, total) 동일
[ ] 정렬 순서 (DESC by createdAt) 동일
[ ] 필터링 (status, channel) 동일
```

### 5.2 데이터 정합성 (Phase 3a)

```
[ ] SendingHistory 건수 = ExecutionLog 건수 (같은 기간)
[ ] 각 로그의 status 분포 동일
[ ] failureReason 분포 동일 (INVALID_CONTACT 제외)
[ ] createdAt 범위 동일
[ ] contactId 분포 동일
```

### 5.3 성능 (Phase 3a)

```
[ ] SendingHistory API 응답시간 < 500ms (1000 레코드)
[ ] ExecutionLog 조회 < 300ms (내부 배치용)
[ ] Contact 조인 성능 OK (N+1 문제 없음)
[ ] 데이터베이스 CPU 증가 < 5%
```

### 5.4 롤백 테스트

```
[ ] Feature flag OFF → SendingHistory로 완전 복구
[ ] 발송 중인 캠페인 계속 추적 가능
[ ] 기존 로그 데이터 손실 없음
[ ] 클라이언트 에러 없음
```

---

## 6. 사용자 의사결정 3가지 (초등학생 수준)

### Q1: SendingHistory API는 계속 사용할 거예요?

**선택지**:

**a) 계속 사용 (권장) ✅**
- SendingHistory API 그대로 유지
- ExecutionLog는 백그라운드에서만 사용
- 클라이언트 코드 수정 불필요
- 호환성: 100%
- 비용: 높음 (두 모델 병행)
- 기간: 3-6개월 (점진적 완화)

**b) 마이그레이션 (빠름)**
- ExecutionLog API로 변경 (엔드포인트 변경)
- 클라이언트 코드 수정 필요
- 호환성: 95% (메타데이터, 채널별 상태 손실)
- 비용: 낮음 (API 개발 만)
- 기간: 2-3주

**c) 절충안**
- 두 API 모두 제공
- 클라이언트가 선택
- 호환성: 100% (SendingHistory) vs 95% (ExecutionLog)
- 비용: 중간
- 기간: 3-4주

**추천**: **a) 계속 사용** (장기 안정성 확보)

---

### Q2: subject, body, metadata는 어떻게 할까요?

**상황**:
- SendingHistory: 직접 저장 (응답에 미포함)
- ExecutionLog: contentUrl (S3) 참조
- 클라이언트: 현재 불필요 (API 응답에 없음)

**선택지**:

**a) 그냥 두기 (권장) ✅**
- 호환성: 100% (이미 응답에 없음)
- 클라이언트: 변화 없음
- 비용: 0

**b) contentUrl로 제공하기**
- 이점: 클라이언트가 필요 시 조회 가능
- 단점: S3 조회 느림 (별도 API 필요)
- 호환성: 95% (경로 다름)
- 비용: 중간 (새로운 엔드포인트)

**c) ExecutionLog에 직접 저장**
- 이점: 빠름, 호환성 100%
- 단점: DB 용량 증가 (메시지 본문 대용량)
- 비용: 높음 (마이그레이션, DB 디스크)

**추천**: **a) 그냥 두기** (불필요한 기능)

---

### Q3: 채널별 상세 상태(emailStatus, smsStatus)를 저장할까요?

**상황**:
- SendingHistory: BOUNCE, COMPLAINT 등 세분화
- ExecutionLog: 통합 상태만 (SENT, FAILED)
- 클라이언트: 현재 미사용 (응답에 없음)

**선택지**:

**a) 그냥 두기 (권장) ✅**
- 호환성: 100% (이미 응답에 없음)
- 비용: 0
- 제약: 향후 이메일 반송 추적 불가능

**b) ExecutionLog에 추가**
- emailDeliveryStatus: PENDING | SENT | BOUNCE | COMPLAINT
- smsDeliveryStatus: PENDING | SENT | DELIVERY_FAIL
- 이점: 정교한 추적 가능
- 비용: 중간 (새로운 필드 + 마이그레이션)
- 기간: 2주

**c) 무시 (현재 선택)**
- ExecutionLog: 현재 상태 유지
- SendingHistory: 거기만 유지
- 향후 필요 시 재검토

**추천**: **a) 그냥 두기** (불필요, 향후 필요 시 b로 업그레이드)

---

## 7. 최종 롤백 전략

### 재난 상황 (Phase 3a 실패)

```
Timeline: 최악의 경우 15분 내 복구 가능

1. 즉시 조치 (< 5분)
   ├─ Feature flag OFF → SendingHistory로 복구
   ├─ ExecutionLog 쓰기 중지 (cron job 중지)
   └─ 클라이언트에 영향 없음

2. 근본 원인 분석 (< 10분)
   ├─ 로그 검토 (SendingHistory vs ExecutionLog 비교)
   ├─ 데이터 정합성 체크
   └─ 성능 이슈 확인

3. 재설계 (< 1시간)
   ├─ 호환성 이슈 재분석
   ├─ 마이그레이션 전략 수정
   └─ Phase 3b 계획 업데이트

4. 재배포 (다음날)
   ├─ 수정 코드 테스트
   ├─ 호환성 테스트 재실행
   └─ Phase 3a 재시작
```

---

### 재난 상황 (Phase 3b 실패)

```
Timeline: 30분 내 이전 버전 복구 가능

1. 즉시 조치 (< 5분)
   ├─ ExecutionLog API → SendingHistory API로 되돌림
   ├─ 클라이언트 요청 SendingHistory로 라우팅
   └─ 데이터 정합성 모니터링

2. 데이터 무결성 확인 (< 10분)
   ├─ ExecutionLog 데이터 유지 (안전)
   ├─ SendingHistory 데이터 재활성화
   └─ 이중 기록 검증

3. 근본 원인 분석 (< 30분)
   ├─ API 응답 포맷 검증
   ├─ 성능 문제 분석
   └─ 데이터 손실 확인

4. 수정 & 재배포
   ├─ 이슈 수정
   ├─ 호환성 테스트 강화
   └─ Phase 3b 재시작 (점진적)
```

---

## 8. 일정 및 리스크

| Phase | 기간 | 호환성 | 위험도 | 비용 |
|-------|------|--------|--------|------|
| **3a** (권장) | 2-3주 | 100% | 낮음 | 중간 (두 모델 병행) |
| **3b** | 2주 | 95% | 중간 | 낮음 (DB 정리) |
| **Rollback** | 즉시 | 100% | 낮음 | 0 |

---

## 9. 다음 단계

1. **사용자 피드백 수집** (위 Q1/Q2/Q3)
2. **호환성 테스트 계획 수립** (체크리스트 5.1-5.4)
3. **Phase 3a 구현** (2-3주)
   - ExecutionLog API 개발
   - Feature flag 추가
   - 데이터 검증
4. **모니터링 대시보드** (SendingHistory vs ExecutionLog)
5. **Phase 3b 진행** (향후 6개월 후)
   - 점진적 마이그레이션
   - 클라이언트 알림
   - 레거시 데이터 정리

---

## 참고: 현재 API 응답 포맷 (sending-history/route.ts)

```typescript
// 기존 응답 (SendingHistory 기반)
{
  "ok": true,
  "histories": [
    {
      "id": "sh_123",
      "contact": {                    // Contact 조인 (느림)
        "id": "c_456",
        "name": "김철수",
        "phone": "010-1234-5678",
        "email": "kim@example.com"
      },
      "campaign": {                   // Campaign 조인
        "id": "camp_789",
        "title": "신년 이벤트"
      },
      "channel": "SMS",
      "status": "SENT",
      "sentAt": "2025-01-15T10:00:00Z",
      "failureReason": null,
      "failureUserMsg": null,
      "retryCount": 0,
      "maxRetries": 3,
      "createdAt": "2025-01-15T09:00:00Z"
      // ⚠️ 응답에 포함 안 됨:
      // - subject, body (응답 크기)
      // - emailStatus, smsStatus (불필요)
      // - metadata (불필요)
      // - webhookAttempts, deliveredAt (내부용)
    }
  ],
  "total": 1000,
  "limit": 20,
  "offset": 0
}
```

**호환성 영향도**: ✅ 95% (메타데이터 손실만)

