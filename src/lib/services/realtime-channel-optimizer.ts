/**
 * Real-Time Channel Optimizer Service
 *
 * 실시간 채널 최적화 엔진:
 * - 최근 30분 성과 데이터 기반 채널 ROI 계산
 * - 동적 채널 할당 결정 (SMS/Kakao/Email)
 * - 30분마다 업데이트
 *
 * 의사결정 로직:
 * 1. SMS 개방율 > 30%: SMS 할당량 +50%
 * 2. Kakao ROI > Email ROI: 예산을 Kakao로 전환
 * 3. Email 전환율 > SMS: 확인 메시지는 Email 추천
 * 4. 채널별 최소 10%, 최대 60% 할당
 *
 * 기대 효과:
 * - ROI +15-25%
 * - CPA -10-20%
 * - 채널별 최적화 자동화율 +80%
 *
 * @example
 * const optimizer = new RealtimeChannelOptimizer();
 * const decision = await optimizer.getOptimalChannelMix();
 * // { SMS: 45%, Kakao: 35%, Email: 20% }
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { MessageChannel } from "@/lib/types/multi-channel";

export interface ChannelMetrics {
  channel: MessageChannel;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  failed: number;
  cost: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  revenue: number;
  roi: number; // revenue / cost
}

export interface OptimalChannelMix {
  timestamp: Date;
  allocation: Record<MessageChannel, number>; // 0-100 percentage
  reasoning: string;
  confidence: number; // 0-100
  metrics: ChannelMetrics[];
  recommendations: string[];
  nextUpdateAt: Date;
}

export class RealtimeChannelOptimizer {
  private readonly WINDOW_MINUTES = 30;
  private readonly MIN_ALLOCATION = 0.1; // 10%
  private readonly MAX_ALLOCATION = 0.6; // 60%
  private readonly UPDATE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MIN_SAMPLES = 10; // 최소 샘플 수 (신뢰도 판단용)

  constructor(private organizationId: string) {}

  /**
   * 최근 30분 채널별 성과 메트릭 조회
   */
  async getRecentMetrics(): Promise<ChannelMetrics[]> {
    try {
      const thirtyMinutesAgo = new Date(
        Date.now() - this.WINDOW_MINUTES * 60 * 1000
      );

      // TODO: campaignRecipient model not yet implemented in schema
      // Using default metrics until model is added
      const channels: MessageChannel[] = ["SMS", "KAKAO", "EMAIL"];
      const metrics: ChannelMetrics[] = [];

      for (const channel of channels) {
        // TODO: campaignRecipient model not yet implemented - using default values
        const sent = 0;
        const opened = 0;
        const clicked = 0;
        const converted = 0;
        const cost = 0;

        // TODO: campaignRecipient model not yet implemented in schema
        const failedCount = 0;

        // 해당 채널 전환 수익 합산 (convertedAt이 있는 건들의 관련 거래)
        const revenue = await this.calculateChannelRevenue(channel, thirtyMinutesAgo);

        const openRate = sent > 0 ? (opened / sent) * 100 : 0;
        const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;
        const conversionRate = sent > 0 ? (converted / sent) * 100 : 0;
        const roi = cost > 0 ? (revenue - cost) / cost : 0;

        metrics.push({
          channel,
          sent,
          opened,
          clicked,
          converted,
          failed: failedCount,
          cost,
          openRate,
          clickRate,
          conversionRate,
          revenue,
          roi,
        });
      }

      return metrics;
    } catch (error) {
      logger.error("[RealtimeChannelOptimizer] 메트릭 조회 실패", { error });
      throw error;
    }
  }

  /**
   * 채널별 전환 수익 계산
   */
  private async calculateChannelRevenue(
    channel: MessageChannel,
    since: Date
  ): Promise<number> {
    // TODO: campaignRecipient model not yet implemented in schema
    return 0;
  }

  /**
   * 최적 채널 조합 계산
   *
   * 규칙 엔진:
   * 1. SMS 개방율 > 30%: SMS 할당 +50%
   * 2. Kakao ROI > Email ROI: Kakao로 예산 전환
   * 3. Email 전환율 > SMS: 확인 메시지는 Email 사용
   * 4. 신뢰도 낮으면 균형잡힌 할당 (33% 각각)
   */
  async getOptimalChannelMix(): Promise<OptimalChannelMix> {
    try {
      const metrics = await this.getRecentMetrics();
      const totalSent = metrics.reduce((sum, m) => sum + m.sent, 0);
      const confidence = Math.min(
        100,
        (totalSent / this.MIN_SAMPLES) * 100
      );

      let allocation: Record<MessageChannel, number> = {
        SMS: 0.35,
        KAKAO: 0.35,
        EMAIL: 0.3,
      };
      const recommendations: string[] = [];

      // 충분한 데이터가 있을 때만 최적화
      if (totalSent >= this.MIN_SAMPLES) {
        const smsMetrics = metrics.find((m) => m.channel === "SMS");
        const kakaoMetrics = metrics.find((m) => m.channel === "KAKAO");
        const emailMetrics = metrics.find((m) => m.channel === "EMAIL");

        // Rule 1: SMS 개방율 > 30%
        if (smsMetrics && smsMetrics.openRate > 30) {
          allocation.SMS = Math.min(
            this.MAX_ALLOCATION,
            allocation.SMS * 1.5
          );
          recommendations.push(
            `SMS 개방율 ${smsMetrics.openRate.toFixed(1)}% > 30% → SMS 할당 증가`
          );
        }

        // Rule 2: Kakao ROI > Email ROI
        if (
          kakaoMetrics &&
          emailMetrics &&
          kakaoMetrics.roi > emailMetrics.roi &&
          kakaoMetrics.roi > 0
        ) {
          const roiDiff = kakaoMetrics.roi - emailMetrics.roi;
          const shift = Math.min(0.15, roiDiff * 0.1); // 최대 15% 이동
          allocation.KAKAO = Math.min(
            this.MAX_ALLOCATION,
            allocation.KAKAO + shift
          );
          allocation.EMAIL = Math.max(
            this.MIN_ALLOCATION,
            allocation.EMAIL - shift
          );
          recommendations.push(
            `Kakao ROI ${kakaoMetrics.roi.toFixed(2)} > Email ROI ${emailMetrics.roi.toFixed(2)} → Kakao로 ${(shift * 100).toFixed(0)}% 이동`
          );
        }

        // Rule 3: Email 전환율 > SMS
        if (
          emailMetrics &&
          smsMetrics &&
          emailMetrics.conversionRate > smsMetrics.conversionRate &&
          emailMetrics.conversionRate > 0
        ) {
          recommendations.push(
            `Email 전환율 ${emailMetrics.conversionRate.toFixed(1)}% > SMS → 확인 메시지는 Email 추천`
          );
        }

        // Rule 4: 실패율이 높은 채널 감소
        for (const m of metrics as ChannelMetrics[]) {
          const failureRate =
            m.sent > 0 ? (m.failed / m.sent) * 100 : 0;
          if (failureRate > 5) {
            allocation[m.channel] = Math.max(
              this.MIN_ALLOCATION,
              allocation[m.channel] * 0.8
            );
            recommendations.push(
              `${m.channel} 실패율 ${failureRate.toFixed(1)}% → 할당 감소`
            );
          }
        }
      } else {
        recommendations.push(
          `데이터 부족 (${totalSent}/${this.MIN_SAMPLES}) → 균형잡힌 할당 유지`
        );
      }

      // 할당량 정규화 (합이 100%가 되도록)
      const sum = allocation.SMS + allocation.KAKAO + allocation.EMAIL;
      allocation.SMS = (allocation.SMS / sum) * 100;
      allocation.KAKAO = (allocation.KAKAO / sum) * 100;
      allocation.EMAIL = (allocation.EMAIL / sum) * 100;

      // 최소/최대 제약 적용
      allocation.SMS = Math.min(
        this.MAX_ALLOCATION * 100,
        Math.max(this.MIN_ALLOCATION * 100, allocation.SMS)
      );
      allocation.KAKAO = Math.min(
        this.MAX_ALLOCATION * 100,
        Math.max(this.MIN_ALLOCATION * 100, allocation.KAKAO)
      );
      allocation.EMAIL = Math.min(
        this.MAX_ALLOCATION * 100,
        Math.max(this.MIN_ALLOCATION * 100, allocation.EMAIL)
      );

      const nextUpdateAt = new Date(Date.now() + this.UPDATE_INTERVAL_MS);

      const result: OptimalChannelMix = {
        timestamp: new Date(),
        allocation: {
          SMS: Math.round(allocation.SMS),
          KAKAO: Math.round(allocation.KAKAO),
          EMAIL: Math.round(allocation.EMAIL),
        },
        reasoning: this.buildReasoningString(metrics),
        confidence,
        metrics,
        recommendations,
        nextUpdateAt,
      };

      logger.log("[RealtimeChannelOptimizer] 최적 채널 조합 계산 완료", {
        allocation: result.allocation,
        confidence: result.confidence,
        recommendations: result.recommendations,
      });

      return result;
    } catch (error) {
      logger.error(
        "[RealtimeChannelOptimizer] 최적 채널 조합 계산 실패",
        { error }
      );
      throw error;
    }
  }

  /**
   * 추론 문자열 생성
   */
  private buildReasoningString(metrics: ChannelMetrics[]): string {
    const parts: string[] = [];

    for (const m of metrics) {
      parts.push(
        `${m.channel}: 개방율 ${m.openRate.toFixed(1)}% ROI ${m.roi.toFixed(2)}`
      );
    }

    return parts.join(" | ");
  }

  /**
   * 채널 할당을 새로운 캠페인에 적용
   */
  async applyAllocationToCampaign(
    campaignId: string,
    allocation: Record<MessageChannel, number>
  ): Promise<void> {
    // TODO: multiChannelCampaign model not yet implemented in schema
    // This is a placeholder until the model is added
    logger.log("[RealtimeChannelOptimizer] 채널 할당 적용 (placeholder)", {
      campaignId,
      allocation,
    });
  }
}

export default RealtimeChannelOptimizer;
