import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, buildContactWhere, resolveOrgId } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/signup-history
// 신청 이력 상세 조회
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // 권한 검사 먼저 — FREE_SALES 차단
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({
      where,
      select: {
        id: true,
        organizationId: true,
        signupCount: true,
        signupHistory: true,
      },
    });

    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // signupHistory는 Json 타입이므로 배열로 변환
    const history = (contact.signupHistory as any[]) || [];

    return NextResponse.json({
      ok: true,
      contactId: id,
      signupCount: contact.signupCount,
      history: history.map((item: any, idx: number) => ({
        ...item,
        daysSinceLanding: Math.floor(
          (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/signup-history]", { err });
    return NextResponse.json(
      { ok: false },
      { status: 500 }
    );
  }
}

// POST /api/contacts/[id]/signup-history
// 신청 이력 추가 (재신청 시 호출)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const body = await req.json();

    // 권한 검사
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const where = buildContactWhere(ctx, { id });

    // 기존 Contact 조회
    const contact = await prisma.contact.findFirst({
      where,
      select: {
        id: true,
        organizationId: true,
        signupCount: true,
        signupHistory: true,
        email: true,
        phone: true,
        name: true,
      },
    });

    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // 조직 ID 권한 재검증
    if (contact.organizationId !== resolveOrgId(ctx)) {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다' },
        { status: 403 }
      );
    }

    // 신청 이력 추가
    const currentHistory = (contact.signupHistory as any[]) || [];
    const nextIndex = contact.signupCount + 1;

    const newEntry = {
      index: nextIndex,
      landingPageId: body.landingPageId || null,
      landingPageTitle: body.landingPageTitle || null,
      groupId: body.groupId || null,
      groupName: body.groupName || null,
      createdAt: new Date().toISOString(),
      email: contact.email,
      phone: contact.phone,
    };

    const updatedHistory = [...currentHistory, newEntry];

    // Contact 업데이트: signupCount + signupHistory
    const updated = await prisma.contact.update({
      where: { id },
      data: {
        signupCount: nextIndex,
        signupHistory: updatedHistory,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        signupCount: true,
        signupHistory: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "신청 이력 추가 완료",
      contact: {
        ...updated,
        signupHistory: updated.signupHistory || [],
      },
    });
  } catch (err) {
    logger.error("[POST /api/contacts/[id]/signup-history]", { err });
    return NextResponse.json(
      { ok: false },
      { status: 500 }
    );
  }
}