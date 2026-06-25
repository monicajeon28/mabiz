import { customAlphabet } from "nanoid";
import { Prisma, type CrmLandingPage } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * 단축링크 코드 → 공개 랜딩 정식 경로(/p/{shortlink}) 절대 URL 생성.
 *
 * 🔴 과거 버그: targetUrl 을 `/landing/{id}` 로 만들었으나 그 동적 라우트가
 *   존재하지 않아 죽은 404 였고, /l/{code} 리다이렉트는 https 가 아니면
 *   외부(cruisedot 홈)로 튕겨 대리점장 귀속(수당정산 SSoT)이 깨졌다.
 *   실제 공개 렌더러는 /p/[slug] 이며 shortlink 또는 slug 로 조회한다.
 */
export function buildLandingTargetUrl(shortlink: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/p/${shortlink}`;
}

export type ClonedPageOverrides = {
  organizationId: string;
  createdByUserId: string;
  title: string;
  slug: string;
  shortlink: string;
  /** 다른 조직에서 공유받은 복사면 true → 타 조직 FK(group/funnel) 미승계 */
  crossOrg: boolean;
};

/**
 * 랜딩페이지 복제 시 원본의 콘텐츠/설정을 빠짐없이 승계하는 create 데이터 생성.
 *
 * 🔴 과거 버그: clone/clone-shared 가 13개 필드만 복사해 결제·L6(긴급성)·블록
 *   에디터·자동퍼널·등록이메일·SMS 자동화가 통째로 끊긴 "깨진 사본"을 만들었다.
 *   지사장/대리점장이 "복사해서 쓰기"를 누르면 돈 버는 기능이 사라지던 매출 누수.
 *
 * 안전장치:
 *  - 사본은 항상 비활성(isActive:false) + 결제 비활성(paymentEnabled:false)으로 시작.
 *  - 크로스조직(crossOrg) 복사 시 groupId/autoFunnelId 는 타 조직 참조이므로 미승계.
 */
export function buildClonedLandingPageData(
  original: CrmLandingPage,
  o: ClonedPageOverrides,
): Prisma.CrmLandingPageUncheckedCreateInput {
  return {
    organizationId: o.organizationId,
    createdByUserId: o.createdByUserId,
    title: o.title,
    slug: o.slug,
    shortlink: o.shortlink,
    isActive: false,
    viewCount: 0,

    // 타 조직 FK 는 크로스조직 복사 시 승계 금지(누수·깨진 참조 방지)
    groupId: o.crossOrg ? null : original.groupId,
    autoFunnelId: o.crossOrg ? null : original.autoFunnelId,

    // ── 콘텐츠 / 노출 ──
    htmlContent: original.htmlContent,
    editorMode: original.editorMode,
    isPublic: original.isPublic,
    description: original.description,
    category: original.category,
    pageGroup: original.pageGroup,
    buttonTitle: original.buttonTitle,
    completionPageUrl: original.completionPageUrl,
    headerScript: original.headerScript,
    exposureTitle: original.exposureTitle,
    exposureImage: original.exposureImage,
    infoCollection: original.infoCollection,
    commentEnabled: original.commentEnabled,
    b2bEduType: original.b2bEduType,
    formConfig: original.formConfig ?? undefined,

    // ── 결제: 콘텐츠는 승계하되 안전 기본값(비활성) 강제 ──
    paymentEnabled: false,
    paymentType: original.paymentType,
    productName: original.productName,
    productPrice: original.productPrice,
    cycleDay: original.cycleDay,
    expireDate: original.expireDate,

    // ── 등록 확인 이메일 ──
    regEmailEnabled: original.regEmailEnabled,
    regEmailSubject: original.regEmailSubject,
    regEmailContent: original.regEmailContent,

    // ── L6 손실회피(긴급성) ──
    l6Enabled: original.l6Enabled,
    l6PriceAnchors: original.l6PriceAnchors ?? undefined,
    l6StockCurrent: original.l6StockCurrent,
    l6StockTotal: original.l6StockTotal,
    l6WeeklyBurnRate: original.l6WeeklyBurnRate,
    l6CountdownEnd: original.l6CountdownEnd,

    // ── L6 SMS 자동화 ──
    smsL6Day0Enabled: original.smsL6Day0Enabled,
    smsL6Day1Enabled: original.smsL6Day1Enabled,
    smsL6Day2Enabled: original.smsL6Day2Enabled,

    // ── Russell Brunson 형식 ──
    pageFormat: original.pageFormat,
    ctaType: original.ctaType,
    imageFieldConfig: original.imageFieldConfig ?? undefined,
    smsDayRange: original.smsDayRange,

    // ── 블록 에디터 ──
    blocksConfig: original.blocksConfig ?? undefined,

    // ── 크루즈닷봇 ── (봇 랜딩 복제 시 봇 식별·설정 승계 — 없으면 복제하면 봇이 사라짐)
    pageType: original.pageType,
    botConfig: original.botConfig ?? undefined,
  };
}

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
  const targetUrl = buildLandingTargetUrl(shortlink);

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
