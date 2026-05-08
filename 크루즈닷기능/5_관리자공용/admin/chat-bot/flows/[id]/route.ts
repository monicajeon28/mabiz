export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/flows/[id]/route.ts
// 특정 플로우 관리

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';

// GET: 플로우 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: idStr } = await params; const flowId = parseInt(idStr);

    const flow = await prisma.chatBotFlow.findUnique({
      where: { id: flowId },
      include: {
        ChatBotQuestion: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!flow) {
      return NextResponse.json(
        { ok: false, error: '플로우를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { ChatBotQuestion, ...flowData } = flow;

    return NextResponse.json({
      ok: true,
      data: {
        ...flowData,
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
    console.error('[ChatBot Flow GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: '플로우를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH: 플로우 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: idStr } = await params; const flowId = parseInt(idStr);
    const body = await req.json();

    // 업데이트할 데이터 준비 (undefined인 필드는 업데이트하지 않음)
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.startQuestionId !== undefined) updateData.startQuestionId = body.startQuestionId;
    if (body.finalPageUrl !== undefined) updateData.finalPageUrl = body.finalPageUrl;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.shareToken !== undefined) updateData.shareToken = body.shareToken;
    if (body.productCode !== undefined) updateData.productCode = body.productCode;
    updateData.updatedAt = new Date();

    const flow = await prisma.chatBotFlow.update({
      where: { id: flowId },
      data: updateData,
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
    console.error('[ChatBot Flow PATCH] Error:', error);
    return NextResponse.json(
      { ok: false, error: '플로우를 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 플로우 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: idStr } = await params; const flowId = parseInt(idStr);

    // 플로우와 관련된 모든 질문도 함께 삭제됨 (Cascade)
    await prisma.chatBotFlow.delete({
      where: { id: flowId },
    });

    return NextResponse.json({
      ok: true,
      message: '플로우가 삭제되었습니다.',
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error('[ChatBot Flow DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: '플로우를 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
