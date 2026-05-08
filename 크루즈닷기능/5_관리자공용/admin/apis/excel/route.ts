export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

/**
 * APIS 엑셀 다운로드 API
 * GET /api/admin/apis/excel?productCode=XXX
 * 
 * 관리자 전용 API로, productCode를 받아서 해당 상품의 모든 고객의 여권, 여행정보, PNR 정보를
 * APIS 양식에 맞게 채워진 엑셀 파일로 다운로드합니다.
 */
export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const { cookies } = await import('next/headers');
    const SESSION_COOKIE = 'cg.sid.v2';
    const sid = cookies().get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
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
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터에서 productCode 가져오기
    const { searchParams } = new URL(req.url);
    const productCode = searchParams.get('productCode');

    if (!productCode) {
      return NextResponse.json(
        { ok: false, error: 'productCode는 필수입니다.' },
        { status: 400 }
      );
    }

    // 상품 정보 조회
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: {
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Trip 조회
    const trip = await prisma.trip.findUnique({
      where: { productCode },
      select: {
        id: true,
      },
    });

    // 여행명 구성 (크루즈 라인 + 선박명 또는 패키지명)
    const cruiseName = product.packageName || `${product.cruiseLine || ''} ${product.shipName || ''}`.trim();
    const departureDate = product.startDate ? dayjs(product.startDate).format('YYYY-MM-DD') : '';
    const arrivalDate = product.endDate ? dayjs(product.endDate).format('YYYY-MM-DD') : '';

    // 해당 상품의 모든 Reservation과 Traveler 조회
    const reservations = trip
      ? await prisma.reservation.findMany({
          where: {
            tripId: trip.id,
          },
          include: {
            Traveler: {
              orderBy: [
                { roomNumber: 'asc' },
                { id: 'asc' },
              ],
            },
            User: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        })
      : [];

    // 엑셀 워크북 생성
    const workbook = XLSX.utils.book_new();

    // APIS 양식 시트 생성
    // 정확한 컬럼 헤더 구조
    const headers = [
      '순번',
      'RV',
      'CABIN',
      '카테고리',
      '영문성',
      '영문이름',
      '성명',
      '주민번호',
      '성별',
      '생년월일',
      '여권번호',
      '발급일',
      '만료일',
      '연락처',
      '항공',
      '결제일',
      '결제방법',
      '결제금액',
      '담당자',
      '비고',
      '비고2',
      '여권링크',
    ];
    
    // 여행 정보를 첫 번째 행에 추가
    const worksheetData: any[][] = [];
    
    // 여행 정보 행 추가
    worksheetData.push(['여행명', cruiseName]);
    worksheetData.push(['출발일', departureDate]);
    worksheetData.push(['도착일', arrivalDate]);
    worksheetData.push([]); // 빈 행
    worksheetData.push(headers); // 헤더 행
    
    // 실제 고객 데이터로 채우기
    let sequence = 1;
    for (const reservation of reservations) {
      const userPhone = reservation.User?.phone || '';
      const paymentDate = reservation.paymentDate
        ? dayjs(reservation.paymentDate).format('YYYY-MM-DD')
        : '';
      const paymentAmount = reservation.paymentAmount
        ? reservation.paymentAmount.toString()
        : '';

      for (const traveler of reservation.Traveler) {
        worksheetData.push([
          sequence++, // 순번
          reservation.id, // RV (Reservation ID)
          traveler.roomNumber || '', // CABIN
          reservation.cabinType || '', // 카테고리
          traveler.engSurname || '', // 영문성
          traveler.engGivenName || '', // 영문이름
          traveler.korName || '', // 성명
          traveler.residentNum || '', // 주민번호
          traveler.gender || '', // 성별
          traveler.birthDate || '', // 생년월일
          traveler.passportNo || '', // 여권번호
          traveler.issueDate || '', // 발급일
          traveler.expiryDate || '', // 만료일
          userPhone, // 연락처
          '', // 항공 (데이터 없음)
          paymentDate, // 결제일
          reservation.paymentMethod || '', // 결제방법
          paymentAmount, // 결제금액
          reservation.agentName || '', // 담당자
          reservation.remarks || '', // 비고
          '', // 비고2 (데이터 없음)
          reservation.passportGroupLink || '', // 여권링크
        ]);
      }
    }
    
    // 데이터가 없으면 빈 행 10개 추가 (고객이 직접 입력할 수 있도록)
    if (sequence === 1) {
      for (let i = 0; i < 10; i++) {
        worksheetData.push([
          i + 1, // 순번
          '', // RV
          '', // CABIN
          '', // 카테고리
          '', // 영문성
          '', // 영문이름
          '', // 성명
          '', // 주민번호
          '', // 성별
          '', // 생년월일
          '', // 여권번호
          '', // 발급일
          '', // 만료일
          '', // 연락처
          '', // 항공
          '', // 결제일
          '', // 결제방법
          '', // 결제금액
          '', // 담당자
          '', // 비고
          '', // 비고2
          '', // 여권링크
        ]);
      }
    }

    // 시트 생성
    const apisSheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, apisSheet, 'APIS');

    // 엑셀 버퍼 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 생성 (여행명 포함)
    const safeCruiseName = cruiseName.replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 50); // 파일명에 사용할 수 없는 문자 제거
    const filename = `APIS_${safeCruiseName}_${dayjs().format('YYYY-MM-DD')}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error: any) {
    console.error('[APIS Excel] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'APIS 엑셀 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
