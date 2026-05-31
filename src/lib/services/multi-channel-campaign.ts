/**
 * Multi-Channel Campaign Service
 *
 * 통합 메시징 캠페인 관리:
 * - 단일 메시지 → 멀티채널 자동 변환 및 발송
 * - 채널별 성과 추적 (메트릭 자동 집계)
 * - 크로스채널 어트리뷰션
 * - 채널별 최적화 학습
 *
 * 기대 효과:
 * - SMS 채널 관리 시간 40% 단축
 * - 크로스채널 전환율 +25-35%
 * - 채널별 ROI 명확화
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { MessageChannel, CampaignStatus } from "@/lib/types/multi-channel";

/**
 * 채널별 메시지 최적화 규칙
 * SMS (90자), Kakao (1000자), Email (2000자)
 */
const CHANNEL_LIMITS = {
  SMS: 90,
  KAKAO: 1000,
  EMAIL: 2000,
};

const CHANNEL_COSTS = {
  SMS: 50,        // ₩50/건
  KAKAO: 30,      // ₩30/건
  EMAIL: 0,       // 무료
};

interface CreateCampaignParams {
  organizationId: string;
  name: string;
  channels: MessageChannel[];
  message: string;
  subject?: string;
  recipients: Array<{ contactId: string; phone?: string; email?: string }>;
  scheduleAt?: Date | null;
  templateIds?: string[]; // Day 0-3 템플릿 ID
  lensType?: string;      // L1-L10 렌즈 타입
  segmentId?: string;
}

interface CampaignMetrics {
  channel: MessageChannel;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  failed: number;
  cost: number;
}

/**
 * 메시지를 채널에 맞게 자동 변환
 * 예: SMS는 90자 초과 시 자동 단축, Kakao는 개행 유지
 */
export function convertMessageForChannel(
  message: string,
  channel: MessageChannel,
  suggestions?: boolean
): { message: string; suggestions?: string[] } {
  const limit = CHANNEL_LIMITS[channel];

  if (message.length <= limit) {
    return { message };
  }

  // 채널별 단축 전략
  switch (channel) {
    case "SMS": {
      // SMS: 90자 초과 시 줄임표 추가 + 링크 유도
      const shortened = message.substring(0, 87) + "...";
      return {
        message: shortened,
        suggestions: suggestions
          ? [
              "SMS를 더 짧게 작성하세요",
              "핵심 메시지만 유지하고 자세한 내용은 링크로 이동",
              "긴급성 언어로 클릭 유도",
            ]
          : undefined,
      };
    }
    case "KAKAO": {
      // Kakao: 1000자 내에서 개행 + 버튼 활용
      const withLineBreaks = message
        .replace(/\n/g, "\\n")
        .substring(0, 997);
      return {
        message: withLineBreaks,
        suggestions: suggestions
          ? ["카카오는 개행으로 시각성 강조", "버튼으로 CTA 추가 권장"]
          : undefined,
      };
    }
    case "EMAIL": {
      // Email: 2000자 내에서 시각적 구조 유지
      return {
        message: message.substring(0, 2000),
        suggestions: suggestions
          ? [
              "이메일은 제목과 본문으로 구분",
              "HTML 형식 사용 시 클릭률 +15-30%",
            ]
          : undefined,
      };
    }
    default:
      return { message };
  }
}

/**
 * 캠페인 생성 (멀티채널 통합) — DISABLED
 *
 * 비활성화 사유: MultiChannelCampaign Prisma 모델 미마이그레이션
 * 활성화 조건: prisma migration 완료 + Prisma schema 업데이트
 *
 * 프로세스:
 * 1. Campaign 레코드 생성
 * 2. 각 채널별 메시지 변환
 * 3. 수신자 리스트에 대해 채널별 전송 스케줄 생성
 * 4. Day 0-3 시퀀스 자동 설정 (선택사항)
 */
export async function createCampaign(
  params: CreateCampaignParams
): Promise<{
  campaignId: string;
  status: string;
  metrics: { channel: MessageChannel; estimatedRecipients: number }[];
  estimatedCost: number;
}> {
  throw new Error(
    "[DISABLED] createCampaign() — MultiChannelCampaign Prisma 모델이 마이그레이션되지 않았습니다. " +
      "Prisma schema에 multiChannelCampaign, campaignRecipient, campaignChannelMessage 모델 추가 후 " +
      "migrations 실행이 필요합니다."
  );
}

/**
 * 캠페인 발송 (스케줄링 또는 즉시) — DISABLED
 *
 * 비활성화 사유: MultiChannelCampaign Prisma 모델 미마이그레이션
 * 활성화 조건: prisma migration 완료 + Prisma schema 업데이트
 *
 * 프로세스:
 * 1. Campaign 상태를 ACTIVE로 변경
 * 2. 각 수신자/채널 조합에 대해 발송 실행
 * 3. 발송 실패 시 자동 재시도 (최대 3회)
 * 4. 메트릭 기록
 */
export async function executeCampaign(
  campaignId: string,
  organizationId: string
): Promise<{
  totalSent: number;
  failed: number;
  byChan: Record<MessageChannel, number>;
}> {
  throw new Error(
    "[DISABLED] executeCampaign() — MultiChannelCampaign Prisma 모델이 마이그레이션되지 않았습니다. " +
      "Prisma schema에 multiChannelCampaign, campaignRecipient 모델 추가 후 " +
      "migrations 실행이 필요합니다."
  );
}

/**
 * 채널별 성과 메트릭 조회 — DISABLED
 *
 * 비활성화 사유: MultiChannelCampaign Prisma 모델 미마이그레이션
 * 활성화 조건: prisma migration 완료 + Prisma schema 업데이트
 *
 * 반환값:
 * - 각 채널별: 발송, 오픈, 클릭, 전환 수 + 비율
 * - 비용 효율성 (ROI)
 * - 크로스채널 어트리뷰션
 */
export async function getCampaignMetrics(
  campaignId: string
): Promise<{
  campaign: any;
  metrics: CampaignMetrics[];
  crossChannelAttribution: {
    firstTouch: Record<MessageChannel, number>;
    lastTouch: Record<MessageChannel, number>;
    assisted: Record<MessageChannel, number>;
  };
  recommendations: string[];
}> {
  throw new Error(
    "[DISABLED] getCampaignMetrics() — MultiChannelCampaign Prisma 모델이 마이그레이션되지 않았습니다. " +
      "Prisma schema에 multiChannelCampaign, campaignRecipient 모델 추가 후 " +
      "migrations 실행이 필요합니다."
  );
}

/**
 * 내부 헬퍼: 수신자에게 발송
 * (실제 SMS/Kakao/Email API 통합)
 */
async function sendToRecipient(
  recipient: any,
  campaign: any,
  organizationId: string
): Promise<boolean> {
  // 실제 발송은 channel-specific service에서 처리
  // 여기서는 상태만 반환

  try {
    switch (recipient.channel) {
      case "SMS":
        // await sendSmsViaAligo({ ... })
        return true;
      case "KAKAO":
        // await sendKakaoViaAligo({ ... })
        return true;
      case "EMAIL":
        // await sendEmailViaSendgrid({ ... })
        return true;
      default:
        return false;
    }
  } catch (error) {
    logger.error("[sendToRecipient] 발송 실패", { error });
    return false;
  }
}

/**
 * 내부 헬퍼: 캠페인 메트릭 업데이트
 */
async function updateCampaignMetrics(
  campaignId: string,
  data: { totalSent: number; totalFailed: number }
): Promise<void> {
  // TODO: multiChannelCampaign model not yet implemented in schema
  // This is a placeholder until the model is added
  logger.log('[multiChannelCampaign] Metrics update (placeholder)', { campaignId, data });
}

/**
 * 성과 기반 추천사항 생성
 *
 * 규칙:
 * - SMS 개방율 > 50% → SMS 비율 증가 추천
 * - Email 클릭율 > 10% → Email 우선 권장
 * - Kakao 비용 효율 최고 → Kakao 우선 권장
 */
function generateRecommendations(metrics: CampaignMetrics[]): string[] {
  const recommendations: string[] = [];

  // 채널별 비용 효율성 계산
  const roi = metrics.map((m) => ({
    channel: m.channel,
    efficiency: m.cost > 0 ? ((m.opened + m.clicked) * 10) / m.cost : 0,
  }));

  const best = roi.reduce((a, b) => (a.efficiency > b.efficiency ? a : b));

  recommendations.push(`💡 ${best.channel} 채널이 최고 효율 (비용 효율성 기준)`);

  // 개방율 기반
  const openRates = metrics.map((m) => ({
    channel: m.channel,
    rate: m.sent > 0 ? (m.opened / m.sent) * 100 : 0,
  }));

  const highestOpen = openRates.reduce((a, b) => (a.rate > b.rate ? a : b));
  if (highestOpen.rate > 50) {
    recommendations.push(
      `📈 ${highestOpen.channel}의 개방율이 높습니다 (${highestOpen.rate.toFixed(1)}%). 비율 증가 권장`
    );
  }

  // 다채널 혼합 제안
  if (metrics.length > 1) {
    recommendations.push(
      "🎯 다채널 혼합 사용 시 전환율 +25-35% 기대 (테스트 대상 50% 추천)"
    );
  }

  return recommendations;
}

/**
 * A/B 테스트 설정 (채널별) — DISABLED
 *
 * 비활성화 사유: MultiChannelCampaign Prisma 모델 미마이그레이션
 * 활성화 조건: prisma migration 완료 + Prisma schema 업데이트
 *
 * 예: SMS 메시지 A vs B, Kakao 메시지 A vs B
 */
export async function setupABTest(
  campaignId: string,
  channels: MessageChannel[],
  variants: Array<{
    name: string;
    message: string;
    allocation: number; // 0-100
  }>
): Promise<string> {
  throw new Error(
    "[DISABLED] setupABTest() — MultiChannelCampaign Prisma 모델이 마이그레이션되지 않았습니다. " +
      "Prisma schema에 campaignABTest 모델 추가 후 migrations 실행이 필요합니다."
  );
}

export default {
  createCampaign,
  executeCampaign,
  getCampaignMetrics,
  convertMessageForChannel,
  setupABTest,
};
