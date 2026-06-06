import { NextResponse } from "next/server";

// 서버사이드 환율 프록시 — CORS 없이 안정적으로 제공
// 소스 1: Frankfurter (ECB 기반), 소스 2: open.er-api.com 폴백

// next.config.js가 /api/* 전체에 no-store를 강제하므로 next:{revalidate}가 무시됨.
// 모듈 수준 인메모리 캐시로 동일 인스턴스 내 불필요한 외부 호출을 줄인다.
let memCache: { rate: number; date: string; source: string; ts: number } | null = null;
const CACHE_TTL = 3600_000; // 1시간

const USD_KRW_MIN = 900;
const USD_KRW_MAX = 2200;

export async function GET() {
  // 인메모리 캐시 히트
  if (memCache && Date.now() - memCache.ts < CACHE_TTL) {
    return NextResponse.json({ rate: memCache.rate, date: memCache.date, source: memCache.source });
  }

  // 소스 1: Frankfurter (새 도메인 api.frankfurter.dev/v1/)
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=KRW", {
      cache: "no-store",
    });
    if (res.ok) {
      const d = await res.json() as { rates?: { KRW?: number }; date?: string };
      const rate = d.rates?.KRW;
      if (typeof rate === "number" && rate >= USD_KRW_MIN && rate <= USD_KRW_MAX) {
        memCache = { rate, date: d.date ?? "", source: "frankfurter", ts: Date.now() };
        return NextResponse.json({ rate, date: d.date ?? "", source: "frankfurter" });
      }
    }
  } catch { /* 폴백으로 진행 */ }

  // 소스 2: open.er-api.com 폴백
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });
    if (res.ok) {
      const d = await res.json() as { rates?: { KRW?: number }; time_last_update_utc?: string };
      const rate = d.rates?.KRW;
      if (typeof rate === "number" && rate >= USD_KRW_MIN && rate <= USD_KRW_MAX) {
        const date = d.time_last_update_utc
          ? new Date(d.time_last_update_utc).toISOString().slice(0, 10)
          : "";
        memCache = { rate, date, source: "er-api", ts: Date.now() };
        return NextResponse.json({ rate, date, source: "er-api" });
      }
    }
  } catch { /* 폴백 실패 */ }

  return NextResponse.json({ error: "rate-unavailable" }, { status: 503 });
}
