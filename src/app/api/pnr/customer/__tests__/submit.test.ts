import { POST } from '@/app/api/pnr/customer/submit/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getMabizSession: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    gmReservation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gmTraveler: {
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    gmApisSyncQueue: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/app/api/_middleware/enforce-rbac', () => ({
  enforceRBAC: jest.fn(() => true),
}));

describe('POST /api/pnr/customer/submit', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock NextRequest 생성 (최소한의 구현)
    mockRequest = {
      json: jest.fn(),
      headers: new Map([['x-forwarded-for', '127.0.0.1']]),
      method: 'POST',
    } as unknown as NextRequest;
  });

  describe('[T1] 에러 메시지 표준화 (보안)', () => {
    it('should return generic error message on server failure', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;
      const { logger } = require('@/lib/logger');

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      // 트랜잭션 실패 시뮬레이션
      prisma.$transaction.mockRejectedValueOnce(
        new Error('Database connection timeout')
      );

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('PNR 정보 저장에 실패했습니다.');
      // 기술 정보가 에러 메시지에 포함되지 않았는지 확인
      expect(data.message).not.toContain('Database');
      expect(data.message).not.toContain('connection');
      expect(data.message).not.toContain('timeout');
    });

    it('should mask database errors in response', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      prisma.$transaction.mockRejectedValueOnce(
        new Error('Cannot read properties of null (reading "id")')
      );

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('PNR 정보 저장에 실패했습니다.');
      // 스택 트레이스나 기술 정보 없음
      expect(data.message).not.toContain('Cannot read');
      expect(data.message).not.toContain('null');
    });

    it('should not expose internal system messages to users', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      prisma.$transaction.mockRejectedValueOnce(
        new Error('Prisma Client failed to fetch from the server')
      );

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('PNR 정보 저장에 실패했습니다.');
      expect(data.message).not.toContain('Prisma');
      expect(data.message).not.toContain('server');
    });
  });

  describe('[T4] Zod strict 모드 (타입안전)', () => {
    it('should reject request with extra fields', async () => {
      const { getMabizSession } = require('@/lib/auth');

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
            roomColor: '#FF0000', // 추가 필드 (UI-only, 거부되어야 함)
            admin: true, // 권한 상승 시도
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      // strict 모드에서는 미정의 필드가 있으면 에러
      expect([400, 422]).toContain(response.status);
      expect(data.ok).toBe(false);
    });

    it('should validate required fields only', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      // 필수 필드만 포함된 요청
      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      // Mock 트랜잭션 성공
      prisma.gmReservation.findUnique.mockResolvedValue({
        id: 1,
        travelers: [],
        trip: null,
        totalPeople: 1,
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });

      prisma.gmReservation.findUnique.mockResolvedValueOnce({
        id: 1,
        travelers: [
          {
            id: 1,
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
        trip: null,
        totalPeople: 1,
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      // 필수 필드만 있어도 성공해야 함
      expect(data.ok).toBe(true);
    });
  });

  describe('[T6] 주민번호 형식 검증', () => {
    it('should reject invalid resident number format', async () => {
      const { getMabizSession } = require('@/lib/auth');

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-00', // 형식 오류 (너무 짧음)
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.message).toContain('형식');
    });

    it('should accept valid resident number formats', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      // Format: XXXXXX-XXXXXXX 또는 XXXXXXXXXXXXX
      const validFormats = [
        '900101-1234567',
        '9001011234567',
      ];

      for (const residentNum of validFormats) {
        (mockRequest.json as jest.Mock).mockResolvedValueOnce({
          reservationId: 1,
          travelers: [
            {
              korName: '홍길동',
              residentNum,
              phone: '010-1234-5678',
              roomNumber: 1,
            },
          ],
        });

        prisma.gmReservation.findUnique.mockResolvedValueOnce({
          id: 1,
          travelers: [],
          trip: null,
        });

        prisma.$transaction.mockImplementation(async (callback) => {
          return await callback(prisma);
        });

        prisma.gmReservation.findUnique.mockResolvedValueOnce({
          id: 1,
          travelers: [{ id: 1, korName: '홍길동', residentNum, phone: '010-1234-5678', roomNumber: 1 }],
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        // 유효한 형식이면 성공
        expect(data.ok).toBe(true);
      }
    });
  });

  describe('RBAC and Authorization', () => {
    it('should require authentication', async () => {
      const { getMabizSession } = require('@/lib/auth');

      getMabizSession.mockResolvedValue(null);

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.ok).toBe(false);
    });

    it('should allow OWNER with matching organization', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      prisma.gmReservation.findUnique.mockResolvedValue({
        id: 1,
        travelers: [],
        trip: null,
      });

      // Contact 조회 성공
      prisma.contact.findFirst = jest.fn().mockResolvedValue({
        id: 'contact-1',
        organizationId: 'org-123',
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });

      prisma.gmReservation.findUnique.mockResolvedValueOnce({
        id: 1,
        travelers: [
          {
            id: 1,
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.ok).toBe(true);
    });

    it('should reject OWNER with mismatched organization (IDOR)', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123', // 다른 조직
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      prisma.gmReservation.findUnique.mockResolvedValue({
        id: 1,
        travelers: [],
        trip: null,
      });

      // Contact 조회 실패 (다른 조직의 예약)
      prisma.contact.findFirst = jest.fn().mockResolvedValue(null);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.ok).toBe(false);
      expect(data.message).toContain('권한');
    });

    it('should allow GLOBAL_ADMIN to access any reservation', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'GLOBAL_ADMIN',
        organizationId: null,
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      prisma.gmReservation.findUnique.mockResolvedValue({
        id: 1,
        travelers: [],
        trip: null,
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });

      prisma.gmReservation.findUnique.mockResolvedValueOnce({
        id: 1,
        travelers: [
          {
            id: 1,
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.ok).toBe(true);
    });
  });

  describe('Request validation', () => {
    it('should reject request with missing reservationId', async () => {
      const { getMabizSession } = require('@/lib/auth');

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        // reservationId 누락
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
    });

    it('should reject request with empty travelers array', async () => {
      const { getMabizSession } = require('@/lib/auth');

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [], // 비어있음
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
    });
  });

  describe('Data persistence', () => {
    it('should use transaction to ensure atomicity', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            id: 1,
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      prisma.gmReservation.findUnique.mockResolvedValue({
        id: 1,
        travelers: [{ id: 1 }],
        trip: null,
      });

      prisma.contact.findFirst = jest.fn().mockResolvedValue({
        id: 'contact-1',
      });

      let transactionCalled = false;
      prisma.$transaction.mockImplementation(async (callback) => {
        transactionCalled = true;
        return await callback(prisma);
      });

      prisma.gmReservation.findUnique.mockResolvedValueOnce({
        id: 1,
        travelers: [{ id: 1, korName: '홍길동' }],
      });

      await POST(mockRequest);

      expect(transactionCalled).toBe(true);
    });

    it('should create APIS sync queue after PNR submission', async () => {
      const { getMabizSession } = require('@/lib/auth');
      const prisma = require('@/lib/prisma').default;

      getMabizSession.mockResolvedValue({
        userId: '1',
        role: 'OWNER',
        organizationId: 'org-123',
      });

      (mockRequest.json as jest.Mock).mockResolvedValueOnce({
        reservationId: 1,
        travelers: [
          {
            korName: '홍길동',
            residentNum: '000000-0000000',
            phone: '010-1234-5678',
            roomNumber: 1,
          },
        ],
      });

      prisma.gmReservation.findUnique.mockResolvedValue({
        id: 1,
        travelers: [],
        trip: null,
      });

      prisma.contact.findFirst = jest.fn().mockResolvedValue({
        id: 'contact-1',
      });

      let apisSyncCreated = false;
      prisma.gmApisSyncQueue = {
        create: jest.fn().mockImplementation(async () => {
          apisSyncCreated = true;
        }),
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(prisma);
      });

      prisma.gmReservation.findUnique.mockResolvedValueOnce({
        id: 1,
        travelers: [{ id: 1, korName: '홍길동' }],
      });

      await POST(mockRequest);

      expect(apisSyncCreated).toBe(true);
    });
  });
});
