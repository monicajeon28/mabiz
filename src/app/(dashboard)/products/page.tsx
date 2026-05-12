"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Calculator,
  X,
  PlusCircle,
  MapPin,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
type ApisRow = {
  seq: number;
  rv: string;
  cabin: string | number;
  groupId: string | number;
  roomingGroupId: string | number;
  cabinType: string;
  engSurname: string;
  engGivenName: string;
  korName: string;
  residentNum: string;
  gender: string;
  birthDate: string;
  passportNo: string;
  issueDate: string;
  expiryDate: string;
  phone: string;
  airline: string;
  paymentDate: string;
  paymentMethod: string;
  paymentAmount: string | number;
  agentName: string;
  remarks: string;
  groupMemo: string;
  notes: string;
  passportDriveUrl: string;
};

type CabinEntry = { total: number; booked: number; remaining: number };
type CabinSummary = Record<string, CabinEntry>;

type RefundSlot = { daysBeforeDep: number; penaltyRate: number; label?: string };
type RefundPolicyJson = { slots: RefundSlot[]; displayText?: string; isStructured?: boolean };

type Product = {
  id: number;
  code: string;
  name: string;
  cruiseLine: string;
  shipName: string | null;
  nights: number;
  days: number;
  price: number;
  isActive: boolean;
  saleStatus: string | null;
  availableCount: number | null;
  reservedCount: number | null;
  refundPolicy: RefundPolicyJson | null;
  ports: string[];
  tourCities: string | null;
  createdAt: string;
  departureDate: string | null;
  daysLeft: number | null;
  cabinSummary: CabinSummary | null;
};

interface ApiResponse {
  ok: boolean;
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

type ActiveFilter = "all" | "true" | "false";

const LIMIT = 20;

// 객실 타입 한글 레이블 (순서 고정)
const CABIN_LABELS: { key: string; label: string }[] = [
  { key: "inside",    label: "내측" },
  { key: "oceanview", label: "오션뷰" },
  { key: "balcony",   label: "발코니" },
  { key: "suite",     label: "스위트" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatPrice(price: number) {
  return price.toLocaleString("ko-KR") + "원";
}

function DdayBadge({ daysLeft }: { daysLeft: number | null }) {
  if (daysLeft === null) return <span className="text-gray-400 text-xs">-</span>;

  let badge: React.ReactNode;
  if (daysLeft === 0)
    badge = <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">D-day</span>;
  else if (daysLeft < 0)
    badge = <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-500">D+{Math.abs(daysLeft)}</span>;
  else if (daysLeft <= 7)
    badge = <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">D-{daysLeft}</span>;
  else if (daysLeft <= 30)
    badge = <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">D-{daysLeft}</span>;
  else
    badge = <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">D-{daysLeft}</span>;

  // 마일스톤 배지: 6개월(180일) ±2주, 3개월(90일) ±2주
  let milestone: React.ReactNode = null;
  if (daysLeft > 0) {
    if (daysLeft >= 166 && daysLeft <= 180) {
      milestone = (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white leading-none">
          6개월임박
        </span>
      );
    } else if (daysLeft >= 76 && daysLeft <= 90) {
      milestone = (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white leading-none">
          3개월임박
        </span>
      );
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {badge}
      {milestone}
    </div>
  );
}

function SaleStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">-</span>;
  const map: Record<string, string> = {
    "판매중":   "bg-green-100 text-green-700",
    "판매완료": "bg-gray-100 text-gray-500",
    "마감임박": "bg-orange-100 text-orange-700",
    "준비중":   "bg-blue-100 text-blue-700",
    "취소":     "bg-red-100 text-red-700",
    "3일체험":  "bg-purple-100 text-purple-700",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function CabinSummaryCell({ summary, productCode, onRegister }: {
  summary: CabinSummary | null;
  productCode: string;
  onRegister: (code: string) => void;
}) {
  if (!summary || Object.keys(summary).length === 0) {
    return (
      <button
        onClick={() => onRegister(productCode)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
      >
        <PlusCircle className="w-3.5 h-3.5" />
        객실 등록
      </button>
    );
  }

  const known = CABIN_LABELS.filter(({ key }) => key in summary);
  const extra = Object.keys(summary).filter((k) => !CABIN_LABELS.some((l) => l.key === k));
  const all = [
    ...known.map(({ key, label }) => ({ key, label, entry: summary[key]! })),
    ...extra.map((key) => ({ key, label: key, entry: summary[key]! })),
  ];

  return (
    <div className="space-y-0.5 min-w-[110px]">
      {all.map(({ key, label, entry }) => {
        const isSoldOut = entry.remaining <= 0;
        return (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 w-[40px] shrink-0 font-medium">{label}</span>
            {isSoldOut ? (
              <span className="font-bold text-red-600">마감({entry.total})</span>
            ) : (
              <span className="tabular-nums">
                {/* 판매 수: 빨강, 총 수: 파랑 */}
                <span className="font-bold text-red-500">{entry.booked}</span>
                <span className="text-gray-400 mx-0.5">/</span>
                <span className="font-bold text-blue-500">{entry.total}</span>
                {entry.remaining <= 3 && entry.remaining > 0 && (
                  <span className="text-orange-500 ml-1 font-medium">({entry.remaining}남)</span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ── 객실 등록 모달 ─────────────────────────────────────────────────

interface CabinRegisterModalProps {
  productCode: string;
  productName: string;
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_CABIN_TYPES = [
  { key: "inside",    label: "내측 (Inside)" },
  { key: "oceanview", label: "오션뷰 (Ocean View)" },
  { key: "balcony",   label: "발코니 (Balcony)" },
  { key: "suite",     label: "스위트 (Suite)" },
];

function CabinRegisterModal({ productCode, productName, organizationId, onClose, onSaved }: CabinRegisterModalProps) {
  const [counts, setCounts] = useState<Record<string, string>>({
    inside: "",
    oceanview: "",
    balcony: "",
    suite: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    const cabins = DEFAULT_CABIN_TYPES
      .map(({ key }) => ({ cabinType: key, totalCount: parseInt(counts[key] ?? "", 10) }))
      .filter((c) => !isNaN(c.totalCount) && c.totalCount > 0);

    if (cabins.length === 0) {
      setErr("최소 한 가지 객실 타입의 수량을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/cabin-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          tripName: productName,
          tripCode: productCode,
          cabins,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <PlusCircle className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">객실 수량 등록</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4 font-medium">{productName}</p>

        <div className="space-y-3 mb-4">
          {DEFAULT_CABIN_TYPES.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-sm text-gray-700 w-[140px] shrink-0">{label}</label>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  value={counts[key] ?? ""}
                  onChange={(e) => setCounts((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder="0"
                  className="w-full pr-6 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">석</span>
              </div>
            </div>
          ))}
        </div>

        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 환불기준 팝업 ──────────────────────────────────────────────────

const LEGAL_SLOTS: RefundSlot[] = [
  { daysBeforeDep: 30, penaltyRate: 0,   label: "위약금 없음" },
  { daysBeforeDep: 20, penaltyRate: 10 },
  { daysBeforeDep: 10, penaltyRate: 15 },
  { daysBeforeDep: 8,  penaltyRate: 20 },
  { daysBeforeDep: 1,  penaltyRate: 30 },
  { daysBeforeDep: 0,  penaltyRate: 50 },
];

function calcRefundClient(amount: number, daysLeft: number, policy: RefundPolicyJson | null) {
  const usePolicy = policy?.isStructured && policy.slots?.length ? policy : null;
  const slots = usePolicy ? usePolicy.slots : LEGAL_SLOTS;
  const isLegal = !usePolicy;

  // 출발 후(daysLeft < 0): 환불 불가 (100%)
  if (daysLeft < 0) {
    const noRefundSlot: RefundSlot = { daysBeforeDep: -999, penaltyRate: 100, label: "출발 후 — 환불 불가" };
    return {
      refundAmount: 0,
      penaltyRate: 100,
      penaltyAmount: amount,
      daysBeforeDep: daysLeft,
      basis: "출발 후 환불 불가",
      appliedSlot: noRefundSlot,
      isLegal,
      displaySlots: slots,
    };
  }

  const sorted = [...slots].sort((a, b) => b.daysBeforeDep - a.daysBeforeDep);
  const appliedSlot = sorted.find((s) => daysLeft >= s.daysBeforeDep) ??
    { daysBeforeDep: 0, penaltyRate: 100, label: "당일 취소" };

  const penaltyAmount = Math.round((amount * appliedSlot.penaltyRate) / 100);
  return {
    refundAmount: amount - penaltyAmount,
    penaltyRate: appliedSlot.penaltyRate,
    penaltyAmount,
    daysBeforeDep: daysLeft,
    basis: isLegal ? "법정기준(관광진흥법 시행령)" : "상품별 환불정책",
    appliedSlot,
    isLegal,
    displaySlots: slots,
  };
}

interface RefundModalProps {
  product: Product;
  onClose: () => void;
}

function RefundModal({ product, onClose }: RefundModalProps) {
  const [amountInput, setAmountInput] = useState(
    product.price > 0 ? String(product.price) : ""
  );

  const amount = parseInt(amountInput.replace(/,/g, ""), 10) || 0;
  const daysLeft = product.daysLeft ?? 0;
  const result = amount > 0 ? calcRefundClient(amount, daysLeft, product.refundPolicy) : null;
  const slots = product.refundPolicy?.isStructured && product.refundPolicy.slots?.length
    ? product.refundPolicy.slots
    : LEGAL_SLOTS;

  const depLabel = product.departureDate ? formatDate(product.departureDate) : "-";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">환불기준 계산기</h2>
          {!product.refundPolicy?.isStructured && (
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">법정기준</span>
          )}
          {product.refundPolicy?.isStructured && (
            <span className="ml-auto text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">상품별 정책</span>
          )}
        </div>

        {/* 상품 정보 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">상품명</span>
            <span className="font-medium text-gray-900 text-right max-w-[60%]">{product.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">출발일</span>
            <span className="font-medium text-gray-900">{depLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">오늘 기준</span>
            <DdayBadge daysLeft={daysLeft} />
          </div>
        </div>

        {/* 금액 입력 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">결제금액 입력</label>
          <div className="relative">
            <input
              type="text"
              value={amountInput ? Number(amountInput.replace(/,/g, "")).toLocaleString("ko-KR") : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "").replace(/[^0-9]/g, "");
                setAmountInput(raw);
              }}
              placeholder="예: 1,290,000"
              className="w-full pr-8 pl-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
          </div>
        </div>

        {/* 계산 결과 */}
        {result && amount > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="bg-blue-50 px-4 py-2 border-b border-gray-200">
              <span className="text-xs font-medium text-blue-700">환불 계산 결과 — {result.basis}</span>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-gray-500">결제금액</span>
                <span className="font-medium">{amount.toLocaleString()}원</span>
              </div>
              {result.penaltyRate > 0 && (
                <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                  <span className="text-gray-500">위약금 ({result.penaltyRate}%){result.appliedSlot.label ? ` — ${result.appliedSlot.label}` : ""}</span>
                  <span className="font-medium text-orange-600">-{result.penaltyAmount.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
                <span className="font-semibold text-gray-800">환불금액</span>
                <span className={`text-lg font-bold ${result.penaltyRate > 0 ? "text-red-600" : "text-green-600"}`}>
                  {result.refundAmount.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 위약금 기준표 */}
        {daysLeft >= 0 && (
          <div className="text-xs text-gray-500 space-y-0.5">
            <p className="font-medium text-gray-600 mb-1">위약금 기준표</p>
            {[...slots]
              .sort((a, b) => b.daysBeforeDep - a.daysBeforeDep)
              .map((s) => {
                // 현재 적용 구간 하이라이트: 정렬된 배열에서 daysLeft >= s.daysBeforeDep 인 첫 번째 항목
                const isApplied = result?.appliedSlot.daysBeforeDep === s.daysBeforeDep;
                return (
                  <div
                    key={s.daysBeforeDep}
                    className={`flex justify-between rounded px-1 -mx-1 ${isApplied ? "bg-orange-50 text-orange-700 font-semibold" : ""}`}
                  >
                    <span>출발 {s.daysBeforeDep}일 전 이후</span>
                    <span>{s.penaltyRate}% {s.label ? `(${s.label})` : ""}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── APIS 미리보기 모달 ────────────────────────────────────────────

const APIS_HEADERS = [
  "순번","RV","CABIN","일행","루밍","카테고리",
  "영문성","영문이름","성명","주민번호","성별","생년월일",
  "여권번호","여권발급","여권만료","연락처",
  "항공","결제일","결제방법","결제금액","담당자","비고",
];

const APIS_KEYS: (keyof ApisRow)[] = [
  "seq","rv","cabin","groupId","roomingGroupId","cabinType",
  "engSurname","engGivenName","korName","residentNum","gender","birthDate",
  "passportNo","issueDate","expiryDate","phone",
  "airline","paymentDate","paymentMethod","paymentAmount","agentName","remarks",
];

interface ApisModalProps {
  product: Product;
  onClose: () => void;
}

function ApisModal({ product, onClose }: ApisModalProps) {
  const [rows, setRows] = useState<ApisRow[]>([]);
  const [tripTitle, setTripTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/apis/excel?productCode=${encodeURIComponent(product.code)}&preview=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setRows(d.rows ?? []);
          setTripTitle(d.tripTitle ?? product.name);
        } else {
          setError(d.error ?? "데이터를 불러오지 못했습니다.");
        }
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, [product.code, product.name]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/admin/apis/excel?productCode=${encodeURIComponent(product.code)}`);
      if (!res.ok) { alert("다운로드 실패"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = `APIS_${product.code}_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <div>
              <h2 className="text-base font-bold text-gray-900">APIS 탑승자 명단</h2>
              {tripTitle && <p className="text-xs text-gray-500 mt-0.5">{tripTitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloading ? "생성 중..." : "엑셀 다운로드"}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">데이터 불러오는 중...</span>
            </div>
          )}
          {error && (
            <div className="text-center py-20 text-red-500 text-sm">{error}</div>
          )}
          {!loading && !error && (
            <div className="text-xs">
              <p className="text-gray-500 mb-2 font-medium">
                {rows.length > 0 ? `총 ${rows.length}명` : "등록된 탑승자 없음 — 아래 양식으로 엑셀 다운로드 가능합니다"}
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {APIS_HEADERS.map((h) => (
                        <th key={h} className="px-2 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        {APIS_KEYS.map((k) => (
                          <td key={k} className="px-2 py-1.5 text-gray-800 whitespace-nowrap max-w-[120px] truncate">
                            {String(row[k] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={APIS_HEADERS.length} className="text-center py-8 text-gray-400">
                          탑승자 정보가 아직 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [refundProduct, setRefundProduct] = useState<Product | null>(null);
  const [apisProduct, setApisProduct] = useState<Product | null>(null);
  const [cabinRegisterCode, setCabinRegisterCode] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.role) setUserRole(d.role);
        if (d?.organizationId) setOrgId(d.organizationId);
      })
      .catch(() => {});
  }, []);

  const canDownloadApis = userRole === "OWNER" || userRole === "GLOBAL_ADMIN";
  const canRegisterCabin = userRole === "OWNER" || userRole === "GLOBAL_ADMIN";

  const cabinRegisterProduct = products.find((p) => p.code === cabinRegisterCode) ?? null;
  // orgId가 없어도 모달은 열고, 모달 내에서 에러 처리

  const fetchProducts = useCallback(
    (currentPage: number, q: string, isActive: ActiveFilter) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(LIMIT));
      if (q) params.set("q", q);
      if (isActive !== "all") params.set("isActive", isActive);

      fetch(`/api/products?${params.toString()}`)
        .then((res) => res.json())
        .then((data: ApiResponse) => {
          if (data.ok) {
            setProducts(data.products ?? []);
            setTotal(data.total ?? 0);
            setPage(data.page ?? 1);
            setTotalPages(data.totalPages ?? 1);
          } else {
            setError("데이터를 불러오지 못했습니다.");
          }
        })
        .catch(() => setError("네트워크 오류가 발생했습니다."))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchProducts(page, searchQuery, activeFilter);
  }, [fetchProducts, page, searchQuery, activeFilter]);

  function handleFilterChange(filter: ActiveFilter) {
    setActiveFilter(filter);
    setPage(1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  }

  function handleSearchClear() {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  }

  const filterTabs: { label: string; value: ActiveFilter }[] = [
    { label: "전체", value: "all" },
    { label: "활성", value: "true" },
    { label: "비활성", value: "false" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <ShoppingBag className="w-6 h-6 text-navy-900" />
        <h1 className="text-2xl font-bold text-navy-900">상품 관리</h1>
        {!loading && (
          <span className="ml-2 text-sm text-gray-500">총 {total.toLocaleString()}개</span>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleFilterChange(tab.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeFilter === tab.value
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="상품명 또는 상품코드 검색"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            검색
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              초기화
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">상품코드</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">상품명 · 일정</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">출발일</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">D-day</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">객실 잔여</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">가격</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">판매상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">도구</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && !error && products.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    등록된 상품이 없습니다
                  </td>
                </tr>
              )}

              {!loading &&
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    {/* 상품코드 */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                        {product.code}
                      </span>
                    </td>

                    {/* 상품명 + 크루즈라인 + 기항지 */}
                    <td className="px-4 py-3 max-w-[240px]">
                      <div className="font-medium text-gray-900 truncate">{product.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {product.cruiseLine}
                        {product.shipName ? ` · ${product.shipName}` : ""}
                        {product.nights > 0 ? ` · ${product.nights}박${product.days}일` : ""}
                      </div>
                      {product.ports.length > 0 && (
                        <div className="flex items-center gap-0.5 mt-0.5 text-xs text-blue-600">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{product.ports.join(" → ")}</span>
                        </div>
                      )}
                    </td>

                    {/* 출발일 */}
                    <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap">
                      {product.departureDate ? formatDate(product.departureDate) : "-"}
                    </td>

                    {/* D-day */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <DdayBadge daysLeft={product.daysLeft} />
                    </td>

                    {/* 객실 잔여 */}
                    <td className="px-4 py-3">
                      <CabinSummaryCell
                        summary={product.cabinSummary}
                        productCode={product.code}
                        onRegister={(code) => canRegisterCabin && setCabinRegisterCode(code)}
                      />
                    </td>

                    {/* 가격 */}
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums whitespace-nowrap">
                      {formatPrice(product.price)}
                    </td>

                    {/* 판매상태 */}
                    <td className="px-4 py-3 text-center">
                      <SaleStatusBadge status={product.saleStatus} />
                    </td>

                    {/* 도구 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {product.departureDate && (
                          <button
                            onClick={() => setRefundProduct(product)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            환불기준
                          </button>
                        )}
                        {canDownloadApis && (
                          <button
                            onClick={() => setApisProduct(product)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            APIS
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">{page} / {totalPages} 페이지</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                      pageNum === page ? "bg-navy-900 text-white" : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 환불기준 팝업 */}
      {refundProduct && (
        <RefundModal product={refundProduct} onClose={() => setRefundProduct(null)} />
      )}

      {/* APIS 미리보기 모달 */}
      {apisProduct && (
        <ApisModal product={apisProduct} onClose={() => setApisProduct(null)} />
      )}

      {/* 객실 등록 모달 */}
      {cabinRegisterProduct && (
        <CabinRegisterModal
          productCode={cabinRegisterProduct.code}
          productName={cabinRegisterProduct.name}
          organizationId={orgId ?? ''}
          onClose={() => setCabinRegisterCode(null)}
          onSaved={() => {
            setCabinRegisterCode(null);
            fetchProducts(page, searchQuery, activeFilter);
          }}
        />
      )}
    </div>
  );
}
