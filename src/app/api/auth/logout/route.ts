import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { MABIZ_SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(MABIZ_SESSION_COOKIE)?.value;

  if (sid) {
    await prisma.mabizSession.delete({ where: { id: sid } }).catch(() => {});
    cookieStore.delete(MABIZ_SESSION_COOKIE);
  }

  return NextResponse.json({ ok: true });
}
