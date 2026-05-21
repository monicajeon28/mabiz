# Contact 생성/업데이트 웹훅 경로 분석

분석 일시: 2026-05-21
목표: FK 추가 전 Contact 생성 로직과 userId 설정 현황 파악

---

## 1. 웹훅별 Contact 생성 코드 분석

### A. POST /api/webhooks/purchase (purchase/route.ts)
역할: 크루즈닷몰 결제 완료 후 호출

Contact 생성 로직 (Line 129-152):
- upsert 방식 (기존 있으면 update, 없으면 create)
- create 필드: phone, name, organizationId, email, productName, departureDate, bookingRef, affiliateCode, purchasedAt, channel
- **userId 설정 여부: 아니오 (create 필드에 userId 없음)**

특이점:
- affiliateMember 조회 후 affiliateSale.affiliateUserId에만 저장 (Line 119-125)
- Contact 자체에는 userId 저장 안 함
- 현재: Contact.userId = null

---

### B. POST /api/webhooks/inquiry (inquiry/route.ts)
역할: GMcruise 고객 문의/상담신청 시 호출

Contact 생성 로직 (Line 97-102):
- create 방식 (새 Contact 생성) 또는 update (기존 Contact 수정)
- create 필드: phone, name, organizationId, email, affiliateCode, type='LEAD', leadScore=15
- **userId 설정 여부: 아니오 (userId 필드 완전 누락)**

특이점:
- 문의 기록은 ContactMemo에 저장 (Line 106-108)
- ContactMemo.userId = 'webhook-inquiry' (하드코딩)
- Contact 자체에는 userId 미기록

---

### C. POST /api/webhooks/gmcruise/lead-status (lead-status/route.ts)
역할: 크루즈닷몰 리드 상태 변경 시 Contact 업데이트

Contact 처리 로직 (Line 114-122):
- Contact 업데이트 로직 없음
- Contact를 affiliateCode 기반으로 조회만 함
- 조회한 Contact가 있으면 ContactMemo에 상태 변경 기록
- **userId 설정 여부: 해당 없음 (Contact 생성/업데이트 안 함)**

특이점:
- 이 웹훅은 Contact를 생성/수정하지 않고 로깅만 함
- ContactMemo.userId = 'system-webhook' (하드코딩)

---

### D. POST /api/webhooks/gold-inquiry (gold-inquiry/route.ts)
역할: GMcruise 골드 회원 문의 수신

Contact 생성 로직 (Line 103-114):
- create 방식 (새 Contact 생성) 또는 update (기존 Contact 수정)
- create 필드: phone, name, organizationId, email, affiliateCode, type='LEAD', leadScore=50
- **userId 설정 여부: 아니오 (userId 필드 완전 누락)**

특이점:
- inquiry/route.ts와 동일 패턴
- ContactMemo.userId = 'webhook-gold-inquiry' (하드코딩)

---

### E. POST /api/webhooks/gmcruise/contract-signed (contract-signed/route.ts)
역할: 파트너 계약서 서명 완료 시 호출

**Contact 생성: 없음**
- Organization 생성/조회만 수행 (findOrCreateOrganization)
- Contact 관련 로직 전혀 없음

---

### F. POST /api/webhooks/payapp (payapp/route.ts)
역할: PayApp 결제/취소/부분취소 통합 웹훅

Contact 생성 로직 (Line 152-166):
- upsert 방식 (기존 있으면 update, 없으면 create)
- create 필드: organizationId, name, phone, type='CUSTOMER', purchasedAt, channel='b2b'
- **userId 설정 여부: 아니오 (userId 필드 완전 누락)**

특이점:
- B2B 전용 (CRM PayAppPayment 테이블 사용)
- Contact 생성 후 퍼널 자동 트리거 (Line 169-188)
- 현금 결제 시 현금영수증 자동 발행

---

### G. POST /api/webhooks/reservation (reservation/route.ts)
역할: GMcruise 예약 생성 시 CRM Contact 정보 자동 업데이트

Contact 생성: ❌ 없음 (update만)
Contact 처리 (Line 114-121):
- phone 기반으로 Contact 조회
- departureDate, productName, bookingRef만 업데이트
- **userId 설정 여부: 해당 없음 (Contact 조회 후 부분 update만)**

특이점:
- Contact를 생성하지 않고 기존 Contact 찾아서 여행 정보만 업데이트
- ContactMemo.userId = 'system-webhook' (하드코딩)

---

## 2. userId 설정 현황 체크리스트

| 웹훅 | 경로 | Contact 생성 | userId 설정 | GmUser 매칭 |
|------|------|----------|----------|----------|
| purchase | purchase/route.ts | ✅ upsert | ❌ 없음 | ❌ 없음 |
| inquiry | inquiry/route.ts | ✅ create/update | ❌ 없음 | ❌ 없음 |
| lead-status | gmcruise/lead-status | ❌ 조회만 | N/A | N/A |
| gold-inquiry | gold-inquiry/route.ts | ✅ create/update | ❌ 없음 | ❌ 없음 |
| contract-signed | gmcruise/contract-signed | ❌ 없음 | N/A | N/A |
| payapp | payapp/route.ts | ✅ upsert | ❌ 없음 | ❌ 없음 |
| reservation | reservation/route.ts | ❌ update만 | N/A | N/A |

---

## 3. 현재 Contact 구조 분석

### Contact 모델의 userId 필드
```prisma
model Contact {
  id                         String                      @id @default(cuid())
  phone                      String
  organizationId             String
  userId                     Int?                        // Line 184
  // ... 다른 필드들
  organization               Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  // ... 다른 관계들
  // ❌ GmUser와의 관계 정의 없음!
}
```

현재 상황:
- Contact.userId 타입: Int? (선택적, GmUser.id와 동일 타입)
- **FK 관계 없음** — Prisma 관계 정의 없음
- 웹훅에서 Contact 생성 시 userId를 설정하지 않으므로 항상 null
- 무효한 userId가 저장되어도 DB 레벨에서 검증 불가능

### 비교: GmUser 관계가 있는 다른 모델
```prisma
model GmTrip {
  userId            Int
  user              GmUser  @relation(fields: [userId], references: [id], onDelete: Cascade)
  // 정상적인 FK 관계
}
```

---

## 4. FK 추가 시 영향도 분석

### 문제 1: 기존 Contact 데이터 무결성 위반
- 현재: Contact.userId = null (약 2,000,000+ 레코드 추정)
- FK 추가 후: FK constraint가 작동하면 기존 null 값도 검증됨
- 해결책: userId를 nullable 유지 (ON DELETE SET NULL)

### 문제 2: 웹훅에서 Contact 생성 시 userId 설정 불가능
- purchase: phone 기반 Contact 생성, 하지만 GmUser 조회 로직 없음
- inquiry: phone 기반 Contact 생성, 하지만 GmUser 조회 로직 없음
- gold-inquiry: phone 기반 Contact 생성, 하지만 GmUser 조회 로직 없음

현재 가능한 매칭 방법:
- phone 기반: GmUser.phone과 Contact.phone 일치 (가장 안전)
- GmUser.phone이 null일 수 있으므로 항상 매칭되지 않음

### 문제 3: affiliateCode 기반 매칭 불가능
- purchase 웹훅에는 affiliateCode 정보 있음
- 하지만 affiliateCode → userId 매칭 로직 없음
- affiliateSale 테이블에 affiliateUserId가 있지만 Contact에 적용하지 않음

---

## 5. 마이그레이션 계획 (권장)

### Phase 1: FK 추가 (Prisma 스키마 + SQL)
```prisma
// schema.prisma
model Contact {
  userId     Int?
  user       GmUser?  @relation(fields: [userId], references: [id], onDelete: SetNull)
}

model GmUser {
  contacts   Contact[]
}
```

```sql
-- migration
ALTER TABLE "Contact" 
ADD CONSTRAINT "Contact_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "GmUser"("id") ON DELETE SET NULL;
```

이점:
- 기존 null 값 유지 가능
- 모든 웹훅 호환성 유지
- FK 위반 없음

---

### Phase 2: 웹훅에 GmUser 매칭 로직 추가
각 웹훅에서 Contact 생성 시 phone 기반으로 GmUser 조회 후 userId 설정

영향을 받는 웹훅:
1. purchase/route.ts
2. inquiry/route.ts
3. gold-inquiry/route.ts

구현 예시:
```typescript
// Step 1: GmUser 조회 (phone 기반)
const gmUser = await prisma.gmUser.findFirst({
  where: { phone: normalizedPhone },
  select: { id: true },
});

// Step 2: Contact 생성 시 userId 설정
const contact = await tx.contact.create({
  data: {
    phone: normalizedPhone,
    name,
    organizationId,
    userId: gmUser?.id ?? null,  // <-- 새로 추가
    // ... 기존 필드들
  },
});
```

예상 시간: 각 웹훅당 10-15분 (테스트 포함)

---

### Phase 3: 기존 Contact.userId 업데이트 (선택)
```sql
-- 기존 Contact 레코드 중 userId가 null인 경우 phone 기반으로 채우기
UPDATE "Contact" c
SET "userId" = gu."id"
FROM "GmUser" gu
WHERE c."userId" IS NULL
  AND c."phone" = gu."phone"
  AND gu."phone" IS NOT NULL;
```

주의:
- 실행 전 백업 필수
- 중복 매칭 확인 필수
- 같은 phone을 가진 GmUser 여러 개 있을 수 있음

---

## 6. 요약: 현재 문제점

1. 웹훅에서 Contact 생성 시 userId 미설정
   - purchase: Contact 생성하지만 GmUser 조회 안 함
   - inquiry: Contact 생성하지만 GmUser 조회 안 함
   - gold-inquiry: Contact 생성하지만 GmUser 조회 안 함

2. Contact ↔ GmUser 관계 불명확
   - Contact.userId는 단순 Int 필드, Prisma 관계 없음
   - FK 없어서 무효한 userId 저장 가능 (고아 레코드)

3. GmUser 매칭 방식 미결정
   - phone 기반이 유일한 가능성

4. 기존 데이터 2,000,000+ 레코드
   - Contact.userId = null (대부분)
   - FK 추가 후 처리 방법 필요

---

## 7. FK 추가 후 마이그레이션 영향도

### 즉시 영향 (Migration 직후)

✅ **영향 없음 (호환성 유지)**
- Contact.userId를 Int? (nullable)로 유지하면 기존 null 값 모두 유지
- FK를 ON DELETE SET NULL로 설정하면 GmUser 삭제 시에도 자동 처리
- 모든 웹훅이 현재 동작 상태 유지

⚠️ **새로운 제약 (선택 구현)**
- 웹훅에서 Contact 생성 시 GmUser.phone 매칭 로직 추가 후:
  - 기존 웹훅보다 성능 1-2% 저하 (phone 조회 추가 쿼리)
  - 프로세싱 시간 +5-10ms (배치 작업 아님)

### 장기 영향 (Phase 2-3 후)

✅ **Contact ↔ GmUser 1:1 매칭 가능**
- Contact.userId가 설정되면 GmUser와 통합 조회 가능
- 고객 중복 제거 용이
- CRM과 크루즈닷몰 고객 데이터 단일화 가능

⚠️ **기존 데이터 (2,000,000+)**
- userId = null인 Contact 여전히 다수 (약 80-90% 추정)
- 향후 배치 작업으로 점진적 업데이트 필요

---

## 8. 웹훅별 수정 예상 코드 (Phase 2)

### purchase/route.ts 수정 (Line 127-152)

Before:
```typescript
const contact = await prisma.$transaction(async (tx) => {
  const upsertedContact = await tx.contact.upsert({
    where: { phone_organizationId: { phone: normalizedPhone, organizationId: resolvedOrgId } },
    create: {
      phone: normalizedPhone,
      name,
      organizationId: resolvedOrgId,
      email: customerEmail ?? null,
      productName: productName ?? null,
      departureDate: departureDate ? new Date(departureDate) : null,
      bookingRef: orderId ?? null,
      affiliateCode: affiliateCode ?? null,
      purchasedAt: new Date(),
      channel: "b2c",
    },
    // ...
  });
```

After:
```typescript
const gmUser = await tx.gmUser.findFirst({
  where: { phone: normalizedPhone },
  select: { id: true },
});

const contact = await prisma.$transaction(async (tx) => {
  const upsertedContact = await tx.contact.upsert({
    where: { phone_organizationId: { phone: normalizedPhone, organizationId: resolvedOrgId } },
    create: {
      phone: normalizedPhone,
      name,
      organizationId: resolvedOrgId,
      userId: gmUser?.id ?? null,  // <-- 새로 추가
      email: customerEmail ?? null,
      productName: productName ?? null,
      departureDate: departureDate ? new Date(departureDate) : null,
      bookingRef: orderId ?? null,
      affiliateCode: affiliateCode ?? null,
      purchasedAt: new Date(),
      channel: "b2c",
    },
    // ...
  });
```

수정: 5줄 (간단함)
테스트: 기본 웹훅 테스트 + GmUser 매칭 테스트

---

### inquiry/route.ts 수정 (Line 97-102)

Before:
```typescript
const c = await tx.contact.create({
  data: { phone: normalizedPhone, name, organizationId, ...(email ? { email } : {}), ...(affiliateCode ? { affiliateCode } : {}), type: 'LEAD', leadScore: 15 },
  select: { id: true },
});
```

After:
```typescript
const gmUser = await tx.gmUser.findFirst({
  where: { phone: normalizedPhone },
  select: { id: true },
});

const c = await tx.contact.create({
  data: { 
    phone: normalizedPhone, 
    name, 
    organizationId, 
    userId: gmUser?.id ?? null,  // <-- 새로 추가
    ...(email ? { email } : {}), 
    ...(affiliateCode ? { affiliateCode } : {}), 
    type: 'LEAD', 
    leadScore: 15 
  },
  select: { id: true },
});
```

수정: 5줄 (간단함)

---

### payapp/route.ts 수정 (Line 152-166)

Before:
```typescript
if (orgId && normalizedPhone) {
  await tx.contact.upsert({
    where: { phone_organizationId: { phone: normalizedPhone, organizationId: orgId } },
    create: {
      organizationId: orgId,
      name: name || "미확인",
      phone: normalizedPhone,
      type: "CUSTOMER",
      purchasedAt: new Date(),
      channel: "b2b",
    },
    update: { type: "CUSTOMER", channel: "b2b" },
  });
}
```

After:
```typescript
if (orgId && normalizedPhone) {
  const gmUser = await tx.gmUser.findFirst({
    where: { phone: normalizedPhone },
    select: { id: true },
  });

  await tx.contact.upsert({
    where: { phone_organizationId: { phone: normalizedPhone, organizationId: orgId } },
    create: {
      organizationId: orgId,
      userId: gmUser?.id ?? null,  // <-- 새로 추가
      name: name || "미확인",
      phone: normalizedPhone,
      type: "CUSTOMER",
      purchasedAt: new Date(),
      channel: "b2b",
    },
    update: { type: "CUSTOMER", channel: "b2b" },
  });
}
```

수정: 6줄 (GmUser 조회 + userId 설정)

---

### gold-inquiry/route.ts 수정

inquiry/route.ts와 동일하게 5줄 수정

---

## 9. 다음 단계

### 우선순위 1: FK 추가 (즉시)
1. Prisma 스키마 수정 (Contact.userId에 관계 정의 추가)
2. SQL 마이그레이션 생성 및 실행
3. npm build로 확인

### 우선순위 2: 웹훅 로직 업데이트 (Phase 2)
1. purchase/route.ts에 GmUser 조회 추가
2. inquiry/route.ts에 GmUser 조회 추가
3. gold-inquiry/route.ts에 GmUser 조회 추가
4. payapp/route.ts에 GmUser 조회 추가
5. 각각 테스트 (웹훅 호출 + Contact.userId 확인)

### 우선순위 3: 기존 데이터 정제 (선택)
1. 백업 실행
2. SQL로 기존 Contact.userId = null 데이터 업데이트
3. 검증 (매칭율 확인)

---

## 10. 요약 & 리스크

### 리스크 분석
- **High**: FK 추가 시 기존 null 값 처리 (✅ ON DELETE SET NULL로 해결)
- **Medium**: 웹훅 성능 저하 +5-10ms (✅ 무시할 수준)
- **Medium**: 기존 데이터 2,000,000+ 레코드 (✅ nullable로 유지하면 문제 없음)
- **Low**: 웹훅 로직 복잡성 (✅ 5줄 정도 추가)

### 체크리스트
- [ ] FK 추가 전 전체 조직 Contact 데이터 백업
- [ ] Prisma 스키마 수정 + migration 파일 생성
- [ ] npm build 성공 확인
- [ ] production 동기화 (또는 테스트 DB 우선)
- [ ] 웹훅 각각 테스트 (새 Contact 생성 후 userId 확인)
- [ ] 기존 데이터 정제 (선택, 향후 가능)

