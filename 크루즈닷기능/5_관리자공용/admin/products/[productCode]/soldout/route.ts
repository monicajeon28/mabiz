// app/api/admin/products/[productCode]/soldout/route.ts
// 객실별 SOLD OUT 토글 API (관리자 전용)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// 관리자 권한 확인
async function requireAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: 'Unauthorized', status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true, name: true }
  });

  if (user?.role !== 'admin') {
    return { error: 'Admin access required', status: 403 };
  }

  return { user, sessionUser };
}

interface SoldOutRoom {
  roomId: string;
  roomType: string;
  soldOutAt: string;
  soldOutBy: string;
}

// GET: 현재 SOLD OUT 상태 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productCode: string }> }
) {
  try {
    const { productCode } = await params;

    const content = await prisma.mallProductContent.findUnique({
      where: { productCode },
      select: { layout: true }
    });

    if (!content) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
    }

    const layout = content.layout as any || {};
    const soldOutRooms: SoldOutRoom[] = layout.soldOutRooms || [];

    return NextResponse.json({
      ok: true,
      productCode,
      soldOutRooms
    });
  } catch (error: any) {
    logger.error('[SOLD OUT GET] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// POST: SOLD OUT 토글
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productCode: string }> }
) {
  try {
    // 관리자 권한 확인
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json(
        { ok: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { productCode } = await params;
    const body = await req.json();
    const { roomId, roomType } = body;

    if (!roomId) {
      return NextResponse.json({ ok: false, error: 'roomId is required' }, { status: 400 });
    }

    // 현재 상품 정보 조회
    const content = await prisma.mallProductContent.findUnique({
      where: { productCode },
      select: { layout: true }
    });

    if (!content) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
    }

    const layout = content.layout as any || {};
    let soldOutRooms: SoldOutRoom[] = layout.soldOutRooms || [];

    // 토글: 이미 SOLD OUT이면 해제, 아니면 추가
    const existingIndex = soldOutRooms.findIndex(r => r.roomId === roomId);

    if (existingIndex >= 0) {
      // SOLD OUT 해제
      soldOutRooms.splice(existingIndex, 1);
      logger.log(`[SOLD OUT] Room ${roomId} released for ${productCode} by ${authResult.user?.name}`);
    } else {
      // SOLD OUT 설정
      soldOutRooms.push({
        roomId,
        roomType: roomType || roomId,
        soldOutAt: new Date().toISOString(),
        soldOutBy: authResult.user?.name || 'admin'
      });
      logger.log(`[SOLD OUT] Room ${roomId} marked as SOLD OUT for ${productCode} by ${authResult.user?.name}`);
    }

    // DB 업데이트
    await prisma.mallProductContent.update({
      where: { productCode },
      data: {
        layout: {
          ...layout,
          soldOutRooms
        },
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      ok: true,
      productCode,
      roomId,
      isSoldOut: existingIndex < 0, // 새로 추가됐으면 true
      soldOutRooms,
      message: existingIndex >= 0 ? 'SOLD OUT 해제됨' : 'SOLD OUT 설정됨'
    });
  } catch (error: any) {
    logger.error('[SOLD OUT POST] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
