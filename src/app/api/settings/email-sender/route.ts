import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, canManageSettings, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/** GET /api/settings/email-sender — 이메일 발신자 이름 조회 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // GLOBAL_ADMIN: organizationId가 null → 빈 값 반환 (특정 org 컨텍스트 없음)
    if (!ctx.organizationId) {
      return NextResponse.json({ ok: true, senderName: "", senderEmail: "" });
    }

    const config = await prisma.orgEmailConfig.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { senderName: true, senderEmail: true },
    });

    return NextResponse.json({ ok: true, senderName: config?.senderName ?? "", senderEmail: config?.senderEmail ?? "" });
  } catch (err) {
    logger.error("[settings/email-sender] GET 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/email-sender
 * 이메일 발신자 이름(senderName)만 업데이트
 */
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (!canManageSettings(ctx)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    // GLOBAL_ADMIN은 body.organizationId로 대상 org를 명시하거나 BONSA_ORG_ID 사용
    const orgId = resolveOrgId(ctx);

    const body: { senderName?: string; organizationId?: string } = await req.json();
    const senderName = (body.senderName ?? "").trim();
    if (!senderName) {
      return NextResponse.json({ ok: false, error: "senderName은 필수입니다." }, { status: 400 });
    }
    // GLOBAL_ADMIN이 body에 organizationId를 넘기면 그것을 우선 사용
    const targetOrgId = (ctx.organizationId === null && body.organizationId)
      ? body.organizationId
      : orgId;

    await prisma.orgEmailConfig.upsert({
      where: { organizationId: targetOrgId },
      create: {
        organizationId: targetOrgId,
        senderName,
        senderEmail: "",
        smtpHost: "",
        smtpUser: "",
        smtpPassEncrypted: "",
      },
      update: { senderName },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[settings/email-sender] 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
