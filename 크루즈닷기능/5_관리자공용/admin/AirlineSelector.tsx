'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  DEFAULT_AIRLINES,
  searchAirlines,
  getAirlineByCode,
  getBaggageSummary,
  extractAirlineCode,
  SEAT_CLASS_LABELS,
  type AirlineData,
  type SeatClass,
} from '@/lib/data/airlines';

export interface AirlineSelection {
  airline: string;
  airlineName: string;
  seatClass: SeatClass;
  baggageAllowance: string;
}

interface AirlineSelectorProps {
  airline?: string;
  airlineName?: string;
  seatClass?: SeatClass;
  /** 항공편명 입력 시 자동 감지용 (예: KE041 → 대한항공) */
  flightNumber?: string;
  onChange: (data: AirlineSelection) => void;
  disabled?: boolean;
}

export default function AirlineSelector({
  airline,
  airlineName,
  seatClass,
  flightNumber,
  onChange,
  disabled,
}: AirlineSelectorProps) {
  const [query, setQuery] = useState(() => {
    if (airline) return getAirlineByCode(airline)?.name ?? airlineName ?? airline;
    return airlineName ?? '';
  });
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AirlineData[]>([]);
  const [selected, setSelected] = useState<AirlineData | null>(() =>
    airline ? (getAirlineByCode(airline) ?? null) : null
  );
  const [localClass, setLocalClass] = useState<SeatClass>(seatClass ?? 'economy');
  const containerRef = useRef<HTMLDivElement>(null);
  const lastDetectedRef = useRef<string | null>(null);
  // onChange를 최신 ref로 관리 — stale closure 방지
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // 항공편명으로 항공사 자동 감지 (KE041 → KE → 대한항공)
  useEffect(() => {
    if (!flightNumber || flightNumber.length < 2) return;
    const code = extractAirlineCode(flightNumber);
    if (!code || code === lastDetectedRef.current) return;
    const found = getAirlineByCode(code);
    if (found) {
      lastDetectedRef.current = code;
      applySelection(found, localClass);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightNumber]);

  // 외부 airline/seatClass prop 변경 시 동기화 (데이터 로드 후 반영)
  useEffect(() => {
    if (airline) {
      const found = getAirlineByCode(airline);
      if (found) {
        setSelected(found);
        setQuery(found.name);
        lastDetectedRef.current = found.code;
      }
    }
    if (seatClass) setLocalClass(seatClass);
  }, [airline, seatClass]);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applySelection = useCallback((a: AirlineData, sc: SeatClass) => {
    const resolved = a.seatClasses.includes(sc) ? sc : a.seatClasses[0];
    // P0-BUG-1: 수동 선택 시에도 lastDetectedRef 갱신 (재감지 차단 방지)
    lastDetectedRef.current = a.code;
    setSelected(a);
    setQuery(a.name);
    setLocalClass(resolved);
    setOpen(false);
    onChangeRef.current({
      airline: a.code,
      airlineName: a.name,
      seatClass: resolved,
      baggageAllowance: getBaggageSummary(a.code, resolved),
    });
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    // P1: DEFAULT_AIRLINES는 모듈 레벨 상수 — 렌더마다 재계산 없음
    const filtered = value.trim() ? searchAirlines(value).slice(0, 10) : DEFAULT_AIRLINES;
    setResults(filtered);
    setOpen(true);
  };

  const handleFocus = () => {
    const filtered = query.trim() ? searchAirlines(query).slice(0, 10) : DEFAULT_AIRLINES;
    setResults(filtered);
    setOpen(true);
  };

  const handleSeatClassChange = (sc: SeatClass) => {
    setLocalClass(sc);
    if (selected) {
      onChangeRef.current({
        airline: selected.code,
        airlineName: selected.name,
        seatClass: sc,
        baggageAllowance: getBaggageSummary(selected.code, sc),
      });
    }
  };

  // P0-P2: handleClear에서 onChange 호출로 부모 데이터 동기화
  const handleClear = () => {
    setQuery('');
    setSelected(null);
    lastDetectedRef.current = null;
    setOpen(false);
    onChangeRef.current({ airline: '', airlineName: '', seatClass: 'economy', baggageAllowance: '' });
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* 항공사 검색 입력 */}
      <div className="relative">
        <label className="block text-xs text-gray-600 mb-1">항공사</label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={handleFocus}
            disabled={disabled}
            placeholder="예: 대한항공, KE, Korean Air"
            className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {selected && (
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                  <Image
                    src={selected.logoPath}
                    alt={selected.name}
                    width={20}
                    height={20}
                    className="object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  {selected.code}
                </span>
              </div>
            )}
            {query && (
              <button
                type="button"
                onMouseDown={handleClear}
                className="text-gray-400 hover:text-gray-600 text-xs px-1"
                tabIndex={-1}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 자동완성 드롭다운 */}
        {open && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
            {results.map((a) => (
              <button
                key={a.code}
                type="button"
                onMouseDown={() => applySelection(a, localClass)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                    <Image
                      src={a.logoPath}
                      alt={a.name}
                      width={28}
                      height={28}
                      className="object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-gray-800">{a.name}</span>
                    <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${a.isDomestic ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {a.code}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{a.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 좌석 등급 선택 — 항공사 선택 후 표시 */}
      {selected && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">좌석 등급</label>
          <div className="flex flex-wrap gap-1.5">
            {selected.seatClasses.map((sc) => (
              <button
                key={sc}
                type="button"
                disabled={disabled}
                onClick={() => handleSeatClassChange(sc)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                  localClass === sc
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {SEAT_CLASS_LABELS[sc]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 수하물 자동 표시 */}
      {selected && (
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200 flex items-center gap-2">
          <span>🧳</span>
          <span><span className="font-semibold">수하물:</span> {getBaggageSummary(selected.code, localClass)}</span>
        </div>
      )}
    </div>
  );
}
