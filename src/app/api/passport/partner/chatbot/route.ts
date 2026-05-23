export const dynamic = 'force-dynamic';

// 파트너용 여권 챗봇 플로우 조회/생성 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

interface ChatBotFlowRow {
  id: number;
  shareToken: string | null;
  startQuestionId: number | null;
}

interface ChatBotQuestionRow {
  id: number;
}

// GET: 여권 챗봇 플로우 조회 (없으면 생성)
export async function GET(req: NextRequest) {
  try {
    const partnerCtx = await requirePartnerContext();
    if (!partnerCtx) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 403 },
      );
    }

    // 기존 여권 챗봇 플로우 확인
    const flows = await prisma.$queryRaw<ChatBotFlowRow[]>`
      SELECT id, "shareToken", "startQuestionId"
      FROM "ChatBotFlow"
      WHERE name = '여권 등록 챗봇'
        AND category = 'AI 지니 채팅봇(구매)'
      LIMIT 1
    `;

    let flow = flows[0] ?? null;

    // 플로우가 없으면 생성
    if (!flow) {
      const shareToken = `passport_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      const createdFlows = await prisma.$queryRaw<ChatBotFlowRow[]>`
        INSERT INTO "ChatBotFlow" (name, description, category, "isActive", "isPublic", "shareToken", "order", "createdAt", "updatedAt")
        VALUES (
          '여권 등록 챗봇',
          '고객이 여권 이미지를 업로드하고 방 배정을 완료하는 챗봇',
          'AI 지니 채팅봇(구매)',
          true,
          true,
          ${shareToken},
          0,
          NOW(),
          NOW()
        )
        RETURNING id, "shareToken", "startQuestionId"
      `;
      flow = createdFlows[0];

      // 기본 질문들 생성
      const questions = [
        {
          order: 1,
          questionText:
            '안녕하세요! 여권 등록을 도와드리겠습니다. 여권 이미지를 업로드해주세요.',
          questionType: 'IMAGE_UPLOAD',
          information:
            '여권 사진을 촬영하거나 업로드해주시면 자동으로 정보를 추출해드립니다.',
          optionA: null,
          optionB: null,
        },
        {
          order: 2,
          questionText: '방을 어떻게 사용하시겠어요?',
          questionType: 'CHOICE',
          information:
            '구매하신 방 수에 따라 배정 방식을 선택해주세요.',
          optionA: '2인 1실로 사용',
          optionB: '3인 이상 사용 (문의 필요)',
        },
        {
          order: 3,
          questionText:
            '구매 이력을 확인했습니다. {방수}개 방을 구매하셨는데, 2인 1실 기준이므로 2명씩 배정됩니다.',
          questionType: 'TEXT',
          information: '3인 이상 사용을 원하시면 상담원이 연락드리겠습니다.',
          optionA: null,
          optionB: null,
        },
        {
          order: 4,
          questionText:
            '3인 이상 사용을 원하시는군요. 이름과 연락처를 알려주시면 상담원이 곧 연락드리겠습니다.',
          questionType: 'FORM',
          information: '이름과 전화번호를 입력해주세요.',
          optionA: null,
          optionB: null,
        },
        {
          order: 5,
          questionText:
            '감사합니다! 여권 정보와 PNR이 본사로 전송되었습니다. 곧 상담원이 연락드리겠습니다.',
          questionType: 'END',
          information: '추가 문의사항이 있으시면 언제든지 연락주세요.',
          optionA: null,
          optionB: null,
        },
      ];

      const createdQuestionIds: number[] = [];
      for (const q of questions) {
        const rows = await prisma.$queryRaw<ChatBotQuestionRow[]>`
          INSERT INTO "ChatBotQuestion" (
            "flowId", "order", "questionText", "questionType",
            "information", "optionA", "optionB",
            "nextQuestionIdA", "nextQuestionIdB",
            "isActive", "createdAt", "updatedAt"
          )
          VALUES (
            ${flow.id}, ${q.order}, ${q.questionText}, ${q.questionType},
            ${q.information}, ${q.optionA}, ${q.optionB},
            NULL, NULL,
            true, NOW(), NOW()
          )
          RETURNING id
        `;
        createdQuestionIds.push(rows[0].id);
      }

      // 질문들 연결
      if (createdQuestionIds.length >= 5) {
        await prisma.$executeRaw`
          UPDATE "ChatBotQuestion"
          SET "nextQuestionIdA" = ${createdQuestionIds[1]}
          WHERE id = ${createdQuestionIds[0]}
        `;

        await prisma.$executeRaw`
          UPDATE "ChatBotQuestion"
          SET "nextQuestionIdA" = ${createdQuestionIds[2]},
              "nextQuestionIdB" = ${createdQuestionIds[3]}
          WHERE id = ${createdQuestionIds[1]}
        `;

        await prisma.$executeRaw`
          UPDATE "ChatBotQuestion"
          SET "nextQuestionIdA" = ${createdQuestionIds[4]}
          WHERE id = ${createdQuestionIds[2]}
        `;

        await prisma.$executeRaw`
          UPDATE "ChatBotQuestion"
          SET "nextQuestionIdA" = ${createdQuestionIds[4]}
          WHERE id = ${createdQuestionIds[3]}
        `;
      }

      // 시작 질문 설정
      await prisma.$executeRaw`
        UPDATE "ChatBotFlow"
        SET "startQuestionId" = ${createdQuestionIds[0]}
        WHERE id = ${flow.id}
      `;

      // flow 객체 갱신
      flow = { ...flow, shareToken, startQuestionId: createdQuestionIds[0] };
    }

    return NextResponse.json({
      ok: true,
      shareToken: flow.shareToken,
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[Partner ChatBot Passport Flow] Error:', { err });
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : '플로우를 조회하는 중 오류가 발생했습니다.',
      },
      { status: 500 },
    );
  }
}
