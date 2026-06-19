import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { recordProcessedWebhookEvent } from '@/lib/webhook-execution';
import { isStaffPhone } from '@/lib/contact-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CruisedotMemberPayload {
  eventId: string;
  eventType: 'member.created' | 'member.updated' | 'member.deleted';
  timestamp: string;
  member: {
    id: string | number;       // 크루즈닷 내부 user ID
    name: string | null;
    phone: string | null;
    email: string | null;
    provider: 'kakao' | 'naver' | 'google' | 'direct'; // 가입 경로
    mallUserId?: string | null; // 크루즈닷몰 user_id (소셜: 'kakao_123' 형식)
    mallNickname?: string | null;
    profileImg?: string | null;
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('[MemberWebhook] CRUISEDOT_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 503 });
  }

  // Bearer 토큰 검증
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'Missing Bearer token' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  if (token.length === 0 || token.length !== secret.length || !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    logger.warn('[MemberWebhook] 인증 실패');
    return NextResponse.json({ ok: false, error: 'Authentication failed' }, { status: 401 });
  }

  // HMAC 서명 검증
  const body = await req.text();
  const signature = req.headers.get('x-signature') ?? '';
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    logger.warn('[MemberWebhook] 서명 불일치');
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 403 });
  }

  let payload: CruisedotMemberPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { eventId, eventType, member } = payload;

  if (!eventId || !eventType || !member?.id) {
    return NextResponse.json({ ok: false, error: '필수 필드 누락 (eventId, eventType, member.id)' }, { status: 400 });
  }

  try {
    // 멱등성 체크
    const already = await prisma.processedWebhookEvent.findUnique({
      where: { eventId_webhookType: { eventId, webhookType: 'cruisedot-member' } },
    });
    if (already) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (eventType === 'member.created' || eventType === 'member.updated') {
      // externalId = 크루즈닷 member.id (문자열로 통일)
      const externalId = String(member.id);

      await prisma.gmUser.upsert({
        where: { externalId },
        create: {
          externalId,
          name: member.name ?? null,
          phone: member.phone ?? null,
          email: member.email ?? null,
          socialProvider: member.provider === 'direct' ? null : member.provider,
          mallUserId: member.mallUserId ?? null,
          mallNickname: member.mallNickname ?? null,
          socialProfileImg: member.profileImg ?? null,
          password: '',
          role: 'user',
        },
        update: {
          name: member.name ?? undefined,
          phone: member.phone ?? undefined,
          email: member.email ?? undefined,
          socialProvider: member.provider === 'direct' ? null : member.provider,
          mallUserId: member.mallUserId ?? undefined,
          mallNickname: member.mallNickname ?? undefined,
          socialProfileImg: member.profileImg ?? undefined,
        },
      });

      logger.log('[MemberWebhook] 회원 upsert', { externalId, provider: member.provider, eventType });

      // phone이 있으면 Contact 고객 카드도 생성/업데이트 (영업 목록 누락 방지)
      if (member.phone) {
        const orgId =
          process.env.DEFAULT_ORGANIZATION_ID ||
          (await prisma.organization.findFirst({ select: { id: true } }))?.id;

        if (orgId) {
          const staffCheck = await isStaffPhone(member.phone, orgId);
          if (staffCheck) {
            logger.warn('[MemberWebhook] 직원 번호 Contact 생성 건너뜀', { phone: member.phone.slice(0, 6) + '****' });
          } else {
            await prisma.contact.upsert({
              where: {
                phone_organizationId: { phone: member.phone, organizationId: orgId },
              },
              create: {
                name: member.name || member.email || '이름없음',
                phone: member.phone,
                email: member.email ?? null,
                organizationId: orgId,
                type: 'INQUIRY',
                sourceType: 'user',
                signupMethod:
                  member.provider === 'direct' ? 'general' : member.provider,
                visibility: 'ADMIN_ONLY',
              },
              update: {
                // 이름/이메일만 업데이트, sourceType은 덮어쓰지 않음
                ...(member.name ? { name: member.name } : {}),
                ...(member.email ? { email: member.email } : {}),
                ...(member.provider !== 'direct'
                  ? { signupMethod: member.provider }
                  : {}),
              },
            });

            logger.log('[MemberWebhook] Contact upsert 완료', {
              phone: member.phone,
              orgId,
              eventType,
            });
          }
        } else {
          logger.warn('[MemberWebhook] Organization 없음 — Contact 생성 건너뜀');
        }
      }
    }

    await recordProcessedWebhookEvent(prisma, {
      eventId,
      webhookType: 'cruisedot-member',
    });

    return NextResponse.json({ ok: true, eventType, externalId: String(member.id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[MemberWebhook] 처리 실패', { eventId, err: msg });

    await recordProcessedWebhookEvent(prisma, {
      eventId,
      webhookType: 'cruisedot-member',
      status: 'FAILED',
      errorMessage: msg,
      context: '[MemberWebhook] FAILED 기록 실패',
    });

    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
