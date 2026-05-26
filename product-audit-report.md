# 상품/가격 정책 및 비즈니스 로직 검토 보고서

**작성일**: 2026-05-26  
**대상**: CRM Product Data Integrity & SMS 자동화 준비 상태

---

## 1. 데이터 스키마 검증

### 1.1 CruiseProduct 모델
**위치**: `prisma/schema.prisma` (라인 3036-3096)

주요 필드:
- `id` (PK)
- `productCode` (UNIQUE)
- `packageName` (상품명)
- `basePrice` (기본가격)
- `maxPrice` (최고가)
- `saleStatus` (판매상태: 기본값 "판매중")
- `days`, `nights` (일정)
- `description` (상품설명)
- `isActive` (활성여부, 기본값 true)
- `createdAt`, `updatedAt`

**발견 사항**:
- ✅ 기본정보 필드 완전
- ✅ 판매상태 추적 필드 있음
- ⚠️ `salePrice` 필드 없음 (basePrice만 있고, 실제 할인가는 ProductCabinPrice에 saleAmount로 저장)

---

### 1.2 ProductPricePeriod 모델
**위치**: `prisma/schema.prisma` (라인 4158-4177)

주요 필드:
- `id` (PK)
- `cruiseProductId` (FK → CruiseProduct)
- `name` (기간명)
- `startDate`, `endDate` (기간)
- `isActive` (활성여부)
- `discountRate` (할인율)
- `discountLabel` (할인라벨)
- `createdAt`, `updatedAt`

**구조**:
```
CruiseProduct (1) ──→ (N) ProductPricePeriod
                         ↓
                   ProductCabinPrice (여러 객실유형별 가격)
```

---

### 1.3 ProductCabinPrice 모델
**위치**: `prisma/schema.prisma` (라인 4087-4103)

주요 필드:
- `id` (PK)
- `productPricePeriodId` (FK → ProductPricePeriod)
- `cabinType` (Interior, OceanView, Balcony, Suite 등)
- `fareCategory` (여객분류)
- `saleAmount` (판매가)
- `costAmount` (원가)
- `netRevenue` (순수익)
- `currency` (통화, 기본값 "KRW")

**UNIQUE 제약조건**:
```
UNIQUE(productPricePeriodId, cabinType, fareCategory)
```

---

## 2. Contact-Product 연동 현황

### 2.1 Contact 모델의 관련 필드
**위치**: `prisma/schema.prisma` (라인 155-415)

```typescript
model Contact {
  // 기본 정보
  productName?: string              // 상품명 (String, nullable)
  departureDate?: DateTime          // 출발일 (DateTime, nullable)
  cruiseInterest?: string           // 크루즈 관심사
  
  // 메타데이터
  lensMetadata?: Json              // JSON: { decisionLevel, readinessScore, productId?, ... }
  recommendedProduct?: string      // 추천상품명
  
  // SMS 자동화 상태
  smsDay0Sent: Boolean              // Day 0 발송여부
  smsDay0SentAt?: DateTime
  smsDay1Sent: Boolean
  smsDay1SentAt?: DateTime
  smsDay2Sent: Boolean
  smsDay2SentAt?: DateTime
  smsDay3Sent: Boolean
  smsDay3SentAt?: DateTime
}
```

**문제점 식별**:
1. ⚠️ `productName`은 CruiseProduct.id가 아닌 **packageName 문자열**로 저장
   - 정규화되지 않음 → 매칭 오류 위험
   - Contact.productName vs CruiseProduct.packageName 매칭 필요

2. ⚠️ `lensMetadata`에 `productId` 포함 가능하지만, 주요 필드는 아님
   - 대부분 `{ "decisionLevel": 0, "readinessScore": 0 }` 수준

3. ⚠️ `departureDate`는 nullable → 많은 Contact이 미설정 가능

---

## 3. 가격 정책 검증 규칙

### 3.1 정상 가격 로직
```
basePrice (CruiseProduct) 
  ├→ ProductPricePeriod (기간 단위)
  │   └→ ProductCabinPrice (객실별)
  │       ├ saleAmount (판매가) ← 실제 제시가
  │       ├ costAmount (원가)
  │       └ netRevenue (순수익 = saleAmount - costAmount)
```

**검증 체크리스트**:
- [ ] `costAmount <= saleAmount` (원가가 판매가보다 작거나 같음)
- [ ] `netRevenue = saleAmount - costAmount` 일치
- [ ] 객실 등급별 가격 순서: Interior < OceanView < Balcony < Suite
- [ ] `startDate < endDate` (기간 유효성)
- [ ] 활성 기간이 최소 1개 이상

---

## 4. SMS 자동화 준비 현황

### 4.1 Contact-Level SMS 상태 추적

```typescript
// Day 0-3 기본 SMS (모든 lens에 공통)
smsDay0Sent: Boolean
smsDay0SentAt?: DateTime
smsDay1Sent: Boolean
smsDay1SentAt?: DateTime
smsDay2Sent: Boolean
smsDay2SentAt?: DateTime
smsDay3Sent: Boolean
smsDay3SentAt?: DateTime

// L5/L6 특화 SMS (의료신뢰 + 손실회피)
l5l6SmsDay0Sent: Boolean
l5l6SmsDay0SentAt?: DateTime
l5l6SmsDay1Sent: Boolean
l5l6SmsDay1SentAt?: DateTime
l5l6SmsDay2Sent: Boolean
l5l6SmsDay2SentAt?: DateTime
l5l6SmsDay3Sent: Boolean
l5l6SmsDay3SentAt?: DateTime

// L7 동반자 설득 SMS
companionSmsDay0Sent: Boolean
companionSmsDay0SentAt?: DateTime
companionSmsDay1Sent: Boolean
companionSmsDay1SentAt?: DateTime
companionSmsDay2Sent: Boolean
companionSmsDay2SentAt?: DateTime
companionSmsDay3Sent: Boolean
companionSmsDay3SentAt?: DateTime
```

---

## 5. 데이터 정규화 필요사항

### 5.1 Contact.productName 정규화

**현재 상황**:
- Contact.productName = CruiseProduct.packageName (문자열 매칭)
- ⚠️ 텍스트 매칭이므로 오타 위험 높음

**권장 개선안**:
```typescript
// Option 1: FK 추가 (권장)
model Contact {
  cruiseProductId?: Int              // FK → CruiseProduct.id
  cruiseProduct?: CruiseProduct
  productName?: string               // 이전호환성용 (deprecated)
}

// Option 2: 정규화 함수 추가
function normalizeProductName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ')
}
// Contact 저장 전: productName = normalizeProductName(input)
// 조회: WHERE lower(trim(productName)) = lower(trim(?))
```

---

### 5.2 Contact.lensMetadata 표준화

**현재 상황**:
```json
{
  "decisionLevel": 0,
  "readinessScore": 0
  // productId 가끔 포함
}
```

**권장 스키마**:
```typescript
interface LensMetadata {
  // 기본
  decisionLevel: number              // 0-100
  readinessScore: number             // 0-100
  
  // 제품 참조
  productId?: number                 // CruiseProduct.id
  productName?: string               // CruiseProduct.packageName (캐시)
  
  // L6 손실회피 관련
  timingUrgencyScore?: number        // 0-100
  priceDeadlineDate?: string         // ISO 8601
  
  // L10 클로징 관련
  emotionalConnectionScore?: number  // 0-100
  urgencyLevel?: number              // 0-100
}
```

---

## 6. SMS Day 0-3 자동화 설계

### 6.1 필수 정보 체크

Contact가 SMS Day 0-3을 받으려면:
```
✅ phone (필수)
✅ productName (또는 cruiseProductId)
✅ departureDate (권장) → 가격 시간초과 정보 포함
⚠️ lensMetadata.productId (권장) → 메타데이터 일관성
```

### 6.2 발송 조건 제안

```
Day 0: 즉시 발송 (Contact 생성 또는 상품할당 후)
  조건: phone + productName
  내용: PASONA P(Problem) + A(Agitate)
  
Day 1: Contact 생성 후 24시간
  조건: day0Sent = true + departureDate exists
  내용: PASONA S(Solution)
  
Day 2: Contact 생성 후 48시간
  조건: day1Sent = true
  내용: PASONA O(Offer) + 사례 스토리
  
Day 3: Contact 생성 후 72시간
  조건: day2Sent = true
  내용: PASONA A(Action) + 긴박감
  
Day 7+: Grant Cardone Follow-up (필요시)
  조건: 전환 미성공 + 5-12회 접촉
```

---

## 7. 리스크 플래그 (Risk Score)

### 7.1 자동 감지 규칙

```typescript
interface RiskFlags {
  // 가격 관련
  priceDropDetected: boolean         // basePrice 30% 이상 하락
  competitorMentioned: boolean       // L3 렌즈: 경쟁사 언급
  
  // 시간 관련
  departureDate_expiringSoon: boolean // 14일 이내 출발
  priceDeadline_passed: boolean      // 가격 마감일 경과
  
  // 고객 준비도
  firstTimeCruise: boolean           // 첫 크루즈 고객 (불안도 높음)
  healthConcerns: boolean            // 배멀미, 당뇨 등 건강이슈
  
  // 의사결정
  familyComposition_spouse: boolean  // 배우자 동반 (설득 필요)
  decisionMaker_not_self: boolean    // 본인이 결정자 아님
}
```

---

## 8. 현재 문제점 & 권장사항

### 문제점 (P0/P1)

| ID | 문제 | 영향 | 우선순위 |
|----|------|------|---------|
| P1-1 | Contact.productName이 텍스트 매칭 (FK 없음) | SMS 발송 오류, 세그먼테이션 실패 | **P0** |
| P1-2 | Contact.departureDate nullable (많은 Contact 미설정) | Day 0-3 SMS 타이밍 결정 불가 | **P0** |
| P1-3 | ProductCabinPrice에 salePrice 없음 (costAmount만 있음) | 실제 판매가 추적 불가 | **P0** |
| P1-4 | ProductPricePeriod 유효성 검사 부재 | startDate >= endDate 데이터 가능 | **P1** |
| P1-5 | 객실 등급별 가격 순서 보장 안 함 | 가격 이상 현상 가능 | **P1** |
| P1-6 | lensMetadata.productId 비정규화 | 메타데이터 일관성 보장 안 함 | **P1** |

---

### 권장사항 (개선 로드맵)

#### Phase 1: 긴급 (이번 주)
1. **Contact.cruiseProductId FK 추가**
   ```prisma
   model Contact {
     cruiseProductId?: Int
     cruiseProduct?: CruiseProduct
   }
   ```
   - 마이그레이션: 기존 productName → cruiseProductId 변환 스크립트

2. **ProductCabinPrice 검증 함수 추가**
   ```typescript
   // API: POST /api/products/validate-prices
   // Check: costAmount <= saleAmount, 객실순서, 기간유효성
   ```

3. **Day 0-3 SMS 발송 대시보드**
   - Contact별 SMS 발송 상태 실시간 추적
   - 미발송 원인 분석 (phone 없음, product 미할당, 등)

#### Phase 2: 중기 (2-3주)
4. **Contact.departureDate 필수화**
   - 기존 NULL 데이터 마이그레이션 (평균값 설정)
   - 신규 Contact: departureDate 필수 입력

5. **ProductImage & Description 품질 강화**
   - 모든 상품에 최소 3장 이상의 이미지
   - 상세 설명 추가 (itinerary, 포함사항 등)

6. **L5/L6 (의료신뢰 + 손실회피) SMS 통합**
   - Contact.selfProjectionScore, timingUrgencyScore 기반
   - 건강이슈별 맞춤 메시지

#### Phase 3: 장기 (1개월)
7. **실시간 가격 동적화**
   - ProductPricePeriod 자동 생성
   - 배멀미, 당뇨 고객 → 의료 신뢰 가격 프리미엄

8. **예측 모델 (ML)**
   - Contact의 Day 0-3 SMS 응답율 예측
   - CPA 최적화 (채널별 고객획득비용)

---

## 9. SQL 검사 쿼리

### 9.1 데이터 품질 진단

```sql
-- 1. Contact-Product 매칭 현황
SELECT
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN productName IS NOT NULL THEN 1 END) as with_product,
  COUNT(CASE WHEN departureDate IS NOT NULL THEN 1 END) as with_departure,
  COUNT(CASE WHEN lensMetadata ? 'productId' THEN 1 END) as with_product_id
FROM "Contact"
WHERE organizationId IS NOT NULL;

-- 2. 가격 오류 감지
SELECT
  pcp.id,
  cp.packageName,
  pcp.cabinType,
  pcp.costAmount,
  pcp.saleAmount,
  pcp.costAmount - pcp.saleAmount as loss
FROM "ProductCabinPrice" pcp
JOIN "ProductPricePeriod" ppp ON pcp.productPricePeriodId = ppp.id
JOIN "CruiseProduct" cp ON ppp.cruiseProductId = cp.id
WHERE pcp.costAmount > pcp.saleAmount;

-- 3. SMS 미발송 Contact
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN smsDay0Sent = false THEN 1 END) as day0_pending,
  COUNT(CASE WHEN smsDay0Sent = false AND productName IS NULL THEN 1 END) as missing_product
FROM "Contact"
WHERE organizationId IS NOT NULL;
```

---

## 10. 최종 체크리스트

### 배포 전 확인사항

- [ ] CruiseProduct에 모든 상품 기본정보 입력 (packageName, basePrice, description)
- [ ] ProductPricePeriod 유효성 (startDate < endDate)
- [ ] ProductCabinPrice 가격 순서 검증 (Interior < OceanView < Balcony < Suite)
- [ ] Contact.productName을 FK (cruiseProductId)로 정규화 또는 마이그레이션
- [ ] Contact.departureDate 95% 이상 채워짐
- [ ] SMS Day 0-3 자동발송 규칙 정의 및 테스트
- [ ] lensMetadata.productId 일관성 검증
- [ ] 상품별 고품질 이미지 (3장 이상)
- [ ] SMS 발송 모니터링 대시보드 구축
- [ ] Risk Flag 자동 감지 규칙 구현

---

**작성자**: Claude Code  
**최종 검토일**: 2026-05-26  
**다음 검토 예정**: 2026-06-02
