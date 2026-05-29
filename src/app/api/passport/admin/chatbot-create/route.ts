export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 여권 챗봇 플로우 자동 생성 (GMcruise ChatBotFlow/ChatBotQuestion 테이블 사용)

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // 기존 여권 챗봇 플로우 확인 (ChatBotFlow는 CRM 스키마에 없으므로 raw query)
    const existingFlows = await prisma.$queryRaw<
      Array<{ id: number; shareToken: string | null }>
    >`
      SELECT id, "shareToken"
      FROM "ChatBotFlow"
      WHERE name = '여권 등록 챗봇'
        AND category = 'AI 지니 채팅봇(구매)'
      LIMIT 1
    `;

    if (existingFlows.length > 0) {
      return NextResponse.json({
        ok: true,
        message: '여권 챗봇 플로우가 이미 존재합니다.',
        flowId: existingFlows[0].id,
        shareToken: existingFlows[0].shareToken,
      });
    }

    // 플로우 생성
    const shareToken = `passport_${randomBytes(16).toString('hex')}`;

    const createdFlows = await prisma.$queryRaw<
      Array<{ id: number; shareToken: string }>
    >`
      INSERT INTO "ChatBotFlow" (name, description, category, "isActive", "isPublic", "shareToken", "order")
      VALUES (
        '여권 등록 챗봇',
        '고객이 여권 이미지를 업로드하고 방 배정을 완료하는 챗봇',
        'AI 지니 채팅봇(구매)',
        true,
        true,
        ${shareToken},
        0
      )
      RETURNING id, "shareToken"
    `;

    const flow = createdFlows[0];

    // 질문들 생성
    const questionDefs = [
      {
        order: 1,
        questionText: '안녕하세요! 여권 등록을 도와드리겠습니다. 여권 이미지를 업로드해주세요.',
        questionType: 'IMAGE_UPLOAD',
        information: '여권 사진을 촬영하거나 업로드해주시면 자동으로 정보를 추출해드립니다.',
        optionA: null,
        optionB: null,
      },
      {
        order: 2,
        questionText: '방을 어떻게 사용하시겠어요?',
        questionType: 'CHOICE',
        information: '구매하신 방 수에 따라 배정 방식을 선택해주세요.',
        optionA: '2인 1실로 사용',
        optionB: '3인 이상 사용 (문의 필요)',
      },
      {
        order: 3,
        questionText: '구매 이력을 확인했습니다. {방수}개 방을 구매하셨는데, 2인 1실 기준이므로 2명씩 배정됩니다.',
        questionType: 'TEXT',
        information: '3인 이상 사용을 원하시면 상담원이 연락드리겠습니다.',
        optionA: null,
        optionB: null,
      },
      {
        order: 4,
        questionText: '3인 이상 사용을 원하시는군요. 이름과 연락처를 알려주시면 상담원이 곧 연락드리겠습니다.',
        questionType: 'FORM',
        information: '이름과 전화번호를 입력해주세요.',
        optionA: null,
        optionB: null,
      },
      {
        order: 5,
        questionText: '감사합니다! 여권 정보와 PNR이 본사로 전송되었습니다. 곧 상담원이 연락드리겠습니다.',
        questionType: 'END',
        information: '추가 문의사항이 있으시면 언제든지 연락주세요.',
        optionA: null,
        optionB: null,
      },
    ];

    const createdQuestions: Array<{ id: number }> = [];
    for (const q of questionDefs) {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "ChatBotQuestion" (
          "flowId", "order", "questionText", "questionType",
          "information", "optionA", "optionB",
          "nextQuestionIdA", "nextQuestionIdB", "isActive"
        )
        VALUES (
          ${flow.id}, ${q.order}, ${q.questionText}, ${q.questionType},
          ${q.information}, ${q.optionA}, ${q.optionB},
          NULL, NULL, true
        )
        RETURNING id
      `;
      createdQuestions.push(rows[0]);
    }

    // 질문들 연결
    if (createdQuestions.length >= 5) {
      // 질문 1 (이미지 업로드) -> 질문 2 (방 선택)
      await prisma.$executeRaw`
        UPDATE "ChatBotQuestion" SET "nextQuestionIdA" = ${createdQuestions[1].id}
        WHERE id = ${createdQuestions[0].id}
      `;

      // 질문 2 (방 선택) -> 질문 3 (2인 1실) 또는 질문 4 (3인 이상)
      await prisma.$executeRaw`
        UPDATE "ChatBotQuestion"
        SET "nextQuestionIdA" = ${createdQuestions[2].id},
            "nextQuestionIdB" = ${createdQuestions[3].id}
        WHERE id = ${createdQuestions[1].id}
      `;

      // 질문 3 (2인 1실 안내) -> 질문 5 (완료)
      await prisma.$executeRaw`
        UPDATE "ChatBotQuestion" SET "nextQuestionIdA" = ${createdQuestions[4].id}
        WHERE id = ${createdQuestions[2].id}
      `;

      // 질문 4 (3인 이상 문의) -> 질문 5 (완료)
      await prisma.$executeRaw`
        UPDATE "ChatBotQuestion" SET "nextQuestionIdA" = ${createdQuestions[4].id}
        WHERE id = ${createdQuestions[3].id}
      `;
    }

    // 시작 질문 설정
    await prisma.$executeRaw`
      UPDATE "ChatBotFlow" SET "startQuestionId" = ${createdQuestions[0].id}
      WHERE id = ${flow.id}
    `;

    return NextResponse.json({
      ok: true,
      message: '여권 챗봇 플로우가 생성되었습니다.',
      flowId: flow.id,
      shareToken: flow.shareToken,
    });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    logger.error('[Create Passport Flow] Error:', { err });
    return NextResponse.json(
      { ok: false, error: (err.message as string) || '플로우 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
