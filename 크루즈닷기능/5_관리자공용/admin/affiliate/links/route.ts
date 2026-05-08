export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/links/route.ts
// 어필리에이트 링크 관리 API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인 (세션 만료 검증 포함)
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) {
    logger.log('[Admin Affiliate Links] No session ID');
    return false;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session || !session.User) {
      logger.log('[Admin Affiliate Links] Session or user not found');
      return false;
    }

    // 세션 만료 검증
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      logger.log('[Admin Affiliate Links] Session expired');
      return false;
    }

    const isAdmin = session.User.role === 'admin';
    logger.log('[Admin Affiliate Links] Auth check:', { userId: session.userId, role: session.User.role, isAdmin });
    return isAdmin;
  } catch (error) {
    console.error('[Admin Affiliate Links] Auth check error:', error);
    return false;
  }
}

// GET: 링크 목록 조회
export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    // 쿼리 파라미터에서 필터 가져오기
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // 필터 조건 구성
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    // 링크 목록 조회
    const links = await prisma.affiliateLink.findMany({
      where,
      include: {
        AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
          },
        },
        AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
          },
        },
        AffiliateProduct: {
          select: {
            id: true,
            productCode: true,
            title: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            AffiliateLead: true,
            AffiliateSale: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // metadata에서 랜딩페이지 정보 추출 및 배치 조회 (N+1 방지)
    const landingPageIds = [
      ...new Set(
        links
          .map((link) => (link.metadata as any)?.landingPageId as number | undefined)
          .filter((id): id is number => id != null)
      ),
    ];

    const landingPages = landingPageIds.length > 0
      ? await prisma.landingPage.findMany({
          where: { id: { in: landingPageIds } },
          select: {
            id: true,
            title: true,
            slug: true,
            category: true,
          },
        })
      : [];

    const landingPageMap = new Map(landingPages.map((p) => [p.id, p]));

    const linksWithLandingPages = links.map((link) => {
      const landingPageId = (link.metadata as any)?.landingPageId ?? null;
      return {
        ...link,
        landingPageId,
        landingPage: landingPageId != null ? (landingPageMap.get(landingPageId) ?? null) : null,
      };
    });

    // 응답 형식 변환
    const formattedLinks = linksWithLandingPages.map(link => ({
      ...link,
      manager: link.AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile,
      agent: link.AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile,
      product: link.AffiliateProduct,
      issuedBy: link.User,
      landingPageId: link.landingPageId,
      landingPage: link.landingPage,
      _count: {
        leads: link._count.AffiliateLead,
        sales: link._count.AffiliateSale,
      },
    }));

    return NextResponse.json({
      ok: true,
      links: formattedLinks,
    });
  } catch (error) {
    console.error('[Admin Affiliate Links] GET error:', error);
    return NextResponse.json(
      { ok: false, message: '링크 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 링크 생성
export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        message: '인증이 필요합니다. 다시 로그인해 주세요.',
      }, { status: 403 });
    }

    // 세션에서 관리자 ID 가져오기
    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!session) {
      return NextResponse.json({ 
        ok: false, 
        message: '세션을 찾을 수 없습니다.',
      }, { status: 403 });
    }

    const body = await req.json();
    const { 
      title, 
      productCode, 
      managerId, 
      managerIds, // 전체선택 시 배열
      agentId, 
      agentIds, // 전체선택 시 배열
      expiresAt, 
      campaignName, 
      description,
      landingPageId // 랜딩페이지 ID (필수: 먼저 랜딩페이지를 생성한 후 여기에 연결)
    } = body;

    // 워크플로우: 1) 랜딩페이지 생성 → 2) 어필리에이트 링크 생성 시 landingPageId로 연결
    // 랜딩페이지 링크인 경우 productCode는 선택사항
    if (!landingPageId && !productCode) {
      return NextResponse.json({
        ok: false,
        message: '상품 코드 또는 랜딩페이지를 선택해주세요.',
      }, { status: 400 });
    }

    // 고유한 링크 코드 생성
    const generateLinkCode = async (index?: number): Promise<string> => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      const suffix = index !== undefined ? `-${index}` : '';
      let code = `LINK-${timestamp}-${random}${suffix}`.toUpperCase();
      
      // 중복 확인
      let exists = await prisma.affiliateLink.findUnique({
        where: { code },
      });
      
      let attempts = 0;
      while (exists && attempts < 10) {
        const random2 = Math.random().toString(36).substring(2, 8);
        code = `LINK-${timestamp}-${random2}${suffix}`.toUpperCase();
        exists = await prisma.affiliateLink.findUnique({
          where: { code },
        });
        attempts++;
      }
      
      if (exists) {
        throw new Error('링크 코드 생성에 실패했습니다. 다시 시도해주세요.');
      }
      
      return code;
    };

    // 전체선택 처리: managerIds 또는 agentIds가 있으면 각각 개별 링크 생성
    const managerIdList = managerIds && Array.isArray(managerIds) ? managerIds : (managerId ? [Number(managerId)] : []);
    const agentIdList = agentIds && Array.isArray(agentIds) ? agentIds : (agentId ? [Number(agentId)] : []);

    // 조합 계산: managerIdList × agentIdList
    // 예: managerIds=[1,2], agentIds=[3,4] → (1,3), (1,4), (2,3), (2,4) = 4개 링크
    const linkCombinations: Array<{ managerId: number | null; agentId: number | null }> = [];

    if (managerIdList.length > 0 && agentIdList.length > 0) {
      // 둘 다 선택된 경우: 모든 조합
      for (const mId of managerIdList) {
        for (const aId of agentIdList) {
          linkCombinations.push({ managerId: mId, agentId: aId });
        }
      }
    } else if (managerIdList.length > 0) {
      // 대리점장만 선택
      for (const mId of managerIdList) {
        linkCombinations.push({ managerId: mId, agentId: null });
      }
    } else if (agentIdList.length > 0) {
      // 판매원만 선택
      for (const aId of agentIdList) {
        linkCombinations.push({ managerId: null, agentId: aId });
      }
    } else {
      // 둘 다 비어있으면 공통 링크 1개
      linkCombinations.push({ managerId: null, agentId: null });
    }

    const totalLinks = linkCombinations.length;
    
    // 대량 생성 방지: 최대 1000개 제한
    if (totalLinks > 1000) {
      return NextResponse.json({
        ok: false,
        message: `한 번에 생성할 수 있는 링크는 최대 1000개입니다. 현재 ${totalLinks}개 링크가 생성됩니다. 선택을 줄여주세요.`,
      }, { status: 400 });
    }

    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
    const now = new Date();
    
    // metadata에 랜딩페이지 정보 저장
    // 이렇게 하면 상품 페이지에서 링크 코드로 접근 시 랜딩페이지로 리다이렉트됨
    // - 본사 구매몰: /landing/[slug]
    // - 파트너 구매몰: /store/[affiliateCode]/[slug]
    const metadata: any = {};
    if (landingPageId) {
      metadata.landingPageId = Number(landingPageId);
    }
    
    const baseData: any = {
      title: title || null,
      productCode: productCode || null,
      issuedById: session.userId,
      expiresAt: expiresAtDate,
      campaignName: campaignName || null,
      description: description || null,
      status: 'ACTIVE' as const,
      updatedAt: now, // 명시적으로 설정 (필수 필드)
    };
    
    // metadata가 있으면 추가
    if (Object.keys(metadata).length > 0) {
      baseData.metadata = metadata;
    }

    // 배치 처리: 100개씩 나눠서 생성 (서버 부하 방지)
    const BATCH_SIZE = 100;
    const createdLinks: any[] = [];
    let createdCount = 0;

    try {
      for (let i = 0; i < linkCombinations.length; i += BATCH_SIZE) {
        const batch = linkCombinations.slice(i, i + BATCH_SIZE);
        
        // 먼저 모든 링크 코드를 생성
        const linkCodes = await Promise.all(
          batch.map((_, batchIndex) => {
            const globalIndex = i + batchIndex;
            return generateLinkCode(globalIndex);
          })
        );
        
        // 배치 내에서 트랜잭션으로 처리
        const batchResults = await prisma.$transaction(
          batch.map((combo, batchIndex) => {
            const code = linkCodes[batchIndex];
            return prisma.affiliateLink.create({
              data: {
                ...baseData,
                code,
                managerId: combo.managerId,
                agentId: combo.agentId,
              },
              include: {
                AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile: {
                  select: {
                    id: true,
                    displayName: true,
                    affiliateCode: true,
                  },
                },
                AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile: {
                  select: {
                    id: true,
                    displayName: true,
                    affiliateCode: true,
                  },
                },
                AffiliateProduct: {
                  select: {
                    id: true,
                    productCode: true,
                    title: true,
                  },
                },
                User: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                _count: {
                  select: {
                    AffiliateLead: true,
                    AffiliateSale: true,
                  },
                },
              },
            });
          }),
          {
            maxWait: 30000, // 30초 대기
            timeout: 60000, // 60초 타임아웃
          }
        );

        createdLinks.push(...batchResults);
        createdCount += batchResults.length;
      }

      // 응답 형식 변환
      const formattedLinks = createdLinks.map(link => ({
        ...link,
        manager: link.AffiliateProfile_AffiliateLink_managerIdToAffiliateProfile,
        agent: link.AffiliateProfile_AffiliateLink_agentIdToAffiliateProfile,
        product: link.AffiliateProduct,
        issuedBy: link.User,
        _count: {
          leads: link._count.AffiliateLead,
          sales: link._count.AffiliateSale,
        },
      }));

      return NextResponse.json({
        ok: true,
        link: formattedLinks[0], // 첫 번째 링크 반환 (하위 호환성)
        links: formattedLinks, // 모든 링크 반환
        createdCount: createdCount,
        message: `${createdCount}개의 링크가 생성되었습니다.`,
      });
    } catch (batchError: any) {
      console.error('[Admin Affiliate Links] Batch create error:', batchError);
      console.error('[Admin Affiliate Links] Error details:', {
        message: batchError.message,
        code: batchError.code,
        stack: batchError.stack,
        meta: batchError.meta,
      });
      return NextResponse.json(
        { 
          ok: false, 
          message: `링크 생성 중 오류가 발생했습니다. (${createdCount}/${totalLinks}개 생성됨)`,
          error: batchError.message,
          details: process.env.NODE_ENV === 'development' ? {
            message: batchError.message,
            code: batchError.code,
            meta: batchError.meta,
          } : undefined
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Admin Affiliate Links] POST error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '링크 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
