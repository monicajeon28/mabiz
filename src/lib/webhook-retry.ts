import { logger } from "@/lib/logger";

interface WebhookJob {
  id: string;
  url: string;
  payload: any;
  retries: number;
  maxRetries: number;
  nextRetryAt: Date;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RETRY_DELAYS = [
  5 * 1000, // 5초
  30 * 1000, // 30초
  2 * 60 * 1000, // 2분
  10 * 60 * 1000, // 10분
  1 * 60 * 60 * 1000, // 1시간
];

export async function enqueueWebhookRetry(
  url: string,
  payload: any,
  maxRetries: number = 5
): Promise<void> {
  const job: WebhookJob = {
    id: `webhook-${Date.now()}-${Math.random()}`,
    url,
    payload,
    retries: 0,
    maxRetries,
    nextRetryAt: new Date(),
    status: "PENDING",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 메모리 큐에 추가 (실제 환경에서는 Redis 사용)
  webhookQueue.push(job);
  logger.log("[Webhook Retry] 작업 큐 추가", { jobId: job.id, url });

  // 비동기 처리
  processWebhookQueue();
}

export async function processWebhookRetry(job: WebhookJob): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(job.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      job.status = "SUCCESS";
      logger.log("[Webhook Retry] 성공", {
        jobId: job.id,
        attempts: job.retries + 1,
      });
      return true;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    job.retries++;
    job.updatedAt = new Date();
    job.error = err instanceof Error ? err.message : String(err);

    if (job.retries < job.maxRetries) {
      const delayMs = RETRY_DELAYS[job.retries - 1] || RETRY_DELAYS.at(-1)!;
      job.nextRetryAt = new Date(Date.now() + delayMs);
      job.status = "PENDING";

      logger.log("[Webhook Retry] 재시도 예약", {
        jobId: job.id,
        attempt: job.retries,
        nextRetryIn: `${delayMs / 1000}초`,
        error: job.error,
      });

      return false;
    } else {
      job.status = "FAILED";
      logger.error("[Webhook Retry] 최대 재시도 횟수 초과", {
        jobId: job.id,
        totalAttempts: job.retries,
        url: job.url,
        error: job.error,
      });
      return false;
    }
  }
}

// 메모리 큐 (실제 환경에서는 Redis)
const webhookQueue: WebhookJob[] = [];

export async function processWebhookQueue(): Promise<void> {
  const now = new Date();
  const pendingJobs = webhookQueue.filter(
    (j) => j.status === "PENDING" && j.nextRetryAt <= now
  );

  for (const job of pendingJobs) {
    job.status = "PROCESSING";
    const success = await processWebhookRetry(job);

    if (success || job.retries >= job.maxRetries) {
      // 큐에서 제거 (성공 또는 최대 재시도 초과)
      const idx = webhookQueue.indexOf(job);
      if (idx > -1) webhookQueue.splice(idx, 1);
    }
  }
}

// 5분마다 큐 처리
if (typeof globalThis !== "undefined") {
  const interval = setInterval(processWebhookQueue, 5 * 60 * 1000);
  if (interval.unref) interval.unref();
}
