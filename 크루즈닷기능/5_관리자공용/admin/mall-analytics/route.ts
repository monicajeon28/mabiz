export const dynamic = 'force-dynamic';

// app/api/admin/mall-analytics/route.ts
// 메인몰 데이터 분석 - 키워드 및 감정 분석

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: { select: { role: true } } },
    });
    return session?.User.role === 'admin';
  } catch (error) {
    logger.error('[Admin Mall Analytics] Auth check error:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d';

    // 기간 계산
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    // 성능 최적화: 독립적인 3개 쿼리를 Promise.all로 병렬 처리
    const [reviews, posts, comments] = await Promise.all([
      // 후기 조회
      prisma.cruiseReview.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          id: true,
          rating: true,
          content: true,
          createdAt: true,
        },
      }),
      // 커뮤니티 게시글 조회
      prisma.communityPost.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
        },
      }),
      // 댓글 조회
      prisma.communityComment.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      }),
    ]);

    // 평균 평점 계산
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

    // 키워드 추출 및 분석 (간단한 버전)
    const keywordMap = new Map<string, {
      count: number;
      sources: { reviews: number; community: number; comments: number };
      sentiment: 'positive' | 'neutral' | 'negative';
    }>();

    // 한국어 키워드 패턴 (크루즈 관련)
    const keywords = [
      '크루즈', '여행', '배', '선박', '항구', '관광', '식사', '서비스',
      '객실', '편안', '추천', '만족', '좋아', '최고', '별로', '아쉽',
      '비싸', '저렴', '가격', '할인', '프로모션', '특가',
    ];

    // 후기에서 키워드 추출
    reviews.forEach(review => {
      const text = (review.content || '').toLowerCase();
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              count: 0,
              sources: { reviews: 0, community: 0, comments: 0 },
              sentiment: 'neutral',
            });
          }
          const data = keywordMap.get(keyword)!;
          data.count++;
          data.sources.reviews++;
          
          // 감정 분석 (간단한 버전)
          const positiveWords = ['좋아', '최고', '만족', '추천', '편안', '훌륭'];
          const negativeWords = ['별로', '아쉽', '비싸', '불만'];
          if (positiveWords.some(w => text.includes(w))) {
            data.sentiment = 'positive';
          } else if (negativeWords.some(w => text.includes(w))) {
            data.sentiment = 'negative';
          }
        }
      });
    });

    // 게시글에서 키워드 추출
    posts.forEach(post => {
      const text = ((post.title || '') + ' ' + (post.content || '')).toLowerCase();
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              count: 0,
              sources: { reviews: 0, community: 0, comments: 0 },
              sentiment: 'neutral',
            });
          }
          const data = keywordMap.get(keyword)!;
          data.count++;
          data.sources.community++;
        }
      });
    });

    // 댓글에서 키워드 추출
    comments.forEach(comment => {
      const text = (comment.content || '').toLowerCase();
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          if (!keywordMap.has(keyword)) {
            keywordMap.set(keyword, {
              count: 0,
              sources: { reviews: 0, community: 0, comments: 0 },
              sentiment: 'neutral',
            });
          }
          const data = keywordMap.get(keyword)!;
          data.count++;
          data.sources.comments++;
        }
      });
    });

    // 상위 키워드 정렬
    const topKeywords = Array.from(keywordMap.entries())
      .map(([keyword, data]) => ({
        keyword,
        ...data,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // 감정 분포 계산
    let positive = 0;
    let neutral = 0;
    let negative = 0;

    reviews.forEach(review => {
      const text = (review.content || '').toLowerCase();
      if (['좋아', '최고', '만족', '추천', '편안'].some(w => text.includes(w))) {
        positive++;
      } else if (['별로', '아쉽', '불만'].some(w => text.includes(w))) {
        negative++;
      } else {
        neutral++;
      }
    });

    return NextResponse.json({
      ok: true,
      data: {
        totalReviews: reviews.length,
        totalPosts: posts.length,
        totalComments: comments.length,
        avgRating,
        topKeywords,
        sentimentDistribution: {
          positive,
          neutral,
          negative,
        },
      },
    });
  } catch (error) {
    logger.error('[Mall Analytics] Error:', error);
    return NextResponse.json(
      { ok: false, error: '데이터 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
