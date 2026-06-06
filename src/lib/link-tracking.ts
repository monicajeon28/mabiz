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
    // Step 1: 본문에서 모든 shortlink 감지
    const linkPattern = /\/l\/([a-zA-Z0-9\-_]{8})/g;
    const matches = Array.from(body.matchAll(linkPattern));

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
      console.warn(
        `[trackShortLinkImpressions] No links found: ${codes.join(",")}`
      );
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
    console.error("[trackShortLinkImpressions] Error:", error);
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
 * ShortLinkABTest 분산 로직 확인
 */
export async function getABTestVariant(
  shortLinkId: string
): Promise<{ variant: "A" | "B"; testId: string } | null> {
  try {
    // shortLinkId가 어떤 테스트의 A 또는 B인가?
    const testA = await prisma.shortLinkABTest.findFirst({
      where: { variantA_id: shortLinkId, status: "ACTIVE" },
    });

    if (testA) {
      return { variant: "A", testId: testA.id };
    }

    const testB = await prisma.shortLinkABTest.findFirst({
      where: { variantB_id: shortLinkId, status: "ACTIVE" },
    });

    if (testB) {
      return { variant: "B", testId: testB.id };
    }

    return null;
  } catch (error) {
    console.error("[getABTestVariant] Error:", error);
    return null;
  }
}
