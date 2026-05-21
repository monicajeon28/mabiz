# 크루즈닷 고객데이터 ↔ CRM Contact 동기화 메커니즘 분석

**분석일**: 2026-05-21
**분석범위**: GmUser(크루즈닷) → Contact(CRM) 동기화 흐름

---

## 1. 현재 동기화 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                      크루즈닷몰 (GMcruise)                     │
│  GmUser (id: Int, phone, name, email, ...)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    [5가지 웹훅 경로]
                              ↓
        ┌─────────┬─────────┬─────────┬──────────┬──────────┐
        ↓         ↓         ↓         ↓          ↓          ↓
    문의형    구매형    리드상태  골드회원  계약서    결제/환불
    inquiry  purchase  lead-status gold-inquiry contract  refund
        │         │         │         │          │          │
        └─────────┴─────────┴─────────┴──────────┴──────────┘
                              ↓
                    Contact Upsert
                    (phone, organizationId 기준)
                              ↓
        ┌──────────────────────┬──────────────────────┐
        ↓                      ↓                      ↓
    Contact 생성          Contact 업데이트    ContactLensClassification
    (type: LEAD)         (leadScore++)       (자동 생성 안됨 ❌)
```

---

## 2. GmUser → Contact 필드 매핑

| GmUser 필드 | Contact 필드 | 동기화 경로 | 주기 | 비고 |
|:---|:---|:---|:---|:---|
| `id` (Int) | `userId` | 웹훅 (purchase) | 일방향 | **미연결 (FK 아님)** |
| `phone` | `phone` | 모든 웹훅 | 일방향 | upsert 기준 PK |
| `name` | `name` | 모든 웹훅 | 일방향 | 구매 후 덮어쓰기 |
| `email` | `email` | inquiry, purchase, gold | 일방향 | 선택적 (customerEmail) |
| `createdAt` | `createdAt` | POST /api/contacts | 일방향 | 수동 생성만 |
| `customerStatus` | (없음) | 매핑 없음 | - | **P1 이슈**: 고객상태 미동기화 |
| `isHibernated` | (없음) | 매핑 없음 | - | **P1 이슈**: 휴면상태 미동기화 |
| `isLocked` | (없음) | 매핑 없음| - | **P1 이슈**: 정지상태 미동기화 |
| (없음) | `segment` | detectSegment() | 생성시 | **자동 감지** (나이+결혼+자녀) |
| (없음) | `userId` | purchase 웹훅 | 일방향 | GmUser.id 저장 |

---

## 3. 동기화 트리거 분석

### ✅ 웹훅 기반 (Event-Driven)

#### 3.1 Inquiry 웹훅 (문의/상담신청)
```typescript
// POST /api/webhooks/inquiry
// 크루즈닷몰 웹사이트 → 상담신청 폼 제출 시
// 트리거: 사용자 문의 발생

Upsert Logic:
- phone_organizationId (복합 고유키)로 기존 Contact 찾기
- 신규: Contact 생성 (type: LEAD, leadScore: 15)
- 기존: name, email, affiliateCode 업데이트 + leadScore += 15
- 필드: phone, name, email, affiliateCode
- 자동 배정: "상담" 그룹 (조건: 그룹 이름 contains "상담")
```

**문제점**:
- userId 매핑 없음 (GmUser와 단절)
- Contact.segment 자동 생성 안됨 (나이/결혼 정보 없음)
- ContactLensClassification 자동 생성 안됨

#### 3.2 Purchase 웹훅 (결제 완료)
```typescript
// POST /api/webhooks/purchase
// 크루즈닷 구매 → 결제 확인 후 호출
// 2단계: 결제 즉시(1단계) → 관리자 승인(2단계)

Upsert Logic (orderId 기준):
- 신규 생성:
  * phone, name, email, productName, departureDate, orderId
  * bookingRef = orderId
  * channel = "b2c"
  * type = "CUSTOMER" or "PURCHASED"
  * purchasedAt = new Date()
  
- 기존 업데이트:
  * name, productName, departureDate, email, affiliateCode
  * (userId 매핑 없음 ❌)

AffiliateSale 자동 생성 (orderId 기준):
- saleAmount, commissionRate(2단계), commissionAmount
- affiliateUserId = Organization.first().userId (비결정적 ❌)
```

**문제점**:
- Contact.userId 미설정 (GmUser.id 연결 안됨)
- Contact.segment 자동 생성 안됨
- ContactLensClassification 자동 생성 안됨
- purchasedAt만 설정, lastPaymentAt 미설정

#### 3.3 Lead Status 웹훅 (리드 상태 변경)
```typescript
// POST /api/webhooks/gmcruise/lead-status
// GMcruise 리드 상태 변경 (IN_PROGRESS → CLOSED)

행동:
- affiliateCode로 Contact 찾기
- Contact.type 변경 없음 (warning in comment)
- ContactMemo 기록만 (상태 이력)

Contact 업데이트 없음 ❌
```

**문제점**:
- type 변경 없음 (LEAD 그대로)
- segment 업데이트 없음
- userId 연결 안됨

#### 3.4 그 외 웹훅들
- **Gold Inquiry**: Contact 생성 (type: LEAD, segment 미설정)
- **Partner Signup**: Contact 생성 (type: LEAD, segment 미설정)
- **Contract Signed**: ContactMemo만 기록
- **Payment Failure**: 처리 안됨

---

## 4. 현재 Contact 생성 경로

```
1. 웹훅 (Event-Driven)
   ├─ inquiry → Contact(LEAD)
   ├─ purchase → Contact(CUSTOMER/PURCHASED)
   ├─ gold-inquiry → Contact(LEAD)
   └─ partner-signup → Contact(LEAD)

2. 수동 입력 (POST /api/contacts)
   └─ Contact(LEAD, segment 자동감지)

3. 부재중 리드 (고객 미진행 사건)
   └─ (명시적 경로 없음)
```

**문제점**:
- 웹훅 경로: segment 미설정 (필드 없음)
- 웹훅 경로: userId 미매핑 (GmUser와 단절)
- 웹훅 경로: ContactLensClassification 미생성

---

## 5. 렌즈 자동 분류 현황

### 현재 상태: ❌ 비활성

```typescript
// detectSegment() 함수 존재 (5가지 세그먼트)
// - A: 30대 커플 (25-35, 결혼, 자녀X)
// - B: 40대 가족 (40-50, 자녀O)
// - C: 중년 부부 (45-55, 결혼, 자녀X)
// - D: 50-60대
// - E: 60대+

// 하지만:
// 1. Inquiry/Purchase 웹훅: age, maritalStatus, childrenCount 필드 없음
// 2. Contact.segment 업데이트 로직 없음 (설정만 되고 계산 미포함)
// 3. ContactLensClassification 자동 생성 없음
//    - classifyCustomerLens() API 존재하지만
//    - Contact 생성 시 호출하는 로직 없음
```

### 렌즈 분류 시스템 (설계되었으나 미연결)
```
classifyCustomerLens(responses, callNotes)
├─ Input: Q1-Q5 점수 (1-5) + 콜노트
├─ Processing:
│  ├─ keywordDetection (콜노트 → 신호)
│  ├─ 10개 렌즈 병렬 분류 (L1-L10)
│  └─ Bayesian 신뢰도 계산
└─ Output:
   ├─ primary_lens (L1-L10)
   ├─ confidence_score (0-100)
   ├─ recommended_script
   └─ sms_sequence_key

❌ Contact 생성 시 자동 호출 안됨
❌ Contact에 Q1-Q5 데이터 저장 안됨
```

---

## 6. 발견된 동기화 문제점 (심각도)

### 🔴 P0 (Blocker)

#### P0-1: Contact.userId 미연결 (FK 관계 없음)
- **문제**: Contact.userId (Int)가 GmUser.id (Int)를 가리키지만 FK 없음
- **영향**:
  - GmUser 삭제 시 Contact 데이터 고아 (orphaned)
  - Contact → GmUser 역방향 쿼리 불가능
  - N+1 쿼리로 인한 성능 저하 (Contact 조회 후 userId로 다시 GmUser 조회)
- **해결책**: ALTER TABLE contacts ADD FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE SET NULL
  
#### P0-2: 고아 Contact 대량 발생 가능
- **문제**: userId 값이 있어도 FK가 아니라 경고 없이 GmUser 삭제 가능
- **조회**:
  ```sql
  SELECT COUNT(*) FROM "Contact"
  WHERE "userId" IS NOT NULL
    AND "userId" NOT IN (SELECT id FROM "User")
  -- 현재 상황 불명 (검증 쿼리 필요)
  ```
- **해결책**: 배치 정정 쿼리 필요

#### P0-3: Contact.segment 웹훅에서 미설정
- **문제**: Purchase/Inquiry 웹훅에서 segment 필드 계산 안됨
- **영향**: 
  - 렌즈 분류 불가 (segment 필요 조건)
  - 세그먼트별 SMS 자동발송 불가
  - L0-L10 분류 불가
- **현재**:
  ```typescript
  // inquiry/purchase 웹훅
  const contact = await tx.contact.create({
    data: { phone, name, organizationId, ..., type: 'LEAD' }
    // ❌ segment 없음
  });
  ```

#### P0-4: ContactLensClassification 자동 생성 안됨
- **문제**: Contact 생성해도 L0-L10 렌즈 미분류
- **영향**:
  - 렌즈 기반 마케팅 자동화 불가 (Menu #38 Phase 4)
  - ContactLensSequence 미생성 (SMS 자동화 미작동)
  - 렌즈별 고객 필터링 불가
- **현재**: classifyCustomerLens() API 존재하지만 연결 파이프라인 없음

### 🟠 P1 (High Priority)

#### P1-1: GmUser.customerStatus 미동기화
- **문제**: 크루즈닷 고객상태(PURCHASED, HIBERNATED, LOCKED) → Contact 미매핑
- **영향**:
  - 휴면 고객을 부활화 마케팅 대상에서 제외 못함
  - 정지된 고객에게 SMS 발송 가능
  - 고객상태 기반 필터링 불가
- **필드**:
  - GmUser.customerStatus (PURCHASED, HIBERNATED, LOCKED, etc.)
  - GmUser.isHibernated (Boolean)
  - GmUser.isLocked (Boolean)
- **해결책**: Contact에 필드 추가 + 배치 동기화

#### P1-2: Contact.lastPaymentAt 미설정 (purchasedAt만 사용)
- **문제**: Purchase 웹훅에서 purchasedAt만 설정, lastPaymentAt 무시
- **영향**:
  - 최종 결제일 추적 불가
  - 결제 이후 재구매 기간 계산 불가
  - 부재중 기간 판단 오류 (purchasedAt는 한 번만 설정, update에는 undefined)
- **해결책**:
  ```typescript
  update: {
    ...,
    lastPaymentAt: new Date(), // 추가 필요
  }
  ```

#### P1-3: Contact.affiliateUserId 비결정적 매핑
- **문제**: Purchase 웹훅에서 affiliateCode의 판매자를 찾지만, Contact.assignedUserId로 자동 설정 안됨
- **코드**:
  ```typescript
  // affiliateSale에만 설정
  affiliateUserId: affiliateMember?.userId ?? null
  
  // ❌ Contact.assignedUserId에는 설정 안됨
  ```
- **영향**: 구매 고객을 담당자에게 자동 배정 안됨

#### P1-4: N+1 쿼리 (Contact.userId 기반)
- **문제**: Contact 조회 후 userId로 GmUser 조회 시 배치 로드 없음
- **예시**:
  ```typescript
  // contacts/route.ts에서 Contact 목록 조회 후
  // 각 Contact의 userId로 GmUser 정보 필요 시 → N+1
  for (const contact of contacts) {
    const user = await gmUserService.findById(contact.userId);
    // N번 쿼리
  }
  ```
- **해결책**: 배치 로드 (userId 배열 → findMany)

### 🟡 P2 (Medium Priority)

#### P2-1: 중복 Contact 가능성
- **문제**: phone + organizationId 복합 유니크 키만 있음
  - 같은 고객이 다른 organizationId로 Contact 생성 가능
  - A 조직과 B 조직에서 같은 휴대폰 번호로 2개 Contact 생성
- **영향**: 고객 중복 관리, SMS 중복 발송, CRM 데이터 불일치
- **해결책**: Global phone-based dedupe 또는 organizationId 재고려

#### P2-2: Contact.segment 수동 오버라이드만 지원
- **문제**: detectSegment()는 수동 입력에서만 호출, 웹훅에서는 호출 안됨
- **코드**:
  ```typescript
  // POST /api/contacts (수동 입력만)
  const segment = detectSegment({ age, maritalStatus, childrenCount });
  
  // ❌ 웹훅 (inquiry, purchase 등)에서 호출 안됨
  ```

#### P2-3: Contact.channel 자동 감지 부족
- **문제**: Purchase 웹훅에서 channel = "b2c"로 하드코딩
- **미설정**:
  - inquiryWebhook: channel 설정 없음 (기본값 "direct")
  - goldInquiry: channel 설정 없음
  - partnerSignup: channel 설정 없음
- **영향**: 채널별 필터링 불정확

#### P2-4: ContactLensSequence 미생성
- **문제**: Contact 생성 후 ContactLensClassification이 자동 생성 안되므로, ContactLensSequence도 미생성
- **영향**: SMS 자동화(Day 0-3 시퀀스) 미작동

---

## 7. 동기화 배치 주기 분석

### 현재: ❌ 배치 동기화 없음

```
웹훅만 존재:
- 이벤트 발생 시 즉시 Contact 생성/업데이트
- 배치 정정/재동기화 메커니즘 없음

문제:
1. 웹훅 실패 시 자동 재시도 없음 (DLQ 큐에만 저장)
2. GmUser 이후 수정 (customerStatus 등) → Contact 미업데이트
3. 고아 Contact/ContactLensClassification 미정정
```

### 필요한 배치 작업

#### Batch 1: GmUser → Contact 동기화
```sql
-- Daily 00:00 UTC (매일 자정)
UPDATE Contact c
SET 
  name = u.name,
  email = u.email,
  -- (추가) customerStatus 필드 필요
WHERE c.userId = u.id
  AND c.updatedAt < u.updatedAt
  AND u.updatedAt > NOW() - INTERVAL '24 hours'
```

#### Batch 2: 고아 Contact 정정
```sql
-- Weekly (매주 일요일 02:00 UTC)
UPDATE Contact SET userId = NULL
WHERE userId IS NOT NULL
  AND userId NOT IN (SELECT id FROM "User")
  AND updatedAt > NOW() - INTERVAL '7 days'
```

#### Batch 3: Contact.segment 재계산
```sql
-- Weekly (매주 일요일 03:00 UTC)
-- age, maritalStatus, childrenCount 기반 segment 재계산
UPDATE Contact SET segment = (
  CASE 
    WHEN age >= 25 AND age <= 35 AND maritalStatus='MARRIED' AND childrenCount=0 THEN 'A'
    WHEN age >= 40 AND age <= 50 AND childrenCount > 0 THEN 'B'
    ...
  END
)
WHERE segmentOverride IS NULL
  AND (segment IS NULL OR updatedAt > NOW() - INTERVAL '30 days')
```

#### Batch 4: ContactLensClassification 자동생성
```
-- Post-Contact creation 배치
-- Contact.id가 ContactLensClassification 없으면 생성
-- (단, Q1-Q5 데이터 필요 → 현재 저장 안됨)
```

---

## 8. 성능 최적화 필요사항

### 🔴 현재 N+1 쿼리 포인트

#### Issue 1: Contact 목록 + userId 조회
```typescript
// src/app/api/contacts/route.ts (GET /api/contacts)
const contacts = await prisma.contact.findMany({ ... });

// 각 contact.userId로 GmUser 조회 필요 시 → N+1
for (const c of contacts) {
  const user = await prisma.gmUser.findUnique({ where: { id: c.userId } });
}
```

**해결책**:
```typescript
// 배치 로드
const userIds = contacts
  .map(c => c.userId)
  .filter((id): id is number => id !== null && id !== undefined);

const userMap = new Map(
  (await prisma.gmUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, customerStatus: true },
  })).map(u => [u.id, u])
);

const contactsWithUser = contacts.map(c => ({
  ...c,
  gmUser: c.userId ? userMap.get(c.userId) : null,
}));
```

#### Issue 2: Contact별 ContactLensClassification 조회
```
GET /api/contacts/[id]/lens — 단일 조회만 지원
목록 조회 시 각 Contact의 렌즈 정보 필요 → N+1
```

**해결책**:
```typescript
// ContactLensClassification 배치 조회
const classificationMap = new Map(
  (await prisma.contactLensClassification.findMany({
    where: { contactId: { in: contactIds }, status: 'ACTIVE' },
    select: { contactId: true, lensType: true, confidenceScore: true },
  })).map(c => [c.contactId, c])
);
```

#### Issue 3: ContactLensSequence 조회
```
Contact → ContactLensClassification → ContactLensSequence
3단계 조인 시 배치 로드 필수
```

### 📊 권장 인덱스 추가

```sql
-- 현재 인덱스 (좋음)
ALTER TABLE "Contact" ADD INDEX idx_contact_org_assigned (organizationId, assignedUserId);
ALTER TABLE "Contact" ADD INDEX idx_contact_org_channel (organizationId, channel);
ALTER TABLE "Contact" ADD INDEX idx_contact_org_type (organizationId, type);

-- 추가 필요 (P0)
ALTER TABLE "Contact" ADD INDEX idx_contact_userId (userId);
-- 용도: GmUser 삭제 시 관련 Contact 찾기, 동기화 배치

ALTER TABLE "Contact" ADD INDEX idx_contact_segment_org (organizationId, segment);
-- 용도: 세그먼트별 고객 필터링

ALTER TABLE "ContactLensClassification" ADD INDEX idx_lens_contact_org (organizationId, contactId, status);
-- 용도: Contact별 활성 렌즈 분류 조회

ALTER TABLE "ContactLensSequence" ADD INDEX idx_seq_contact_status (contactId, organizationId, status);
-- 용도: Contact별 진행 중인 시퀀스 조회
```

---

## 9. 렌즈 분류 알고리즘 (설계 vs. 실제)

### 설계된 로직 (src/lib/lens-classifier/index.ts)

```typescript
export function classifyCustomerLens(
  responses: QuestionnaireResponse,  // Q1-Q5 (1-5점)
  callNotes?: string
): ClassificationResult {
  // 1. 키워드 감지 (콜노트 → 신호)
  const keywordSignals = detectKeywords(callNotes);
  
  // 2. 10개 렌즈 병렬 분류 (L1-L10)
  const scores = {
    L1: classifyL1(responses, keywordSignals),  // 부재중 재활성
    L2: classifyL2(responses, keywordSignals),  // 준비 복잡
    L3: classifyL3(responses, keywordSignals),  // 차별성 미인지
    ...
    L10: classifyL10(responses, keywordSignals), // 즉시 클로징
  };
  
  // 3. Bayesian 신뢰도 계산
  const confidenceScore = calculateBayesianConfidence(...);
  
  // 4. 우선도 계산
  const priority = calculatePriority(primaryLens);
  
  // 5. 권장 스크립트 + SMS 시퀀스
  const recommendedScript = getScriptTemplate(primaryLens);
  const smsSequenceKey = getSmsSequenceKey(primaryLens);
  
  return { primary_lens, secondary_lens, confidence_score, ..., };
}
```

### 실제 구현 (웹훅 & API)

```
❌ Contact 생성 시 classifyCustomerLens() 호출 안됨
❌ Q1-Q5 필드를 Contact/ContactLensClassification에 저장 안됨
❌ Contact.segment (A-E) vs. L1-L10 (렌즈) 혼용 문제

현재 segment 시스템:
- A-E: 인구통계학적 (나이, 결혼, 자녀)
- detectSegment()로 자동 감지 (나이 필수)

필요: segment + primaryLens 병행
- Contact.segment (A-E)
- ContactLensClassification.lensType (L0-L10)
```

---

## 10. 종합 개선 로드맵

### Phase 1: P0 (FK + 동기화)
- [ ] Contact.userId → GmUser.id FK 생성
- [ ] Purchase 웹훅에서 Contact.segment 설정
- [ ] Purchase 웹훅에서 Contact.assignedUserId 설정 (affiliateCode 기반)
- [ ] ContactLensClassification 자동 생성 파이프라인

### Phase 2: P1 (상태 동기화)
- [ ] Contact에 customerStatus, isHibernated, isLocked 필드 추가
- [ ] 일일 배치: GmUser → Contact 상태 동기화
- [ ] Contact.lastPaymentAt 설정 (Purchase 웹훅)
- [ ] N+1 쿼리 배치 로드 구현

### Phase 3: P2 (데이터 품질)
- [ ] Contact 중복 제거 전략 (phone global dedupe vs. 다중 org)
- [ ] 주간 배치: 고아 Contact 정정
- [ ] 주간 배치: Contact.segment 재계산
- [ ] 채널별 자동 분류 (inquiry → "inquiry", purchase → "b2c" 등)

### Phase 4: 렌즈 통합
- [ ] Contact에 Q1-Q5 필드 추가 (또는 별도 테이블)
- [ ] Contact 생성 시 classifyCustomerLens() 호출 (Web UI 폼)
- [ ] ContactLensClassification + ContactLensSequence 자동 생성
- [ ] SMS 자동화 파이프라인 (L0-L10별)

---

## 11. 쿼리 예제 & SQL

### 현재 상태 분석

```sql
-- 1. Contact 분포 (organizationId별)
SELECT 
  organizationId,
  COUNT(*) as total_contacts,
  COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN userId END) as linked_users,
  COUNT(DISTINCT CASE WHEN userId IS NULL THEN 1 END) as unlinked_contacts,
  COUNT(DISTINCT CASE WHEN segment IS NOT NULL THEN 1 END) as segmented
FROM Contact
GROUP BY organizationId;

-- 2. 고아 Contact (userId가 있지만 GmUser 없음)
SELECT 
  c.id, c.phone, c.name, c.userId, c.createdAt,
  u.id as gmuser_exists
FROM Contact c
LEFT JOIN "User" u ON c.userId = u.id
WHERE c.userId IS NOT NULL
  AND u.id IS NULL;

-- 3. Contact.segment 분포
SELECT 
  segment,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM Contact
WHERE deletedAt IS NULL
GROUP BY segment
ORDER BY count DESC;

-- 4. ContactLensClassification 현황
SELECT 
  lensType,
  COUNT(*) as count,
  ROUND(AVG(confidenceScore), 2) as avg_confidence,
  COUNT(DISTINCT CASE WHEN status = 'ACTIVE' THEN 1 END) as active
FROM ContactLensClassification
GROUP BY lensType
ORDER BY count DESC;

-- 5. Contact 생성 경로 분석 (channel별)
SELECT 
  channel,
  type,
  COUNT(*) as count,
  COUNT(DISTINCT CASE WHEN userId IS NOT NULL THEN 1 END) as with_userId,
  COUNT(DISTINCT CASE WHEN segment IS NOT NULL THEN 1 END) as with_segment
FROM Contact
WHERE deletedAt IS NULL
GROUP BY channel, type
ORDER BY count DESC;
```

### 개선 후 예상 쿼리

```sql
-- Contact + GmUser + ContactLensClassification 통합 조회 (배치 로드)
SELECT 
  c.id, c.phone, c.name, c.segment,
  u.id as gmuser_id, u.name as gmuser_name, u.customerStatus,
  clc.lensType, clc.confidenceScore, clc.status,
  cls.status as sequence_status, cls.day0Sent, cls.overallConverted
FROM Contact c
LEFT JOIN "User" u ON c.userId = u.id
LEFT JOIN ContactLensClassification clc 
  ON clc.contactId = c.id AND clc.status = 'ACTIVE'
LEFT JOIN ContactLensSequence cls 
  ON cls.classificationId = clc.id AND cls.status = 'PENDING'
WHERE c.organizationId = $1
  AND c.deletedAt IS NULL
ORDER BY c.updatedAt DESC
LIMIT 100;
```

---

## 12. 결론 & 핵심 발견

| 항목 | 현재 상태 | 문제 심각도 |
|:---|:---|:---|
| **GmUser → Contact FK** | 없음 (Int만 저장) | 🔴 P0 |
| **Contact.userId 동기화** | 이벤트 기반만 (배치 없음) | 🔴 P0 |
| **Contact.segment 웹훅** | 미설정 (필드 부족) | 🔴 P0 |
| **ContactLensClassification 자동생성** | 미구현 (파이프라인 없음) | 🔴 P0 |
| **GmUser 상태 동기화** | 없음 (customerStatus 미매핑) | 🟠 P1 |
| **N+1 쿼리** | 있음 (userId 배치 로드 없음) | 🟠 P1 |
| **고아 Contact** | 미검증 (정정 배치 없음) | 🟡 P2 |
| **중복 Contact** | 조직별 phone 중복 가능 | 🟡 P2 |

### 핵심 권장사항

1. **즉시 (이번 주)**:
   - Contact.userId FK 추가 (마이그레이션)
   - Purchase 웹훅에서 segment + assignedUserId 설정
   - 고아 Contact 현황 조사 (SELECT 쿼리)

2. **단기 (2주)**:
   - ContactLensClassification 자동 생성 파이프라인
   - GmUser → Contact 배치 동기화 (일일)
   - N+1 쿼리 배치 로드 구현

3. **중기 (1개월)**:
   - 렌즈 분류(L0-L10) 통합 (Q1-Q5 필드 추가)
   - SMS 자동화 파이프라인 (ContactLensSequence)
   - 데이터 품질 모니터링 대시보드

---

**분석 완료: 2026-05-21**
**범위: GmUser ↔ Contact 동기화 전체 메커니즘**
