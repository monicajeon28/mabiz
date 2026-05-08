export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { assignShortCode, generateSlug } from '@/lib/news-shortlink';

// POST /api/admin/cruisedot-news/shortlink
// 뉴스 포스트에 shortCode + slug 생성/재생성
export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ ok: false }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ ok: false, message: 'postId 필요' }, { status: 400 });

  const post = await prisma.communityPost.findUnique({
    where: { id: Number(postId) },
    select: { id: true, title: true, shortCode: true },
  });
  if (!post) return NextResponse.json({ ok: false, message: '포스트 없음' }, { status: 404 });

  try {
    const slug = generateSlug(post.title);
    // slug 중복 체크 후 업데이트
    const slugExists = await prisma.communityPost.findUnique({ where: { slug }, select: { id: true } });
    if (!slugExists || slugExists.id === post.id) {
      await prisma.communityPost.update({ where: { id: post.id }, data: { slug } });
    }
    const shortCode = await assignShortCode(post.id);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.cruisedot.co.kr';
    logger.debug('[ShortLink] 생성', { postId, shortCode });
    return NextResponse.json({ ok: true, shortCode, url: `${siteUrl}/n/${shortCode}` });
  } catch (err) {
    logger.error('[ShortLink] 생성 실패', { postId, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, message: '생성 실패' }, { status: 500 });
  }
}
