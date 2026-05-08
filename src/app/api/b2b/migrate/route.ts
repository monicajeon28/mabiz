import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';

export async function POST() {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    await prisma.$executeRaw(Prisma.sql`ALTER TABLE "CrmB2BProspect" ADD COLUMN IF NOT EXISTS "eduType" TEXT NOT NULL DEFAULT 'INQUIRER'`);
    await prisma.$executeRaw(Prisma.sql`ALTER TABLE "CrmB2BProspect" ADD COLUMN IF NOT EXISTS "productName" TEXT`);
    await prisma.$executeRaw(Prisma.sql`ALTER TABLE "CrmB2BProspect" ADD COLUMN IF NOT EXISTS "paymentAmount" INTEGER`);
    await prisma.$executeRaw(Prisma.sql`ALTER TABLE "CrmB2BProspect" ADD COLUMN IF NOT EXISTS "paymentDate" TEXT`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "CrmB2BProspect_eduType_idx" ON "CrmB2BProspect"("eduType")`);

    // B2BProspect 유니크 제약 (organizationId + phone)
    await prisma.$executeRaw(Prisma.sql`ALTER TABLE "CrmB2BProspect" ADD CONSTRAINT "CrmB2BProspect_organizationId_phone_key" UNIQUE ("organizationId", "phone") ON CONFLICT DO NOTHING`);

    // ImportLog 테이블 생성
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "ImportLog" (
        id TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        target TEXT NOT NULL,
        total_rows INTEGER NOT NULL,
        successful_rows INTEGER NOT NULL,
        failed_rows INTEGER NOT NULL,
        errors TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE
      )
    `);

    // ImportLog 인덱스 생성
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ImportLog_organizationId_idx" ON "ImportLog"("organizationId")`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ImportLog_target_idx" ON "ImportLog"(target)`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ImportLog_createdAt_idx" ON "ImportLog"("createdAt")`);

    // PushLog 테이블 생성 (푸시 발송 이력)
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "PushLog" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "organizationId" TEXT NOT NULL,
        "subscriptionCount" INTEGER NOT NULL,
        "successCount" INTEGER NOT NULL DEFAULT 0,
        "failureCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // PushLog 인덱스 생성 (조회 성능)
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "PushLog_org_date_idx" ON "PushLog"("organizationId", "createdAt" DESC)`);

    // ContactFunnelState 테이블 생성 (퍼널 상태 전이 자동화)
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "ContactFunnelState" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "organizationId" TEXT NOT NULL,
        "contactId" TEXT NOT NULL REFERENCES "Contact"(id) ON DELETE CASCADE,

        status TEXT NOT NULL DEFAULT 'PENDING',
        "nextScheduledAt" TIMESTAMPTZ,
        metadata JSONB,

        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "ContactFunnelState_org_contact_unique" UNIQUE ("organizationId", "contactId")
      )
    `);

    // ContactFunnelState 인덱스 생성 (조회 성능)
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ContactFunnelState_org_contact_idx" ON "ContactFunnelState"("organizationId", "contactId")`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ContactFunnelState_org_status_idx" ON "ContactFunnelState"("organizationId", status)`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ContactFunnelState_nextScheduledAt_idx" ON "ContactFunnelState"("nextScheduledAt")`);

    // ─── 파트너 대시보드 (TASK-016) ───────────────────────────────
    // 1. Partner 테이블 생성
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "Partner" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        "commissionRate" NUMERIC(5,2),
        "totalRevenue" BIGINT DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE("organizationId", name)
      )
    `);

    // Partner 인덱스 생성
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "Partner_org_idx" ON "Partner"("organizationId")`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "Partner_status_idx" ON "Partner"(status)`);

    // 2. PartnerMetrics 테이블 생성
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "PartnerMetrics" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "partnerId" TEXT NOT NULL REFERENCES "Partner"(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        "customerCount" INTEGER DEFAULT 0,
        "leadCount" INTEGER DEFAULT 0,
        "revenue" BIGINT DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE("partnerId", year, month)
      )
    `);

    // PartnerMetrics 인덱스 생성
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "PartnerMetrics_partner_date_idx" ON "PartnerMetrics"("partnerId", year, month DESC)`);

    // 3. Contact 테이블에 partnerId FK 추가
    await prisma.$executeRaw(Prisma.sql`
      ALTER TABLE "Contact"
      ADD COLUMN IF NOT EXISTS "partnerId" TEXT REFERENCES "Partner"(id) ON DELETE SET NULL
    `);

    // Contact partnerId 인덱스 생성
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "Contact_partnerId_idx" ON "Contact"("partnerId")`);

    // ─── 이미지 라이브러리 (TASK-018) ──────────────────────────────
    // ImageAsset 테이블 생성 (조직별 이미지 자산 관리)
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "ImageAsset" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "organizationId" TEXT NOT NULL,

        "originalFileName" TEXT NOT NULL,
        "driveFileId" TEXT NOT NULL,
        "drivePath" TEXT,

        "mimeType" TEXT,
        "fileSize" BIGINT,
        width INTEGER,
        height INTEGER,

        tags TEXT[],
        category TEXT,

        "uploadedBy" TEXT NOT NULL,
        "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "lastAccessedAt" TIMESTAMPTZ,

        CONSTRAINT "ImageAsset_org_file_unique" UNIQUE("organizationId", "driveFileId"),
        FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE
      )
    `);

    // ImageAsset 인덱스 생성
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ImageAsset_org_category_idx" ON "ImageAsset"("organizationId", category)`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ImageAsset_org_tags_idx" ON "ImageAsset" USING GIN("organizationId", tags)`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "ImageAsset_uploadedAt_idx" ON "ImageAsset"("uploadedAt" DESC)`);

    // ─── 일반 문서 승인 시스템 (TASK-024) ──────────────────────────
    // 1. Document 테이블 생성 (기본 문서 정보)
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "Document" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
        "contactId" TEXT REFERENCES "Contact"(id) ON DELETE CASCADE,

        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',

        "driveFileId" TEXT,
        "fileSize" BIGINT,
        "mimeType" TEXT,

        "createdBy" TEXT NOT NULL,
        "updatedBy" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "Document_org_title_unique" UNIQUE("organizationId", title)
      )
    `);

    // Document 인덱스 생성
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "Document_org_status_idx" ON "Document"("organizationId", status)`);
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "Document_org_category_idx" ON "Document"("organizationId", category)`);

    // 2. DocumentVersion 테이블 생성 (버전 관리)
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "DocumentVersion" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "documentId" TEXT NOT NULL REFERENCES "Document"(id) ON DELETE CASCADE,

        "versionNumber" INTEGER NOT NULL,
        "driveFileId" TEXT NOT NULL,
        description TEXT,

        "uploadedBy" TEXT NOT NULL,
        "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "DocumentVersion_doc_version_unique" UNIQUE("documentId", "versionNumber")
      )
    `);

    // DocumentVersion 인덱스 생성
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "DocumentVersion_doc_idx" ON "DocumentVersion"("documentId", "versionNumber" DESC)`);

    // 3. DocumentApproval 테이블 생성 (승인 이력)
    await prisma.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "DocumentApproval" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "documentId" TEXT NOT NULL REFERENCES "Document"(id) ON DELETE CASCADE,

        "approvedBy" TEXT NOT NULL,
        status TEXT NOT NULL,
        comment TEXT,

        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT "DocumentApproval_doc_approver_unique" UNIQUE("documentId", "approvedBy")
      )
    `);

    // DocumentApproval 인덱스 생성
    await prisma.$executeRaw(Prisma.sql`CREATE INDEX IF NOT EXISTS "DocumentApproval_doc_idx" ON "DocumentApproval"("documentId")`);

    return NextResponse.json({ ok: true, message: '마이그레이션 완료 (Document + DocumentVersion + DocumentApproval 테이블 추가)' });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
