export const dynamic = 'force-dynamic';

// app/api/public/inquiry/route.ts
// 구매 문의 API (로그인 불필요)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { logger } from '@/lib/logger';

/**
 * POST: 구매 문의 제출
 * 로그인 없이 접근 가능
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productCode, name, phone, passportNumber, message, isPhoneConsultation, actualName, actualPhone } = body;

    // 전화상담 신청인 경우 helpuser/helpphone으로 구분
    const isPhoneConsult = isPhoneConsultation === true || (name === 'helpuser' && phone === 'helpphone');
    const customerName = isPhoneConsult ? (actualName || name) : name;
    const customerPhone = isPhoneConsult ? (actualPhone || phone) : phone;

    // 필수 필드 검증
    if (!productCode || !customerName || !customerPhone) {
      return NextResponse.json(
        { ok: false, error: '필수 정보를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 전화번호 정규화 및 검증
    const normalizedPhone = normalizePhone(customerPhone);
    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        { ok: false, error: '올바른 전화번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 상품 존재 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: { id: true, packageName: true },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 로그인된 사용자 ID 확인 (선택적)
    let userId: number | null = null;
    try {
      const { getSession } = await import('@/lib/session');
      const session = await getSession();
      if (session?.userId) {
        userId = parseInt(session.userId);
      }
    } catch {
      // 세션 확인 실패해도 계속 진행 (비회원 문의 가능)
    }

    // 어필리에이트 코드 추적
    const cookies = req.cookies;
    const affiliateCode = cookies.get('affiliate_code')?.value || null;
    const affiliateMallUserId = body.partnerId || cookies.get('affiliate_mall_user_id')?.value || null;

    // 어필리에이트 프로필 찾기
    let managerId: number | null = null;
    let agentId: number | null = null;

    if (affiliateCode || affiliateMallUserId) {
      const profileWhere: any = {};
      if (affiliateCode) {
        profileWhere.affiliateCode = affiliateCode;
      } else if (affiliateMallUserId) {
        profileWhere.User = { mallUserId: affiliateMallUserId };
      }

      const affiliateProfile = await prisma.affiliateProfile.findFirst({
        where: {
          ...profileWhere,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          type: true,
          displayName: true,
          AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
            where: { status: 'ACTIVE' },
            select: { managerId: true },
            take: 1,
          },
        },
      });

      if (affiliateProfile) {
        if (affiliateProfile.type === 'BRANCH_MANAGER') {
          managerId = affiliateProfile.id;
        } else if (affiliateProfile.type === 'SALES_AGENT') {
          agentId = affiliateProfile.id;
          const agentRelations = affiliateProfile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile;
          if (agentRelations && agentRelations.length > 0) {
            managerId = agentRelations[0].managerId;
          }
        }
      }
    }

    // ProductInquiry 테이블에 저장 (managerId/agentId 포함)
    const inquiry = await prisma.productInquiry.create({
      data: {
        productCode,
        userId,
        name: customerName,
        phone: normalizedPhone,
        passportNumber: passportNumber || null,
        message: message || null,
        managerId: managerId || null,
        agentId: agentId || null,
        status: 'pending',
        updatedAt: new Date(),
      }
    });

    // 전화번호로 User 찾기
    let userForLead: { id: number } | null = null;
    if (normalizedPhone) {
      userForLead = await prisma.user.findFirst({
        where: { phone: normalizedPhone },
        select: { id: true },
      });

      // User가 없으면 생성 (잠재고객으로 저장)
      if (!userForLead) {
        try {
          const newUser = await prisma.user.create({
            data: {
              name: customerName || null,
              phone: normalizedPhone,
              email: null,
              password: '1101',
              role: 'user',
              customerSource: isPhoneConsult ? 'phone-consultation' : 'product-inquiry',
              customerStatus: 'active',
              updatedAt: new Date(),
            },
            select: { id: true },
          });
          userForLead = newUser;
        } catch (userError: any) {
          logger.error('public-inquiry', 'User 생성 실패', { error: userError?.message });
        }
      } else {
        try {
          await prisma.user.update({
            where: { id: userForLead.id },
            data: {
              customerSource: isPhoneConsult ? 'phone-consultation' : 'product-inquiry',
            },
          });
        } catch (updateError: any) {
          logger.error('public-inquiry', 'User 업데이트 실패', { error: updateError?.message });
        }
      }
    }

    // AffiliateLead 생성 (누적 기록)
    try {
      let linkId: number | null = null;
      if (affiliateCode && productCode) {
        const autoLinkCode = `AUTO-${productCode}-${affiliateCode}`;
        const affiliateLink = await prisma.affiliateLink.findUnique({
          where: { code: autoLinkCode },
          select: { id: true },
        });
        if (affiliateLink) {
          linkId = affiliateLink.id;
        }
      }

      await prisma.affiliateLead.create({
        data: {
          linkId: linkId,
          managerId: managerId || null,
          agentId: agentId || null,
          customerName: customerName,
          customerPhone: normalizedPhone,
          status: 'NEW',
          source: isPhoneConsult ? 'phone-consultation' : (affiliateMallUserId ? `mall-${affiliateMallUserId}` : 'product-inquiry'),
          metadata: {
            productCode,
            productName: product?.packageName || productCode,
            inquiryId: inquiry.id,
            affiliateCode,
            affiliateMallUserId,
            mallUserId: affiliateMallUserId,
            userId: userForLead?.id || null,
            isPhoneConsultation: isPhoneConsult,
            actualName: customerName,
            actualPhone: customerPhone,
            channel: managerId || agentId ? '파트너' : '본사',
            linkCode: linkId ? `AUTO-${productCode}-${affiliateCode}` : null,
          },
          updatedAt: new Date(),
        }
      });
    } catch (leadError: any) {
      logger.error('public-inquiry', 'AffiliateLead 생성 실패', { error: leadError?.message });
    }

    return NextResponse.json({
      ok: true,
      message: '문의가 접수되었습니다. 곧 연락드리겠습니다.',
      inquiryId: inquiry.id,
    });
  } catch (error) {
    logger.error('public-inquiry', 'POST error', { error: String(error) });
    return NextResponse.json(
      { ok: false, error: '문의 접수 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
