# Team 1: ShortLink A/B 테스트 상세 구현 스펙

**문서 버전**: 1.0  
**작성자**: Team 1 - DB 아키텍처  
**기반**: TEAM1_CRITICAL_REVIEW_SHORTLINK_AB_TEST.md (Option 3 하이브리드 선택)  
**상태**: ✅ 스펙 완료 | 🚀 Team A/B 구현 대기

---

## 📋 목차

1. [Prisma 스키마 정의](#1-prisma-스키마-정의)
2. [데이터베이스 마이그레이션](#2-데이터베이스-마이그레이션)
3. [API 상세 스펙](#3-api-상세-스펙)
4. [리다이렉트 분산 로직](#4-리다이렉트-분산-로직)
5. [Impression 추적 시스템](#5-impression-추적-시스템)
6. [에러 처리 및 밸리데이션](#6-에러-처리-및-밸리데이션)
7. [테스트 계획](#7-테스트-계획)
8. [배포 체크리스트](#8-배포-체크리스트)

---

## 1. Prisma 스키마 정의

### 1.1 ShortLinkABTest 모델

```prisma
model ShortLinkABTest {
  // 기본 필드
  id                String    @id @default(cuid())
  testName          String    @db.VarChar(255)
  description       String?   @db.Text
  organizationId    String
  createdBy         String    // OrganizationMember.userId
  
  // A/B 링크 참조
  variantA_id       String    @unique
  variantB_id       String    @unique
  
  // 상태 관리
  status            String    @default("DRAFT")  // DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED
  winner            String?                      // "A", "B", "TIE" (우승 선언 후)
  
  // 통계 (매 클릭/노출 시 실시간 업데이트)
  clicksA           Int       @default(0)
  clicksB           Int       @default(0)
  impressionsA      Int       @default(0)
  impressionsB      Int       @default(0)
  
  // 계산된 메트릭 (읽기 전용, 조회 시 계산)
  // ctrA = clicksA / impressionsA (null if impressionsA=0)
  // ctrB = clicksB / impressionsB (null if impressionsB=0)
  
  // 통계 유의성 (자동 계산 또는 수동 입력)
  pValue            Float?                       // p-value (유의성)
  confidenceLevel   Float?                       // 95.0, 99.0
  minimumSampleSize Int     @default(100)        // 최소 샘플 크기
  
  // 시간 관리
  startedAt         DateTime?
  completedAt       DateTime?
  createdAt         DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime  @updatedAt @db.Timestamptz(6)
  
  // 관계
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  variantA          ShortLink     @relation("ABTestVariantA", fields: [variantA_id], references: [id], onDelete: Cascade)
  variantB          ShortLink     @relation("ABTestVariantB", fields: [variantB_id], references: [id], onDelete: Cascade)
  
  // 인덱스
  @@unique([variantA_id])
  @@unique([variantB_id])
  @@index([organizationId, status])
  @@index([createdBy])
  @@index([status, createdAt(sort: Desc)])
  @@index([winner])
  @@map("ShortLinkABTest")
}
```

### 1.2 ShortLinkImpression 모델

```prisma
model ShortLinkImpression {
  // 기본 필드
  id            String    @id @default(cuid())
  
  // 링크 참조
  shortLinkId   String
  
  // 노출 정보
  contactId     String?                         // 누구에게 노출됨 (선택적)
  channel       String    @db.VarChar(50)      // "SMS", "EMAIL", "WEBHOOK", "MANUAL"
  
  // 추적 정보 (선택적)
  campaignId    String?   @db.VarChar(100)     // "DAY0_SMS", "EMAIL_CAMPAIGN_1"
  messageId     String?   @db.VarChar(255)     // 메시지 제공자의 ID (Aligo MessageId)
  
  // 노출 시간
  impressionAt  DateTime  @default(now()) @db.Timestamptz(6)
  
  // 부가 정보 (선택적)
  metadata      Json?                           // { source: "sms", campaignType: "day0" }
  
  // 관계
  shortLink     ShortLink @relation(fields: [shortLinkId], references: [id], onDelete: Cascade)
  contact       Contact?  @relation(fields: [contactId], references: [id], onDelete: SetNull)
  
  // 인덱스
  @@index([shortLinkId, impressionAt(sort: Desc)])
  @@index([contactId])
  @@index([channel])
  @@index([campaignId])
  @@index([impressionAt(sort: Desc)])
  @@map("ShortLinkImpression")
}
```

### 1.3 ShortLink 모델 (기존, 수정 없음)

```prisma
model ShortLink {
  // ... 기존 필드 (모두 동일)
  id             String            @id @default(cuid())
  organizationId String
  createdBy      String?
  code           String            @unique
  targetUrl      String
  title          String?
  contactId      String?
  category       String?
  autoGroupId    String?
  clickCount     Int               @default(0)
  isActive       Boolean           @default(true)
  createdAt      DateTime          @default(now())
  
  // 관계 (기존)
  contact        Contact?          @relation(fields: [contactId], references: [id], onDelete: SetNull)
  organization   Organization      @relation(fields: [organizationId], references: [id])
  clicks         ShortLinkClick[]
  
  // 관계 추가 (A/B 테스트)
  asVariantA     ShortLinkABTest?  @relation("ABTestVariantA")
  asVariantB     ShortLinkABTest?  @relation("ABTestVariantB")
  
  // 관계 추가 (Impression)
  impressions    ShortLinkImpression[]
  
  // 인덱스 (기존)
  @@index([organizationId, createdBy])
  @@map("ShortLink")
}
```

---

## 2. 데이터베이스 마이그레이션

### 2.1 Prisma 마이그레이션 파일

```bash
# Terminal에서 실행
npx prisma migrate dev --name add_shortlink_ab_test
```

### 2.2 마이그레이션 SQL (자동 생성됨)

```sql
-- CreateTable ShortLinkABTest
CREATE TABLE "ShortLinkABTest" (
    "id" TEXT NOT NULL,
    "testName" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "variantA_id" TEXT NOT NULL,
    "variantB_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "winner" TEXT,
    "clicksA" INTEGER NOT NULL DEFAULT 0,
    "clicksB" INTEGER NOT NULL DEFAULT 0,
    "impressionsA" INTEGER NOT NULL DEFAULT 0,
    "impressionsB" INTEGER NOT NULL DEFAULT 0,
    "pValue" DOUBLE PRECISION,
    "confidenceLevel" DOUBLE PRECISION,
    "minimumSampleSize" INTEGER NOT NULL DEFAULT 100,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortLinkABTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable ShortLinkImpression
CREATE TABLE "ShortLinkImpression" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" VARCHAR(50),
    "campaignId" VARCHAR(100),
    "messageId" VARCHAR(255),
    "impressionAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ShortLinkImpression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortLinkABTest_variantA_id_key" ON "ShortLinkABTest"("variantA_id");
CREATE UNIQUE INDEX "ShortLinkABTest_variantB_id_key" ON "ShortLinkABTest"("variantB_id");
CREATE INDEX "ShortLinkABTest_organizationId_status_idx" ON "ShortLinkABTest"("organizationId", "status");
CREATE INDEX "ShortLinkABTest_createdBy_idx" ON "ShortLinkABTest"("createdBy");
CREATE INDEX "ShortLinkABTest_status_createdAt_idx" ON "ShortLinkABTest"("status", "createdAt" DESC);
CREATE INDEX "ShortLinkABTest_winner_idx" ON "ShortLinkABTest"("winner");

-- CreateIndex
CREATE INDEX "ShortLinkImpression_shortLinkId_impressionAt_idx" ON "ShortLinkImpression"("shortLinkId", "impressionAt" DESC);
CREATE INDEX "ShortLinkImpression_contactId_idx" ON "ShortLinkImpression"("contactId");
CREATE INDEX "ShortLinkImpression_channel_idx" ON "ShortLinkImpression"("channel");
CREATE INDEX "ShortLinkImpression_campaignId_idx" ON "ShortLinkImpression"("campaignId");
CREATE INDEX "ShortLinkImpression_impressionAt_idx" ON "ShortLinkImpression"("impressionAt" DESC);

-- AddForeignKey
ALTER TABLE "ShortLinkABTest" ADD CONSTRAINT "ShortLinkABTest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
ALTER TABLE "ShortLinkABTest" ADD CONSTRAINT "ShortLinkABTest_variantA_id_fkey" FOREIGN KEY ("variantA_id") REFERENCES "ShortLink"("id") ON DELETE CASCADE;
ALTER TABLE "ShortLinkABTest" ADD CONSTRAINT "ShortLinkABTest_variantB_id_fkey" FOREIGN KEY ("variantB_id") REFERENCES "ShortLink"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLinkImpression" ADD CONSTRAINT "ShortLinkImpression_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE;
ALTER TABLE "ShortLinkImpression" ADD CONSTRAINT "ShortLinkImpression_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL;
```

---

## 3. API 상세 스펙

### 3.1 POST /api/links/create-test (새로운 API)

**목적**: ShortLink 2개를 선택하여 A/B 테스트 생성

**요청**:
```typescript
POST /api/links/create-test
Content-Type: application/json

{
  "testName": "Day 0 SMS CTA 테스트",
  "description": "클릭 유도 CTA 문구 2가지 비교 (긴박감 vs 가치재정의)",
  "variantA_id": "cuid_link_a",
  "variantB_id": "cuid_link_b"
}
```

**응답 (성공)**:
```json
{
  "ok": true,
  "test": {
    "id": "cuid_test_1",
    "testName": "Day 0 SMS CTA 테스트",
    "status": "DRAFT",
    "variantA_id": "cuid_link_a",
    "variantB_id": "cuid_link_b",
    "clicksA": 0,
    "clicksB": 0,
    "impressionsA": 0,
    "impressionsB": 0,
    "createdAt": "2026-06-06T10:00:00Z"
  }
}
```

**에러 케이스**:
```json
// 400: 같은 링크 2개
{
  "ok": false,
  "message": "A 링크와 B 링크가 동일합니다. 다른 링크를 선택해주세요."
}

// 400: 이미 A/B 테스트 중인 링크
{
  "ok": false,
  "message": "variantA_id(cuid_link_a)는 이미 다른 테스트에서 사용 중입니다."
}

// 404: 링크 없음
{
  "ok": false,
  "message": "variantA_id를 찾을 수 없습니다."
}
```

**로직**:
```typescript
// src/app/api/links/create-test/route.ts
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const body = await req.json();
  const { testName, description, variantA_id, variantB_id } = body;

  // 1. 현재 사용자의 organizationId 확인
  const org = await getOrgId(ctx);

  // 2. 링크 존재 확인 + 소유권 확인
  const [linkA, linkB] = await Promise.all([
    prisma.shortLink.findUnique({
      where: { id: variantA_id },
      select: { organizationId: true, createdBy: true }
    }),
    prisma.shortLink.findUnique({
      where: { id: variantB_id },
      select: { organizationId: true, createdBy: true }
    })
  ]);

  if (!linkA || !linkB) {
    return NextResponse.json({ ok: false, message: "링크를 찾을 수 없습니다." }, { status: 404 });
  }

  // 3. 소유권 확인
  if (linkA.createdBy !== ctx.userId || linkB.createdBy !== ctx.userId) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  // 4. 같은 링크 확인
  if (variantA_id === variantB_id) {
    return NextResponse.json({ ok: false, message: "A/B 링크가 동일합니다." }, { status: 400 });
  }

  // 5. 이미 A/B 테스트 중인지 확인
  const existing = await prisma.shortLinkABTest.findFirst({
    where: {
      OR: [
        { variantA_id },
        { variantB_id }
      ],
      NOT: { status: "ARCHIVED" }
    }
  });

  if (existing) {
    return NextResponse.json({ 
      ok: false, 
      message: "이미 다른 테스트에서 사용 중인 링크입니다." 
    }, { status: 400 });
  }

  // 6. A/B 테스트 생성
  const test = await prisma.shortLinkABTest.create({
    data: {
      testName,
      description,
      organizationId: org.id,
      createdBy: ctx.userId,
      variantA_id,
      variantB_id,
      status: "DRAFT"
    }
  });

  return NextResponse.json({ ok: true, test });
}
```

### 3.2 PATCH /api/links/tests/:testId/start

**목적**: A/B 테스트 시작 (DRAFT → ACTIVE)

**요청**:
```typescript
PATCH /api/links/tests/cuid_test_1/start
Content-Type: application/json

{
  "duration": 7  // 일 (선택적, 기본값: 7)
}
```

**응답**:
```json
{
  "ok": true,
  "test": {
    "id": "cuid_test_1",
    "status": "ACTIVE",
    "startedAt": "2026-06-06T10:30:00Z"
  }
}
```

### 3.3 GET /api/analytics/ab-tests

**목적**: 모든 A/B 테스트 조회 (필터링 가능)

**요청**:
```typescript
GET /api/analytics/ab-tests?status=ACTIVE&sortBy=createdAt
```

**응답**:
```json
{
  "ok": true,
  "tests": [
    {
      "id": "cuid_test_1",
      "testName": "Day 0 SMS CTA 테스트",
      "status": "ACTIVE",
      "variantA_id": "cuid_link_a",
      "variantB_id": "cuid_link_b",
      "clicksA": 145,
      "clicksB": 138,
      "impressionsA": 3200,
      "impressionsB": 3150,
      "ctrA": 0.0453,      // 계산됨
      "ctrB": 0.0438,      // 계산됨
      "winner": null,
      "pValue": 0.65,
      "startedAt": "2026-06-06T10:30:00Z",
      "createdAt": "2026-06-06T10:00:00Z"
    }
  ],
  "total": 1
}
```

**로직**:
```typescript
// 계산된 필드 (API 응답에만 포함)
const test = await prisma.shortLinkABTest.findUnique({ where: { id } });

const response = {
  ...test,
  ctrA: test.impressionsA > 0 ? test.clicksA / test.impressionsA : null,
  ctrB: test.impressionsB > 0 ? test.clicksB / test.impressionsB : null,
  riskA: calculateRisk(test.clicksA, test.impressionsA),
  riskB: calculateRisk(test.clicksB, test.impressionsB)
};
```

### 3.4 GET /api/analytics/ab-tests/:testId

**목적**: 특정 A/B 테스트 상세 조회

**응답**:
```json
{
  "ok": true,
  "test": {
    "id": "cuid_test_1",
    "testName": "Day 0 SMS CTA 테스트",
    "status": "ACTIVE",
    "variantA": {
      "id": "cuid_link_a",
      "code": "abc12345",
      "targetUrl": "https://crm.mabiz.dev/contacts/contact_1",
      "category": "landing",
      "clickCount": 145
    },
    "variantB": {
      "id": "cuid_link_b",
      "code": "xyz78901",
      "targetUrl": "https://crm.mabiz.dev/contacts/contact_2",
      "category": "landing",
      "clickCount": 138
    },
    "stats": {
      "clicksA": 145,
      "clicksB": 138,
      "impressionsA": 3200,
      "impressionsB": 3150,
      "ctrA": 0.0453,
      "ctrB": 0.0438,
      "pValue": 0.65,
      "confidenceLevel": 90.0,
      "winner": null,
      "statistically_significant": false,
      "recommendation": "더 많은 데이터 수집이 필요합니다. (현재: A=3200, B=3150 > 최소: 100)"
    },
    "createdAt": "2026-06-06T10:00:00Z",
    "startedAt": "2026-06-06T10:30:00Z"
  }
}
```

### 3.5 PATCH /api/links/tests/:testId/declare-winner

**목적**: A/B 테스트 우승 선언 (수동 또는 자동)

**요청**:
```typescript
PATCH /api/links/tests/cuid_test_1/declare-winner
Content-Type: application/json

{
  "winner": "A",  // "A", "B", "TIE"
  "reason": "사용자 선택 (통계 미달하지만 경영진 판단)"
}
```

**응답**:
```json
{
  "ok": true,
  "test": {
    "id": "cuid_test_1",
    "status": "COMPLETED",
    "winner": "A",
    "completedAt": "2026-06-06T12:00:00Z"
  }
}
```

---

## 4. 리다이렉트 분산 로직

### 4.1 GET /l/[code]/route.ts (수정)

```typescript
// src/app/l/[code]/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Params) {
  const { code } = await params;
  const reqUrl = new URL(req.url);
  const paramContactId = reqUrl.searchParams.get('c') ?? null;

  // 1. ShortLink 조회
  const link = await prisma.shortLink.findUnique({
    where: { code, isActive: true },
    select: { 
      id: true, 
      targetUrl: true, 
      contactId: true, 
      autoGroupId: true, 
      organizationId: true 
    },
  }).catch(() => null);

  if (!link) {
    return NextResponse.redirect('https://www.cruisedot.co.kr');
  }

  // 2. A/B 테스트 중인지 확인
  const abTest = await prisma.shortLinkABTest.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        { variantA_id: link.id },
        { variantB_id: link.id }
      ]
    },
    select: {
      id: true,
      variantA_id: true,
      variantB_id: true
    }
  }).catch(() => null);

  // 3. 최종 URL 결정
  let finalUrl = link.targetUrl;
  let selectedVariant = "NONE";

  if (abTest) {
    // A/B 테스트 중이면 50:50 분산
    const isVariantA = abTest.variantA_id === link.id;
    const useVariantA = Math.random() > 0.5;

    if (useVariantA !== isVariantA) {
      // 반대 변형으로 리다이렉트
      const otherVariantId = isVariantA ? abTest.variantB_id : abTest.variantA_id;
      const otherVariant = await prisma.shortLink.findUnique({
        where: { id: otherVariantId },
        select: { targetUrl: true }
      }).catch(() => null);

      if (otherVariant) {
        finalUrl = otherVariant.targetUrl;
      }
    }

    selectedVariant = useVariantA ? "A" : "B";
  }

  // 4. 클릭 기록 (fire-and-forget)
  const contactId = paramContactId ?? link.contactId ?? null;

  prisma.$transaction([
    prisma.shortLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    }),
    prisma.shortLinkClick.create({
      data: {
        linkId: link.id,
        contactId,
        userAgent: req.headers.get('user-agent')?.substring(0, 200) ?? null,
      },
    }),
    // A/B 테스트 통계 업데이트
    ...(abTest && selectedVariant !== "NONE" ? [
      prisma.shortLinkABTest.update({
        where: { id: abTest.id },
        data: {
          ...(selectedVariant === "A" 
            ? { clicksA: { increment: 1 } }
            : { clicksB: { increment: 1 } }
          )
        }
      })
    ] : [])
  ]).catch((e) => 
    logger.log('[ShortLink] 클릭 기록 실패', { 
      code, 
      error: e instanceof Error ? e.message : String(e) 
    })
  );

  // 5. 그룹 자동 배정
  if (link.contactId && link.autoGroupId) {
    const { triggerGroupFunnel } = await import('@/lib/funnel-trigger');
    prisma.contact.update({
      where: { id: link.contactId },
      data: { groups: { connect: { id: link.autoGroupId } } },
    }).then(() =>
      triggerGroupFunnel({ 
        contactId: link.contactId!, 
        groupId: link.autoGroupId!, 
        organizationId: link.organizationId 
      })
    ).catch((e) => logger.log('[ShortLink] 그룹 배정 실패', { error: e instanceof Error ? e.message : String(e) }));
  }

  logger.log('[ShortLink] 클릭', { 
    code, 
    contactId: link.contactId ?? '없음',
    abTest: abTest?.id ?? '없음',
    variant: selectedVariant
  });

  // 6. URL 검증
  try {
    const parsed = new URL(finalUrl);
    if (parsed.protocol !== 'https:') {
      return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 302 });
    }
  } catch {
    return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 302 });
  }

  // 7. 리다이렉트
  const response = NextResponse.redirect(finalUrl, { status: 302 });
  response.cookies.set('visitToken', link.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  });
  
  return response;
}
```

### 4.2 A/A 테스트 검증 스크립트

```typescript
// src/lib/tests/aa-test-validation.ts

export async function validateAATest(testId: string) {
  const test = await prisma.shortLinkABTest.findUnique({
    where: { id: testId }
  });

  if (!test) {
    throw new Error("테스트를 찾을 수 없습니다.");
  }

  // A/A 테스트 검증 (100회 이상)
  if (test.impressionsA + test.impressionsB < 100) {
    return {
      isValid: false,
      message: "샘플 크기 부족 (현재: ${test.impressionsA + test.impressionsB}, 필요: 100+)"
    };
  }

  // 분산 비율 검증 (45-55% 범위 내)
  const aRatio = test.clicksA / (test.clicksA + test.clicksB);
  const isWellDistributed = aRatio >= 0.45 && aRatio <= 0.55;

  return {
    isValid: isWellDistributed,
    aRatio: (aRatio * 100).toFixed(2) + "%",
    message: isWellDistributed 
      ? "✅ 리다이렉트 분산 정상" 
      : "❌ 리다이렉트 분산 오류: 즉시 수정 필요"
  };
}
```

---

## 5. Impression 추적 시스템

### 5.1 SMS 발송 시 Impression 기록

```typescript
// src/app/api/contacts/[id]/send-day0-sms/route.ts (수정)

// ... 기존 코드 ...

// SMS 발송
const result = await sendSms({
  config: smsConfig,
  receiver: contact.phone,
  msg: message,
  msgType: message.length > 90 ? "LMS" : "SMS",
  organizationId: contact.organizationId,
  contactId: contact.id,
  channel: "FUNNEL",
});

// ✨ 새로운 코드: Impression 기록
if (Number(result.result_code) === 1) {
  // SMS 메시지에서 ShortLink 코드 추출
  const linkCodePattern = /\/l\/([a-zA-Z0-9]{8})/g;
  const matches = message.matchAll(linkCodePattern);
  const linkCodes = Array.from(matches).map(m => m[1]);

  if (linkCodes.length > 0) {
    // ShortLink 조회
    const links = await prisma.shortLink.findMany({
      where: { code: { in: linkCodes } },
      select: { id: true, code: true }
    });

    // Impression 기록
    const impressions = links.map(link => ({
      shortLinkId: link.id,
      contactId: contact.id,
      channel: "SMS",
      campaignId: `DAY${day}_SMS`,
      messageId: result.message_id ?? null,
      metadata: {
        source: "day0_sms",
        campaignType: "funnel",
        dayNumber: day
      }
    }));

    await prisma.shortLinkImpression.createMany({
      data: impressions,
      skipDuplicates: true  // 중복 방지
    }).catch(err => 
      logger.error("[ShortLink] Impression 기록 실패", { err })
    );
  }
}

logger.log("[POST /api/contacts/[id]/send-day0-sms] Day SMS 발송", {
  contactId: contact.id,
  day,
  status: Number(result.result_code) === 1 ? "success" : "failed",
  impressions: links?.length ?? 0
});
```

### 5.2 Impression 계산 유틸리티

```typescript
// src/lib/analytics/shortlink-ab-test.ts

export async function calculateABTestStats(testId: string) {
  const test = await prisma.shortLinkABTest.findUnique({
    where: { id: testId }
  });

  if (!test) {
    throw new Error("테스트를 찾을 수 없습니다.");
  }

  // 통계 계산
  const ctrA = test.impressionsA > 0 ? test.clicksA / test.impressionsA : 0;
  const ctrB = test.impressionsB > 0 ? test.clicksB / test.impressionsB : 0;

  // 카이제곱 검정 (또는 Fisher's exact test)
  const pValue = calculateChiSquareTest({
    clicksA: test.clicksA,
    clicksB: test.clicksB,
    impressionsA: test.impressionsA,
    impressionsB: test.impressionsB
  });

  // 신뢰도 결정
  let confidenceLevel = null;
  let winner = null;

  if (pValue < 0.05) {
    confidenceLevel = 95.0;
    winner = ctrA > ctrB ? "A" : "B";
  } else if (pValue < 0.10) {
    confidenceLevel = 90.0;
    winner = ctrA > ctrB ? "A" : "B";
  }

  return {
    ctrA: (ctrA * 100).toFixed(2) + "%",
    ctrB: (ctrB * 100).toFixed(2) + "%",
    pValue: pValue.toFixed(4),
    confidenceLevel,
    winner,
    recommendation: 
      winner 
        ? `${winner} 변형이 ${confidenceLevel}% 신뢰도로 우승합니다.`
        : `더 많은 데이터 필요 (현재 p-value: ${pValue.toFixed(4)}, 필요: <0.05)`
  };
}

function calculateChiSquareTest(data: any): number {
  // Fisher's exact test 또는 카이제곱 검정 구현
  // ...
}
```

---

## 6. 에러 처리 및 밸리데이션

### 6.1 링크 유효성 검증

```typescript
// src/lib/validations/shortlink-ab-test.ts

export function validateABTestCreation(data: {
  variantA_id: string;
  variantB_id: string;
}) {
  const errors: string[] = [];

  if (!data.variantA_id) {
    errors.push("variantA_id는 필수입니다.");
  }

  if (!data.variantB_id) {
    errors.push("variantB_id는 필수입니다.");
  }

  if (data.variantA_id === data.variantB_id) {
    errors.push("A/B 링크가 동일합니다.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function validateLinksForABTest(
  variantA_id: string,
  variantB_id: string,
  userId: string
) {
  const errors: string[] = [];

  // 링크 존재 확인
  const [linkA, linkB] = await Promise.all([
    prisma.shortLink.findUnique({ 
      where: { id: variantA_id },
      select: { id: true, createdBy: true, organizationId: true }
    }),
    prisma.shortLink.findUnique({ 
      where: { id: variantB_id },
      select: { id: true, createdBy: true, organizationId: true }
    })
  ]);

  if (!linkA) {
    errors.push("variantA_id를 찾을 수 없습니다.");
  }

  if (!linkB) {
    errors.push("variantB_id를 찾을 수 없습니다.");
  }

  if (linkA && linkA.createdBy !== userId) {
    errors.push("variantA_id: 권한이 없습니다.");
  }

  if (linkB && linkB.createdBy !== userId) {
    errors.push("variantB_id: 권한이 없습니다.");
  }

  if (linkA && linkB && linkA.organizationId !== linkB.organizationId) {
    errors.push("A/B 링크가 같은 조직에 속해야 합니다.");
  }

  // 이미 A/B 테스트 중인지 확인
  const existing = await prisma.shortLinkABTest.findFirst({
    where: {
      OR: [
        { variantA_id },
        { variantB_id }
      ],
      NOT: { status: "ARCHIVED" }
    }
  });

  if (existing) {
    errors.push("이미 다른 테스트에서 사용 중인 링크입니다.");
  }

  // 리다이렉트 체인 방지
  if (linkA && linkB) {
    const [isAVariant, isBVariant] = await Promise.all([
      prisma.shortLinkABTest.findFirst({
        where: {
          OR: [
            { variantA_id: linkA.id },
            { variantB_id: linkA.id }
          ]
        }
      }),
      prisma.shortLinkABTest.findFirst({
        where: {
          OR: [
            { variantA_id: linkB.id },
            { variantB_id: linkB.id }
          ]
        }
      })
    ]);

    if (isAVariant || isBVariant) {
      errors.push("리다이렉트 체인 방지: 테스트 중인 링크는 선택할 수 없습니다.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

---

## 7. 테스트 계획

### 7.1 Unit 테스트

```typescript
// tests/shortlink-ab-test.test.ts

describe("ShortLink A/B Test", () => {
  describe("POST /api/links/create-test", () => {
    it("should create A/B test with valid data", async () => {
      // ...
    });

    it("should reject identical variants", async () => {
      // ...
    });

    it("should reject if variant already in use", async () => {
      // ...
    });
  });

  describe("GET /l/[code] - A/B Distribution", () => {
    it("should distribute to 50% A and 50% B over 1000 requests", async () => {
      // A/A 테스트: 1000회 클릭
      // 확인: A/B 분산이 45-55% 범위 내
    });

    it("should log impression correctly", async () => {
      // ...
    });
  });

  describe("calculateABTestStats", () => {
    it("should return winner when p-value < 0.05", async () => {
      // ...
    });

    it("should return null winner when p-value >= 0.05", async () => {
      // ...
    });
  });
});
```

### 7.2 E2E 테스트

```typescript
// e2e/shortlink-ab-test.e2e.ts

describe("A/B Test E2E", () => {
  it("should complete full A/B test workflow", async () => {
    // 1. 2개 ShortLink 생성
    // 2. A/B 테스트 생성
    // 3. 테스트 시작
    // 4. SMS 발송 (100회) → Impression 기록
    // 5. 클릭 수집 (각 50-50 분산 검증)
    // 6. 통계 분석
    // 7. 우승 선언
    // 8. 결과 확인
  });
});
```

---

## 8. 배포 체크리스트

- [ ] Prisma 스키마 추가 (ShortLinkABTest, ShortLinkImpression)
- [ ] 데이터베이스 마이그레이션 실행 (`npx prisma migrate dev`)
- [ ] API 구현 (POST create-test, GET tests, PATCH start, PATCH declare-winner)
- [ ] 리다이렉트 로직 수정 (GET /l/[code]/route.ts)
- [ ] Impression 기록 로직 추가 (SMS 발송 API)
- [ ] 통계 계산 유틸리티 구현
- [ ] 필터링 로직 추가 (GET /api/links - 테스트 링크 제외)
- [ ] A/A 테스트 검증 스크립트 작성
- [ ] Unit 테스트 작성
- [ ] E2E 테스트 실행
- [ ] 코드 리뷰
- [ ] TSC 검증 (`npx tsc --noEmit`)
- [ ] Staging 배포 및 검증
- [ ] Production 배포

---

**Team 1 최종 확인**: 이 스펙으로 구현하면 Option 3 하이브리드 방식의 모든 이점을 확보할 수 있습니다.

**다음 단계**: Team A/B가 병렬로 구현 시작
