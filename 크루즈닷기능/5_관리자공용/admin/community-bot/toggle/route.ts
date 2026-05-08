import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { isActive } = await req.json();

    // SystemConfig에 봇 활성화 상태 저장
    await prisma.systemConfig.upsert({
      where: { configKey: 'community_bot_active' },
      update: {
        configValue: String(isActive),
        description: '커뮤니티 봇 활성화 상태 (true: 활성화, false: 비활성화)',
        category: 'bot',
        updatedAt: new Date(),
      },
      create: {
        configKey: 'community_bot_active',
        configValue: String(isActive),
        description: '커뮤니티 봇 활성화 상태 (true: 활성화, false: 비활성화)',
        category: 'bot',
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      isActive,
      message: isActive ? '봇이 활성화되었습니다.' : '봇이 비활성화되었습니다.',
    });
  } catch (error) {
    console.error('[Community Bot Toggle] 설정 저장 실패:', error);
    return NextResponse.json(
      { ok: false, error: '설정 저장 실패' },
      { status: 500 }
    );
  }
}




