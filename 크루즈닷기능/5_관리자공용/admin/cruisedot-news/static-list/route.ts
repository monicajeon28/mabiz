export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // news-data.ts 파일에서 STATIC_NEWS_POSTS 파싱
    const newsDataPath = join(process.cwd(), 'app', 'community', 'cruisedot-news', 'news-data.ts');
    const content = readFileSync(newsDataPath, 'utf-8');

    const items: Array<{
      id: string;
      title: string;
      summary: string;
      category: string;
      publishedAt: string;
      baseViews: number;
      hasHtml: boolean;
    }> = [];

    const blocks = content.split(/\{(?=\s*\n?\s*id:)/);
    for (const block of blocks.slice(1)) {
      try {
        const id = block.match(/id:\s*['"]([^'"]+)['"]/)?.[1];
        const title = block.match(/title:\s*['"]([^'"]+)['"]/)?.[1];
        const summary = block.match(/summary:\s*['"]([^'"]+)['"]/)?.[1];
        const category = block.match(/category:\s*['"]([^'"]+)['"]/)?.[1];
        const publishedAt = block.match(/publishedAt:\s*['"]([^'"]+)['"]/)?.[1];
        const baseViews = parseInt(block.match(/baseViews:\s*(\d+)/)?.[1] ?? '0', 10);
        const seoTitle = block.match(/seoTitle:\s*['"]([^'"]+)['"]/)?.[1];

        if (id && title) {
          let hasHtml = false;
          try {
            readFileSync(join(process.cwd(), 'public', 'cruisedot-news', `${id}.html`));
            hasHtml = true;
          } catch {
            hasHtml = false;
          }

          items.push({
            id,
            title: seoTitle || title,
            summary: summary || '',
            category: category || '',
            publishedAt: publishedAt || '',
            baseViews,
            hasHtml,
          });
        }
      } catch {
        // 파싱 실패 항목 무시
      }
    }

    // 발행일 최신순 정렬
    items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    logger.debug('[admin/cruisedot-news/static-list] 목록 조회', { total: items.length });

    return NextResponse.json({ ok: true, items, total: items.length });
  } catch (error) {
    logger.error('[admin/cruisedot-news/static-list] 오류:', error);
    return NextResponse.json({ ok: false, error: '목록 조회 실패' }, { status: 500 });
  }
}
