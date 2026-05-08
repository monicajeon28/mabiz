export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/documents/generate/route.ts
// 서류 생성 API (타사 비교 견적서, 구매확인서, 환불완료증서)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateComparisonQuote, generateRefundCertificate } from '@/lib/affiliate/document-generator';
import { sendPurchaseConfirmation } from '@/lib/affiliate/purchase-confirmation';

// 권한 체크 함수
async function checkDocumentAccess(
  userId: number,
  saleId?: number,
  leadId?: number
): Promise<{ authorized: boolean; profileId?: number; profileType?: string; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return { authorized: false, error: '사용자를 찾을 수 없습니다' };
  }

  // 관리자는 모든 문서 생성 가능
  if (user.role === 'admin') {
    return { authorized: true };
  }

  // 어필리에이트 사용자 확인
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, type: true },
  });

  if (!profile) {
    return { authorized: false, error: '어필리에이트 프로필을 찾을 수 없습니다' };
  }

  // 판매원/대리점장은 자신의 판매에 대해서만 문서 생성 가능
  if (saleId) {
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: { managerId: true, agentId: true },
    });

    if (!sale) {
      return { authorized: false, error: '판매 정보를 찾을 수 없습니다' };
    }

    const isAuthorized =
      (profile.type === 'MANAGER' && sale.managerId === profile.id) ||
      (profile.type === 'AGENT' && sale.agentId === profile.id);

    if (!isAuthorized) {
      return { authorized: false, error: '이 판매에 대한 문서 생성 권한이 없습니다' };
    }
  }

  if (leadId) {
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      select: { managerId: true, agentId: true },
    });

    if (!lead) {
      return { authorized: false, error: '리드 정보를 찾을 수 없습니다' };
    }

    const isAuthorized =
      (profile.type === 'MANAGER' && lead.managerId === profile.id) ||
      (profile.type === 'AGENT' && lead.agentId === profile.id);

    if (!isAuthorized) {
      return { authorized: false, error: '이 리드에 대한 문서 생성 권한이 없습니다' };
    }
  }

  return {
    authorized: true,
    profileId: profile.id,
    profileType: profile.type,
  };
}

// POST: 서류 생성 및 발송
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { documentType, saleId, leadId, ...documentData } = body;

    if (!documentType || !['COMPARISON_QUOTE', 'PURCHASE_CONFIRMATION', 'REFUND_CERTIFICATE'].includes(documentType)) {
      return NextResponse.json(
        { ok: false, error: '올바른 문서 타입을 지정해주세요' },
        { status: 400 }
      );
    }

    // 권한 체크
    const access = await checkDocumentAccess(sessionUser.id, saleId, leadId);
    if (!access.authorized) {
      return NextResponse.json(
        { ok: false, error: access.error || '문서 생성 권한이 없습니다' },
        { status: 403 }
      );
    }

    let result: any = {};

    // 문서 타입별 처리
    switch (documentType) {
      case 'COMPARISON_QUOTE': {
        // 타사 비교 견적서
        if (!documentData.customerName || !documentData.productCode || !documentData.ourPrice) {
          return NextResponse.json(
            { ok: false, error: '필수 정보가 누락되었습니다 (customerName, productCode, ourPrice)' },
            { status: 400 }
          );
        }

        const templates = await generateComparisonQuote({
          customerName: documentData.customerName,
          customerPhone: documentData.customerPhone,
          customerEmail: documentData.customerEmail,
          productCode: documentData.productCode,
          productName: documentData.productName,
          ourPrice: documentData.ourPrice,
          competitorPrices: documentData.competitorPrices || [],
          headcount: documentData.headcount,
          cabinType: documentData.cabinType,
          fareCategory: documentData.fareCategory,
          responsibleName: documentData.responsibleName || '담당자',
          responsibleRole: documentData.responsibleRole || '판매원',
          saleId,
          leadId,
        });

        result = {
          documentType: 'COMPARISON_QUOTE',
          templates,
          message: '타사 비교 견적서가 생성되었습니다',
        };
        break;
      }

      case 'PURCHASE_CONFIRMATION': {
        // 구매확인서
        if (!saleId) {
          return NextResponse.json(
            { ok: false, error: '판매 ID가 필요합니다' },
            { status: 400 }
          );
        }

        const confirmationResult = await sendPurchaseConfirmation(saleId);
        if (!confirmationResult.success) {
          return NextResponse.json(
            { ok: false, error: confirmationResult.error || '구매확인서 발송에 실패했습니다' },
            { status: 500 }
          );
        }

        result = {
          documentType: 'PURCHASE_CONFIRMATION',
          results: confirmationResult.results,
          message: '구매확인서가 발송되었습니다',
        };
        break;
      }

      case 'REFUND_CERTIFICATE': {
        // 환불완료증서
        if (!saleId) {
          return NextResponse.json(
            { ok: false, error: '판매 ID가 필요합니다' },
            { status: 400 }
          );
        }

        const sale = await prisma.affiliateSale.findUnique({
          where: { id: saleId },
          include: {
            lead: {
              select: {
                customerName: true,
                customerPhone: true,
              },
            },
            manager: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            agent: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            product: {
              select: {
                productName: true,
              },
            },
          },
        });

        if (!sale) {
          return NextResponse.json(
            { ok: false, error: '판매 정보를 찾을 수 없습니다' },
            { status: 404 }
          );
        }

        if (sale.status !== 'REFUNDED') {
          return NextResponse.json(
            { ok: false, error: '환불 처리되지 않은 판매입니다' },
            { status: 400 }
          );
        }

        const responsibleProfile = sale.agent || sale.manager;
        const responsibleName = responsibleProfile?.displayName || responsibleProfile?.user?.name || '담당자';
        const responsibleRole = sale.agent ? '판매원' : '대리점장';

        const templates = await generateRefundCertificate({
          customerName: sale.lead?.customerName || '고객님',
          customerPhone: sale.lead?.customerPhone,
          customerEmail: (sale.metadata as any)?.customerEmail,
          productCode: sale.productCode || '',
          productName: sale.product?.productName,
          originalSaleAmount: sale.saleAmount,
          refundAmount: sale.saleAmount, // 환불금액은 판매금액과 동일 (부분 환불은 추후 지원)
          refundDate: sale.refundedAt?.toISOString() || new Date().toISOString(),
          refundReason: sale.cancellationReason || '환불 요청',
          orderCode: sale.externalOrderCode || `ORDER-${sale.id}`,
          responsibleName,
          responsibleRole: responsibleRole as '대리점장' | '판매원',
          saleId: sale.id,
        });

        result = {
          documentType: 'REFUND_CERTIFICATE',
          templates,
          message: '환불완료증서가 생성되었습니다',
        };
        break;
      }
    }

    // 발송 로그 기록 (선택적)
    if (saleId || leadId) {
      try {
        await prisma.affiliateInteraction.create({
          data: {
            leadId: leadId || undefined,
            profileId: access.profileId || undefined,
            createdById: sessionUser.id,
            interactionType: `${documentType}_GENERATED`,
            note: `${documentType} 생성 완료`,
            metadata: {
              documentType,
              saleId,
              leadId,
              generatedAt: new Date().toISOString(),
            },
          },
        });
      } catch (logError) {
        console.error('[Document Generation] Log error:', logError);
        // 로그 실패해도 문서 생성은 성공으로 처리
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Document Generation] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '문서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
