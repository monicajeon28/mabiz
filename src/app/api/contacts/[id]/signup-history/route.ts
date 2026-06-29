import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, buildContactWhere, resolveOrgId } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone-normalize";

type Params = { params: Promise<{ id: string }> };

// 안전한 일수 계산 (잘못된 날짜면 null)
function daysSince(value: unknown): number | null {
  if (!value) return null;
  const t = new Date(value as string).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

// GET /api/contacts/[id]/signup-history
// 신청 이력 + 출처/기기 상세 조회
// - signupHistory(JSON)에는 ip/userAgent/deviceType/referer 스냅샷이 들어있음(신규 신청분)
// - 과거 신청분·상품명·유입경로(utm)는 CrmLandingRegistration(정본)에서 보강 조인
//   조인 키: (전화번호 정규화 + landingPageId, 단 같은 조직 랜딩만) — IDOR/크로스조직 차단
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // 권한 검사 먼저 — FREE_SALES 차단 (IP 등 민감정보는 권한자에게만)
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const where = buildContactWhere(ctx, { id });
    const contact = await prisma.contact.findFirst({
      where,
      select: {
        id: true,
        organizationId: true,
        phone: true,
        signupCount: true,
        signupHistory: true,
        productName: true,
        utmSource: true,
      },
    });

    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // signupHistory는 Json 타입이므로 배열로 변환
    const history: any[] = Array.isArray(contact.signupHistory)
      ? (contact.signupHistory as any[])
      : (typeof contact.signupHistory === 'string'
          ? (() => { try { return JSON.parse(contact.signupHistory as string) as any[]; } catch { return []; } })()
          : []);

    // CrmLandingRegistration(정본) 보강 조회 — 같은 조직 랜딩 + 동일 전화번호만
    const normalizedPhone = normalizePhone(contact.phone);
    const historyPageIds = Array.from(
      new Set(history.map((h) => h?.landingPageId).filter((v): v is string => typeof v === 'string'))
    );
    let regs: {
      landingPageId: string;
      ipAddress: string | null;
      userAgent: string | null;
      deviceType: string | null;
      referer: string | null;
      utmSource: string | null;
      createdAt: Date;
      landingPage: { title: string; productName: string | null } | null;
    }[] = [];
    try {
      regs = await prisma.crmLandingRegistration.findMany({
        where: {
          phone: normalizedPhone,
          landingPage: { organizationId: contact.organizationId },
          ...(historyPageIds.length > 0 ? { landingPageId: { in: historyPageIds } } : {}),
        },
        select: {
          landingPageId: true,
          ipAddress: true,
          userAgent: true,
          deviceType: true,
          referer: true,
          utmSource: true,
          createdAt: true,
          landingPage: { select: { title: true, productName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch (joinErr) {
      // 보강 조회 실패해도 기본 이력은 반환 (페이지가 깨지지 않도록)
      logger.warn("[signup-history] CrmLandingRegistration 보강 조회 실패", {
        err: joinErr instanceof Error ? joinErr.message : String(joinErr),
      });
      regs = [];
    }
    // landingPageId당 신청 레코드는 유니크(landingPageId+phone)라 1건 → Map 매칭
    const regByPage = new Map(regs.map((r) => [r.landingPageId, r]));

    // 각 신청 이력에 출처/기기/상품/유입경로 보강 (JSON 스냅샷 우선, 없으면 정본에서 채움)
    let merged = history.map((item: any) => {
      const reg = item?.landingPageId ? regByPage.get(item.landingPageId) : undefined;
      return {
        ...item,
        landingPageTitle: item.landingPageTitle ?? reg?.landingPage?.title ?? null,
        productName: item.productName ?? reg?.landingPage?.productName ?? contact.productName ?? null,
        ip: item.ip ?? reg?.ipAddress ?? null,
        userAgent: item.userAgent ?? reg?.userAgent ?? null,
        deviceType: item.deviceType ?? reg?.deviceType ?? null,
        referer: item.referer ?? reg?.referer ?? null,
        utmSource: item.utmSource ?? reg?.utmSource ?? contact.utmSource ?? null,
        daysSinceLanding: daysSince(item.createdAt),
      };
    });

    // signupHistory(JSON)가 비어있지만 랜딩 신청 레코드가 있으면 그걸로 이력 구성
    if (merged.length === 0 && regs.length > 0) {
      const asc = [...regs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      merged = asc.map((r, i) => ({
        index: i + 1,
        landingPageId: r.landingPageId,
        landingPageTitle: r.landingPage?.title ?? null,
        productName: r.landingPage?.productName ?? contact.productName ?? null,
        groupId: null,
        groupName: null,
        createdAt: r.createdAt.toISOString(),
        email: null,
        phone: normalizedPhone,
        ip: r.ipAddress ?? null,
        userAgent: r.userAgent ?? null,
        deviceType: r.deviceType ?? null,
        referer: r.referer ?? null,
        utmSource: r.utmSource ?? contact.utmSource ?? null,
        daysSinceLanding: daysSince(r.createdAt),
      }));
    }

    return NextResponse.json({
      ok: true,
      contactId: id,
      signupCount: contact.signupCount,
      history: merged,
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