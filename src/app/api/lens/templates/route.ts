/**
 * GET /api/lens/templates - 렌즈 템플릿 조회
 * POST /api/lens/templates - 템플릿 생성/업데이트
 * @date 2026-05-27
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

interface TemplateCreateRequest {
  organizationId: string;
  lensType: string;
  templateType: "sms" | "email" | "call_script";
  day: 0 | 1 | 2 | 3;
  title: string;
  body: string;
  psychologyPrinciple: string;
  estimatedClickRate?: number;
  sendDelayMinutes?: number;
}

const SYSTEM_TEMPLATES: Record<string, any[]> = {
  L0: [
    {
      day: 0,
      title: "Day 0: 감정적 재연결",
      body: "당신의 자리는 항상 예약돼 있었어요.\n당신이 우리의 가족이라는 뜻입니다.",
      psychologyPrinciple: "emotional_reconnection",
      estimatedClickRate: 0.45,
    },
    {
      day: 1,
      title: "Day 1: 추억 회상",
      body: "지난 크루즈에서의 그 순간을 기억하시나요?\n다시 함께하고 싶습니다.",
      psychologyPrinciple: "nostalgia",
      estimatedClickRate: 0.42,
    },
    {
      day: 2,
      title: "Day 2: 특별 혜택",
      body: "돌아오신 분들을 위한 특별한 30% 할인\n이번 주말까지만 유효합니다.",
      psychologyPrinciple: "scarcity",
      estimatedClickRate: 0.48,
    },
    {
      day: 3,
      title: "Day 3: 최종 초대",
      body: "당신을 초대합니다. 지금 예약하세요.\n시간이 다 가기 전에.",
      psychologyPrinciple: "urgency",
      estimatedClickRate: 0.55,
    },
  ],
  L1: [
    {
      day: 0,
      title: "Day 0: 가치 재정의",
      body: "400% ROI? 이것이 우리 가격의 진짜 의미입니다.",
      psychologyPrinciple: "value_redefinition",
      estimatedClickRate: 0.40,
    },
    {
      day: 1,
      title: "Day 1: 경쟁사 대비",
      body: "Royal vs 우리? 5가지 이유로 우리를 선택하세요.",
      psychologyPrinciple: "comparison",
      estimatedClickRate: 0.45,
    },
    {
      day: 2,
      title: "Day 2: 유연한 결제",
      body: "월 5만원부터 시작할 수 있습니다.\n3개월 무이자 할부 이용 가능",
      psychologyPrinciple: "financial_flexibility",
      estimatedClickRate: 0.52,
    },
    {
      day: 3,
      title: "Day 3: 긴박감",
      body: "내일 마감입니다.\n지금 신청하면 추가 5% 할인",
      psychologyPrinciple: "urgency",
      estimatedClickRate: 0.50,
    },
  ],
  L6: [
    {
      day: 0,
      title: "Day 0: 손실회피",
      body: "지금만 20% 할인입니다.\n늦으면 정가로 구매해야 합니다.",
      psychologyPrinciple: "loss_aversion",
      estimatedClickRate: 0.55,
    },
    {
      day: 1,
      title: "Day 1: 희소성",
      body: "명일 마감입니다.\n선실 3개만 남았습니다.",
      psychologyPrinciple: "scarcity",
      estimatedClickRate: 0.58,
    },
    {
      day: 2,
      title: "Day 2: 확정",
      body: "결정하셨나요?\n지금이 최고의 시간입니다.",
      psychologyPrinciple: "timing",
      estimatedClickRate: 0.60,
    },
    {
      day: 3,
      title: "Day 3: 클로징",
      body: "지금 예약 완료하세요.\n더 이상 기다리지 마세요.",
      psychologyPrinciple: "closing",
      estimatedClickRate: 0.65,
    },
  ],
  L10: [
    {
      day: 0,
      title: "Day 0: 긴급 할인",
      body: "당신을 위한 10% 추가 할인\n지금 예약 시에만 가능",
      psychologyPrinciple: "urgency",
      estimatedClickRate: 0.65,
    },
    {
      day: 1,
      title: "Day 1: 희소성 강조",
      body: "선실 3개 남음\n결정해야 할 순간입니다.",
      psychologyPrinciple: "scarcity",
      estimatedClickRate: 0.68,
    },
    {
      day: 2,
      title: "Day 2: 결제 진행",
      body: "결제 화면을 열었습니다.\n마지막 한 발짝입니다.",
      psychologyPrinciple: "closing",
      estimatedClickRate: 0.70,
    },
    {
      day: 3,
      title: "Day 3: 확정",
      body: "예약을 완료하세요.\n당신의 꿈이 시작됩니다.",
      psychologyPrinciple: "fulfillment",
      estimatedClickRate: 0.75,
    },
  ],
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    let ctx;
    try {
      ctx = await getAuthContext();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const lensType = searchParams.get("lensType");
    const templateType = searchParams.get("templateType");
    const day = searchParams.get("day");

    if (!organizationId || organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    let query: any = { where: { organizationId } };
    if (lensType) query.where.lensType = lensType;
    if (templateType) query.where.templateType = templateType;
    if (day) query.where.day = parseInt(day);

    const templates = await prisma.lensTemplate.findMany(query);

    if (templates.length === 0 && lensType) {
      const systemTemplates = SYSTEM_TEMPLATES[lensType] || [];
      return NextResponse.json({
        templates: systemTemplates.map((t: any, idx: number) => ({
          id: `system_${lensType}_${idx}`,
          lensType,
          day: t.day,
          templateType: "sms",
          title: t.title,
          body: t.body,
          psychologyPrinciple: t.psychologyPrinciple,
          estimatedClickRate: t.estimatedClickRate,
          sendDelayMinutes: 5,
          version: 1,
          isSystemTemplate: true,
        })),
      });
    }

    return NextResponse.json({
      templates: templates.map((t: any) => ({
        ...t,
        isSystemTemplate: false,
      })),
    });
  } catch (error) {
    logger.error(`[LensTemplates GET] Error: ${error}`);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let ctx;
    try {
      ctx = await getAuthContext();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: TemplateCreateRequest = await request.json();
    const { organizationId, lensType, templateType, day, title, body: templateBody, psychologyPrinciple, estimatedClickRate, sendDelayMinutes } = body;

    if (organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // 기존 템플릿 조회
    const existing = await prisma.lensTemplate.findFirst({
      where: {
        organizationId,
        lensType,
        templateType,
        day,
      },
    });

    const template = existing
      ? await prisma.lensTemplate.update({
          where: { id: existing.id },
          data: {
            title,
            body: templateBody,
            psychologyPrinciple,
            expectedClickRate: estimatedClickRate || 0.5,
            sendDelayMinutes: sendDelayMinutes || 5,
          },
        })
      : await prisma.lensTemplate.create({
          data: {
            organizationId,
            lensType,
            templateType,
            day,
            title,
            body: templateBody,
            psychologyPrinciple,
            expectedClickRate: estimatedClickRate || 0.5,
            sendDelayMinutes: sendDelayMinutes || 5,
            version: 1,
          },
        });

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        isSystemTemplate: false,
      },
    });
  } catch (error) {
    logger.error(`[LensTemplates POST] Error: ${error}`);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
