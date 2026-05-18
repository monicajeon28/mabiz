/**
 * Menu #38 Phase 3 Wave 2: A/B 테스트 Variant 선택 로직
 *
 * 목적:
 * - CampaignVariant 테이블에서 A/B 중 선택 (확률적)
 * - trafficSplit 비율에 따라 선택
 * - 선택된 Variant의 메시지 내용 조회
 *
 * 특징:
 * - 배치 최적화: findMany로 N+1 쿼리 제거
 * - trafficSplit 범위 검증 (0.0 ~ 1.0)
 * - Variant 개수 검증 (정확히 2개 또는 0개)
 * - null 반환: 단일 메시지 캠페인 (Variant 없음)
 */

import db from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * trafficSplit 값을 유효 범위로 정규화 (0.0 ~ 1.0)
 * @param trafficSplit - 원본 값
 * @returns 정규화된 값 (0.0 ~ 1.0)
 */
function normalizeTrafficSplit(trafficSplit: number): number {
  if (isNaN(trafficSplit) || trafficSplit === null) {
    return 0.5; // 기본값
  }
  return Math.max(0.0, Math.min(1.0, trafficSplit));
}

/**
 * 캠페인의 A/B Variant 중 하나 선택
 * trafficSplit 비율에 따라 확률적으로 A 또는 B 선택
 *
 * @param campaignId - 캠페인 ID
 * @returns "A" | "B" | null (null = 단일 메시지, A/B 없음)
 */
export async function selectVariant(campaignId: string): Promise<string | null> {
  try {
    const variants = await db.campaignVariant.findMany({
      where: { campaignId, isActive: true },
      select: { variantKey: true, trafficSplit: true },
    });

    // 1. Variant이 없으면 단일 메시지 캠페인
    if (variants.length === 0) {
      return null;
    }

    // 2. Variant이 정확히 2개가 아니면 에러 (P1 #2 수정)
    if (variants.length !== 2) {
      logger.error(
        `[selectVariant] Campaign ${campaignId} has ${variants.length} variants (must be exactly 2 or 0)`
      );
      return null; // A/B 테스트 불가능 → null 반환
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

    // 4. trafficSplit 범위 검증 (P1 #1 수정)
    // 범위: 0.0 ~ 1.0 정규화
    const normalizedSplit = normalizeTrafficSplit(variantA.trafficSplit);
    if (variantA.trafficSplit !== normalizedSplit) {
      logger.warn(
        `[selectVariant] trafficSplit clamped from ${variantA.trafficSplit} to ${normalizedSplit}`
      );
    }

    // 5. 확률적으로 A/B 선택
    // 예: normalizedSplit=0.5 → 50% A, 50% B
    // 예: normalizedSplit=0.3 → 30% A, 70% B
    const random = Math.random(); // 0.0 ~ 1.0
    const selectA = random < normalizedSplit;

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
      return await db.crmMarketingCampaign.findUnique({
        where: { id: campaignId },
        select: {
          smsBody: true,
          emailSubject: true,
          emailBody: true,
        },
      });
    }

    // A/B Variant의 메시지 사용
    const variant = await db.campaignVariant.findUnique({
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
 * P0 #1 수정: 진정한 배치 처리 — findMany로 한 번에 조회
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

    // 1단계: 모든 캠페인의 Variant을 한 번에 조회 (P0 #1 수정)
    const allVariants = await db.campaignVariant.findMany({
      where: {
        campaignId: { in: uniqueIds },
        isActive: true,
      },
      select: {
        campaignId: true,
        variantKey: true,
        trafficSplit: true,
      },
    });

    // 2단계: campaignId별로 Variant 그룹화
    const variantsByCompany = new Map<
      string,
      Array<{ variantKey: string; trafficSplit: number }>
    >();

    for (const variant of allVariants) {
      if (!variantsByCompany.has(variant.campaignId)) {
        variantsByCompany.set(variant.campaignId, []);
      }
      variantsByCompany.get(variant.campaignId)!.push({
        variantKey: variant.variantKey,
        trafficSplit: variant.trafficSplit,
      });
    }

    // 3단계: 각 campaignId의 Variant 선택 (로직만 수행, DB 쿼리 없음)
    for (const campaignId of uniqueIds) {
      const variants = variantsByCompany.get(campaignId) || [];

      if (variants.length === 0) {
        // Variant 없음 → 단일 메시지
        variantMap.set(campaignId, null);
        continue;
      }

      if (variants.length !== 2) {
        // Variant 개수 오류
        logger.error(
          `[selectVariantBatch] Campaign ${campaignId} has ${variants.length} variants (must be 2 or 0)`
        );
        variantMap.set(campaignId, null);
        continue;
      }

      // A와 B 찾기
      const variantA = variants.find((v) => v.variantKey === "A");
      const variantB = variants.find((v) => v.variantKey === "B");

      if (!variantA || !variantB) {
        logger.error(
          `[selectVariantBatch] Campaign ${campaignId} missing A or B`
        );
        variantMap.set(campaignId, null);
        continue;
      }

      // trafficSplit 정규화 (P1 #1 수정)
      const normalizedSplit = normalizeTrafficSplit(variantA.trafficSplit);

      // A/B 선택
      const random = Math.random();
      const selected = random < normalizedSplit ? "A" : "B";
      variantMap.set(campaignId, selected);
    }

    return variantMap;
  } catch (err) {
    logger.error("[selectVariantBatch] Error selecting variants", { err });
    return new Map();
  }
}

/**
 * 배치 내 모든 campaignId의 content를 미리 로드
 * P1 #3 수정: 진정한 배치 처리 — findMany로 한 번에 조회
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

    // Variant이 없는 campaignId들: 기본 메시지 조회 필요
    const campaignIdsForDefault = uniqueIds.filter(
      (id) => variantMap.get(id) === null
    );

    // Variant이 있는 campaignId들: Variant 메시지 조회 필요
    const campaignIdsForVariant = uniqueIds.filter(
      (id) => variantMap.get(id) !== null
    );

    // 1단계: 기본 메시지 배치 조회 (P1 #3 수정)
    if (campaignIdsForDefault.length > 0) {
      const defaultContents = await db.crmMarketingCampaign.findMany({
        where: { id: { in: campaignIdsForDefault } },
        select: {
          id: true,
          smsBody: true,
          emailSubject: true,
          emailBody: true,
        },
      });

      for (const content of defaultContents) {
        contentMap.set(content.id, {
          smsBody: content.smsBody || null,
          emailSubject: content.emailSubject || null,
          emailBody: content.emailBody || null,
        });
      }
    }

    // 2단계: Variant 메시지 배치 조회 (P1 #3 수정)
    if (campaignIdsForVariant.length > 0) {
      const variantContents = await db.campaignVariant.findMany({
        where: {
          campaignId: { in: campaignIdsForVariant },
          // 다만, 여기서는 specific variantKey를 알고 있어야 함
          // variantMap의 선택된 variant만 조회
        },
        select: {
          campaignId: true,
          variantKey: true,
          smsBody: true,
          emailSubject: true,
          emailBody: true,
        },
      });

      // variantKey별 필터링
      for (const content of variantContents) {
        const selected = variantMap.get(content.campaignId);
        if (selected === content.variantKey) {
          contentMap.set(content.campaignId, {
            smsBody: content.smsBody || null,
            emailSubject: content.emailSubject || null,
            emailBody: content.emailBody || null,
          });
        }
      }
    }

    return contentMap;
  } catch (err) {
    logger.error("[getVariantContentBatch] Error getting variant contents", {
      err,
    });
    return new Map();
  }
}
