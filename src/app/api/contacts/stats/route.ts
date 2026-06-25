import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthContext, buildContactWhere, type ContactScope } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

/**
 * GET /api/contacts/stats
 * 고객 타입별 카운트 통계 (전체/문의/구매/골드)
 *
 * Query:
 *   - scope=own|org|all         (P1-C 가시성 스코프; 권한 부족 시 자동 강등)
 *   - visibility=ADMIN_ONLY     (관리자 전용 보관함 카운트)
 *   - teamView=true             (구버전: OWNER 지사 전체 — scope=org와 동일)
 *
 * Response: { ok: true, stats: { total, inquiry, purchased, gold } }
 *
 * ⚠️ P1-D 버그 수정 (2026-06-25):
 *   기존엔 type을 "잠재고객"/"구매완료"/"금회원" 단일 문자열로만 셌으나
 *   실제 데이터는 LEAD/INQUIRY/잠재고객 · CUSTOMER/PURCHASED/구매완료 · GOLD 가 혼재.
 *   → type IN [...] 배열 + 골드는 vipStatus 병행으로 정확히 카운트.
 */
const INQUIRY_TYPES = ["LEAD", "INQUIRY", "잠재고객"];
const PURCHASED_TYPES = ["CUSTOMER", "PURCHASED", "구매완료"];

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);

    const visibility = searchParams.get("visibility");
    const teamView = searchParams.get("teamView") === "true";
    const scopeParam = (() => {
      const v = searchParams.get("scope");
      return v === "own" || v === "org" || v === "all" ? (v as ContactScope) : undefined;
    })();

    // 권한별 WHERE 조건 구성
    let baseWhere: Prisma.ContactWhereInput;

    if (visibility === "ADMIN_ONLY") {
      // 관리자 전용 보관함: GLOBAL_ADMIN만, 그 외엔 빈 통계
      if (ctx.role !== "GLOBAL_ADMIN") {
        return NextResponse.json({ ok: true, stats: { total: 0, inquiry: 0, purchased: 0, gold: 0 } });
      }
      baseWhere = { visibility: "ADMIN_ONLY", deletedAt: null };
    } else {
      // P1-C: 스코프 반영
      //   - scope 명시 → 그대로(권한 부족 시 rbac가 강등)
      //   - teamView(구버전) → org
      //   - 미지정 → 기본(역할별: AGENT=본인 / OWNER=조직 / ADMIN=전체)
      const effectiveScope: ContactScope | undefined = scopeParam ?? (teamView ? "org" : undefined);
      baseWhere = buildContactWhere(ctx, {}, effectiveScope) as Prisma.ContactWhereInput;
    }

    // 4개 타입별 COUNT를 병렬 조회
    const [total, inquiry, purchased, gold] = await prisma.$transaction([
      prisma.contact.count({ where: baseWhere }),
      prisma.contact.count({ where: { AND: [baseWhere, { type: { in: INQUIRY_TYPES } }] } }),
      prisma.contact.count({ where: { AND: [baseWhere, { type: { in: PURCHASED_TYPES } }] } }),
      prisma.contact.count({
        where: { AND: [baseWhere, { OR: [{ type: "GOLD" }, { vipStatus: "GOLD" }] }] },
      }),
    ]);

    logger.info("[Contacts/Stats] 카운트 조회", { total, inquiry, purchased, gold });

    return NextResponse.json({
      ok: true,
      stats: { total, inquiry, purchased, gold },
    });
  } catch (err) {
    logger.error("[Contacts/Stats]", { err });
    return NextResponse.json(
      { ok: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
