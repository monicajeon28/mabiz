import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

const BONSA_ORG_ID = 'org_bonsa_cruisedot';

function resolveOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): string {
  return ctx.role === 'GLOBAL_ADMIN' ? BONSA_ORG_ID : requireOrgId(ctx);
}

// POST /api/funnel-states/create
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { contactId } = await req.json();

    // 필드 검증
    if (!contactId || typeof contactId !== 'string') {
      return NextResponse.json(
        { ok: false, message: '고객 ID(contactId)는 필수입니다.' },
        { status: 400 }
      );
    }

    // 고객 존재 여부 확인
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, organizationId: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // IDOR 방지: 조직 ID 검증
    if (contact.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, message: '접근 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 존재하는 상태가 있는지 확인
    const existingState = await prisma.contactFunnelState.findUnique({
      where: {
        organizationId_contactId: {
          organizationId: orgId,
          contactId,
        },
      },
    });

    if (existingState) {
      return NextResponse.json(
        {
          ok: true,
          data: existingState,
          message: '이미 존재하는 퍼널 상태입니다.',
          isNew: false,
        },
        { status: 200 }
      );
    }

    // 새로운 퍼널 상태 생성
    const state = await prisma.contactFunnelState.create({
      data: {
        organizationId: orgId,
        contactId,
        status: 'PENDING',
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    logger.info('[POST /api/funnel-states/create] 퍼널 상태 생성', {
      stateId: state.id,
      contactId,
      organizationId: orgId,
      userId: ctx.userId,
    });

    return NextResponse.json(
      {
        ok: true,
        data: state,
        message: '퍼널 상태가 생성되었습니다.',
        isNew: true,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/funnel-states/create]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
