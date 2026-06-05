import { NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const ctx = await getMabizSession();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  // 담당자(대리점/판매원) 본인 전화번호 조회 — 서류 "담당자 연락처" 자동 표시용
  let phone: string | null = null;
  if (ctx.member?.id) {
    const m = await prisma.organizationMember
      .findUnique({ where: { id: ctx.member.id }, select: { phone: true } })
      .catch(() => null);
    phone = m?.phone ?? null;
  }

  return NextResponse.json({
    ok: true,
    userId: ctx.userId,
    role: ctx.role,
    organizationId: ctx.organizationId,
    displayName: ctx.member?.displayName ?? ctx.mallUser?.name ?? null,
    phone,
  });
}
