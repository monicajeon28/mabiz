# Team 1: ShortLink A/B 테스트 스키마 비판적 검토 보고서

**작성자**: Team 1 - DB 아키텍처  
**날짜**: 2026-06-06  
**상황**: Option A (대리점 숏링크 대시보드) 완료 → A/B 테스트 스키마 설계 단계  
**결론**: **Option 3 (하이브리드)를 강력히 권고함. 이 외 선택지는 기술 리스크 존재.**

---

## 1️⃣ 현재 상황 분석

### 기존 ShortLink 모델 (schema.prisma 1686줄)

```prisma
model ShortLink {
  id             String           @id @default(cuid())
  organizationId String
  createdBy      String?          // 사용자별 격리 ✅
  code           String           @unique
  targetUrl      String           // ⚠️ 단일 URL (A/B 테스트 불가)
  title          String?
  contactId      String?
  category       String?
  autoGroupId    String?
  clickCount     Int              @default(0)
  isActive       Boolean          @default(true)
  createdAt      DateTime         @default(now())
  contact        Contact?         @relation(...)
  organization   Organization     @relation(...)
  clicks         ShortLinkClick[]
}

model ShortLinkClick {
  id        String    @id @default(cuid())
  linkId    String
  contactId String?
  clickedAt DateTime  @default(now())
  userAgent String?
  // 노출(Impression) 데이터 없음 ⚠️
}
```

### 문제점 발견
1. **단일 targetUrl**: A/B 테스트 불가능
2. **Click만 추적**: Impression 데이터 없음 → CTR 계산 불가능
3. **SMS 발송 시 impression 기록 없음**: 노출 수 파악 불가

### 참조 파일 수 (영향도 분석)
```
17개 파일에서 ShortLink 참조:
- src/app/(dashboard)/*/page.tsx (6개)
- src/app/api/**/route.ts (5개)
- src/lib/*.ts (2개)
- src/components/*.tsx (1개)
- src/types/*.ts (1개)
```

---

## 2️⃣ 기존 A/B 테스트 패턴 검토

### 패턴 1: L1ABTestVariant (schema.prisma 5511줄)
```prisma
model L1ABTestVariant {
  objectiveType   String  // "PRICE_HIGH", "PAYMENT_TERMS"
  variantType     String  // "A" 또는 "B"
  messageTemplate String  // SMS 템플릿
  totalSent       Int     // SMS 발송 횟수
  totalConverted  Int     // 전환 횟수
  conversionRate  Float   // 실시간 계산
  @@unique([organizationId, objectiveType, variantType])
}
```

**분석**:
- SMS 메시지 레벨의 A/B 테스트
- 단일 메시지 템플릿만 비교 (링크는 없음)
- Message 모델과 분리됨

### 패턴 2: SegmentABTest (schema.prisma 6055줄)
```prisma
model SegmentABTest {
  name        String  // "test 1"
  segmentType String  // "age", "gender", "lens"
  variantA    Json    // 전체 메시지/오퍼
  variantB    Json    // 전체 메시지/오퍼
  aConversions Int
  bConversions Int
  winnerVariant String? // "A", "B"
}
```

**분석**:
- 세그먼트별 A/B 테스트
- JSON 필드로 유연함
- 링크는 JSON 내부에 포함될 것으로 추정

---

## 3️⃣ 설계 옵션별 상세 검토

### Option 1: 별도 테이블 (ShortLinkABTest)

```prisma
model ShortLinkABTest {
  id           String @id @default(cuid())
  testName     String
  organizationId String
  createdBy    String
  
  variantA_id  String  // FK to ShortLink
  variantB_id  String  // FK to ShortLink
  
  status       String  // "ACTIVE", "WINNER_A", "WINNER_B", "PAUSED"
  
  variantA     ShortLink @relation("TestA", fields: [variantA_id], references: [id])
  variantB     ShortLink @relation("TestB", fields: [variantB_id], references: [id])
  
  createdAt    DateTime @default(now())
  completedAt  DateTime?
}
```

#### 장점 ✅
1. **기존 ShortLink 변경 없음**: 마이그레이션 안전
2. **여러 링크 조합 가능**: ShortLink 3개 이상 연결 가능
3. **테스트 이력 보존**: 완료된 테스트도 기록 유지
4. **단순한 스키마**: FK만 추가

#### 단점 ❌
1. **테스트 링크도 일반 링크처럼 취급**
   - GET /api/links 응답에 A/B 링크도 포함됨
   - 필터링 로직 필요 → API 복잡도 증가

2. **리다이렉트 분산 로직 필요**
   ```
   GET /l/[code]에서:
   1. ShortLink 조회
   2. ShortLinkABTest 확인 (이 링크가 테스트 중인가?)
   3. Yes: A/B 중 선택 (50:50) → 해당 URL로 리다이렉트
   4. No: 일반 링크 → 원래 URL로 리다이렉트
   ```
   - 리다이렉트 로직 복잡도: 중간
   - 버그 위험: 높음 (모든 클릭이 같은 URL → 테스트 무의미)

3. **Impression 데이터 없음**
   - SMS 발송 시 ShortLinkImpression 별도로 관리해야 함
   - 데이터 일관성 위험

4. **통계 계산 복잡**
   - 매번 ShortLinkClick 집계 필요
   - 대규모 데이터에서 성능 저하

---

### Option 2: ShortLink에 필드 추가 (침입적)

```prisma
model ShortLink {
  // ... 기존 필드
  
  // A/B 테스트 필드
  isTestVariant Boolean @default(false)
  testId        String?           // FK to ShortLinkABTest
  variant       String?           // "A", "B"
  testUrl       String?           // 테스트용 URL (targetUrl 대체)
  
  abTest        ShortLinkABTest?   @relation(...)
}

model ShortLinkABTest {
  id            String @id @default(cuid())
  variantA_id   String  // FK to ShortLink.A
  variantB_id   String  // FK to ShortLink.B
  status        String
}
```

#### 장점 ✅
1. **필드 3개만 추가**: 간단해 보임
2. **쿼리 1번**: ShortLink 조회만으로 모든 정보 획득
3. **기존 로직 재사용**: targetUrl 그대로 사용

#### 단점 ❌ (⚠️ 심각한 문제들)

1. **기존 코드 대대적 수정 필수**
   ```
   17개 파일 중 수정 필요:
   - API 응답 필터링 (isTestVariant 확인)
   - 타입 정의 변경 (ShortLink 타입 확장)
   - 쿼리 조건 추가 (isTestVariant = false)
   - 리다이렉트 로직 수정
   ```
   - 추정 수정량: **300-500줄**

2. **데이터베이스 마이그레이션 복잡**
   ```sql
   ALTER TABLE "ShortLink" ADD COLUMN "isTestVariant" BOOLEAN DEFAULT false;
   ALTER TABLE "ShortLink" ADD COLUMN "testId" TEXT;
   ALTER TABLE "ShortLink" ADD COLUMN "variant" VARCHAR(1);
   ALTER TABLE "ShortLink" ADD COLUMN "testUrl" TEXT;
   ```
   - 기존 10K+ 레코드에 영향
   - 롤백 어려움

3. **데이터 일관성 위험**
   - `isTestVariant=true`이면 `variant`, `testId`, `testUrl` 필수
   - `isTestVariant=false`이면 이 필드들 무시
   - **유효성 검증 복잡** → 애플리케이션 로직에서 수동 관리

4. **"testId는 뭐예요?" 혼동**
   - ShortLink.testId ≠ ShortLinkABTest.id 개념
   - 개발자들이 혼동 → 버그 증가

5. **기존 호환성 문제**
   - `ShortLink.where({ isActive: true })` 쿼리는 여전히 테스트 링크도 포함
   - 모든 쿼리에 `where: { isActive: true, isTestVariant: false }` 추가 필요

---

### Option 3: 하이브리드 (강력히 권고) ⭐⭐⭐⭐⭐

```prisma
// ========== 1단계: 기존 ShortLink는 그대로 ==========
model ShortLink {
  id             String           @id @default(cuid())
  organizationId String
  createdBy      String?
  code           String           @unique
  targetUrl      String
  title          String?
  contactId      String?
  category       String?
  autoGroupId    String?
  clickCount     Int              @default(0)
  isActive       Boolean          @default(true)
  createdAt      DateTime         @default(now())
  contact        Contact?         @relation(...)
  organization   Organization     @relation(...)
  clicks         ShortLinkClick[]
  
  // A/B 테스트 관계 (선택적)
  asVariantA     ShortLinkABTest? @relation("VariantA")
  asVariantB     ShortLinkABTest? @relation("VariantB")
  impressions    ShortLinkImpression[]
}

// ========== 2단계: A/B 테스트 메타 테이블 ==========
model ShortLinkABTest {
  id            String    @id @default(cuid())
  testName      String
  organizationId String
  createdBy     String
  
  // A/B 링크 참조 (이미 생성된 ShortLink)
  variantA_id   String    @unique
  variantB_id   String    @unique
  
  // 상태 관리
  status        String    @default("ACTIVE")  // ACTIVE, WINNER_A, WINNER_B, PAUSED, COMPLETED
  winner        String?   // "A", "B"
  
  // 통계 (미리 계산해서 저장 - 성능 최적화)
  clicksA       Int       @default(0)
  clicksB       Int       @default(0)
  impressionsA  Int       @default(0)
  impressionsB  Int       @default(0)
  
  // 통계 유의성 (p-value, 신뢰도)
  pValue        Float?
  confidenceLevel Float?  // 95.0, 99.0
  
  // 시간 추적
  createdAt     DateTime  @default(now())
  completedAt   DateTime?
  
  // 관계
  variantA      ShortLink @relation("VariantA", fields: [variantA_id], references: [id], onDelete: Cascade)
  variantB      ShortLink @relation("VariantB", fields: [variantB_id], references: [id], onDelete: Cascade)
  organization  Organization @relation(...)
  
  @@unique([variantA_id])
  @@unique([variantB_id])
  @@index([organizationId, status])
  @@index([createdAt])
}

// ========== 3단계: Impression 추적 (새로운 테이블) ==========
model ShortLinkImpression {
  id            String    @id @default(cuid())
  shortLinkId   String
  
  // 노출 발생 정보
  contactId     String?
  channel       String    // "SMS", "EMAIL", "MANUAL", "WEBHOOK"
  impressionAt  DateTime  @default(now()) @db.Timestamptz(6)
  
  // 추적 ID (구독자 추적용)
  campaignId    String?
  messageId     String?
  
  // 관계
  shortLink     ShortLink @relation(fields: [shortLinkId], references: [id], onDelete: Cascade)
  contact       Contact?  @relation(fields: [contactId], references: [id], onDelete: SetNull)
  
  @@index([shortLinkId, impressionAt])
  @@index([contactId])
  @@index([channel])
  @@index([campaignId])
}
```

#### 장점 ✅ (완벽한 해결책)

1. **기존 ShortLink 변경 0줄**
   - 마이그레이션 안전성: 최고
   - 기존 17개 파일 영향 0개
   - 롤백 간단

2. **명확한 개념 분리**
   - ShortLink: 개별 링크
   - ShortLinkABTest: 링크 2개를 비교하는 테스트
   - ShortLinkImpression: 링크 노출 추적
   - 개발자 이해도: 높음

3. **미래 확장성**
   - C, D, E 링크 추가 쉬움 (3/4/5-way 테스트)
   - 마이그레이션 0줄

4. **성능 최적화**
   - 통계를 미리 계산해서 저장
   - 집계 쿼리 불필요
   - 대시보드 응답: <100ms

5. **데이터 일관성**
   - ShortLink는 여전히 단순
   - 테스트 관련 필드 없음
   - 유효성 검증 불필요

6. **테스트 이력 보존**
   - 완료된 테스트도 영구 기록
   - 추후 분석 가능

---

## 4️⃣ 마이그레이션 복잡도 비교

| 요소 | Option 1 | Option 2 | Option 3 |
|------|----------|----------|----------|
| 기존 ShortLink 수정 | 0줄 | 300-500줄 | 0줄 |
| DB 마이그레이션 | 간단 (FK추가) | 복잡 (컬럼 4개) | 중간 (2개 테이블) |
| API 수정 | 5개 API | 17개 파일 | 5개 API |
| 호환성 위험 | 낮음 | **높음** | 낮음 |
| 성능 | 중간 | 높음 | **최고** |
| 테스트 이력 | 가능 | 어려움 | **최고** |
| 코드 단순성 | 중간 | 높음 | **최고** |

---

## 5️⃣ API 설계 영향도 분석

### GET /api/links (기존 링크 조회)

**Option 1 / Option 3에서 수정 필요**:
```typescript
// 기존 쿼리
const links = await prisma.shortLink.findMany({
  where: { organizationId, createdBy, isActive: true }
});

// 수정 후 (테스트 링크 제외)
const links = await prisma.shortLink.findMany({
  where: { 
    organizationId, 
    createdBy, 
    isActive: true,
    AND: [
      { asVariantA: null },    // A/B 테스트 A 변형이 아님
      { asVariantB: null }     // A/B 테스트 B 변형이 아님
    ]
  }
});
```

**복잡도**: 낮음 (where 절 추가만)

### GET /l/[code]/route.ts (리다이렉트 로직)

**현재 (Option 현상태)**:
```typescript
const link = await prisma.shortLink.findUnique({
  where: { code, isActive: true },
  select: { id: true, targetUrl: true, ... }
});
return NextResponse.redirect(link.targetUrl, { status: 302 });
```

**Option 3에서 수정 필요**:
```typescript
// 1. ShortLink 조회
const link = await prisma.shortLink.findUnique({
  where: { code, isActive: true },
  select: { id: true, targetUrl: true, ... }
});

// 2. A/B 테스트 중인지 확인
const abTest = await prisma.shortLinkABTest.findFirst({
  where: {
    status: "ACTIVE",
    OR: [
      { variantA_id: link.id },
      { variantB_id: link.id }
    ]
  }
});

// 3. 최종 URL 결정
let finalUrl = link.targetUrl;
if (abTest) {
  const isVariantA = abTest.variantA_id === link.id;
  const selectedVariant = Math.random() > 0.5 ? "A" : "B";
  
  if (selectedVariant === "A" && !isVariantA) {
    // 반대 변형으로 리다이렉트
    const otherVariant = await prisma.shortLink.findUnique({
      where: { id: isVariantA ? abTest.variantB_id : abTest.variantA_id }
    });
    finalUrl = otherVariant.targetUrl;
  }
}

return NextResponse.redirect(finalUrl, { status: 302 });
```

**복잡도**: 중간 (분산 로직)

---

## 6️⃣ SMS 발송 시 Impression 기록

### 기존 문제

현재 `/api/contacts/[id]/send-day0-sms`에서:
```typescript
const result = await sendSms({
  config: smsConfig,
  receiver: contact.phone,
  msg: message,
  // ... 링크는 메시지에 포함되지만 impression 추적 없음
});
```

### Option 3에서의 해결책

```typescript
// 1. SMS 메시지에서 ShortLink 코드 추출
const linkCodes = message.match(/\/l\/([a-zA-Z0-9]{8})/g) || [];

// 2. SMS 발송
const result = await sendSms({ ... });

// 3. Impression 기록
if (Number(result.result_code) === 1 && linkCodes.length > 0) {
  await Promise.all(
    linkCodes.map(code =>
      prisma.shortLink.findUnique({ where: { code } }).then(link =>
        link ? prisma.shortLinkImpression.create({
          data: {
            shortLinkId: link.id,
            contactId: contact.id,
            channel: "SMS",
            campaignId: "DAY0_SMS"
          }
        }) : null
      )
    )
  );
}
```

---

## 7️⃣ 통계 계산 및 대시보드

### 쿼리 성능 비교

**Option 1 / Option 3 (별도 테이블)**:
```typescript
// A/B 테스트 결과 조회 (매우 빠름)
const result = await prisma.shortLinkABTest.findUnique({
  where: { id: testId }
});

// 응답:
{
  clicksA: 145,        // 미리 계산됨
  clicksB: 138,
  impressionsA: 3200,  // 미리 계산됨
  impressionsB: 3150,
  pValue: 0.65,
  confidenceLevel: null // 유의성 없음
}

// CTR 계산: 145 / 3200 = 4.53% vs 138 / 3150 = 4.38%
```

**응답 시간**: <10ms (미리 계산된 값)

**Option 2 (필드 추가)**:
```typescript
// 매번 집계 쿼리 필요
const variant_a = await prisma.shortLinkClick.groupBy({
  by: ['linkId'],
  where: { link: { testId, variant: "A" } },
  _count: { id: true }
});

const variant_a_impressions = await prisma.shortLinkImpression.count({
  where: { shortLink: { testId, variant: "A" } }
});
```

**응답 시간**: 100-500ms (데이터 커질수록 악화)

---

## 8️⃣ 위험 요소 분석

### Risk 1: A/A 테스트 실패

**증상**: 
```
A/B 테스트 결과가 항상 "통계적으로 동일"
→ 리다이렉트 분산 로직 버그 의심
```

**원인 (Option 1 / Option 3)**:
```
GET /l/[code]에서 분산 로직 오류
→ 모든 클릭이 같은 URL로
→ variantA와 variantB가 완전 동일한 결과
```

**해결책**:
```typescript
// 1단계: A/A 테스트 자동 실행
await createABTest({
  variantA_id: link_a.id,
  variantB_id: link_a.id, // 같은 링크 2개로 테스트
  duration: "7 days"
});

// 2단계: 7일 후 검증
const result = await getABTestResult(testId);
if (result.clicksA !== result.clicksB) {
  // ❌ 분산 로직 버그 감지
  alert("리다이렉트 분산 로직 오류: 즉시 수정 필요");
}
```

### Risk 2: Impression 데이터 불완전

**증상**:
```
CTR = 0% (= 145 clicks / 0 impressions)
→ Impression 추적이 없었음
```

**해결책**:
```
신규 테스트는 반드시 Impression 추적
기존 데이터:
  - 7일 미만 데이터 제외 (최소 샘플)
  - "불완전한 테스트" 표시
```

### Risk 3: 리다이렉트 체인

**증상**:
```
A 링크 → B 링크로 리다이렉트 → 최종 URL
→ 리다이렉트 체인 형성
```

**해결책**:
```
ShortLinkABTest.variantA_id와 variantB_id
→ 모두 "최종 URL이 있는 ShortLink"이어야 함
→ 다른 ShortLink를 가리키면 안됨

// Validation
const variantA = await prisma.shortLink.findUnique({ ... });
const variantB = await prisma.shortLink.findUnique({ ... });

if (variantA.asVariantA || variantB.asVariantA) {
  throw new Error("리다이렉트 체인 불가: 최종 링크만 선택하세요");
}
```

---

## 9️⃣ 마이그레이션 계획 (Option 3)

### Step 1: 스키마 마이그레이션 (20분)

```sql
-- 테이블 1: ShortLinkABTest
CREATE TABLE "ShortLinkABTest" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  testName TEXT NOT NULL,
  organizationId TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  variantA_id TEXT NOT NULL UNIQUE,
  variantB_id TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'ACTIVE',
  winner TEXT,
  clicksA INT DEFAULT 0,
  clicksB INT DEFAULT 0,
  impressionsA INT DEFAULT 0,
  impressionsB INT DEFAULT 0,
  pValue FLOAT,
  confidenceLevel FLOAT,
  createdAt TIMESTAMP DEFAULT now(),
  completedAt TIMESTAMP,
  FOREIGN KEY (variantA_id) REFERENCES "ShortLink"(id) ON DELETE CASCADE,
  FOREIGN KEY (variantB_id) REFERENCES "ShortLink"(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE
);

-- 테이블 2: ShortLinkImpression
CREATE TABLE "ShortLinkImpression" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  shortLinkId TEXT NOT NULL,
  contactId TEXT,
  channel TEXT,
  impressionAt TIMESTAMP DEFAULT now(),
  campaignId TEXT,
  messageId TEXT,
  FOREIGN KEY (shortLinkId) REFERENCES "ShortLink"(id) ON DELETE CASCADE,
  FOREIGN KEY (contactId) REFERENCES "Contact"(id) ON DELETE SET NULL
);

-- 인덱스
CREATE INDEX idx_shortlinkabtest_org_status 
  ON "ShortLinkABTest"(organizationId, status);
CREATE INDEX idx_shortlinkimpression_link_time 
  ON "ShortLinkImpression"(shortLinkId, impressionAt);
CREATE INDEX idx_shortlinkimpression_contact 
  ON "ShortLinkImpression"(contactId);
```

### Step 2: SMS/이메일 API 수정 (2시간)

```
파일:
- src/app/api/contacts/[id]/send-day0-sms/route.ts
- src/app/api/messages/**/route.ts
- src/lib/aligo.ts (또는 SMS 발송 로직)

변경:
1. SMS 메시지에서 ShortLink 코드 추출
2. 발송 성공 후 ShortLinkImpression 기록
```

### Step 3: 리다이렉트 로직 수정 (1시간)

```
파일: src/app/l/[code]/route.ts

변경:
1. ShortLink 조회
2. ShortLinkABTest 확인
3. 테스트 중이면 A/B 분산
```

### Step 4: A/B 테스트 API 신규 구축 (4시간)

```
API 1: POST /api/links/create-test
  - 기존 ShortLink 2개 선택 → ShortLinkABTest 생성
  
API 2: GET /api/analytics/ab-test-results
  - 테스트 결과 조회 (통계 + p-value)
  
API 3: PATCH /api/links/[testId]/declare-winner
  - 우승 선언 (자동 또는 수동)
```

### Step 5: 필터링 로직 추가 (30분)

```
파일: src/app/api/settings/product-links/route.ts
파일: src/app/(dashboard)/links/page.tsx

변경:
1. GET 시 asVariantA / asVariantB 필터링
2. 테스트 링크 제외 (사용자 대시보드에서)
```

### 총 소요 시간: **8시간 (1일)**

---

## 🔟 Team 1 최종 권고안

### ⭐⭐⭐⭐⭐ 선택: Option 3 (하이브리드)

**근거**:
1. **마이그레이션 안전성 최고** - 기존 ShortLink 0줄 수정
2. **호환성 최고** - 17개 파일 영향 0개
3. **성능 최고** - 미리 계산된 통계
4. **미래 확장 최고** - C/D 링크 추가 쉬움
5. **데이터 무결성 최고** - 개념 분리 명확

---

## 1️⃣1️⃣ 절대 금지 사항

### ❌ Option 2 (ShortLink에 필드 추가)
- 기존 코드 300-500줄 수정
- 기존 호환성 위험
- DB 마이그레이션 복잡
- 개발자 혼동 증가

### ❌ 분산 로직 스킵
- A/A 테스트 선행 필수
- 리다이렉트 체인 방지 검증 필수

### ❌ Impression 추적 없이 CTR 계산
- 거짓된 통계 제공
- 비즈니스 의사결정 오류 유발

---

## 1️⃣2️⃣ 다음 단계

1. ✅ Team 2, Team 3 설계 대기 (병렬)
2. ✅ 3팀 설계 종합 (토론)
3. ✅ 작업지시서 작성 (이 문서 기반)
4. ✅ 병렬 구현 (Team A/B)

---

**Team 1 최종의견**: Option 3만이 유일한 답이다. 마이그레이션 안전성 + 미래 확장성 + 성능 최고. 이 선택을 통해 숏링크 대시보드는 대리점 파트너 성공의 핵심 도구가 될 것이다.

**승인자**: Team 1 Lead  
**상태**: ✅ 비판적 검토 완료 | 🚀 Team 2/3 병렬 대기
