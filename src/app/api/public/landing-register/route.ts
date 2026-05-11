import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizePhone } from '@/lib/phone-normalize';

/**
 * POST /api/public/landing-register
 * B2B 유입 랜딩페이지 신청 (공개 API — 인증 불필요)
 *
 * 점장별 ref 파라미터로 누구의 랜딩에서 유입됐는지 구분:
 * - ref 없음 → 관리자(본사) 직접 유입
 * - ref=xxx → 해당 점장의 유입
 *
 * Contact에 저장 → CRM에서 즉시 확인 가능
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, ref } = body as {
      name?: string;
      phone?: string;
      ref?: string; // 점장 식별자 (userId 또는 organizationId)
    };

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ ok: false, message: '이름과 전화번호는 필수입니다.' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);

    // ref로 점장의 조직 찾기
    let organizationId: string | null = null;
    let refUserId: string | null = null;

    if (ref) {
      // ref가 organizationId인지 userId인지 확인
      const org = await prisma.organization.findUnique({
        where: { id: ref },
        select: { id: true },
      });
      if (org) {
        organizationId = org.id;
      } else {
        // userId로 조직 찾기
        const member = await prisma.organizationMember.findFirst({
          where: { userId: ref, isActive: true },
          select: { organizationId: true, userId: true },
        });
        if (member) {
          organizationId = member.organizationId;
          refUserId = member.userId;
        }
      }
    }

    // ref가 있는데 매칭 안 되면 에러 (점장 오타 방지)
    if (ref && !organizationId) {
      logger.warn('[LandingRegister] ref 매칭 실패', { ref });
      return NextResponse.json({ ok: false, message: '잘못된 링크입니다. 정확한 링크로 다시 시도해주세요.' }, { status: 400 });
    }

    // ref 없으면 기본 조직 (본사 직접 유입)
    if (!organizationId) {
      organizationId = process.env.DEFAULT_ORGANIZATION_ID ?? null;
    }

    if (!organizationId) {
      logger.error('[LandingRegister] DEFAULT_ORGANIZATION_ID 미설정');
      return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // Contact upsert — 중복 방지
    const contact = await prisma.contact.upsert({
      where: { phone_organizationId: { phone: normalizedPhone, organizationId } },
      create: {
        phone: normalizedPhone,
        name: name.trim(),
        organizationId,
        type: 'LEAD',
        channel: 'b2b',
        affiliateCode: ref ?? null,
        ...(refUserId ? { assignedUserId: refUserId } : {}),
      },
      update: {
        // 기존 이름/귀속 보존 — 덮어쓰지 않음 (수수료 귀속 변경 방지)
        // 최초 등록 시에만 설정되고, 재신청 시에는 변경 안 됨
      },
      select: { id: true },
    });

    logger.log('[LandingRegister] B2B 유입 등록', {
      phone: normalizedPhone.slice(0, 4) + '***',
      ref: ref ?? '본사',
      organizationId,
    });

    return NextResponse.json({ ok: true, contactId: contact.id });
  } catch (err) {
    logger.error('[LandingRegister] 등록 실패', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
