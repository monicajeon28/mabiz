export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/groups/[id]/register
// seq 토큰으로 그룹 등록하고 연락처 추가
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { seq, name, phone, email, recaptchaToken } = body;

    // [SEC-001] Rate Limiting: 요청 IP 기반 10 requests/hour 제한
    const clientIp = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     'unknown';
    const rateLimitKey = `group-register:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60 * 60 * 1000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `요청이 너무 많습니다. ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}초 후 다시 시도하세요.`,
          resetAt: rateLimit.resetAt
        },
        { status: 429 }
      );
    }

    // [SEC-001] ReCAPTCHA v3 검증 (환경변수가 있는 경우)
    if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken) {
      try {
        const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
        });
        const recaptchaData = await recaptchaResponse.json();

        // ReCAPTCHA v3: score > 0.5는 사람, < 0.5는 봇으로 판단
        if (!recaptchaData.success || recaptchaData.score < 0.5) {
          return NextResponse.json(
            { ok: false, error: 'RECAPTCHA_FAILED', message: '인증에 실패했습니다' },
            { status: 400 }
          );
        }
      } catch (err) {
        logger.error('[GroupRegister] ReCAPTCHA 검증 실패', { err });
        return NextResponse.json(
          { ok: false, error: 'RECAPTCHA_ERROR', message: '인증 처리 중 오류가 발생했습니다' },
          { status: 500 }
        );
      }
    }

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

    // [CONS-001] 트랜잭션 보호: Contact.upsert 성공 후 ContactGroupMember 실패 방지
    const { contact, funnelStarted } = await prisma.$transaction(async (tx) => {
      // Contact upsert
      const contact = await tx.contact.upsert({
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
      await tx.contactGroupMember.upsert({
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

      // [CONS-002] 펀널 에러 상태 반영: 펀널 생성 실패를 명시적으로 처리
      let funnelStarted = false;
      if (group.funnelId) {
        try {
          // Funnel stages 조회
          const funnelStages = await tx.funnelStage.findMany({
            where: { funnelId: group.funnelId },
            orderBy: { order: 'asc' },
            take: 1,
          });

          if (funnelStages.length > 0) {
            await tx.funnelEntry.create({
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
          // 펀널 실패는 트랜잭션을 롤백하지 않음 (Contact/GroupMember는 성공)
          // funnelStarted = false로 유지
        }
      }

      return { contact, funnelStarted };
    });

    return NextResponse.json(
      { ok: true, contact, funnelStarted, groupId },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/groups/[id]/register]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
