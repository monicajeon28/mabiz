"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, CheckCircle, Clock, XCircle, Plus, Download, FolderOpen } from "lucide-react";
import { showError, showSuccess } from "@/components/ui/Toast";
import html2canvas from "html2canvas";

type DocType = "COMPARISON_QUOTE" | "PURCHASE_CONFIRMATION" | "PURCHASE_CONTRACT" | "REFUND_CERTIFICATE";
type DocStatus = "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "DRAFT";

const DOC_TYPES: { key: DocType; label: string; api: string; color: string }[] = [
  { key: "COMPARISON_QUOTE",      label: "비교견적서",   api: "/api/documents/comparison-quote",    color: "blue"   },
  { key: "PURCHASE_CONFIRMATION", label: "구매확인증서", api: "/api/documents/purchase-cert",        color: "green"  },
  { key: "PURCHASE_CONTRACT",     label: "구매계약서",   api: "/api/documents/purchase-contract",    color: "purple" },
  { key: "REFUND_CERTIFICATE",    label: "환불증서",     api: "/api/documents/refund-cert",          color: "red"    },
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
  const [refunderName,  setRefunderName] = useState('');
  const [submitting,    setSub]          = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  // 비교견적서 전용 필드
  const [quoteCustomerName, setQuoteCustomerName] = useState('');
  const [quoteProductName, setQuoteProductName] = useState('');
  const [quotePrice,       setQuotePrice]       = useState('');
  const [quoteCruiseLine,  setQuoteCruiseLine]  = useState('');
  const [quoteNights,      setQuoteNights]      = useState('');
  const [quoteDeparture,   setQuoteDeparture]   = useState('');
  const [competitors, setCompetitors] = useState<{ name: string; price: string }[]>([
    { name: '', price: '' },
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 구매계약서 전용 필드
  const [contractSpecialTerms, setContractSpecialTerms] = useState('');
  const [contractSignedAt,     setContractSignedAt]     = useState('');
  // 구매계약서 발급 후 서명 링크
  const [lastSignUrl, setLastSignUrl] = useState<string | null>(null);

  const current = DOC_TYPES.find(d => d.key === tab)!;

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    fetch(current.api, signal ? { signal } : undefined)
      .then(r => r.json())
      .then((d: { ok: boolean; documents?: Document[]; message?: string }) => {
        if (d.ok) setDocs(d.documents ?? []);
        else showError('로드 실패');
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        showError('네트워크 오류');
      })
      .finally(() => setLoading(false));
  }, [current.api]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => { controller.abort(); };
  }, [load]);

  const requestDoc = async () => {
    if (tab === 'COMPARISON_QUOTE') {
      if (!quoteCustomerName.trim()) { showError('고객명을 입력하세요'); return; }
      if (!quoteProductName.trim()) { showError('상품명을 입력하세요'); return; }
      if (!quotePrice.trim() || isNaN(Number(quotePrice))) { showError('판매가를 입력하세요'); return; }
    } else if (!orderId.trim()) {
      showError('주문번호를 입력하세요');
      return;
    }
    setSub(true);
    try {
      const validCompetitors = competitors
        .filter(c => c.name.trim() && c.price.trim() && !isNaN(Number(c.price)))
        .map(c => ({ name: c.name.trim(), price: Number(c.price) }));

      const body = tab === 'COMPARISON_QUOTE'
        ? {
            customerName: quoteCustomerName.trim(),
            productName: quoteProductName.trim(),
            price: Number(quotePrice),
            ...(quoteCruiseLine.trim() ? { cruiseLine: quoteCruiseLine.trim() } : {}),
            ...(quoteNights.trim() && !isNaN(Number(quoteNights)) ? { nights: Number(quoteNights) } : {}),
            ...(quoteDeparture ? { departureDate: quoteDeparture } : {}),
            ...(validCompetitors.length > 0 ? { competitorPrices: validCompetitors } : {}),
          }
        : tab === 'PURCHASE_CONTRACT'
        ? {
            orderId,
            ...(contractSpecialTerms.trim() ? { specialTerms: contractSpecialTerms.trim() } : {}),
            ...(contractSignedAt ? { signedAt: contractSignedAt } : {}),
          }
        : {
            orderId,
            ...(tab === 'REFUND_CERTIFICATE' && refunderName.trim()
              ? { refunderName: refunderName.trim() }
              : {}),
          };
      const res = await fetch(current.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json() as { ok: boolean; message?: string; signUrl?: string; documentId?: string };
      if (!d.ok) { showError(d.message ?? '발급 실패'); return; }

      // 구매계약서이고 signUrl이 있으면 저장
      if (tab === 'PURCHASE_CONTRACT' && d.signUrl) {
        setLastSignUrl(d.signUrl);
      }

      setShowNew(false);
      setOrderId(''); setRefunderName('');
      setQuoteCustomerName(''); setQuoteProductName(''); setQuotePrice(''); setQuoteCruiseLine(''); setQuoteNights(''); setQuoteDeparture('');
      setCompetitors([{ name: '', price: '' }]);
      setContractSpecialTerms(''); setContractSignedAt('');
      setShowAdvanced(false);
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
      const canvas = await html2canvas(renderEl, { scale: 2, useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${current.key.toLowerCase()}-${doc.id.slice(-8)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      showError('다운로드 실패');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 md:w-6 md:h-6" /> 서류 관리
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">구매확인증 · 구매계약서 · 비교견적서 · 환불증서 발급</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> 새 서류 요청
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b pb-3">
        {DOC_TYPES.filter(d => {
          if (d.key === 'REFUND_CERTIFICATE' && (initialRole === 'AGENT' || initialRole === 'FREE_SALES')) return false;
          return true;
        }).map(d => (
          <button
            key={d.key}
            onClick={() => {
              setTab(d.key);
              setShowNew(false);
              setOrderId(''); setSelectedLabel(''); setRefunderName('');
              setQuoteCustomerName(''); setQuoteProductName(''); setQuotePrice(''); setQuoteCruiseLine('');
              setQuoteNights(''); setQuoteDeparture('');
              setCompetitors([{ name: '', price: '' }]);
              setContractSpecialTerms(''); setContractSignedAt('');
              setLastSignUrl(null);
              setShowAdvanced(false);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === d.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* 새 요청 폼 */}
      {showNew && (
        <div className="mb-6 border rounded-xl p-4 md:p-5 bg-gray-50">
          <p className="text-base md:text-sm font-semibold mb-4 md:mb-3">{current.label} 발급 요청</p>
          {tab === 'COMPARISON_QUOTE' ? (
            <div className="mb-3 space-y-4">
              {/* 필수 3개 필드 */}
              <div className="space-y-3">
                {/* 1. 고객명 (필수) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    고객명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={quoteCustomerName}
                    onChange={e => setQuoteCustomerName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 2. 당사 상품 (필수) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    당사 상품 <span className="text-red-500">*</span>
                  </label>
                  <ComparisonProductDropdown
                    onSelect={(name, price, line, nights, dept) => {
                      setQuoteProductName(name);
                      setQuotePrice(String(price));
                      setQuoteCruiseLine(line);
                      setQuoteNights(String(nights));
                      setQuoteDeparture(dept);
                    }}
                    selected={quoteProductName}
                  />
                </div>

                {/* 3. 당사 가격 (필수, 자동입력) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    당사 가격 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={quotePrice}
                      onChange={e => setQuotePrice(e.target.value)}
                      placeholder="상품 선택 시 자동입력"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {quotePrice && (
                      <span className="absolute right-3 top-2.5 text-sm text-gray-500">
                        {Number(quotePrice).toLocaleString()}원
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 미리보기 (실시간) */}
              {quoteProductName && quotePrice && (
                <ComparisonQuotePreview
                  productName={quoteProductName}
                  price={quotePrice}
                  cruiseLine={quoteCruiseLine}
                  nights={quoteNights}
                  competitors={competitors.filter(c => c.name.trim() && c.price.trim())}
                />
              )}

              {/* 고급옵션: 타사 가격 비교, 상세정보 */}
              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  <span>{showAdvanced ? '▼' : '▶'}</span>
                  고급옵션 ({showAdvanced ? '닫기' : '열기'})
                </button>

                {showAdvanced && (
                  <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    {/* 상세정보: 크루즈라인, 일수, 출발일 */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-600">상품 상세정보 (선택)</p>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          value={quoteCruiseLine}
                          onChange={e => setQuoteCruiseLine(e.target.value)}
                          placeholder="선사 (예: MSC)"
                          className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          value={quoteNights}
                          onChange={e => setQuoteNights(e.target.value)}
                          placeholder="일수"
                          min="0"
                          className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="date"
                          value={quoteDeparture}
                          onChange={e => setQuoteDeparture(e.target.value)}
                          className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* 타사 가격 비교 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-600">타사 가격 비교 (최대 3개)</p>
                        {competitors.length < 3 && (
                          <button
                            type="button"
                            onClick={() => setCompetitors(prev => [...prev, { name: '', price: '' }])}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            + 추가
                          </button>
                        )}
                      </div>
                      {competitors.map((c, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <input
                            value={c.name}
                            onChange={e => setCompetitors(prev => prev.map((p, j) => j === i ? { ...p, name: e.target.value } : p))}
                            placeholder={`${i === 0 ? '예: 하나투어' : `경쟁사${i + 1}`}`}
                            className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            value={c.price}
                            onChange={e => setCompetitors(prev => prev.map((p, j) => j === i ? { ...p, price: e.target.value } : p))}
                            placeholder="가격"
                            className="w-20 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => setCompetitors(prev => prev.filter((_, j) => j !== i))}
                              className="text-gray-400 hover:text-red-500 px-1.5 py-1.5 text-sm leading-none font-medium"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : tab === 'PURCHASE_CONTRACT' ? (
            <div className="mb-3 space-y-2">
              <SaleSearchDropdown
                docType="PURCHASE_CONTRACT"
                onSelect={(id, label) => { setOrderId(id); setSelectedLabel(label); }}
              />
              {orderId && <p className="text-sm text-green-600">✓ 선택됨: {selectedLabel || orderId}</p>}
              <div>
                <label className="block text-xs text-gray-500 mb-1">계약 서명일 (비워두면 오늘)</label>
                <input
                  type="date"
                  value={contractSignedAt}
                  onChange={e => setContractSignedAt(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">특약사항 (선택)</label>
                <textarea
                  value={contractSpecialTerms}
                  onChange={e => setContractSpecialTerms(e.target.value)}
                  placeholder="예: 얼리버드 할인 적용, 2인 이상 예약 조건 등"
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="mb-3 space-y-2">
              <SaleSearchDropdown
                docType={tab}
                onSelect={(id, label) => { setOrderId(id); setSelectedLabel(label); }}
              />
              {orderId && (
                <p className="text-sm text-green-600">✓ 선택됨: {selectedLabel || orderId}</p>
              )}
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
          <div className="flex gap-2 pt-3 border-t">
            <button
              onClick={requestDoc}
              disabled={submitting || !quoteCustomerName || !quoteProductName || !quotePrice}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              {submitting ? '처리 중...' : '다운로드'}
            </button>
            <button
              onClick={() => { setShowNew(false); setOrderId(''); setSelectedLabel(''); setRefunderName(''); setQuoteCustomerName(''); setQuoteProductName(''); setQuotePrice(''); setQuoteCruiseLine(''); setQuoteNights(''); setQuoteDeparture(''); setCompetitors([{ name: '', price: '' }]); setContractSpecialTerms(''); setContractSignedAt(''); setLastSignUrl(null); setShowAdvanced(false); }}
              className="px-4 py-3 border rounded-lg text-sm hover:bg-gray-100 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* PNG 다운로드용 렌더링 (화면 밖 절대 위치 — html2canvas 렌더링 가능) */}
      {docs.map(doc => {
        const d = doc.generatedData;
        const docType = DOC_TYPES.find(t => t.key === tab)!;
        const issuedDate = new Date(doc.createdAt).toLocaleDateString('ko-KR');
        return (
          <div
            key={`render-${doc.id}`}
            id={`doc-render-${doc.id}`}
            style={{ position: 'absolute', left: '-9999px', top: '0', width: '794px', padding: '60px', background: 'white', fontFamily: '"Malgun Gothic", "맑은 고딕", sans-serif', fontSize: '14px', color: '#111' }}
          >
            {/* 공통 헤더 */}
            <div style={{ textAlign: 'center', marginBottom: '48px', borderBottom: '3px solid #1a2e4a', paddingBottom: '24px' }}>
              <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px', letterSpacing: '2px' }}>크루즈닷 CRUISEDOT</p>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, letterSpacing: '4px' }}>{docType.label}</h1>
              <p style={{ fontSize: '12px', color: '#999', margin: '12px 0 0' }}>발급일: {issuedDate} · 문서번호: {doc.id.slice(-8).toUpperCase()}</p>
            </div>

            {/* 비교견적서 */}
            {tab === 'COMPARISON_QUOTE' && (
              <div>
                {/* 고객명 */}
                {d.customerName != null && (
                  <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #ddd' }}>
                    <p style={{ fontSize: '13px', color: '#555' }}>고객명: <span style={{ fontWeight: 'bold', color: '#1a2e4a' }}>{String(d.customerName)}</span></p>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                  <thead>
                    <tr style={{ background: '#1a2e4a', color: 'white' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px' }}>구분</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px' }}>상품명</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px' }}>가격</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px' }}>절감액</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: '#e8f4fd', fontWeight: 'bold' }}>
                      <td style={{ padding: '12px 16px', border: '1px solid #ddd', color: '#1a6fb5' }}>크루즈닷</td>
                      <td style={{ padding: '12px 16px', border: '1px solid #ddd' }}>{String(d.productName ?? '-')}{d.cruiseLine ? ` (${String(d.cruiseLine)})` : ''}{d.nights ? ` ${String(d.nights)}박` : ''}</td>
                      <td style={{ padding: '12px 16px', border: '1px solid #ddd', textAlign: 'right', color: '#1a6fb5', fontWeight: 'bold' }}>{Number(d.price ?? 0).toLocaleString()}원</td>
                      <td style={{ padding: '12px 16px', border: '1px solid #ddd', textAlign: 'right', color: '#2e7d32' }}>최저가</td>
                    </tr>
                    {(Array.isArray(d.competitorPrices) ? d.competitorPrices as { name: string; price: number }[] : []).map((c, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                        <td style={{ padding: '12px 16px', border: '1px solid #ddd', color: '#666' }}>{c.name}</td>
                        <td style={{ padding: '12px 16px', border: '1px solid #ddd', color: '#666' }}>동일 상품 기준</td>
                        <td style={{ padding: '12px 16px', border: '1px solid #ddd', textAlign: 'right' }}>{c.price.toLocaleString()}원</td>
                        <td style={{ padding: '12px 16px', border: '1px solid #ddd', textAlign: 'right', color: '#c62828' }}>+{(c.price - Number(d.price ?? 0)).toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!!d.departureDate && <p style={{ fontSize: '13px', color: '#555' }}>출발일: {String(d.departureDate)}</p>}
              </div>
            )}

            {(tab === 'PURCHASE_CONFIRMATION' || tab === 'PURCHASE_CONTRACT') && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                <tbody>
                {[
                  { label: '구매자명', value: String(d.buyerName ?? '-') },
                  { label: '연락처', value: String(d.buyerTel ?? '-') },
                  { label: '상품명', value: String(d.productName ?? '-') },
                  ...(d.departureDate != null ? [{ label: '출발일', value: String(d.departureDate) }] : []),
                  ...(d.nights != null ? [{ label: '여행기간', value: `${String(d.nights)}박` }] : []),
                  { label: '결제금액', value: `${Number(d.amount ?? 0).toLocaleString()}원` },
                  { label: '결제방법', value: String(d.paymentMethod ?? '-') },
                  ...(d.paidAt != null ? [{ label: '결제일시', value: new Date(String(d.paidAt)).toLocaleDateString('ko-KR') }] : []),
                  ...(tab === 'PURCHASE_CONTRACT' && d.signedAt != null ? [{ label: '계약일', value: String(d.signedAt) }] : []),
                ].map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={{ padding: '12px 16px', border: '1px solid #e0e0e0', fontWeight: 'bold', width: '30%', color: '#444' }}>{row.label}</td>
                    <td style={{ padding: '12px 16px', border: '1px solid #e0e0e0' }}>{row.value}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            )}

            {/* 구매계약서 — 취소/환불 규정 */}
            {tab === 'PURCHASE_CONTRACT' && (
              <div style={{ marginTop: '24px', padding: '16px', background: '#fff8e1', border: '1px solid #fbc02d', borderRadius: '8px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '13px' }}>취소 및 환불 규정</p>
                {(Array.isArray(d.cancellationPolicy) ? d.cancellationPolicy as string[] : []).map((line: string, i: number) => (
                  <p key={i} style={{ margin: '4px 0', fontSize: '12px', color: '#555' }}>• {String(line)}</p>
                ))}
              </div>
            )}
            {tab === 'PURCHASE_CONTRACT' && !!d.specialTerms && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>특약사항</p>
                <p style={{ fontSize: '12px', color: '#555' }}>{String(d.specialTerms)}</p>
              </div>
            )}

            {/* 환불증서 */}
            {tab === 'REFUND_CERTIFICATE' && (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  {[
                    { label: '구매자명', value: String(d.buyerName ?? '-') },
                    ...(d.refunderName && d.refunderName !== d.buyerName ? [{ label: '환불요청자', value: String(d.refunderName) }] : []),
                    { label: '상품명', value: String(d.productName ?? '-') },
                    { label: '결제금액', value: `${Number(d.amount ?? 0).toLocaleString()}원` },
                    { label: '위약금율', value: `${Number(d.penaltyRate ?? 0)}%` },
                    { label: '위약금', value: `${Number(d.penaltyAmount ?? 0).toLocaleString()}원` },
                    { label: '환불금액', value: `${Number(d.refundAmount ?? 0).toLocaleString()}원`, bold: true, highlight: '#e8f5e9' },
                    { label: '환불기준', value: String(d.refundBasis ?? '법정기준') },
                    ...(d.daysBeforeDep != null && Number(d.daysBeforeDep) >= 0 ? [{ label: '출발 전 일수', value: `${String(d.daysBeforeDep)}일` }] : []),
                    { label: '환불방법', value: String(d.paymentMethod ?? '-') },
                  ].map((row, i) => (
                    <tr key={i} style={{ background: (row as { highlight?: string }).highlight ?? (i % 2 === 0 ? '#f8f9fa' : 'white') }}>
                      <td style={{ padding: '12px 16px', border: '1px solid #e0e0e0', fontWeight: 'bold', width: '30%', color: '#444' }}>{row.label}</td>
                      <td style={{ padding: '12px 16px', border: '1px solid #e0e0e0', fontWeight: (row as { bold?: boolean }).bold ? 'bold' : 'normal', color: (row as { bold?: boolean }).bold ? '#c62828' : '#111', fontSize: (row as { bold?: boolean }).bold ? '16px' : '14px' }}>{row.value}</td>
                    </tr>
                  ))}
                </table>
                <div style={{ padding: '16px', background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '8px', fontSize: '12px', color: '#555' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>환불 계좌 안내</p>
                  <p>{String(d.companyAccount ?? '담당 에이전트에게 문의하세요')}</p>
                  <p style={{ marginTop: '8px', color: '#888' }}>* 환불 처리는 3~5 영업일 소요됩니다.</p>
                </div>
              </div>
            )}

            {/* 공통 푸터 */}
            <div style={{ marginTop: '48px', borderTop: '1px solid #ddd', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '12px', color: '#888' }}>
              <div>
                <p style={{ margin: 0 }}>크루즈닷 | 대표: {process.env.NEXT_PUBLIC_COMPANY_REP || '대표'}</p>
                <p style={{ margin: '4px 0 0' }}>{process.env.NEXT_PUBLIC_BANK_ACCOUNT || ''}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0 }}>문서번호: {doc.id.slice(-12).toUpperCase()}</p>
                <p style={{ margin: '4px 0 0' }}>발급일: {issuedDate}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* 구매계약서 서명 링크 배너 */}
      {lastSignUrl && tab === 'PURCHASE_CONTRACT' && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-blue-800">서명 링크 (고객에게 전달)</p>
            <button onClick={() => setLastSignUrl(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={lastSignUrl}
              className="flex-1 text-xs border border-blue-200 rounded-lg px-3 py-2 bg-white font-mono truncate"
            />
            <button
              onClick={() => { navigator.clipboard.writeText(lastSignUrl); showSuccess('링크 복사됨'); }}
              className="shrink-0 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              복사
            </button>
          </div>
          <p className="text-xs text-blue-600 mt-1.5">유효기간 7일 · 고객 이메일로도 자동 발송됩니다 (이메일 등록 시)</p>
        </div>
      )}

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
                      {tab === 'COMPARISON_QUOTE' && data.customerName
                        ? `${String(data.customerName)} - ${String(data.productName ?? '-')}`
                        : String(data.productName ?? data.buyerName ?? '-')}
                    </p>
                    {tab === 'COMPARISON_QUOTE' && data.customerName != null && (
                      <p className="text-sm text-gray-500">고객명: {String(data.customerName)}</p>
                    )}
                    {data.buyerName != null && tab !== 'COMPARISON_QUOTE' && (
                      <p className="text-sm text-gray-500">{String(data.buyerName)}{data.buyerTel ? ` · ${String(data.buyerTel)}` : ''}</p>
                    )}
                    {data.amount != null && (
                      <p className="text-sm text-gray-500">
                        {Number(data.amount).toLocaleString()}원
                        {tab === 'PURCHASE_CONTRACT' && data.signedAt != null && ` · 계약일 ${String(data.signedAt as string)}`}
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

// ─── ComparisonProductDropdown ────────────────────────────────────────────────

type Product = {
  id: string;
  name: string;
  price: number;
  cruiseLine?: string;
  nights?: number;
  departureDate?: string;
};

function ComparisonProductDropdown({
  onSelect,
  selected,
}: {
  onSelect: (name: string, price: number, cruiseLine: string, nights: string, departureDate: string) => void;
  selected: string;
}) {
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = (val: string) => {
    setQ(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setProducts([]); setOpen(false); return; }

    setLoading(true);
    timerRef.current = setTimeout(() => {
      // 샘플 상품 데이터 (실제로는 API에서 조회해야 함)
      const mockProducts: Product[] = [
        { id: '1', name: 'MSC 벨리시마 부산→일본 4박5일', price: 890000, cruiseLine: 'MSC', nights: 4, departureDate: '2026-07-15' },
        { id: '2', name: '코스타 세레나 인천→일본 5박6일', price: 1190000, cruiseLine: '코스타', nights: 5, departureDate: '2026-08-01' },
        { id: '3', name: 'Royal Caribbean 오션 오브 더 씨스', price: 1450000, cruiseLine: 'Royal Caribbean', nights: 7 },
        { id: '4', name: '노르웨지안 스피릿 홍콩 크루즈', price: 980000, cruiseLine: 'Norwegian', nights: 5 },
      ];
      const filtered = mockProducts.filter(p => p.name.toLowerCase().includes(val.toLowerCase()));
      setProducts(filtered);
      setOpen(true);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="relative">
      <input
        value={selected || q}
        onChange={e => {
          setQ(e.target.value);
          if (!e.target.value.trim()) {
            setOpen(false);
          } else {
            search(e.target.value);
          }
        }}
        onFocus={() => {
          if (q.trim() && products.length > 0) setOpen(true);
        }}
        placeholder="상품명, 선사명으로 검색"
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 text-gray-600 text-xs">검색중...</span>
      )}
      {open && products.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-lg shadow-lg mt-1 max-h-72 overflow-y-auto">
          {products.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p.name, p.price, p.cruiseLine ?? '', String(p.nights ?? ''), p.departureDate ?? '');
                setOpen(false);
                setQ('');
              }}
              className="w-full text-left px-3 py-2.5 text-sm border-b last:border-0 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-gray-800">{p.name}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-gray-500">
                  {p.cruiseLine ? `${p.cruiseLine} · ` : ''}
                  {p.nights ? `${p.nights}박` : ''}
                </span>
                <span className="font-semibold text-blue-600">{p.price.toLocaleString()}원</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && products.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-lg shadow mt-1 p-3 text-sm text-gray-600">
          검색 결과 없음
        </div>
      )}
    </div>
  );
}

// ─── ComparisonQuotePreview ───────────────────────────────────────────────────

interface ComparisonQuotePreviewProps {
  productName: string;
  price: string;
  cruiseLine: string;
  nights: string;
  competitors: Array<{ name: string; price: string }>;
}

function ComparisonQuotePreview({
  productName,
  price,
  cruiseLine,
  nights,
  competitors,
}: ComparisonQuotePreviewProps) {
  const validPrice = Number(price) || 0;
  const validCompetitors = competitors.filter(c => c.name.trim() && c.price.trim() && !isNaN(Number(c.price))).map(c => ({ name: c.name, price: Number(c.price) }));

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
      <p className="text-xs font-semibold text-blue-700 mb-3">미리보기 (자동 업데이트)</p>
      <div className="bg-white rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">상품</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">가격</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">절감액</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50 border-b">
              <td className="px-3 py-2">
                <div className="font-semibold text-blue-700">{productName}</div>
                {(cruiseLine || nights) && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    {cruiseLine && <span>{cruiseLine}</span>}
                    {cruiseLine && nights && <span> · </span>}
                    {nights && <span>{nights}박</span>}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-right font-bold text-blue-600">{validPrice.toLocaleString()}원</td>
              <td className="px-3 py-2 text-right text-xs text-green-600 font-medium">최저가</td>
            </tr>
            {validCompetitors.map((c, i) => {
              const savingsAmount = c.price - validPrice;
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-2 text-gray-700">{c.name}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{c.price.toLocaleString()}원</td>
                  <td className="px-3 py-2 text-right text-red-600 font-medium">+{savingsAmount.toLocaleString()}원</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  docType: "PURCHASE_CONFIRMATION" | "REFUND_CERTIFICATE" | "PURCHASE_CONTRACT";
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
    docType === 'REFUND_CERTIFICATE'
      ? s.canIssueRefundCert
      : s.canIssuePurchaseCert;

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
