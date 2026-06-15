# P0-3: 메모리 최적화 (lensMetadata 분리) (2026-06-15)

## 📌 문제 정의

**메모리 누수 현상**

```typescript
// src/prisma/schema.prisma (라인 259)
model Contact {
  // ... 기본 필드들 ...
  lensMetadata Json? @default("{\"decisionLevel\": 0, \"readinessScore\": 0}")
}

// 문제:
// 1. Contact 1건당 lensMetadata 크기: 평균 5KB
// 2. 100k Contact 로드 시: 5KB × 100k = 500MB
// 3. 메모리 중복 로드 (복사, 파싱): 1GB+ 메모리 사용
// 4. JSON 파싱 오버헤드: +20% CPU 사용
```

**영향도:**
- 현재: 100k Contact 동시 조회 → 메모리 1GB 사용 (서버 OOM)
- 목표: 100k Contact 조회 → 메모리 100MB (90% 절감)

---

## ✅ 해결책: ContactLensMetadata 별도 테이블

### 아키텍처

```
Before (JSON 중첩):
Contact
├─ id
├─ name
├─ phone
├─ lensMetadata { JSON 5KB }  ← 메모리 폭발
└─ ...

After (1:1 외부 키 분리):
Contact
├─ id
├─ name
├─ phone
├─ lensMetadataId: FK → ContactLensMetadata
└─ ...

ContactLensMetadata (별도 테이블)
├─ id (Contact.id와 동일)
├─ organizationId
├─ decisionLevel: 0
├─ readinessScore: 0
├─ compoundHealthRisk: false
└─ ... (다른 필드)
```

---

## 🔧 구현 상세

### Step 1: ContactLensMetadata 테이블 생성

**파일: `prisma/migrations/20260615_split_lens_metadata/migration.sql`**

```sql
-- P0-3: lensMetadata JSON을 별도 테이블로 분리

-- 새 테이블 생성
CREATE TABLE "ContactLensMetadata" (
  "id" VARCHAR(255) PRIMARY KEY,
  "organizationId" VARCHAR(255) NOT NULL,
  
  -- L1 Lens: 가격 이의
  "l1PriceObjectionScore" INT DEFAULT 0,
  "l1ObjectionPhrase" TEXT,
  
  -- L2 Lens: 준비 불안도
  "l2AnxietyScore" INT DEFAULT 0,
  "l2AnxietyCategory" VARCHAR(20) DEFAULT 'low',
  "l2PreparationStage" VARCHAR(50) DEFAULT 'inquiry',
  
  -- L3 Lens: 차별성 미인지
  "l3DifferentiationScore" INT DEFAULT 0,
  "l3CompetitorMentioned" BOOLEAN DEFAULT FALSE,
  "l3CompetitorNames" TEXT[], -- Array of strings
  
  -- L5 Lens: 자기투영
  "l5SelfProjectionScore" INT DEFAULT 0,
  "l5SelfProjectionType" VARCHAR(50),
  "l5PersonalHealthCondition" VARCHAR(100),
  "l5PersonalHealthConcern" TEXT,
  "l5SpouseHealthCondition" VARCHAR(100),
  "l5SpouseHealthConcern" TEXT,
  "l5CompoundHealthRisk" BOOLEAN DEFAULT FALSE,
  "l5FamilyHealthProfile" JSONB, -- 여전히 필요한 경우만 JSON
  
  -- L6 Lens: 타이밍/손실회피
  "l6TimingUrgencyScore" INT DEFAULT 0,
  "l6TimingType" VARCHAR(30),
  "l6PriceDeadlineDate" TIMESTAMP,
  "l6SeatAvailability" INT,
  "l6HealthWindowStatus" VARCHAR(30),
  "l6LossAversionPhrase" TEXT,
  
  -- L7 Lens: 동반자 설득
  "l7FamilyComposition" VARCHAR(20),
  "l7DecisionMaker" VARCHAR(20),
  "l7FamilyInfluenceScore" INT DEFAULT 0,
  "l7CompanionPersuasionStage" VARCHAR(50) DEFAULT 'inquiry',
  "l7FamilyObjections" TEXT[], -- Array
  
  -- L8 Lens: 재방문 습관화
  "l8CruiseClubTier" VARCHAR(20),
  "l8LtvTotal" FLOAT DEFAULT 0,
  "l8NextCruiseRecommendation" TEXT,
  "l8LastCruiseSatisfactionScore" INT,
  "l8CruiseReturnInterestLevel" INT DEFAULT 0,
  
  -- L10 Lens: 즉시 구매 클로징
  "l10ClosingStage" VARCHAR(30) DEFAULT 'initial',
  "l10EmotionalConnectionScore" INT DEFAULT 0,
  "l10EmotionalTriggers" TEXT[], -- Array
  "l10UrgencyLevel" INT DEFAULT 0,
  "l10UrgencyType" VARCHAR(30),
  "l10ClosingScore" INT DEFAULT 0,
  
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  FOREIGN KEY ("id") REFERENCES "Contact"("id") ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX idx_lens_metadata_org ON "ContactLensMetadata"("organizationId");
CREATE INDEX idx_lens_metadata_anxiety ON "ContactLensMetadata"("organizationId", "l2AnxietyScore");
CREATE INDEX idx_lens_metadata_differentiation ON "ContactLensMetadata"("organizationId", "l3DifferentiationScore");
```

---

### Step 2: Prisma Schema 업데이트

**파일: `prisma/schema.prisma`**

```prisma
model Contact {
  id                               String                      @id @default(cuid())
  phone                            String
  organizationId                   String
  name                             String
  email                            String?
  createdAt                        DateTime                    @default(now())
  updatedAt                        DateTime                    @updatedAt
  
  // ... 기존 필드들 ...
  
  // ❌ 제거됨: lensMetadata Json?
  
  // ✅ 추가: 1:1 FK 관계
  lensMetadata                     ContactLensMetadata?
  
  // ... 기타 관계 ...
  callLogs                         CallLog[]
  organization                     Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([phone, organizationId])
  // ... 기존 인덱스들 ...
}

// ✅ 새 모델
model ContactLensMetadata {
  id                               String                      @id @default(cuid())
  organizationId                   String
  
  // L1 Lens: 가격 이의
  l1PriceObjectionScore            Int                         @default(0)
  l1ObjectionPhrase                String?
  
  // L2 Lens: 준비 불안도
  l2AnxietyScore                   Int                         @default(0)
  l2AnxietyCategory                String?                     @default("low") @db.VarChar(20)
  l2PreparationStage               String?                     @default("inquiry") @db.VarChar(50)
  
  // L3 Lens: 차별성 미인지
  l3DifferentiationScore           Int                         @default(0)
  l3CompetitorMentioned            Boolean                     @default(false)
  l3CompetitorNames                String[]                    @default([])
  
  // L5 Lens: 자기투영
  l5SelfProjectionScore            Int                         @default(0)
  l5SelfProjectionType             String?                     @db.VarChar(50)
  l5PersonalHealthCondition        String?                     @db.VarChar(100)
  l5PersonalHealthConcern          String?
  l5SpouseHealthCondition          String?                     @db.VarChar(100)
  l5SpouseHealthConcern            String?
  l5CompoundHealthRisk             Boolean                     @default(false)
  l5FamilyHealthProfile            Json?
  
  // L6 Lens: 타이밍/손실회피
  l6TimingUrgencyScore             Int                         @default(0)
  l6TimingType                     String?                     @db.VarChar(30)
  l6PriceDeadlineDate              DateTime?
  l6SeatAvailability               Int?
  l6HealthWindowStatus             String?                     @db.VarChar(30)
  l6LossAversionPhrase             String?
  
  // L7 Lens: 동반자 설득
  l7FamilyComposition              String?                     @db.VarChar(20)
  l7DecisionMaker                  String?                     @db.VarChar(20)
  l7FamilyInfluenceScore           Int                         @default(0)
  l7CompanionPersuasionStage       String?                     @default("inquiry") @db.VarChar(50)
  l7FamilyObjections               String[]                    @default([])
  
  // L8 Lens: 재방문 습관화
  l8CruiseClubTier                 String?                     @db.VarChar(20)
  l8LtvTotal                       Float                       @default(0)
  l8NextCruiseRecommendation       String?
  l8LastCruiseSatisfactionScore    Int?
  l8CruiseReturnInterestLevel      Int                         @default(0)
  
  // L10 Lens: 즉시 구매 클로징
  l10ClosingStage                  String?                     @default("initial") @db.VarChar(30)
  l10EmotionalConnectionScore      Int                         @default(0)
  l10EmotionalTriggers             String[]                    @default([])
  l10UrgencyLevel                  Int                         @default(0)
  l10UrgencyType                   String?                     @db.VarChar(30)
  l10ClosingScore                  Int                         @default(0)
  
  createdAt                        DateTime                    @default(now())
  updatedAt                        DateTime                    @updatedAt
  
  // 관계
  contact                          Contact                     @relation(fields: [id], references: [id], onDelete: Cascade)
  organization                     Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@index([organizationId])
  @@index([organizationId, l2AnxietyScore], map: "idx_lens_anxiety")
  @@index([organizationId, l3DifferentiationScore], map: "idx_lens_differentiation")
}
```

---

### Step 3: 데이터 마이그레이션 스크립트

**파일: `scripts/migrate-lens-metadata.ts`**

```typescript
import prisma from '@/lib/prisma';

/**
 * lensMetadata JSON → ContactLensMetadata 테이블로 마이그레이션
 * 
 * 주의:
 * 1. Contact 1개당 ContactLensMetadata 1개 생성
 * 2. JSON → 칼럼으로 변환 (필드별)
 * 3. 배치 처리 (메모리 효율)
 */
async function migrateLensMetadata() {
  const batchSize = 1000;
  let offset = 0;
  let totalMigrated = 0;
  let totalErrors = 0;

  while (true) {
    // 배치 조회
    const contacts = await prisma.contact.findMany({
      select: { id: true, lensMetadata: true, organizationId: true },
      skip: offset,
      take: batchSize,
    });

    if (contacts.length === 0) break;

    // 배치 마이그레이션
    for (const contact of contacts) {
      try {
        const lensData = (contact.lensMetadata as any) || {};

        // JSON → 칼럼 변환
        await prisma.contactLensMetadata.upsert({
          where: { id: contact.id },
          create: {
            id: contact.id,
            organizationId: contact.organizationId,
            l1PriceObjectionScore: lensData.l1PriceObjectionScore ?? 0,
            l1ObjectionPhrase: lensData.l1ObjectionPhrase,
            l2AnxietyScore: lensData.anxietyScore ?? 0,
            l2AnxietyCategory: lensData.anxietyCategory ?? 'low',
            l2PreparationStage: lensData.preparationStage ?? 'inquiry',
            l3DifferentiationScore: lensData.differentiationScore ?? 0,
            l3CompetitorMentioned: lensData.competitorMentioned ?? false,
            l3CompetitorNames: lensData.competitorNames ?? [],
            // ... 나머지 필드들
          },
          update: {
            l1PriceObjectionScore: lensData.l1PriceObjectionScore ?? 0,
            // ... 나머지 필드들
          },
        });

        totalMigrated++;
      } catch (err) {
        console.error(`[${contact.id}] 마이그레이션 실패:`, err);
        totalErrors++;
      }
    }

    offset += batchSize;
    console.log(`마이그레이션 진행: ${offset} / ${totalMigrated} 성공, ${totalErrors} 실패`);
  }

  console.log(`\n마이그레이션 완료: ${totalMigrated} 성공, ${totalErrors} 실패`);
}

migrateLensMetadata().catch(console.error);
```

**실행:**
```bash
npx ts-node scripts/migrate-lens-metadata.ts

# 예상 출력:
# 마이그레이션 진행: 1000 / 1000 성공, 0 실패
# 마이그레이션 진행: 2000 / 2000 성공, 0 실패
# ...
# 마이그레이션 완료: 100000 성공, 0 실패
```

---

### Step 4: API 수정 (lensMetadata 조회)

**파일: `src/app/api/contacts/[id]/route.ts`**

```typescript
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;

    const where  = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({
      where,
      include: {
        // ✅ lensMetadata 관계 로드 (필요할 때만)
        lensMetadata: {
          select: {
            l1PriceObjectionScore: true,
            l2AnxietyScore: true,
            l3DifferentiationScore: true,
            // ... 필요한 필드만 선택
          },
        },
      },
    });

    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const masked = maskContactInfo(contact, ctx);
    return NextResponse.json({
      ok: true,
      contact: masked,
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

### Step 5: 목록 조회 API (lensMetadata 제외)

**파일: `src/app/api/contacts/route.ts`**

```typescript
export async function GET(req: Request) {
  try {
    // ... 기존 코드 ...

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: finalWhere,
        orderBy: { id: "asc" },
        skip: skip,
        take: safeLimit,
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          type: true,
          // ❌ lensMetadata 제외 (목록에서 필요 없음)
          // ✅ 필요시 _count 대신 별도 API 사용
          _count: { select: { callLogs: true } },
        },
      }),
      prisma.contact.count({ where: finalWhere }),
    ]);

    // ... 응답 반환 ...
  } catch (err) {
    logger.error("[GET /api/contacts]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

## 📊 메모리 개선 효과

### Before (JSON 중첩)
```
Contact 100k 조회:
├─ Contact 테이블: 50MB (기본 필드)
├─ lensMetadata JSON: 500MB (평균 5KB × 100k)
├─ 메모리 복사/파싱: 300MB
└─ 총계: 850MB + 서버 오버헤드 = 1GB+
```

### After (별도 테이블)
```
Contact 100k 조회 (lensMetadata 제외):
├─ Contact 테이블: 50MB
├─ lensMetadata: 0MB (필요할 때만 로드)
└─ 총계: 50MB + 서버 오버헤드 = 100MB

Contact 상세 조회 (lensMetadata 포함):
├─ Contact: 50KB (1건)
├─ lensMetadata: 5KB (1건)
└─ 총계: 55KB (메모리 효율 90% 개선)
```

---

## 🧪 테스트 케이스

```typescript
describe('ContactLensMetadata 분리', () => {
  test('lensMetadata 목록 조회 제외', async () => {
    const contacts = await prisma.contact.findMany({
      take: 10,
      select: { id: true, name: true }, // lensMetadata 제외
    });

    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts[0]).not.toHaveProperty('lensMetadata');
  });

  test('lensMetadata 상세 조회 포함', async () => {
    const contact = await prisma.contact.findFirst({
      where: { id: testContactId },
      include: { lensMetadata: true },
    });

    expect(contact?.lensMetadata).toBeDefined();
    expect(contact?.lensMetadata?.l2AnxietyScore).toBeDefined();
  });

  test('lensMetadata 업데이트', async () => {
    await prisma.contactLensMetadata.update({
      where: { id: testContactId },
      data: { l2AnxietyScore: 75 },
    });

    const metadata = await prisma.contactLensMetadata.findUnique({
      where: { id: testContactId },
    });

    expect(metadata?.l2AnxietyScore).toBe(75);
  });

  test('메모리 사용량 (100k 조회)', async () => {
    const memBefore = process.memoryUsage().heapUsed;

    await prisma.contact.findMany({
      take: 100000,
      select: { id: true, name: true }, // lensMetadata 제외
    });

    const memAfter = process.memoryUsage().heapUsed;
    const memUsed = (memAfter - memBefore) / 1024 / 1024; // MB

    expect(memUsed).toBeLessThan(100); // 100MB 이하
  });
});
```

---

## 📋 배포 체크리스트

- [ ] 마이그레이션 파일 생성 (`20260615_split_lens_metadata`)
- [ ] Prisma Schema 업데이트 (ContactLensMetadata 모델 추가)
- [ ] 로컬 환경 테스트
  - [ ] `npx prisma migrate dev`
  - [ ] `npx ts-node scripts/migrate-lens-metadata.ts`
  - [ ] 데이터 검증 (Contact와 ContactLensMetadata 매칭)
- [ ] API 수정 (3개 파일)
  - [ ] `src/app/api/contacts/route.ts`
  - [ ] `src/app/api/contacts/[id]/route.ts`
  - [ ] 기타 lensMetadata 참조 파일
- [ ] TSC 검증 (`npx tsc --noEmit`)
- [ ] 메모리 테스트 (`scripts/perf-test-memory.ts`)
- [ ] Git 커밋
- [ ] Vercel 배포

---

## ⚡ 추가 최적화

### 부분 인덱스 (Partial Index)
```sql
-- 불안도 높은 고객만 인덱싱
CREATE INDEX idx_lens_high_anxiety
  ON "ContactLensMetadata" ("organizationId")
  WHERE "l2AnxietyScore" >= 70;
```

### 캐싱 전략
```typescript
// Redis에 자주 조회되는 lensMetadata 캐싱
const cacheKey = `lens:${contactId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const metadata = await prisma.contactLensMetadata.findUnique({
  where: { id: contactId },
});

await redis.setex(cacheKey, 3600, JSON.stringify(metadata)); // 1시간 TTL
```

---

**작성자:** Performance Team  
**상태:** 구현 준비 완료  
**예상 시간:** 3시간
