/**
 * GET /api/groups/[id]/customers
 * 그룹에 속한 고객 목록을 조회 (검수 탭용)
 */

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const { id: groupId } = await params;
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 100);

    // 그룹 존재 확인 및 권한 확인
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, organizationId: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (group.organizationId !== orgId) {
      logger.warn('[GroupCustomers] 권한 없음', {
        userId: ctx.userId,
        groupId,
        orgId,
      });
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 그룹의 고객 목록 조회 (전체 전화번호 포함 - 마스킹 안 함)
    const customers = await prisma.contact.findMany({
      where: {
        groupMembers: {
          some: {
            groupId,
          },
        },
        organizationId: orgId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const result: Customer[] = customers.map((c) => ({
      id: c.id,
      name: c.name || '(이름 없음)',
      phone: c.phone || '(전화번호 없음)',
    }));

    return NextResponse.json(
      { ok: true, customers: result },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[GET /api/groups/[id]/customers]', { error });
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
