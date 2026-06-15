import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface FunnelSetupRequest {
  l1_enabled: boolean;
  l1_template: string;
  l3_enabled: boolean;
  l3_template: string;
  l10_enabled: boolean;
  l10_template: string;
}

/**
 * PATCH /api/contacts/[id]/funnel-setup
 * Russell Brunson Day 0-3 퍼널 설정 저장
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();

  if (!session?.userId) {
    return NextResponse.json({ ok: false, message: "인증 필요" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as FunnelSetupRequest;

    // Validate request
    if (
      typeof body.l1_enabled !== "boolean" ||
      typeof body.l3_enabled !== "boolean" ||
      typeof body.l10_enabled !== "boolean"
    ) {
      return NextResponse.json(
        { ok: false, message: "유효하지 않은 요청" },
        { status: 400 }
      );
    }

    // Check access
    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: "고객을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Verify user has access to this organization
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: contact.organizationId,
          userId: session.userId,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { ok: false, message: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // Store configuration in Contact.surveyData (JSON)
    const existing = await prisma.contact.findUnique({
      where: { id },
      select: { surveyData: true },
    });

    const existingSurveyData = (existing?.surveyData as Record<string, unknown>) || {};

    const updatedSurveyData = {
      ...existingSurveyData,
      funnelSetup: {
        l1: {
          enabled: body.l1_enabled,
          template: body.l1_template,
        },
        l3: {
          enabled: body.l3_enabled,
          template: body.l3_template,
        },
        l10: {
          enabled: body.l10_enabled,
          template: body.l10_template,
        },
        updatedAt: new Date().toISOString(),
        updatedBy: session.userId,
      },
    };

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: {
        surveyData: updatedSurveyData,
      },
      select: {
        id: true,
        name: true,
        surveyData: true,
      },
    });

    // Log this configuration change
    logger.info("[FunnelSetup] Configuration saved", {
      contactId: id,
      organizationId: contact.organizationId,
      userId: session.userId,
      config: body,
    });

    return NextResponse.json({
      ok: true,
      message: "퍼널 설정이 저장되었습니다.",
      contact: updatedContact,
    });
  } catch (error) {
    logger.error("[FunnelSetup] Error", { error, contactId: id });
    return NextResponse.json(
      { ok: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
