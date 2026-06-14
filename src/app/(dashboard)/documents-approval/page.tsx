'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
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
