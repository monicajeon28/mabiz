export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { enqueueRecaptchaVerification } from '@/lib/recaptcha-queue';

// POST /api/groups/[id]/register
// seq 토큰으로 그룹 등록하고 연락처 추가
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { seq, name, phone, email, recaptchaToken } = body;

    // [SEC-001] Rate Limiting: 요청 IP 기반 10 requests/hour 제한
    const clientIp = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     'unknown';
    const rateLimitKey = `group-register:${clientIp}`;
    const rateLimit = await checkRateLimitAsync(rateLimitKey, 10, 60 * 60 * 1000);

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

    const groupId: string = token.groupId;
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
        where: { groupId_contactId: { groupId, contactId: contact.id } },
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
            await tx.contactFunnelState.create({
              data: {
                organizationId: group.organizationId,
                contactId: contact.id,
                status: 'ACTIVE',
                metadata: { funnelId: group.funnelId, stageId: funnelStages[0].id },
              },
            });
            funnelStarted = true;
          } else {
            // [LOG-001] 펀널 단계 미존재: 운영팀이 펀널을 생성했지만 단계를 설정하지 않음
            logger.warn('[GroupRegister] 펀널 단계 없음', {
              groupId,
              funnelId: group.funnelId,
              contactId: contact.id,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          // [LOG-002] 펀널 시작 오류: 자세한 오류 정보 기록
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error('[GroupRegister] 펀널 시작 실패', {
            groupId,
            funnelId: group.funnelId,
            contactId: contact.id,
            errorMessage,
            errorCode: err instanceof Error && 'code' in err ? (err as any).code : undefined,
            timestamp: new Date().toISOString(),
          });
          // 펀널 실패는 트랜잭션을 롤백하지 않음 (Contact/GroupMember는 성공)
          // funnelStarted = false로 유지
        }
      }

      return { contact, funnelStarted };
    });

    // [ASYNC] ReCAPTCHA 검증을 비동기 큐에 등록 (트랜잭션 성공 후)
    let recaptchaTaskId: string | undefined;
    if (recaptchaToken) {
      try {
        const response = await enqueueRecaptchaVerification({
          organizationId: group.organizationId,
          contactId: contact.id,
          groupId,
          recaptchaToken,
        });
        recaptchaTaskId = response.taskId;
        logger.log('[GroupRegister] ReCAPTCHA 검증 큐 등록 완료', {
          taskId: recaptchaTaskId,
          contactId: contact.id,
          groupId,
        });
      } catch (err) {
        logger.error('[GroupRegister] ReCAPTCHA 큐 등록 실패', { err });
        // 비동기 실패는 사용자 응답에 포함하지 않음
        // Contact/GroupMember는 이미 성공적으로 생성됨
      }
    }

    return NextResponse.json(
      {
        ok: true,
        contact,
        funnelStarted,
        groupId,
        recaptchaTaskId,
        message: recaptchaToken ? '그룹 등록 완료. 인증 중...' : '그룹 등록 완료',
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/groups/[id]/register]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
