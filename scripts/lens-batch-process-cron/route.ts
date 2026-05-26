/**
 * Vercel Cron: Lens Detection Batch Processing
 * Runs every 1 hour, processes 100 contacts per run
 * Automatically migrates all contacts through lens detection
 *
 * Configuration in vercel.json:
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/lens-batch-process",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * ```
 *
 * @date 2026-05-27
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { LensDetectionEngine } from "@/lib/services/lens-detection-engine";
import Redis from "ioredis";

const BATCH_SIZE = 100;
const PARALLEL_LIMIT = 5;

interface CronStatus {
  success: boolean;
  contactsProcessed: number;
  contactsErrors: number;
  duration: number; // seconds
  nextCursorId: string | null;
  timestamp: string;
  lensDistribution: Record<string, number>;
}

/**
 * Helper: Process contact through lens detection
 */
async function processContact(
  contact: { id: string; organizationId: string },
  lensEngine: LensDetectionEngine,
): Promise<{ success: boolean; lens?: string; error?: string }> {
  try {
    const result = await lensEngine.detectLens(contact.id, contact.organizationId, false);
    await lensEngine.saveClassification(contact.id, contact.organizationId, result);
    return { success: true, lens: result.primaryLens };
  } catch (error) {
    logger.warn(`[CronLensBatch] Failed to process ${contact.id}: ${error}`);
    return { success: false, error: String(error) };
  }
}

/**
 * Helper: Process batch with parallelization
 */
async function processBatchParallel(
  contacts: Array<{ id: string; organizationId: string }>,
  lensEngine: LensDetectionEngine,
  parallelLimit: number = PARALLEL_LIMIT,
): Promise<{ successful: number; failed: number; lensDistribution: Record<string, number> }> {
  const lensDistribution: Record<string, number> = {
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

  let successful = 0;
  let failed = 0;

  // Process in parallel chunks
  for (let i = 0; i < contacts.length; i += parallelLimit) {
    const chunk = contacts.slice(i, i + parallelLimit);
    const results = await Promise.all(chunk.map((c) => processContact(c, lensEngine)));

    results.forEach((result) => {
      if (result.success) {
        successful++;
        if (result.lens && result.lens in lensDistribution) {
          lensDistribution[result.lens]++;
        }
      } else {
        failed++;
      }
    });
  }

  return { successful, failed, lensDistribution };
}

/**
 * Helper: Get Redis cache for cursor tracking
 */
async function getCachedCursor(redis: Redis, key: string): Promise<string | null> {
  try {
    const cursor = await redis.get(key);
    return cursor;
  } catch (error) {
    logger.warn(`[CronLensBatch] Redis cursor read failed: ${error}`);
    return null;
  }
}

/**
 * Helper: Save cursor to Redis for next run
 */
async function saveCachedCursor(redis: Redis, key: string, cursor: string): Promise<void> {
  try {
    await redis.set(key, cursor, "EX", 86400 * 7); // 7 days TTL
  } catch (error) {
    logger.warn(`[CronLensBatch] Redis cursor save failed: ${error}`);
  }
}

/**
 * Main Cron Handler
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  const lensEngine = new LensDetectionEngine(prisma, redis);

  const cursorKey = "lens-batch:cursor";
  const statusKey = "lens-batch:last-status";

  try {
    // Verify cron secret
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn(`[CronLensBatch] Unauthorized cron request`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info(`[CronLensBatch] Starting batch process...`);

    // Get last cursor from Redis
    let cursor = await getCachedCursor(redis, cursorKey);
    logger.info(`[CronLensBatch] Resuming from cursor: ${cursor || "start"}`);

    // Fetch batch of contacts
    const contacts = await prisma.contact.findMany({
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
      logger.info(`[CronLensBatch] No more contacts to process. Migration complete.`);
      await redis.del(cursorKey);

      const status: CronStatus = {
        success: true,
        contactsProcessed: 0,
        contactsErrors: 0,
        duration: (Date.now() - startTime) / 1000,
        nextCursorId: null,
        timestamp: new Date().toISOString(),
        lensDistribution: {},
      };

      await saveCachedCursor(redis, statusKey, JSON.stringify(status));

      return NextResponse.json({
        message: "Migration complete",
        status,
      });
    }

    // Process batch
    logger.info(`[CronLensBatch] Processing ${contacts.length} contacts...`);
    const { successful, failed, lensDistribution } = await processBatchParallel(
      contacts,
      lensEngine,
      PARALLEL_LIMIT,
    );

    // Save cursor for next run
    const nextCursor = contacts[contacts.length - 1].id;
    await saveCachedCursor(redis, cursorKey, nextCursor);

    const duration = (Date.now() - startTime) / 1000;

    const status: CronStatus = {
      success: true,
      contactsProcessed: successful,
      contactsErrors: failed,
      duration,
      nextCursorId: nextCursor,
      timestamp: new Date().toISOString(),
      lensDistribution,
    };

    logger.info(
      `[CronLensBatch] Batch complete: ${successful} processed, ${failed} errors, ${duration.toFixed(2)}s`,
    );

    // Cache status for monitoring
    await redis.set(statusKey, JSON.stringify(status), "EX", 3600);

    return NextResponse.json({
      message: "Batch processed successfully",
      status,
    });
  } catch (error) {
    logger.error(`[CronLensBatch] Error: ${error}`);

    const status: CronStatus = {
      success: false,
      contactsProcessed: 0,
      contactsErrors: 1,
      duration: (Date.now() - startTime) / 1000,
      nextCursorId: null,
      timestamp: new Date().toISOString(),
      lensDistribution: {},
    };

    return NextResponse.json({ error: String(error), status }, { status: 500 });
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

/**
 * Allow Vercel cron requests (POST not required, but safe to have)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
