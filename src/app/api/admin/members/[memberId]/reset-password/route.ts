export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { unauthorized, forbidden, notFound, serverError } from '@/lib/response';
import { hashPassword } from '@/lib/password';
import { logger } from '@/lib/logger';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function randomTempPassword(len = 10): string {
  const buf = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CHARS[buf[i] % CHARS.length];
  }
  return out;
}

// POST /api/admin/members/[memberId]/reset-password
// GLOBAL_ADMIN 또는 OWNER가 임시 비밀번호 발급 → 1회 반환
export async function POST(
  req: Request,
  { params }: { params: { memberId: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return forbidden('관리자만 접근 가능합니다.');
    }

    const member = await prisma.organizationMember.findUnique({
      where: { id: params.memberId },
      select: { id: true, organizationId: true, displayName: true, userId: true },
    });

    if (!member) return notFound('멤버를 찾을 수 없습니다.');

    // OWNER는 자기 조직 멤버만 가능
    if (ctx.role === 'OWNER' && member.organizationId !== ctx.organizationId) {
      return forbidden('권한이 없습니다.');
    }

    const tempPassword = randomTempPassword();
    const hashed = await hashPassword(tempPassword);

    await prisma.organizationMember.update({
      where: { id: params.memberId },
      data: { passwordHash: hashed },
    });

    logger.info('[POST /admin/members/reset-password] 임시 비밀번호 발급', {
      targetMemberId: params.memberId,
      adminId: ctx.userId,
    });

    // 임시 비밀번호 1회 반환 (이후 재조회 불가)
    return NextResponse.json({
      ok: true,
      tempPassword,
      message: '임시 비밀번호가 발급됐습니다. 이 화면에서만 확인 가능하며, 대상자에게 안전하게 전달하세요.',
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return unauthorized('인증이 필요합니다.');
    logger.error('[POST /admin/members/reset-password] Error', { err });
    return serverError();
  }
}
