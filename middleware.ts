import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const PUBLIC_PATHS = [
  "/sign-in",
  "/register/",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/register",
  "/api/webhooks",
  "/api/public",
  "/p/",
  "/join/",
  "/b2b/",
  "/l/",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/** Rate limit 설정: 경로 패턴 → 분당 최대 요청 수 */
const RATE_LIMIT_RULES: { pattern: RegExp; maxPerMinute: number }[] = [
  { pattern: /^\/api\/landing-pages\/[^/]+\/register$/, maxPerMinute: 5 },
  { pattern: /^\/api\/landing-pages\/[^/]+\/view$/, maxPerMinute: 15 },
  { pattern: /^\/api\/public\/landing\/[^/]+\/comments$/, maxPerMinute: 10 },
];

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limiting — 공개 API 보호
  for (const rule of RATE_LIMIT_RULES) {
    if (rule.pattern.test(pathname)) {
      const ip = getClientIp(req);
      const key = `${ip}:${pathname}`;
      const result = checkRateLimit(key, rule.maxPerMinute, 60_000);
      if (!result.allowed) {
        return NextResponse.json(
          { ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }
      break;
    }
  }

  // 정적 파일 + public 경로 허용
  if (isPublic(pathname)) return NextResponse.next();

  // 세션 쿠키 확인
  const sid = req.cookies.get("mabiz.sid")?.value;
  if (!sid) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
