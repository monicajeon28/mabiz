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
    return NextResponse.json({ ok: true, message: '마이그레이션 완료' });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
