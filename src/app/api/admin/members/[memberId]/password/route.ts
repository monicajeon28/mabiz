export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { unauthorized, forbidden, notFound, serverError } from '@/lib/response';
import { logger } from '@/lib/logger';

// GET /api/admin/members/[memberId]/password — 비밀번호 조회 (GLOBAL_ADMIN + OWNER)
export async function GET(
  _req: Request,
  { params }: { params: { memberId: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return forbidden('관리자만 접근 가능합니다.');
    }

    const member = await prisma.organizationMember.findUnique({
      where: { id: params.memberId },
      select: { id: true, organizationId: true, displayName: true, passwordPlain: true, passwordHash: true },
    });

    if (!member) return notFound('멤버를 찾을 수 없습니다.');

    // OWNER는 자기 조직 멤버만 가능
    if (ctx.role === 'OWNER' && member.organizationId !== ctx.organizationId) {
      return forbidden('권한이 없습니다.');
    }

    logger.info('[GET /admin/members/password] 비밀번호 조회', {
      targetMemberId: params.memberId,
      adminId: ctx.userId,
    });

    return NextResponse.json({
      ok: true,
      displayName: member.displayName,
      passwordPlain: member.passwordPlain ?? null,
      hasPassword: !!member.passwordHash,
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    if (e.message === 'UNAUTHORIZED') return unauthorized('인증이 필요합니다.');
    logger.error('[GET /admin/members/password] Error', { err });
    return serverError();
  }
}
