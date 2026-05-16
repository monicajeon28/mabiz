export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';

/**
 * GET /api/partner/dashboard/b2c/detail?type=sales|reservations|passport-pending|passport-complete&month=2026-05&page=1
 * B2C 드릴다운: 전체 판매 / 예약 / 여권PNR현황 / 여권PNR완료 (페이징)
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'sales';
    const monthParam = searchParams.get('month');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
    const limit = 30;

    const now = new Date();
    const [year, month] = monthParam
      ? monthParam.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const isAdmin = ctx.sessionUser.role === 'admin';
    // 보안: ADMIN도 자신의 조직 범위 내에서만 조회 가능. 조직 ID 제한은 필수
    const orgFilter = { organizationId: ctx.organizationId! };

    if (type === 'sales') {
      const [rows, total] = await Promise.all([
        prisma.affiliateSale.findMany({
          where: { ...orgFilter, createdAt: { gte: startDate, lt: endDate } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.affiliateSale.count({
          where: { ...orgFilter, createdAt: { gte: startDate, lt: endDate } },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        data: {
          items: rows.map((s) => ({
            id: s.id,
            productName: s.productName ?? '-',
            amount: s.saleAmount,
            commission: s.commissionAmount ?? 0,
            status: s.status ?? 'PENDING',
            date: s.createdAt.toISOString().slice(0, 10),
            orderId: s.orderId,
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    if (type === 'passport-pending') {
      // 여권/PNR 현황 (대기 중): passportStatus != 'ISSUED' OR pnrStatus != 'CONFIRMED'
      if (isAdmin) {
        const [rows, total] = await Promise.all([
          prisma.$queryRaw<Array<{
            id: string; name: string | null; passportStatus: string; pnrStatus: string;
            assignedName: string | null; commissionAmount: number | null; commissionRate: number | null;
            finalConfirmStatus: string; createdAt: Date;
          }>>`
            SELECT r."id", u."name", r."passportStatus", r."pnrStatus",
                   om."displayName" AS "assignedName", a."commissionAmount", a."commissionRate",
                   r."finalConfirmStatus", r."createdAt"
            FROM "Reservation" r
            LEFT JOIN "User" u ON u."id" = r."mainUserId"
            LEFT JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            LEFT JOIN "OrganizationMember" om ON om."userId" = a."affiliateUserId" AND om."organizationId" = a."organizationId"
            WHERE (r."passportStatus" != 'ISSUED' OR r."pnrStatus" != 'CONFIRMED')
            ORDER BY r."createdAt" DESC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
          `,
          prisma.$queryRaw<[{ cnt: bigint }]>`
            SELECT COUNT(*)::bigint AS cnt FROM "Reservation" r
            WHERE (r."passportStatus" != 'ISSUED' OR r."pnrStatus" != 'CONFIRMED')
          `,
        ]);

        const totalCount = Number(total[0]?.cnt ?? 0);
        return NextResponse.json({
          ok: true,
          data: {
            items: rows.map((r) => ({
              id: r.id,
              customerName: r.name ?? '-',
              passportStatus: r.passportStatus ?? 'NONE',
              pnrStatus: r.pnrStatus ?? 'NONE',
              assignedName: r.assignedName ?? '-',
              commissionAmount: r.commissionAmount ?? 0,
              finalConfirmStatus: r.finalConfirmStatus ?? 'PENDING',
              date: r.createdAt.toISOString().slice(0, 10),
            })),
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
          },
        });
      } else {
        // OWNER: AffiliateSale 경유
        const [rows, totalResult] = await Promise.all([
          prisma.$queryRaw<Array<{
            id: string; name: string | null; passportStatus: string; pnrStatus: string;
            assignedName: string | null; commissionAmount: number | null; commissionRate: number | null;
            finalConfirmStatus: string; createdAt: Date;
          }>>`
            SELECT r."id", u."name", r."passportStatus", r."pnrStatus",
                   om."displayName" AS "assignedName", a."commissionAmount", a."commissionRate",
                   r."finalConfirmStatus", r."createdAt"
            FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            LEFT JOIN "User" u ON u."id" = r."mainUserId"
            LEFT JOIN "OrganizationMember" om ON om."userId" = a."affiliateUserId" AND om."organizationId" = a."organizationId"
            WHERE a."organizationId" = ${ctx.organizationId}
              AND (r."passportStatus" != 'ISSUED' OR r."pnrStatus" != 'CONFIRMED')
            ORDER BY r."createdAt" DESC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
          `,
          prisma.$queryRaw<[{ cnt: bigint }]>`
            SELECT COUNT(*)::bigint AS cnt FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            WHERE a."organizationId" = ${ctx.organizationId}
              AND (r."passportStatus" != 'ISSUED' OR r."pnrStatus" != 'CONFIRMED')
          `,
        ]);

        const totalCount = Number(totalResult[0]?.cnt ?? 0);
        return NextResponse.json({
          ok: true,
          data: {
            items: rows.map((r) => ({
              id: r.id,
              customerName: r.name ?? '-',
              passportStatus: r.passportStatus ?? 'NONE',
              pnrStatus: r.pnrStatus ?? 'NONE',
              assignedName: r.assignedName ?? '-',
              commissionAmount: r.commissionAmount ?? 0,
              finalConfirmStatus: r.finalConfirmStatus ?? 'PENDING',
              date: r.createdAt.toISOString().slice(0, 10),
            })),
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
          },
        });
      }
    }

    if (type === 'passport-complete') {
      // 여권/PNR 완료: passportStatus = 'ISSUED' AND pnrStatus = 'CONFIRMED'
      if (isAdmin) {
        const [rows, total] = await Promise.all([
          prisma.$queryRaw<Array<{
            id: string; name: string | null; passportStatus: string; pnrStatus: string;
            assignedName: string | null; commissionAmount: number | null; commissionRate: number | null;
            finalConfirmStatus: string; createdAt: Date;
          }>>`
            SELECT r."id", u."name", r."passportStatus", r."pnrStatus",
                   om."displayName" AS "assignedName", a."commissionAmount", a."commissionRate",
                   r."finalConfirmStatus", r."createdAt"
            FROM "Reservation" r
            LEFT JOIN "User" u ON u."id" = r."mainUserId"
            LEFT JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            LEFT JOIN "OrganizationMember" om ON om."userId" = a."affiliateUserId" AND om."organizationId" = a."organizationId"
            WHERE r."passportStatus" = 'ISSUED' AND r."pnrStatus" = 'CONFIRMED'
              AND r."createdAt" >= ${startDate} AND r."createdAt" < ${endDate}
            ORDER BY r."createdAt" DESC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
          `,
          prisma.$queryRaw<[{ cnt: bigint }]>`
            SELECT COUNT(*)::bigint AS cnt FROM "Reservation" r
            WHERE r."passportStatus" = 'ISSUED' AND r."pnrStatus" = 'CONFIRMED'
              AND r."createdAt" >= ${startDate} AND r."createdAt" < ${endDate}
          `,
        ]);

        const totalCount = Number(total[0]?.cnt ?? 0);
        return NextResponse.json({
          ok: true,
          data: {
            items: rows.map((r) => ({
              id: r.id,
              customerName: r.name ?? '-',
              passportStatus: r.passportStatus ?? 'NONE',
              pnrStatus: r.pnrStatus ?? 'NONE',
              assignedName: r.assignedName ?? '-',
              commissionAmount: r.commissionAmount ?? 0,
              finalConfirmStatus: r.finalConfirmStatus ?? 'PENDING',
              date: r.createdAt.toISOString().slice(0, 10),
            })),
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
          },
        });
      } else {
        // OWNER: AffiliateSale 경유
        const [rows, totalResult] = await Promise.all([
          prisma.$queryRaw<Array<{
            id: string; name: string | null; passportStatus: string; pnrStatus: string;
            assignedName: string | null; commissionAmount: number | null; commissionRate: number | null;
            finalConfirmStatus: string; createdAt: Date;
          }>>`
            SELECT r."id", u."name", r."passportStatus", r."pnrStatus",
                   om."displayName" AS "assignedName", a."commissionAmount", a."commissionRate",
                   r."finalConfirmStatus", r."createdAt"
            FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            LEFT JOIN "User" u ON u."id" = r."mainUserId"
            LEFT JOIN "OrganizationMember" om ON om."userId" = a."affiliateUserId" AND om."organizationId" = a."organizationId"
            WHERE a."organizationId" = ${ctx.organizationId}
              AND r."passportStatus" = 'ISSUED' AND r."pnrStatus" = 'CONFIRMED'
              AND r."createdAt" >= ${startDate} AND r."createdAt" < ${endDate}
            ORDER BY r."createdAt" DESC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
          `,
          prisma.$queryRaw<[{ cnt: bigint }]>`
            SELECT COUNT(*)::bigint AS cnt FROM "Reservation" r
            INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
            WHERE a."organizationId" = ${ctx.organizationId}
              AND r."passportStatus" = 'ISSUED' AND r."pnrStatus" = 'CONFIRMED'
              AND r."createdAt" >= ${startDate} AND r."createdAt" < ${endDate}
          `,
        ]);

        const totalCount = Number(totalResult[0]?.cnt ?? 0);
        return NextResponse.json({
          ok: true,
          data: {
            items: rows.map((r) => ({
              id: r.id,
              customerName: r.name ?? '-',
              passportStatus: r.passportStatus ?? 'NONE',
              pnrStatus: r.pnrStatus ?? 'NONE',
              assignedName: r.assignedName ?? '-',
              commissionAmount: r.commissionAmount ?? 0,
              finalConfirmStatus: r.finalConfirmStatus ?? 'PENDING',
              date: r.createdAt.toISOString().slice(0, 10),
            })),
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
          },
        });
      }
    }

    if (type === 'reservations') {
      // 예약 목록: AffiliateSale 경유 → Reservation JOIN
      if (isAdmin) {
        const [rows, total] = await Promise.all([
          prisma.$queryRaw<Array<{
            id: string; name: string | null; productName: string | null;
            passportStatus: string; pnrStatus: string;
            departureDate: Date | null; createdAt: Date;
          }>>`
            SELECT r."id", u."name", t."title" AS "productName",
                   r."passportStatus", r."pnrStatus",
                   t."departureDate", r."createdAt"
            FROM "Reservation" r
            LEFT JOIN "User" u ON u."id" = r."mainUserId"
            LEFT JOIN "Trip" t ON t."id" = r."tripId"
            WHERE r."createdAt" >= ${startDate} AND r."createdAt" < ${endDate}
            ORDER BY r."createdAt" DESC
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
          `,
          prisma.gmReservation.count({
            where: { createdAt: { gte: startDate, lt: endDate } },
          }),
        ]);

        return NextResponse.json({
          ok: true,
          data: {
            items: rows.map((r) => ({
              id: r.id,
              customerName: r.name ?? '-',
              productName: r.productName ?? '-',
              passportStatus: r.passportStatus ?? 'NONE',
              pnrStatus: r.pnrStatus ?? 'NONE',
              departureDate: r.departureDate?.toISOString().slice(0, 10) ?? '-',
              date: r.createdAt.toISOString().slice(0, 10),
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
          },
        });
      } else {
        // OWNER: AffiliateSale 경유
        const rows = await prisma.$queryRaw<Array<{
          id: string; name: string | null; productName: string | null;
          passportStatus: string; pnrStatus: string;
          departureDate: Date | null; createdAt: Date;
        }>>`
          SELECT r."id", u."name", t."title" AS "productName",
                 r."passportStatus", r."pnrStatus",
                 t."departureDate", r."createdAt"
          FROM "Reservation" r
          INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
          LEFT JOIN "User" u ON u."id" = r."mainUserId"
          LEFT JOIN "Trip" t ON t."id" = r."tripId"
          WHERE a."organizationId" = ${ctx.organizationId}
            AND r."createdAt" >= ${startDate} AND r."createdAt" < ${endDate}
          ORDER BY r."createdAt" DESC
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `;

        const countResult = await prisma.$queryRaw<[{ cnt: bigint }]>`
          SELECT COUNT(*)::bigint AS cnt
          FROM "Reservation" r
          INNER JOIN "CrmAffiliateSale" a ON a."orderId" = CAST(r."affiliateSaleId" AS TEXT)
          WHERE a."organizationId" = ${ctx.organizationId}
            AND r."createdAt" >= ${startDate} AND r."createdAt" < ${endDate}
        `;
        const total = Number(countResult[0]?.cnt ?? 0);

        return NextResponse.json({
          ok: true,
          data: {
            items: rows.map((r) => ({
              id: r.id,
              customerName: r.name ?? '-',
              productName: r.productName ?? '-',
              passportStatus: r.passportStatus ?? 'NONE',
              pnrStatus: r.pnrStatus ?? 'NONE',
              departureDate: r.departureDate?.toISOString().slice(0, 10) ?? '-',
              date: r.createdAt.toISOString().slice(0, 10),
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
          },
        });
      }
    }

    return NextResponse.json({ ok: false, error: '유효하지 않은 type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
