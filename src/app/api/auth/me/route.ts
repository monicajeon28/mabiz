import { NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';

export async function GET() {
  const ctx = await getMabizSession();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  return NextResponse.json({
    ok: true,
    userId: ctx.userId,
    role: ctx.role,
    organizationId: ctx.organizationId,
    displayName: ctx.member?.displayName ?? null,
  });
}
