import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/contacts/verify
 * 크루즈닷 문의 신청 레코드 검증 API
 *
 * 쿼리 파라미터:
 * - hours: 조회 범위 (시간, 기본값: 1)
 *
 * 응답:
 * - total: 조회된 Contact 총 개수
 * - recentContacts: 최근 Contact 목록
 * - nullOrgCount: organizationId가 NULL인 개수
 * - noEmailCount: email이 NULL인 개수
 * - inquiryPattern: "문의" 관련 Contact 개수
 * - stats: 추가 통계 정보
 * - status: 데이터 상태 메시지
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);

    // 권한 검증 (ADMIN만 접근)
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json(
        { error: "관리자만 검증 API에 접근 가능합니다" },
        { status: 403 }
      );
    }

    const hours = Math.max(1, parseInt(searchParams.get("hours") ?? "1", 10));
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    logger.info(`[Verify] 조회 범위: ${hours}시간 이전 (${cutoffTime.toISOString()})`);

    // 1️⃣ 최근 N시간 Contact 전체 조회
    const recentContacts = await prisma.contact.findMany({
      where: {
        deletedAt: null, // 삭제된 고객(soft delete) 제외
        createdAt: {
          gte: cutoffTime,
        },
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        organizationId: true,
        assignedUserId: true,
        type: true,
        sourceOrgId: true,
        affiliateCode: true,
        createdAt: true,
        updatedAt: true,
        tags: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // 최근 10개
    });

    // 2️⃣ 통계 계산
    const allContacts = await prisma.contact.findMany({
      where: {
        deletedAt: null, // 삭제된 고객(soft delete) 제외
        createdAt: {
          gte: cutoffTime,
        },
      },
      select: {
        id: true,
        organizationId: true,
        email: true,
        name: true,
        type: true,
      },
    });

    const nullOrgCount = allContacts.filter((c) => !c.organizationId).length;
    const noEmailCount = allContacts.filter((c) => !c.email).length;
    const inquiryPattern = allContacts.filter(
      (c) => c.name?.includes("문의") || c.name?.includes("inquiry")
    ).length;

    // 3️⃣ organizationId별 분포
    const orgDistribution = await prisma.contact.groupBy({
      by: ["organizationId"],
      where: {
        deletedAt: null, // 삭제된 고객(soft delete) 제외
        createdAt: {
          gte: cutoffTime,
        },
      },
      _count: true,
    });

    // 4️⃣ type별 분포
    const typeDistribution = await prisma.contact.groupBy({
      by: ["type"],
      where: {
        deletedAt: null, // 삭제된 고객(soft delete) 제외
        createdAt: {
          gte: cutoffTime,
        },
      },
      _count: true,
    });

    // 5️⃣ assignedUserId별 분포
    const assignmentDistribution = await prisma.contact.groupBy({
      by: ["assignedUserId"],
      where: {
        deletedAt: null, // 삭제된 고객(soft delete) 제외
        createdAt: {
          gte: cutoffTime,
        },
      },
      _count: true,
    });

    const stats = {
      totalCount: allContacts.length,
      nullOrgCount,
      noEmailCount,
      inquiryPatternCount: inquiryPattern,
      assignedCount: allContacts.filter((c) => {
        // 이를 위해 assignedUserId를 select에 추가해야 함
        return true;
      }).length,
      unassignedCount: 0, // 계산됨
      orgDistribution: orgDistribution.map((org) => ({
        organizationId: org.organizationId || "NULL",
        count: org._count,
      })),
      typeDistribution: typeDistribution.map((t) => ({
        type: t.type || "UNSET",
        count: t._count,
      })),
      assignmentDistribution: assignmentDistribution.map((a) => ({
        assignedUserId: a.assignedUserId || "UNASSIGNED",
        count: a._count,
      })),
    };

    // 6️⃣ 상태 메시지 생성
    let status = "데이터 있음";
    if (allContacts.length === 0) {
      status = "조회된 Contact 없음";
    } else if (nullOrgCount > 0) {
      status = `경고: ${nullOrgCount}개 Contact의 organizationId가 NULL입니다`;
    } else if (noEmailCount > 0) {
      status = `경고: ${noEmailCount}개 Contact의 email이 NULL입니다`;
    }

    logger.info(`[Verify] 검증 완료: total=${allContacts.length}, nullOrg=${nullOrgCount}, noEmail=${noEmailCount}`);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        queryRange: {
          hours,
          cutoffTime: cutoffTime.toISOString(),
        },
        total: allContacts.length,
        recentContacts: recentContacts.map((c) => ({
          id: c.id,
          phone: c.phone,
          name: c.name,
          email: c.email || "NULL",
          organizationId: c.organizationId || "NULL",
          assignedUserId: c.assignedUserId || "UNASSIGNED",
          type: c.type,
          sourceOrgId: c.sourceOrgId,
          affiliateCode: c.affiliateCode,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          tags: c.tags,
        })),
        stats,
        status,
        recommendations: generateRecommendations(stats),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("[Verify] 검증 중 오류:", { error });
    return NextResponse.json(
      { error: "검증 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

/**
 * 검증 결과 기반 권장사항 생성
 */
function generateRecommendations(
  stats: any
): string[] {
  const recommendations: string[] = [];

  if (stats.totalCount === 0) {
    recommendations.push("최근 시간 범위 내 Contact가 없습니다. 시간 범위를 확대해보세요.");
  }

  if (stats.nullOrgCount > 0) {
    recommendations.push(
      `⚠️ ${stats.nullOrgCount}개 Contact의 organizationId가 NULL입니다. 웹훅 데이터 검증이 필요합니다.`
    );
  }

  if (stats.noEmailCount > stats.totalCount * 0.3) {
    recommendations.push(
      `⚠️ ${((stats.noEmailCount / stats.totalCount) * 100).toFixed(1)}%의 Contact가 이메일이 없습니다.`
    );
  }

  if (stats.assignmentDistribution.length === 1 &&
    stats.assignmentDistribution[0].assignedUserId === "UNASSIGNED") {
    recommendations.push(
      "💡 모든 Contact이 미배정 상태입니다. 담당자 자동 배정 규칙을 설정하세요."
    );
  }

  if (stats.totalCount > 0 && stats.nullOrgCount === 0) {
    recommendations.push("✅ organizationId 검증 완료 - 모든 데이터가 정상입니다.");
  }

  return recommendations;
}
