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

    return NextResponse.json({ ok: true, message: '마이그레이션 완료' });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
