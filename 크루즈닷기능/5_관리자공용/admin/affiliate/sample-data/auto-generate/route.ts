export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/crypto';

// 샘플 고객 이름 목록
const SAMPLE_NAMES = [
  '김민수', '이영희', '박준호', '최지영', '정성호',
  '강미영', '윤동현', '장수진', '임태호', '한소영',
  '오민준', '신혜진', '조대현', '배은지', '류성민',
  '송지은', '홍민석', '문수정', '양준혁', '구미라'
];

// 샘플 전화번호 생성
function generatePhoneNumber(index: number): string {
  const prefixes = ['010', '011', '016', '017', '019'];
  const prefix = prefixes[index % prefixes.length];
  const middle = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const last = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}-${middle}-${last}`;
}

// 샘플 상품 코드
const SAMPLE_PRODUCT_CODES = [
  'CRUISE-2025-001',
  'CRUISE-2025-002',
  'CRUISE-2025-003',
  'CRUISE-2025-004',
  'CRUISE-2025-005',
];

// 샘플 판매 금액 범위
const SALE_AMOUNTS = [
  { min: 500000, max: 1000000 },   // 50만~100만
  { min: 1000000, max: 2000000 },  // 100만~200만
  { min: 2000000, max: 3000000 },  // 200만~300만
  { min: 3000000, max: 5000000 },  // 300만~500만
];

// 단일 프로필(판매원 또는 대리점장)에게 샘플 데이터 생성
async function generateSampleDataForProfile(
  profileId: number,
  sessionUser: { id: number },
  count: number = 10
) {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { id: profileId },
    include: {
      AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: {
          AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
            select: { id: true },
          },
        },
      },
      User: {
        select: {
          id: true,
          mallUserId: true,
        },
      },
    },
  });

  if (!profile) {
    return { success: false, message: '프로필을 찾을 수 없습니다.' };
  }

  if (profile.type !== 'SALES_AGENT' && profile.type !== 'BRANCH_MANAGER') {
    return { success: false, message: '판매원 또는 대리점장 프로필만 샘플 데이터를 생성할 수 있습니다.' };
  }

  const isSalesAgent = profile.type === 'SALES_AGENT';
  const managerId = isSalesAgent 
    ? (profile.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile[0]?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.id || null)
    : null;
  const agentId = isSalesAgent ? profile.id : null;

  // 링크 확인 (없으면 생성)
  let link = null;
  try {
    if (isSalesAgent && agentId) {
      // 판매원인 경우: agentId로 찾기
      link = await prisma.affiliateLink.findFirst({
        where: {
          agentId: agentId,
          status: 'ACTIVE',
        },
      });
    } else if (!isSalesAgent) {
      // 대리점장인 경우: managerId로 찾기
      link = await prisma.affiliateLink.findFirst({
        where: {
          managerId: profile.id,
          status: 'ACTIVE',
        },
      });
    }

    if (!link) {
      // 기본 링크 생성 (고유 코드 생성)
      const linkCode = `link-${profile.affiliateCode}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const linkNow = new Date();
      const linkData: any = {
        code: linkCode,
        title: '기본 링크',
        issuedById: sessionUser.id,
        status: 'ACTIVE',
        createdAt: linkNow,
        updatedAt: linkNow,
      };

      // agentId와 managerId는 null일 수 있으므로 조건부로 추가
      if (agentId) {
        linkData.agentId = agentId;
      }
      if (isSalesAgent) {
        if (managerId) {
          linkData.managerId = managerId;
        }
      } else {
        linkData.managerId = profile.id;
      }

      link = await prisma.affiliateLink.create({
        data: linkData,
      });
      logger.log('[Auto Generate] Link created:', { linkId: link.id, code: link.code, agentId, managerId: linkData.managerId });
    } else {
      logger.log('[Auto Generate] Existing link found:', { linkId: link.id, code: link.code });
    }
  } catch (linkError: any) {
    console.error('[Auto Generate] Link creation error:', linkError);
    throw new Error(`링크 생성 실패: ${linkError.message || '알 수 없는 오류'}`);
  }

  const now = new Date();
  const createdLeads: any[] = [];
  const createdSales: any[] = [];
  const createdCustomers: any[] = [];

  // 샘플 데이터 생성
  for (let i = 0; i < count; i++) {
    const name = SAMPLE_NAMES[i % SAMPLE_NAMES.length];
    const phone = generatePhoneNumber(i);
    const daysAgo = Math.floor(Math.random() * 90);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const leadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
    const leadStatus = leadStatuses[Math.floor(Math.random() * leadStatuses.length)];

    // 리드 생성
    // 판매원인 경우: managerId는 대리점장 ID (없으면 null), agentId는 본인 ID
    // 대리점장인 경우: managerId는 본인 ID, agentId는 null
    const leadData: any = {
      linkId: link.id,
      customerName: name,
      customerPhone: phone,
      status: leadStatus,
      source: 'sample',
      createdAt: createdAt,
      updatedAt: createdAt,
      metadata: {
        isSample: true,
        createdBy: sessionUser.id,
      },
    };

    // managerId와 agentId는 조건부로 추가 (null이 아닐 때만)
    if (isSalesAgent) {
      if (managerId) {
        leadData.managerId = managerId;
      }
      if (agentId) {
        leadData.agentId = agentId;
      }
    } else {
      // 대리점장인 경우
      leadData.managerId = profile.id;
      // agentId는 null (추가하지 않음)
    }

    const lead = await prisma.affiliateLead.create({
      data: leadData,
    });

    createdLeads.push(lead);

    // 일부 리드는 판매로 전환
    if (leadStatus === 'CONVERTED' || Math.random() > 0.5) {
      const saleAmountRange = SALE_AMOUNTS[Math.floor(Math.random() * SALE_AMOUNTS.length)];
      const saleAmount = Math.floor(Math.random() * (saleAmountRange.max - saleAmountRange.min + 1)) + saleAmountRange.min;
      const costAmount = Math.floor(saleAmount * 0.7);
      const netRevenue = saleAmount - costAmount;
      const branchCommission = Math.floor(netRevenue * 0.1);
      const salesCommission = Math.floor(netRevenue * 0.05);
      const withholdingAmount = Math.floor(salesCommission * 0.033);

      const saleStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
      const saleStatus = saleStatuses[Math.floor(Math.random() * saleStatuses.length)];

      const productCode = SAMPLE_PRODUCT_CODES[Math.floor(Math.random() * SAMPLE_PRODUCT_CODES.length)];

      // 판매 수수료 계산 (대리점장인 경우 판매원 수수료는 0)
      const finalBranchCommission = isSalesAgent ? branchCommission : Math.floor(netRevenue * 0.15); // 대리점장은 15%
      const finalSalesCommission = isSalesAgent ? salesCommission : 0; // 대리점장은 판매원 수수료 없음
      const finalWithholdingAmount = isSalesAgent ? withholdingAmount : 0; // 대리점장은 원천징수 없음

      const saleData: any = {
        linkId: link.id,
        leadId: lead.id,
        productCode: productCode,
        cabinType: ['인테리어', '오션뷰', '발코니', '스위트'][Math.floor(Math.random() * 4)],
        fareCategory: ['일반', '프리미엄', 'VIP'][Math.floor(Math.random() * 3)],
        headcount: Math.floor(Math.random() * 3) + 1,
        saleAmount: saleAmount,
        costAmount: costAmount,
        netRevenue: netRevenue,
        branchCommission: finalBranchCommission,
        salesCommission: finalSalesCommission,
        withholdingAmount: finalWithholdingAmount,
        status: saleStatus,
        saleDate: new Date(createdAt.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
        createdAt: createdAt,
        updatedAt: createdAt,
        metadata: {
          isSample: true,
          createdBy: sessionUser.id,
        },
      };

      // managerId와 agentId는 조건부로 추가 (null이 아닐 때만)
      if (isSalesAgent) {
        if (managerId) {
          saleData.managerId = managerId;
        }
        if (agentId) {
          saleData.agentId = agentId;
        }
      } else {
        // 대리점장인 경우
        saleData.managerId = profile.id;
        // agentId는 null (추가하지 않음)
      }

      const sale = await prisma.affiliateSale.create({
        data: saleData,
      });

      createdSales.push(sale);
    }

    // 고객 생성 (일부만)
    if (Math.random() > 0.3) {
      let customer = await prisma.user.findFirst({
        where: {
          phone: phone,
        },
      });

      if (!customer) {
        // 샘플 고객용 기본 비밀번호 해시
        const defaultPassword = await hashPassword('sample123');
        // 이메일에 고유 식별자 추가 (인덱스 + 타임스탬프)
        const uniqueEmail = `${name.toLowerCase().replace(/\s/g, '')}-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@sample.com`;
        customer = await prisma.user.create({
          data: {
            name: name,
            phone: phone,
            email: uniqueEmail,
            password: defaultPassword,
            role: 'user',
            customerSource: 'affiliate-sample',
            customerStatus: 'active',
          },
        });
      }

      createdCustomers.push(customer);

      // PartnerCustomerGroup 찾기 또는 생성
      let partnerCustomerGroup = await prisma.partnerCustomerGroup.findFirst({
        where: {
          profileId: profile.id,
          name: '샘플 고객',
        },
      });

      if (!partnerCustomerGroup) {
        const groupNow = new Date();
        partnerCustomerGroup = await prisma.partnerCustomerGroup.create({
          data: {
            profileId: profile.id,
            name: '샘플 고객',
            description: '테스트용 샘플 고객 그룹',
            createdAt: groupNow,
            updatedAt: groupNow,
          },
        });
      }

      // 리드를 그룹에 연결
      await prisma.affiliateLead.update({
        where: { id: lead.id },
        data: { groupId: partnerCustomerGroup.id },
      });
    }
  }

  return {
    success: true,
    profileId: profile.id,
    profileName: profile.displayName || profile.nickname,
    profileType: profile.type,
    data: {
      leads: createdLeads.length,
      sales: createdSales.length,
      customers: createdCustomers.length,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 확인
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { count = 10, profileId } = body;

    // 특정 프로필 ID가 제공된 경우
    if (profileId) {
      const result = await generateSampleDataForProfile(profileId, sessionUser, count);
      if (!result.success) {
        return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        message: '샘플 데이터가 생성되었습니다.',
        results: [result],
      });
    }

    // 모든 판매원과 대리점장에게 자동 생성
    const profiles = await prisma.affiliateProfile.findMany({
      where: {
        type: { in: ['SALES_AGENT', 'BRANCH_MANAGER'] },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        displayName: true,
        nickname: true,
        affiliateCode: true,
        type: true,
      },
    });

    if (profiles.length === 0) {
      return NextResponse.json({
        ok: false,
        message: '활성 상태인 판매원 또는 대리점장이 없습니다.',
      }, { status: 404 });
    }

    logger.log(`[Auto Generate] ${profiles.length}명의 프로필에게 샘플 데이터 생성 시작...`);

    const results = [];
    const errors = [];

    for (const profile of profiles) {
      try {
        const result = await generateSampleDataForProfile(profile.id, sessionUser, count);
        if (result.success) {
          results.push(result);
          logger.log(`[Auto Generate] ✅ ${result.profileName} (${result.profileType}, ID: ${result.profileId}) - 리드: ${result.data.leads}, 판매: ${result.data.sales}, 고객: ${result.data.customers}`);
        } else {
          errors.push({ profileId: profile.id, profileName: profile.displayName || profile.nickname, error: result.message });
        }
      } catch (error: any) {
        console.error(`[Auto Generate] ❌ ${profile.displayName || profile.nickname} (ID: ${profile.id}) 오류:`, error);
        errors.push({
          profileId: profile.id,
          profileName: profile.displayName || profile.nickname,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `총 ${profiles.length}명의 프로필 중 ${results.length}명에게 샘플 데이터가 생성되었습니다.`,
      summary: {
        total: profiles.length,
        success: results.length,
        failed: errors.length,
      },
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[admin/affiliate/sample-data/auto-generate][POST] error:', error);
    return NextResponse.json({
      ok: false,
      message: '샘플 데이터 자동 생성 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
