export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendSms, getOrgSmsConfig } from '@/lib/aligo';

const MAX_RECIPIENTS = 200; // Vercel 타임아웃 방지 (10건 배치 × 20회 ≈ 2초)
const BATCH_SIZE     = 10;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/groups/[id]/blast
 * 그룹 전체에 즉시 SMS 일괄 발송
 *
 * body: { message: string; dryRun?: boolean }
 * dryRun=true → 실제 발송 없이 대상 인원만 반환
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: groupId } = await params;

    const { message, dryRun = false } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, message: '메시지를 입력하세요.' }, { status: 400 });
    }

    // [보안] 그룹 소유권 검증 (IDOR 방지 — 조항 3)
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true },
    });
    if (!group) {
      return NextResponse.json({ ok: false, message: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 발송 대상 조회 (수신거부 제외, 최대 MAX_RECIPIENTS)
    const members = await prisma.contactGroupMember.findMany({
      where: {
        groupId,
        contact: {
          organizationId: orgId,
          optOutAt:       null,
          phone:          { not: '' },
        },
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
      },
      take: MAX_RECIPIENTS + 1, // +1로 초과 여부 감지
    });

    const totalInGroup = await prisma.contactGroupMember.count({ where: { groupId } });
    const isOverLimit  = members.length > MAX_RECIPIENTS;
    const targets      = members.slice(0, MAX_RECIPIENTS);

    logger.log('[GroupBlast] 대상 파악', {
      group:      group.name,
      total:      totalInGroup,
      targets:    targets.length,
      dryRun,
    });

    // dryRun: 실제 발송 없이 인원만 반환
    if (dryRun) {
      return NextResponse.json({
        ok:          true,
        dryRun:      true,
        groupName:   group.name,
        total:       totalInGroup,
        willSend:    targets.length,
        isOverLimit,
        overLimitMsg: isOverLimit
          ? `200명 제한 초과 — 첫 ${MAX_RECIPIENTS}명에게만 발송됩니다.`
          : null,
      });
    }

    // SMS 설정 1회 조회 (루프 밖)
    const smsConfig = await getOrgSmsConfig(orgId);
    if (!smsConfig) {
      return NextResponse.json({ ok: false, message: 'SMS 설정이 없습니다. 설정 → SMS에서 Aligo 정보를 입력하세요.' }, { status: 400 });
    }

    const config = { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone };

    // 10건씩 배치 발송
    let sentCount    = 0;
    let blockedCount = 0;
    let failedCount  = 0;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (m) => {
          const personalizedMsg = message
            .replace(/\[고객명\]/g, m.contact.name)
            .replace(/\[이름\]/g,   m.contact.name);

          const result = await sendSms({
            config,
            receiver:       m.contact.phone,
            msg:            personalizedMsg,
            organizationId: orgId,
            contactId:      m.contact.id,
            channel:        'GROUP',
          });

          const code = Number(result.result_code);
          if (code === 1)              sentCount++;
          else if (code === -99 || code === -98) blockedCount++;
          else                         failedCount++;
        })
      );
    }

    logger.log('[GroupBlast] 발송 완료', {
      group: group.name,
      sentCount,
      blockedCount,
      failedCount,
    });

    return NextResponse.json({
      ok:          true,
      groupName:   group.name,
      sentCount,
      blockedCount,
      failedCount,
      total:       targets.length,
    });

  } catch (err) {
    logger.error('[GroupBlast] 처리 실패', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
