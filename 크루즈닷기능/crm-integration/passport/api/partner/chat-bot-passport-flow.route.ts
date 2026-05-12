export const dynamic = 'force-dynamic';

// app/api/partner/chat-bot/passport-flow/route.ts
// 파트너용 여권 챗봇 플로우 조회/생성 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';

// GET: 여권 챗봇 플로우 조회 (없으면 생성)
export async function GET(req: NextRequest) {
  try {
    await requirePartnerContext();

    // 기존 여권 챗봇 플로우 확인
    let flow = await prisma.chatBotFlow.findFirst({
      where: {
        name: '여권 등록 챗봇',
        category: 'AI 지니 채팅봇(구매)',
      },
    });

    // 플로우가 없으면 생성
    if (!flow) {
      const shareToken = `passport_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      flow = await prisma.chatBotFlow.create({
        data: {
          name: '여권 등록 챗봇',
          description: '고객이 여권 이미지를 업로드하고 방 배정을 완료하는 챗봇',
          category: 'AI 지니 채팅봇(구매)',
          isActive: true,
          isPublic: true,
          shareToken,
          order: 0,
        },
      });

      // 기본 질문들 생성
      const questions = [
        {
          flowId: flow.id,
          order: 1,
          questionText: '안녕하세요! 여권 등록을 도와드리겠습니다. 여권 이미지를 업로드해주세요.',
          questionType: 'IMAGE_UPLOAD',
          information: '여권 사진을 촬영하거나 업로드해주시면 자동으로 정보를 추출해드립니다.',
          nextQuestionIdA: null,
        },
        {
          flowId: flow.id,
          order: 2,
          questionText: '방을 어떻게 사용하시겠어요?',
          questionType: 'CHOICE',
          information: '구매하신 방 수에 따라 배정 방식을 선택해주세요.',
          optionA: '2인 1실로 사용',
          optionB: '3인 이상 사용 (문의 필요)',
          nextQuestionIdA: null,
          nextQuestionIdB: null,
        },
        {
          flowId: flow.id,
          order: 3,
          questionText: '구매 이력을 확인했습니다. {방수}개 방을 구매하셨는데, 2인 1실 기준이므로 2명씩 배정됩니다.',
          questionType: 'TEXT',
          information: '3인 이상 사용을 원하시면 상담원이 연락드리겠습니다.',
          nextQuestionIdA: null,
        },
        {
          flowId: flow.id,
          order: 4,
          questionText: '3인 이상 사용을 원하시는군요. 이름과 연락처를 알려주시면 상담원이 곧 연락드리겠습니다.',
          questionType: 'FORM',
          information: '이름과 전화번호를 입력해주세요.',
          nextQuestionIdA: null,
        },
        {
          flowId: flow.id,
          order: 5,
          questionText: '감사합니다! 여권 정보와 PNR이 본사로 전송되었습니다. 곧 상담원이 연락드리겠습니다.',
          questionType: 'END',
          information: '추가 문의사항이 있으시면 언제든지 연락주세요.',
          nextQuestionIdA: null,
        },
      ];

      const createdQuestions = [];
      for (const q of questions) {
        const question = await prisma.chatBotQuestion.create({
          data: {
            flowId: flow.id,
            order: q.order,
            questionText: q.questionText,
            questionType: q.questionType,
            information: q.information || null,
            optionA: q.optionA || null,
            optionB: q.optionB || null,
            nextQuestionIdA: q.nextQuestionIdA,
            nextQuestionIdB: q.nextQuestionIdB,
            isActive: true,
          },
        });
        createdQuestions.push(question);
      }

      // 질문들 연결
      if (createdQuestions.length >= 5) {
        await prisma.chatBotQuestion.update({
          where: { id: createdQuestions[0].id },
          data: { nextQuestionIdA: createdQuestions[1].id },
        });

        await prisma.chatBotQuestion.update({
          where: { id: createdQuestions[1].id },
          data: {
            nextQuestionIdA: createdQuestions[2].id,
            nextQuestionIdB: createdQuestions[3].id,
          },
        });

        await prisma.chatBotQuestion.update({
          where: { id: createdQuestions[2].id },
          data: { nextQuestionIdA: createdQuestions[4].id },
        });

        await prisma.chatBotQuestion.update({
          where: { id: createdQuestions[3].id },
          data: { nextQuestionIdA: createdQuestions[4].id },
        });
      }

      // 시작 질문 설정
      await prisma.chatBotFlow.update({
        where: { id: flow.id },
        data: { startQuestionId: createdQuestions[0].id },
      });
    }

    return NextResponse.json({
      ok: true,
      shareToken: flow.shareToken,
    });
  } catch (error: any) {
    console.error('[Partner ChatBot Passport Flow] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '플로우를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


