/**
 * 렌즈 감지 마이그레이션 품질 검증 스크립트
 * - 분류율 확인 (목표: 90% 이상)
 * - 신뢰도 검증 (목표: confidence > 30%)
 * - 랜덤 샘플 검증 (10개 Contact 검토)
 * - 분포 분석
 *
 * 실행: npx ts-node scripts/verify-lens-migration.ts
 *
 * @date 2026-05-27
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

interface VerificationResult {
  totalContacts: number;
  classifiedContacts: number;
  classificationRate: number; // %
  avgConfidenceScore: number;
  lensDistribution: Record<string, { count: number; percentage: number }>;
  confidenceScoreDistribution: {
    excellent: number; // > 70
    good: number; // 40-70
    fair: number; // 30-40
    poor: number; // < 30
  };
  errors: Array<{
    contactId: string;
    issue: string;
  }>;
  randomSamples: Array<{
    contactId: string;
    lens: string;
    confidenceScore: number;
    tags: string[];
    assessment: string; // "sensible" or "questionable"
  }>;
  passQuality: boolean;
  recommendations: string[];
}

class LensMigrationVerifier {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  private logSection(title: string): void {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${"=".repeat(60)}`);
  }

  private logMetric(label: string, value: string | number, unit: string = ""): void {
    const paddedLabel = label.padEnd(40, ".");
    console.log(`  ${paddedLabel} ${value}${unit}`);
  }

  /**
   * 전체 분류율 확인
   */
  async verifyClassificationRate(): Promise<{
    total: number;
    classified: number;
    rate: number;
  }> {
    const [total, classified] = await Promise.all([
      this.prisma.contact.count(),
      this.prisma.contactLensClassification.findMany({
        select: { contactId: true },
        distinct: ["contactId"],
      }),
    ]);

    const classifiedIds = new Set(classified.map((c) => c.contactId));
    return {
      total,
      classified: classifiedIds.size,
      rate: (classifiedIds.size / total) * 100,
    };
  }

  /**
   * 렌즈별 분포 조회
   */
  async getLensDistribution(): Promise<Record<string, number>> {
    const results = await this.prisma.contactLensClassification.groupBy({
      by: ["lensType"],
      _count: {
        id: true,
      },
    });

    const distribution: Record<string, number> = {
      L0: 0,
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
      L5: 0,
      L6: 0,
      L7: 0,
      L8: 0,
      L9: 0,
      L10: 0,
    };

    results.forEach((r) => {
      if (r.lensType in distribution) {
        distribution[r.lensType] = r._count.id;
      }
    });

    return distribution;
  }

  /**
   * 신뢰도 점수 분포 분석
   */
  async getConfidenceDistribution(): Promise<{
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    average: number;
  }> {
    const classifications = await this.prisma.contactLensClassification.findMany({
      select: { confidenceScore: true },
    });

    let excellent = 0;
    let good = 0;
    let fair = 0;
    let poor = 0;
    let sum = 0;

    classifications.forEach((c) => {
      sum += c.confidenceScore;
      if (c.confidenceScore > 70) excellent++;
      else if (c.confidenceScore >= 40) good++;
      else if (c.confidenceScore >= 30) fair++;
      else poor++;
    });

    return {
      excellent,
      good,
      fair,
      poor,
      average: classifications.length > 0 ? sum / classifications.length : 0,
    };
  }

  /**
   * 문제 감지 (신뢰도 < 30%)
   */
  async findLowConfidenceIssues(): Promise<
    Array<{
      contactId: string;
      issue: string;
    }>
  > {
    const lowConfidence = await this.prisma.contactLensClassification.findMany({
      where: {
        confidenceScore: {
          lt: 30,
        },
      },
      select: {
        contactId: true,
        confidenceScore: true,
        lensType: true,
      },
      take: 50,
    });

    return lowConfidence.map((c) => ({
      contactId: c.contactId,
      issue: `Low confidence (${c.confidenceScore}%) for ${c.lensType}`,
    }));
  }

  /**
   * 랜덤 샘플 검증 (10개)
   */
  async getRandomSamples(count: number = 10): Promise<
    Array<{
      contactId: string;
      lens: string;
      confidenceScore: number;
      tags: string[];
      assessment: string;
    }>
  > {
    const classifications = await this.prisma.contactLensClassification.findMany({
      select: {
        contactId: true,
        lensType: true,
        confidenceScore: true,
        tags: true,
      },
      take: count * 3, // Get more for randomness
    });

    // Shuffle and take first `count`
    const shuffled = classifications.sort(() => Math.random() - 0.5).slice(0, count);

    return shuffled.map((c) => {
      // Simple assessment logic
      const assessment =
        c.confidenceScore > 50 || c.tags.length > 2
          ? "sensible"
          : "questionable";

      return {
        contactId: c.contactId,
        lens: c.lensType,
        confidenceScore: c.confidenceScore,
        tags: (c.tags || []).slice(0, 5),
        assessment,
      };
    });
  }

  /**
   * 전체 검증 실행
   */
  async run(): Promise<VerificationResult> {
    this.logSection("LENS MIGRATION VERIFICATION");

    // 분류율
    const classRate = await this.verifyClassificationRate();
    this.logMetric("Total Contacts", classRate.total);
    this.logMetric("Classified Contacts", classRate.classified);
    this.logMetric("Classification Rate", classRate.rate.toFixed(2), "%");

    // 렌즈 분포
    const distribution = await this.getLensDistribution();
    this.logSection("LENS DISTRIBUTION");
    Object.entries(distribution).forEach(([lens, count]) => {
      const pct = ((count / classRate.classified) * 100).toFixed(1);
      this.logMetric(lens, count, ` (${pct}%)`);
    });

    // 신뢰도 분포
    const confidenceDist = await this.getConfidenceDistribution();
    this.logSection("CONFIDENCE SCORE DISTRIBUTION");
    this.logMetric("Excellent (> 70)", confidenceDist.excellent);
    this.logMetric("Good (40-70)", confidenceDist.good);
    this.logMetric("Fair (30-40)", confidenceDist.fair);
    this.logMetric("Poor (< 30)", confidenceDist.poor);
    this.logMetric("Average Score", confidenceDist.average.toFixed(1), "%");

    // 문제 영역
    const errors = await this.findLowConfidenceIssues();
    this.logSection("ISSUES DETECTED");
    if (errors.length === 0) {
      console.log("  ✅ No low-confidence classifications found");
    } else {
      console.log(`  ⚠️  Found ${errors.length} low-confidence classifications`);
      errors.slice(0, 5).forEach((e) => {
        console.log(`    - ${e.contactId}: ${e.issue}`);
      });
    }

    // 랜덤 샘플
    const samples = await this.getRandomSamples(10);
    this.logSection("RANDOM SAMPLE VERIFICATION (10 CONTACTS)");
    samples.forEach((s, idx) => {
      const statusIcon = s.assessment === "sensible" ? "✅" : "⚠️";
      console.log(`  ${statusIcon} ${idx + 1}. ${s.contactId.substring(0, 8)}...`);
      console.log(`     Lens: ${s.lens}, Confidence: ${s.confidenceScore}%`);
      console.log(`     Tags: ${s.tags.join(", ") || "none"}`);
    });

    // 권장사항
    const recommendations: string[] = [];
    if (classRate.rate < 90) {
      recommendations.push(
        `Classification rate is ${classRate.rate.toFixed(1)}% (target: 90%). Run batch migration again.`,
      );
    }
    if (confidenceDist.poor > classRate.classified * 0.1) {
      recommendations.push(
        `${((confidenceDist.poor / classRate.classified) * 100).toFixed(1)}% have poor confidence. Review contact data quality.`,
      );
    }
    if (confidenceDist.average < 35) {
      recommendations.push(
        `Average confidence is low (${confidenceDist.average.toFixed(1)}%). Ensure Contact fields are properly populated.`,
      );
    }

    // 최종 판정
    const passQuality =
      classRate.rate >= 90 &&
      confidenceDist.poor < classRate.classified * 0.1 &&
      confidenceDist.average >= 35;

    this.logSection("QUALITY ASSESSMENT");
    console.log(`  ${passQuality ? "✅" : "⚠️"} Overall: ${passQuality ? "PASS" : "NEEDS IMPROVEMENT"}`);
    if (recommendations.length > 0) {
      console.log(`\n  Recommendations:`);
      recommendations.forEach((r) => console.log(`    - ${r}`));
    }

    const result: VerificationResult = {
      totalContacts: classRate.total,
      classifiedContacts: classRate.classified,
      classificationRate: classRate.rate,
      avgConfidenceScore: confidenceDist.average,
      lensDistribution: Object.entries(distribution).reduce(
        (acc, [lens, count]) => {
          acc[lens] = {
            count,
            percentage: (count / classRate.classified) * 100,
          };
          return acc;
        },
        {} as Record<string, { count: number; percentage: number }>,
      ),
      confidenceScoreDistribution: {
        excellent: confidenceDist.excellent,
        good: confidenceDist.good,
        fair: confidenceDist.fair,
        poor: confidenceDist.poor,
      },
      errors,
      randomSamples: samples,
      passQuality,
      recommendations,
    };

    this.logSection("SUMMARY");
    console.log(JSON.stringify(result, null, 2));
    console.log("");

    return result;
  }

  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const verifier = new LensMigrationVerifier();
  const result = await verifier.run();
  await verifier.cleanup();

  // Exit code based on quality
  process.exit(result.passQuality ? 0 : 1);
}

main().catch((error) => {
  logger.error(`[Verification] Fatal error: ${error}`);
  process.exit(1);
});
