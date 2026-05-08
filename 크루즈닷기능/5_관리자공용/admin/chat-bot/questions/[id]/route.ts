export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/questions/[id]/route.ts
// 특정 질문 관리

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: 질문 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const questionId = parseInt(idStr);

    const question = await prisma.chatBotQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { ok: false, error: '질문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: question,
    });
  } catch (error) {
    console.error('[ChatBot Question GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: '질문을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH: 질문 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const questionId = parseInt(idStr);
    const body = await req.json();

    const question = await prisma.chatBotQuestion.update({
      where: { id: questionId },
      data: {
        questionText: body.questionText,
        questionType: body.questionType,
        spinType: body.spinType,
        information: body.information,
        optionA: body.optionA,
        optionB: body.optionB,
        nextQuestionIdA: body.nextQuestionIdA ? parseInt(body.nextQuestionIdA) : null,
        nextQuestionIdB: body.nextQuestionIdB ? parseInt(body.nextQuestionIdB) : null,
        order: body.order,
        isActive: body.isActive,
      },
    });

    return NextResponse.json({
      ok: true,
      data: question,
    });
  } catch (error) {
    console.error('[ChatBot Question PATCH] Error:', error);
    return NextResponse.json(
      { ok: false, error: '질문을 수정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 질문 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const questionId = parseInt(idStr);

    await prisma.chatBotQuestion.delete({
      where: { id: questionId },
    });

    return NextResponse.json({
      ok: true,
      message: '질문이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('[ChatBot Question DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: '질문을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
