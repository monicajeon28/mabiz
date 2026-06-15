import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/unsubscribed/check
 * 수신거부 여부 조회 API
 *
 * Query Params:
 * - phone: string (필수, 010-1234-5678 또는 01012345678)
 * - organizationId: string (필수)
 *
 * 응답:
 * {
 *   unsubscribed: boolean;
 *   message?: string; // 거부된 경우 메시지
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get('phone');
    const organizationId = req.nextUrl.searchParams.get('organizationId');

    // 1. 쿼리 파라미터 검증
    if (!phone || !organizationId) {
      return NextResponse.json(
        { unsubscribed: false },
        { status: 200 }
      );
    }

    // 2. 연락처 정규화
    const normalizedPhone = phone
      .trim()
      .replace(/-/g, '')
      .replace(/\s/g, '');

    // 3. 형식 검증 (실패해도 false 반환)
    if (!/^01[0-9]\d{7,8}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { unsubscribed: false },
        { status: 200 }
      );
    }

    // 4. DB 조회
    const result = await prisma.unsubscribed.findUnique({
      where: {
        organizationId_phone: {
          organizationId,
          phone: normalizedPhone,
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    // 5. 응답
    return NextResponse.json(
      {
        unsubscribed: !!result,
        ...(result && {
          message: '이미 수신거부된 고객입니다. 신청이 불가능합니다.',
        }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[/api/unsubscribed/check] Error:', error);
    // 에러 발생 시 false 반환 (수신 가능한 것으로 간주)
    return NextResponse.json(
      { unsubscribed: false },
      { status: 200 }
    );
  }
}
