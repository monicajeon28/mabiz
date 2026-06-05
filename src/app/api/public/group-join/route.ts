import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { triggerGroupFunnelSms } from '@/lib/funnel-sms-trigger';
import { checkRateLimitAsync } from '@/lib/rate-limit';

// 전화번호 정규화 (010-1234-5678 → 01012345678)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits : '';
}

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

    // 전화번호 정규화 (010-1234-5678 → 01012345678)
    const normalizedHp = normalizePhone(hp);
    if (!normalizedHp) {
      return NextResponse.json({ ok: false, message: '유효한 전화번호가 아닙니다.' }, { status: 400 });
    }

    // C-1: 레이트 리밋 (DB 조회 전 차단)
    //  - IP: 5회/60초 (분산 봇 1차 방어)
    //  - seq: 30회/60초 (특정 그룹 코드 대량 등록 방어, IP 로테이션 우회 대비)
    const ip =
      (req.headers.get('x-forwarded-for')?.split(',')[0].trim()) ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const [ipLimit, seqLimit] = await Promise.all([
      checkRateLimitAsync(`group-join:ip:${ip}`, 5, 60_000),
      checkRateLimitAsync(`group-join:seq:${seq}`, 30, 60_000),
    ]);
    if (!ipLimit.allowed || !seqLimit.allowed) {
      return NextResponse.json(
        { ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 },
      );
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
      where: { phone_organizationId: { organizationId: group.organizationId, phone: normalizedHp } },
      create: {
        organizationId: group.organizationId,
        name: nm,
        phone: normalizedHp,
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

    // 재등록(이미 멤버) 시 update:{}로 addedAt을 갱신하지 않는다.
    //  → 퍼널문자 1일차/2일차 발송 기준일(anchorDate)은 "최초 그룹 입력일"로 고정된다.
    const member = await prisma.contactGroupMember.upsert({
      where: { groupId_contactId: { groupId: group.id, contactId: contact.id } },
      create: { groupId: group.id, contactId: contact.id },
      update: {},
      select: { addedAt: true },
    });

    // 실제 신규 등록 시에만 memberCount 증가
    if (!existingMember) {
      await prisma.contactGroup.update({
        where: { id: group.id },
        data: { memberCount: { increment: 1 } },
      }).catch(() => {/* 실패해도 등록은 성공 */});
    }

    // 퍼널문자(FunnelSms) 트리거 — Vercel 서버리스: Response 반환 전에 await 완료 필수
    const funnelSmsTargets: string[] =
      group.funnelSmsIds && group.funnelSmsIds.length > 0
        ? group.funnelSmsIds
        : group.funnelSmsId
        ? [group.funnelSmsId]
        : [];

    if (funnelSmsTargets.length > 0) {
      await Promise.allSettled(
        funnelSmsTargets.map((funnelSmsId) =>
          triggerGroupFunnelSms({
            contactId:      contact.id,
            groupId:        group.id,
            organizationId: group.organizationId,
            funnelSmsId,
            // 발송 기준일 = 고객이 그룹에 들어온 날(최초 입력일). 재등록 시에도 불변.
            anchorDate:     member.addedAt,
          }).catch((err) => {
            logger.error('[group-join] FunnelSms trigger 실패', {
              seq, groupId: group.id, contactId: contact.id, funnelSmsId, err,
            });
          })
        )
      );
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
