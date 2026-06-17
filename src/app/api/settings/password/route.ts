export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

    let existingHash: string | null = null;

    if (ctx.role === 'GLOBAL_ADMIN') {
      // GlobalAdmin 세션: GlobalAdmin 테이블에서 조회/업데이트
      const admin = await prisma.globalAdmin.findUnique({
        where: { id: ctx.userId },
        select: { id: true, passwordHash: true },
      });
      if (!admin) {
        return NextResponse.json({ ok: false, message: '계정을 찾을 수 없습니다.' }, { status: 404 });
      }
      existingHash = admin.passwordHash ?? null;
      if (!existingHash) {
        return NextResponse.json({ ok: false, message: '비밀번호가 설정되지 않은 계정입니다.' }, { status: 400 });
      }
      const valid = await verifyPassword(currentPassword, existingHash);
      if (!valid) {
        return NextResponse.json({ ok: false, message: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
      }
      const newHash = await hashPassword(newPassword);
      await prisma.globalAdmin.update({
        where: { id: ctx.userId },
        data: { passwordHash: newHash },
      });
    } else if (ctx.member !== null) {
      // OrganizationMember 세션 (OWNER / AGENT / FREE_SALES)
      const member = await prisma.organizationMember.findFirst({
        where: { userId: ctx.userId, isActive: true },
        select: { id: true, passwordHash: true },
      });
      if (!member) {
        return NextResponse.json({ ok: false, message: '계정을 찾을 수 없습니다.' }, { status: 404 });
      }
      if (!member.passwordHash) {
        return NextResponse.json({ ok: false, message: '비밀번호가 설정되지 않은 계정입니다.' }, { status: 400 });
      }
      existingHash = member.passwordHash;
      const valid = await verifyPassword(currentPassword, existingHash);
      if (!valid) {
        return NextResponse.json({ ok: false, message: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
      }
      const newHash = await hashPassword(newPassword);
      await prisma.organizationMember.update({
        where: { id: member.id },
        data: { passwordHash: newHash, passwordExpiresAt: null },
      });
    } else {
      // GMcruise User 세션 (mallUserId 기반): User 테이블 raw 쿼리
      const mallUserId = ctx.mallUser?.id;
      if (!mallUserId) {
        return NextResponse.json({ ok: false, message: '계정을 찾을 수 없습니다.' }, { status: 404 });
      }
      type UserRow = { id: number; password: string };
      const rows = await prisma.$queryRaw<UserRow[]>(
        Prisma.sql`
          SELECT id, password FROM "User" WHERE id = ${mallUserId} AND "isLocked" = false LIMIT 1
        `
      );
      if (!rows[0]) {
        return NextResponse.json({ ok: false, message: '계정을 찾을 수 없습니다.' }, { status: 404 });
      }
      existingHash = rows[0].password;
      const valid = await verifyPassword(currentPassword, existingHash);
      if (!valid) {
        return NextResponse.json({ ok: false, message: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
      }
      const newHash = await hashPassword(newPassword);
      await prisma.$queryRaw(
        Prisma.sql`
          UPDATE "User" SET password = ${newHash} WHERE id = ${mallUserId}
        `
      );
    }

    logger.info('[PATCH /api/settings/password] 비밀번호 변경', { userId: ctx.userId });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return unauthorized('인증이 필요합니다.');
    if (typeof err === 'object' && err !== null && 'status' in err && (err as { status: unknown }).status === 400)
      return NextResponse.json({ ok: false, message: '요청을 처리할 수 없습니다.' }, { status: 400 });
    logger.error('[PATCH /api/settings/password] Error', { err });
    return serverError();
  }
}
