/**
 * Menu #38 Phase 3 Wave 2: A/B 테스트 Variant 선택 로직
 *
 * 목적:
 * - CampaignVariant 테이블에서 A/B 중 선택 (확률적)
 * - trafficSplit 비율에 따라 선택
 * - 선택된 Variant의 메시지 내용 조회
 *
 * 특징:
 * - N+1 쿼리 최적화: 배치 내 variantMap으로 중복 조회 제거
 * - null 반환: 단일 메시지 캠페인 (Variant 없음)
 * - 데이터 무결성: Variant 개수 검증 (예상 2개)
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * 캠페인의 A/B Variant 중 하나 선택
 * trafficSplit 비율에 따라 확률적으로 A 또는 B 선택
 *
 * @param campaignId - 캠페인 ID
 * @returns "A" | "B" | null (null = 단일 메시지, A/B 없음)
 */
export async function selectVariant(campaignId: string): Promise<string | null> {
  try {
    const variants = await prisma.campaignVariant.findMany({
      where: { campaignId, isActive: true },
      select: { variantKey: true, trafficSplit: true },
    });

    // 1. Variant이 없으면 단일 메시지 캠페인
    if (variants.length === 0) {
      return null;
    }

    // 2. Variant이 2개가 아니면 경고 로깅 (데이터 무결성 이슈)
    if (variants.length !== 2) {
      logger.warn(
        `[selectVariant] Campaign ${campaignId} has ${variants.length} variants (expected 2)`
      );
      return variants[0]?.variantKey ?? null;
    }

    // 3. A와 B 구분
    const variantA = variants.find((v) => v.variantKey === "A");
    const variantB = variants.find((v) => v.variantKey === "B");

    if (!variantA || !variantB) {
      logger.error(
        `[selectVariant] Campaign ${campaignId} missing A or B variant`
      );
      return null;
    }

    // 4. trafficSplit: A를 받을 비율 (0.0 ~ 1.0)
    // 예: trafficSplit=0.5 → 50% A, 50% B
    // 예: trafficSplit=0.3 → 30% A, 70% B
    const random = Math.random(); // 0.0 ~ 1.0
    const selectA = random < variantA.trafficSplit;

    return selectA ? "A" : "B";
  } catch (err) {
    logger.error("[selectVariant] Error selecting variant", { campaignId, err });
    return null;
  }
}

/**
 * 선택된 Variant의 메시지 내용 조회
 *
 * @param campaignId - 캠페인 ID
 * @param variantKey - "A" | "B" | null
 * @returns SMS/Email 본문
 */
export async function getVariantContent(
  campaignId: string,
  variantKey: string | null
) {
  try {
    if (!variantKey) {
      // 단일 메시지: CrmMarketingCampaign의 기본 메시지 사용
      return await prisma.crmMarketingCampaign.findUnique({
        where: { id: campaignId },
        select: {
          smsBody: true,
          emailSubject: true,
          emailBody: true,
        },
      });
    }

    // A/B Variant의 메시지 사용
    const variant = await prisma.campaignVariant.findUnique({
      where: {
        campaignId_variantKey: { campaignId, variantKey },
      },
      select: {
        smsBody: true,
        emailSubject: true,
        emailBody: true,
      },
    });

    return variant;
  } catch (err) {
    logger.error("[getVariantContent] Error getting variant content", {
      campaignId,
      variantKey,
      err,
    });
    return null;
  }
}

/**
 * 배치 내 모든 campaignId의 Variant을 미리 선택
 * N+1 쿼리 방지: 배치 처리 시 한 번에 모두 조회
 *
 * @param campaignIds - campaignId 배열 (중복 제거됨)
 * @returns Map<campaignId, variantKey>
 */
export async function selectVariantBatch(
  campaignIds: string[]
): Promise<Map<string, string | null>> {
  try {
    const uniqueIds = [...new Set(campaignIds)];
    const variantMap = new Map<string, string | null>();

    // 각 campaignId별로 selectVariant 호출
    for (const campaignId of uniqueIds) {
      const variantKey = await selectVariant(campaignId);
      variantMap.set(campaignId, variantKey);
    }

    return variantMap;
  } catch (err) {
    logger.error("[selectVariantBatch] Error selecting variants", { err });
    return new Map();
  }
}

/**
 * 배치 내 모든 campaignId의 content를 미리 로드
 * N+1 쿼리 방지: 배치 처리 시 한 번에 모두 조회
 *
 * @param campaignIds - campaignId 배열
 * @param variantMap - 선택된 Variant 맵
 * @returns Map<campaignId, content>
 */
export async function getVariantContentBatch(
  campaignIds: string[],
  variantMap: Map<string, string | null>
): Promise<
  Map<
    string,
    {
      smsBody?: string | null;
      emailSubject?: string | null;
      emailBody?: string | null;
    } | null
  >
> {
  try {
    const uniqueIds = [...new Set(campaignIds)];
    const contentMap = new Map<
      string,
      {
        smsBody?: string | null;
        emailSubject?: string | null;
        emailBody?: string | null;
      } | null
    >();

    // 각 campaignId별로 getVariantContent 호출
    for (const campaignId of uniqueIds) {
      const variantKey = variantMap.get(campaignId);
      const content = await getVariantContent(campaignId, variantKey);
      contentMap.set(campaignId, content);
    }

    return contentMap;
  } catch (err) {
    logger.error("[getVariantContentBatch] Error getting variant contents", {
      err,
    });
    return new Map();
  }
}
