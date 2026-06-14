# Landing Pages 블록 시스템 구현 가이드

**작성일**: 2026-06-15  
**버전**: 1.0  
**대상**: 백엔드 개발팀 (구현 phase)

---

## 📝 Part 1: Prisma 마이그레이션 템플릿

### 생성 명령어
```bash
npx prisma migrate dev --name landing_pages_block_system
```

### migration.sql (구조)

```sql
-- LandingPageBlock 테이블 생성
CREATE TABLE "LandingPageBlock" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landingPageId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" VARCHAR(30) NOT NULL,
  "blockOrder" INTEGER NOT NULL,
  "blockVersion" INTEGER NOT NULL DEFAULT 1,
  "config" JSONB NOT NULL,
  "styling" JSONB,
  "responsiveConfig" JSONB,
  "ctaId" TEXT,
  "ctaLabel" VARCHAR(100),
  "ctaAction" VARCHAR(30),
  "ctaTarget" TEXT,
  "formFields" JSONB,
  "formSubmissionGroupId" TEXT,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "isDraft" BOOLEAN NOT NULL DEFAULT true,
  "conditionalRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  "lastModifiedByUserId" TEXT,
  CONSTRAINT "LandingPageBlock_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "CrmLandingPage" ("id") ON DELETE CASCADE,
  CONSTRAINT "LandingPageBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
  CONSTRAINT "LandingPageBlock_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "CTAButton" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "uq_block_form_group" ON "LandingPageBlock"("landingPageId", "formSubmissionGroupId") WHERE "formSubmissionGroupId" IS NOT NULL;
CREATE INDEX "idx_block_page_order" ON "LandingPageBlock"("landingPageId", "blockOrder");
CREATE INDEX "idx_block_org_type" ON "LandingPageBlock"("organizationId", "type");
CREATE INDEX "idx_block_cta" ON "LandingPageBlock"("ctaId");
CREATE INDEX "idx_block_page_draft" ON "LandingPageBlock"("landingPageId", "isDraft");
CREATE INDEX "idx_block_created_by" ON "LandingPageBlock"("createdByUserId");

-- CTAButton 테이블 생성
CREATE TABLE "CTAButton" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landingPageId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "trackingId" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "ctaType" VARCHAR(30) NOT NULL,
  "position" VARCHAR(50),
  "blockType" VARCHAR(30),
  "version" INTEGER NOT NULL DEFAULT 1,
  "versionNote" TEXT,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "conversionCount" INTEGER NOT NULL DEFAULT 0,
  "conversionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "firstClickAt" TIMESTAMP(3),
  "lastClickAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT,
  CONSTRAINT "CTAButton_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "CrmLandingPage" ("id") ON DELETE CASCADE,
  CONSTRAINT "CTAButton_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "uq_cta_org_tracking_id" ON "CTAButton"("organizationId", "trackingId");
CREATE INDEX "idx_cta_page" ON "CTAButton"("landingPageId");
CREATE INDEX "idx_cta_org_position" ON "CTAButton"("organizationId", "position");
CREATE INDEX "idx_cta_type" ON "CTAButton"("ctaType");
CREATE INDEX "idx_cta_conversion_rank" ON "CTAButton"("conversionCount" DESC);

-- CTAConversion 테이블 생성
CREATE TABLE "CTAConversion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ctaId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventType" VARCHAR(30) NOT NULL,
  "isConversion" BOOLEAN NOT NULL DEFAULT false,
  "contactId" TEXT,
  "visitorSessionId" TEXT,
  "visitorEmail" TEXT,
  "visitorPhone" TEXT,
  "referrer" TEXT,
  "utm_source" TEXT,
  "utm_medium" TEXT,
  "utm_campaign" TEXT,
  "utm_content" TEXT,
  "utm_term" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "deviceType" VARCHAR(20),
  "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "formSubmittedAt" TIMESTAMP(3),
  "conversionAt" TIMESTAMP(3),
  "timeToConversion" INTEGER,
  "formSubmissionId" TEXT,
  "formData" JSONB,
  "source" VARCHAR(30),
  "campaign" TEXT,
  CONSTRAINT "CTAConversion_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "CTAButton" ("id") ON DELETE CASCADE,
  CONSTRAINT "CTAConversion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
  CONSTRAINT "CTAConversion_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL,
  CONSTRAINT "CTAConversion_formSubmissionId_fkey" FOREIGN KEY ("formSubmissionId") REFERENCES "FormSubmission" ("id") ON DELETE SET NULL
);

CREATE INDEX "idx_conversion_cta_type" ON "CTAConversion"("ctaId", "eventType");
CREATE INDEX "idx_conversion_org_time" ON "CTAConversion"("organizationId", "clickedAt" DESC);
CREATE INDEX "idx_conversion_contact" ON "CTAConversion"("contactId");
CREATE INDEX "idx_conversion_session" ON "CTAConversion"("visitorSessionId");
CREATE INDEX "idx_conversion_utm_campaign" ON "CTAConversion"("utm_campaign");
CREATE INDEX "idx_conversion_is_converted" ON "CTAConversion"("isConversion", "conversionAt");
CREATE INDEX "idx_conversion_org_time_type" ON "CTAConversion"("organizationId", "clickedAt" DESC, "isConversion");

-- FormSubmission 테이블 생성
CREATE TABLE "FormSubmission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landingPageId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "formTitle" VARCHAR(100),
  "formGroupId" TEXT,
  "contactId" TEXT,
  "submitterName" VARCHAR(100),
  "submitterEmail" TEXT,
  "submitterPhone" TEXT,
  "formData" JSONB NOT NULL,
  "ctaId" TEXT,
  "ctaConversionId" TEXT,
  "blockIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  "validationResult" JSONB,
  "processedAt" TIMESTAMP(3),
  "processedByUserId" TEXT,
  "assignedTo" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "referrer" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormSubmission_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "CrmLandingPage" ("id") ON DELETE CASCADE,
  CONSTRAINT "FormSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
  CONSTRAINT "FormSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL,
  CONSTRAINT "FormSubmission_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "CTAButton" ("id"),
  CONSTRAINT "FormSubmission_ctaConversionId_fkey" FOREIGN KEY ("ctaConversionId") REFERENCES "CTAConversion" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "uq_form_email_org_page" ON "FormSubmission"("organizationId", "submitterEmail", "landingPageId") WHERE "submitterEmail" IS NOT NULL;
CREATE UNIQUE INDEX "uq_form_phone_org_page" ON "FormSubmission"("organizationId", "submitterPhone", "landingPageId") WHERE "submitterPhone" IS NOT NULL;
CREATE INDEX "idx_form_page_time" ON "FormSubmission"("landingPageId", "submittedAt" DESC);
CREATE INDEX "idx_form_org_status" ON "FormSubmission"("organizationId", "status");
CREATE INDEX "idx_form_contact" ON "FormSubmission"("contactId");
CREATE INDEX "idx_form_cta" ON "FormSubmission"("ctaId");
CREATE INDEX "idx_form_assigned" ON "FormSubmission"("assignedTo");
CREATE INDEX "idx_form_time" ON "FormSubmission"("submittedAt" DESC);

-- LandingPageVersion 테이블 생성
CREATE TABLE "LandingPageVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landingPageId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "versionNote" TEXT,
  "blocksSnapshot" JSONB NOT NULL,
  "cta_mapping" JSONB,
  "publishedAt" TIMESTAMP(3),
  "publishedByUserId" TEXT,
  "scheduledPublishAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
  "conversionCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  CONSTRAINT "LandingPageVersion_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "CrmLandingPage" ("id") ON DELETE CASCADE,
  CONSTRAINT "LandingPageVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "uq_version_page_number" ON "LandingPageVersion"("landingPageId", "versionNumber");
CREATE INDEX "idx_version_page_status" ON "LandingPageVersion"("landingPageId", "status");
CREATE INDEX "idx_version_org_published" ON "LandingPageVersion"("organizationId", "publishedAt" DESC);
CREATE INDEX "idx_version_status" ON "LandingPageVersion"("status");

-- LandingPageAuditLog 테이블 생성
CREATE TABLE "LandingPageAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landingPageId" TEXT,
  "blockId" TEXT,
  "organizationId" TEXT NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "entityType" VARCHAR(30),
  "entityId" TEXT,
  "changesBefore" JSONB,
  "changesAfter" JSONB,
  "changesSummary" TEXT,
  "userId" TEXT NOT NULL,
  "userName" TEXT,
  "userRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "LandingPageAuditLog_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "CrmLandingPage" ("id") ON DELETE SET NULL,
  CONSTRAINT "LandingPageAuditLog_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "LandingPageBlock" ("id") ON DELETE SET NULL,
  CONSTRAINT "LandingPageAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_audit_page_time" ON "LandingPageAuditLog"("landingPageId", "createdAt" DESC);
CREATE INDEX "idx_audit_org_time" ON "LandingPageAuditLog"("organizationId", "createdAt" DESC);
CREATE INDEX "idx_audit_user" ON "LandingPageAuditLog"("userId");
CREATE INDEX "idx_audit_action" ON "LandingPageAuditLog"("action");
CREATE INDEX "idx_audit_entity" ON "LandingPageAuditLog"("entityType", "entityId");

-- FormSubmissionAuditLog 테이블 생성
CREATE TABLE "FormSubmissionAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "formSubmissionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "statusBefore" VARCHAR(30),
  "statusAfter" VARCHAR(30),
  "changes" JSONB,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormSubmissionAuditLog_formSubmissionId_fkey" FOREIGN KEY ("formSubmissionId") REFERENCES "FormSubmission" ("id") ON DELETE CASCADE,
  CONSTRAINT "FormSubmissionAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_form_audit_submission_time" ON "FormSubmissionAuditLog"("formSubmissionId", "createdAt" DESC);
CREATE INDEX "idx_form_audit_org_action" ON "FormSubmissionAuditLog"("organizationId", "action");

-- LandingPageMeta 테이블 생성
CREATE TABLE "LandingPageMeta" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landingPageId" TEXT NOT NULL UNIQUE,
  "organizationId" TEXT NOT NULL,
  "metaTitle" VARCHAR(255),
  "metaDescription" VARCHAR(500),
  "metaKeywords" TEXT,
  "ogTitle" VARCHAR(255),
  "ogDescription" VARCHAR(500),
  "ogImage" TEXT,
  "ogUrl" TEXT,
  "twitterCard" VARCHAR(20),
  "twitterTitle" VARCHAR(255),
  "twitterDescription" VARCHAR(500),
  "twitterImage" TEXT,
  "canonical" TEXT,
  "language" TEXT NOT NULL DEFAULT 'ko-KR',
  "author" TEXT,
  "contactEmail" TEXT,
  "structuredData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LandingPageMeta_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "CrmLandingPage" ("id") ON DELETE CASCADE,
  CONSTRAINT "LandingPageMeta_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_meta_landing_page" ON "LandingPageMeta"("landingPageId");
```

---

## 🔧 Part 2: 구현 패턴

### 패턴 1: 블록 생성 API

**파일**: `src/app/api/landing-pages/[id]/blocks/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BlockConfigSchema } from "@/lib/landing-pages/validators"
import { z } from "zod"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 인증 확인
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. 조직 권한 확인
    const landingPage = await prisma.crmLandingPage.findFirst({
      where: {
        id: params.id,
        organizationId: session.orgId,
      },
    })

    if (!landingPage) {
      return NextResponse.json(
        { error: "Landing page not found" },
        { status: 404 }
      )
    }

    // 3. 요청 검증
    const body = await req.json()
    const validatedData = BlockConfigSchema.parse(body)

    // 4. 트랜잭션 실행
    const result = await prisma.$transaction(async (tx) => {
      // CTA 생성 (필요시)
      let ctaId: string | undefined
      if (validatedData.ctaLabel && validatedData.ctaAction) {
        const cta = await tx.ctaButton.create({
          data: {
            organizationId: session.orgId,
            landingPageId: params.id,
            label: validatedData.ctaLabel,
            trackingId: `cta-${validatedData.type}-${Date.now()}`,
            ctaType: "primary",
            blockType: validatedData.type,
            createdByUserId: session.user.id,
          },
        })
        ctaId = cta.id
      }

      // 블록 생성
      const block = await tx.landingPageBlock.create({
        data: {
          organizationId: session.orgId,
          landingPageId: params.id,
          type: validatedData.type,
          blockOrder: validatedData.blockOrder ?? 0,
          config: validatedData.config,
          styling: validatedData.styling,
          ctaId,
          ctaLabel: validatedData.ctaLabel,
          ctaAction: validatedData.ctaAction,
          formFields: validatedData.formFields,
          createdByUserId: session.user.id,
        },
      })

      // 감사 로그
      await tx.landingPageAuditLog.create({
        data: {
          organizationId: session.orgId,
          landingPageId: params.id,
          blockId: block.id,
          action: "CREATE_BLOCK",
          entityType: "block",
          entityId: block.id,
          changesAfter: block,
          userId: session.user.id,
          userName: session.user.name,
          userRole: session.user.role,
          ipAddress: req.ip,
          userAgent: req.headers.get("user-agent"),
        },
      })

      return { block, ctaId }
    })

    return NextResponse.json(
      {
        success: true,
        block: result.block,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating block:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

---

### 패턴 2: 폼 제출 API (공개)

**파일**: `src/app/api/landing-pages/[id]/submit-form/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { FormSubmissionSchema } from "@/lib/landing-pages/validators"
import { submitLandingPageForm } from "@/lib/landing-pages/submit-form"
import { z } from "zod"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 랜딩페이지 존재 확인
    const landingPage = await prisma.crmLandingPage.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organizationId: true,
        isPublic: true,
      },
    })

    if (!landingPage || !landingPage.isPublic) {
      return NextResponse.json(
        { error: "Landing page not found or not public" },
        { status: 404 }
      )
    }

    // 2. 요청 검증
    const body = await req.json()
    const validatedData = FormSubmissionSchema.parse(body)

    // 3. Rate limiting (IP 기반)
    const ipAddress = req.ip || "unknown"
    const recentSubmissions = await prisma.formSubmission.count({
      where: {
        landingPageId: params.id,
        ipAddress,
        submittedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // 5분 이내
        },
      },
    })

    if (recentSubmissions >= 5) {
      return NextResponse.json(
        { error: "Too many submissions from this IP" },
        { status: 429 }
      )
    }

    // 4. 폼 제출 처리 (트랜잭션)
    const result = await submitLandingPageForm(
      landingPage.organizationId,
      params.id,
      {
        formGroupId: body.formGroupId,
        formData: validatedData,
        ctaId: body.ctaId,
        utm_source: body.utm_source,
        utm_medium: body.utm_medium,
        utm_campaign: body.utm_campaign,
      },
      {
        ipAddress,
        userAgent: req.headers.get("user-agent"),
        referrer: req.headers.get("referer"),
      }
    )

    // 5. Day 0 SMS 자동 발송 (Optional)
    if (result.contact && result.contact.phone) {
      // await sendDay0SMS(result.contact)
    }

    return NextResponse.json(
      {
        success: true,
        submission: {
          id: result.submission.id,
          contactId: result.contact.id,
          status: result.submission.status,
        },
        message: "신청이 완료되었습니다. 곧 연락드리겠습니다.",
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    console.error("Error submitting form:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

---

### 패턴 3: CTA 클릭 추적 (프론트엔드)

**파일**: `src/components/landing-pages/CTAButton.tsx`

```typescript
"use client"

import { useState } from "react"
import { trackCTAClick } from "@/lib/landing-pages/tracking"

export function CTAButton({
  ctaId,
  trackingId,
  label,
  onClick,
}: {
  ctaId: string
  trackingId: string
  label: string
  onClick?: () => void
}) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    try {
      setIsLoading(true)

      // 1. 클릭 기록
      await trackCTAClick(ctaId, {
        trackingId,
        utm_source: new URLSearchParams(window.location.search).get(
          "utm_source"
        ),
        utm_medium: new URLSearchParams(window.location.search).get(
          "utm_medium"
        ),
        utm_campaign: new URLSearchParams(window.location.search).get(
          "utm_campaign"
        ),
      })

      // 2. 커스텀 핸들러 실행
      if (onClick) {
        onClick()
      }
    } catch (error) {
      console.error("Error tracking CTA click:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="btn btn-primary"
    >
      {label}
    </button>
  )
}
```

**파일**: `src/lib/landing-pages/tracking.ts`

```typescript
export async function trackCTAClick(
  ctaId: string,
  metadata: {
    trackingId: string
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
  }
) {
  // 백그라운드에서 클릭 기록 (await 불필요)
  fetch("/api/landing-pages/ctas/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ctaId,
      eventType: "click",
      ...metadata,
    }),
  }).catch((err) => console.error("Failed to track CTA click:", err))
}
```

---

## 📊 Part 3: 성과 분석 쿼리

### CTA 순위 매기기 (Performance Ranking)

```typescript
export async function rankCTAsByPerformance(
  organizationId: string,
  landingPageId: string
) {
  const ctas = await prisma.ctaButton.findMany({
    where: { landingPageId },
    include: {
      conversions: {
        where: { isConversion: true },
      },
    },
  })

  return ctas
    .map((cta) => ({
      ...cta,
      conversionCount: cta.conversions.length,
      conversionRate:
        cta.clickCount > 0
          ? ((cta.conversions.length / cta.clickCount) * 100).toFixed(2)
          : 0,
      avgTimeToConversion:
        cta.conversions.length > 0
          ? cta.conversions.reduce((sum, c) => sum + (c.timeToConversion || 0), 0) /
            cta.conversions.length
          : 0,
    }))
    .sort((a, b) => {
      // 전환율 기준 정렬
      return parseFloat(b.conversionRate) - parseFloat(a.conversionRate)
    })
    .map((cta, idx) => ({
      ...cta,
      rank: idx + 1,
    }))
}
```

---

### 폼 제출 분석 (Funnel)

```typescript
export async function getFormSubmissionFunnel(
  organizationId: string,
  landingPageId: string,
  dateRange: { from: Date; to: Date }
) {
  const totalVisitors = await prisma.ctaConversion.count({
    where: {
      organizationId,
      landingPageId,
      clickedAt: { gte: dateRange.from, lte: dateRange.to },
      eventType: "click",
    },
  })

  const formClickers = await prisma.ctaConversion.count({
    where: {
      organizationId,
      landingPageId,
      clickedAt: { gte: dateRange.from, lte: dateRange.to },
      eventType: "click",
      // 폼 제출 CTA를 클릭한 사람들
    },
  })

  const formSubmissions = await prisma.formSubmission.count({
    where: {
      organizationId,
      landingPageId,
      submittedAt: { gte: dateRange.from, lte: dateRange.to },
    },
  })

  return {
    totalVisitors,
    formClickers,
    formSubmissions,
    formClickRate: totalVisitors > 0 ? (formClickers / totalVisitors) * 100 : 0,
    submissionRate:
      formClickers > 0 ? (formSubmissions / formClickers) * 100 : 0,
    conversionRate: totalVisitors > 0 ? (formSubmissions / totalVisitors) * 100 : 0,
  }
}
```

---

## 🧪 Part 4: 테스트 케이스

### Unit Test: 폼 제출 트랜잭션

**파일**: `src/lib/landing-pages/__tests__/submit-form.test.ts`

```typescript
import { submitLandingPageForm } from "../submit-form"
import { prisma } from "@/lib/prisma"

describe("submitLandingPageForm", () => {
  it("should create contact and form submission in a transaction", async () => {
    const result = await submitLandingPageForm(
      "org-123",
      "page-456",
      {
        formGroupId: "form-1",
        formData: {
          name: "홍길동",
          email: "hong@example.com",
          phone: "010-1234-5678",
          message: "관심있습니다",
        },
        ctaId: "cta-123",
      },
      {
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
        referrer: "https://google.com",
      }
    )

    expect(result.contact).toBeDefined()
    expect(result.submission).toBeDefined()
    expect(result.contact.email).toBe("hong@example.com")
  })

  it("should prevent duplicate phone submissions on same page", async () => {
    const payload = {
      formGroupId: "form-1",
      formData: {
        name: "홍길동",
        email: "hong@example.com",
        phone: "010-1234-5678",
      },
      ctaId: undefined,
    }

    // 첫 번째 제출 - 성공
    await submitLandingPageForm("org-123", "page-456", payload, {
      ipAddress: "192.168.1.1",
    })

    // 두 번째 제출 - 실패해야 함
    await expect(
      submitLandingPageForm("org-123", "page-456", payload, {
        ipAddress: "192.168.1.1",
      })
    ).rejects.toThrow()
  })

  it("should track CTA conversion when ctaId is provided", async () => {
    const result = await submitLandingPageForm(
      "org-123",
      "page-456",
      {
        formGroupId: "form-1",
        formData: {
          name: "김영희",
          phone: "010-9999-9999",
        },
        ctaId: "cta-123",
      },
      {}
    )

    // CTAConversion 기록 확인
    const conversion = await prisma.ctaConversion.findFirst({
      where: {
        ctaId: "cta-123",
        contactId: result.contact.id,
        isConversion: true,
      },
    })

    expect(conversion).toBeDefined()
    expect(conversion?.conversionAt).toBeDefined()
  })
})
```

---

## 📋 Part 5: 배포 체크리스트

### Pre-Deployment Checklist

```
Phase 1: Prisma 마이그레이션
- [ ] migration.sql 파일 생성
- [ ] npx prisma migrate dev --name landing_pages_block_system 실행
- [ ] npx prisma generate 실행
- [ ] TypeScript 타입 생성 확인

Phase 2: API 구현 및 테스트
- [ ] POST /api/landing-pages/[id]/blocks 구현 및 테스트
- [ ] PATCH /api/landing-pages/[id]/blocks/[blockId] 구현
- [ ] DELETE /api/landing-pages/[id]/blocks/[blockId] 구현
- [ ] POST /api/landing-pages/[id]/blocks/reorder 구현
- [ ] POST /api/landing-pages/[id]/submit-form (공개 API) 구현
- [ ] GET /api/landing-pages/[id]/ctas/analytics 구현
- [ ] Unit 테스트 작성 및 통과
- [ ] npx tsc --noEmit 확인 (에러 0개)

Phase 3: 보안 검증
- [ ] 조직 ID 확인 (다중 테넌트 격리)
- [ ] Rate limiting 구현 (폼 제출 API)
- [ ] CORS 정책 확인
- [ ] SQL injection 방어 (Prisma ORM 사용)
- [ ] XSS 방어 (formData JSON 저장)

Phase 4: 성능 최적화
- [ ] 인덱스 성능 테스트 (27개 인덱스)
- [ ] 대량 폼 제출 테스트 (1000+)
- [ ] 캐시 메트릭 갱신 로직 (hourly cron)

Phase 5: 심리학 통합 (Option)
- [ ] Day 0-3 SMS 트리거 설정
- [ ] Contact 렌즈 자동 분류
- [ ] Grant Cardone L6 (타이밍) 분석

Phase 6: 배포
- [ ] Staging 배포 및 smoke test
- [ ] Production 배포
- [ ] 모니터링 (로그, 에러율)
```

---

**마이그레이션 + API 구현 예상 소요시간**: 5-7일 (병렬 3명 에이전트)

