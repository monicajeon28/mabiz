/**
 * 렌즈 감지 배치 마이그레이션 스크립트
 * Contact 10K+ 자동 분류 (병렬 처리)
 *
 * 실행: npx ts-node scripts/migrate-contacts-lens-detection.ts
 * 재개: 자동으로 마지막 위치부터 시작 (.lens-migration-status.json)
 * 성능: 100개 배치 × 병렬 5개 = ~30초/배치 → 50분 for 10K contacts
 *
 * @date 2026-05-27
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { LensDetectionEngine } from "@/lib/services/lens-detection-engine";
import * as fs from "fs";
import * as path from "path";
import Redis from "ioredis";

const STATUS_FILE = path.join(__dirname, ".lens-migration-status.json");
const BATCH_SIZE = 100;
const PARALLEL_LIMIT = 5;
const TIMEOUT_SECONDS = 600; // 10분 timeout per batch

interface MigrationStatus {
  lastProcessedId: string | null;
  totalProcessed: number;
  totalErrors: number;
  startTime: string;
  lastUpdateTime: string;
  errors: Array<{
    contactId: string;
    error: string;
    timestamp: string;
  }>;
  lensDistribution: Record<string, number>;
  isRunning: boolean;
}

const DEFAULT_STATUS: MigrationStatus = {
  lastProcessedId: null,
  totalProcessed: 0,
  totalErrors: 0,
  startTime: new Date().toISOString(),
  lastUpdateTime: new Date().toISOString(),
  errors: [],
  lensDistribution: {
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
  },
  isRunning: false,
};

class LensBatchMigration {
  private prisma: PrismaClient;
  private redis: Redis;
  private lensEngine: LensDetectionEngine;
  private status: MigrationStatus;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    this.lensEngine = new LensDetectionEngine(this.prisma, this.redis);
    this.status = this.loadStatus();
  }

  private loadStatus(): MigrationStatus {
    try {
      if (fs.existsSync(STATUS_FILE)) {
        const data = fs.readFileSync(STATUS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn(`[Migration] Failed to load status file: ${error}`);
    }
    return { ...DEFAULT_STATUS };
  }

  private saveStatus(): void {
    try {
      this.status.lastUpdateTime = new Date().toISOString();
      fs.writeFileSync(STATUS_FILE, JSON.stringify(this.status, null, 2));
    } catch (error) {
      logger.error(`[Migration] Failed to save status: ${error}`);
    }
  }

  private logProgress(message: string, level: "info" | "warn" | "error" = "info"): void {
    const timestamp = new Date().toISOString();
    const progressMsg = `[Migration ${timestamp}] ${message}`;
    if (level === "error") logger.error(progressMsg);
    else if (level === "warn") logger.warn(progressMsg);
    else logger.info(progressMsg);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 배치에서 n개씩 병렬 처리
   */
  private async processInParallel<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    parallelLimit: number = PARALLEL_LIMIT,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += parallelLimit) {
      const batch = items.slice(i, i + parallelLimit);
      const promises = batch.map((item) =>
        processor(item).catch((error) => {
          logger.warn(`[Migration] Item processing error: ${error}`);
        }),
      );
      await Promise.all(promises);
    }
  }

  /**
   * Contact 하나를 렌즈 감지 → 저장
   */
  private async processContact(contact: { id: string; organizationId: string }): Promise<void> {
    try {
      const result = await this.lensEngine.detectLens(contact.id, contact.organizationId, false);
      await this.lensEngine.saveClassification(contact.id, contact.organizationId, result);

      // Update distribution
      this.status.lensDistribution[result.primaryLens]++;
      this.status.totalProcessed++;
    } catch (error) {
      this.status.totalErrors++;
      this.status.errors.push({
        contactId: contact.id,
        error: String(error),
        timestamp: new Date().toISOString(),
      });
      // Keep errors array size bounded
      if (this.status.errors.length > 1000) {
        this.status.errors = this.status.errors.slice(-500);
      }
      logger.warn(`[Migration] Failed to process ${contact.id}: ${error}`);
    }
  }

  /**
   * 마이그레이션 실행
   */
  async run(): Promise<void> {
    try {
      this.status.isRunning = true;
      this.saveStatus();

      const startTime = Date.now();
      this.logProgress(`Starting lens detection batch migration...`);

      // 전체 Contact 개수 조회
      const totalContacts = await this.prisma.contact.count();
      this.logProgress(`Total contacts in database: ${totalContacts}`);

      if (totalContacts === 0) {
        this.logProgress("No contacts to process");
        return;
      }

      // 마지막 위치부터 시작
      let processedInThisRun = 0;
      let cursor: string | null = this.status.lastProcessedId;
      let batchNumber = 0;

      while (true) {
        const batchStartTime = Date.now();
        batchNumber++;

        try {
          // 배치 조회 (cursor-based pagination)
          const contacts = await this.prisma.contact.findMany({
            where: {
              ...(cursor ? { id: { gt: cursor } } : {}),
            },
            select: {
              id: true,
              organizationId: true,
            },
            take: BATCH_SIZE,
            orderBy: { id: "asc" },
          });

          if (contacts.length === 0) {
            this.logProgress(`✅ Migration complete! Processed all contacts.`);
            break;
          }

          this.logProgress(`Batch #${batchNumber}: Processing ${contacts.length} contacts...`);

          // 병렬 처리
          await this.processInParallel(contacts, (contact) => this.processContact(contact), PARALLEL_LIMIT);

          cursor = contacts[contacts.length - 1].id;
          this.status.lastProcessedId = cursor;
          processedInThisRun += contacts.length;

          const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
          const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
          const eta = this.estimateETA(totalContacts, this.status.totalProcessed);

          this.logProgress(
            `Batch #${batchNumber} completed in ${batchDuration}s | ` +
              `Total: ${this.status.totalProcessed}/${totalContacts} (${((this.status.totalProcessed / totalContacts) * 100).toFixed(1)}%) | ` +
              `ETA: ${eta} | Errors: ${this.status.totalErrors}`,
          );

          this.saveStatus();

          // Batch timeout safety
          if (Date.now() - startTime > TIMEOUT_SECONDS * 1000) {
            this.logProgress(
              `⚠️ Timeout reached (${TIMEOUT_SECONDS}s). Resuming on next run. Progress saved.`,
              "warn",
            );
            break;
          }
        } catch (batchError) {
          this.logProgress(`Batch #${batchNumber} error: ${batchError}`, "error");
          // Continue with next batch
          await this.sleep(1000);
        }
      }

      // Final summary
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      const successRate = (((totalContacts - this.status.totalErrors) / totalContacts) * 100).toFixed(1);

      this.logProgress(`========== MIGRATION SUMMARY ==========`);
      this.logProgress(`Total contacts processed: ${this.status.totalProcessed}/${totalContacts}`);
      this.logProgress(`Success rate: ${successRate}%`);
      this.logProgress(`Total errors: ${this.status.totalErrors}`);
      this.logProgress(`Total duration: ${totalDuration}s`);
      this.logProgress(`Batches processed: ${batchNumber}`);
      this.logProgress(`Lens distribution:`);
      Object.entries(this.status.lensDistribution).forEach(([lens, count]) => {
        const pct = ((count / this.status.totalProcessed) * 100).toFixed(1);
        this.logProgress(`  ${lens}: ${count} (${pct}%)`);
      });
      this.logProgress(`========================================`);
    } finally {
      this.status.isRunning = false;
      this.saveStatus();
      await this.cleanup();
    }
  }

  private estimateETA(total: number, processed: number): string {
    if (processed === 0) return "calculating...";
    const uptime = Date.now() - new Date(this.status.startTime).getTime();
    const avgTimePerContact = uptime / processed;
    const remaining = total - processed;
    const etaMs = remaining * avgTimePerContact;
    const minutes = Math.ceil(etaMs / 60000);
    return minutes > 0 ? `${minutes}m` : "< 1m";
  }

  private async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
    this.redis.disconnect();
  }
}

// Main execution
async function main() {
  const migration = new LensBatchMigration();
  await migration.run();
}

main().catch((error) => {
  logger.error(`[Migration] Fatal error: ${error}`);
  process.exit(1);
});
