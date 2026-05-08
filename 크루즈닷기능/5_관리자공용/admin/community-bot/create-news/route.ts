import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateCruisedotNews } from '@/app/api/cron/community-bot/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 수동으로 크루즈뉘우스 생성 API
 */
export async function POST(req: Request) {
  try {
    // 봇 사용자 확인
    let botUser = await prisma.user.findUnique({
      where: { id: 1 },
    });

    if (!botUser) {
      // 봇 사용자 생성
      botUser = await prisma.user.create({
        data: {
          id: 1,
          name: '크루즈뉘우스 봇',
          phone: '01000000000',
          password: 'bot-password-not-used',
          role: 'user',
        },
      });
    }

    // 오늘 이미 생성되었는지 확인
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingNews = await prisma.communityPost.findFirst({
      where: {
        userId: botUser.id,
        category: 'cruisedot-news',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existingNews) {
      return NextResponse.json({
        ok: false,
        error: '오늘 이미 크루즈뉘우스가 생성되어 있습니다.',
        existingNews: {
          id: existingNews.id,
          title: existingNews.title,
          createdAt: existingNews.createdAt,
        },
      });
    }

    // 크루즈뉘우스 생성
    console.log('[MANUAL] 크루즈뉘우스 생성 시작...');
    const newsData = await generateCruisedotNews();

    if (!newsData) {
      return NextResponse.json(
        { ok: false, error: '크루즈뉘우스 생성 실패' },
        { status: 500 }
      );
    }

    // 데이터베이스에 저장
    const newsPost = await prisma.communityPost.create({
      data: {
        userId: botUser.id,
        title: newsData.title,
        content: newsData.html,
        category: newsData.category,
        authorName: '크루즈뉘우스 본사',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('[MANUAL] 크루즈뉘우스 생성 완료:', newsPost.id);

    return NextResponse.json({
      ok: true,
      message: '크루즈뉘우스가 성공적으로 생성되었습니다.',
      news: {
        id: newsPost.id,
        title: newsPost.title,
        createdAt: newsPost.createdAt,
        url: `/cruisedot-news?post=db-${newsPost.id}`,
      },
    });
  } catch (error) {
    console.error('[MANUAL] 크루즈뉘우스 생성 실패:', error);
    return NextResponse.json(
      { ok: false, error: '크루즈뉘우스 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}




