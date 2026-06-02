"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Search, TrendingUp, Smartphone, Monitor, RefreshCw, AlertCircle, ChevronUp, ChevronDown, Info } from "lucide-react";
import { KEYWORD_DB, TOTAL_KEYWORDS, TOP_MOBILE_KW, searchKeywords, getTopKeywords, formatVol, type KeywordData } from "@/lib/keyword-data";

type SortKey = "mobile" | "pc" | "total" | "keyword";
type SortDir = "asc" | "desc";

interface LiveResult extends KeywordData {
  source: "static" | "naver_live";
  competition?: string;
  fetchedAt?: string;
}

const COMPETITION_LABEL: Record<string, string> = {
  HIGH: "높음",
  MID: "중간",
  LOW: "낮음",
};

const SHEET_COLOR: Record<string, string> = {
  "크루즈여행": "bg-blue-100 text-blue-700",
  "동남아크루즈여행": "bg-emerald-100 text-emerald-700",
  "아시아크루즈여행": "bg-violet-100 text-violet-700",
  "홍콩크루즈여행": "bg-rose-100 text-rose-700",
};

// ─── 컴포넌트 외부 선언 (렌더마다 재생성 방지) ──────────────────────────────
function VolumeBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
      <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SortIcon({ currentKey, activeKey, dir }: { currentKey: SortKey; activeKey: SortKey; dir: SortDir }) {
  if (currentKey !== activeKey) return <span className="text-slate-300">↕</span>;
  return dir === "desc" ? <ChevronDown className="w-3.5 h-3.5 inline" /> : <ChevronUp className="w-3.5 h-3.5 inline" />;
}

export default function KeywordVolumePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LiveResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<"unknown" | "available" | "no_key">("unknown");
  const [sortKey, setSortKey] = useState<SortKey>("mobile");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [liveMessage, setLiveMessage] = useState<string | null>(null);

  // P0-1: 진행 중인 요청 취소용 ref
  const abortRef = useRef<AbortController | null>(null);

  // 초기 로드: 상위 키워드 표시
  useEffect(() => {
    const top = getTopKeywords(30).map(k => ({ ...k, source: "static" as const }));
    setResults(top);
  }, []);

  // 언마운트 시 진행 중 요청 취소
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleSearch = useCallback(async () => {
    // P0-1: 이전 요청 취소
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!query.trim()) {
      const top = getTopKeywords(30).map(k => ({ ...k, source: "static" as const }));
      setResults(top);
      return;
    }

    setLoading(true);
    setLiveMessage(null);

    const staticMatches = searchKeywords(query).map(k => ({ ...k, source: "static" as const }));
    setResults(staticMatches);

    try {
      const res = await fetch(`/api/tools/keyword-volume?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const data = await res.json();

      if (data.source === "no_key" || data.source === "static") {
        setApiStatus("no_key");
        setLiveMessage(data.message ?? null);
      } else if (data.source === "naver_live" && Array.isArray(data.results)) {
        setApiStatus("available");
        const liveMap = new Map<string, LiveResult>(data.results.map((r: LiveResult) => [r.keyword, r]));
        const merged: LiveResult[] = staticMatches.map(s => {
          const live = liveMap.get(s.keyword);
          return live ? { ...s, ...live } : s;
        });
        // P1-6: O(n²) → O(1) 중복 체크
        const mergedSet = new Set(merged.map(m => m.keyword));
        data.results.forEach((r: LiveResult) => {
          if (!mergedSet.has(r.keyword)) {
            // P2-4: 실시간 전용 행에 sheet/collectedAt 기본값 보장
            merged.push({ ...r, sheet: r.sheet ?? "naver_live", collectedAt: r.collectedAt ?? new Date().toISOString().slice(0, 10) });
          }
        });
        setResults(merged);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("[keyword-volume] fetch error:", e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [query]);

  // P1-4: handleSort useCallback
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }, [sortKey]);

  // P2-5: handleKeyDown useCallback
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  // P1-1: sorted → useMemo
  const sorted = useMemo(() => [...results].sort((a, b) => {
    const va = sortKey === "keyword" ? a.keyword : a[sortKey];
    const vb = sortKey === "keyword" ? b.keyword : b[sortKey];
    if (typeof va === "string" && typeof vb === "string") {
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
  }), [results, sortKey, sortDir]);

  // P1-2: maxMobile → useMemo + reduce (spread 대신)
  const maxMobile = useMemo(
    () => results.reduce((max, r) => Math.max(max, r.mobile), 1),
    [results]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">키워드 검색량 분석</h1>
          <p className="text-sm text-slate-500 mt-1">
            네이버 키워드 도구 기반 · {TOTAL_KEYWORDS}개 크루즈 키워드 DB · 2026.04-05 수집
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {apiStatus === "available" && (
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">🟢 실시간 연동</span>
          )}
          {apiStatus === "no_key" && (
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">🟡 정적 DB 모드</span>
          )}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">DB 수집 키워드</p>
          <p className="text-2xl font-bold text-slate-900">{TOTAL_KEYWORDS.toLocaleString()}개</p>
          <p className="text-xs text-slate-400 mt-0.5">4개 시트 통합</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">최고 모바일 검색량</p>
          <p className="text-2xl font-bold text-blue-600">{formatVol(TOP_MOBILE_KW.mobile)}/월</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{TOP_MOBILE_KW.keyword}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">총 모바일 검색량</p>
          <p className="text-2xl font-bold text-emerald-600">
            {formatVol(KEYWORD_DB.reduce((a, b) => a + b.mobile, 0))}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">월 합계 추정</p>
        </div>
      </div>

      {/* 검색창 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="키워드 입력 (예: 크루즈여행, 싱가포르)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            검색
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">쉼표로 구분하면 복수 키워드 동시 검색 가능 (최대 5개)</p>
      </div>

      {/* API 키 안내 */}
      {liveMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 mb-2">실시간 검색량 조회를 위한 API 설정</p>
            <p className="text-amber-700 mb-2">{liveMessage}</p>
            <div className="bg-amber-100 rounded-lg p-3 font-mono text-xs text-amber-900 space-y-1">
              <p># .env.local에 추가</p>
              <p>NAVER_AD_API_KEY=&lt;네이버 검색광고 API 라이선스 키&gt;</p>
              <p>NAVER_AD_CUSTOMER_ID=&lt;고객 ID&gt;</p>
              <p>NAVER_AD_API_SECRET=&lt;API 비밀키&gt;</p>
            </div>
            <p className="text-amber-600 mt-2 text-xs">📋 네이버 검색광고 API 신청: searchad.naver.com → 설정 → API 관리</p>
          </div>
        </div>
      )}

      {/* 결과 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            {query ? `"${query}" 검색 결과` : "상위 키워드"} ({sorted.length}개)
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>모바일 기준 내림차순</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("keyword")}>
                  키워드 <SortIcon currentKey="keyword" activeKey={sortKey} dir={sortDir} />
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("mobile")}>
                  <span className="flex items-center justify-end gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-blue-500" /> 모바일
                    <SortIcon currentKey="mobile" activeKey={sortKey} dir={sortDir} />
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("pc")}>
                  <span className="flex items-center justify-end gap-1">
                    <Monitor className="w-3.5 h-3.5 text-slate-400" /> PC
                    <SortIcon currentKey="pc" activeKey={sortKey} dir={sortDir} />
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("total")}>
                  합계 <SortIcon currentKey="total" activeKey={sortKey} dir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">카테고리</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">소스</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((row) => (
                // P2-2: key에 index 제거, keyword만 사용 (dedup 후 고유성 보장)
                <tr key={row.keyword} className="hover:bg-slate-50/60 transition">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {row.keyword}
                    {row.source === "naver_live" && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">실시간</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div>
                      <span className="font-bold text-blue-600 text-base">{formatVol(row.mobile)}</span>
                      <span className="text-slate-400 text-xs ml-0.5">/월</span>
                      <VolumeBar value={row.mobile} max={maxMobile} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatVol(row.pc)}<span className="text-slate-400 text-xs ml-0.5">/월</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-slate-700 font-medium">{formatVol(row.total)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SHEET_COLOR[row.sheet] ?? "bg-slate-100 text-slate-600"}`}>
                      {row.sheet}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {row.source === "naver_live" ? (
                      <span className="text-green-600 font-medium">네이버 실시간</span>
                    ) : (
                      <span>DB ({row.collectedAt})</span>
                    )}
                    {row.competition && (
                      <span className="ml-2 text-slate-500">
                        경쟁도: {COMPETITION_LABEL[row.competition] ?? row.competition}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 시트별 분포 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">시트별 키워드 분포</p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SHEET_COLOR).map(([sheet, cls]) => {
            const sheetData = KEYWORD_DB.filter(k => k.sheet === sheet);
            const totalMob = sheetData.reduce((a, b) => a + b.mobile, 0);
            const top = sheetData.reduce((a, b) => a.mobile > b.mobile ? a : b, sheetData[0]);
            return (
              <div key={sheet} className={`rounded-lg p-3 border ${cls}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold">{sheet}</p>
                    <p className="text-lg font-bold mt-0.5">{sheetData.length}개</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-70">총 모바일</p>
                    <p className="text-sm font-bold">{formatVol(totalMob)}/월</p>
                  </div>
                </div>
                {top && (
                  <p className="text-xs mt-2 opacity-70 truncate">TOP: {top.keyword} ({formatVol(top.mobile)})</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 네이버 API 연동 가이드 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          네이버 검색광고 API 실시간 연동 방법
        </p>
        <div className="space-y-2 text-sm text-slate-600">
          <p>1. <a href="https://searchad.naver.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">searchad.naver.com</a> 로그인 → 설정 → API 관리</p>
          <p>2. API 사용 신청 → 라이선스 키, 고객 ID, 비밀키 발급</p>
          <p>3. <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-xs font-mono">.env.local</code>에 아래 3개 변수 추가:</p>
          <div className="bg-white rounded-lg p-3 font-mono text-xs border border-slate-200 space-y-1">
            <p className="text-green-600"># 네이버 검색광고 API</p>
            <p>NAVER_AD_API_KEY=xxxxxxxxxxxxxxxx</p>
            <p>NAVER_AD_CUSTOMER_ID=12345678</p>
            <p>NAVER_AD_API_SECRET=xxxxxxxx</p>
          </div>
          <p className="text-xs text-slate-400">
            ※ 실시간 연동 시 현재 월 검색량 + 경쟁도 + 권장입찰가가 자동으로 표시됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
