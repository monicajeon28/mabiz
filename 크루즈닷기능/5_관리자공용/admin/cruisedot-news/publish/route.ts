export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import { notifyPublished } from '@/lib/seo/indexnow';
import { syncNewsToMabiz } from '@/lib/mabiz-sync';
import { validateNewsContent } from '@/lib/news-content-filter';
import { sanitizeNewsHtml } from '@/lib/html-sanitizer';
import { validateForbiddenTerms } from '@/lib/validators/forbidden-terms';
import prisma from '@/lib/prisma';

interface PublishRequestBody {
  slug: string;
  title: string;
  emoji: string;
  category: string;
  publishedAt: string;
  htmlContent: string;
  highlight?: string;
  summary?: string;
}

const SLUG_REGEX = /^[a-z0-9-]+$/;

/**
 * HTML에서 첫 번째 이미지 URL 추출
 * @param html - HTML 컨텐츠
 * @returns 첫 번째 이미지 URL 또는 기본값
 */
function extractFirstImageUrl(html: string): string {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : '/images/cruisedot-default-og.webp'; // 기본 OG 이미지
}

/**
 * og:description 자동 생성
 * HTML에서 텍스트 추출 후 처음 120-160자 추출
 * @param html - HTML 컨텐츠
 * @returns 120-160자 요약
 */
function generateOgDescription(html: string, title: string): string {
  // HTML 태그 제거
  const plainText = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  // 제목 + 본문 조합 (제목이 짧으면 본문을 더함)
  let description = title;
  if (description.length < 120) {
    description += ' ' + plainText;
  } else {
    description = plainText;
  }

  // 120-160자로 잘라내기
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  } else if (description.length < 120) {
    description = description.substring(0, Math.min(160, description.length));
  }

  return description;
}

/**
 * HTML에 og: 메타 태그 주입
 * @param html - 원본 HTML
 * @param title - 기사 제목
 * @param ogImage - og:image URL
 * @param ogDescription - og:description
 * @returns og: 태그가 추가된 HTML
 */
function injectOgTags(
  html: string,
  title: string,
  ogImage: string,
  ogDescription: string
): string {
  // HTML 이스케이프 (메타 태그 속성값)
  const escapedTitle = title.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedDesc = ogDescription.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedImage = ogImage.replace(/"/g, '&quot;');

  const ogTags = `
  <meta property="og:title" content="${escapedTitle}" />
  <meta property="og:description" content="${escapedDesc}" />
  <meta property="og:image" content="${escapedImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapedTitle}" />
  <meta name="twitter:description" content="${escapedDesc}" />
  <meta name="twitter:image" content="${escapedImage}" />`;

  // </head> 바로 앞에 og: 태그 주입
  if (html.includes('</head>')) {
    return html.replace('</head>', ogTags + '\n</head>');
  }

  // </head>가 없으면 <body> 앞에 주입
  if (html.includes('<body')) {
    return html.replace(/<body/i, ogTags + '\n<body');
  }

  // 둘 다 없으면 전체 HTML 앞에 주입
  return ogTags + '\n' + html;
}

export async function POST(req: Request) {
  try {
    // 인증: admin 세션 또는 내부 cron 호출 허용
    const internalCronKey = req.headers.get('x-internal-cron');
    const cronSecret = process.env.CRON_SECRET;
    const isInternalCron = cronSecret && internalCronKey === cronSecret;

    if (!isInternalCron) {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
      }
      if (!['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
        return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 401 });
      }
    }

    const body: PublishRequestBody = await req.json();
    const { slug, title, emoji, category, publishedAt, htmlContent } = body;

    // 필수 필드 검증
    const missingFields = (
      ['slug', 'title', 'emoji', 'category', 'publishedAt', 'htmlContent'] as const
    ).filter((f) => !body[f]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { ok: false, error: `필수 필드가 누락되었습니다: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // slug 형식 검증
    if (!SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { ok: false, error: 'slug는 소문자 영문·숫자·하이픈만 사용 가능합니다.' },
        { status: 400 }
      );
    }

    // HTML 검증 — 금지어 필터 먼저 실행
    const filterResult = validateNewsContent(htmlContent);
    if (!filterResult.valid) {
      return NextResponse.json(
        { ok: false, error: filterResult.reason },
        { status: 400 }
      );
    }

    // 금지어 검증
    const forbiddenCheck = validateForbiddenTerms(title);
    if (!forbiddenCheck.valid) {
      return NextResponse.json(
        { ok: false, error: `제목에 금지어 포함: ${forbiddenCheck.matches.join(', ')}` },
        { status: 400 }
      );
    }

    const plainContent = htmlContent.replace(/<[^>]*>/g, '');
    const contentCheck = validateForbiddenTerms(plainContent);
    if (!contentCheck.valid) {
      return NextResponse.json(
        { ok: false, error: `본문에 금지어 포함: ${contentCheck.matches.join(', ')}` },
        { status: 400 }
      );
    }

    // HTML 최소 길이 및 형식 검증
    if (htmlContent.length < 1000) {
      return NextResponse.json(
        { ok: false, error: 'htmlContent가 너무 짧습니다. (최소 1000자)' },
        { status: 400 }
      );
    }

    if (!htmlContent.trimStart().toLowerCase().startsWith('<!doctype html')) {
      return NextResponse.json(
        { ok: false, error: 'htmlContent는 <!DOCTYPE html로 시작해야 합니다.' },
        { status: 400 }
      );
    }

    // HTML 새니타이제이션 (XSS 방지)
    const sanitized = sanitizeNewsHtml(htmlContent);

    // og: 메타 태그 자동 생성 및 주입
    const ogImage = extractFirstImageUrl(sanitized);
    const ogDescription = generateOgDescription(sanitized, title);
    const finalHtml = injectOgTags(sanitized, title, ogImage, ogDescription);

    // public/cruisedot-news 디렉토리 보장
    const newsDir = join(process.cwd(), 'public', 'cruisedot-news');
    if (!existsSync(newsDir)) {
      mkdirSync(newsDir, { recursive: true });
    }

    // HTML 파일 저장 (재발행 시 덮어쓰기 허용)
    const filePath = join(newsDir, `${slug}.html`);
    const isUpdate = existsSync(filePath);

    writeFileSync(filePath, finalHtml, 'utf-8');

    logger.debug('[admin/cruisedot-news/publish] HTML 파일 저장 완료', {
      slug,
      isUpdate,
      htmlLength: finalHtml.length,
      ogImage,
      ogDescriptionLength: ogDescription.length,
    });

    // news-data.ts 업데이트 (신규 slug만)
    const newsDataPath = join(
      process.cwd(),
      'app',
      'community',
      'cruisedot-news',
      'news-data.ts'
    );

    let newsDataUpdated = false;

    try {
      const currentContent = readFileSync(newsDataPath, 'utf-8');

      if (currentContent.includes(`id: '${slug}'`)) {
        logger.debug('[admin/cruisedot-news/publish] 기존 slug 재발행 (news-data.ts 유지)', {
          slug,
        });
      } else {
        const safeTitle = title.replace(/'/g, "\\'");
        const safeHighlight = (body.highlight ?? '').replace(/'/g, "\\'");
        const safeSummary = (body.summary ?? '').replace(/'/g, "\\'");
        const safeEmoji = emoji.replace(/'/g, "\\'");
        const safeCategory = category.replace(/'/g, "\\'");

        const newEntry = `  {
    id: '${slug}',
    title: '${safeTitle}',
    highlight: '${safeHighlight}',
    summary: '${safeSummary}',
    emoji: '${safeEmoji}',
    category: '${safeCategory}',
    publishedAt: '${publishedAt}',
    baseViews: 0,
    baseLikes: 0,
    baseActiveViewers: 0,
    staticPath: '/cruisedot-news/${slug}.html'
  }`;

        const updated = currentContent.replace(
          /(\s*}\s*\]\s*;\s*)$/,
          `,\n${newEntry}\n$1`
        );

        if (updated === currentContent) {
          logger.error(
            '[admin/cruisedot-news/publish] news-data.ts 패턴 매칭 실패, 수동 추가 필요',
            { slug }
          );
        } else {
          writeFileSync(newsDataPath, updated, 'utf-8');
          newsDataUpdated = true;
          logger.debug('[admin/cruisedot-news/publish] news-data.ts 업데이트 완료', { slug });
        }
      }
    } catch (fsErr) {
      logger.error('[admin/cruisedot-news/publish] news-data.ts 업데이트 실패', {
        slug,
        error: fsErr instanceof Error ? fsErr.message : String(fsErr),
      });
    }

    // DB 저장 (upsert) — Vercel 파일시스템은 read-only이므로 DB가 실제 저장소
    const existingPost = await prisma.communityPost.findFirst({
      where: { slug, category: 'cruisedot-news' },
      select: { id: true },
    });

    if (existingPost) {
      await prisma.communityPost.update({
        where: { id: existingPost.id },
        data: { title, content: finalHtml },
      });
      logger.debug('[admin/cruisedot-news/publish] DB 업데이트 완료', { slug, id: existingPost.id });
    } else {
      const created = await prisma.communityPost.create({
        data: {
          title,
          content: finalHtml,
          category: 'cruisedot-news',
          slug,
          isDeleted: false,
          published: true,
          views: 0,
          likes: 0,
          authorName: '크루즈닷 에디터',
          updatedAt: new Date(),
        },
        select: { id: true },
      });
      logger.debug('[admin/cruisedot-news/publish] DB 신규 저장 완료', { slug, id: created.id });
    }

    // IndexNow + sitemap ping — 발행 후 비동기
    const publishedUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.cruisedot.co.kr'}/cruisedot-news/${slug}`;
    notifyPublished(publishedUrl).catch(() => {});

    // mabiz CRM 뉴스 동기화 — fire-and-forget
    syncNewsToMabiz({
      action:    'create',
      shortCode: slug,
      title:     title ?? '',
      url:       `https://www.cruisedot.co.kr/n/${slug}`,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      slug,
      url: '/cruisedot-news/' + slug,
      isUpdate,
      newsDataUpdated,
    });
  } catch (e: unknown) {
    logger.error('[admin/cruisedot-news/publish] 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: '발행 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (!['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 401 });
    }

    const { slug } = await req.json() as { slug?: string };

    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ ok: false, error: 'slug가 유효하지 않습니다.' }, { status: 400 });
    }

    // mabiz deactivate — 파일 삭제 전 fire-and-forget
    syncNewsToMabiz({
      action:    'deactivate',
      shortCode: slug,
    }).catch(() => {});

    // HTML 파일 삭제
    const { unlinkSync } = await import('fs');
    const newsDir  = join(process.cwd(), 'public', 'cruisedot-news');
    const filePath = join(newsDir, `${slug}.html`);

    if (existsSync(filePath)) {
      unlinkSync(filePath);
      logger.debug('[admin/cruisedot-news/publish] 뉴스 HTML 파일 삭제', { slug });
    } else {
      logger.debug('[admin/cruisedot-news/publish] 삭제 대상 파일 없음 (이미 삭제됨)', { slug });
    }

    return NextResponse.json({ ok: true, slug });
  } catch (e: unknown) {
    logger.error('[admin/cruisedot-news/publish] DELETE 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: '삭제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
