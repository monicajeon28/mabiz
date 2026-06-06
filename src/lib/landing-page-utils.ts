import { customAlphabet } from "nanoid";
import prisma from "@/lib/prisma";

const nanoid = customAlphabet('0-9a-z', 8);

/**
 * 충돌 없는 고유 shortlink 생성 (최대 3회 재시도)
 *
 * nanoid(8) = 2.8조 조합 → 충돌 확률 < 0.001% (통계상 안전)
 * 3회 재시도로 성공 확률 99.9999%
 *
 * 성능 거장 권장: 10회는 과도하며 응답시간 10배 증가
 * @returns {Promise<string>} 생성된 8자 shortlink
 */
export async function generateUniqueShortlink(): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const shortlink = nanoid();

    // ShortLink 테이블에서만 확인 (SSoT)
    const existing = await prisma.shortLink.findUnique({
      where: { code: shortlink },
      select: { id: true },
    });

    if (!existing) {
      return shortlink;
    }

    // 마지막 재시도 실패
    if (attempt === MAX_RETRIES) {
      throw new Error(
        `Failed to generate unique shortlink after ${MAX_RETRIES} retries. This should never happen.`
      );
    }
  }

  // 이론상 도달 불가 (loop 때문)
  throw new Error("Unexpected: generateUniqueShortlink loop ended abnormally");
}

/**
 * 랜딩페이지 복제 시 shortlink + ShortLink 레코드 생성
 * @param pageId - 복제된 CrmLandingPage ID
 * @param title - 페이지 제목
 * @param orgId - 조직 ID
 * @param userId - 생성자 사용자 ID
 * @returns {Promise<{shortlink: string}>}
 */
export async function createShortLinkForPage(
  pageId: string,
  title: string,
  orgId: string,
  userId: string,
): Promise<{ shortlink: string }> {
  const shortlink = await generateUniqueShortlink();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const targetUrl = `${appUrl}/landing/${pageId}`;

  // ShortLink 레코드 생성
  await prisma.shortLink.create({
    data: {
      code: shortlink,
      targetUrl,
      title,
      organizationId: orgId,
      createdBy: userId,
      category: "landing",
      isActive: true,
    },
  });

  return { shortlink };
}
