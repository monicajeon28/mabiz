/**
 * GET /api/ab-test/assignments?week=1
 * 주간 A/B 테스트 할당 조회
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = ctx.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // 쿼리 파라미터: week
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get("week") || "1", 10);

    if (week < 1 || week > 12) {
      return NextResponse.json({ error: "Week must be between 1 and 12" }, { status: 400 });
    }

    // CallLog에서 해당 주의 할당 데이터 조회
    const callLogs = await prisma.callLog.findMany({
      where: {
        abTestWeek: week,
        contact: {
          organizationId,
        },
      },
      include: {
        contact: {
          select: { id: true },
        },
      },
    });

    // 상담사별 집계 (userId 기준)
    const counselorMap = new Map<
      string,
      { name: string; aCount: number; bCount: number; callTargets: Set<number> }
    >();

    for (const log of callLogs) {
      const key = log.userId;
      if (!counselorMap.has(key)) {
        counselorMap.set(key, {
          name: "", // 이름은 아래에서 조회
          aCount: 0,
          bCount: 0,
          callTargets: new Set(),
        });
      }

      const data = counselorMap.get(key)!;
      if (log.abTestGroup === "A") {
        data.aCount++;
      } else if (log.abTestGroup === "B") {
        data.bCount++;
      }
    }

    // 상담사 이름 조회
    const userIds = Array.from(counselorMap.keys());
    const members = await prisma.organizationMember.findMany({
      where: { userId: { in: userIds }, organizationId },
      select: { userId: true, displayName: true },
    });

    const userMap = new Map(members.map((m) => [m.userId, m.displayName || "Unknown"]));

    // 응답 데이터 구성
    const assignments = Array.from(counselorMap.entries()).map(
      ([userId, data]) => ({
        userId,
        counselorName: userMap.get(userId) || "Unknown",
        abTestGroupA: data.aCount,
        abTestGroupB: data.bCount,
        total: data.aCount + data.bCount,
        aPercentage: data.aCount + data.bCount > 0
          ? ((data.aCount / (data.aCount + data.bCount)) * 100).toFixed(1)
          : "0.0",
      })
    );

    const totalCalls = assignments.reduce((sum, a) => sum + a.total, 0);
    const totalA = assignments.reduce((sum, a) => sum + a.abTestGroupA, 0);
    const totalB = assignments.reduce((sum, a) => sum + a.abTestGroupB, 0);

    return NextResponse.json({
      success: true,
      week,
      totalCounselors: assignments.length,
      totalCalls,
      aGroup: {
        count: totalA,
        percentage: totalCalls > 0 ? ((totalA / totalCalls) * 100).toFixed(1) : "0.0",
      },
      bGroup: {
        count: totalB,
        percentage: totalCalls > 0 ? ((totalB / totalCalls) * 100).toFixed(1) : "0.0",
      },
      assignments: assignments.sort((a, b) =>
        a.counselorName.localeCompare(b.counselorName)
      ),
    });
  } catch (error) {
    console.error("Failed to fetch A/B test assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}
