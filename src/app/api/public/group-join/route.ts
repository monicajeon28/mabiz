import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { triggerGroupFunnelSms } from '@/lib/funnel-sms-trigger';

// POST /api/public/group-join — 외부 랜딩페이지 폼 제출 → 그룹 등록
// seq 기반 공개 엔드포인트 (인증 불필요)
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let seq: string, nm: string, hp: string, em: string | null;
    // FIX #4: result_url을 form body에서 읽어 상대경로만 허용 (open redirect 방지)
    let resultUrl: string | null = null;

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      seq = String(formData.get('seq') ?? '').trim();
      nm  = String(formData.get('nm')  ?? '').trim();
      hp  = String(formData.get('hp')  ?? '').trim();
      em  = String(formData.get('em')  ?? '').trim() || null;
      // 상대경로만 허용 (절대 URL / 외부 도메인 차단)
      const raw = String(formData.get('result_url') ?? '').trim();
      if (raw.startsWith('/') && !raw.startsWith('//')) resultUrl = raw;
    } else {
      const body = await req.json() as Record<string, string>;
      seq = (body.seq ?? '').trim();
      nm  = (body.nm  ?? '').trim();
      hp  = (body.hp  ?? '').trim();
      em  = (body.em  ?? '').trim() || null;
      const raw = (body.result_url ?? '').trim();
      if (raw.startsWith('/') && !raw.startsWith('//')) resultUrl = raw;
    }

    if (!seq || !nm || !hp) {
      return NextResponse.json({ ok: false, message: 'seq, nm, hp는 필수입니다.' }, { status: 400 });
    }

    // seq로 그룹 조회
    const group = await prisma.contactGroup.findFirst({
      where: { seq },
      select: { id: true, organizationId: true, name: true, funnelSmsIds: true, funnelSmsId: true },
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

    // FIX #5: 신규 등록 여부 확인 후 memberCount 조건부 증가
    const existingMember = await prisma.contactGroupMember.findUnique({
      where: { groupId_contactId: { groupId: group.id, contactId: contact.id } },
      select: { groupId: true },
    });

    await prisma.contactGroupMember.upsert({
      where: { groupId_contactId: { groupId: group.id, contactId: contact.id } },
      create: { groupId: group.id, contactId: contact.id },
      update: {},
    });

    // 실제 신규 등록 시에만 memberCount 증가
    if (!existingMember) {
      await prisma.contactGroup.update({
        where: { id: group.id },
        data: { memberCount: { increment: 1 } },
      }).catch(() => {/* 실패해도 등록은 성공 */});
    }

    // 퍼널문자(FunnelSms) 트리거 — fire-and-forget
    // 신규: funnelSmsIds[] 배열 처리 (우선)
    if (group.funnelSmsIds && group.funnelSmsIds.length > 0) {
      for (const funnelSmsId of group.funnelSmsIds) {
        triggerGroupFunnelSms({
          contactId:      contact.id,
          groupId:        group.id,
          organizationId: group.organizationId,
          funnelSmsId,
        }).catch((err) => {
          logger.error('[group-join] FunnelSms trigger 실패', {
            seq, groupId: group.id, contactId: contact.id, funnelSmsId, err,
          });
        });
      }
    }
    // 레거시 폴백: 단일 funnelSmsId (P1-1) — 마이그레이션 전까지 지원
    else if (group.funnelSmsId) {
      triggerGroupFunnelSms({
        contactId:      contact.id,
        groupId:        group.id,
        organizationId: group.organizationId,
        funnelSmsId:    group.funnelSmsId,
      }).catch((err) => {
        logger.error('[group-join] FunnelSms trigger 실패 (legacy)', {
          seq, groupId: group.id, contactId: contact.id, funnelSmsId: group.funnelSmsId, err,
        });
      });
    }

    logger.log('[group-join]', { seq, contactId: contact.id, groupId: group.id });

    if (resultUrl) {
      // Next.js 15: redirect는 절대 URL 필요
      const absoluteUrl = new URL(resultUrl, req.url).toString();
      return NextResponse.redirect(absoluteUrl, { status: 302 });
    }
    return NextResponse.json({ ok: true, message: '신청이 완료되었습니다.' });
  } catch (err) {
    logger.error('[POST /api/public/group-join]', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
