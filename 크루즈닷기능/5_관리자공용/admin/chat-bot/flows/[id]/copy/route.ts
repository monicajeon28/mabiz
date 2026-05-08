export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/flows/[id]/copy/route.ts
// 기존 플로우 복제 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id: idStr } = await params;
    const flowId = Number(idStr);

    if (Number.isNaN(flowId)) {
      return NextResponse.json(
        { ok: false, error: '유효한 플로우 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      productCode,
      name,
      description,
      finalPageUrl,
      isPublic = false,
      mode = 'product',
    }: {
      productCode?: string;
      name?: string;
      description?: string;
      finalPageUrl?: string;
      isPublic?: boolean;
      mode?: 'product' | 'template';
    } = body;

    const copyMode = mode === 'template' ? 'template' : 'product';
    const trimmedProductCode = productCode?.trim();

    if (copyMode === 'product' && !trimmedProductCode) {
      return NextResponse.json(
        { ok: false, error: '복사 대상 상품 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const originalFlow = await prisma.chatBotFlow.findUnique({
      where: { id: flowId },
      include: {
        ChatBotQuestion: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!originalFlow) {
      return NextResponse.json(
        { ok: false, error: '원본 플로우를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const isTemplateMode = copyMode === 'template';

    const shareToken = !isTemplateMode && isPublic
      ? `share_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      : null;

    const resolvedFinalUrl =
      finalPageUrl?.trim() ||
      (isTemplateMode
        ? null
        : trimmedProductCode
          ? `/products/${trimmedProductCode}/payment`
          : originalFlow.finalPageUrl);

    const result = await prisma.$transaction(async (tx) => {
      const newFlow = await tx.chatBotFlow.create({
        data: {
          name: name?.trim() || (isTemplateMode
            ? `${originalFlow.name} 템플릿`
            : `${originalFlow.name} (${trimmedProductCode})`),
          category: originalFlow.category,
          description: description ?? originalFlow.description,
          finalPageUrl: resolvedFinalUrl,
          isActive: false,
          order: originalFlow.order,
          productCode: isTemplateMode ? null : trimmedProductCode,
          isPublic: isTemplateMode ? false : Boolean(isPublic),
          shareToken,
          isTemplate: isTemplateMode,
          createdBy: admin.userId,
          updatedAt: new Date(),
        },
      });

      const idMap = new Map<number, number>();

      for (const question of originalFlow.ChatBotQuestion) {
        const created = await tx.chatBotQuestion.create({
          data: {
            flowId: newFlow.id,
            questionText: question.questionText,
            questionType: question.questionType,
            spinType: question.spinType,
            information: question.information,
            optionA: question.optionA,
            optionB: question.optionB,
            options: question.options as JsonValue,
            nextQuestionIdA: null,
            nextQuestionIdB: null,
            nextQuestionIds: null,
            order: question.order,
            isActive: question.isActive,
            updatedAt: new Date(),
          },
        });

        idMap.set(question.id, created.id);
      }

      const remapJson = (value: JsonValue): JsonValue => {
        if (value === null) {
          return null;
        }

        if (Array.isArray(value)) {
          return value.map((item) => {
            if (typeof item === 'number') {
              return idMap.get(item) ?? null;
            }
            if (typeof item === 'object' && item !== null) {
              return remapJson(item as JsonValue);
            }
            return item;
          });
        }

        if (typeof value === 'object') {
          const mapped: Record<string, JsonValue> = {};
          for (const [key, val] of Object.entries(value)) {
            if (typeof val === 'number') {
              mapped[key] = idMap.get(val) ?? null;
              continue;
            }
            if (Array.isArray(val)) {
              mapped[key] = remapJson(val as JsonValue);
              continue;
            }
            if (typeof val === 'object' && val !== null) {
              mapped[key] = remapJson(val as JsonValue);
              continue;
            }
            mapped[key] = val as JsonValue;
          }
          return mapped;
        }

        return value;
      };

      for (const question of originalFlow.ChatBotQuestion) {
        const newQuestionId = idMap.get(question.id);
        if (!newQuestionId) continue;

        const updateData: Record<string, any> = {};

        if (question.nextQuestionIdA) {
          updateData.nextQuestionIdA = idMap.get(question.nextQuestionIdA) ?? null;
        }
        if (question.nextQuestionIdB) {
          updateData.nextQuestionIdB = idMap.get(question.nextQuestionIdB) ?? null;
        }
        if (question.nextQuestionIds) {
          updateData.nextQuestionIds = remapJson(question.nextQuestionIds as JsonValue);
        }

        if (Object.keys(updateData).length > 0) {
          await tx.chatBotQuestion.update({
            where: { id: newQuestionId },
            data: updateData,
          });
        }
      }

      const newStartQuestionId = originalFlow.startQuestionId
        ? idMap.get(originalFlow.startQuestionId) ?? null
        : null;

      const updatedFlow = await tx.chatBotFlow.update({
        where: { id: newFlow.id },
        data: { startQuestionId: newStartQuestionId },
        include: {
          ChatBotQuestion: {
            select: { id: true },
          },
        },
      });

      return {
        flow: updatedFlow,
        questionCount: originalFlow.ChatBotQuestion.length,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...result.flow,
        questionCount: result.questionCount,
      },
    });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error('[ChatBot Flow Copy] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '플로우 복사 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
