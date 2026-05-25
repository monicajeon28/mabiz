import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/tools/bot-guide-answers/[key]
 * 특정 Q&A 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);

    const data = await prisma.botGuideAnswer.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        question: true,
        answer: true,
        category: true,
        type: true,
        source: true,
        salesTone: true,
        keywords: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!data) {
      return NextResponse.json(
        { ok: false, message: "데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    logger.error("[bot-guide-answers GET/:key]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: "조회 실패" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tools/bot-guide-answers/[key]
 * 특정 Q&A 수정
 *
 * Body: { question?, answer?, category?, type?, source?, salesTone?, keywords?, isActive? }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);
    const body = await req.json();

    // 기존 데이터 확인
    const existing = await prisma.botGuideAnswer.findUnique({
      where: { key },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: "데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 업데이트할 필드만 추출
    const updateData: any = {};
    if (body.question !== undefined) updateData.question = body.question;
    if (body.answer !== undefined) updateData.answer = body.answer;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.source !== undefined) updateData.source = body.source;
    if (body.salesTone !== undefined) updateData.salesTone = body.salesTone;
    if (body.keywords !== undefined) updateData.keywords = body.keywords;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    updateData.updatedAt = new Date();

    const updated = await prisma.botGuideAnswer.update({
      where: { key },
      data: updateData,
      select: {
        id: true,
        key: true,
        question: true,
        answer: true,
        category: true,
        type: true,
        source: true,
        salesTone: true,
        keywords: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "수정 완료",
      data: updated,
    });
  } catch (error) {
    logger.error("[bot-guide-answers PUT/:key]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: "수정 실패" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tools/bot-guide-answers/[key]
 * 특정 Q&A 삭제 (소프트 삭제: isActive = false)
 *
 * 쿼리 파라미터:
 * - hard?: "true" (하드 삭제, DB에서 완전 제거)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);
    const { searchParams } = new URL(req.url);
    const hardDelete = searchParams.get("hard") === "true";

    // 기존 데이터 확인
    const existing = await prisma.botGuideAnswer.findUnique({
      where: { key },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: "데이터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (hardDelete) {
      // 하드 삭제
      await prisma.botGuideAnswer.delete({ where: { key } });
      return NextResponse.json({
        ok: true,
        message: "완전 삭제 완료",
        deleted: true,
      });
    } else {
      // 소프트 삭제
      await prisma.botGuideAnswer.update({
        where: { key },
        data: { isActive: false, updatedAt: new Date() },
      });
      return NextResponse.json({
        ok: true,
        message: "삭제 완료 (소프트 삭제)",
        deleted: false,
        note: "hard=true 파라미터로 완전 삭제 가능",
      });
    }
  } catch (error) {
    logger.error("[bot-guide-answers DELETE/:key]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: "삭제 실패" },
      { status: 500 }
    );
  }
}
