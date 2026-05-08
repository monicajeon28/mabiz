export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // news-data.ts에서 총 발행 글 수 파싱
    const newsDataPath = join(process.cwd(), 'app', 'community', 'cruisedot-news', 'news-data.ts');
    let totalPublished = 0;
    let monthCount = 0;
    let recentCount = 0;

    try {
      const content = readFileSync(newsDataPath, 'utf-8');
      const blocks = content.split(/\{(?=\s*\n?\s*id:)/);
      const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const thisMonthStr = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, '0')}`;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      for (const block of blocks.slice(1)) {
        const id = block.match(/id:\s*['"]([^'"]+)['"]/)?.[1];
        const publishedAt = block.match(/publishedAt:\s*['"]([^'"]+)['"]/)?.[1];
        if (!id) continue;

        const htmlExists = existsSync(join(process.cwd(), 'public', 'cruisedot-news', `${id}.html`));
        if (htmlExists || publishedAt) {
          totalPublished++;
          if (publishedAt) {
            if (publishedAt.startsWith(thisMonthStr)) monthCount++;
            if (publishedAt >= sevenDaysAgo) recentCount++;
          }
        }
      }
    } catch {
      logger.warn('[news/performance] news-data.ts 파싱 실패 — DB 폴백 사용');
    }

    // DB에서 조회수 TOP5 (CommunityPost 기반 뉴스)
    const topPosts = await prisma.communityPost.findMany({
      where: { category: 'cruisedot-news', isDeleted: false },
      select: {
        title: true,
        slug: true,
        views: true,
        likes: true,
        createdAt: true,
      },
      orderBy: { views: 'desc' },
      take: 5,
    });

    const totalViews = topPosts.reduce((sum, p) => sum + p.views, 0);
    const avgViews = totalPublished > 0 ? Math.round(totalViews / totalPublished) : 0;

    const top5 = topPosts.map(p => ({
      title: p.title,
      slug: p.slug,
      views: p.views,
      likes: p.likes,
      publishedAt: p.createdAt.toISOString().slice(0, 10),
    }));

    logger.debug('[news/performance] 성과 데이터 조회', {
      totalPublished,
      totalViews,
      recentCount,
      monthCount,
    });

    return NextResponse.json({
      ok: true,
      stats: {
        totalPublished,
        totalViews,
        avgViews,
        recentCount,
        monthCount,
      },
      top5,
    });
  } catch (error) {
    logger.error('[news/performance] 오류:', error);
    return NextResponse.json({ ok: false, error: '성과 데이터 조회 실패' }, { status: 500 });
  }
}
