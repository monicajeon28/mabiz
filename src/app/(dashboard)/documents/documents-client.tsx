"use client";
import { useState, useEffect, useRef } from "react";
import { FileText, CheckCircle, Clock, XCircle, Plus, Download, FolderOpen } from "lucide-react";
import { showError } from "@/components/ui/Toast";
import html2canvas from "html2canvas";

type DocType = "COMPARISON_QUOTE" | "PURCHASE_CONFIRMATION" | "REFUND_CERTIFICATE";
type DocStatus = "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "DRAFT";

const DOC_TYPES: { key: DocType; label: string; api: string; color: string }[] = [
  { key: "COMPARISON_QUOTE",      label: "비교견적서",   api: "/api/documents/comparison-quote",  color: "blue"   },
  { key: "PURCHASE_CONFIRMATION", label: "구매확인증서", api: "/api/documents/purchase-cert",      color: "green"  },
  { key: "REFUND_CERTIFICATE",    label: "환불증서",     api: "/api/documents/refund-cert",        color: "red"    },
];

const STATUS_BADGE: Record<DocStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  APPROVED:         { label: "승인",     icon: <CheckCircle className="w-3 h-3" />, cls: "bg-green-100 text-green-700" },
  PENDING_APPROVAL: { label: "승인대기", icon: <Clock className="w-3 h-3" />,       cls: "bg-yellow-100 text-yellow-700" },
  REJECTED:         { label: "거절",     icon: <XCircle className="w-3 h-3" />,     cls: "bg-red-100 text-red-700" },
  DRAFT:            { label: "초안",     icon: <FileText className="w-3 h-3" />,    cls: "bg-gray-100 text-gray-600" },
};

type Document = {
  id: string;
  status: DocStatus;
  orderId?: string;
  createdAt: string;
  generatedData: Record<string, unknown>;
  approvedAt?: string;
};

interface DocumentsClientProps {
  initialRole: string;
}

export default function DocumentsClient({ initialRole }: DocumentsClientProps) {
  const [tab,        setTab]      = useState<DocType>("COMPARISON_QUOTE");
  const [docs,       setDocs]     = useState<Document[]>([]);
  const [loading,    setLoading]  = useState(false);
  const [showNew,       setShowNew]      = useState(false);
  const [orderId,       setOrderId]      = useState('');
  const [refunderName,  setRefunderName] = useState(''); // 환불 요청자 (구매자와 다를 수 있음)
  const [submitting,    setSub]          = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');

  const current = DOC_TYPES.find(d => d.key === tab)!;

  const load = () => {
    setLoading(true);
    fetch(current.api)
      .then(r => r.json())
      .then((d: { ok: boolean; documents?: Document[]; message?: string }) => {
        if (d.ok) setDocs(d.documents ?? []);
        else showError('로드 실패');
      })
      .catch(() => showError('네트워크 오류'))
      .finally(() => setLoading(false));
  };

  // ✅ 수정: tab과 initialRole을 의존성 배열에 포함 (exhaustive-deps 충족)
  useEffect(() => {
    load();
  }, [tab]);

  const requestDoc = async () => {
    if (tab !== 'COMPARISON_QUOTE' && !orderId.trim()) {
      showError('주문번호를 입력하세요');
      return;
    }
    setSub(true);
    try {
      const body = tab !== 'COMPARISON_QUOTE'
        ? {
            orderId,
            ...(tab === 'REFUND_CERTIFICATE' && refunderName.trim()
              ? { refunderName: refunderName.trim() }
              : {}),
          }
        : {};
      const res = await fetch(current.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json() as { ok: boolean; message?: string };
      if (!d.ok) { showError(d.message ?? '발급 실패'); return; }
      setShowNew(false);
      setOrderId('');
      setRefunderName('');
      load();
    } catch {
      showError('요청 실패');
    } finally {
      setSub(false);
    }
  };

  const approve = async (docId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/documents/approve/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await res.json() as { ok: boolean };
      if (d.ok) load(); else showError('처리 실패');
    } catch {
      showError('처리 중 오류가 발생했습니다');
    }
  };

  const downloadPNG = async (doc: Document) => {
    try {
      const renderEl = document.getElementById(`doc-render-${doc.id}`);
      if (!renderEl) { showError('렌더링 실패'); return; }
      const canvas = await html2canvas(renderEl, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${current.label}-${doc.id}.png`;
      link.click();
    } catch {
      showError('다운로드 실패');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-6 h-6" /> 서류 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">구매확인서 · 환불증서 · 비교견적서 발급</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> 새 서류 요청
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b pb-3">
        {DOC_TYPES.map(d => (
          <button
            key={d.key}
            onClick={() => setTab(d.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === d.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* 새 요청 폼 */}
      {showNew && (
        <div className="mb-6 border rounded-xl p-4 bg-gray-50">
          <p className="text-sm font-semibold mb-3">{current.label} 발급 요청</p>
          {tab !== 'COMPARISON_QUOTE' && (
            <div className="mb-3 space-y-2">
              <SaleSearchDropdown
                docType={tab}
                onSelect={(id, label) => { setOrderId(id); setSelectedLabel(label); }}
              />
              {orderId && (
                <p className="text-sm text-green-600">✓ 선택됨: {selectedLabel || orderId}</p>
              )}
              {/* 환불증서: 환불 요청자가 구매자와 다를 경우 입력 */}
              {tab === 'REFUND_CERTIFICATE' && (
                <div>
                  <label className="block text-sm text-gray-500 mb-1">
                    환불 요청자명 <span className="text-gray-600">(구매자와 다를 경우만 입력)</span>
                  </label>
                  <input
                    value={refunderName}
                    onChange={e => setRefunderName(e.target.value)}
                    placeholder="예: 김철수 (구매자 홍길동 대리 요청)"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={requestDoc}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {submitting ? '요청 중...' : '요청하기'}
            </button>
            <button
              onClick={() => { setShowNew(false); setOrderId(''); setSelectedLabel(''); setRefunderName(''); }}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 숨겨진 렌더링 영역 — PNG 다운로드용 */}
      {docs.map(doc => (
        <div
          key={`render-${doc.id}`}
          id={`doc-render-${doc.id}`}
          style={{ display: 'none', width: '800px', padding: '40px', background: 'white', fontFamily: 'sans-serif' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
              {current.label}
            </h2>
            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
              발급일: {new Date(doc.createdAt).toLocaleDateString('ko-KR')}
            </p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            {Object.entries(doc.generatedData as Record<string, unknown>)
              .filter(([k]) => !['issuerOrgId', 'issuedAt', 'competitorPrices'].includes(k))
              .map(([key, val]) => (
                <tr key={key} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold', width: '30%' }}>{key}</td>
                  <td style={{ padding: '8px' }}>
                    {typeof val === 'number' ? val.toLocaleString() : String(val ?? '-')}
                  </td>
                </tr>
              ))}
          </table>
          <p style={{ fontSize: '10px', color: '#999', marginTop: '20px' }}>
            문서ID: {doc.id}
          </p>
        </div>
      ))}

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>아직 {current.label}이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => {
            const badge = STATUS_BADGE[doc.status];
            const data  = doc.generatedData;
            return (
              <div key={doc.id} className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.icon} {badge.label}
                      </span>
                      {doc.orderId && (
                        <span className="text-sm text-gray-600">{doc.orderId}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">
                      {String(data.productName ?? data.buyerName ?? '-')}
                    </p>
                    {data.amount != null && (
                      <p className="text-sm text-gray-500">
                        {Number(data.amount).toLocaleString()}원
                      </p>
                    )}
                    {data.refundAmount != null && (
                      <p className="text-sm text-blue-600 font-medium">
                        환불액: {Number(data.refundAmount).toLocaleString()}원
                        {data.penaltyRate != null && ` (위약금 ${Number(data.penaltyRate)}%)`}
                      </p>
                    )}
                    {data.refunderName != null && data.refunderName !== data.buyerName && (
                      <p className="text-sm text-orange-500 mt-0.5">
                        {'환불요청자: ' + String(data.refunderName)}
                        {data.buyerName != null && ` (구매자: ${String(data.buyerName)})`}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(doc.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {doc.status === 'APPROVED' && (
                      <button
                        onClick={() => downloadPNG(doc)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100 transition-colors"
                      >
                        <Download className="w-3 h-3" /> PNG
                      </button>
                    )}
                    {doc.status === 'PENDING_APPROVAL' && (
                      <>
                        <button
                          onClick={() => approve(doc.id, 'approve')}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => approve(doc.id, 'reject')}
                          className="px-3 py-1.5 border text-gray-500 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                        >
                          거절
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SaleSearchDropdown ───────────────────────────────────────────────────────

type SaleResult = {
  saleId: string;
  orderId: string | null;
  productName: string;
  saleAmount: number;
  buyerName: string | null;
  buyerTel: string | null;
  refunderName: string | null; // 환불 요청자 (구매자와 다를 수 있음)
  customerPhone: string | null;
  canIssuePurchaseCert: boolean;
  canIssueRefundCert: boolean;
  paidAt: string | null;
  cancelledAt: string | null;
};

function SaleSearchDropdown({
  onSelect,
  docType,
}: {
  onSelect: (orderId: string, label: string) => void;
  docType: "PURCHASE_CONFIRMATION" | "REFUND_CERTIFICATE";
}) {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState<SaleResult[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = (val: string) => {
    setQ(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/search-sales?q=${encodeURIComponent(val)}`);
        const d   = await res.json() as { ok: boolean; sales?: SaleResult[] };
        if (d.ok) { setResults(d.sales ?? []); setOpen(true); }
      } catch { /* 실패 무시 */ }
      finally { setLoading(false); }
    }, 300);
  };

  const canIssue = (s: SaleResult) =>
    docType === 'PURCHASE_CONFIRMATION'
      ? s.canIssuePurchaseCert
      : s.canIssuePurchaseCert || s.canIssueRefundCert;

  return (
    <div className="relative">
      <input
        value={q}
        onChange={e => search(e.target.value)}
        placeholder="주문번호 / 상품명 / 전화번호 앞4자리 검색"
        className="w-full border rounded-lg px-3 py-2 text-sm pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 text-gray-600 text-sm">검색중...</span>
      )}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {results.map(s => (
            <button
              key={s.saleId}
              type="button"
              onClick={() => {
                if (!s.orderId) return;
                const label = `${s.productName} / ${s.buyerName ?? s.customerPhone ?? ''}`;
                onSelect(s.orderId, label);
                setOpen(false);
                setQ(`${s.productName} (${s.orderId})`);
              }}
              disabled={!canIssue(s) || !s.orderId}
              className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-gray-50
                ${!canIssue(s) || !s.orderId ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{s.productName}</span>
                <span className={`text-sm px-1.5 py-0.5 rounded shrink-0 ml-2
                  ${s.cancelledAt ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
                >
                  {s.cancelledAt ? '환불완료' : '결제완료'}
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-0.5">
                {s.orderId} · {s.saleAmount.toLocaleString()}원
              </div>
              <div className="text-sm mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {s.buyerName && (
                  <span className="text-gray-500">
                    구매자: <span className="text-gray-700 font-medium">{s.buyerName}</span>
                    {s.buyerTel && <span className="text-gray-600"> {s.buyerTel}</span>}
                  </span>
                )}
                {s.refunderName && s.refunderName !== s.buyerName && (
                  <span className="text-orange-500">
                    환불요청자: <span className="font-medium">{s.refunderName}</span>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-lg shadow mt-1 p-3 text-sm text-gray-600">
          검색 결과 없음
        </div>
      )}
    </div>
  );
}
