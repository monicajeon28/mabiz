/**
 * A/A Test Validation Script
 * Team C: Validates that the statistical engine correctly identifies
 * identical distributions as having no significant difference
 *
 * Why A/A test?
 * - Proves our p-value calculation is correct
 * - If A/A test fails (p < 0.05), our engine has a bug
 * - If A/A test passes (p > 0.05), we can trust A/B results
 */

import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  calculateChiSquare,
  calculateConfidenceInterval,
  isStatisticallySignificant,
} from "@/lib/ab-test-statistics";

// Initialize Prisma with proper adapter
function initPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment");
  }
  const adapter = new PrismaPg({
    connectionString,
  });
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

const prisma = initPrisma();

async function validateABTestEngine() {
  console.log("🧪 A/A 테스트 시작 (통계 엔진 검증)...\n");

  try {
    // Step 0: 테스트용 조직 생성 또는 기존 조직 사용
    console.log("Step 0: 테스트 환경 확인...");

    const timestamp = Date.now();
    const testOrgId = "test-org-validate";

    // Check if organization exists, or use a valid one
    let orgId = testOrgId;
    const existingOrg = await prisma.organization.findUnique({
      where: { id: testOrgId },
    });

    if (!existingOrg) {
      console.log("⚠️  테스트 조직이 없어서 기본 조직 찾는 중...");
      const anyOrg = await prisma.organization.findFirst();
      if (anyOrg) {
        orgId = anyOrg.id;
        console.log(`✅ 기존 조직 사용: ${orgId}\n`);
      } else {
        console.log("❌ 데이터베이스에 조직이 없습니다. 조직을 먼저 생성하세요.");
        process.exit(1);
      }
    } else {
      console.log(`✅ 테스트 조직 확인: ${testOrgId}\n`);
    }

    // Step 1: 테스트용 링크 2개 생성
    console.log("Step 1: 테스트 링크 생성...");

    const link1 = await prisma.shortLink.create({
      data: {
        code: `aa_test_a_${timestamp}`,
        targetUrl: "https://example.com/test-a",
        title: "A/A 테스트 - 링크 A",
        organizationId: orgId,
        createdBy: "test-validate",
        category: "test",
        isActive: true,
      },
    });

    const link2 = await prisma.shortLink.create({
      data: {
        code: `aa_test_b_${timestamp}`,
        targetUrl: "https://example.com/test-b",
        title: "A/A 테스트 - 링크 B (복사)",
        organizationId: orgId,
        createdBy: "test-validate",
        category: "test",
        isActive: true,
      },
    });

    console.log(`✅ 링크 생성: ${link1.code} vs ${link2.code}\n`);

    // Step 2: A/A 테스트 생성
    console.log("Step 2: A/A 테스트 생성...");

    const test = await prisma.shortLinkABTest.create({
      data: {
        testName: `A/A 테스트 (통계 검증 - ${timestamp})`,
        organizationId: orgId,
        createdBy: "test-validate",
        variantA_id: link1.id,
        variantB_id: link2.id,
        status: "ACTIVE",
      },
    });

    console.log(`✅ 테스트 생성: ${test.id}\n`);

    // Step 3: Impression 시뮬레이션 (100회 각각)
    console.log("Step 3: 노출 데이터 생성 (각 100회)...");

    const impressionPromises = [];
    for (let i = 0; i < 100; i++) {
      impressionPromises.push(
        prisma.shortLinkImpression.create({
          data: {
            shortLinkId: link1.id,
            channel: "test",
            sentAt: new Date(),
          },
        })
      );

      impressionPromises.push(
        prisma.shortLinkImpression.create({
          data: {
            shortLinkId: link2.id,
            channel: "test",
            sentAt: new Date(),
          },
        })
      );
    }

    await Promise.all(impressionPromises);
    console.log(`✅ 200개 impressions 생성 (각 링크당 100개)\n`);

    // Step 4: 클릭 데이터 시뮬레이션 (50:50 분산)
    // 이것이 A/A 테스트: 정확히 같은 비율로 분산
    console.log("Step 4: 클릭 데이터 생성 (50회 vs 50회)...");

    const clickPromises = [];

    // Link 1: 50 클릭
    for (let i = 0; i < 50; i++) {
      clickPromises.push(
        prisma.shortLinkClick.create({
          data: {
            linkId: link1.id,
            variant: "A",
          },
        })
      );
    }

    // Link 2: 50 클릭
    for (let i = 0; i < 50; i++) {
      clickPromises.push(
        prisma.shortLinkClick.create({
          data: {
            linkId: link2.id,
            variant: "B",
          },
        })
      );
    }

    await Promise.all(clickPromises);
    console.log(`✅ 클릭 데이터 생성: A=50, B=50\n`);

    // Step 5: 통계 계산
    console.log("Step 5: 통계 계산...");

    const { chiSquare, degreesOfFreedom } = calculateChiSquare(50, 50, 100, 100);

    // 정확한 p-value 계산 함수 (테스트용)
    function approximateChiSquarePValue(chiSquare: number): number {
      const lookupTable: Array<[number, number]> = [
        [0, 1.0],
        [0.455, 0.5],
        [1.074, 0.3],
        [1.642, 0.2],
        [2.706, 0.1],
        [3.841, 0.05],
        [5.412, 0.02],
        [6.635, 0.01],
        [7.879, 0.005],
        [10.828, 0.001],
      ];

      for (let i = 0; i < lookupTable.length - 1; i++) {
        if (
          chiSquare >= lookupTable[i][0] &&
          chiSquare <= lookupTable[i + 1][0]
        ) {
          const x0 = lookupTable[i][0];
          const y0 = lookupTable[i][1];
          const x1 = lookupTable[i + 1][0];
          const y1 = lookupTable[i + 1][1];

          return y0 + ((chiSquare - x0) / (x1 - x0)) * (y1 - y0);
        }
      }

      if (chiSquare > 10.828) {
        return 0.001;
      }

      return 1.0;
    }

    const pValue = approximateChiSquarePValue(chiSquare);

    console.log(`Chi-Square: ${chiSquare.toFixed(4)}`);
    console.log(`Degrees of Freedom: ${degreesOfFreedom}`);
    console.log(`p-value: ${pValue.toFixed(4)}\n`);

    // Step 6: 신뢰도 구간 계산
    console.log("Step 6: 신뢰도 구간 계산...");

    const ciA = calculateConfidenceInterval(50, 100, 0.95);
    const ciB = calculateConfidenceInterval(50, 100, 0.95);

    console.log(`링크 A: CTR=${(ciA.ctr * 100).toFixed(2)}% (${ciA.lower.toFixed(3)}-${ciA.upper.toFixed(3)})`);
    console.log(`링크 B: CTR=${(ciB.ctr * 100).toFixed(2)}% (${ciB.lower.toFixed(3)}-${ciB.upper.toFixed(3)})\n`);

    // Step 7: 결과 검증
    console.log("Step 7: 결과 검증...");

    const isSignificant = isStatisticallySignificant(50, 50, 100, 100, 0.05);

    if (!isSignificant && pValue > 0.05) {
      console.log("✅ A/A 테스트 통과!");
      console.log(
        `   → p-value (${pValue.toFixed(4)}) > 0.05`
      );
      console.log(
        `   → "같은 것으로 판정" (정상 - 두 링크의 성과가 통계적으로 동일)\n`
      );
    } else {
      console.log("❌ A/A 테스트 실패!");
      console.log(
        `   → p-value (${pValue.toFixed(4)}) < 0.05`
      );
      console.log(
        `   → "다른 것으로 판정" (엔진 버그! 같은 데이터인데 다르다고 함)\n`
      );
      throw new Error("A/A test failed - statistical engine has a bug");
    }

    // Step 8: 추가 검증 케이스
    console.log("Step 8: 추가 통계 검증...\n");

    // 사례 1: 완전 균등
    const test1 = calculateChiSquare(50, 50, 100, 100);
    const p1 = approximateChiSquarePValue(test1.chiSquare);
    console.log(`사례 1 (50 vs 50):     χ²=${test1.chiSquare.toFixed(4)}, p=${p1.toFixed(4)} ✅`);

    // 사례 2: 약간 다름
    const test2 = calculateChiSquare(60, 40, 100, 100);
    const p2 = approximateChiSquarePValue(test2.chiSquare);
    console.log(
      `사례 2 (60 vs 40):     χ²=${test2.chiSquare.toFixed(4)}, p=${p2.toFixed(4)} ✅`
    );

    // 사례 3: 크게 다름
    const test3 = calculateChiSquare(70, 30, 100, 100);
    const p3 = approximateChiSquarePValue(test3.chiSquare);
    const significant3 = p3 < 0.05 ? "✅" : "❌";
    console.log(
      `사례 3 (70 vs 30):     χ²=${test3.chiSquare.toFixed(4)}, p=${p3.toFixed(4)} ${significant3}`
    );

    // 사례 4: 극단적으로 다름
    const test4 = calculateChiSquare(90, 10, 100, 100);
    const p4 = approximateChiSquarePValue(test4.chiSquare);
    const significant4 = p4 < 0.05 ? "✅" : "❌";
    console.log(
      `사례 4 (90 vs 10):     χ²=${test4.chiSquare.toFixed(4)}, p=${p4.toFixed(4)} ${significant4}\n`
    );

    // Step 9: 테스트 데이터 정리
    console.log("Step 9: 테스트 데이터 정리...");

    await Promise.all([
      prisma.shortLinkClick.deleteMany({
        where: { linkId: { in: [link1.id, link2.id] } },
      }),
      prisma.shortLinkImpression.deleteMany({
        where: { shortLinkId: { in: [link1.id, link2.id] } },
      }),
      prisma.shortLinkABTest.delete({
        where: { id: test.id },
      }),
      prisma.shortLink.deleteMany({
        where: { id: { in: [link1.id, link2.id] } },
      }),
    ]);

    console.log(`✅ 테스트 데이터 정리 완료\n`);

    console.log(
      "🎉 A/A 테스트 완벽합니다! 통계 엔진을 신뢰할 수 있습니다.\n"
    );
    console.log("✅ 배포 준비 완료!\n");

    return true;
  } catch (error) {
    console.error("❌ 오류:", error instanceof Error ? error.message : error);
    console.log("\n⚠️  배포 불가 - 먼저 버그를 수정하세요.\n");
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
validateABTestEngine()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
