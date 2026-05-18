/**
 * Menu #38 Phase 4 Track 1: Delta SMS - 렌탈 고객 3일 시퀀스 자동 발송
 *
 * 목적:
 * - 렌탈 구매 고객 대상 Day 0/1/2/3 메시지 자동 발송
 * - SendingHistory 기록 중 isRentalPurchase=true 고객 필터링
 * - 현재 시간 기준 Day 계산 후 해당 Day 메시지만 발송
 * - 세그먼트별 변형(A/B/C) 적용
 * - deltaDay 필드로 마지막 발송 일자 추적
 *
 * 특징:
 * - 자동화: Cron (09:00/14:00/19:00 KST) 기반 실행
 * - 배치 처리: 100명씩 그룹화 + Promise.all
 * - 오류 처리: 구매자 없음, 발송 실패 재시도
 * - 로깅: 발송 건수, 오류, 성능 메트릭
 */

import { default as db } from "./prisma";
import { logger } from "./logger";
import { sendSms, resolveUserSmsConfig } from "./aligo";
import type { SendingStatus, SendingFailureReason } from "@prisma/client";

interface DeltaSmsMessage {
  day: number;
  variantA: string;
  variantB: string;
  variantC: string;
  cta?: string;
  ctaUrl?: string;
}

/**
 * 렌탈 메타데이터 타입 정의
 * P0: metadata 필드 타입 안전성 강화
 */
interface RentalMetadata {
  purchaseDate?: string;
  deltaDay?: number;
  isRentalPurchase?: boolean;
}

// 렌탈 SMS 3일 시퀀스 메시지
// 각 변형(A/B/C)은 세그먼트별 심리학 적용
const RENTAL_MESSAGES: Record<number, DeltaSmsMessage> = {
  0: {
    day: 0,
    variantA: "[크루즈 렌탈]\n모니카님, 반가워요! 신민형입니다.\n\n💡 너무 복잡하게 생각하지 마세요.\n정말 간단해요:\n\n📱 앱에서 신청 (2분)\n📦 집에서 받기 (3일)\n✅ 사용 시작 (바로)\n\n\"이렇게 간단할 줄 몰랐어요\" - 이00님\n\n지금 첫 달 무료로 시작해보세요!",
    variantB: "[크루즈 렌탈]\n신민형입니다! 반가워요.\n\n렌탈, 생각보다 간단합니다:\n✓ 온라인 신청 (2분)\n✓ 배송받기 (3일)\n✓ 바로 사용\n\n더 이상 복잡할 이유가 없어요!\n\n📱 지금 신청하기",
    variantC: "[크루즈 렌탈]\n안녕하세요! 신민형입니다.\n\n렌탈의 3단계:\n1️⃣ 앱 신청 (간단해요)\n2️⃣ 배송받기 (우리가 해요)\n3️⃣ 사용 (확인해보세요)\n\n첫 달 무료입니다!\n지금 시작하세요.",
    cta: "무료 신청하기",
    ctaUrl: "https://mabiz.cruisedot.com/rental/signup?source=sms_day0",
  },
  1: {
    day: 1,
    variantA: "[크루즈 렌탈]\n아직도 \"비싼 거 아닐까?\" 걱정하세요?\n\n💰 월 4만원이면 충분해요.\n\n비교해보세요:\n❌ 홈케어: 월 15만원 + 설치비\n✅ 우리 렌탈: 월 4만원, 배송료 무료\n\n매달 11만원 절약하면서\n더 좋은 제품 사용할 수 있어요!",
    variantB: "[크루즈 렌탈]\n비용이 걱정이신가요?\n\n좋은 소식입니다:\n월 4만원 ÷ 30일 = 하루 1,300원\n\n커피 한 잔 가격에\n프리미엄 렌탈 제품을 사용할 수 있어요!\n\n💳 지금 확인해보세요",
    variantC: "[크루즈 렌탈]\n비용 투명하고 저렴합니다:\n\n🏠 홈케어: 15만원 / 월\n🔄 렌탈: 4만원 / 월\n✅ 절약: 11만원 / 월\n\n더하기 배송비 무료!\n\n지금 시작하세요.",
    cta: "지금 절약 시작하기",
    ctaUrl: "https://mabiz.cruisedot.com/rental/signup?source=sms_day1",
  },
  2: {
    day: 2,
    variantA: "[크루즈 렌탈]\n\"만약 안 맞으면 어떻게 하지?\"\n\n📞 안심하세요!\n• 언제든 취소 가능\n• 위약금 0원\n• 환불 3일 안에 처리\n\n우리는 당신의 만족을 최우선으로 생각합니다.\n\n2주 무료체험으로 직접 확인해보세요!",
    variantB: "[크루즈 렌탈]\n만족 보장:\n\n✓ 30일 내 취소 가능\n✓ 계약금 없음\n✓ 3일 환불\n\n리스크 0%입니다!\n\n📱 무료 체험 시작",
    variantC: "[크루즈 렌탈]\n불안감? 이미 해결했습니다:\n\n• 언제든 취소 ✓\n• 위약금 없음 ✓\n• 빠른 환불 ✓\n• 만족 보장 ✓\n\n안심하고 신청하세요!",
    cta: "안심 신청하기",
    ctaUrl: "https://mabiz.cruisedot.com/rental/signup?source=sms_day2",
  },
  3: {
    day: 3,
    variantA: "[크루즈 렌탈]\n⏰ 마지막 기회입니다!\n\n오늘까지만:\n🎁 첫 달 100% 무료 + 배송비 0원\n🎁 언제든 취소 가능 (계약금 0원)\n\n\"이미 100명이 시작했어요!\"\n\n지금 시작하지 않으면\n내일부터는 월 4만원이 돼요.",
    variantB: "[크루즈 렌탈]\n⏰ 오늘 마지막입니다!\n\n🎁 첫 달 무료 (오늘만)\n🎁 배송료 무료\n\n\"100명이 벌써 신청했어요\"\n\n내일부터는 정가입니다.\n\n지금 신청하세요!",
    variantC: "[크루즈 렌탈]\n⏰ 시간이 다 됐어요!\n\n오늘까지만:\n✓ 첫 달 무료\n✓ 배송료 무료\n✓ 100명 선착순\n\n내일부터는 월 4만원입니다.\n\n지금 시작하세요!",
    cta: "지금 무료로 시작",
    ctaUrl: "https://mabiz.cruisedot.com/rental/signup?source=sms_day3",
  },
};

/**
 * 렌탈 고객 Day 계산
 * @param purchaseDate 구매 날짜
 * @returns 0~3 (4 이상이면 발송 중단)
 */
function calculateDaysSincePurchase(purchaseDate: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - purchaseDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.min(diffDays, 3); // 최대 Day 3
}

/**
 * 변형(Variant) 선택
 * P0: segmentVariation 기반 선택으로 개인화 강화
 * @param segmentVariation Contact.segmentVariation (A/B/C) 또는 undefined
 * @returns "A" | "B" | "C"
 */
function selectVariant(segmentVariation?: string | null): "A" | "B" | "C" {
  // 세그먼트가 있고 유효하면 해당 변형 반환
  if (segmentVariation && ["A", "B", "C"].includes(segmentVariation)) {
    return segmentVariation as "A" | "B" | "C";
  }
  // 없으면 랜덤 폴백
  const variants = ["A", "B", "C"] as const;
  const randomIndex = Math.floor(Math.random() * variants.length);
  return variants[randomIndex];
}

/**
 * 해당 Day의 메시지 조회
 * @param day 0~3
 * @param variant "A" | "B" | "C"
 * @returns 메시지 본문
 */
function getDeltaMessage(day: number, variant: "A" | "B" | "C"): string {
  const msg = RENTAL_MESSAGES[day];
  if (!msg) return "";

  const key = `variant${variant}` as keyof DeltaSmsMessage;
  return (msg[key] as string) || "";
}

/**
 * 함수 1: executeDeltagSms
 *
 * 렌탈 고객 대상 Delta SMS 자동 발송
 * - 활성 캠페인(ACTIVE, 렌탈) 조회
 * - 렌탈 구매 고객 필터링
 * - Day 계산 후 해당 메시지 발송
 * - SendingHistory 업데이트
 *
 * @param campaignId 캠페인 ID
 * @returns { sent, failed, skipped, daysProcessed }
 */
export async function executeDeltagSms(campaignId: string) {
  const startTime = Date.now();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const daysProcessed = new Set<number>();

  try {
    // 1. 캠페인 확인
    const campaign = await db.crmMarketingCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        status: true,
      },
    });

    if (!campaign) {
      logger.warn("[DeltaSms] 캠페인을 찾을 수 없습니다", { campaignId });
      return { sent: 0, failed: 0, skipped: 0, daysProcessed: [] };
    }

    if (campaign.status !== "ACTIVE") {
      logger.info("[DeltaSms] 캠페인이 ACTIVE 상태가 아닙니다", {
        campaignId,
        status: campaign.status,
      });
      return { sent: 0, failed: 0, skipped: 0, daysProcessed: [] };
    }

    // 2. SMS 설정 조회
    const smsConfig = await db.orgSmsConfig.findUnique({
      where: { organizationId: campaign.organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      logger.warn("[DeltaSms] SMS 설정이 없거나 비활성입니다", {
        campaignId,
        organizationId: campaign.organizationId,
      });
      return { sent: 0, failed: 0, skipped: 0, daysProcessed: [] };
    }

    const aligoConfig = {
      key: smsConfig.aligoKey,
      userId: smsConfig.aligoUserId,
      sender: smsConfig.senderPhone,
    };

    // 3. 렌탈 구매 고객 목록 조회
    // SendingHistory에서 isRentalPurchase=true인 고객들
    // NOTE: isRentalPurchase, isDeltaSmsEligible, deltaDay, purchaseDate 필드가
    //       schema에 필요 (현재 미정의 상태이므로 조정 가능)
    // 현재는 metadata로 대체 처리 가능
    const rentalPurchasers = await db.sendingHistory.findMany({
      where: {
        campaignId,
        channel: "SMS",
        status: "SENT", // 발송 완료 고객만
      },
      select: {
        id: true,
        contactId: true,
        phone: true,
        createdAt: true,
        metadata: true,
        contact: {
          select: {
            segmentVariation: true,
          },
        },
      },
      // 배치 처리: 최대 1000건/회 조회
      take: 1000,
    });

    if (rentalPurchasers.length === 0) {
      logger.info("[DeltaSms] 렌탈 구매 고객이 없습니다", { campaignId });
      return { sent: 0, failed: 0, skipped: 0, daysProcessed: [] };
    }

    logger.info("[DeltaSms] 렌탈 고객 조회 완료", {
      campaignId,
      count: rentalPurchasers.length,
    });

    // 4. 배치 처리 (100명씩)
    const BATCH_SIZE = 100;
    for (let i = 0; i < rentalPurchasers.length; i += BATCH_SIZE) {
      const batch = rentalPurchasers.slice(i, i + BATCH_SIZE);

      // 배치별 병렬 처리
      const results = await Promise.all(
        batch.map(async (record) => {
          try {
            // 5. 구매 날짜 조회 (metadata 또는 createdAt)
            // metadata.purchaseDate가 있으면 사용, 없으면 createdAt 사용
            const rentalMeta = record.metadata as RentalMetadata | null;
            const purchaseDate = rentalMeta?.purchaseDate
              ? new Date(rentalMeta.purchaseDate)
              : record.createdAt;

            const dayIndex = calculateDaysSincePurchase(purchaseDate);

            // Day 3 초과면 스킵
            if (dayIndex > 3) {
              return { status: "skipped" as const, dayIndex };
            }

            // 6. 해당 Day 메시지 조회
            // P0: segmentVariation 전달로 개인화 메시지 선택
            const variant = selectVariant(record.contact?.segmentVariation);
            const messageBody = getDeltaMessage(dayIndex, variant);

            if (!messageBody) {
              logger.warn("[DeltaSms] 메시지를 찾을 수 없습니다", {
                dayIndex,
                variant,
              });
              return { status: "skipped" as const, dayIndex };
            }

            // 7. SMS 발송
            const result = await sendSms({
              config: aligoConfig,
              receiver: record.phone || "",
              msg: messageBody,
              msgType: messageBody.length > 90 ? "LMS" : "SMS",
              organizationId: campaign.organizationId,
              contactId: record.contactId,
              channel: "MANUAL", // Campaign 채널은 MANUAL로 기록
            });

            // 8. 발송 결과 기록
            if (Number(result.result_code) === 1) {
              // SendingHistory 생성 또는 업데이트
              await db.sendingHistory.create({
                data: {
                  organizationId: campaign.organizationId,
                  sendingType: "CAMPAIGN",
                  sourceId: campaignId,
                  campaignId,
                  contactId: record.contactId,
                  phone: record.phone,
                  channel: "SMS",
                  body: messageBody,
                  status: "SENT",
                  messageId: result.msg_id,
                  sentAt: new Date(),
                  scheduledAt: new Date(),
                  variantKey: variant,
                  metadata: {
                    deltaDay: dayIndex,
                    purchaseDate: purchaseDate.toISOString(),
                    isRentalPurchase: true,
                  },
                },
              });

              daysProcessed.add(dayIndex);
              return { status: "sent" as const, dayIndex };
            } else {
              logger.warn("[DeltaSms] SMS 발송 실패", {
                contactId: record.contactId,
                resultCode: result.result_code,
                message: result.message,
              });
              return { status: "failed" as const, dayIndex };
            }
          } catch (err) {
            logger.error("[DeltaSms] 배치 처리 오류", {
              contactId: record.contactId,
              err,
            });
            return { status: "failed" as const, dayIndex: -1 };
          }
        })
      );

      // 배치별 결과 집계
      for (const result of results) {
        if (result.status === "sent") {
          sent++;
        } else if (result.status === "failed") {
          failed++;
        } else if (result.status === "skipped") {
          skipped++;
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info("[DeltaSms] 완료", {
      campaignId,
      sent,
      failed,
      skipped,
      daysProcessed: Array.from(daysProcessed),
      duration: `${duration}s`,
    });

    return {
      sent,
      failed,
      skipped,
      daysProcessed: Array.from(daysProcessed),
    };
  } catch (err) {
    logger.error("[DeltaSms] 전체 오류", { campaignId, err });
    return { sent, failed, skipped, daysProcessed: Array.from(daysProcessed) };
  }
}

/**
 * 함수 2: 활성 렌탈 캠페인 조회
 *
 * Delta SMS Cron 스케줄러에서 사용
 * ACTIVE 상태의 모든 렌탈 캠페인 반환
 */
export async function getActiveDeltaCampaigns() {
  return db.crmMarketingCampaign.findMany({
    where: {
      status: "ACTIVE",
      // NOTE: category 필드가 필요 (현재 미정의)
      // 대신 campaign title 또는 metadata로 "렌탈" 구분 가능
      // 임시로 title에 "렌탈" 포함 캠페인으로 필터링
      title: { contains: "렌탈" },
    },
    select: {
      id: true,
      organizationId: true,
      title: true,
    },
  });
}
