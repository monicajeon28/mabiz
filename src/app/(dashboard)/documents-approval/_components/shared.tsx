'use client';

import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { Search, Loader2, User, Package, X, Phone } from 'lucide-react';

// ─── 회사 에셋/정보 상수 ────────────────────────────────────────────────────────
export const COMPANY = {
  logo: '/logo-cruisedot.png',   // 가운데 정렬 로고 (4종 서류 공통)
  seal: '/cruise-stamp.png',    // 좌하단 직인 (회사 도장)
  name: '크루즈닷',
  ceo: '배연성',
  hqPhone: '010-3289-3800',     // 본사 대표번호 (담당자 연락처 미입력 시 폴백)
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type SaleResult = {
  saleId: string;
  orderId: string | null;
  productName: string | null;
  productCode: string | null;
  saleAmount: number;
  buyerName: string | null;
  buyerTel: string | null;
  refunderName: string | null;
  customerPhone: string | null;
  canIssuePurchaseCert: boolean;
  canIssueRefundCert: boolean;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
};

export type SalesDocumentItem = {
  id: string;
  status: string;
  documentType: string;
  orderId: string | null;
  contactId: string | null;
  generatedData: Record<string, unknown>;
  approvedAt: string | null;
  createdAt: string;
  contact?: { name: string | null; phone: string | null } | null;
};

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '-'; // NaN/Infinity 방어
  return n.toLocaleString('ko-KR') + '원';
}

export function formatDate(d?: string | null): string {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR');
}

export function todayKo(): string {
  return new Date().toLocaleDateString('ko-KR');
}

// 발급일 + N일 후 유효기간 (비교견적서용)
export function validUntilKo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('ko-KR');
}

// ─── 현재 담당자(대리점/대리점장) 정보 훅 ─────────────────────────────────────────
// 서류 "담당자 연락처"에 로그인 사용자의 이름/전화번호 자동 표시
export type CurrentAgent = { displayName: string | null; phone: string | null };

export function useCurrentAgent(): CurrentAgent {
  const [agent, setAgent] = useState<CurrentAgent>({ displayName: null, phone: null });
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setAgent({ displayName: j.displayName ?? null, phone: j.phone ?? null });
      })
      .catch(() => {});
    return () => { alive = false; controller.abort(); };
  }, []);
  return agent;
}

// ─── 서류 공통: 가운데 정렬 로고 레터헤드 ───────────────────────────────────────
// html2canvas 캡처 호환을 위해 next/image 대신 일반 <img> + crossOrigin 사용
export function DocumentLetterhead({
  title,
  accentClass = 'border-indigo-100',
}: {
  title: string;
  accentClass?: string;
}) {
  return (
    <div className={`border-b-2 ${accentClass} pb-4 text-center`}>
      {/* html2canvas 캡처 호환을 위해 next/image·img 대신 배경이미지 div 사용 */}
      <div
        role="img"
        aria-label={COMPANY.name}
        className="mx-auto mb-3 h-12 w-44 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${COMPANY.logo})` }}
      />
      <h3 className="text-2xl font-extrabold tracking-tight text-gray-900">{title}</h3>
      <p className="mt-1 text-xs text-gray-400">발행일: {todayKo()}</p>
    </div>
  );
}

// ─── 서류 공통: 좌하단 직인 + 담당자 연락처 푸터 ────────────────────────────────
export function DocumentSeal({
  agent,
  validDays,
}: {
  agent: CurrentAgent;
  validDays?: number; // 지정 시 "유효기간: 발급일로부터 N일 (YYYY.MM.DD까지)" 표시 (비교견적서)
}) {
  return (
    <div className="mt-2 flex items-end justify-between border-t border-gray-100 pt-4">
      {/* 좌측 하단: 직인 + 발급기관 */}
      <div className="flex items-end gap-3">
        {/* 직인: 배경이미지 div (html2canvas 캡처 호환) */}
        <div
          role="img"
          aria-label="직인"
          className="h-20 w-20 bg-contain bg-center bg-no-repeat opacity-95"
          style={{ backgroundImage: `url(${COMPANY.seal})` }}
        />
        <div className="pb-1 text-xs leading-relaxed text-gray-500">
          <p className="font-bold text-gray-700">{COMPANY.name}</p>
          <p>대표 {COMPANY.ceo}</p>
        </div>
      </div>

      {/* 우측: 담당자 연락처 + (선택)유효기간 */}
      <div className="text-right text-xs leading-relaxed text-gray-600">
        {/* 담당자 전화번호가 있으면 담당자 표기, 없으면 본사 대표번호로 폴백 */}
        {agent.phone && agent.phone.trim() ? (
          <p className="flex items-center justify-end gap-1 font-semibold text-gray-700">
            <Phone className="h-3 w-3" />
            담당자 {agent.displayName ?? ''} {agent.phone}
          </p>
        ) : (
          <p className="flex items-center justify-end gap-1 font-semibold text-gray-700">
            <Phone className="h-3 w-3" />
            본사 {COMPANY.hqPhone}
          </p>
        )}
        {validDays != null && (
          <p className="mt-1 text-gray-500">
            유효기간: 발급일로부터 {validDays}일 ({validUntilKo(validDays)}까지)
          </p>
        )}
      </div>
    </div>
  );
}

// ─── search-sales fetch helper ─────────────────────────────────────────────────

export async function searchSales(q: string): Promise<SaleResult[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  const res = await fetch(`/api/documents/search-sales?${params}`, { credentials: 'include' });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.message || '판매 목록 조회 실패');
  return (json.sales || []) as SaleResult[];
}

// ─── PNG download hook (html2canvas) ───────────────────────────────────────────

export function useImageDownload() {
  const ref = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(async (fileName: string): Promise<boolean> => {
    if (!ref.current) return false;
    setIsDownloading(true);
    try {
      // 로고/직인 배경이미지가 로드되기 전 캡처하면 빈 이미지가 되므로 먼저 preload
      await Promise.all(
        [COMPANY.logo, COMPANY.seal].map(
          (src) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => resolve();
              img.onerror = () => resolve(); // 로드 실패해도 캡처는 진행
              img.src = src;
            })
        )
      );
      const html2canvas = (await import('html2canvas')).default;
      const node = ref.current;

      // ── A4 고정 + 하단까지 전체 캡처 ────────────────────────────────────────
      // 미리보기 카드는 A4 비율(aspect-ratio 210/297)로 높이가 고정돼 있고
      // overflow가 잘려, 화면에 보이는 부분만 캡처되면 증서 하단(직인·환불규정)이
      // 잘려나간다. 캡처 동안만 높이 고정·overflow 클리핑을 해제해 콘텐츠 전체 높이로
      // 펼친 뒤, 폭은 A4(794px ≈ 210mm@96dpi)로 고정해서 캡처한다.
      const prev = {
        height: node.style.height,
        maxHeight: node.style.maxHeight,
        aspectRatio: node.style.aspectRatio,
        overflow: node.style.overflow,
        width: node.style.width,
        maxWidth: node.style.maxWidth,
      };
      const A4_WIDTH_PX = 794; // 210mm @ 96dpi
      node.style.aspectRatio = 'auto';
      node.style.height = 'auto';
      node.style.maxHeight = 'none';
      node.style.overflow = 'visible';
      node.style.width = `${A4_WIDTH_PX}px`;
      node.style.maxWidth = `${A4_WIDTH_PX}px`;

      // 레이아웃 반영 후 전체 높이 측정
      const fullWidth = A4_WIDTH_PX;
      const fullHeight = Math.ceil(node.scrollHeight);

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(node, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          imageTimeout: 3000,
          width: fullWidth,
          height: fullHeight,
          windowWidth: fullWidth,
          windowHeight: fullHeight,
          scrollX: 0,
          scrollY: 0,
        });
      } finally {
        // 원래 스타일 복구 (캡처 성공/실패 무관)
        node.style.height = prev.height;
        node.style.maxHeight = prev.maxHeight;
        node.style.aspectRatio = prev.aspectRatio;
        node.style.overflow = prev.overflow;
        node.style.width = prev.width;
        node.style.maxWidth = prev.maxWidth;
      }
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch {
      return false;
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return { ref, isDownloading, download };
}

// ─── CustomerAutocomplete ──────────────────────────────────────────────────────
// 이름/주문번호/전화번호로 search-sales 검색 → 드롭다운에서 클릭 선택
// onlyPurchasable / onlyRefundable 로 발급 가능 건만 필터링

type AutocompleteProps = {
  label?: string;
  placeholder?: string;
  onlyPurchasable?: boolean;
  onlyRefundable?: boolean;
  onSelect: (sale: SaleResult) => void;
  accent?: 'indigo' | 'emerald' | 'red' | 'orange';
};

const ACCENT_RING: Record<string, string> = {
  indigo: 'focus:ring-indigo-400',
  emerald: 'focus:ring-emerald-400',
  red: 'focus:ring-red-400',
  orange: 'focus:ring-orange-400',
};

// 드롭다운 항목 hover 색상 (탭 accent와 일치)
const ACCENT_HOVER: Record<string, string> = {
  indigo: 'hover:bg-indigo-50',
  emerald: 'hover:bg-emerald-50',
  red: 'hover:bg-red-50',
  orange: 'hover:bg-orange-50',
};

// 키보드 네비 활성 항목 배경 (탭 accent와 일치)
const ACCENT_ACTIVE: Record<string, string> = {
  indigo: 'bg-indigo-50',
  emerald: 'bg-emerald-50',
  red: 'bg-red-50',
  orange: 'bg-orange-50',
};

export function CustomerAutocomplete({
  label = '고객 검색',
  placeholder = '이름·주문번호·전화번호 입력',
  onlyPurchasable,
  onlyRefundable,
  onSelect,
  accent = 'indigo',
}: AutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SaleResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1); // 키보드 네비 활성 항목
  const boxRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // 디바운스 검색
  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    // alive 플래그: 빠른 타이핑/언마운트 시 늦게 도착한 stale fetch 응답이
    // 최신 결과를 덮어쓰거나 unmount 후 setState 하는 race 방어
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        let sales = await searchSales(query);
        if (!alive) return;
        if (onlyPurchasable) sales = sales.filter((s) => s.canIssuePurchaseCert);
        // 환불예정확인서는 결제완료(미취소) 건도 발급 가능하므로 canIssuePurchaseCert도 허용
        if (onlyRefundable) sales = sales.filter((s) => s.canIssueRefundCert || s.canIssuePurchaseCert);
        setResults(sales);
        setOpen(true);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [query, onlyPurchasable, onlyRefundable]);

  // 바깥 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (s: SaleResult) => {
    onSelect(s);
    setQuery(s.buyerName || s.orderId || '');
    setResults([]); // 선택 후 stale 결과가 재포커스 시 다시 열리지 않도록 정리
    setOpen(false);
    setActiveIndex(-1);
  };

  // 결과가 바뀌면 활성 항목 초기화
  useEffect(() => { setActiveIndex(-1); }, [results]);

  // 활성 항목이 보이도록 스크롤
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${listboxId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId]);

  // 키보드 네비게이션 (↑↓ 이동 / Enter 선택 / Esc 닫기)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        pick(results[activeIndex]);
      }
    }
  };

  return (
    <div ref={boxRef} className="relative">
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          className={`w-full rounded-lg border border-gray-300 py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 ${ACCENT_RING[accent]}`}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
        >
          {results.map((s, i) => (
            <button
              key={s.saleId}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              type="button"
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => pick(s)}
              className={`flex w-full flex-col gap-0.5 border-b border-gray-50 px-3 py-2.5 text-left text-sm last:border-0 ${ACCENT_HOVER[accent]} ${i === activeIndex ? ACCENT_ACTIVE[accent] : ''}`}
            >
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-semibold text-gray-800">{s.buyerName || '(이름없음)'}</span>
                {s.customerPhone && <span className="text-xs text-gray-400">{s.customerPhone}</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Package className="h-3 w-3" />
                <span className="truncate">{s.productName || '(상품명 없음)'}</span>
                <span className="ml-auto font-medium text-gray-600">{formatMoney(s.saleAmount)}</span>
              </div>
              {s.orderId && <span className="text-[11px] text-gray-400">주문 {s.orderId}</span>}
            </button>
          ))}
        </div>
      )}
      {open && !loading && query.trim().length >= 1 && results.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-400 shadow-xl">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}

// ─── Modal shell ───────────────────────────────────────────────────────────────

export function ModalShell({
  title,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-2xl',
  locked = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  locked?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // ESC 키로 닫기 (작업 진행 중 locked면 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [locked, onClose]);

  // 열릴 때 패널로 초기 포커스 이동
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Tab 포커스 트랩 (모달 밖으로 포커스가 빠지지 않도록 순환)
  const handleTrap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleTrap}
        className={`relative w-full ${maxWidth} max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl focus:outline-none`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-gray-100 bg-white px-6 py-4">
          <h2 id={titleId} className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={locked}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="sticky bottom-0 z-10 flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-white px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
