export const dynamic = 'force-dynamic';

// app/api/admin/users/[userId]/travel-records/route.ts
// 사용자의 여행 기록 조회 (관리자 전용)
// MapTravelRecord와 TravelDiaryEntry를 함께 조회

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

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
    logger.error('[Admin Travel Records] Auth check error:', error);
    return false;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { userId: userIdStr } = await params; const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, error: 'Invalid user ID' }, { status: 400 });
    }

    // MapTravelRecord 조회 (지도에서 등록한 여행 기록)
    const mapTravelRecords = await prisma.mapTravelRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        cruiseName: true,
        companion: true,
        destination: true,
        startDate: true,
        endDate: true,
        impressions: true,
        createdAt: true,
      },
    });

    // TravelDiaryEntry 조회 (다이어리 기록)
    const diaryEntries = await prisma.travelDiaryEntry.findMany({
      where: { userId },
      orderBy: { visitDate: 'asc' },
      select: {
        id: true,
        tripId: true,
        countryCode: true,
        countryName: true,
        title: true,
        content: true,
        visitDate: true,
        createdAt: true,
      },
    });

    // 여행 기록별로 다이어리 그룹화
    const travelRecordsWithDiaries = mapTravelRecords.map(record => {
      // 해당 여행 기록과 관련된 다이어리 찾기
      // destination에서 국가명 추출하여 매칭
      const recordCountries = record.destination
        ? record.destination.split(',').map(d => d.trim())
        : [];
      
      const relatedDiaries = diaryEntries.filter(diary => {
        // 국가명으로 매칭 (부분 일치)
        return recordCountries.some(country => 
          diary.countryName.includes(country) || country.includes(diary.countryName)
        );
      });

      return {
        ...record,
        diaries: relatedDiaries,
      };
    });

    // 여행 기록에 연결되지 않은 다이어리도 포함
    const unlinkedDiaries = diaryEntries.filter(diary => {
      return !mapTravelRecords.some(record => {
        const recordCountries = record.destination
          ? record.destination.split(',').map(d => d.trim())
          : [];
        return recordCountries.some(country => 
          diary.countryName.includes(country) || country.includes(diary.countryName)
        );
      });
    });

    return NextResponse.json({
      ok: true,
      travelRecords: travelRecordsWithDiaries,
      unlinkedDiaries,
      totalRecords: mapTravelRecords.length,
      totalDiaries: diaryEntries.length,
    });
  } catch (error: any) {
    logger.error('[Admin Travel Records] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch travel records' },
      { status: 500 }
    );
  }
}
