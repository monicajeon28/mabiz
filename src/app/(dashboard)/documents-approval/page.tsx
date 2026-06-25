'use client';

import { useState, useEffect } from 'react';
import { FileText, Lock, Loader2 } from 'lucide-react';
import ComparisonQuoteTab from './_components/ComparisonQuoteTab';
import CertificateTab from './_components/CertificateTab';
import ContractTab from './_components/ContractTab';
import ApprovalQueueTab from './_components/ApprovalQueueTab';

// ─── Tab config ────────────────────────────────────────────────────────────────

type TabType = 'comparison' | 'purchase' | 'refund' | 'contracts' | 'approval';

const TABS: { key: TabType; label: string; accent: 'indigo' | 'emerald' | 'red' | 'orange' | 'slate' }[] = [
  { key: 'comparison', label: '비교견적서', accent: 'indigo' },
  { key: 'purchase', label: '구매확인증서', accent: 'emerald' },
  { key: 'refund', label: '환불인증서', accent: 'red' },
  { key: 'contracts', label: '계약서 관리', accent: 'orange' },
  { key: 'approval', label: '승인 대기', accent: 'slate' },
];

const TAB_ACTIVE: Record<string, string> = {
  indigo: 'bg-indigo-600 text-white shadow-md',
  emerald: 'bg-emerald-600 text-white shadow-md',
  red: 'bg-red-600 text-white shadow-md',
  orange: 'bg-orange-600 text-white shadow-md',
  slate: 'bg-slate-700 text-white shadow-md',
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentsApprovalPage() {
  const [activeTab, setActiveTab] = useState<TabType>('comparison');

  // 역할 게이트 — 서류관리는 상품/결제건 접근이 필요해 마케터(FREE_SALES)는 사용 불가.
  // (서버 발급 API들도 FREE_SALES 403이므로 화면에서 미리 안내해 '상품이 안 뜬다'는 혼선 방지)
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok) setRole(j.role ?? null); })
      .catch(() => {})
      .finally(() => { if (alive) setRoleLoading(false); });
    return () => { alive = false; controller.abort(); };
  }, []);

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 불러오는 중...
      </div>
    );
  }

  if (role === 'FREE_SALES') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Lock className="h-7 w-7 text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">서류관리 권한이 없습니다</h2>
          <p className="mt-2 text-base leading-relaxed text-gray-600">
            비교견적서·구매확인증서·환불인증서·계약서 발급은
            <br />대리점장 이상만 사용할 수 있습니다.
          </p>
          <p className="mt-3 text-sm text-gray-400">담당 관리자에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-10 md:px-6">

        {/* Header */}
        <header className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-8 text-white shadow-xl">
          <div className="flex items-start sm:items-center gap-2 sm:gap-3">
            <div className="rounded-xl sm:rounded-2xl bg-white/10 p-2 sm:p-3 flex-shrink-0">
              <FileText className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-extrabold">서류관리</h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-300">
                비교견적서·구매확인증서·환불인증서를 바로 만들어 PNG로 받고, 계약서를 발송·관리합니다.
              </p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="rounded-lg sm:rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <nav className="flex gap-0.5 sm:gap-1 px-2 sm:px-4 pt-1.5 sm:pt-2 min-w-min" aria-label="서류관리 탭">
            {TABS.map(({ key, label, accent }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`rounded-t-lg px-2.5 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap h-10 sm:h-auto flex items-center ${
                  activeTab === key
                    ? TAB_ACTIVE[accent]
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'comparison' && <ComparisonQuoteTab />}
          {activeTab === 'purchase' && <CertificateTab mode="purchase" />}
          {activeTab === 'refund' && <CertificateTab mode="refund" />}
          {activeTab === 'contracts' && <ContractTab />}
          {activeTab === 'approval' && <ApprovalQueueTab />}
        </div>
      </div>
    </div>
  );
}
