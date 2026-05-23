/**
 * Slack 알림 타입 정의
 */

export type { VerificationResult } from "./verification";

export interface SlackAttachment {
  fallback: string;
  color: string;
  title: string;
  text: string;
  ts: number;
  footer: string;
  footer_icon?: string;
}

export interface SlackNotificationPayload {
  text: string;
  attachments: SlackAttachment[];
}

export interface SlackNotification {
  type:
    | "DAILY_VERIFICATION"
    | "CRITICAL_ROLLBACK"
    | "ERROR_ROLLBACK"
    | "RECOVERY_STARTED"
    | "RECOVERY_COMPLETED";
  message: string;
  details?: any;
}
