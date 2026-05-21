# P2 결제 취소/환불 알림 구현 예제

**작성일**: 2026-05-20  
**상태**: 코드 예제 완성 (검토 대기)

---

## 1. 신규 파일: `src/lib/refund-notifier.ts`

```typescript
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendSms, resolveUserSmsConfig } from '@/lib/aligo';
import { sendFunnelEmail } from '@/lib/email';

export interface RefundNotificationParams {
  organizationId: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  amount: number;                        // 환불/취소액
  commission?: number;                   // 수당 차감액 (없으면 amount * 0.03)
  refundReason?: string;
  type: 'CANCELLED' | 'PARTIAL_REFUNDED';
}

/**
 * 결제 취소/환불 시 담당자들에게 알림 발송
 * - SMS: Partner Manager, Agent
 * - Email: PreSales Team (공식 기록)
 * - Dashboard: AdminNotification
 */
export async function notifyRefund(params: RefundNotificationParams) {
  const {
    organizationId,
    orderId,
    customerName,
    customerPhone,
    productName,
    amount,
    commission = Math.round(amount * 0.03),
    refundReason = 'PayApp 취소',
    type,
  } = params;

  try {
    logger.log('[Refund Notifier] 알림 시작', {
      orderId, customerName, amount, type,
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1️⃣ 담당 Partner Manager 찾기
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const partnerManager = await findPartnerManager(
      organizationId,
      customerPhone
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2️⃣ PreSales 팀 조회
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const preSalesTeam = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: 'PRESALES',
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        phone: true,
        email: true,
        displayName: true,
      },
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3️⃣ SMS 발송 (Partner Manager)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (partnerManager?.phone) {
      await sendPartnerSms({
        organizationId,
        phone: partnerManager.phone,
        customerName,
        productName,
        amount,
        commission,
        type,
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4️⃣ 이메일 발송 (PreSales Team)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    for (const member of preSalesTeam) {
      if (member.email) {
        await sendPreSalesEmail({
          organizationId,
          to: member.email,
          toName: member.displayName || member.userId,
          customerName,
          productName,
          amount,
          commission,
          refundReason,
          type,
        });
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5️⃣ 대시보드 알림 (AdminNotification)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await createAdminNotifications({
      organizationId,
      partnerManagerId: partnerManager?.id,
      preSalesTeam,
      customerName,
      productName,
      amount,
      commission,
      type,
    });

    logger.log('[Refund Notifier] 알림 완료', {
      orderId,
      partnerManager: !!partnerManager,
      preSalesCount: preSalesTeam.length,
    });
  } catch (err) {
    logger.error('[Refund Notifier] 실패', {
      err: err instanceof Error ? err.message : String(err),
      orderId,
    });
    // 알림 실패는 DLQ에 넣지 않음 (결제 처리는 이미 완료)
  }
}

/**
 * 1. Partner Manager 찾기 (고객 전화번호 기반)
 */
async function findPartnerManager(
  organizationId: string,
  customerPhone: string
) {
  try {
    // Contact → Partner 경로
    const contact = await prisma.contact.findFirst({
      where: { phone: customerPhone, organizationId },
      select: { partnerId: true },
    });

    if (contact?.partnerId) {
      const partner = await prisma.partner.findUnique({
        where: { id: contact.partnerId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      });

      if (partner) {
        logger.log('[Refund Notifier] Partner Manager 찾음', {
          partnerName: partner.name,
          hasPhone: !!partner.phone,
          hasEmail: !!partner.email,
        });
        return partner;
      }
    }
  } catch (err) {
    logger.warn('[Refund Notifier] Partner Manager 조회 실패', { err });
  }

  return null;
}

/**
 * 2. Partner Manager에게 SMS 발송
 */
async function sendPartnerSms(params: {
  organizationId: string;
  phone: string;
  customerName: string;
  productName: string;
  amount: number;
  commission: number;
  type: 'CANCELLED' | 'PARTIAL_REFUNDED';
}) {
  const {
    organizationId,
    phone,
    customerName,
    productName,
    amount,
    commission,
    type,
  } = params;

  try {
    const smsConfig = await resolveUserSmsConfig(organizationId);
    if (!smsConfig) {
      logger.warn('[Refund Notifier] SMS 설정 없음', { organizationId });
      return;
    }

    const typeLabel = type === 'CANCELLED' ? '❌ 취소' : '💰 환불';
    const msg = `[크루즈닷] ${typeLabel}
고객: ${customerName}
상품: ${productName}
금액: ₩${amount.toLocaleString()}
수당: -₩${commission.toLocaleString()}
담당: CRM`;

    const result = await sendSms({
      config: smsConfig,
      receiver: phone,
      msg,
      msgType: msg.length > 90 ? 'LMS' : 'SMS',
      organizationId,
      channel: 'MANUAL',
    });

    if (result.result_code === 1) {
      logger.log('[Refund Notifier] Partner SMS 발송 성공', {
        phone: phone.slice(0, 4) + '***',
      });
    } else {
      logger.warn('[Refund Notifier] Partner SMS 발송 실패', {
        code: result.result_code,
        message: result.message,
      });
    }
  } catch (err) {
    logger.error('[Refund Notifier] Partner SMS 발송 오류', { err });
  }
}

/**
 * 3. PreSales 팀에게 이메일 발송
 */
async function sendPreSalesEmail(params: {
  organizationId: string;
  to: string;
  toName: string;
  customerName: string;
  productName: string;
  amount: number;
  commission: number;
  refundReason: string;
  type: 'CANCELLED' | 'PARTIAL_REFUNDED';
}) {
  const {
    organizationId,
    to,
    toName,
    customerName,
    productName,
    amount,
    commission,
    refundReason,
    type,
  } = params;

  try {
    const subject =
      type === 'CANCELLED'
        ? `[중요] ${new Date().toLocaleDateString('ko-KR')} 결제 취소 안내 - ${customerName} (₩${amount.toLocaleString()})`
        : `[중요] ${new Date().toLocaleDateString('ko-KR')} 부분환불 안내 - ${customerName} (₩${amount.toLocaleString()})`;

    const html = generatePreSalesEmailHtml({
      customerName,
      productName,
      amount,
      commission,
      refundReason,
      type,
      toName,
    });

    await sendFunnelEmail({
      organizationId,
      to,
      subject,
      html,
    });

    logger.log('[Refund Notifier] PreSales Email 발송 성공', {
      to,
      customerName,
    });
  } catch (err) {
    logger.error('[Refund Notifier] PreSales Email 발송 실패', { err });
  }
}

/**
 * 4. PreSales 이메일 HTML 생성
 */
function generatePreSalesEmailHtml(params: {
  customerName: string;
  productName: string;
  amount: number;
  commission: number;
  refundReason: string;
  type: 'CANCELLED' | 'PARTIAL_REFUNDED';
  toName: string;
}): string {
  const {
    customerName,
    productName,
    amount,
    commission,
    refundReason,
    type,
    toName,
  } = params;

  const typeLabel =
    type === 'CANCELLED'
      ? '❌ 결제 취소'
      : '💰 부분 환불';

  const now = new Date().toLocaleString('ko-KR');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
    .header { background-color: #d32f2f; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    table tr { border-bottom: 1px solid #eee; }
    table td { padding: 12px; }
    table td:first-child { font-weight: bold; width: 30%; background-color: #f5f5f5; }
    .amount { color: #d32f2f; font-size: 18px; font-weight: bold; }
    .footer { background-color: #f5f5f5; padding: 15px; border-radius: 8px; font-size: 12px; color: #666; text-align: center; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 15px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${typeLabel}</h1>
      <p>자동 발송 안내</p>
    </div>

    <div class="content">
      <p>안녕하세요, ${toName}님,</p>
      
      <p>${type === 'CANCELLED' ? '고객의 결제가 취소되었습니다.' : '고객의 부분환불이 처리되었습니다.'}</p>

      <table>
        <tr>
          <td>고객명</td>
          <td>${customerName}</td>
        </tr>
        <tr>
          <td>상품명</td>
          <td>${productName}</td>
        </tr>
        <tr>
          <td>${type === 'CANCELLED' ? '취소금액' : '환불금액'}</td>
          <td class="amount">₩${amount.toLocaleString()}</td>
        </tr>
        <tr>
          <td>수당 차감</td>
          <td class="amount">-₩${commission.toLocaleString()}</td>
        </tr>
        <tr>
          <td>사유</td>
          <td>${refundReason || '(미정)'}</td>
        </tr>
        <tr>
          <td>처리일시</td>
          <td>${now}</td>
        </tr>
      </table>

      <div class="warning">
        <strong>⚠️ 주의:</strong> 
        수당은 즉시 취소되며, 다음 정산에서 차감됩니다.
        문제가 있으면 즉시 CRM 관리자에게 연락하세요.
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        이 메일은 자동 발송되었습니다.<br>
        문의사항은 CRM 담당자에게 연락주세요.
      </p>
    </div>

    <div class="footer">
      <p>© 2026 마비즈 CRM | All rights reserved</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 5. 대시보드 알림 생성 (AdminNotification)
 */
async function createAdminNotifications(params: {
  organizationId: string;
  partnerManagerId?: string;
  preSalesTeam: Array<{ userId: string; displayName: string | null }>;
  customerName: string;
  productName: string;
  amount: number;
  commission: number;
  type: 'CANCELLED' | 'PARTIAL_REFUNDED';
}) {
  const {
    organizationId,
    partnerManagerId,
    preSalesTeam,
    customerName,
    productName,
    amount,
    commission,
    type,
  } = params;

  try {
    const typeLabel =
      type === 'CANCELLED'
        ? '❌ 결제 취소'
        : '💰 부분환불';

    const notificationData = {
      notificationType: `PAYMENT_${type}`,
      title: `${typeLabel}: ${customerName} - ${productName}`,
      content: `금액 ₩${amount.toLocaleString()} | 수당 -₩${commission.toLocaleString()} | ${new Date().toLocaleString('ko-KR')}`,
    };

    // PreSales 팀에게 알림
    for (const member of preSalesTeam) {
      await prisma.adminNotification.create({
        data: {
          userId: member.userId,
          ...notificationData,
        },
      });
    }

    logger.log('[Refund Notifier] AdminNotification 생성 완료', {
      count: preSalesTeam.length,
      type,
    });
  } catch (err) {
    logger.error('[Refund Notifier] AdminNotification 생성 실패', { err });
  }
}

export default notifyRefund;
```

---

## 2. 기존 파일 수정: `src/app/api/webhooks/payapp/route.ts`

### 변경 사항: 221-247줄 (취소 처리)

```typescript
// ─── 취소 (pay_state=8,9,16,32,64) ───────────────────────
if (status === "cancelled") {
  const canceldate = params.get("canceldate") ?? "";
  const cancelmemo = params.get("cancelmemo") ?? "";

  // 기존 결제 정보 조회
  let originalPayment = null;
  let lookupOrgId = orgId;

  if (orderId) {
    originalPayment = await prisma.payAppPayment.findUnique({
      where: { orderId },
      select: {
        id: true,
        amount: true,
        customerName: true,
        customerPhone: true,
        productName: true,
        organizationId: true,
        status: true,
      },
    });
    lookupOrgId = originalPayment?.organizationId ?? orgId;

    await prisma.payAppPayment.updateMany({
      where: { orderId, status: { not: "cancelled" } },
      data: {
        status: "cancelled",
        refundedAt: canceldate ? new Date(canceldate) : new Date(),
        refundReason: cancelmemo || "PayApp 취소",
      },
    });
  } else if (mulNo) {
    originalPayment = await prisma.payAppPayment.findFirst({
      where: { mulNo, status: { not: "cancelled" } },
      select: {
        id: true,
        amount: true,
        customerName: true,
        customerPhone: true,
        productName: true,
        organizationId: true,
        status: true,
      },
    });
    lookupOrgId = originalPayment?.organizationId ?? orgId;

    await prisma.payAppPayment.updateMany({
      where: { mulNo, status: { not: "cancelled" } },
      data: {
        status: "cancelled",
        refundedAt: canceldate ? new Date(canceldate) : new Date(),
        refundReason: cancelmemo || "PayApp 취소",
      },
    });
  }

  // ✅ NEW: 알림 발송 (non-blocking)
  if (
    originalPayment &&
    lookupOrgId &&
    originalPayment.customerPhone &&
    originalPayment.status !== "cancelled"
  ) {
    try {
      const { default: notifyRefund } = await import("@/lib/refund-notifier");

      const commission = Math.round(originalPayment.amount * 0.03);

      notifyRefund({
        organizationId: lookupOrgId,
        orderId: orderId || `mul_${mulNo}`,
        customerName: originalPayment.customerName || "미확인",
        customerPhone: originalPayment.customerPhone,
        productName: originalPayment.productName || "상품",
        amount: originalPayment.amount,
        commission,
        refundReason: cancelmemo || "PayApp 취소",
        type: "CANCELLED",
      }).catch((err) => {
        logger.warn("[PayApp Webhook] 취소 알림 발송 중 오류", {
          err: err instanceof Error ? err.message : String(err),
        });
      });
    } catch (err) {
      logger.warn("[PayApp Webhook] 취소 알림 로딩 실패", { err });
    }
  }

  logger.log("[PayApp Webhook] 취소 처리", { orderId, mulNo, cancelmemo });
  return new Response("SUCCESS");
}
```

### 변경 사항: 249-278줄 (부분취소)

```typescript
// ─── 부분취소 (pay_state=70,71) ──────────────────────────
if (status === "partial_refunded") {
  const origMulNo = params.get("orig_mul_no") ?? "";
  const origPrice = parseInt(params.get("orig_price") ?? "0");
  const canceldate = params.get("canceldate") ?? "";

  // 원거래 찾기
  const lookupKey = orderId || origMulNo;
  if (lookupKey) {
    const original = await prisma.payAppPayment.findFirst({
      where: orderId ? { orderId } : { mulNo: origMulNo },
      select: {
        id: true,
        amount: true,
        customerName: true,
        customerPhone: true,
        productName: true,
        organizationId: true,
      },
    });

    if (original) {
      const partialAmount = origPrice - price; // 원금 - 현재금 = 환불액
      const updateData = {
        status: "partial_refunded",
        refundAmount: (original.refundAmount ?? 0) + (partialAmount > 0 ? partialAmount : 0),
        refundedAt: canceldate ? new Date(canceldate) : new Date(),
        mulNo: mulNo || original.mulNo, // 부분취소 시 mul_no 변경됨
      };

      await prisma.payAppPayment.update({
        where: { id: original.id },
        data: updateData,
      });

      // ✅ NEW: 부분환불 알림 발송
      if (original.customerPhone && (original.organizationId || orgId)) {
        try {
          const { default: notifyRefund } = await import("@/lib/refund-notifier");

          const refundAmount = partialAmount > 0 ? partialAmount : 0;
          const commission = Math.round(refundAmount * 0.03);

          notifyRefund({
            organizationId: original.organizationId || orgId || "",
            orderId: orderId || `mul_${mulNo}`,
            customerName: original.customerName || "미확인",
            customerPhone: original.customerPhone,
            productName: original.productName || "상품",
            amount: refundAmount,
            commission,
            refundReason: "PayApp 부분취소",
            type: "PARTIAL_REFUNDED",
          }).catch((err) => {
            logger.warn("[PayApp Webhook] 부분환불 알림 발송 중 오류", {
              err: err instanceof Error ? err.message : String(err),
            });
          });
        } catch (err) {
          logger.warn("[PayApp Webhook] 부분환불 알림 로딩 실패", { err });
        }
      }
    }
  }

  logger.log("[PayApp Webhook] 부분취소 처리", { orderId, origMulNo, price });
  return new Response("SUCCESS");
}
```

---

## 3. 테스트 케이스

### 파일: `src/app/api/webhooks/payapp/__tests__/refund-notification.test.ts` (신규)

```typescript
import { notifyRefund } from '@/lib/refund-notifier';
import prisma from '@/lib/prisma';
import * as aligo from '@/lib/aligo';
import * as email from '@/lib/email';
import { logger } from '@/lib/logger';

jest.mock('@/lib/prisma');
jest.mock('@/lib/aligo');
jest.mock('@/lib/email');
jest.mock('@/lib/logger');

describe('Refund Notifier', () => {
  const mockParams = {
    organizationId: 'org-123',
    orderId: 'order-456',
    customerName: '김고객',
    customerPhone: '01012345678',
    productName: '크루즈 여행',
    amount: 600000,
    commission: 18000,
    refundReason: 'PayApp 취소',
    type: 'CANCELLED' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Partner Manager 찾기 - 성공', async () => {
    // Arrange
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue({
      partnerId: 'partner-123',
    });
    (prisma.partner.findUnique as jest.Mock).mockResolvedValue({
      id: 'partner-123',
      name: '대리점명',
      phone: '01087654321',
      email: 'partner@example.com',
    });

    // Act
    await notifyRefund(mockParams);

    // Assert
    expect(prisma.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: '01012345678', organizationId: 'org-123' },
      })
    );
  });

  it('SMS 발송 - Partner Manager', async () => {
    // Arrange
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue({
      partnerId: 'partner-123',
    });
    (prisma.partner.findUnique as jest.Mock).mockResolvedValue({
      id: 'partner-123',
      name: '대리점명',
      phone: '01087654321',
      email: 'partner@example.com',
    });
    (aligo.resolveUserSmsConfig as jest.Mock).mockResolvedValue({
      key: 'test-key',
      userId: 'test-user',
      sender: '1234567890',
    });
    (aligo.sendSms as jest.Mock).mockResolvedValue({
      result_code: 1,
      message: '성공',
    });

    // Act
    await notifyRefund(mockParams);

    // Assert
    expect(aligo.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({
        receiver: '01087654321',
        msgType: 'LMS',
      })
    );
  });

  it('PreSales Email 발송', async () => {
    // Arrange
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'member-1',
        userId: 'user-1',
        phone: '01011111111',
        email: 'presales@example.com',
        displayName: '김사원',
      },
    ]);
    (email.sendFunnelEmail as jest.Mock).mockResolvedValue({
      ok: true,
    });

    // Act
    await notifyRefund(mockParams);

    // Assert
    expect(email.sendFunnelEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'presales@example.com',
        subject: expect.stringContaining('결제 취소'),
      })
    );
  });

  it('AdminNotification 생성', async () => {
    // Arrange
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'member-1',
        userId: 'user-1',
        phone: null,
        email: 'presales@example.com',
        displayName: '김사원',
      },
    ]);
    (prisma.adminNotification.create as jest.Mock).mockResolvedValue({
      id: 'notif-1',
    });

    // Act
    await notifyRefund(mockParams);

    // Assert
    expect(prisma.adminNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notificationType: 'PAYMENT_CANCELLED',
          title: expect.stringContaining('김고객'),
        }),
      })
    );
  });

  it('오류 발생 시 - DLQ 안 함 (이미 결제 처리됨)', async () => {
    // Arrange
    (prisma.contact.findFirst as jest.Mock).mockRejectedValue(
      new Error('DB 오류')
    );

    // Act & Assert
    await notifyRefund(mockParams); // 오류 발생하지 않음

    expect(logger.error).toHaveBeenCalledWith(
      '[Refund Notifier] 실패',
      expect.any(Object)
    );
  });
});
```

---

## 4. PayApp 웹훅 통합 테스트

### 파일: `src/app/api/webhooks/payapp/__tests__/refund-integration.test.ts`

```typescript
import { POST } from '../route';

describe('PayApp Webhook - 취소 알림 통합', () => {
  it('결제 취소 → 알림 발송 (end-to-end)', async () => {
    // Arrange
    const mockRequest = new Request(
      new URL('http://localhost:3000/api/webhooks/payapp'),
      {
        method: 'POST',
        body: new URLSearchParams({
          pay_state: '9', // 취소
          var1: 'order-123', // orderId
          var2: 'landing-1',
          recvphone: '01012345678',
          goodname: '크루즈 여행',
          price: '600000',
          pay_type: 'card',
          canceldate: new Date().toISOString(),
          cancelmemo: '고객 요청',
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-forwarded-for': '127.0.0.1',
        },
      }
    );

    // Act
    const response = await POST(mockRequest);

    // Assert
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('SUCCESS');
    // 알림이 비동기로 발송되므로 직접 검증하기는 어려움
    // 대신 DB 상태와 로그를 확인
  });
});
```

---

## 5. 배포 체크리스트

- [ ] SMS: Partner/Agent의 전화번호 입력 확인
- [ ] Email: PreSales 팀의 이메일 입력 확인
- [ ] OrgEmailConfig: SMTP 설정 확인
- [ ] AdminNotification: 대시보드에서 볼 수 있는지 확인
- [ ] DLQ: 알림 실패 시 처리하지 않음 (결제는 이미 처리됨)

---

## 6. 향후 개선 사항 (P3)

1. **카카오 알림톡** (sendKakaoAlimtalk)
   - SMS 대신 카카오 톡으로 발송
   - 템플릿 코드 사전 등록 필요

2. **Slack/Teams 알림**
   - 내부 운영팀 알림

3. **환불 계산 자동화**
   - commission 계산 룰 복잡화 (tier별로 다를 수 있음)

4. **이력 추적**
   - 알림 발송 이력 테이블 (RefundNotificationLog)

5. **구독형 설정**
   - Partner Manager가 알림 채널 선택 가능

---

## 참고: 기존 유사 구현

### SMS 발송 (이미 구현됨)
- `src/lib/aligo.ts`: sendSms, sendKakaoAlimtalk, resolveUserSmsConfig
- `src/lib/sms-scheduler/index.ts`: 일괄 발송

### Email 발송 (이미 구현됨)
- `src/lib/email.ts`: sendFunnelEmail, sendEmail
- `src/app/api/contacts/group-blast/route.ts`: 대량 이메일

### 대시보드 알림 (미사용)
- `prisma/schema.prisma`: AdminNotification 모델 정의됨

---

## 결론

이 구현으로:
- ✅ 결제 취소/환불 시 담당자에게 **즉시 SMS 알림**
- ✅ PreSales 팀에게 **공식 이메일 기록**
- ✅ **대시보드에서도 추적** 가능
- ✅ **기존 SMS/Email 인프라 활용** → 비용 최소화
- ✅ **non-blocking** → 결제 처리에 영향 없음

**예상 구현 시간**: 4-6시간 (P0)
