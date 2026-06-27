/**
 * 크루즈닷봇 귀속(attribution) — 매출이 누구 실적인지 위변조 없이 확정 (작업지시서 §7-2, §10 P0)
 *
 * 봇 챗 라우트는 비로그인·익명 공개 엔드포인트라, 클라이언트가 보낸 shortLinkCode 를
 * 그대로 신뢰하면 ①셀프 어트리뷰션(자가발주 수당편취) ②귀속 탈취 ③first-write 선점이 가능하다.
 * 따라서 여기서:
 *  - shortLinkCode 를 **서버가 ShortLink 재조회**하고 createdBy 가 **활성 대리점장(동일 org)** 인지 검증
 *  - 진입 시 HMAC 서명 쿠키로 attribution 을 1회 고정(이후 body 의 code 는 무시)
 *  - 폴백 체인: 현재 숏링크 > 최근 접촉 대리점장(last_touch) > 무귀속(none)  ← 사용자 확정: 최근 접촉 대리점장
 *  - 셀프 어트리뷰션(방문자=대리점장 본인) 차단
 */
import "server-only";
import crypto from "crypto";
import prisma from "@/lib/prisma";

/** 귀속 대상이 될 수 있는 판매 역할. */
const SALES_ROLES = ["OWNER", "AGENT", "FREE_SALES"] as const;

export type AttributionSource = "shortlink" | "last_touch" | "none";

export interface AttributionResult {
  attributedAgentId: string | null;
  attributionSource: AttributionSource;
  organizationId: string | null;
  shortLinkCode: string | null;
}

/** ShortLink.createdBy 가 동일 org 의 활성 대리점장인지 검증. 통과 시 userId, 아니면 null. */
async function validateAgent(
  createdBy: string | null,
  organizationId: string,
): Promise<string | null> {
  if (!createdBy) return null;
  const member = await prisma.organizationMember.findFirst({
    where: {
      userId: createdBy,
      organizationId,
      isActive: true,
      role: { in: SALES_ROLES as unknown as string[] },
    },
    select: { userId: true },
  });
  return member ? createdBy : null;
}

/**
 * 페이지(랜딩) 소유자가 그 조직의 활성 판매자인지 검증해 귀속 대상으로 반환.
 * 버튼 게이트(복제봇 개인링크)는 ref 가 불안정하므로 createdByUserId 를 귀속에 쓰되,
 * 비활성·이관된 소유자가 그대로 박히지 않게 이 검증을 통과시킨다.
 */
export async function resolvePageOwnerAgent(
  createdBy: string | null,
  organizationId: string,
): Promise<string | null> {
  return validateAgent(createdBy, organizationId);
}

/**
 * 진입 귀속 해결 — 클라이언트 입력을 신뢰하지 않고 서버가 ShortLink 를 재조회·검증한다.
 * @param shortLinkCode 현재 진입 추적코드(?ref= 또는 /p/{shortlink})
 * @param visitToken    최근 접촉 쿠키(=ShortLink.id, /l 리다이렉트가 설정) → last_touch 폴백
 */
export async function resolveAttribution(input: {
  shortLinkCode?: string | null;
  visitToken?: string | null;
  /** 봇이 떠 있는 랜딩의 조직(권위) — 있으면 폴백 조회를 이 org 로 가둬 크로스조직 오귀속 차단. */
  pageOrganizationId?: string | null;
}): Promise<AttributionResult> {
  const code = input.shortLinkCode?.trim() || null;
  const visit = input.visitToken?.trim() || null;
  const pageOrg = input.pageOrganizationId?.trim() || null;
  // pageOrg 있으면 숏링크/last_touch 를 그 org 로 제한(타 조직 코드/쿠키 매칭 차단).
  const orgScope = pageOrg ? { organizationId: pageOrg } : {};

  // 1) 현재 숏링크(최우선)
  if (code) {
    const link = await prisma.shortLink.findFirst({
      where: { code, isActive: true, ...orgScope },
      select: { code: true, createdBy: true, organizationId: true },
    });
    if (link) {
      const agentId = await validateAgent(link.createdBy, link.organizationId);
      if (agentId) {
        return {
          attributedAgentId: agentId,
          attributionSource: "shortlink",
          organizationId: pageOrg ?? link.organizationId,
          shortLinkCode: link.code,
        };
      }
    }
  }

  // 2) 최근 접촉 대리점장(last_touch) — 사용자 확정 폴백
  if (visit) {
    const link = await prisma.shortLink.findFirst({
      where: { id: visit, isActive: true, ...orgScope },
      select: { code: true, createdBy: true, organizationId: true },
    });
    if (link) {
      const agentId = await validateAgent(link.createdBy, link.organizationId);
      if (agentId) {
        return {
          attributedAgentId: agentId,
          attributionSource: "last_touch",
          organizationId: pageOrg ?? link.organizationId,
          shortLinkCode: link.code,
        };
      }
    }
  }

  // 3) 무귀속 — null 을 조용히 삼키지 말고 source=none 으로 가시화. org 는 페이지 org 보존.
  return {
    attributedAgentId: null,
    attributionSource: "none",
    organizationId: pageOrg,
    shortLinkCode: code,
  };
}

/**
 * 셀프 어트리뷰션 차단 — 방문자가 로그인한 대리점장 본인이면 귀속 제외.
 * (라우트에서 현재 세션 userId 를 넘겨 호출)
 */
export function isSelfAttribution(
  visitorSessionUserId: string | null | undefined,
  attributedAgentId: string | null,
): boolean {
  return !!visitorSessionUserId && visitorSessionUserId === attributedAgentId;
}

// ── HMAC 서명 attribution 쿠키 (진입 시 1회 고정) ──────────────────────────

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

export interface AttributionToken {
  /** 방문자/대화 식별자 */
  v: string;
  /** 귀속 대리점장 */
  a: string | null;
  /** 조직 */
  o: string | null;
  /** 귀속 근거 */
  s: AttributionSource;
  /** 발급 시각(ms) */
  iat: number;
}

/** 서명 비밀키 — 없으면 fail-closed(서명/검증 불가). 약한 기본값 절대 사용 금지. */
function getSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

/** attribution 토큰 발급(HMAC-SHA256). 비밀키 없으면 null. */
export function signAttributionToken(payload: Omit<AttributionToken, "iat">): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const full: AttributionToken = { ...payload, iat: Date.now() };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** attribution 토큰 검증 — 서명·만료 통과 시 payload, 아니면 null(fail-closed). */
export function verifyAttributionToken(token: string | null | undefined): AttributionToken | null {
  const secret = getSecret();
  if (!secret || !token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const macBuf = Buffer.from(mac);
  const expBuf = Buffer.from(expected);
  if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as AttributionToken;
    if (!payload || typeof payload.iat !== "number") return null;
    if (Date.now() - payload.iat > TOKEN_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
