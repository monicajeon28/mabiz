"use client";
import { useState, useEffect, useRef } from "react";
import { FileText, CheckCircle, Clock, XCircle, Plus, Download, FolderOpen } from "lucide-react";
import { showError } from "@/components/ui/Toast";
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
  const [quoteProductName, setQuoteProductName] = useState('');
  const [quotePrice,       setQuotePrice]       = useState('');
  const [quoteCruiseLine,  setQuoteCruiseLine]  = useState('');
  const [quoteNights,      setQuoteNights]      = useState('');
  const [quoteDeparture,   setQuoteDeparture]   = useState('');
  const [competitors, setCompetitors] = useState<{ name: string; price: string }[]>([
    { name: '', price: '' },
  ]);
  // 구매계약서 전용 필드
  const [contractSpecialTerms, setContractSpecialTerms] = useState('');
  const [contractSignedAt,     setContractSignedAt]     = useState('');

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
    if (tab === 'COMPARISON_QUOTE') {
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
      const d = await res.json() as { ok: boolean; message?: string };
      if (!d.ok) { showError(d.message ?? '발급 실패'); return; }
      setShowNew(false);
      setOrderId(''); setRefunderName('');
      setQuoteProductName(''); setQuotePrice(''); setQuoteCruiseLine(''); setQuoteNights(''); setQuoteDeparture('');
      setCompetitors([{ name: '', price: '' }]);
      setContractSpecialTerms(''); setContractSignedAt('');
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
          {tab === 'COMPARISON_QUOTE' ? (
            <div className="mb-3 space-y-3">
              {/* 크루즈닷 상품 정보 */}
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">크루즈닷 상품</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">상품명 <span className="text-red-500">*</span></label>
                  <input
                    value={quoteProductName}
                    onChange={e => setQuoteProductName(e.target.value)}
                    placeholder="예: MSC 벨리시마 부산→일본 4박5일"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">판매가 (원) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={quotePrice}
                    onChange={e => setQuotePrice(e.target.value)}
                    placeholder="예: 890000"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">선사명</label>
                  <input
                    value={quoteCruiseLine}
                    onChange={e => setQuoteCruiseLine(e.target.value)}
                    placeholder="예: MSC, 코스타"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">박수</label>
                  <input
                    type="number"
                    value={quoteNights}
                    onChange={e => setQuoteNights(e.target.value)}
                    placeholder="예: 4"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">출발일</label>
                  <input
                    type="date"
                    value={quoteDeparture}
                    onChange={e => setQuoteDeparture(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 타사 상품 비교 (수동 입력) */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">타사 비교 상품 (수동 입력)</p>
                  <button
                    type="button"
                    onClick={() => setCompetitors(prev => [...prev, { name: '', price: '' }])}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + 추가
                  </button>
                </div>
                {competitors.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      value={c.name}
                      onChange={e => setCompetitors(prev => prev.map((p, j) => j === i ? { ...p, name: e.target.value } : p))}
                      placeholder="경쟁사명 (예: 하나투어, 모두투어)"
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={c.price}
                      onChange={e => setCompetitors(prev => prev.map((p, j) => j === i ? { ...p, price: e.target.value } : p))}
                      placeholder="가격 (원)"
                      className="w-28 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {competitors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCompetitors(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 px-1 text-lg leading-none"
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : tab === 'PURCHASE_CONTRACT' ? (
            <div className="mb-3 space-y-2">
              <SaleSearchDropdown
                docType="PURCHASE_CONFIRMATION"
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
          <div className="flex gap-2">
            <button
              onClick={requestDoc}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {submitting ? '요청 중...' : '요청하기'}
            </button>
            <button
              onClick={() => { setShowNew(false); setOrderId(''); setSelectedLabel(''); setRefunderName(''); setQuoteProductName(''); setQuotePrice(''); setQuoteCruiseLine(''); setQuoteNights(''); setQuoteDeparture(''); setCompetitors([{ name: '', price: '' }]); setContractSpecialTerms(''); setContractSignedAt(''); }}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100 transition-colors"
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
                    {(d.competitorPrices as { name: string; price: number }[] ?? []).map((c, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                        <td style={{ padding: '12px 16px', border: '1px solid #ddd', color: '#666' }}>{c.name}</td>
                        <td style={{ padding: '12px 16px', border: '1px solid #ddd', color: '#666' }}>동일 상품 기준</td>
                        <td style={{ padding: '12px 16px', border: '1px solid #ddd', textAlign: 'right' }}>{c.price.toLocaleString()}원</td>
                        <td style={{ padding: '12px 16px', border: '1px solid #ddd', textAlign: 'right', color: '#c62828' }}>+{(c.price - Number(d.price ?? 0)).toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.departureDate && <p style={{ fontSize: '13px', color: '#555' }}>출발일: {String(d.departureDate)}</p>}
              </div>
            )}

            {/* 구매확인증서 / 구매계약서 */}
            {(tab === 'PURCHASE_CONFIRMATION' || tab === 'PURCHASE_CONTRACT') && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                {[
                  { label: '구매자명', value: String(d.buyerName ?? '-') },
                  { label: '연락처', value: String(d.buyerTel ?? '-') },
                  { label: '상품명', value: String(d.productName ?? '-') },
                  ...(d.departureDate ? [{ label: '출발일', value: String(d.departureDate) }] : []),
                  ...(d.nights ? [{ label: '여행기간', value: `${String(d.nights)}박` }] : []),
                  { label: '결제금액', value: `${Number(d.amount ?? 0).toLocaleString()}원` },
                  { label: '결제방법', value: String(d.paymentMethod ?? '-') },
                  ...(d.paidAt ? [{ label: '결제일시', value: new Date(String(d.paidAt)).toLocaleDateString('ko-KR') }] : []),
                  ...(tab === 'PURCHASE_CONTRACT' && d.signedAt ? [{ label: '계약일', value: String(d.signedAt) }] : []),
                ].map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={{ padding: '12px 16px', border: '1px solid #e0e0e0', fontWeight: 'bold', width: '30%', color: '#444' }}>{row.label}</td>
                    <td style={{ padding: '12px 16px', border: '1px solid #e0e0e0' }}>{row.value}</td>
                  </tr>
                ))}
              </table>
            )}

            {/* 구매계약서 — 취소/환불 규정 */}
            {tab === 'PURCHASE_CONTRACT' && (
              <div style={{ marginTop: '24px', padding: '16px', background: '#fff8e1', border: '1px solid #fbc02d', borderRadius: '8px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '13px' }}>취소 및 환불 규정</p>
                {(d.cancellationPolicy as string[] ?? []).map((line, i) => (
                  <p key={i} style={{ margin: '4px 0', fontSize: '12px', color: '#555' }}>• {line}</p>
                ))}
              </div>
            )}
            {tab === 'PURCHASE_CONTRACT' && d.specialTerms && (
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
                <p style={{ margin: 0 }}>크루즈닷 | 대표: 배연성</p>
                <p style={{ margin: '4px 0 0' }}>국민은행 531301-04-167150</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0 }}>문서번호: {doc.id.slice(-12).toUpperCase()}</p>
                <p style={{ margin: '4px 0 0' }}>발급일: {issuedDate}</p>
              </div>
            </div>
          </div>
        );
      })}

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
