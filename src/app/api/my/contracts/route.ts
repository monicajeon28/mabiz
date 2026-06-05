import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const ctx = await getAuthContext();

    // FREE_SALES는 접근 불가
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: true, contracts: [] });
    }

    const orgId = resolveOrgId(ctx);

    // ContractInstance: CRM 자체 DB에서 조회 (template 관계 포함)
    const instances = await prisma.contractInstance.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        template: { select: { name: true, category: true } },
      },
    });

    // contactId 목록으로 Contact 이름 일괄 조회
    const contactIds = instances
      .map((i) => i.contactId)
      .filter((id): id is string => id !== null);

    const contacts = contactIds.length > 0
      ? await prisma.contact.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, name: true },
        })
      : [];
    const contactMap = new Map(contacts.map((c) => [c.id, c.name]));

    const contracts = instances.map((inst) => {
      // status 매핑
      const statusMap: Record<string, string> = {
        DRAFT:     'draft',
        SENT:      'invited',
        SIGNED:    'signed',
        COMPLETED: 'completed',
        REJECTED:  'rejected',
      };

      // contractType: 템플릿 카테고리로 판단
      const category = inst.template?.category ?? '';
      let contractType: 'cruisedot-partners' | 'rental-partner' | 'other' = 'other';
      if (category === 'CRUISE' || category === 'PACKAGE') contractType = 'cruisedot-partners';
      else if (category === 'RENTAL') contractType = 'rental-partner';

      // 계약자 이름: Contact → boundData.name → fallback
      const bound = (inst.boundData as Record<string, unknown>) ?? {};
      const contractorName =
        (inst.contactId ? contactMap.get(inst.contactId) : null) ??
        (typeof bound.name === 'string' ? bound.name : null) ??
        '이름 없음';

      // driveUrl: boundData에서 추출 (서명 완료 후 Drive에 저장됨)
      const driveUrl = typeof bound.driveUrl === 'string' ? bound.driveUrl : null;

      return {
        id:             inst.id,
        contractorName,
        status:         statusMap[inst.status] ?? 'invited',
        invitedAt:      inst.createdAt.toISOString(),
        signedAt:       inst.signedAt?.toISOString() ?? null,
        completedAt:    inst.signedAt?.toISOString() ?? null,
        submittedAt:    inst.createdAt.toISOString(),
        mentorCode:     null,
        smsDay0Sent:    inst.smsDay0Sent,
        smsDay1Sent:    inst.smsDay1Sent,
        smsDay2Sent:    inst.smsDay2Sent,
        lastReminderAt: inst.smsDay2SentAt?.toISOString() ?? null,
        contractType,
        driveUrl,
      };
    });

    logger.log('[Contracts] 조회', { orgId, count: contracts.length });
    return NextResponse.json({ ok: true, contracts });

  } catch (e) {
    logger.log('[Contracts] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: true, contracts: [] });
  }
}
