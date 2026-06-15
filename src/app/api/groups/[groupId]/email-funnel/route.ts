/**
 * Group Email Funnel API
 * - GET: 그룹의 이메일 퍼널 + 메시지 조회
 * - POST: 이메일 퍼널 생성 또는 업데이트 (upsert)
 * - DELETE: 퍼널 비활성화
 *
 * 인증: getAuthContext() from @/lib/rbac
 * 2026-06-16
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// ─── PASONA 단계 매핑 ───────────────────────────────────────────────────────

const DAY_TO_PASONA: Record<number, string> = {
  0: "PROBLEM",
  1: "SOLUTION",
  2: "OFFER",
  3: "ACTION",
};

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface MessageInput {
  day: number;
  subject: string;
  bodyHtml: string;
  previewText?: string;
}

// ============================================================================
// GET: 이메일 퍼널 조회
// ============================================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = params;

    // 그룹 존재 확인
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId },
    });
    if (!group) {
      return NextResponse.json({ error: "그룹을 찾을 수 없습니다." }, { status: 404 });
    }

    const funnel = await prisma.groupEmailFunnel.findFirst({
      where: { groupId, organizationId: ctx.organizationId },
      include: {
        messages: {
          orderBy: [{ day: "asc" }, { order: "asc" }],
          select: {
            id: true,
            day: true,
            pasonaStage: true,
            subject: true,
            bodyHtml: true,
            previewText: true,
            order: true,
          },
        },
      },
    });

    if (!funnel) {
      return NextResponse.json({ ok: true, funnel: null });
    }

    return NextResponse.json({ ok: true, funnel });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("[EmailFunnel:GET] 오류", { err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// POST: 이메일 퍼널 생성/업데이트
// ============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = params;
    const body = await req.json() as {
      title?: string;
      isActive?: boolean;
      messages?: MessageInput[];
    };

    const { title = "기본 이메일 퍼널", isActive = true, messages = [] } = body;

    // 입력 검증
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "메시지를 최소 1개 이상 입력해주세요." },
        { status: 400 }
      );
    }

    for (const msg of messages) {
      if (typeof msg.day !== "number" || msg.day < 0) {
        return NextResponse.json(
          { error: `메시지 day 값이 올바르지 않습니다: ${msg.day}` },
          { status: 400 }
        );
      }
      if (!msg.subject?.trim()) {
        return NextResponse.json(
          { error: `Day ${msg.day} 메시지의 제목을 입력해주세요.` },
          { status: 400 }
        );
      }
      if (!msg.bodyHtml?.trim()) {
        return NextResponse.json(
          { error: `Day ${msg.day} 메시지의 내용을 입력해주세요.` },
          { status: 400 }
        );
      }
    }

    // 그룹 존재 확인
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: ctx.organizationId },
    });
    if (!group) {
      return NextResponse.json({ error: "그룹을 찾을 수 없습니다." }, { status: 404 });
    }

    // 기존 퍼널 확인
    const existing = await prisma.groupEmailFunnel.findFirst({
      where: { groupId, organizationId: ctx.organizationId },
    });

    let funnel;

    if (existing) {
      // 기존 메시지 삭제 후 재생성
      funnel = await prisma.$transaction(async (tx) => {
        await tx.groupEmailFunnelMessage.deleteMany({
          where: { emailFunnelId: existing.id },
        });

        return tx.groupEmailFunnel.update({
          where: { id: existing.id },
          data: {
            title,
            isActive,
            updatedAt: new Date(),
            messages: {
              create: messages.map((m, idx) => ({
                organizationId: ctx.organizationId!,
                day: m.day,
                order: idx,
                pasonaStage: DAY_TO_PASONA[m.day] ?? "PROBLEM",
                subject: m.subject.trim(),
                bodyHtml: m.bodyHtml.trim(),
                previewText: m.previewText?.trim() ?? "",
              })),
            },
          },
          include: {
            messages: {
              orderBy: [{ day: "asc" }, { order: "asc" }],
            },
          },
        });
      });
    } else {
      // 이메일 설정 확인 (신규 생성 시 필수)
      const emailConfig = await prisma.groupEmailConfig.findUnique({
        where: { groupId },
      });
      if (!emailConfig) {
        return NextResponse.json(
          {
            error:
              "이메일 설정이 없습니다. 먼저 이메일 계정을 연결하세요.",
          },
          { status: 400 }
        );
      }

      funnel = await prisma.groupEmailFunnel.create({
        data: {
          organizationId: ctx.organizationId,
          groupId,
          emailConfigId: emailConfig.id,
          title,
          isActive,
          createdByUserId: ctx.userId,
          messages: {
            create: messages.map((m, idx) => ({
              organizationId: ctx.organizationId!,
              day: m.day,
              order: idx,
              pasonaStage: DAY_TO_PASONA[m.day] ?? "PROBLEM",
              subject: m.subject.trim(),
              bodyHtml: m.bodyHtml.trim(),
              previewText: m.previewText?.trim() ?? "",
            })),
          },
        },
        include: {
          messages: {
            orderBy: [{ day: "asc" }, { order: "asc" }],
          },
        },
      });
    }

    logger.log("[EmailFunnel:POST] 저장 완료", { groupId, funnelId: funnel.id });

    return NextResponse.json({ ok: true, funnel });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("[EmailFunnel:POST] 오류", { err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// DELETE: 퍼널 비활성화
// ============================================================================

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = params;

    const funnel = await prisma.groupEmailFunnel.findFirst({
      where: { groupId, organizationId: ctx.organizationId },
    });

    if (!funnel) {
      return NextResponse.json({ error: "퍼널을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.groupEmailFunnel.update({
      where: { id: funnel.id },
      data: { isActive: false },
    });

    logger.log("[EmailFunnel:DELETE] 비활성화 완료", { groupId, funnelId: funnel.id });

    return NextResponse.json({ ok: true, message: "이메일 퍼널이 비활성화됐습니다." });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("[EmailFunnel:DELETE] 오류", { err });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
