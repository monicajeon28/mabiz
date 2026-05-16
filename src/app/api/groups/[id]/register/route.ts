export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// POST /api/groups/[id]/register
// seq 토큰으로 그룹 등록하고 연락처 추가
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { seq, name, phone, email } = body;

    if (!seq || !name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', message: '필수 입력값이 없습니다' },
        { status: 400 }
      );
    }

    // GroupToken 검증
    const token = await prisma.groupToken.findUnique({
      where: { id: seq },
      include: { group: true },
    });

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다' },
        { status: 400 }
      );
    }

    if (!token.active) {
      return NextResponse.json(
        { ok: false, error: 'INACTIVE_TOKEN', message: '비활성화된 토큰입니다' },
        { status: 400 }
      );
    }

    if (new Date(token.expiresAt) < new Date()) {
      return NextResponse.json(
        { ok: false, error: 'EXPIRED_TOKEN', message: '만료된 토큰입니다' },
        { status: 400 }
      );
    }

    const groupId = token.groupId;
    const group = token.group;

    // Contact upsert
    const contact = await prisma.contact.upsert({
      where: { phone_organizationId: { phone, organizationId: group.organizationId } },
      update: {
        name: name || undefined,
        email: email || undefined,
      },
      create: {
        phone,
        name,
        email: email || null,
        organizationId: group.organizationId,
      },
    });

    // ContactGroupMember 추가
    await prisma.contactGroupMember.upsert({
      where: { contactId_groupId: { contactId: contact.id, groupId } },
      update: {},
      create: { contactId: contact.id, groupId },
    });

    // 연락처 아웃소싱/추가 카운트
    logger.log('[GroupRegister] 신청 완료', {
      groupId,
      contactId: contact.id,
      phone,
      organizationId: group.organizationId,
    });

    // 펀널 자동 시작 (group에 funnel이 있으면)
    let funnelStarted = false;
    if (group.funnelId) {
      try {
        // Funnel stages 조회
        const funnelStages = await prisma.funnelStage.findMany({
          where: { funnelId: group.funnelId },
          orderBy: { order: 'asc' },
          take: 1,
        });

        if (funnelStages.length > 0) {
          await prisma.funnelEntry.create({
            data: {
              contactId: contact.id,
              funnelId: group.funnelId,
              currentStageId: funnelStages[0].id,
              status: 'ACTIVE',
            },
          });
          funnelStarted = true;
        }
      } catch (err) {
        logger.error('[GroupRegister] 펀널 시작 실패', { err, groupId, contactId: contact.id });
      }
    }

    return NextResponse.json(
      { ok: true, contact, funnelStarted, groupId },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/groups/[id]/register]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
