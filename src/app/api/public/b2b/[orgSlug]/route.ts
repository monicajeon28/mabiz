import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkBotGuard } from "@/lib/bot-guard";

type Params = { params: Promise<{ orgSlug: string }> };

/**
 * POST /api/public/b2b/[orgSlug]
 * 공개 B2B 랜딩 등록 (인증 불필요)
 * 파트너 링크: https://mabiz.cruisedot.co.kr/b2b/[orgSlug]
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { orgSlug } = await params;

    // 조직 확인
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true, name: true },
    });
    if (!org) {
      return NextResponse.json({ ok: false, message: "유효하지 않은 링크입니다." }, { status: 404 });
    }

    const body = await req.json() as {
      name?: string; phone?: string; email?: string;
      companyName?: string; groupSize?: number;
      packageInterest?: string; preferredDate?: string;
      destination?: string; affiliateCode?: string;
      website?: string; hp?: string; loadedAt?: number;
    };

    if (!checkBotGuard(body as Record<string, unknown>, 'B2BRegister')) {
      return NextResponse.json({ ok: true }); // 조용한 차단
    }

    if (!body.name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ ok: false, message: "이름과 전화번호는 필수입니다." }, { status: 400 });
    }

    // 전화번호 정규화
    const phone = body.phone.replace(/[^0-9]/g, "")
      .replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");

    const prospect = await prisma.b2BProspect.create({
      data: {
        organizationId:  org.id,
        name:            body.name.trim(),
        phone,
        email:           body.email           ?? null,
        companyName:     body.companyName      ?? null,
        groupSize:       body.groupSize        ?? null,
        packageInterest: body.packageInterest  ?? null,
        preferredDate:   body.preferredDate    ?? null,
        destination:     body.destination      ?? null,
        affiliateCode:   body.affiliateCode    ?? null,
        source:          "B2B_LANDING",
        status:          "NEW",
      },
      select: { id: true },
    });

    logger.log("[POST /api/public/b2b/[orgSlug]] B2B 잠재고객 등록", {
      orgSlug, orgName: org.name,
      phone: phone.substring(0, 4) + "***",
      packageInterest: body.packageInterest,
    });

    return NextResponse.json({ ok: true, prospectId: prospect.id });
  } catch (err) {
    logger.error("[POST /api/public/b2b/[orgSlug]]", { err });
    return NextResponse.json({ ok: false, message: "등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}
