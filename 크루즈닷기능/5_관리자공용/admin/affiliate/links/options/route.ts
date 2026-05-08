export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/links/options/route.ts
// 링크 생성에 필요한 옵션 데이터 조회 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User.role === 'admin';
  } catch (error) {
    console.error('[Admin Affiliate Links Options] Auth check error:', error);
    return false;
  }
}

// GET: 링크 생성에 필요한 옵션 데이터 조회
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

    // 상품 목록 조회
    const products = await prisma.cruiseProduct.findMany({
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        basePrice: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // 최대 1000개
    });

    // 랜딩페이지 목록 조회 (관리자가 생성한 모든 랜딩페이지)
    const landingPages = await prisma.landingPage.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        description: true,
        User: {
          select: {
            id: true,
            name: true,
            AffiliateProfile: {
              select: {
                id: true,
                displayName: true,
                affiliateCode: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 대리점장 목록 조회 (랜딩페이지 정보 포함)
    const managers = await prisma.affiliateProfile.findMany({
      where: {
        type: 'BRANCH_MANAGER',
      },
      select: {
        id: true,
        displayName: true,
        affiliateCode: true,
        landingSlug: true,
        User: {
          select: {
            name: true,
            phone: true,
            mallUserId: true,
          },
        },
      },
      orderBy: {
        displayName: 'asc',
      },
    });

    // 판매원 목록 조회 (랜딩페이지 정보 포함)
    const agents = await prisma.affiliateProfile.findMany({
      where: {
        type: 'SALES_AGENT',
      },
      select: {
        id: true,
        displayName: true,
        affiliateCode: true,
        landingSlug: true,
        User: {
          select: {
            name: true,
            phone: true,
            mallUserId: true,
          },
        },
      },
      orderBy: {
        displayName: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      products: products.map(p => ({
        id: p.id,
        productCode: p.productCode,
        label: `${p.productCode} - ${p.cruiseLine} ${p.shipName} ${p.packageName}`,
        cruiseLine: p.cruiseLine,
        shipName: p.shipName,
        packageName: p.packageName,
        basePrice: p.basePrice,
      })),
      landingPages: landingPages.map(lp => {
        const owner = lp.User?.AffiliateProfile;
        const ownerName = owner?.displayName || lp.User?.name || '관리자';
        const ownerType = owner?.type === 'BRANCH_MANAGER' ? '대리점장' : owner?.type === 'SALES_AGENT' ? '판매원' : '관리자';
        return {
          id: lp.id,
          title: lp.title,
          slug: lp.slug,
          category: lp.category,
          description: lp.description,
          ownerName,
          ownerType,
          affiliateCode: owner?.affiliateCode || null,
          label: `${lp.title}${lp.category ? ` (${lp.category})` : ''} - ${ownerName} (${ownerType})`,
          url: owner?.affiliateCode 
            ? `/store/${owner.affiliateCode}/${lp.slug}`
            : `/landing/${lp.slug}`,
        };
      }),
      managers: managers.map(m => ({
        id: m.id,
        displayName: m.displayName || m.User?.name || '이름 없음',
        affiliateCode: m.affiliateCode,
        landingSlug: m.landingSlug,
        phone: m.User?.phone,
        mallUserId: m.User?.mallUserId,
        label: `${m.displayName || m.User?.name || '이름 없음'} (${m.affiliateCode || '코드 없음'})${m.landingSlug ? ' - 랜딩페이지 있음' : ''}`,
      })),
      agents: agents.map(a => ({
        id: a.id,
        displayName: a.displayName || a.User?.name || '이름 없음',
        affiliateCode: a.affiliateCode,
        landingSlug: a.landingSlug,
        phone: a.User?.phone,
        mallUserId: a.User?.mallUserId,
        label: `${a.displayName || a.User?.name || '이름 없음'} (${a.affiliateCode || '코드 없음'})${a.landingSlug ? ' - 랜딩페이지 있음' : ''}`,
      })),
    });
  } catch (error: any) {
    console.error('[Admin Affiliate Links Options] GET error:', error);
    return NextResponse.json(
      { ok: false, message: '옵션 데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
