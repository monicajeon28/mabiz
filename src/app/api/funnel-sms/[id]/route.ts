export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { UpdateFunnelSmsSchema } from '@/lib/schemas/funnel-sms';
import { validateSenderPhone } from '@/lib/funnel-sms-helpers';

type Params = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/funnel-sms/[id] — 단건 조회 (messages[] 포함)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const item = await prisma.funnelSms.findFirst({
      where: { id, organizationId: orgId },
      select: {
        id: true,
        title: true,
        category: true,
        description: true,
        senderPhone: true,
        sendHour: true,
        sendMinute: true,
        arsNum: true,
        isActive: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          select: {
            id: true,
            order: true,
            daysAfter: true,
            content: true,
            msgType: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { order: 'asc' },
        },
        groups: { select: { id: true, name: true } },
      },
    });

    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '퍼널문자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // sentCount 조회
    const sentCount = await prisma.scheduledSms.count({
      where: {
        organizationId: orgId,
        channel: { startsWith: `FUNNEL_SMS:${id}:` },
        status: 'SENT',
      },
    });

    return NextResponse.json({ ok: true, data: { ...item, sentCount } });
  } catch (err) {
    logger.error('[GET /api/funnel-sms/[id]]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/funnel-sms/[id] — 기본정보 수정 (메시지 제외)
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // IDOR 방어: 소속 조직 소유 확인
    const existing = await prisma.funnelSms.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '퍼널문자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validation = UpdateFunnelSmsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_INPUT',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // [P0 보안] 발신번호 변경 시 검증 — 등록·검증된 번호만 허용(발신번호 변작 방지)
    if (updateData.senderPhone) {
      const phoneValidation = await validateSenderPhone(orgId, updateData.senderPhone);
      if (!phoneValidation.valid) {
        return NextResponse.json(
          {
            ok: false,
            error: 'INVALID_SENDER_PHONE',
            message: '등록·검증된 발신번호가 아닙니다. 조직 설정에서 발신번호를 등록·인증한 뒤 다시 시도하세요.',
          },
          { status: 400 }
        );
      }
    }

    // nullish 값 처리: undefined는 그대로, null은 null 저장
    const updated = await prisma.funnelSms.update({
      where: { id },
      data: {
        ...(updateData.title !== undefined && { title: updateData.title }),
        ...(updateData.senderPhone !== undefined && { senderPhone: updateData.senderPhone }),
        ...(updateData.category !== undefined && { category: updateData.category }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.sendHour !== undefined && { sendHour: updateData.sendHour }),
        ...(updateData.sendMinute !== undefined && { sendMinute: updateData.sendMinute }),
        ...(updateData.arsNum !== undefined && { arsNum: updateData.arsNum }),
        ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
      },
      select: {
        id: true,
        title: true,
        category: true,
        description: true,
        senderPhone: true,
        sendHour: true,
        sendMinute: true,
        arsNum: true,
        isActive: true,
        updatedAt: true,
        _count: { select: { messages: true } },
        groups: { select: { id: true, name: true } },
      },
    });

    logger.info('[PATCH /api/funnel-sms/[id]]', { orgId, id });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    logger.error('[PATCH /api/funnel-sms/[id]]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/funnel-sms/[id] — cascade 삭제 (FunnelSmsMessage 포함)
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // IDOR 방어
    const existing = await prisma.funnelSms.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '퍼널문자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // AGENT 역할은 삭제 불가
    if (ctx.role === 'AGENT') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // cascade: onDelete: Cascade 설정으로 FunnelSmsMessage도 자동 삭제
    // ContactGroup.funnelSmsId: onDelete: SetNull — 그룹 연결은 null로 처리
    await prisma.funnelSms.delete({ where: { id } });

    logger.info('[DELETE /api/funnel-sms/[id]]', { orgId, id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/funnel-sms/[id]]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
