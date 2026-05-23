import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkBotGuard } from "@/lib/bot-guard";
import { checkOrigin } from "@/lib/origin-guard";

type Params = { params: Promise<{ orgSlug: string }> };

/**
 * POST /api/public/b2b/[orgSlug]
 * 공개 B2B 랜딩 등록 (인증 불필요)
 * 파트너 링크: https://mabizcruisedot.com/b2b/[orgSlug]
 */
export async function POST(req: Request, { params }: Params) {
  try {
    if (!checkOrigin(req, 'B2BRegister')) {
      return NextResponse.json({ ok: false, message: '허용되지 않은 요청입니다.' }, { status: 403 });
    }

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

    const notesLines = [
      body.companyName      ? `회사명: ${body.companyName}`              : null,
      body.groupSize        ? `인원수: ${body.groupSize}`                 : null,
      body.packageInterest  ? `관심상품: ${body.packageInterest}`        : null,
      body.preferredDate    ? `희망날짜: ${body.preferredDate}`           : null,
      body.destination      ? `목적지: ${body.destination}`               : null,
      body.affiliateCode    ? `추천코드: ${body.affiliateCode}`           : null,
      `유입경로: B2B_LANDING`,
    ].filter(Boolean).join('\n');

    const prospect = await prisma.b2BProspect.create({
      data: {
        organizationId: org.id,
        name:           body.name.trim(),
        phone,
        email:          body.email ?? null,
        eduType:        "INQUIRER",
        notes:          notesLines,
        status:         "NEW",
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
