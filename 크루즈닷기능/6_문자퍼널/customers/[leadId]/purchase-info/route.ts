export const dynamic = 'force-dynamic';

// 판매원용 고객 구매 정보 조회 API
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/partner-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { profile } = await requirePartnerContext();
    const leadId = parseInt(params.leadId);
    
    if (isNaN(leadId)) {
      return NextResponse.json({ 
        ok: false, 
        error: '유효하지 않은 Lead ID입니다.' 
      }, { status: 400 });
    }

    // Lead 조회 및 권한 확인
    const lead = await prisma.affiliateLead.findFirst({
      where: {
        id: leadId,
        OR: [
          { agentId: profile.id },
          { managerId: profile.id },
        ],
      },
      include: {
        AffiliateSale: {
          where: {
            status: { not: 'CANCELLED' },
          },
          include: {
            Payment: true,
            AffiliateProduct: {
              include: {
                CruiseProduct: {
                  include: {
                    MallProductContent: true,
                  },
                },
              },
            },
          },
          orderBy: { saleDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ 
        ok: false, 
        error: '고객을 찾을 수 없거나 접근 권한이 없습니다.' 
      }, { status: 404 });
    }

    // 고객 정보 (User 조회)
    let customer = null;
    let birthDate: string | null = null;
    
    if (lead.customerPhone) {
      customer = await prisma.user.findFirst({
        where: { phone: lead.customerPhone },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      });

      // 생년월일 조회 (여권 제출 완료한 경우만)
      if (customer) {
        const passportSubmission = await prisma.passportSubmission.findFirst({
          where: {
            userId: customer.id,
            isSubmitted: true,
          },
          include: {
            PassportSubmissionGuest: {
              where: {
                name: customer.name || undefined,
              },
              take: 1,
            },
          },
          orderBy: { submittedAt: 'desc' },
        });

        if (passportSubmission && passportSubmission.PassportSubmissionGuest.length > 0) {
          const guest = passportSubmission.PassportSubmissionGuest[0];
          if (guest.dateOfBirth) {
            birthDate = guest.dateOfBirth.toISOString().split('T')[0];
          }
        }
      }
    }

    // 결제 정보 조회 (Payment에서)
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { buyerTel: lead.customerPhone || undefined },
          { buyerName: lead.customerName || undefined },
        ],
        affiliateCode: profile.affiliateCode,
        status: 'paid',
      },
      orderBy: { paidAt: 'desc' },
    });

    // 상품 정보 조회
    let productInfo = null;
    let paymentInfo = null;

    if (lead.AffiliateSale && lead.AffiliateSale.length > 0) {
      const sale = lead.AffiliateSale[0];
      if (sale.AffiliateProduct?.CruiseProduct) {
        productInfo = sale.AffiliateProduct.CruiseProduct;
        paymentInfo = {
          amount: sale.saleAmount,
          date: sale.saleDate,
          currency: 'KRW',
        };
      }
    } else if (payment?.productCode) {
      // Payment에서 직접 상품 정보 조회
      productInfo = await prisma.cruiseProduct.findUnique({
        where: { productCode: payment.productCode },
        include: {
          MallProductContent: true,
        },
      });
      
      if (productInfo) {
        paymentInfo = {
          amount: payment.amount,
          date: payment.paidAt,
          currency: payment.currency || 'KRW',
        };
      }
    }

    // MallProductContent에서 상세 정보 추출
    let productDetails = null;
    if (productInfo?.MallProductContent?.layout) {
      const layout = productInfo.MallProductContent.layout as any;
      productDetails = {
        tags: productInfo.tags || [],
        included: layout.included || [],
        excluded: layout.excluded || [],
        refundPolicy: layout.refundPolicy || '',
        flightInfo: layout.flightInfo || null,
        hasGuide: layout.hasGuide || false,
        hasEscort: layout.hasEscort || false,
        hasCruiseDotStaff: layout.hasCruiseDotStaff || false,
        hasTravelInsurance: layout.hasTravelInsurance || false,
      };
    }

    // 방문 국가 추출 (itineraryPattern에서)
    const visitedCountries: string[] = [];
    const destinations: string[] = [];
    if (productInfo?.itineraryPattern && Array.isArray(productInfo.itineraryPattern)) {
      productInfo.itineraryPattern.forEach((day: any) => {
        if (day.type === 'PortVisit' && day.country) {
          if (!visitedCountries.includes(day.country)) {
            visitedCountries.push(day.country);
          }
          if (day.location && !destinations.includes(day.location)) {
            destinations.push(day.location);
          }
        }
      });
    }

    // 환불 정보 조회 (환불인증서용)
    let refundInfo = null;
    if (payment?.cancelledAt) {
      refundInfo = {
        amount: payment.amount,
        date: payment.cancelledAt,
        reason: payment.cancelReason || '고객 요청',
      };
    } else if (lead.AffiliateSale && lead.AffiliateSale.length > 0) {
      const sale = lead.AffiliateSale[0];
      if (sale.refundedAt) {
        refundInfo = {
          amount: sale.refundAmount || sale.saleAmount,
          date: sale.refundedAt,
          reason: '고객 요청',
        };
      }
    }

    // 고객 상태 조회
    let customerStatus = null;
    if (customer) {
      const userStatus = await prisma.user.findUnique({
        where: { id: customer.id },
        select: { customerStatus: true },
      });
      customerStatus = userStatus?.customerStatus || null;
    }

    return NextResponse.json({
      ok: true,
      customer: customer ? {
        id: customer.id,
        name: customer.name || lead.customerName,
        phone: customer.phone || lead.customerPhone,
        email: customer.email,
        birthDate: birthDate,
        customerStatus: customerStatus,
      } : {
        id: null,
        name: lead.customerName,
        phone: lead.customerPhone,
        email: null,
        birthDate: birthDate,
        customerStatus: null,
      },
      product: productInfo ? {
        id: productInfo.id,
        productCode: productInfo.productCode,
        cruiseLine: productInfo.cruiseLine,
        shipName: productInfo.shipName,
        packageName: productInfo.packageName,
        nights: productInfo.nights,
        days: productInfo.days,
        basePrice: productInfo.basePrice,
        description: productInfo.description,
        visitedCountries,
        destinations,
        ...productDetails,
      } : null,
      payment: paymentInfo,
      refund: refundInfo,
    });
  } catch (error) {
    console.error('[Partner Customer Purchase Info] Error:', error);
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


