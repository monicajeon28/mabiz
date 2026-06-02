import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// POST /api/public/group-join — 외부 랜딩페이지 폼 제출 → 그룹 등록
// seq 기반 공개 엔드포인트 (인증 불필요)
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let seq: string, nm: string, hp: string, em: string | null;

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      seq = String(formData.get('seq') ?? '').trim();
      nm  = String(formData.get('nm')  ?? '').trim();
      hp  = String(formData.get('hp')  ?? '').trim();
      em  = String(formData.get('em')  ?? '').trim() || null;
    } else {
      const body = await req.json() as Record<string, string>;
      seq = (body.seq ?? '').trim();
      nm  = (body.nm  ?? '').trim();
      hp  = (body.hp  ?? '').trim();
      em  = (body.em  ?? '').trim() || null;
    }

    if (!seq || !nm || !hp) {
      return NextResponse.json({ ok: false, message: 'seq, nm, hp는 필수입니다.' }, { status: 400 });
    }

    // seq로 그룹 조회
    const group = await prisma.contactGroup.findFirst({
      where: { seq },
      select: { id: true, organizationId: true, name: true, funnelSmsIds: true },
    });

    if (!group) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 그룹 코드입니다.' }, { status: 404 });
    }

    // Contact upsert (phone 기반)
    const contact = await prisma.contact.upsert({
      where: { phone_organizationId: { organizationId: group.organizationId, phone: hp } },
      create: {
        organizationId: group.organizationId,
        name: nm,
        phone: hp,
        email: em,
        status: 'INQUIRY',
        sourceType: 'landing_page',
      },
      update: {
        name: nm,
        ...(em ? { email: em } : {}),
      },
      select: { id: true },
    });

    // 그룹 멤버 추가 (중복 무시)
    await prisma.contactGroupMember.upsert({
      where: { groupId_contactId: { groupId: group.id, contactId: contact.id } },
      create: { groupId: group.id, contactId: contact.id },
      update: {},
    });

    // memberCount 동기
    await prisma.contactGroup.update({
      where: { id: group.id },
      data: { memberCount: { increment: 1 } },
    }).catch(() => {/* 실패해도 등록은 성공 */});

    const resultUrl = new URL(req.url).searchParams.get('result_url');
    if (resultUrl) {
      return NextResponse.redirect(resultUrl, { status: 302 });
    }

    logger.log('[group-join]', { seq, contactId: contact.id, groupId: group.id });
    return NextResponse.json({ ok: true, message: '신청이 완료되었습니다.' });
  } catch (err) {
    logger.error('[POST /api/public/group-join]', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
