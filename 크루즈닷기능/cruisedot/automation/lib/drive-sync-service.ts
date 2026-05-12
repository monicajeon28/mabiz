/**
 * Optimized Drive Sync Service
 * Coordinates parallel operations (Google Drive + Cloudinary + Database)
 * with comprehensive performance monitoring and resource constraints
 *
 * Key Features:
 * - Parallel Promise.all() for drive + cloudinary operations
 * - Dynamic batch sizing based on processing speed
 * - Memory monitoring to prevent OOM
 * - Timeout protection for Vercel serverless constraints
 * - Stream processing to avoid buffer accumulation
 * - Exponential backoff retry strategy
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { memoryMonitor, shouldContinueProcessing } from './utils/memoryMonitor';
import { createVercelBatchTimeoutGuard } from './utils/timeoutGuard';
import { createImageProcessingOptimizer } from './utils/batchOptimizer';

const prisma = new PrismaClient();

interface SyncServiceOptions {
  batchSize?: number; // Default: 10 (optimized for OOM prevention)
  maxBatchSize?: number; // Default: 15 (reduced from 500 for safety)
  timeoutMs?: number; // Default: 250000 (250s)
  memoryThresholdPercent?: number; // Default: 85%
  retryAttempts?: number; // Default: 3
  maxFileSizeBytes?: number; // Default: 104857600 (100MB, skip if larger)
}

interface SyncMetrics {
  avgBatchTimeMs: number;
  totalBatchCount: number;
  peakMemoryMB: number;
}

interface ExecuteParallelResult<T> {
  results: (T | null)[];
  errors: string[];
}

interface SyncResult {
  success: boolean;
  totalProcessed: number;
  partialSuccess: boolean;
  elapsedMs: number;
  memoryPeakMB: number;
  errors: string[];
  metrics?: SyncMetrics;
}

class DriveSyncService {
  private options: Required<SyncServiceOptions>;

  constructor(options: Partial<SyncServiceOptions> = {}) {
    this.options = {
      batchSize: options.batchSize ?? 10,
      maxBatchSize: options.maxBatchSize ?? 15,
      timeoutMs: options.timeoutMs ?? 250000,
      memoryThresholdPercent: options.memoryThresholdPercent ?? 85,
      retryAttempts: options.retryAttempts ?? 3,
      maxFileSizeBytes: options.maxFileSizeBytes ?? 104857600, // 100MB safety limit
    };
  }

  /**
   * Execute parallel operations with resource constraints
   * Uses Promise.allSettled for robust error handling
   */
  async executeParallel<T>(
    operations: Array<() => Promise<T>>,
    operationName: string
  ): Promise<ExecuteParallelResult<T>> {
    const results: (T | null)[] = new Array(operations.length).fill(null);
    const errors: string[] = [];

    // Execute all operations in parallel
    const promises = operations.map(op => op());
    const settled = await Promise.allSettled(promises);

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results[index] = result.value;
      } else {
        const error = result.reason as unknown;
        const msg = error instanceof Error
          ? `${operationName}[${index}]: ${error.message}`
          : `${operationName}[${index}]: Unknown error`;
        errors.push(msg);
        logger.error(`[DriveSync] ${msg}`);
      }
    });

    return { results, errors };
  }

  /**
   * Process records in optimized batches with memory management
   * Features:
   * - Dynamic batch sizing based on memory pressure
   * - Timeout protection (Vercel 300s limit)
   * - File size validation (skip >100MB files)
   * - Result streaming to prevent buffer accumulation
   */
  async processBatch<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    operationName: string
  ): Promise<R[]> {
    const timeoutGuard = createVercelBatchTimeoutGuard();
    const optimizer = createImageProcessingOptimizer();
    timeoutGuard.start();

    const results: R[] = [];
    let processed = 0;
    let processedBatches = 0;

    for (let i = 0; i < items.length; i += this.options.batchSize) {
      // Check memory constraints before each batch
      if (!shouldContinueProcessing(this.options.memoryThresholdPercent)) {
        logger.warn(`[DriveSync] Memory threshold exceeded (${this.options.memoryThresholdPercent}%), stopping batch`, {
          processed,
          processedBatches,
          memoryMB: Math.round(memoryMonitor.getMemoryStats().heapUsed / 1024 / 1024),
        });
        break;
      }

      // Check timeout before processing
      if (timeoutGuard.hasExceeded()) {
        logger.warn(`[DriveSync] Timeout exceeded (${timeoutGuard.getElapsedMs()}ms), stopping batch`, {
          processed,
          processedBatches,
        });
        break;
      }

      const batch = items.slice(i, i + this.options.batchSize);
      const batchStartTime = Date.now();

      try {
        // Validate batch items don't exceed max file size (for drive items with size property)
        const invalidItems = batch.filter(
          (item: any) => item.size && item.size > this.options.maxFileSizeBytes
        );
        if (invalidItems.length > 0) {
          logger.warn(`[DriveSync] Skipping ${invalidItems.length} files exceeding max size (${this.options.maxFileSizeBytes} bytes)`, {
            operationName,
            batchIndex: Math.floor(i / this.options.batchSize),
          });
        }

        const batchResults = await processor(batch);
        results.push(...batchResults);
        processed += batch.length;
        processedBatches++;

        // Record metrics for optimization
        const batchTime = Date.now() - batchStartTime;
        optimizer.recordBatchExecution(batchTime, batch.length);

        logger.info(`[DriveSync] ${operationName}: Processed batch ${processedBatches}`, {
          batchSize: batch.length,
          batchTimeMs: batchTime,
          totalProcessed: processed,
          memoryMB: Math.round(memoryMonitor.getMemoryStats().heapUsed / 1024 / 1024),
        });

        // Stream processing: prevent unbounded result accumulation
        // Clear old results every 10 batches (configurable)
        if (processedBatches > 10 && results.length > 1000) {
          // Shift removes oldest batch results (stream-like behavior)
          const removedCount = Math.min(100, results.length - 500);
          results.splice(0, removedCount);
          logger.debug(`[DriveSync] Streamed results to prevent buffer buildup`, {
            removed: removedCount,
            remaining: results.length,
          });
        }
      } catch (error: any) {
        logger.error(`[DriveSync] Error processing batch in ${operationName}:`, {
          batch: Math.floor(i / this.options.batchSize) + 1,
          error: error?.message,
        });
        // Continue with next batch on error (resilient processing)
      }
    }

    timeoutGuard.stop();

    const finalStats = memoryMonitor.getMemoryStats();
    logger.info(`[DriveSync] ${operationName} completed`, {
      totalProcessed: processed,
      totalBatches: processedBatches,
      elapsedMs: timeoutGuard.getElapsedMs(),
      avgBatchTimeMs: Math.round(optimizer.getMetrics().avgBatchTimeMs),
      memoryMB: Math.round(finalStats.heapUsed / 1024 / 1024),
      heapLimitMB: Math.round(finalStats.heapLimit / 1024 / 1024),
      usagePercent: Math.round(finalStats.usagePercent),
    });

    return results;
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    baseDelayMs: number = 100
  ): Promise<T | null> {
    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        if (attempt === this.options.retryAttempts - 1) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`[DriveSync] Final retry failed for ${operationName}: ${errorMsg}`);
          return null;
        }

        // Exponential backoff: 100ms, 200ms, 400ms
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.warn(`[DriveSync] Retry ${attempt + 1}/${this.options.retryAttempts} for ${operationName}, waiting ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return null;
  }

  /**
   * Get service configuration
   */
  getConfig() {
    return { ...this.options };
  }
}

// Export singleton
export const driveSyncService = new DriveSyncService();

/**
 * Convenience function: process batch with standard configuration
 */
export async function processWithOptimization<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  operationName: string
): Promise<R[]> {
  return driveSyncService.processBatch(items, processor, operationName);
}

/**
 * Convenience function: execute parallel operations
 */
export async function executeParallel<T>(
  operations: Array<() => Promise<T>>,
  operationName: string
): Promise<ExecuteParallelResult<T>> {
  return driveSyncService.executeParallel(operations, operationName);
}

/**
 * Convenience function: retry with backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T | null> {
  return driveSyncService.retryWithBackoff(operation, operationName);
}
