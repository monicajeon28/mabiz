export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/templates/route.ts
// 템플릿 리스트 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const templates = await prisma.chatBotFlow.findMany({
      where: {
        isTemplate: true,
      },
      orderBy: [
        { updatedAt: 'desc' },
      ],
      include: {
        ChatBotQuestion: {
          select: { id: true },
        },
      },
    });

    const templateSummaries = templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      questionCount: template.ChatBotQuestion.length,
      updatedAt: template.updatedAt,
      createdAt: template.createdAt,
    }));

    return NextResponse.json({
      ok: true,
      data: templateSummaries,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error('[ChatBot Templates GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: '템플릿 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
