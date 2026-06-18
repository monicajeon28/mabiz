/**
 * Prisma 임시 타입 정의 (마이그레이션 전)
 * 신뢰도 시스템 테이블: TrustScore, TrustAppeal, TrustAuditLog
 */

declare global {
  interface PrismaExtensions {
    trustScore: {
      findUnique: (where: { where: { userId: string } }) => Promise<any>;
      create: (data: any) => Promise<any>;
      upsert: (data: any) => Promise<any>;
      update: (data: any) => Promise<any>;
      findMany: (data?: any) => Promise<any[]>;
      count: (where?: any) => Promise<number>;
    };
    trustAppeal: {
      findUnique: (where: any) => Promise<any>;
      create: (data: any) => Promise<any>;
      update: (data: any) => Promise<any>;
      findMany: (data?: any) => Promise<any[]>;
    };
    trustAuditLog: {
      findUnique: (where: any) => Promise<any>;
      create: (data: any) => Promise<any>;
      findMany: (data?: any) => Promise<any[]>;
      count: (where?: any) => Promise<number>;
    };
  }
}

export {};
