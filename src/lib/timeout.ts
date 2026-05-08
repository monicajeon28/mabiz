/** Promise에 타임아웃 적용 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT: ${label} (${ms}ms 초과)`)), ms)
    ),
  ]);
}
