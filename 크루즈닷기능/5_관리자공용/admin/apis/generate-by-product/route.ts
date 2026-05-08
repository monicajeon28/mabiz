export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
// import { syncApisSpreadsheet } from '@/lib/google-sheets'; // google-sheets.ts 파일이 비어있음

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 상품별 APIS 엑셀 생성 (자동화)
 * POST /api/admin/apis/generate-by-product
 *
 * 판매 활성화된 모든 상품에 대해 APIS 엑셀을 자동 생성합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json(
        { ok: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { productCode } = body;

    // productCode가 제공된 경우 해당 상품만, 없으면 모든 판매중 상품
    const whereClause = productCode
      ? { productCode, saleStatus: '판매중' }
      : { saleStatus: '판매중' };

    // 판매 활성화된 상품 조회
    const products = await prisma.cruiseProduct.findMany({
      where: whereClause,
      include: {
        UserTrip: {
          where: {
            status: {
              in: ['Upcoming', 'InProgress'],
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (products.length === 0) {
      return NextResponse.json(
        { ok: false, message: '생성할 상품이 없습니다.' },
        { status: 404 }
      );
    }

    const results = [];
    const errors = [];

    // 각 상품별로 Trip을 찾아서 APIS 생성
    for (const product of products) {
      try {
        // productCode로 Trip 찾기
        const trip = await prisma.trip.findUnique({
          where: { productCode: product.productCode },
          select: {
            id: true,
            productCode: true,
            shipName: true,
            departureDate: true,
          },
        });

        if (!trip) {
          errors.push({
            productCode: product.productCode,
            error: '해당 상품의 Trip을 찾을 수 없습니다.',
          });
          continue;
        }

        // APIS 생성
        // const result = await syncApisSpreadsheet(trip.id); // google-sheets.ts 파일이 비어있음
        const result = { ok: false, error: 'google-sheets 모듈이 없습니다' };

        if (result.ok && 'folderId' in result) {
          results.push({
            productCode: product.productCode,
            cruiseLine: product.cruiseLine,
            shipName: product.shipName,
            packageName: product.packageName,
            tripId: trip.id,
            customerCount: product.UserTrip.length,
            folderId: (result as any).folderId,
            folderUrl: (result as any).folderId
              ? `https://drive.google.com/drive/folders/${(result as any).folderId}`
              : null,
            spreadsheetId: (result as any).spreadsheetId,
            spreadsheetUrl: (result as any).spreadsheetId
              ? `https://docs.google.com/spreadsheets/d/${(result as any).spreadsheetId}`
              : null,
            rowCount: (result as any).rowCount || 0,
          });
        } else {
          errors.push({
            productCode: product.productCode,
            error: result.error || 'APIS 생성 실패',
          });
        }
      } catch (error: any) {
        errors.push({
          productCode: product.productCode,
          error: 'APIS 생성 중 오류 발생',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `${results.length}개 상품의 APIS가 생성되었습니다.`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      total: products.length,
      success: results.length,
      failed: errors.length,
    });
  } catch (error: any) {
    logger.error('[APIS Generate By Product] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'APIS 자동 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
