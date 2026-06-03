import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GLOBAL_ADMIN 작업 시 조직 ID 해결 순서:
 *   1. 환경변수 BONSA_ORG_ID
 *   2. DB에서 첫 번째 조직 조회 (환경변수 미설정 시 폴백)
 *
 * 하드코딩 없이 운영 환경별 값을 분리합니다.
 */
export async function resolveGlobalAdminOrgId(): Promise<string> {
  const envOrgId = process.env.BONSA_ORG_ID;
  if (envOrgId) return envOrgId;

  // 환경변수 미설정 시 DB에서 첫 번째(본사) 조직 조회
  const org = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!org) {
    throw new Error('[resolveGlobalAdminOrgId] 조직을 찾을 수 없습니다. BONSA_ORG_ID 환경변수를 설정하세요.');
  }

  logger.warn('[resolveGlobalAdminOrgId] BONSA_ORG_ID 미설정 — DB 첫 번째 조직 사용', { orgId: org.id });
  return org.id;
}

/**
 * 파트너 월별 통계 업데이트
 * 고객 수, 리드 수 집계
 */
export async function updatePartnerMetrics(
  partnerId: string,
  month: number,
  year: number
) {
  try {
    // 파트너 고객 통계 조회
    const metrics = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          COUNT(DISTINCT CASE WHEN type = 'CUSTOMER' THEN id END)::int as "customerCount",
          COUNT(DISTINCT CASE WHEN type = 'LEAD' THEN id END)::int as "leadCount"
        FROM "Contact"
        WHERE "partnerId" = ${partnerId}
          AND EXTRACT(YEAR FROM "createdAt") = ${year}
          AND EXTRACT(MONTH FROM "createdAt") = ${month}
          AND "deletedAt" IS NULL
      `
    );

    const { customerCount, leadCount } = metrics[0] || { customerCount: 0, leadCount: 0 };

    // PartnerMetrics upsert
    const result = await prisma.partnerMetrics.upsert({
      where: {
        partnerId_year_month: {
          partnerId,
          year,
          month,
        },
      },
      create: {
        partnerId,
        year,
        month,
        customerCount: customerCount || 0,
        leadCount: leadCount || 0,
        revenue: 0,
      },
      update: {
        customerCount: customerCount || 0,
        leadCount: leadCount || 0,
      },
    });

    logger.info('[updatePartnerMetrics]', {
      partnerId,
      year,
      month,
      customerCount,
      leadCount,
    });

    return result;
  } catch (err) {
    logger.error('[updatePartnerMetrics]', { err, partnerId, year, month });
    throw err;
  }
}

/**
 * 파트너 총 매출 업데이트 (누적)
 */
export async function updatePartnerTotalRevenue(partnerId: string) {
  try {
    const result = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT COALESCE(SUM("revenue"), 0)::bigint as "totalRevenue"
        FROM "PartnerMetrics"
        WHERE "partnerId" = ${partnerId}
      `
    );

    const totalRevenue = result[0]?.totalRevenue || 0;

    await prisma.partner.update({
      where: { id: partnerId },
      data: { totalRevenue },
    });

    logger.info('[updatePartnerTotalRevenue]', { partnerId, totalRevenue });

    return totalRevenue;
  } catch (err) {
    logger.error('[updatePartnerTotalRevenue]', { err, partnerId });
    throw err;
  }
}

/**
 * 조직 내 모든 파트너의 당월 통계 업데이트
 */
export async function updateAllPartnerMetricsForMonth(
  organizationId: string,
  month: number,
  year: number
) {
  try {
    const partners = await prisma.partner.findMany({
      where: { organizationId },
      select: { id: true },
    });

    const updates = partners.map((p) => updatePartnerMetrics(p.id, month, year));
    await Promise.all(updates);

    logger.info('[updateAllPartnerMetricsForMonth]', {
      organizationId,
      year,
      month,
      count: partners.length,
    });
  } catch (err) {
    logger.error('[updateAllPartnerMetricsForMonth]', { err, organizationId, year, month });
    throw err;
  }
}

/**
 * 파트너별 최근 6개월 성과 데이터 조회
 */
export async function getPartnerMetricsTrend(partnerId: string, monthsBack: number = 6) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 지난 6개월 범위 계산
    const startMonth = currentMonth - monthsBack + 1;
    let startYear = currentYear;

    if (startMonth < 1) {
      startYear = currentYear - 1;
    }

    const metrics = await prisma.partnerMetrics.findMany({
      where: { partnerId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      take: monthsBack,
    });

    return metrics;
  } catch (err) {
    logger.error('[getPartnerMetricsTrend]', { err, partnerId });
    throw err;
  }
}
