export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { formatKSTDate, formatKSTDateCompact } from "@/lib/utils/dateUtils";

// GET /api/contacts/export?type=LEAD
// GET /api/contacts/export?groupId=xxx
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const type    = searchParams.get("type");
    const groupId = searchParams.get("groupId");
    let groupName: string | null = null;

    // groupId 보안 검증 — 타 조직 접근 차단
    if (groupId) {
      const orgId = ctx.organizationId;
      if (!orgId) return NextResponse.json({ ok: false }, { status: 403 });

      const group = await prisma.contactGroup.findFirst({
        where: { id: groupId, organizationId: orgId },
        select: { name: true },
      });
      if (!group) {
        return NextResponse.json({ ok: false, message: "그룹을 찾을 수 없습니다." }, { status: 404 });
      }
      groupName = group.name;
    }

    const where = buildContactWhere(ctx, {
      ...(type    ? { type }                           : {}),
      ...(groupId ? { groups: { some: { groupId } } } : {}),
    });

    const MAX_EXPORT_ROWS = 10_000;
    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
      select: {
        name: true, phone: true, email: true,
        type: true, cruiseInterest: true, budgetRange: true,
        adminMemo: true, lastContactedAt: true, purchasedAt: true,
        createdAt: true,
      },
    });

    const TYPE_KO: Record<string, string> = {
      LEAD: "잠재고객", CUSTOMER: "구매완료", UNSUBSCRIBED: "수신거부",
    };
    const BUDGET_KO: Record<string, string> = {
      ECONOMY: "100만원 이하", STANDARD: "100~300만원", PREMIUM: "300만원 이상",
    };

    const rows = contacts.map((c) => ({
      이름:        c.name,
      전화번호:    c.phone,
      이메일:      c.email ?? "",
      유형:        TYPE_KO[c.type] ?? c.type,
      관심크루즈:  c.cruiseInterest ?? "",
      예산:        BUDGET_KO[c.budgetRange ?? ""] ?? "",
      메모:        c.adminMemo ?? "",
      마지막연락:  c.lastContactedAt ? formatKSTDate(c.lastContactedAt) : "",
      구매일:      c.purchasedAt    ? formatKSTDate(c.purchasedAt)    : "",
      등록일:      formatKSTDate(c.createdAt),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "고객목록");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const suffix = groupName
      ? `_${groupName}`
      : type === 'LEAD'     ? '_잠재고객'
      : type === 'CUSTOMER' ? '_구매완료'
      : '';
    const fileName = `고객목록${suffix}_${formatKSTDateCompact(new Date())}.xlsx`;

    logger.log("[GET /api/contacts/export]", { count: contacts.length, type, groupId });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (err) {
    logger.error("[GET /api/contacts/export]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
