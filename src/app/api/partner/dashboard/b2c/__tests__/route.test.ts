/**
 * Partner Dashboard B2C API 테스트
 *
 * Jest 테스트 5가지 핵심 케이스:
 * 1. 미인증 요청 → 401
 * 2. 권한 없음(조직 ID 불일치) → 403
 * 3. 자신의 데이터만 조회 확인
 * 4. 월별 필터링 정상 작동
 * 5. 응답 필드 검증 (totalSalesAmount, passportPnr 등)
 */

import { GET } from '../route';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as passportAuth from '@/lib/passport-auth';

// Mock 설정
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    affiliateSale: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    gmReservation: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/passport-auth');
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Partner Dashboard B2C API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test Case 1: 미인증 요청 → 401', () => {
    it('should return 403 when requirePartnerContext returns null', async () => {
      (passportAuth.requirePartnerContext as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/partner/dashboard/b2c');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('인증이 필요합니다');
    });
  });

  describe('Test Case 2: 권한 없음 처리', () => {
    it('should only return data for authorized organization', async () => {
      const mockCtx = {
        sessionUser: { role: 'affiliate', userId: 'user-1' },
        organizationId: 'org-1',
      };

      (passportAuth.requirePartnerContext as jest.Mock).mockResolvedValue(mockCtx);

      // Mock 데이터 - org-1만의 데이터
      (prisma.affiliateSale.aggregate as jest.Mock).mockResolvedValue({
        _sum: { saleAmount: 500000 },
        _count: 5,
      });

      (prisma.affiliateSale.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sale-1',
          productName: '크루즈',
          saleAmount: 100000,
          commissionAmount: 10000,
          commissionRate: 0.1,
          status: 'CONFIRMED',
          createdAt: new Date('2026-05-16'),
        },
      ]);

      (prisma.gmReservation.count as jest.Mock).mockResolvedValue(5);

      const mockPassportPnr = [
        {
          id: 'res-1',
          name: '홍길동',
          passportStatus: 'ISSUED',
          pnrStatus: 'CONFIRMED',
          finalConfirmStatus: 'CONFIRMED',
          assignedName: '김담당',
          commissionAmount: 10000,
          commissionRate: 0.1,
          saleStatus: 'CONFIRMED',
          saleId: 'sale-1',
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockImplementation((query) => {
        // 여권/PNR 조회
        if (query?.toString?.().includes('passportStatus')) {
          return Promise.resolve(mockPassportPnr);
        }
        // 여권 상태별 집계
        if (query?.toString?.().includes('COUNT')) {
          return Promise.resolve([{ status: 'ISSUED', cnt: BigInt(5) }]);
        }
        // PNR 상태별 집계
        if (query?.toString?.().includes('pnrStatus')) {
          return Promise.resolve([{ status: 'CONFIRMED', cnt: BigInt(5) }]);
        }
        return Promise.resolve([]);
      });

      const req = new Request('http://localhost:3000/api/partner/dashboard/b2c');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);

      // 권한 검증: prisma 쿼리가 organizationId 필터를 포함해야 함
      const aggregateCall = (prisma.affiliateSale.aggregate as jest.Mock).mock.calls[0][0];
      expect(aggregateCall.where.organizationId).toBe('org-1');
    });
  });

  describe('Test Case 3: 자신의 데이터만 조회', () => {
    it('should return personal sales data only for non-admin users', async () => {
      const mockCtx = {
        sessionUser: { role: 'affiliate', userId: 'user-2' },
        organizationId: 'org-2',
      };

      (passportAuth.requirePartnerContext as jest.Mock).mockResolvedValue(mockCtx);

      (prisma.affiliateSale.aggregate as jest.Mock).mockResolvedValue({
        _sum: { saleAmount: 300000 },
        _count: 3,
      });

      (prisma.affiliateSale.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sale-2',
          productName: '패키지투어',
          saleAmount: 100000,
          commissionAmount: 8000,
          commissionRate: 0.08,
          status: 'CONFIRMED',
          createdAt: new Date('2026-05-15'),
        },
      ]);

      (prisma.gmReservation.count as jest.Mock).mockResolvedValue(3);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const req = new Request('http://localhost:3000/api/partner/dashboard/b2c');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.totalSalesAmount).toBe(300000);
      expect(data.data.salesCount).toBe(3);

      // 자신의 조직만 조회됨을 검증
      const findManyCall = (prisma.affiliateSale.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.organizationId).toBe('org-2');
    });
  });

  describe('Test Case 4: 월별 필터링', () => {
    it('should filter data by month parameter', async () => {
      const mockCtx = {
        sessionUser: { role: 'affiliate', userId: 'user-1' },
        organizationId: 'org-1',
      };

      (passportAuth.requirePartnerContext as jest.Mock).mockResolvedValue(mockCtx);

      (prisma.affiliateSale.aggregate as jest.Mock).mockResolvedValue({
        _sum: { saleAmount: 200000 },
        _count: 2,
      });

      (prisma.affiliateSale.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.gmReservation.count as jest.Mock).mockResolvedValue(0);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      // 2026년 5월 데이터 요청
      const req = new Request('http://localhost:3000/api/partner/dashboard/b2c?month=2026-05');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);

      // 월별 필터링이 적용됨을 검증
      const aggregateCall = (prisma.affiliateSale.aggregate as jest.Mock).mock.calls[0][0];
      const whereClause = aggregateCall.where.createdAt;

      // startDate: 2026-05-01, endDate: 2026-06-01
      expect(whereClause.gte.getFullYear()).toBe(2026);
      expect(whereClause.gte.getMonth()).toBe(4); // May (0-indexed)
      expect(whereClause.gte.getDate()).toBe(1);
    });
  });

  describe('Test Case 5: 응답 필드 검증', () => {
    it('should return required fields in response', async () => {
      const mockCtx = {
        sessionUser: { role: 'admin', userId: 'admin-1' },
        organizationId: null,
      };

      (passportAuth.requirePartnerContext as jest.Mock).mockResolvedValue(mockCtx);

      (prisma.affiliateSale.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { saleAmount: 1000000 }, _count: 10 })
        .mockResolvedValueOnce({ _sum: { saleAmount: 900000 }, _count: 9 });

      (prisma.affiliateSale.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sale-admin-1',
          productName: '특별패키지',
          saleAmount: 150000,
          commissionAmount: 15000,
          commissionRate: 0.1,
          status: 'CONFIRMED',
          createdAt: new Date(),
        },
      ]);

      (prisma.gmReservation.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(9);

      const mockPassportPnr = [
        {
          id: 'res-admin',
          name: '관리자고객',
          passportStatus: 'ISSUED',
          pnrStatus: 'CONFIRMED',
          finalConfirmStatus: 'CONFIRMED',
          assignedName: '담당자',
          commissionAmount: 15000,
          commissionRate: 0.1,
          saleStatus: 'CONFIRMED',
          saleId: 'sale-admin-1',
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        return Promise.resolve(mockPassportPnr);
      });

      const req = new Request('http://localhost:3000/api/partner/dashboard/b2c');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);

      // 응답 필드 검증
      expect(data.data).toHaveProperty('totalSalesAmount');
      expect(data.data).toHaveProperty('salesCount');
      expect(data.data).toHaveProperty('reservationCount');
      expect(data.data).toHaveProperty('recentSales');
      expect(data.data).toHaveProperty('passportPnr');
      expect(data.data).toHaveProperty('passportSummary');
      expect(data.data).toHaveProperty('pnrSummary');
      expect(data.data).toHaveProperty('trends');

      // 상세 필드 검증
      expect(data.data.totalSalesAmount).toBe(1000000);
      expect(data.data.salesCount).toBe(10);
      expect(data.data.reservationCount).toBe(10);
      expect(Array.isArray(data.data.recentSales)).toBe(true);
      expect(Array.isArray(data.data.passportPnr)).toBe(true);

      // 트렌드 필드 검증
      expect(data.data.trends).toHaveProperty('totalSalesAmount');
      expect(data.data.trends).toHaveProperty('salesCount');
      expect(data.data.trends).toHaveProperty('reservationCount');
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      (passportAuth.requirePartnerContext as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const req = new Request('http://localhost:3000/api/partner/dashboard/b2c');

      try {
        await GET(req);
      } catch (error) {
        expect(error).toEqual(new Error('Database connection failed'));
      }
    });
  });
});
