import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { formatKSTDate, formatKSTDateCompact } from "@/lib/utils/dateUtils";

// GET /api/contacts/export?type=LEAD
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const where = buildContactWhere(ctx, {
      ...(type ? { type } : {}),
    });

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
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

    const wb   = XLSX.utils.book_new();
    const ws   = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "고객목록");

    const buf      = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `고객목록_${formatKSTDateCompact(new Date())}.xlsx`;

    logger.log("[GET /api/contacts/export]", { count: contacts.length });

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
