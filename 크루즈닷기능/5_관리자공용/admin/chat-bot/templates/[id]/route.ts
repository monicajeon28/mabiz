export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/templates/[id]/route.ts
// 템플릿 상세 조회 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id: idStr } = await params;
    const templateId = Number(idStr);
    if (Number.isNaN(templateId)) {
      return NextResponse.json(
        { ok: false, error: '유효한 템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const template = await prisma.chatBotFlow.findFirst({
      where: {
        id: templateId,
        isTemplate: true,
      },
      include: {
        ChatBotQuestion: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: '템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { ChatBotQuestion, ...templateData } = template;

    return NextResponse.json({
      ok: true,
      data: {
        ...templateData,
        questions: ChatBotQuestion,
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error('[ChatBot Template GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: '템플릿을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
