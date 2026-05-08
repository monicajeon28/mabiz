export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/product-views/route.ts
// 사용자의 상품 조회 내역 조회 (관리자 전용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { logger } from '@/lib/logger';

async function checkAdminAuth() {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.userId) },
    select: { role: true }
  });

  return user?.role === 'admin' ? user : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const views = await prisma.productView.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      take: limit,
      include: {
        Product: {
          select: {
            productCode: true,
            packageName: true,
            cruiseLine: true,
            shipName: true,
            itineraryPattern: true,
          }
        }
      }
    });

    // 국가 코드 -> 국가명 매핑
    const COUNTRY_CODE_TO_NAME: Record<string, string> = {
      'JP': '일본',
      'KR': '한국',
      'TH': '태국',
      'VN': '베트남',
      'MY': '말레이시아',
      'SG': '싱가포르',
      'ES': '스페인',
      'FR': '프랑스',
      'IT': '이탈리아',
      'GR': '그리스',
      'TR': '터키',
      'US': '미국',
      'CN': '중국',
      'TW': '대만',
      'HK': '홍콩',
      'PH': '필리핀',
      'ID': '인도네시아',
    };

    // itineraryPattern에서 국가 추출 함수
    const extractCountries = (itineraryPattern: any): string[] => {
      const countries = new Set<string>();
      
      if (!itineraryPattern) return [];
      
      // destination 필드가 있는 경우 (배열)
      if (itineraryPattern.destination && Array.isArray(itineraryPattern.destination)) {
        itineraryPattern.destination.forEach((dest: string) => {
          if (dest && typeof dest === 'string') {
            // "중국 - 상하이" 같은 형식에서 국가명만 추출
            const countryName = dest.split(' - ')[0].split(',')[0].trim();
            if (countryName) countries.add(countryName);
          }
        });
      }
      
      // itineraryPattern이 배열인 경우 (일정 배열)
      if (Array.isArray(itineraryPattern)) {
        itineraryPattern.forEach((day: any) => {
          if (day && day.country) {
            const countryCode = day.country;
            const countryName = COUNTRY_CODE_TO_NAME[countryCode] || countryCode;
            if (countryCode !== 'KR') { // 한국 제외
              countries.add(countryName);
            }
          }
        });
      }
      
      return Array.from(countries);
    };

    return NextResponse.json({
      ok: true,
      views: views.map(v => {
        const countries = extractCountries(v.Product?.itineraryPattern);
        const cruiseName = v.Product 
          ? `${v.Product.cruiseLine} ${v.Product.shipName}`.trim()
          : '크루즈 정보 없음';
        
        return {
          id: v.id,
          productCode: v.productCode,
          productName: v.Product?.packageName || '상품 없음',
          cruiseName,
          countries: countries.length > 0 ? countries : ['정보 없음'],
          viewedAt: v.viewedAt.toISOString()
        };
      })
    });
  } catch (error: any) {
    logger.error('[Admin User Product Views API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch product views' },
      { status: 500 }
    );
  }
}
