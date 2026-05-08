export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// 관리자 권한 확인
async function checkAdminAuth() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true },
  });

  if (!user || user.role !== 'admin') {
    return null;
  }

  return sessionUser;
}

// GET: 인사이트 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const insightType = searchParams.get('type');

    const where: any = {};
    if (userId) {
      where.userId = parseInt(userId);
    }
    if (insightType) {
      where.insightType = insightType;
    }

    console.log('[Admin Insights GET] Query params:', { userId, insightType, where });

    const insights = await prisma.marketingInsight.findMany({
      where,
      include: {
        User: {  // ✅ 대문자 U로 변경
          select: { 
            id: true, 
            name: true, 
            phone: true,
            mallUserId: true,
            mallNickname: true,
            genieStatus: true,
            genieLinkedAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    console.log('[Admin Insights GET] Found insights:', insights.length);

    // User 관계를 user로 변환 (프론트엔드 호환성)
    // 연동된 크루즈몰 사용자 정보도 함께 조회 (N+1 방지: 배치 조회)

    // 1단계: 모든 genieUser 정보 수집
    const genieUsers = insights.map((insight: any) =>
      insight.User || { id: insight.userId, name: null, phone: null, mallUserId: null }
    );

    // 2단계: mallUserId 기반 배치 조회
    // mallUserId가 숫자 ID인 경우와 전화번호/이름인 경우를 분리
    const numericMallUserIds: number[] = [];
    const stringMallUserIds: string[] = []; // phone 또는 name으로 조회할 값
    for (const gu of genieUsers) {
      if (gu.mallUserId) {
        const parsed = parseInt(gu.mallUserId);
        if (!isNaN(parsed)) {
          numericMallUserIds.push(parsed);
          // 전화번호 형식일 수도 있으므로 문자열로도 추가
          stringMallUserIds.push(gu.mallUserId);
        } else {
          stringMallUserIds.push(gu.mallUserId);
        }
      }
    }

    // 3단계: mallUserId 기반 커뮤니티 사용자 배치 조회
    let mallUsersByMallId: Map<string, { id: number; name: string | null; phone: string | null }> = new Map();
    try {
      const mallUsersFromMallId = await prisma.user.findMany({
        where: {
          role: 'community',
          OR: [
            ...(numericMallUserIds.length > 0 ? [{ id: { in: numericMallUserIds } }] : []),
            ...(stringMallUserIds.length > 0 ? [{ phone: { in: stringMallUserIds } }] : []),
            ...(stringMallUserIds.length > 0 ? [{ name: { in: stringMallUserIds } }] : []),
          ],
        },
        select: { id: true, name: true, phone: true },
      });

      // mallUserId 값 → user 매핑 (숫자 ID, phone, name 모두 키로 등록)
      for (const u of mallUsersFromMallId) {
        if (u.id) mallUsersByMallId.set(String(u.id), u);
        if (u.phone) mallUsersByMallId.set(u.phone, u);
        if (u.name) mallUsersByMallId.set(u.name, u);
      }
    } catch (error) {
      console.error('[Admin Insights] Error batch-fetching mall users by mallUserId:', error);
    }

    // 4단계: phone 기반 폴백 배치 조회 (mallUserId 조회로 못 찾은 항목)
    // mallUserId가 없거나 매핑 실패한 genieUser의 phone 수집
    const fallbackPhones: string[] = [];
    for (const gu of genieUsers) {
      if (!gu.mallUserId && gu.phone && !mallUsersByMallId.has(gu.phone)) {
        fallbackPhones.push(gu.phone);
      }
    }

    let mallUsersByPhone: Map<string, { id: number; name: string | null; phone: string | null }> = new Map();
    if (fallbackPhones.length > 0) {
      try {
        const uniqueFallbackPhones = [...new Set(fallbackPhones)];
        const mallUsersFromPhone = await prisma.user.findMany({
          where: {
            phone: { in: uniqueFallbackPhones },
            role: 'community',
          },
          select: { id: true, name: true, phone: true },
        });
        for (const u of mallUsersFromPhone) {
          if (u.phone) mallUsersByPhone.set(u.phone, u);
        }
      } catch (error) {
        console.error('[Admin Insights] Error batch-fetching mall users by phone:', error);
      }
    }

    // 5단계: 결과 조합 (DB 추가 호출 없음)
    const formattedInsights = insights.map((insight: any) => {
      const genieUser = insight.User || { id: insight.userId, name: null, phone: null, mallUserId: null };

      let mallUser = null;
      if (genieUser.mallUserId) {
        mallUser = mallUsersByMallId.get(genieUser.mallUserId) ?? null;
      }
      if (!mallUser && genieUser.phone) {
        mallUser = mallUsersByMallId.get(genieUser.phone) ?? mallUsersByPhone.get(genieUser.phone) ?? null;
      }

      return {
        id: insight.id,
        userId: insight.userId,
        insightType: insight.insightType,
        data: insight.data,
        createdAt: insight.createdAt,
        updatedAt: insight.updatedAt,
        user: {
          ...genieUser,
          mallUser: mallUser, // 연동된 크루즈몰 사용자 정보
        },
      };
    });

    return NextResponse.json({
      ok: true,
      insights: formattedInsights,
    });
  } catch (error) {
    console.error('[Admin Insights GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
