export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/questions/route.ts
// 채팅봇 질문 관리 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: 질문 목록 조회
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const flowId = searchParams.get('flowId');

    if (!flowId) {
      return NextResponse.json(
        { ok: false, error: 'flowId가 필요합니다.' },
        { status: 400 }
      );
    }

    const questions = await prisma.chatBotQuestion.findMany({
      where: {
        flowId: parseInt(flowId),
      },
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      data: questions,
    });
  } catch (error) {
    console.error('[ChatBot Questions GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: '질문을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 질문 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      flowId,
      questionText,
      questionType,
      spinType,
      information,
      optionA,
      optionB,
      nextQuestionIdA,
      nextQuestionIdB,
      order,
    } = body;

    if (!flowId || !questionText) {
      return NextResponse.json(
        { ok: false, error: 'flowId와 questionText는 필수입니다.' },
        { status: 400 }
      );
    }

    const question = await prisma.chatBotQuestion.create({
      data: {
        flowId: parseInt(flowId),
        questionText,
        questionType: questionType || 'choice',
        spinType: spinType || null,
        information: information || null,
        optionA: optionA || null,
        optionB: optionB || null,
        nextQuestionIdA: nextQuestionIdA ? parseInt(nextQuestionIdA) : null,
        nextQuestionIdB: nextQuestionIdB ? parseInt(nextQuestionIdB) : null,
        order: order || 0,
      },
    });

    return NextResponse.json({
      ok: true,
      data: question,
    });
  } catch (error) {
    console.error('[ChatBot Questions POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: '질문을 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
