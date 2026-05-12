export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronSecret } from '@/lib/cron-security';
import { autoSelectImages } from '@/lib/utils/auto-select-images';
import { autoSelectYoutube } from '@/lib/utils/auto-select-youtube';

/**
 * Validate image URL protocol (XSS protection)
 * Only allows http:// and https:// protocols
 */
function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Build HTML with embedded images and video
 * Replaces placeholder blocks with actual image/video HTML
 */
function renderBlockHtml(
  html: string,
  imageUrls: string[],
  youtubeEmbed: string
): string {
  let result = html;

  // Embed images in order (replace {{image-1}}, {{image-2}}, {{image-3}} patterns)
  imageUrls.forEach((url, idx) => {
    // Validate URL before embedding (XSS protection)
    if (!isValidImageUrl(url)) {
      logger.warn('[renderBlockHtml] Invalid image URL skipped', {
        url,
        idx: idx + 1,
      });
      return;
    }

    const placeholder = `{{image-${idx + 1}}}`;
    const imageHtml = `<img src="${url}" alt="Article image ${idx + 1}" style="max-width: 100%; height: auto;" />`;
    // Use split().join() to avoid regex quantifier issues with {}
    result = result.split(placeholder).join(imageHtml);
  });

  // Embed YouTube video (replace {{video}} pattern)
  const videoHtml = `<iframe width="100%" height="400" src="${youtubeEmbed}" frameborder="0" allowfullscreen></iframe>`;
  result = result.split('{{video}}').join(videoHtml);

  return result;
}

/**
 * POST: Auto-publish news articles
 * Fetches unpublished articles and auto-selects images + video, then publishes
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret using constant-time comparison
    const cronVerification = verifyCronSecret(req);
    if (!cronVerification.valid) {
      logger.warn('[cron/news-auto-publish] Invalid cron secret', {
        error: cronVerification.error,
      });
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('[cron/news-auto-publish] Starting auto-publish cycle');

    // Process all articles in a transaction (atomic operation)
    // Move findMany inside transaction to prevent race condition
    let result: { publishedCount: number; details: Array<{
      id: number;
      title: string;
      imageCount: number;
      youtubeEmbed: string;
    }> };

    try {
      result = await (prisma as any).$transaction(async (tx: any) => {
      // Fetch unpublished articles inside transaction (findMany + update are atomic)
      const articles = await tx.news.findMany({
        where: {
          publishedAt: null,
          status: 'draft',
        },
        select: {
          id: true,
          title: true,
          htmlContent: true,
        },
        take: 10,
      });

      if (articles.length === 0) {
        logger.info('[cron/news-auto-publish] No unpublished articles found');
        return { publishedCount: 0, details: [] };
      }

      logger.info('[cron/news-auto-publish] Found articles to process', {
        count: articles.length,
      });

      let publishedCount = 0;
      const details: Array<{
        id: number;
        title: string;
        imageCount: number;
        youtubeEmbed: string;
      }> = [];

      for (const article of articles) {
        try {
          // Auto-select 3 images based on keyword (title)
          const selectedImages = autoSelectImages(article.title, 3);
          logger.debug('[cron/news-auto-publish] Images selected', {
            articleId: article.id,
            imageCount: selectedImages.length,
          });

          // Auto-select YouTube video
          const youtubeEmbed = autoSelectYoutube(article.title);
          logger.debug('[cron/news-auto-publish] YouTube selected', {
            articleId: article.id,
            youtubeEmbed: youtubeEmbed.substring(0, 50) + '...',
          });

          // Rebuild HTML with embedded images and video
          const updatedHtml = renderBlockHtml(
            article.htmlContent,
            selectedImages,
            youtubeEmbed
          );

          // Update article within transaction
          await tx.news.update({
            where: { id: article.id },
            data: {
              htmlContent: updatedHtml,
              publishedAt: new Date(),
              status: 'published',
            },
          });

          publishedCount++;
          details.push({
            id: article.id,
            title: article.title,
            imageCount: selectedImages.length,
            youtubeEmbed,
          });

          logger.info('[cron/news-auto-publish] Article published', {
            id: article.id,
            title: article.title,
          });
        } catch (articleError) {
          logger.error('[cron/news-auto-publish] Failed to publish article', {
            id: article.id,
            title: article.title,
            error: articleError instanceof Error ? articleError.message : String(articleError),
          });
          throw articleError;
        }
      }

      return { publishedCount, details };
    });
    } catch (prismaError) {
      logger.warn('[cron/news-auto-publish] News model not found or transaction failed', {
        error: prismaError instanceof Error ? prismaError.message : String(prismaError),
      });

      return NextResponse.json(
        {
          ok: true,
          message: 'No articles processed - News model not configured',
          published: 0,
          details: [],
        },
        { status: 200 }
      );
    }

    logger.info('[cron/news-auto-publish] Cycle completed', {
      published: result.publishedCount,
      total: result.details.length,
    });

    return NextResponse.json(
      {
        ok: true,
        message: `Auto-published ${result.publishedCount} article(s)`,
        published: result.publishedCount,
        details: result.details,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error('[cron/news-auto-publish] Unhandled exception', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'News auto-publish failed',
      },
      { status: 500 }
    );
  }
}
