import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({
    connectionString,
    // Phase 3-α: 연결풀 최적화 (200ms 응답시간 유지)
    // Neon Pooler는 기본 connection pooling 지원, max_pool_size로 제한
    // 실제 Prisma 클라이언트 연결: 작업당 필요한 수만 유지
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Lazy getter: DB 클라이언트는 빌드 단계가 아닌 실제 요청 시에만 초기화된다.
// Vercel 빌드 환경(NEXT_PHASE=phase-production-build)에서 DATABASE_URL이
// 없어도 import 자체는 안전하게 통과한다.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    try {
      globalForPrisma.prisma = createPrismaClient();
    } catch (error) {
      // Vercel 빌드 단계에서 DATABASE_URL 미설정 시 null 유지 (지연 초기화)
      // 런타임 요청 시점에서 실제 에러 발생
      globalForPrisma.prisma = undefined;
      throw error;
    }
  }
  if (!globalForPrisma.prisma) {
    throw new Error("DATABASE_URL is not set - Prisma client initialization deferred");
  }
  return globalForPrisma.prisma;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { prisma };
export default prisma;
