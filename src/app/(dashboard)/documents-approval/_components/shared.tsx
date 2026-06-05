'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, Loader2, User, Package, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SaleResult = {
  saleId: string;
  orderId: string | null;
  productName: string | null;
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
  if (n == null) return '-';
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
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });
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
  const boxRef = useRef<HTMLDivElement>(null);

  // 디바운스 검색
  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        let sales = await searchSales(query);
        if (onlyPurchasable) sales = sales.filter((s) => s.canIssuePurchaseCert);
        if (onlyRefundable) sales = sales.filter((s) => s.canIssueRefundCert || s.canIssuePurchaseCert);
        setResults(sales);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
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
    setOpen(false);
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
          placeholder={placeholder}
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
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
          {results.map((s) => (
            <button
              key={s.saleId}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full flex-col gap-0.5 border-b border-gray-50 px-3 py-2.5 text-left text-sm hover:bg-indigo-50 last:border-0"
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}
    >
      <div className={`relative w-full ${maxWidth} max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={locked}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="sticky bottom-0 z-10 flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-white px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
