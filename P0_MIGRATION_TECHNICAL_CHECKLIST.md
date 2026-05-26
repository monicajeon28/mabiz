# P0 마이그레이션 기술 체크리스트
## 5/27-5/28 구현 계획서

**목표**: Contact FK 정규화 + departureDate 채우기 + GmReservation 링크  
**예상 시간**: 6-8시간 (병렬 작업 가능)  
**위험도**: 낮음 (롤백 계획 있음)

---

## 📋 P0-1: Contact.productId FK 추가

### 1.1 스키마 변경

```prisma
// prisma/schema.prisma에 추가

model Contact {
  // 기존 필드들...
  productName              String?                    // ← 기존 (deprecated)
  
  // 신규 필드
  cruiseProductId          Int?                       // ← 신규 FK
  product                  CruiseProduct?             @relation("ContactProducts", fields: [cruiseProductId], references: [id], onDelete: SetNull)
  
  @@index([cruiseProductId])
}

model CruiseProduct {
  // 기존 필드들...
  
  // 신규 관계
  contacts                 Contact[]                  @relation("ContactProducts")
}
```

### 1.2 Prisma Migration 생성

```bash
# Terminal에서 실행
npx prisma migrate dev --name add_contact_product_fk

# 이름 입력 프롬프트:
# "add_contact_product_fk"
```

### 1.3 데이터 마이그레이션 SQL

```sql
-- 1. 텍스트 매칭으로 FK 채우기
UPDATE "Contact" c
SET cruiseProductId = cp.id
FROM "CruiseProduct" cp
WHERE c.productName IS NOT NULL
  AND cp.packageName = c.productName
  AND c.cruiseProductId IS NULL;

-- 2. 검증: 매칭 결과 확인
SELECT
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN cruiseProductId IS NOT NULL THEN 1 END) as with_product,
  COUNT(CASE WHEN productName IS NOT NULL AND cruiseProductId IS NULL THEN 1 END) as unmatched
FROM "Contact"
WHERE organizationId = 'org-test-001';

-- 예상 결과:
-- total_contacts: 20
-- with_product: 10+ (기대값)
-- unmatched: 0 (또는 적은 수)

-- 3. 매칭 안 된 것 확인
SELECT phone, name, productName, cruiseProductId
FROM "Contact"
WHERE productName IS NOT NULL
  AND cruiseProductId IS NULL
LIMIT 10;
```

### 1.4 테스트 (QA Environment)

```typescript
// src/__tests__/contact-product-fk.test.ts

import { prisma } from '@/lib/db';

describe('Contact.cruiseProductId FK', () => {
  it('should have valid FK references', async () => {
    const contacts = await prisma.contact.findMany({
      where: {
        cruiseProductId: { not: null },
      },
    });

    // 모든 FK가 실제 상품을 참조하는지 확인
    for (const contact of contacts) {
      const product = await prisma.cruiseProduct.findUnique({
        where: { id: contact.cruiseProductId! },
      });
      expect(product).toBeDefined();
    }
  });

  it('should match productName with product.packageName', async () => {
    const contact = await prisma.contact.findFirst({
      where: {
        productName: { not: null },
        cruiseProductId: { not: null },
      },
      include: { product: true },
    });

    if (contact) {
      expect(contact.product!.packageName).toBe(contact.productName);
    }
  });
});
```

### 1.5 체크리스트

- [ ] Prisma schema 수정 (model Contact + CruiseProduct)
- [ ] Migration 파일 생성 및 검증
- [ ] QA 환경에서 migration 실행
- [ ] SQL 데이터 마이그레이션 쿼리 실행
- [ ] 매칭 결과 검증 (위 SQL 결과 확인)
- [ ] 테스트 케이스 작성 및 통과
- [ ] Prisma client 재생성 (`npx prisma generate`)
- [ ] 프로덕션 환경 마이그레이션 계획 (오프-피크 시간)

**소요 시간**: 2-3시간

---

## 📋 P0-2: Contact.departureDate 채우기

### 2.1 현황 진단

```sql
-- 현재 departureDate 상태 확인
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN departureDate IS NOT NULL THEN 1 END) as filled,
  COUNT(CASE WHEN departureDate IS NULL THEN 1 END) as empty,
  ROUND(100.0 * COUNT(CASE WHEN departureDate IS NOT NULL THEN 1 END) / COUNT(*), 2) as fill_rate
FROM "Contact"
WHERE organizationId = 'org-test-001';

-- 예상 결과: fill_rate 50-80% (또는 0%)
```

### 2.2 데이터 채우기 전략 (3가지)

#### 전략 A: GmReservation.trip.departureDate와 동기화

```sql
-- 전략 A: Reservation → Trip 경로로 departure 조회
UPDATE "Contact" c
SET departureDate = t."departureDate"
FROM "Traveler" tr
INNER JOIN "Reservation" r ON tr."reservationId" = r.id
INNER JOIN "Trip" t ON r."tripId" = t.id
WHERE c."bookingRef" = r."pnrNumber"::text
  AND c.departureDate IS NULL;

-- 검증
SELECT
  COUNT(*) as updated_count
FROM "Contact"
WHERE departureDate IS NOT NULL
  AND bookingRef IS NOT NULL;
```

#### 전략 B: GmUser 전화번호 기반 매칭

```sql
-- 전략 B: Contact.phone → GmUser.phoneNumber → Reservation 경로
UPDATE "Contact" c
SET departureDate = t."departureDate"
FROM "Traveler" tr
INNER JOIN "Reservation" r ON tr."reservationId" = r.id
INNER JOIN "Trip" t ON r."tripId" = t.id
INNER JOIN "User" u ON r."mainUserId" = u.id
WHERE c.phone = u."phoneNumber"
  AND c.departureDate IS NULL;
```

#### 전략 C: 기본값 설정 (Fallback)

```sql
-- 전략 C: 아직 미정 Contact에 기본값 설정 (1개월 뒤)
UPDATE "Contact"
SET departureDate = NOW() + INTERVAL '30 days'
WHERE departureDate IS NULL;
```

### 2.3 구현 순서

```typescript
// 1. 먼저 전략 A 시도 (가장 정확)
// 2. 그 다음 전략 B 시도 (2차 매칭)
// 3. 마지막 전략 C 적용 (기본값)

async function fillDepartureDates() {
  // Strategy A: Reservation 경로
  const strategyAUpdated = await prisma.$executeRaw`
    UPDATE "Contact" c
    SET departureDate = t."departureDate"
    FROM "Traveler" tr
    INNER JOIN "Reservation" r ON tr."reservationId" = r.id
    INNER JOIN "Trip" t ON r."tripId" = t.id
    WHERE c."bookingRef" = r."pnrNumber"::text
      AND c.departureDate IS NULL
  `;
  console.log(`Strategy A: ${strategyAUpdated} rows updated`);

  // Strategy B: User phone matching
  const strategyBUpdated = await prisma.$executeRaw`
    UPDATE "Contact" c
    SET departureDate = t."departureDate"
    FROM "Traveler" tr
    INNER JOIN "Reservation" r ON tr."reservationId" = r.id
    INNER JOIN "Trip" t ON r."tripId" = t.id
    INNER JOIN "User" u ON r."mainUserId" = u.id
    WHERE c.phone = u."phoneNumber"
      AND c.departureDate IS NULL
  `;
  console.log(`Strategy B: ${strategyBUpdated} rows updated`);

  // Strategy C: Default value (last resort)
  const strategyCUpdated = await prisma.$executeRaw`
    UPDATE "Contact"
    SET departureDate = NOW() + INTERVAL '30 days'
    WHERE departureDate IS NULL
      AND organizationId = 'org-test-001'
  `;
  console.log(`Strategy C: ${strategyCUpdated} rows updated`);

  // Final verification
  const result = await prisma.contact.groupBy({
    by: ['organizationId'],
    _count: {
      id: true,
      departureDate: 'filter: departureDate IS NOT NULL',
    },
  });

  console.log('Final departureDate fill rate:');
  console.log(result);
}
```

### 2.4 체크리스트

- [ ] departureDate 현황 진단 (위 SQL)
- [ ] 전략 선택: A / B / C 또는 조합
- [ ] 마이그레이션 쿼리 작성
- [ ] QA 환경 테스트
- [ ] 결과 검증 (fill_rate 확인)
- [ ] 데이터 정확도 샘플 확인 (10건)
- [ ] 프로덕션 배포

**소요 시간**: 2-3시간

---

## 📋 P0-3: GmReservation ↔ Contact 링크

### 3.1 스키마 변경

```prisma
// prisma/schema.prisma에 추가

model GmReservation {
  // 기존 필드들...
  
  // 신규 필드
  contactId              String?                     // ← 신규 FK
  contact                Contact?                    @relation("ReservationContacts", fields: [contactId], references: [id], onDelete: SetNull)
  
  @@index([contactId])
}

model Contact {
  // 기존 필드들...
  
  // 신규 관계
  reservations           GmReservation[]             @relation("ReservationContacts")
}
```

### 3.2 Prisma Migration

```bash
npx prisma migrate dev --name add_reservation_contact_fk
```

### 3.3 데이터 마이그레이션

```sql
-- 전략 1: Contact.phone + GmUser.phoneNumber 매칭
UPDATE "Reservation" r
SET "contactId" = c.id
FROM "Contact" c
INNER JOIN "User" u ON r."mainUserId" = u.id
WHERE c.phone = u."phoneNumber"
  AND r."contactId" IS NULL;

-- 전략 2: Contact.bookingRef + Reservation.pnrNumber 매칭
UPDATE "Reservation" r
SET "contactId" = c.id
FROM "Contact" c
WHERE c."bookingRef" = r."pnrNumber"::text
  AND r."contactId" IS NULL;

-- 검증
SELECT
  COUNT(*) as total_reservations,
  COUNT(CASE WHEN "contactId" IS NOT NULL THEN 1 END) as linked,
  ROUND(100.0 * COUNT(CASE WHEN "contactId" IS NOT NULL THEN 1 END) / COUNT(*), 2) as link_rate
FROM "Reservation";
```

### 3.4 테스트

```typescript
describe('GmReservation.contactId FK', () => {
  it('should link reservations to contacts', async () => {
    const reservation = await prisma.gmReservation.findFirst({
      where: { contactId: { not: null } },
      include: { contact: true },
    });

    expect(reservation?.contact).toBeDefined();
  });

  it('should be able to track conversion (Contact → Reservation)', async () => {
    const contact = await prisma.contact.findFirst({
      where: {
        reservations: { some: {} },
      },
      include: { reservations: true },
    });

    expect(contact?.reservations.length).toBeGreaterThan(0);
  });
});
```

### 3.5 체크리스트

- [ ] Prisma schema 수정 (GmReservation + Contact)
- [ ] Migration 파일 생성
- [ ] QA 환경 마이그레이션
- [ ] 데이터 마이그레이션 쿼리 실행
- [ ] 링크 결과 검증 (link_rate)
- [ ] 테스트 케이스 작성 및 통과
- [ ] Prisma client 재생성
- [ ] 프로덕션 마이그레이션 계획

**소요 시간**: 2-3시간

---

## 🧪 통합 테스트 체크리스트

### 4.1 P0-1 + P0-2 + P0-3 모두 적용 후 검증

```typescript
// integration-test.ts

async function validateP0Migration() {
  console.log('=== P0 Migration Validation ===\n');

  // 1. Contact.cruiseProductId FK 검증
  const contactsWithProduct = await prisma.contact.findMany({
    where: { cruiseProductId: { not: null } },
    include: { product: true },
  });
  console.log(`✓ Contacts with product: ${contactsWithProduct.length}`);

  // 2. Contact.departureDate 검증
  const contactsWithDeparture = await prisma.contact.findMany({
    where: { departureDate: { not: null } },
  });
  console.log(`✓ Contacts with departure: ${contactsWithDeparture.length}`);

  // 3. Contact → Reservation 링크 검증
  const contactsWithReservation = await prisma.contact.findMany({
    where: { reservations: { some: {} } },
    include: { reservations: true },
  });
  console.log(`✓ Contacts linked to reservations: ${contactsWithReservation.length}`);

  // 4. 3-way join 검증 (Contact → Product → Price)
  const contactWithProductPrice = await prisma.contact.findFirst({
    where: { cruiseProductId: { not: null } },
    include: {
      product: {
        include: {
          pricePeriods: true,
          cabinPrices: true,
        },
      },
    },
  });
  console.log(`✓ Contact → Product → Price chain: ${contactWithProductPrice ? 'OK' : 'FAIL'}`);

  // 5. Conversion tracking 검증
  const conversionTrackingTest = await prisma.contact.findFirst({
    where: {
      AND: [
        { cruiseProductId: { not: null } },
        { departureDate: { not: null } },
        { reservations: { some: {} } },
      ],
    },
    include: {
      product: true,
      reservations: true,
    },
  });
  console.log(`✓ Full conversion tracking: ${conversionTrackingTest ? 'OK' : 'PARTIAL'}`);

  console.log('\n=== All P0 migrations validated ===');
}
```

### 4.2 실행

```bash
# QA 환경에서
npx ts-node -O '{"module":"commonjs"}' integration-test.ts

# 프로덕션 환경에서 (배포 후)
NODE_ENV=production npx ts-node -O '{"module":"commonjs"}' integration-test.ts
```

---

## 🔄 롤백 계획

만약 P0 마이그레이션에 문제가 발생하면:

```sql
-- Rollback Strategy: Foreign Key 제거 (긴급 시에만)
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_cruiseProductId_fkey";
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_contactId_fkey";

-- 마이그레이션 되돌리기
npx prisma migrate resolve --rolled-back "add_contact_product_fk"
npx prisma migrate resolve --rolled-back "add_reservation_contact_fk"

-- 이후 재설계 후 다시 마이그레이션
```

---

## 📅 일정 계획

### Day 1 (5/27) - 오전

```
09:00 - 10:00: Requirement Review
  - 이 체크리스트 검토
  - 질문 사항 정리

10:00 - 11:30: Prisma Schema 설계 & Migration 생성
  - P0-1, P0-2, P0-3 스키마 최종 검증
  - Migration 파일 생성
  - QA 환경 적용

11:30 - 12:30: 데이터 마이그레이션 쿼리 작성
  - P0-1 FK 채우기 SQL
  - P0-2 departureDate 채우기 SQL
  - P0-3 Reservation 링크 SQL
```

### Day 1 (5/27) - 오후

```
13:00 - 15:00: 데이터 마이그레이션 실행 (QA)
  - 각 쿼리 실행
  - 결과 검증

15:00 - 16:30: 테스트 케이스 작성 및 실행
  - Unit tests
  - Integration tests

16:30 - 17:00: 최종 검증 및 리포트
  - 모든 마이그레이션 성공 확인
  - 다음 날 프로덕션 배포 계획
```

### Day 2 (5/28) - 오전

```
09:00 - 10:00: 프로덕션 준비
  - 백업 확인
  - 롤백 계획 검토

10:00 - 12:00: 프로덕션 마이그레이션
  - 저사용 시간대 (오전 10시)
  - Migration 실행
  - 실시간 모니터링

12:00 - 13:00: 배포 후 검증
  - 프로덕션 데이터 확인
  - SMS API 사전 테스트
```

---

## ✅ 최종 체크리스트

### P0-1 Contact.productId FK
- [ ] Schema 수정
- [ ] Migration 생성
- [ ] QA 테스트 통과
- [ ] 데이터 마이그레이션
- [ ] 프로덕션 배포
- [ ] 배포 후 검증

### P0-2 Contact.departureDate
- [ ] 현황 진단
- [ ] 전략 선택
- [ ] 마이그레이션 쿼리
- [ ] QA 테스트
- [ ] 프로덕션 배포
- [ ] 배포 후 검증

### P0-3 GmReservation ↔ Contact
- [ ] Schema 수정
- [ ] Migration 생성
- [ ] QA 테스트
- [ ] 데이터 마이그레이션
- [ ] 프로덕션 배포
- [ ] 배포 후 검증

### 통합 검증
- [ ] 3-way join 성공 (Contact → Product → Price)
- [ ] Conversion tracking 성공
- [ ] SMS API 사전 테스트
- [ ] 팀 리포트

---

## 📞 질문 & 의사결정

| 항목 | 질문 | 답변 | 담당 |
|------|------|------|------|
| DB 스키마 | Contact.cruiseProductId 타입은 Int (PK) 또는 String (UUID) 사용할지? | Int | DBA |
| 데이터 전략 | departureDate 기본값은 1개월(30d)? 3개월(90d)? | 3개월 | PM |
| 마이그레이션 | 프로덕션 시간은 언제가 좋을까? (오전 10시?) | 오전 10시 | DevOps |
| 롤백 | 롤백 필요 시 누가 실행하는가? | DBA | DBA |

---

**작성**: 2026-05-26 | **검토 필요**: 기술 리더 | **시작 예정**: 2026-05-27

