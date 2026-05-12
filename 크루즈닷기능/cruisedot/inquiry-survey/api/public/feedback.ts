// app/api/feedback/route.ts
// 여행 피드백 API

// ⬇️ 절대법칙: Prisma 사용 API는 반드시 nodejs runtime과 force-dynamic 필요
export const runtime = 'nodejs';        // Edge Runtime 금지 (Prisma 사용)
export const dynamic = 'force-dynamic'; // 동적 데이터는 캐시 X

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// GET: 피드백 조회
export async function GET(req: Request) {
  try {
    // 세션 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 });
    }

    // URL 파라미터
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get('tripId');

    if (tripId) {
      // 특정 여행의 피드백 조회
      const feedback = await prisma.tripFeedback.findUnique({
        where: { tripId: parseInt(tripId) },
      });

      // 본인 여행인지 확인
      if (feedback && feedback.userId !== session.userId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
      }

      return NextResponse.json({
        ok: true,
        feedback,
      });
    } else {
      // 모든 피드백 조회
      const feedbacks = await prisma.tripFeedback.findMany({
        where: { userId: session.userId },
        include: {
          trip: {
            select: {
              cruiseName: true,
              startDate: true,
              endDate: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return NextResponse.json({
        ok: true,
        feedbacks,
      });
    }
  } catch (error) {
    logger.error('[Feedback API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 피드백 생성/업데이트
export async function POST(req: Request) {
  try {
    // 세션 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 });
    }

    // 요청 데이터
    const {
      tripId,
      satisfactionScore,
      improvementComments,
      detailedFeedback,
    } = await req.json();

    if (!tripId) {
      return NextResponse.json(
        { ok: false, error: 'Trip ID required' },
        { status: 400 }
      );
    }

    // 본인 여행인지 확인
    const trip = await prisma.trip.findUnique({
      where: { id: parseInt(tripId) },
      select: { userId: true },
    });

    if (!trip || trip.userId !== session.userId) {
      return NextResponse.json(
        { ok: false, error: 'Trip not found or unauthorized' },
        { status: 404 }
      );
    }

    // Upsert (있으면 업데이트, 없으면 생성)
    const feedback = await prisma.tripFeedback.upsert({
      where: { tripId: parseInt(tripId) },
      update: {
        satisfactionScore: satisfactionScore ? parseInt(satisfactionScore) : null,
        improvementComments,
        detailedFeedback,
        updatedAt: new Date(),
      },
      create: {
        tripId: parseInt(tripId),
        userId: session.userId,
        satisfactionScore: satisfactionScore ? parseInt(satisfactionScore) : null,
        improvementComments,
        detailedFeedback,
      },
    });

    return NextResponse.json({
      ok: true,
      feedback,
      message: 'Feedback saved successfully',
    });
  } catch (error) {
    logger.error('[Feedback API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

