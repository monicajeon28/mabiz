import { customAlphabet } from "nanoid";
import prisma from "@/lib/prisma";

const nanoid = customAlphabet('0-9a-z', 8);

/**
 * 충돌 없는 고유 shortlink 생성 (최대 10회 재시도)
 * @returns {Promise<string>} 생성된 8자 shortlink
 */
export async function generateUniqueShortlink(): Promise<string> {
  let shortlink = nanoid();
  let attempts = 0;

  while (attempts < 10) {
    const existing = await prisma.crmLandingPage.findFirst({
      where: { shortlink },
      select: { id: true },
    });
    if (!existing) break;
    shortlink = nanoid();
    attempts++;
  }

  return shortlink;
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
