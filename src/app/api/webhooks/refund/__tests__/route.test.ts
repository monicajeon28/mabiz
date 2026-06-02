/**
 * Refund Webhook 테스트
 * 스펙 확정: REFUND_WEBHOOK_SPEC_CONFIRMED.md (2026-06-02)
 *
 * 시나리오:
 *   1. 정상 환불 PENDING → APPROVED → COMPLETED
 *   2. 거절된 환불 PENDING → REJECTED
 *   3. 중복 요청 멱등성 (같은 eventId)
 *   4. 인증 실패 (Bearer / HMAC)
 *   5. 필수 필드 누락
 */

import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

// ─── 모킹 ────────────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    processedWebhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    affiliateSale: {
      findUnique: jest.fn(),
    },
    contact: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/mabiz-dlq', () => ({ enqueueDLQ: jest.fn() }));
jest.mock('@/lib/notification-service', () => ({ createRefundNotifications: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/cabin-inventory-refund', () => ({ handleCabinInventoryRefund: jest.fn().mockResolvedValue({ success: true }) }));

import prisma from '@/lib/prisma';
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
const TEST_SECRET = 'test-refund-secret-32chars-long!!';

function makeRequest(body: object, opts: { secret?: string; noSignature?: boolean; noBearer?: boolean } = {}) {
  const raw = JSON.stringify(body);
  const secret = opts.secret ?? TEST_SECRET;
  const sig = createHmac('sha256', secret).update(raw).digest('hex');

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': '127.0.0.1',
  };
  if (!opts.noBearer) headers['authorization'] = `Bearer ${secret}`;
  if (!opts.noSignature) headers['x-signature'] = sig;

  return new NextRequest('http://localhost/api/webhooks/refund', {
    method: 'POST',
    headers,
    body: raw,
  });
}

// ─── 픽스처 ──────────────────────────────────────────────────────────────────
const BASE_PAYLOAD = {
  eventId: 'evt_ref_20260602_001',
  bookingRef: 'CZ-2026-001',
  refundAmount: 1_000_000,
  refundReason: '고객_요청',
  customerPhone: '01012345678',
  customerName: '홍길동',
  timestamp: '2026-06-02T12:00:00Z',
};

// ─── 테스트 ───────────────────────────────────────────────────────────────────
describe('POST /api/webhooks/refund', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(() => {
    process.env.CRUISEDOT_WEBHOOK_SECRET = TEST_SECRET;
    process.env.DEFAULT_ORGANIZATION_ID = 'org-test';
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // 기본: 중복 이벤트 없음, AffiliateSale 없음, Contact 없음
    (mockPrisma.processedWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.processedWebhookEvent.create as jest.Mock).mockResolvedValue({});
    (mockPrisma.affiliateSale.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(mockPrisma));

    const mod = await import('../route');
    POST = mod.POST;
  });

  // ── 1. 인증 실패 ─────────────────────────────────────────────────────────
  describe('인증 실패', () => {
    it('Bearer 없으면 401 반환', async () => {
      const req = makeRequest({ ...BASE_PAYLOAD, status: 'COMPLETED' }, { noBearer: true });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('잘못된 Bearer 토큰이면 401 반환', async () => {
      const req = makeRequest({ ...BASE_PAYLOAD, status: 'COMPLETED' }, { secret: 'wrong-secret-00000000000000000000' });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('x-signature 없으면 401 반환', async () => {
      const req = makeRequest({ ...BASE_PAYLOAD, status: 'COMPLETED' }, { noSignature: true });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('HMAC 불일치면 403 반환', async () => {
      const raw = JSON.stringify({ ...BASE_PAYLOAD, status: 'COMPLETED' });
      const wrongSig = createHmac('sha256', TEST_SECRET).update('tampered-body').digest('hex');
      const req = new NextRequest('http://localhost/api/webhooks/refund', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${TEST_SECRET}`,
          'x-signature': wrongSig,
          'x-forwarded-for': '127.0.0.1',
        },
        body: raw,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  // ── 2. 필수 필드 검증 ────────────────────────────────────────────────────
  describe('필수 필드 검증', () => {
    it('bookingRef(orderId) 없으면 400 반환', async () => {
      const { bookingRef: _, ...noBookingRef } = BASE_PAYLOAD;
      const req = makeRequest({ ...noBookingRef, status: 'COMPLETED' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain('bookingRef');
    });

    it('유효하지 않은 status면 400 반환', async () => {
      const req = makeRequest({ ...BASE_PAYLOAD, status: 'INVALID_STATUS' });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── 3. PENDING — 수신 기록만 ──────────────────────────────────────────────
  describe('PENDING 상태', () => {
    it('수신 기록하고 ok:true 반환, 커미션 처리 없음', async () => {
      const req = makeRequest({ ...BASE_PAYLOAD, status: 'PENDING', eventType: 'refund.requested' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.status).toBe('recorded');
      // $transaction 호출 없음 (커미션 역분개 없음)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // eventId 기록
      expect(mockPrisma.processedWebhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ webhookType: 'refund_pending' }) })
      );
    });
  });

  // ── 4. APPROVED 상태 ──────────────────────────────────────────────────────
  describe('APPROVED 상태', () => {
    it('Contact 상태 업데이트하고 ok:true 반환', async () => {
      (mockPrisma.affiliateSale.findUnique as jest.Mock).mockResolvedValue({ organizationId: 'org-test' });
      (mockPrisma.contact.findFirst as jest.Mock).mockResolvedValue({ id: 'contact-123' });

      const txMock = {
        contact: { update: jest.fn() },
        contactMemo: { create: jest.fn() },
        processedWebhookEvent: { create: jest.fn() },
      };
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(txMock));

      const req = makeRequest({ ...BASE_PAYLOAD, status: 'APPROVED', eventType: 'refund.approved' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.status).toBe('approved');
      expect(txMock.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastPaymentStatus: 'refund_approved' }) })
      );
    });
  });

  // ── 5. COMPLETED — 전체 환불 처리 ────────────────────────────────────────
  describe('COMPLETED 상태 (정상 환불)', () => {
    it('Contact REFUNDED + CommissionLedger REVERSAL 생성', async () => {
      const mockSale = {
        id: 'sale-1',
        saleAmount: 1_000_000,
        commissionAmount: 150_000,
        commissionRate: 15,
        organizationId: 'org-test',
      };
      (mockPrisma.affiliateSale.findUnique as jest.Mock)
        .mockResolvedValueOnce({ organizationId: 'org-test' }) // 조직 조회
        .mockResolvedValueOnce(mockSale); // 환불 처리용

      const mockContact = { id: 'contact-123', phone: '01012345678', name: '홍길동', userId: 'user-1' };
      (mockPrisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);

      const txMock = {
        contact: { update: jest.fn() },
        contactMemo: { create: jest.fn() },
        affiliateSale: { update: jest.fn() },
        commissionLedger: {
          findFirst: jest.fn().mockResolvedValue({ id: 'ledger-1', amount: 150_000, profileId: 1042 }),
          create: jest.fn(),
        },
        processedWebhookEvent: { create: jest.fn() },
      };
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(txMock));

      const req = makeRequest({ ...BASE_PAYLOAD, status: 'COMPLETED', eventType: 'refund.completed' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.contactFound).toBe(true);

      // Contact REFUNDED
      expect(txMock.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'REFUNDED' }) })
      );

      // REVERSAL amount 음수 확인
      const createCall = (txMock.commissionLedger.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.entryType).toBe('REVERSAL');
      expect(createCall.data.amount).toBeLessThan(0); // 반드시 음수

      // eventId 기록 (webhookType: refund_completed)
      expect(txMock.processedWebhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ webhookType: 'refund_completed' }) })
      );
    });

    it('Contact 없어도 200 반환 (contactFound: false)', async () => {
      (mockPrisma.affiliateSale.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      const txMock = {
        contact: { update: jest.fn() },
        contactMemo: { create: jest.fn() },
        affiliateSale: { update: jest.fn() },
        commissionLedger: { findFirst: jest.fn(), create: jest.fn() },
        processedWebhookEvent: { create: jest.fn() },
      };
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(txMock));

      const req = makeRequest({ ...BASE_PAYLOAD, status: 'COMPLETED' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.contactFound).toBe(false);
    });
  });

  // ── 6. REJECTED 상태 ──────────────────────────────────────────────────────
  describe('REJECTED 상태 (환불 거절)', () => {
    it('메모만 기록하고 커미션 REVERSAL 없음', async () => {
      (mockPrisma.affiliateSale.findUnique as jest.Mock).mockResolvedValue({ organizationId: 'org-test' });
      (mockPrisma.contact.findFirst as jest.Mock).mockResolvedValue({ id: 'contact-123' });

      const txMock = {
        contact: { update: jest.fn() },
        contactMemo: { create: jest.fn() },
        commissionLedger: { create: jest.fn() },
        processedWebhookEvent: { create: jest.fn() },
      };
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(txMock));

      const rejectedPayload = {
        eventId: 'evt_ref_20260602_002',
        bookingRef: 'CZ-2026-002',
        refundAmount: 500_000,
        refundReason: '정책_위반',
        customerPhone: '01098765432',
        customerName: '김철수',
        status: 'REJECTED',
        eventType: 'refund.rejected',
        metadata: { rejectionReason: '출발 1일 전 취소 불가' },
      };
      const req = makeRequest(rejectedPayload);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.status).toBe('rejected');

      // 커미션 역분개 없음
      expect(txMock.commissionLedger.create).not.toHaveBeenCalled();

      // Contact 상태 refund_rejected
      expect(txMock.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastPaymentStatus: 'refund_rejected' }) })
      );
    });
  });

  // ── 7. 중복 요청 멱등성 ───────────────────────────────────────────────────
  describe('중복 요청 (멱등성)', () => {
    it('같은 eventId + status로 재요청 시 duplicate:true 반환 (200)', async () => {
      (mockPrisma.processedWebhookEvent.findUnique as jest.Mock).mockResolvedValue({
        eventId: 'evt_ref_20260602_001',
      });

      const req = makeRequest({ ...BASE_PAYLOAD, status: 'COMPLETED', eventType: 'refund.completed' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.duplicate).toBe(true);

      // 트랜잭션 없음 (중복 처리 차단)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('같은 eventId라도 다른 status면 별도 처리', async () => {
      // PENDING 이미 처리됨
      (mockPrisma.processedWebhookEvent.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.eventId_webhookType.webhookType === 'refund_pending') {
          return Promise.resolve({ eventId: 'evt_ref_20260602_001' });
        }
        return Promise.resolve(null); // COMPLETED는 미처리
      });

      (mockPrisma.affiliateSale.findUnique as jest.Mock).mockResolvedValue(null);
      const txMock = {
        contact: { update: jest.fn() },
        contactMemo: { create: jest.fn() },
        affiliateSale: { update: jest.fn() },
        commissionLedger: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
        processedWebhookEvent: { create: jest.fn() },
      };
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(txMock));

      const req = makeRequest({ ...BASE_PAYLOAD, status: 'COMPLETED', eventType: 'refund.completed' });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      // 중복이 아님 → 정상 처리
      expect(data.duplicate).toBeUndefined();
      expect(data.ok).toBe(true);
    });
  });

  // ── 8. 하위호환 — orderId 폴백 ────────────────────────────────────────────
  describe('하위 호환성', () => {
    it('bookingRef 대신 orderId 전달해도 처리됨', async () => {
      const legacyPayload = {
        eventId: 'evt_legacy_001',
        orderId: 'CZ-2026-LEGACY',   // bookingRef 대신 orderId
        buyerPhone: '01011112222',    // customerPhone 대신 buyerPhone
        reason: '취소요청',           // refundReason 대신 reason
        amount: 800_000,              // refundAmount 대신 amount
        status: 'COMPLETED',
        refundedAt: '2026-06-02T10:00:00Z',
      };

      (mockPrisma.affiliateSale.findUnique as jest.Mock).mockResolvedValue(null);
      const txMock = {
        contact: { update: jest.fn() },
        contactMemo: { create: jest.fn() },
        affiliateSale: { update: jest.fn() },
        commissionLedger: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
        processedWebhookEvent: { create: jest.fn() },
      };
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(txMock));

      const req = makeRequest(legacyPayload);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });
});
