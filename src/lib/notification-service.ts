import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface CreateRefundNotificationParams {
  organizationId: string;
  orderId: string;
  customerName: string;
  refundAmount: number;
  refundReason?: string;
  type: 'full_refund' | 'partial_refund' | 'payment_cancelled';
}

export async function createRefundNotifications({
  organizationId,
  orderId,
  customerName,
  refundAmount,
  refundReason,
  type,
}: CreateRefundNotificationParams) {
  try {
    // 조직의 관리자(OWNER/ADMIN) 찾기
    const adminUsers = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { userId: true },
    });

    if (adminUsers.length === 0) {
      logger.warn('[RefundNotification] 관리자 없음', { organizationId });
      return;
    }

    const typeConfig: Record<
      string,
      { notificationType: string; title: string; priority: string }
    > = {
      full_refund: {
        notificationType: 'REFUND_CUSTOMER_REQUEST',
        title: `[수당 취소] 환불 완료 - ${customerName}`,
        priority: 'high',
      },
      partial_refund: {
        notificationType: 'REFUND_PARTIAL_REFUND',
        title: `[수당 감액] 부분취소 - ${customerName}`,
        priority: 'normal',
      },
      payment_cancelled: {
        notificationType: 'REFUND_PAYMENT_CANCELLED_PAYAPP',
        title: `[수당 취소] 결제 취소 - ${customerName}`,
        priority: 'high',
      },
    };

    const config = typeConfig[type];

    const content = [
      type === 'full_refund'
        ? '고객 환불로 수당이 100% 취소되었습니다.'
        : type === 'partial_refund'
          ? '부분취소로 수당이 감액되었습니다.'
          : '결제 취소로 수당이 100% 취소되었습니다.',
      '',
      `환불액: ${refundAmount.toLocaleString()}원`,
      refundReason ? `사유: ${refundReason}` : null,
      `주문번호: ${orderId}`,
    ]
      .filter(Boolean)
      .join('\n');

    // 각 관리자에게 알림 생성
    await Promise.all(
      adminUsers.map(({ userId }) =>
        prisma.adminNotification.create({
          data: {
            userId: parseInt(userId, 10),
            notificationType: config.notificationType,
            title: config.title,
            content,
            priority: config.priority,
            metadata: {
              orderId,
              organizationId,
              refundAmount,
              customerName,
              refundReason,
            },
          },
        })
      )
    );

    logger.log('[RefundNotification] 알림 생성 완료', {
      organizationId,
      orderId,
      notificationCount: adminUsers.length,
      type,
    });
  } catch (err) {
    logger.error('[RefundNotification] 알림 생성 실패', { err, orderId });
  }
}
