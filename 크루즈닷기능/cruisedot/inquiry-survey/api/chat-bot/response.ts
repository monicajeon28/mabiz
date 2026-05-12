export const dynamic = 'force-dynamic';

// app/api/chat-bot/response/route.ts
// 채팅봇 응답 저장

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      questionId,
      selectedOption,
      selectedText,
      responseTime,
      isAbandoned,
      nextQuestionId,
      questionOrder,
      optionLabel,
      displayedAt,
      answeredAt,
    } = body;

    if (!sessionId || !questionId) {
      return NextResponse.json(
        { ok: false, error: 'sessionId와 questionId는 필수입니다.' },
        { status: 400 }
      );
    }

    const response = await prisma.chatBotResponse.create({
      data: {
        sessionId,
        questionId: typeof questionId === 'number' ? questionId : parseInt(questionId, 10),
        selectedOption: selectedOption || null,
        selectedText: selectedText || null,
        responseTime:
          typeof responseTime === 'number'
            ? responseTime
            : responseTime
            ? parseInt(responseTime, 10)
            : null,
        isAbandoned: Boolean(isAbandoned),
        nextQuestionId:
          nextQuestionId !== undefined && nextQuestionId !== null
            ? typeof nextQuestionId === 'number'
              ? nextQuestionId
              : parseInt(nextQuestionId, 10)
            : null,
        questionOrder:
          questionOrder !== undefined && questionOrder !== null
            ? typeof questionOrder === 'number'
              ? questionOrder
              : parseInt(questionOrder, 10)
            : null,
        optionLabel: optionLabel || selectedText || null,
        displayedAt: displayedAt ? new Date(displayedAt) : null,
        answeredAt: answeredAt ? new Date(answeredAt) : undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      data: response,
    });
  } catch (error) {
    console.error('[ChatBot Response POST] Error:', error);
    return NextResponse.json(
      { ok: false, error: '응답을 저장하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
