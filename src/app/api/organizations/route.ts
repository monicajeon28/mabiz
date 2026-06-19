export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

// GET /api/organizations — GLOBAL_ADMIN 전용
export async function GET() {
  const ctx = await getMabizSession();
  if (!ctx) return NextResponse.json([], { status: 401 });
  if (ctx.role !== 'GLOBAL_ADMIN') return NextResponse.json([], { status: 403 });
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(orgs);
}
