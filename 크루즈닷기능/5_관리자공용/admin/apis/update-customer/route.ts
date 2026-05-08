export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * 고객 APIS 정보 업데이트 (수정신청)
 * POST /api/admin/apis/update-customer
 */
export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const { cookies } = await import('next/headers');
    const SESSION_COOKIE = 'cg.sid.v2';
    const sid = cookies().get(SESSION_COOKIE)?.value;

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
    const { userId, productCode, customerData, travelers } = body;

    if (!userId || !productCode) {
      return NextResponse.json(
        { ok: false, message: 'userId와 productCode는 필수입니다.' },
        { status: 400 }
      );
    }

    // 사용자 정보 업데이트
    if (customerData) {
      await prisma.user.update({
        where: { id: parseInt(userId) },
        data: {
          name: customerData.name || undefined,
          phone: customerData.phone || undefined,
          email: customerData.email || undefined,
        },
      });
    }

    // Traveler 정보 업데이트
    if (travelers && Array.isArray(travelers)) {
      for (const traveler of travelers) {
        if (traveler.id) {
          // 기존 Traveler 업데이트
          await prisma.traveler.update({
            where: { id: traveler.id },
            data: {
              korName: traveler.korName || undefined,
              engSurname: traveler.engSurname || undefined,
              engGivenName: traveler.engGivenName || undefined,
              residentNum: traveler.residentNum || undefined,
              passportNo: traveler.passportNo || undefined,
              birthDate: traveler.birthDate || undefined,
              issueDate: traveler.issueDate || undefined,
              expiryDate: traveler.expiryDate || undefined,
              nationality: traveler.nationality || undefined,
              gender: traveler.gender || undefined,
              roomNumber: traveler.roomNumber || undefined,
              userId: parseInt(userId),
            },
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'APIS 정보가 수정되었습니다.',
    });
  } catch (error: any) {
    console.error('[Update Customer API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'APIS 정보 수정 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
