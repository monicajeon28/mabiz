import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// ─── 네이버 검색광고 API (키워드 도구) ───────────────────────────────────────
const NAVER_BASE = "https://api.naver.com";
const NAVER_FETCH_TIMEOUT_MS = 8000;

// ─── 타입 정의 ───────────────────────────────────────────────────────────────
interface NaverKwResult {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
  compIdx: string;
  plAvgDepth: number;
}

// ─── 서명 헬퍼 ───────────────────────────────────────────────────────────────
// [P1-2 수정] secret 부재 시 조용한 실패 대신 명시적 throw
function naverSignature(timestamp: number, method: string, path: string): string {
  const secret = process.env.NAVER_AD_API_SECRET;
  if (!secret) throw new Error("NAVER_AD_API_SECRET is not configured");
  const msg = `${timestamp}.${method}.${path}`;
  return crypto.createHmac("sha256", secret).update(msg).digest("base64");
}

// ─── 볼륨 파싱 헬퍼 ────────────────────────────────────────────────────────
// [P2-2 수정] 전각 기호("<") 포함 정규식으로 처리
function parseVol(v: number | string): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /[<＜]\s*10/.test(v)) return 5;
  return Number(v) || 0;
}

// ─── 네이버 API 호출 ─────────────────────────────────────────────────────────
// [P2-1 수정] 환경변수 중복 체크 제거 — 호출 전 hasNaverKeys 로 이미 검증됨
// [P0-2 수정] AbortController 타임아웃 추가
// [P0-1 수정] showDetail=true (네이버 NAD API는 boolean을 true/false 문자열로 처리)
// [P1-3 수정] res.ok 실패 시 에러 내용 로깅
// [P1-4 수정] res.json() 파싱 실패 시 fallback
async function fetchNaverVolume(
  keywords: string[],
  apiKey: string,
  customerId: string,
): Promise<NaverKwResult[]> {
  const timestamp = Date.now();
  const path = "/keywordstool";
  const query = keywords
    .slice(0, 5) // 네이버 API: 최대 5개/요청
    .map(k => `hintKeywords=${encodeURIComponent(k)}`)
    .join("&");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NAVER_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${NAVER_BASE}${path}?${query}&showDetail=1`, {
      signal: controller.signal,
      headers: {
        "X-Timestamp": String(timestamp),
        "X-API-KEY": apiKey,
        "X-Customer": customerId,
        "X-Signature": naverSignature(timestamp, "GET", path),
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error(`[keyword-volume] naver api ${res.status}`, { error: errText });
      return [];
    }

    const data = await res.json().catch(() => ({}));
    return (data.keywordList ?? []) as NaverKwResult[];
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Google Ads Keyword Planner (선택적) ────────────────────────────────────
// Google Ads API는 Developer Token + OAuth가 필요합니다.
// 현재는 Naver 전용 구현. Google 연동 시 GOOGLE_ADS_DEVELOPER_TOKEN 환경변수 추가.

export async function GET(req: NextRequest) {
  const session = await getMabizSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kw = searchParams.get("q");
  if (!kw) return NextResponse.json({ error: "q required" }, { status: 400 });

  // [P1-1 수정] 입력 길이/내용 검증
  if (kw.length > 500) return NextResponse.json({ error: "q too long" }, { status: 400 });

  const keywords = kw
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length <= 50)
    .slice(0, 5);

  if (keywords.length === 0) {
    return NextResponse.json({ error: "valid keyword required" }, { status: 400 });
  }

  const apiKey = process.env.NAVER_AD_API_KEY;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  const hasNaverKeys = !!apiKey && !!customerId && !!process.env.NAVER_AD_API_SECRET;

  if (!hasNaverKeys) {
    return NextResponse.json({
      source: "static",
      message: "네이버 API 키가 설정되지 않았습니다. 아래 환경변수를 .env.local에 추가하세요.",
      required_env: [
        "NAVER_AD_API_KEY — 네이버 검색광고 API 접근 라이선스 키",
        "NAVER_AD_CUSTOMER_ID — 네이버 검색광고 고객 ID",
        "NAVER_AD_API_SECRET — 네이버 검색광고 API 비밀키",
      ],
      naver_guide: "https://naver.github.io/searchad-apidoc/",
      results: [],
    });
  }

  try {
    // P2-1: 검증된 키를 파라미터로 전달하여 중복 체크 제거
    const naverResults = await fetchNaverVolume(keywords, apiKey!, customerId!);
    const results = naverResults.map(r => ({
      keyword: r.relKeyword,
      pc: parseVol(r.monthlyPcQcCnt),
      mobile: parseVol(r.monthlyMobileQcCnt),
      total: parseVol(r.monthlyPcQcCnt) + parseVol(r.monthlyMobileQcCnt),
      competition: r.compIdx,
      avgBidDepth: r.plAvgDepth,
      source: "naver_live",
      fetchedAt: new Date().toISOString(),
    }));

    return NextResponse.json({ source: "naver_live", results });
  } catch (err) {
    // [P0-3 수정] 에러 상세(스택/메시지) 클라이언트 노출 금지 — 서버 로그에만 기록
    logger.error("[keyword-volume] naver api error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "API fetch failed" }, { status: 502 });
  }
}
