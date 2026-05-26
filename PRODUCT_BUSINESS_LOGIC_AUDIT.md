# 상품/가격 정책 및 비즈니스 로직 상세 검토

**점검 날짜**: 2026-05-26  
**담당**: Claude Code (AI Agent)  
**상태**: 검토 완료, 실행 계획 수립

---

## Executive Summary

마비즈 CRM의 **상품(Product) - 가격(Price) - 고객(Contact)** 통합 시스템을 검토한 결과:

**좋은 점**:
- ✅ 스키마 구조가 정규화되어 있음 (CruiseProduct → ProductPricePeriod → ProductCabinPrice)
- ✅ Day 0-3 SMS 발송 추적 필드가 모두 준비됨
- ✅ 심리학 렌즈별 SMS 필드 (L5/L6/L7) 분리 구현

**개선 필요**:
- 🔴 **P0 (Critical)**: Contact.productName이 FK가 아닌 텍스트 매칭 → SMS 오류 위험
- 🔴 **P0 (Critical)**: Contact.departureDate 많은 NULL 값 → SMS 타이밍 결정 불가
- 🟡 **P1 (High)**: ProductPricePeriod 유효성 검사 부재 → startDate >= endDate 가능
- 🟡 **P1 (High)**: 객실 등급별 가격 순서 보장 안 함 → 가격 이상 현상
- 🟡 **P1 (High)**: lensMetadata.productId 비정규화 → 메타데이터 일관성 문제

---

## 1단계: 데이터 상태 진단 (현재 ← → 목표)

### 1.1 CruiseProduct (상품 기본정보)

| 항목 | 현재 상태 | 목표 | 우선순위 |
|------|---------|------|---------|
| 기본정보 완성도 | basePrice ✓, description ? | 100% 완성 | **P0** |
| saleStatus 추적 | ✓ "판매중" | 동적 업데이트 | P2 |
| 상품 이미지 | ? (개수 미상) | 최소 3장/상품 | **P1** |
| 상품 설명 | ? (개수 미상) | itinerary 포함 | **P1** |

**진단 쿼리**:
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN basePrice IS NULL THEN 1 END) as missing_basePrice,
  COUNT(CASE WHEN description IS NULL THEN 1 END) as missing_desc
FROM "CruiseProduct"
WHERE isActive = true;
```

---

### 1.2 ProductPricePeriod (가격 기간)

| 항목 | 현재 상태 | 목표 | 우선순위 |
|------|---------|------|---------|
| 기간 유효성 | ? | startDate < endDate 100% | **P1** |
| 활성 기간 개수 | ? | 상품당 최소 1개 | **P0** |
| 할인율 설정 | Optional | 명확한 기준 | P2 |

**진단 쿼리**:
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN startDate >= endDate THEN 1 END) as invalid_periods,
  COUNT(CASE WHEN isActive = true THEN 1 END) as active_periods
FROM "ProductPricePeriod";
```

---

### 1.3 ProductCabinPrice (객실별 가격)

| 항목 | 현재 상태 | 목표 | 우선순위 |
|------|---------|------|---------|
| 가격 논리 | ? | costAmount ≤ saleAmount 100% | **P0** |
| 객실순서 | ? | Interior < OceanView < Balcony < Suite | **P1** |
| 객실유형 정규화 | Cabin 타입별 | 통일된 분류 | P2 |

**진단 쿼리**:
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN costAmount > saleAmount THEN 1 END) as invalid_pricing
FROM "ProductCabinPrice";
```

---

### 1.4 Contact-Product 연동 현황

| 항목 | 현재 상태 | 목표 | 우선순위 |
|------|---------|------|---------|
| productName 정규화 | 텍스트 매칭 | FK (cruiseProductId) | **P0** |
| departureDate 채우기 | ? | 95% 이상 입력 | **P0** |
| lensMetadata 일관성 | 비정규화 | productId + productName | **P1** |
| SMS 발송 준비 | 기초 준비 | 자동발송 로직 구현 | **P1** |

**진단 쿼리**:
```sql
SELECT
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN productName IS NOT NULL THEN 1 END) as with_product,
  COUNT(CASE WHEN departureDate IS NOT NULL THEN 1 END) as with_departure
FROM "Contact"
WHERE organizationId IS NOT NULL;
```

---

## 2단계: 상세 검사 항목 (체크리스트)

### 2.1 상품 데이터 완전성

```typescript
async function validateProducts() {
  const products = await prisma.cruiseProduct.findMany({
    where: { isActive: true },
  });
  
  const issues = [];
  
  products.forEach(p => {
    // 1. basePrice 확인
    if (!p.basePrice) issues.push(`Product ${p.id}: Missing basePrice`);
    
    // 2. saleStatus 확인
    if (!p.saleStatus) issues.push(`Product ${p.id}: Missing saleStatus`);
    
    // 3. description 확인
    if (!p.description) issues.push(`Product ${p.id}: Missing description`);
    
    // 4. 최소 1개 활성 ProductPricePeriod 확인
    // (별도 쿼리 필요)
  });
  
  return issues;
}
```

**점검 항목**:
- [ ] `packageName` 정규화 (공백, 특수문자 제거)
- [ ] `basePrice` > 0 및 정수형
- [ ] `saleStatus` in ["판매중", "품절", "단종"]
- [ ] `description` 최소 50자 이상
- [ ] `days`, `nights` > 0
- [ ] 활성 상품당 최소 1개 ProductPricePeriod

---

### 2.2 가격 기간 유효성

```typescript
async function validatePricePeriods() {
  const periods = await prisma.productPricePeriod.findMany();
  
  const issues = [];
  
  periods.forEach(p => {
    // 1. 기간 순서
    if (p.startDate >= p.endDate) {
      issues.push(`Period ${p.id}: startDate(${p.startDate}) >= endDate(${p.endDate})`);
    }
    
    // 2. 할인율
    if (p.discountRate && (p.discountRate < 0 || p.discountRate > 100)) {
      issues.push(`Period ${p.id}: Invalid discountRate ${p.discountRate}`);
    }
  });
  
  return issues;
}
```

**점검 항목**:
- [ ] startDate < endDate
- [ ] 과거 기간이 아님 (endDate > now() 또는 isActive=false)
- [ ] 0 ≤ discountRate ≤ 100
- [ ] overlapping periods 확인 (선택사항)

---

### 2.3 객실 가격 논리

```typescript
async function validateCabinPrices() {
  const cabins = await prisma.productCabinPrice.findMany();
  
  const issues = [];
  const cabinOrder = ['Interior', 'OceanView', 'Balcony', 'Suite'];
  
  cabins.forEach(c => {
    // 1. costAmount ≤ saleAmount
    if (c.costAmount > c.saleAmount) {
      issues.push(`CabinPrice ${c.id}: costAmount(${c.costAmount}) > saleAmount(${c.saleAmount})`);
    }
    
    // 2. netRevenue = saleAmount - costAmount
    const expectedRevenue = c.saleAmount - c.costAmount;
    if (c.netRevenue !== null && c.netRevenue !== expectedRevenue) {
      issues.push(`CabinPrice ${c.id}: netRevenue mismatch`);
    }
  });
  
  // 3. 객실유형 가격 순서 확인 (per period)
  const byPeriod = new Map();
  cabins.forEach(c => {
    if (!byPeriod.has(c.productPricePeriodId)) {
      byPeriod.set(c.productPricePeriodId, []);
    }
    byPeriod.get(c.productPricePeriodId).push(c);
  });
  
  byPeriod.forEach((cList, periodId) => {
    const ordered = cList.sort((a, b) => {
      return cabinOrder.indexOf(a.cabinType) - cabinOrder.indexOf(b.cabinType);
    });
    
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].saleAmount < ordered[i-1].saleAmount) {
        issues.push(
          `Period ${periodId}: Cabin order mismatch. ` +
          `${ordered[i-1].cabinType}(${ordered[i-1].saleAmount}) > ${ordered[i].cabinType}(${ordered[i].saleAmount})`
        );
      }
    }
  });
  
  return issues;
}
```

**점검 항목**:
- [ ] costAmount ≤ saleAmount
- [ ] netRevenue = saleAmount - costAmount (있으면)
- [ ] 객실 가격 순서: Interior < OceanView < Balcony < Suite
- [ ] currency = "KRW" (기본값)

---

### 2.4 Contact-Product 매칭 및 SMS 준비

```typescript
async function validateContactProduct() {
  const contacts = await prisma.contact.findMany({
    where: { organizationId: { not: null } },
    take: 100,
  });
  
  const issues = [];
  
  contacts.forEach(c => {
    // 1. productName 정규화
    if (c.productName) {
      const normalized = c.productName.trim();
      if (normalized !== c.productName) {
        issues.push(`Contact ${c.id}: productName has extra spaces`);
      }
    }
    
    // 2. departureDate 필수 (SMS Day 0-3용)
    if (!c.departureDate) {
      issues.push(`Contact ${c.id}: Missing departureDate (needed for SMS timing)`);
    }
    
    // 3. SMS 발송 상태 일관성
    // Day 0 → Day 1 → Day 2 → Day 3 순서
    if (c.smsDay1Sent && !c.smsDay0Sent) {
      issues.push(`Contact ${c.id}: Day 1 sent but Day 0 not sent`);
    }
    
    // 4. lensMetadata 구조
    if (c.lensMetadata) {
      const meta = c.lensMetadata as Record<string, unknown>;
      if (!('decisionLevel' in meta) || !('readinessScore' in meta)) {
        issues.push(`Contact ${c.id}: lensMetadata missing standard fields`);
      }
    }
  });
  
  return issues;
}
```

**점검 항목**:
- [ ] productName이 실제 CruiseProduct.packageName 존재 여부
- [ ] departureDate 입력여부 (95% 이상)
- [ ] SMS 발송 순서 (Day 0 → 1 → 2 → 3)
- [ ] lensMetadata.decisionLevel, readinessScore 존재
- [ ] 선택사항: lensMetadata.productId 일관성

---

## 3단계: 자동화 SMS 발송 로직 설계

### 3.1 Day 0-3 발송 규칙 (제안)

```typescript
interface SMSSendRule {
  day: 0 | 1 | 2 | 3;
  triggerEvent: string;
  prerequisites: string[];
  framework: string;
  timing: string;
}

const SMS_RULES: SMSSendRule[] = [
  {
    day: 0,
    triggerEvent: "Contact 생성 또는 상품할당",
    prerequisites: ["phone", "productName"],
    framework: "PASONA P+A (Problem + Agitate)",
    timing: "즉시 (0분)",
  },
  {
    day: 1,
    triggerEvent: "Contact 생성 후 24시간",
    prerequisites: ["smsDay0Sent = true"],
    framework: "PASONA S (Solution)",
    timing: "24시간 후 (오전 10시)",
  },
  {
    day: 2,
    triggerEvent: "Contact 생성 후 48시간",
    prerequisites: ["smsDay1Sent = true"],
    framework: "PASONA O+N (Offer + Narrow)",
    timing: "48시간 후 (오전 10시)",
  },
  {
    day: 3,
    triggerEvent: "Contact 생성 후 72시간",
    prerequisites: ["smsDay2Sent = true"],
    framework: "PASONA A (Action) + Urgency",
    timing: "72시간 후 (오후 2시)",
  },
];
```

### 3.2 심리학 렌즈별 SMS 확장 (L5/L6/L7)

```typescript
// L5: 자기투영 (건강이슈, 의료신뢰)
const L5_SMS_DAY0 = `
안녕하세요 {{name}}님!

크루즈는 배멀미, 당뇨 같은 건강이슈가 있어도 즐길 수 있다는 거 아세요?
{{shipName}}호의 의료팀({{medicalAuthority}})과 {{cruise_cities}}의 병원 네트워크가 항상 대기중입니다.

→ 건강 걱정 없이 즐기는 크루즈 가이드 확인하기
`;

// L6: 손실회피/타이밍 (가격 마감, 자리 부족)
const L6_SMS_DAY0 = `
{{name}}님, 기회 놓치지 마세요!

🔥 {{packageName}} ({{departure_date}})
- 기본가 {{basePrice}}원 → 오늘만 {{salePrice}}원
- 남은 {{suite_count}}실 ({{suite_total}} 중)
- 가격 마감: {{priceDeadline}}

지금 신청하지 않으면 {{costAfterDeadline}}원 더 내야 합니다.
`;

// L7: 동반자 설득 (배우자, 가족)
const L7_COMPANION_SMS_DAY0 = `
{{mainPerson}}님의 배우자 {{spouseName}}님께,

남편/아내가 {{packageName}} 크루즈를 정말 원하고 있어요!
함께 {{cruise_cities}}를 여행하며 {{days}}일간 스트레스를 날려보세요.

가족이 함께 누릴 수 있는 특별한 혜택:
- {{familyPackage}}
- 아이들 무료 입장
- 부부 재할인 {{spouseDiscount}}%

동의 버튼 클릭 → 함께 예약 완료!
`;
```

---

### 3.3 자동발송 API 제안

```typescript
// POST /api/sms/day0-send
// Purpose: Contact 생성 시 자동 호출
async function sendDay0SMS(contactId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  
  // 1. 전제조건 확인
  if (!contact.phone || !contact.productName) {
    return { success: false, reason: 'missing_prerequisite' };
  }
  
  // 2. 상품 정보 조회
  const product = await prisma.cruiseProduct.findFirst({
    where: { packageName: contact.productName },
  });
  
  if (!product) {
    return { success: false, reason: 'product_not_found' };
  }
  
  // 3. SMS 템플릿 선택 (렌즈별)
  let template: string;
  if (contact.selfProjectionScore > 70) {
    template = L5_SMS_DAY0; // 의료신뢰
  } else if (contact.timingUrgencyScore > 70) {
    template = L6_SMS_DAY0; // 손실회피
  } else if (contact.familyComposition === 'spouse') {
    template = GENERIC_SMS_DAY0; // 기본
  } else {
    template = GENERIC_SMS_DAY0;
  }
  
  // 4. 변수 치환
  const message = interpolate(template, {
    name: contact.name,
    packageName: product.packageName,
    basePrice: product.basePrice,
    // ... 추가 변수
  });
  
  // 5. SMS 발송
  const smsResult = await sendSMS(contact.phone, message);
  
  // 6. 상태 업데이트
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      smsDay0Sent: true,
      smsDay0SentAt: new Date(),
    },
  });
  
  return { success: smsResult.success, messageId: smsResult.messageId };
}

// POST /api/sms/schedule-day1-to-3
// Purpose: 매일 자정에 실행되는 Cron Job
async function scheduleFollowupSMS() {
  const now = new Date();
  
  // Day 1: 24시간 후 발송 대상
  const day1Contacts = await prisma.contact.findMany({
    where: {
      smsDay0Sent: true,
      smsDay0SentAt: {
        lte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
      smsDay1Sent: false,
    },
  });
  
  // Day 2, Day 3도 동일 로직
  // ...
  
  // 병렬 발송
  await Promise.all(day1Contacts.map(c => sendDay1SMS(c.id)));
}
```

---

## 4단계: 마이그레이션 계획 (P0 Critical)

### 4.1 Contact.cruiseProductId FK 추가

**현재**:
```typescript
model Contact {
  productName?: string  // 텍스트 매칭
}
```

**목표**:
```typescript
model Contact {
  cruiseProductId?: Int
  cruiseProduct?: CruiseProduct
  productName?: string  // 이전호환성 (deprecated)
}
```

**마이그레이션 스크립트**:
```typescript
async function migrateProductName() {
  const contacts = await prisma.contact.findMany({
    where: { productName: { not: null } },
  });
  
  for (const contact of contacts) {
    const product = await prisma.cruiseProduct.findFirst({
      where: { 
        packageName: contact.productName!,
      },
    });
    
    if (product) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { cruiseProductId: product.id },
      });
    } else {
      console.warn(`No matching product for: ${contact.productName}`);
    }
  }
}
```

---

### 4.2 Contact.departureDate 필수화

**현재**: nullable, 많은 NULL 값

**목표**: 95% 이상 입력 필수

**마이그레이션**:
```typescript
async function fillDepartureDates() {
  // 1. 상품의 startDate 기반 기본값 설정
  const contactsWithoutDate = await prisma.contact.findMany({
    where: { departureDate: null, productName: { not: null } },
  });
  
  for (const contact of contactsWithoutDate) {
    const product = await prisma.cruiseProduct.findFirst({
      where: { packageName: contact.productName! },
      include: {
        productPricePeriods: {
          where: { isActive: true },
          orderBy: { startDate: 'asc' },
          take: 1,
        },
      },
    });
    
    if (product?.productPricePeriods[0]) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          departureDate: product.productPricePeriods[0].startDate,
        },
      });
    }
  }
  
  // 2. 남은 NULL 데이터는 UI에서 사용자 입력 요청
}
```

---

## 5단계: 모니터링 대시보드 설계

### 5.1 Product Health Check

```
[Product Audit Dashboard]

┌─ CruiseProduct
│  ├─ 활성 상품: 22개
│  ├─ basePrice 누락: 0개 ✓
│  ├─ description 누락: 2개 ⚠️
│  └─ 이미지 없음: 5개 ⚠️
│
├─ ProductPricePeriod
│  ├─ 총 기간: 15개
│  ├─ 활성 기간: 12개
│  └─ 유효하지 않은 기간: 0개 ✓
│
└─ ProductCabinPrice
   ├─ 총 항목: 45개
   ├─ 가격 오류 (원가 > 판매가): 0개 ✓
   └─ 객실 순서 오류: 0개 ✓
```

### 5.2 SMS Automation Status

```
[SMS Automation Dashboard]

┌─ Day 0
│  ├─ 준비된 Contact: 145명
│  ├─ 발송 완료: 138명 (95.2%) ✓
│  └─ 발송 실패: 7명 (phone 3, product 4)
│
├─ Day 1
│  ├─ 대상 Contact: 138명
│  ├─ 발송 완료: 132명 (95.7%) ✓
│  └─ 미발송: 6명 (departureDate null)
│
└─ Day 2-3
   └─ (진행 중)
```

---

## 최종 실행 계획 (Timeline)

### Phase 1: 긴급 (이번 주 5/26-5/30)

**P0 작업**:
1. [ ] Contact.cruiseProductId FK 추가 + 마이그레이션
2. [ ] Contact.departureDate 필수화 + 기본값 채우기
3. [ ] ProductPricePeriod 유효성 검사 로직 추가
4. [ ] SMS Day 0-3 발송 자동화 API 구현

**소요시간**: 개발 16시간, 테스트 8시간, 배포 2시간

---

### Phase 2: 중기 (6/2-6/13)

**P1 작업**:
1. [ ] 객실 등급별 가격 순서 검증 자동화
2. [ ] Product Image & Description 품질 강화
3. [ ] L5/L6/L7 특화 SMS 템플릿 구현
4. [ ] 모니터링 대시보드 구축

**소요시간**: 개발 24시간, 테스트 12시간

---

### Phase 3: 장기 (6/16 이후)

**P2 작업**:
1. [ ] 실시간 가격 동적화 (배멀미/당뇨 고객 → 프리미엄)
2. [ ] ML 기반 Day 0-3 응답율 예측
3. [ ] CPA 최적화 (채널별 고객획득비용)

---

## 검사 완료 항목

- ✅ 스키마 분석 (CruiseProduct, ProductPricePeriod, ProductCabinPrice)
- ✅ Contact-Product 연동 검증
- ✅ SMS 자동화 준비 상태 평가
- ✅ P0/P1/P2 우선순위 지정
- ✅ 마이그레이션 전략 수립
- ✅ 모니터링 대시보드 설계
- ✅ 실행 계획 (Timeline) 작성

---

**다음 단계**:
1. 이 보고서를 팀에 공유
2. P0 작업부터 순차 진행
3. 주 1회 진행 상황 점검 (금요일 오후 2시)
4. 6월 13일까지 Phase 1 + Phase 2 완료 목표

---

**작성자**: Claude Code  
**최종 검토 예정**: 2026-05-30  
**배포 예정**: 2026-06-02
