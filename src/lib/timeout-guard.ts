export function createVercelBatchTimeoutGuard(limitMs = 270_000) {
  let start = 0;
  return {
    start: () => {
      start = Date.now();
    },
    stop: () => {},
    hasExceeded: () => Date.now() - start > limitMs,
    getElapsedMs: () => Date.now() - start,
  };
}

export function shouldContinueProcessing(maxMemoryPercent = 85): boolean {
  const memUsage = process.memoryUsage();
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  return heapPercent < maxMemoryPercent;
}
