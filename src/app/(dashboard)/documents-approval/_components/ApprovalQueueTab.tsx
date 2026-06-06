'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, FileText } from 'lucide-react';

type PendingDoc = {
  id: string;
  documentType: string;
  buyerName: string;
  productName: string;
  amount: number | null;
  orderId: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  PURCHASE_CONFIRMATION: '구매확인증',
  REFUND_CERTIFICATE: '환불인증서',
  COMPARISON_QUOTE: '비교견적서',
};

/**
 * 승인 대기(PENDING_APPROVAL) 서류 처리 탭 (DOC-2).
 * 판매원(AGENT)이 발급한 서류를 OWNER/GLOBAL_ADMIN이 승인/거절한다.
 * 승인 시 approve API가 고객에게 승인 안내 메일을 발송한다.
 */
export default function ApprovalQueueTab() {
  const [items, setItems] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/documents/pending');
      const data = await res.json();
      if (res.ok && data.ok) setItems(data.items ?? []);
      else setError(data.message ?? '목록을 불러오지 못했습니다.');
    } catch {
      setError('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handle = async (id: string, action: 'approve' | 'reject') => {
    let note: string | undefined;
    if (action === 'reject') {
      note = window.prompt('거절 사유를 입력하세요 (선택):') ?? '';
    }
    setProcessingId(id);
    try {
      const res = await fetch(`/api/documents/approve/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setItems((prev) => prev.filter((x) => x.id !== id));
      } else {
        alert(data.message ?? '처리에 실패했습니다.');
      }
    } catch {
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-500">
        <FileText className="mb-2 h-10 w-10" />
        <p className="text-sm">승인 대기 중인 서류가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        판매원이 발급해 승인 대기 중인 서류입니다. 승인하면 고객에게 승인 안내 메일이 발송됩니다.
      </p>
      {items.map((d) => (
        <div
          key={d.id}
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {TYPE_LABEL[d.documentType] ?? d.documentType}
              </span>
              <span className="font-semibold text-gray-900">{d.buyerName || '(이름 없음)'}</span>
            </div>
            <p className="mt-1 truncate text-sm text-gray-500">
              {d.productName || '상품 미상'}
              {d.amount != null ? ` · ${d.amount.toLocaleString()}원` : ''}
              {d.orderId ? ` · 주문 ${d.orderId}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{new Date(d.createdAt).toLocaleString('ko-KR')}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => handle(d.id, 'approve')}
              disabled={processingId === d.id}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {processingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} 승인
            </button>
            <button
              onClick={() => handle(d.id, 'reject')}
              disabled={processingId === d.id}
              className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> 거절
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
