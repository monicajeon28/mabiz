export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { unauthorized, serverError } from '@/lib/response';
import { hashPassword, verifyPassword } from '@/lib/password';
import { logger } from '@/lib/logger';

// PATCH /api/settings/password — 본인 비밀번호 변경
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();

    const body = await req.json() as Record<string, unknown>;
    const { currentPassword, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ ok: false, message: '현재 비밀번호를 입력해주세요.' }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ ok: false, message: '새 비밀번호를 입력해주세요.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ ok: false, message: '새 비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }

    const member = await prisma.organizationMember.findFirst({
      where: { userId: ctx.userId, isActive: true },
      select: { id: true, passwordHash: true },
    });

    if (!member) {
      return NextResponse.json({ ok: false, message: '계정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, member.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, message: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.organizationMember.update({
      where: { id: member.id },
      data: { passwordHash: newHash, passwordPlain: newPassword },
    });

    logger.info('[PATCH /api/settings/password] 비밀번호 변경', { userId: ctx.userId });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return unauthorized('인증이 필요합니다.');
    if (err.status === 400) return NextResponse.json({ ok: false, message: '요청을 처리할 수 없습니다.' }, { status: 400 });
    logger.error('[PATCH /api/settings/password] Error', { err });
    return serverError();
  }
}
