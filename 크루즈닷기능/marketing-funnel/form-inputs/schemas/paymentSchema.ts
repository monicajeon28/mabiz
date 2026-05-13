import { z } from 'zod';

// ============================================================================
// 결제 생성 스키마 (POST /api/payment/create)
// ============================================================================

export const createPaymentSchema = z.object({
  productCode: z.string()
    .min(6, '상품 코드는 최소 6자 이상이어야 합니다')
    .max(12, '상품 코드는 최대 12자 이하여야 합니다')
    .regex(/^[A-Z0-9_-]+$/, '상품 코드는 영문 대문자, 숫자, -, _만 포함해야 합니다'),
  quantity: z.number()
    .int('수량은 정수여야 합니다')
    .min(1, '수량은 최소 1개 이상이어야 합니다')
    .max(100, '수량은 최대 100개 이하여야 합니다'),
  idempotencyKey: z.string()
    .uuid('멱등성 키는 UUID 형식이어야 합니다'),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ============================================================================
// 환불 스키마 (POST /api/payment/[id]/refund)
// ============================================================================

export const refundPaymentSchema = z.object({
  refundAmount: z.number()
    .int('환불액은 정수여야 합니다')
    .positive('환불액은 0보다 커야 합니다')
    .max(10_000_000, '환불액은 최대 1천만원 이하여야 합니다'),
  refundReason: z.enum([
    'CUSTOMER_REQUEST',
    'SYSTEM_ERROR',
    'DUPLICATE_CHARGE',
    'PAYMENT_CANCELLATION',
    'OTHER',
  ])
    .default('CUSTOMER_REQUEST')
    .optional(),
  reason: z.string()
    .min(5, '환불 사유는 최소 5자 이상이어야 합니다')
    .max(500, '환불 사유는 최대 500자 이하여야 합니다'),
});

export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

// ============================================================================
// PayApp Webhook 스키마 (POST /api/webhook/payapp)
// ============================================================================

export const payAppWebhookSchema = z.object({
  userid: z.string().min(1, 'userid 필수'),
  linkkey: z.string().min(1, 'linkkey 필수'),
  linkval: z.string().min(1, 'linkval 필수'),
  goodname: z.string().optional(),
  price: z.string().optional(),
  recvphone: z.string().optional(),
  var1: z.string().optional(), // orderId
  var2: z.string().optional(), // landingPageSlug
  mul_no: z.string().optional(),
  payurl: z.string().optional(),
  csturl: z.string().optional(),
  pay_date: z.string().optional(),
  pay_state: z.string().optional(),
  pay_type: z.string().optional(),
  card_name: z.string().optional(),
  memo: z.string().optional(),
  reqaddr: z.string().optional(),
});

export type PayAppWebhookInput = z.infer<typeof payAppWebhookSchema>;

// ============================================================================
// WelcomePayments Webhook 스키마 (POST /api/payment/webhook/welcomepayments)
// ============================================================================

export const welcomePaymentsWebhookSchema = z.object({
  tid: z.string()
    .min(1, 'tid(거래 ID) 필수'),
  orderId: z.string()
    .min(1, 'orderId(주문 ID) 필수'),
  amount: z.union([z.string(), z.number()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .refine((val) => !isNaN(val) && val > 0, '금액은 0보다 커야 합니다'),
  status: z.enum(['paid', 'pending', 'failed', 'cancelled', 'refunded', 'partial_refunded'])
    .optional()
    .default('pending'),
  payMethod: z.string()
    .min(1, '결제 수단 필수')
    .optional(),
  approvalNumber: z.string()
    .optional(),
  merchantKey: z.string()
    .min(1, 'merchantKey(상인 키) 필수')
    .optional(),
  signature: z.string()
    .min(1, 'signature(서명) 필수'),
  paidAt: z.string()
    .datetime()
    .optional(),
  metadata: z.record(z.any())
    .optional(),
});

export type WelcomePaymentsWebhookInput = z.infer<typeof welcomePaymentsWebhookSchema>;

// ============================================================================
// Internal Payment Webhook 스키마 (POST /api/payment/webhook)
// 아임포트(iamport) 또는 내부 callback 라우트에서 호출
// ============================================================================

export const internalWebhookPayloadSchema = z.object({
  // PG 결제 고유 ID (아임포트 imp_uid 등)
  imp_uid: z.string()
    .min(1, 'imp_uid는 필수입니다')
    .max(200, 'imp_uid는 200자 이하여야 합니다'),
  // 주문번호
  merchant_uid: z.string()
    .min(1, 'merchant_uid는 필수입니다')
    .max(200, 'merchant_uid는 200자 이하여야 합니다'),
  // 결제 상태 (paid 만 처리)
  status: z.string()
    .min(1, 'status는 필수입니다'),
  // 결제 금액 (양의 정수, 최대 1억원)
  amount: z.number()
    .int('amount는 정수여야 합니다')
    .positive('amount는 0보다 커야 합니다')
    .max(100_000_000, 'amount는 최대 1억원 이하여야 합니다'),
  // 상품 코드
  productCode: z.string()
    .min(1, 'productCode는 필수입니다')
    .max(100, 'productCode는 100자 이하여야 합니다'),
  // 고객 정보 (선택)
  customerName: z.string()
    .max(100, '이름은 100자 이하여야 합니다')
    .optional()
    .nullable(),
  customerPhone: z.string()
    .max(20, '전화번호는 20자 이하여야 합니다')
    .optional()
    .nullable(),
  // 객실/요금 정보 (선택)
  cabinType: z.string().max(50).optional().nullable(),
  fareCategory: z.string().max(50).optional().nullable(),
  headcount: z.number().int().positive().max(100).optional().nullable(),
  costAmount: z.number().int().nonnegative().max(100_000_000).optional().nullable(),
  // 파트너 정보 (선택) — 4자리 문자열 코드
  affiliateCode: z.string()
    .max(20, 'affiliateCode는 20자 이하여야 합니다')
    .optional()
    .nullable(),
  affiliateMallUserId: z.string()
    .max(100, 'affiliateMallUserId는 100자 이하여야 합니다')
    .optional()
    .nullable(),
  _partnerSource: z.string().max(100).optional().nullable(),
  // 추가 메타데이터
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type InternalWebhookPayload = z.infer<typeof internalWebhookPayloadSchema>;
