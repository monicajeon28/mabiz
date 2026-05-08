export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { NEWS_KEYWORD_QUEUE, getNextKeyword } from '@/lib/news-keyword-queue';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // 발행된 슬러그 목록
    const publishedPosts = await prisma.communityPost.findMany({
      where: { category: 'cruisedot-news', isDeleted: false },
      select: { slug: true },
      orderBy: { createdAt: 'desc' },
    });
    const publishedSlugs = publishedPosts.map(p => p.slug ?? '').filter(Boolean);

    // 큐에서 다음 키워드 선택
    const nextKeyword = getNextKeyword(publishedSlugs);

    // 큐 완료율 계산
    const total = NEWS_KEYWORD_QUEUE.length;
    const completed = NEWS_KEYWORD_QUEUE.filter(item =>
      publishedSlugs.some(s => s.includes(item.keyword.replace(/\s+/g, '-').toLowerCase().slice(0, 15)))
    ).length;

    // 다음 5개 예정 키워드
    const upcoming = NEWS_KEYWORD_QUEUE
      .filter(item => !publishedSlugs.some(s => s.includes(item.keyword.replace(/\s+/g, '-').toLowerCase().slice(0, 15))))
      .slice(0, 5)
      .map(item => ({ keyword: item.keyword, category: item.category, priority: item.priority }));

    logger.debug('[news/queue] 큐 현황 조회', {
      total,
      completed,
      remaining: total - completed,
    });

    return NextResponse.json({
      ok: true,
      queue: {
        total,
        completed,
        remaining: total - completed,
        completionRate: Math.round((completed / total) * 100),
      },
      nextKeyword: {
        keyword: nextKeyword.keyword,
        title: nextKeyword.title,
        category: nextKeyword.category,
        priority: nextKeyword.priority,
      },
      upcoming,
    });
  } catch (error) {
    logger.error('[news/queue] 오류:', error);
    return NextResponse.json({ ok: false, error: '큐 데이터 조회 실패' }, { status: 500 });
  }
}

// 수동 발행 트리거 (즉시 발행)
export async function POST() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.cruisedot.co.kr';

    logger.debug('[news/queue] 수동 발행 트리거 시작');

    // 크론 API 수동 트리거
    const res = await fetch(`${baseUrl}/api/cron/news-auto-publish`, {
      method: 'GET',
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET || ''}`,
        'x-manual-trigger': 'true',
      },
    });

    const data = await res.json();

    logger.debug('[news/queue] 수동 발행 트리거 결과', { ok: data.ok, slug: data.slug });

    return NextResponse.json(data);
  } catch (error) {
    logger.error('[news/queue] 수동 트리거 오류:', error);
    return NextResponse.json({ ok: false, error: '수동 발행 실패' }, { status: 500 });
  }
}
