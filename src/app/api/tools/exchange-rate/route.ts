import { NextResponse } from "next/server";

// 서버사이드 환율 프록시 — CORS 없이 안정적으로 제공
// 소스 1: Frankfurter (ECB 기반), 소스 2: exchangerate.host 폴백
export async function GET() {
  // 소스 1: Frankfurter App API (안정적인 구 버전)
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=KRW", {
      next: { revalidate: 3600 }, // 1시간 캐시
    });
    if (res.ok) {
      const d = await res.json() as { rates?: { KRW?: number }; date?: string };
      const rate = d.rates?.KRW;
      if (typeof rate === "number" && rate > 0) {
        return NextResponse.json({ rate, date: d.date ?? "", source: "frankfurter" });
      }
    }
  } catch { /* 폴백으로 진행 */ }

  // 소스 2: open.er-api.com 폴백
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const d = await res.json() as { rates?: { KRW?: number }; time_last_update_utc?: string };
      const rate = d.rates?.KRW;
      if (typeof rate === "number" && rate > 0) {
        const date = d.time_last_update_utc
          ? new Date(d.time_last_update_utc).toISOString().slice(0, 10)
          : "";
        return NextResponse.json({ rate, date, source: "er-api" });
      }
    }
  } catch { /* 폴백 실패 */ }

  return NextResponse.json({ error: "rate-unavailable" }, { status: 503 });
}
