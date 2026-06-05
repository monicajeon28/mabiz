/**
 * POST /api/email/funnel — Day 0-3 이메일 퍼널 시작
 * GET  /api/email/funnel — 등록된 퍼널 이메일 조회
 * DELETE /api/email/funnel?contactId=xxx — 퍼널 취소
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import {
  scheduleDay0To3Funnel,
  cancelFunnelEmails,
  type FunnelEmailScheduleParams,
} from "@/lib/email/funnel-scheduler";

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = (await req.json()) as {
      contactId: string;
      contactName?: string;
      contactEmail?: string;
      consultantName?: string;
      consultationType?: string;
      recommendedTier?: "basic" | "standard" | "premium";
      products?: { basic: string; standard: string; premium: string };
      successStories?: { person: string; result: string; duration: string }[];
      seatsRemaining?: number;
      discountPercent?: number;
      originalPrice?: string;
      discountedPrice?: string;
      crmUrl?: string;
    };

    if (!body.contactId) {
      return NextResponse.json(
        { ok: false, message: "contactId 필수" },
        { status: 400 }
      );
    }

    // Contact 조회 (Email이 없으면 가져오기)
    const contact = await prisma.contact.findFirst({
      where: { id: body.contactId, organizationId: orgId },
      select: { id: true, name: true, email: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: "Contact를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (!contact.email) {
      return NextResponse.json(
        { ok: false, message: "Contact에 이메일이 등록되어 있지 않습니다" },
        { status: 400 }
      );
    }

    const params: FunnelEmailScheduleParams = {
      organizationId: orgId,
      contactId: contact.id,
      contactName: body.contactName || contact.name || "고객님",
      contactEmail: contact.email,
      consultantName: body.consultantName,
      consultationType: body.consultationType,
      recommendedTier: body.recommendedTier,
      products: body.products,
      successStories: body.successStories,
      seatsRemaining: body.seatsRemaining,
      discountPercent: body.discountPercent,
      originalPrice: body.originalPrice,
      discountedPrice: body.discountedPrice,
      crmUrl: body.crmUrl,
      createdByUserId: ctx.userId ?? undefined,
    };

    const result = await scheduleDay0To3Funnel(params);

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    logger.log("[POST /api/email/funnel] 퍼널 등록 완료", {
      orgId,
      contactId: contact.id,
      scheduledCount: result.scheduledIds?.length ?? 0,
    });

    return NextResponse.json(
      {
        ok: true,
        message: result.message,
        scheduledIds: result.scheduledIds,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("[POST /api/email/funnel]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");

    let where: any = { organizationId: orgId };
    if (contactId) {
      where.contactId = contactId;
    }

    const funnelEmails = await prisma.scheduledEmail.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      take: 100,
      select: {
        id: true,
        contactId: true,
        subject: true,
        scheduledAt: true,
        status: true,
        failureReason: true,
      },
    });

    return NextResponse.json({ ok: true, funnelEmails });
  } catch (err) {
    logger.error("[GET /api/email/funnel]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");
    const reason = (searchParams.get("reason") ||
      "MANUAL") as "PURCHASED" | "UNSUBSCRIBED" | "MANUAL";

    if (!contactId) {
      return NextResponse.json(
        { ok: false, message: "contactId 필수" },
        { status: 400 }
      );
    }

    const result = await cancelFunnelEmails(orgId, contactId, reason);

    if (!result.ok) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    logger.log("[DELETE /api/email/funnel] 퍼널 취소", {
      orgId,
      contactId,
      cancelledCount: result.cancelledCount,
      reason,
    });

    return NextResponse.json({
      ok: true,
      message: `${result.cancelledCount}개의 퍼널 이메일이 취소되었습니다`,
      cancelledCount: result.cancelledCount,
    });
  } catch (err) {
    logger.error("[DELETE /api/email/funnel]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
