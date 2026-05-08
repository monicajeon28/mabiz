export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/flows/route.ts
// 채팅봇 플로우 관리 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';

// GET: 플로우 목록 조회
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const flows = await prisma.chatBotFlow.findMany({
      where: {
        category: 'AI 지니 채팅봇(구매)',
        isTemplate: false,
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        ChatBotQuestion: {
          select: { id: true },
        },
      },
    });

    const flowsWithCount = flows.map(flow => ({
      id: flow.id,
      name: flow.name,
      category: flow.category,
      description: flow.description,
      startQuestionId: flow.startQuestionId,
      finalPageUrl: flow.finalPageUrl,
      isActive: flow.isActive,
      order: flow.order,
      productCode: flow.productCode,
      isPublic: flow.isPublic,
      shareToken: flow.shareToken,
      isTemplate: flow.isTemplate,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
      questionCount: flow.ChatBotQuestion.length,
    }));

    return NextResponse.json({
      ok: true,
      data: flowsWithCount,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error('[ChatBot Flows GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: '플로우를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 플로우 생성
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    
    const body = await req.json();
    const { name, description, finalPageUrl, order, productCode, isPublic } = body;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: '플로우 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    // shareToken 생성 (공개 링크용)
    let shareToken: string | null = null;
    if (isPublic) {
      shareToken = `share_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    // productCode가 있으면 finalPageUrl 자동 설정
    let finalUrl = finalPageUrl;
    if (productCode && !finalUrl) {
      finalUrl = `/products/${productCode}/payment`;
    }

    const flow = await prisma.chatBotFlow.create({
      data: {
        name,
        category: 'AI 지니 채팅봇(구매)',
        description: description || null,
        finalPageUrl: finalUrl || null,
        order: order || 0,
        isActive: false, // 기본값은 비활성
        productCode: productCode || null,
        shareToken: shareToken,
        isPublic: isPublic || false,
        isTemplate: false,
        createdBy: admin.userId,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      data: flow,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error('[ChatBot Flows POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: '플로우를 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
