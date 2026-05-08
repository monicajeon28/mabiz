import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // SystemConfig에서 봇 활성화 상태 조회
    const config = await prisma.systemConfig.findUnique({
      where: { configKey: 'community_bot_active' },
    });

    const isActive = config?.configValue === 'true';
    
    // 마지막 활동 시간 조회
    const lastPost = await prisma.communityPost.findFirst({
      where: {
        authorId: 1, // 봇 사용자 ID
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    const lastActivity = lastPost 
      ? new Date(lastPost.createdAt).toLocaleString('ko-KR')
      : '활동 기록 없음';

    return NextResponse.json({
      ok: true,
      isActive,
      lastActivity,
    });
  } catch (error) {
    console.error('[Community Bot Status] 조회 실패:', error);
    return NextResponse.json(
      { ok: false, error: '상태 조회 실패' },
      { status: 500 }
    );
  }
}




