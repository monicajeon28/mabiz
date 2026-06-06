import { prisma } from "@/lib/prisma";

/**
 * SMS/이메일 본문에서 shortlink 감지 및 Impression 기록
 * 패턴: /l/[code]
 */
export async function trackShortLinkImpressions(
  body: string,
  channel: "sms" | "email",
  contactId?: string,
  organizationId?: string
) {
  try {
    // Step 0: P1-9 ReDoS 방지 - 메시지 길이 제한
    const MAX_MESSAGE_LENGTH = 2000;
    let processBody = body;
    if (body.length > MAX_MESSAGE_LENGTH) {
      processBody = body.substring(0, MAX_MESSAGE_LENGTH);
    }

    // Step 1: 본문에서 모든 shortlink 감지
    // [P0 FIX #3] nanoid 기본값에 맞게 (a-z0-9- 만, underscore 불포함, 대문자 불포함)
    const linkPattern = /\/l\/([a-z0-9\-]{8})/g;
    const matches = Array.from(processBody.matchAll(linkPattern));

    if (matches.length === 0) {
      // 링크 없음, skip
      return [];
    }

    // Step 2: 각 링크 코드별로 shortlinkId 조회
    const codes = matches.map((m) => m[1]);
    const links = await prisma.shortLink.findMany({
      where: {
        code: { in: codes },
        ...(organizationId ? { organizationId } : {}),
      },
      select: { id: true, code: true },
    });

    if (links.length === 0) {
      // No links found, skip
      return [];
    }

    // Step 3: 각 링크별로 ShortLinkImpression 생성
    const impressions = await Promise.all(
      links.map((link) =>
        prisma.shortLinkImpression.create({
          data: {
            shortLinkId: link.id,
            channel,
            contactId: contactId || null,
            sentAt: new Date(),
          },
        })
      )
    );

    return impressions;
  } catch (error) {
    // Error tracking impressions, return empty
    return [];
  }
}

/**
 * A/B 테스트 분산 로직 (리다이렉트 시)
 * 50:50으로 A/B 분산
 */
export function selectABVariant(): "A" | "B" {
  // 진정한 50:50 분산 (sessionId 기반이 아닌 순수 난수)
  const random = Math.random();
  return random < 0.5 ? "A" : "B";
}

/**
 * ShortLinkABTest 분산 로직 확인 (P1-5: 1쿼리로 최적화)
 */
export async function getABTestVariant(
  shortLinkId: string
): Promise<{ variant: "A" | "B"; testId: string } | null> {
  try {
    // shortLinkId가 어떤 테스트의 A 또는 B인가? (1 쿼리로 통합)
    const test = await prisma.shortLinkABTest.findFirst({
      where: {
        OR: [
          { variantA_id: shortLinkId },
          { variantB_id: shortLinkId }
        ],
        status: "ACTIVE"
      },
    });

    if (!test) {
      return null;
    }

    return {
      variant: test.variantA_id === shortLinkId ? "A" : "B",
      testId: test.id
    };
  } catch (error) {
    // Error retrieving AB test variant, return null
    return null;
  }
}
