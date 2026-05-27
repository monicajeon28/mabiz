import { logger } from "@/lib/logger";

export interface RealtimeNotification {
  id: string;
  userId: string;
  type: "ALERT" | "INFO" | "SUCCESS" | "WARNING";
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  channels: ("BROWSER" | "SLACK" | "SMS" | "EMAIL")[];
  createdAt: Date;
  expiresAt?: Date;
  read: boolean;
}

export interface NotificationChannel {
  type: "BROWSER" | "SLACK" | "SMS" | "EMAIL";
  enabled: boolean;
  config: Record<string, any>;
}

/**
 * Critical alerts that need immediate attention
 */
export const CRITICAL_ALERTS = {
  PARTNER_CHURN_RISK: {
    title: "🚨 파트너 이탈 위험",
    message: "{{partnerName}}의 판매가 급감했습니다 (지난 30일 60% 감소)",
    priority: "CRITICAL",
    channels: ["BROWSER", "SLACK", "SMS"],
  },

  CONTACT_AT_RISK: {
    title: "⚠️ 고객 손실 위험",
    message: "{{contactName}}님이 구매 거절 위험군입니다 (예상 확률 85%)",
    priority: "CRITICAL",
    channels: ["BROWSER", "SLACK"],
  },

  PAYMENT_OVERDUE: {
    title: "💳 결제 미달",
    message: "{{contactName}}님 결제가 {{daysOverdue}}일 지연 중입니다",
    priority: "HIGH",
    channels: ["BROWSER", "SMS"],
  },

  SETTLEMENT_OVERDUE: {
    title: "📊 정산금 미지급",
    message: "{{partnerName}}님 {{month}}월 정산금 ({{amount}}) 지급 대기 중",
    priority: "HIGH",
    channels: ["BROWSER", "SLACK"],
  },

  SYSTEM_ERROR: {
    title: "🔴 시스템 오류",
    message: "{{serviceName}}에서 오류 발생: {{errorMessage}}",
    priority: "CRITICAL",
    channels: ["BROWSER", "SLACK", "EMAIL"],
  },

  COMPLIANCE_ISSUE: {
    title: "⚖️ 규정 준수 이슈",
    message: "GDPR 준수 점수 {{score}}/100 - 조치 필요",
    priority: "HIGH",
    channels: ["BROWSER", "EMAIL"],
  },
};

/**
 * Informational notifications (low priority)
 */
export const INFO_ALERTS = {
  DAILY_SUMMARY: {
    title: "📊 오늘의 요약",
    message: "신규 고객: {{newContacts}}, 매출: {{revenue}}, 활성 콜: {{calls}}",
    priority: "LOW",
    channels: ["BROWSER"],
  },

  MILESTONE_ACHIEVED: {
    title: "🎉 마일스톤 달성!",
    message: "오늘 {{newContacts}}명의 신규 고객을 받았습니다! 축하합니다!",
    priority: "MEDIUM",
    channels: ["BROWSER", "SLACK"],
  },

  PARTNER_TIER_UPGRADED: {
    title: "🌟 파트너 등급 상향!",
    message: "{{partnerName}}님이 {{previousTier}} → {{newTier}} 등급으로 승격했습니다!",
    priority: "MEDIUM",
    channels: ["BROWSER", "EMAIL"],
  },

  FORECAST_UPDATE: {
    title: "📈 월간 예상 수익 업데이트",
    message: "예상 월간 수익: {{forecastedRevenue}} (지난달 대비 {{growth}}% 증가)",
    priority: "LOW",
    channels: ["BROWSER"],
  },
};

/**
 * Delivery status notifications
 */
export async function sendNotification(
  notification: RealtimeNotification
): Promise<{
  success: boolean;
  delivery: Record<string, boolean>;
}> {
  const delivery: Record<string, boolean> = {};

  for (const channel of notification.channels) {
    try {
      switch (channel) {
        case "BROWSER":
          await sendBrowserNotification(notification);
          delivery[channel] = true;
          break;
        case "SLACK":
          await sendSlackNotification(notification);
          delivery[channel] = true;
          break;
        case "SMS":
          await sendSMSNotification(notification);
          delivery[channel] = true;
          break;
        case "EMAIL":
          await sendEmailNotification(notification);
          delivery[channel] = true;
          break;
      }
    } catch (err) {
      logger.error(`[Notification] ${channel} delivery failed`, { err });
      delivery[channel] = false;
    }
  }

  return {
    success: Object.values(delivery).some((v) => v),
    delivery,
  };
}

async function sendBrowserNotification(
  notification: RealtimeNotification
): Promise<void> {
  // TODO: Use WebSocket or Server-Sent Events (SSE)
  // to push notification to connected browser clients
  logger.log("[Notification] Browser notification", {
    userId: notification.userId,
    title: notification.title,
  });
}

async function sendSlackNotification(
  notification: RealtimeNotification
): Promise<void> {
  // TODO: Call Slack Webhook API
  // POST to SLACK_WEBHOOK_URL with message block
  logger.log("[Notification] Slack notification", {
    title: notification.title,
    channel: notification.type,
  });
}

async function sendSMSNotification(
  notification: RealtimeNotification
): Promise<void> {
  // TODO: Send via Aligo SMS API
  // Only for CRITICAL priority notifications
  logger.log("[Notification] SMS notification", {
    title: notification.title,
    priority: notification.priority,
  });
}

async function sendEmailNotification(
  notification: RealtimeNotification
): Promise<void> {
  // TODO: Send via SendGrid or similar
  // Generate HTML email template
  logger.log("[Notification] Email notification", {
    title: notification.title,
    message: notification.message,
  });
}

/**
 * Notification aggregation: combine multiple alerts into digest
 */
export function aggregateNotifications(
  notifications: RealtimeNotification[]
): {
  critical: RealtimeNotification[];
  summary: string;
  actionItems: string[];
} {
  const critical = notifications.filter((n) => n.priority === "CRITICAL");

  const summary = `${notifications.length}개의 알림 (${critical.length}개 긴급)`;

  const actionItems = critical.map(
    (n) => `${n.title}: ${n.message}`
  );

  return { critical, summary, actionItems };
}

/**
 * Notification scheduling with intelligent timing
 * - Don't send too many notifications in short period
 * - Batch multiple alerts into summary at end of day
 * - Respect user's timezone for delivery timing
 */
export function calculateOptimalDeliveryTime(
  notification: RealtimeNotification,
  userTimezone: string
): Date {
  const now = new Date();
  const hours = now.getHours();

  // CRITICAL alerts: send immediately
  if (notification.priority === "CRITICAL") {
    return now;
  }

  // MEDIUM alerts: send during business hours (9 AM - 6 PM)
  if (notification.priority === "MEDIUM") {
    if (hours < 9 || hours > 18) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }
    return now;
  }

  // LOW alerts: batch for daily summary (8 PM)
  const deliveryTime = new Date(now);
  if (hours >= 20) {
    deliveryTime.setDate(deliveryTime.getDate() + 1);
  }
  deliveryTime.setHours(20, 0, 0, 0);

  return deliveryTime;
}

/**
 * Opt-in/out management for notification types
 */
export interface NotificationPreferences {
  userId: string;
  channels: Record<string, boolean>;
  alertTypes: Record<string, boolean>;
  quietHours: { startHour: number; endHour: number }; // e.g., 22-8 (10 PM - 8 AM)
  timezone: string;
}

export function shouldSendNotification(
  notification: RealtimeNotification,
  preferences: NotificationPreferences
): boolean {
  // Check channel preference
  const channelEnabled = notification.channels.some((c) =>
    preferences.channels[c]
  );
  if (!channelEnabled) return false;

  // Check alert type preference
  const alertTypeKey = notification.type.toLowerCase();
  if (preferences.alertTypes[alertTypeKey] === false) return false;

  // Check quiet hours (but allow CRITICAL to bypass)
  if (notification.priority !== "CRITICAL") {
    const now = new Date();
    const currentHour = now.getHours();
    const inQuietHours =
      currentHour >= preferences.quietHours.startHour ||
      currentHour < preferences.quietHours.endHour;
    if (inQuietHours) return false;
  }

  return true;
}
