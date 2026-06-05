'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import ComparisonQuoteTab from './_components/ComparisonQuoteTab';
import CertificateTab from './_components/CertificateTab';
import ContractTab from './_components/ContractTab';

// ─── Tab config ────────────────────────────────────────────────────────────────

type TabType = 'comparison' | 'purchase' | 'refund' | 'contracts';

const TABS: { key: TabType; label: string; accent: 'indigo' | 'emerald' | 'red' | 'orange' }[] = [
  { key: 'comparison', label: '비교견적서', accent: 'indigo' },
  { key: 'purchase', label: '구매확인증서', accent: 'emerald' },
  { key: 'refund', label: '환불인증서', accent: 'red' },
  { key: 'contracts', label: '계약서 관리', accent: 'orange' },
];

const TAB_ACTIVE: Record<string, string> = {
  indigo: 'bg-indigo-600 text-white shadow-md',
  emerald: 'bg-emerald-600 text-white shadow-md',
  red: 'bg-red-600 text-white shadow-md',
  orange: 'bg-orange-600 text-white shadow-md',
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentsApprovalPage() {
  const [activeTab, setActiveTab] = useState<TabType>('comparison');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-10 md:px-6">

        {/* Header */}
        <header className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold">서류관리</h1>
              <p className="mt-1 text-sm text-slate-300">
                비교견적서·구매확인증서·환불인증서를 바로 만들어 PNG로 받고, 계약서를 발송·관리합니다.
              </p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <nav className="flex flex-wrap gap-1 px-4 pt-2" aria-label="서류관리 탭">
            {TABS.map(({ key, label, accent }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`rounded-t-lg px-5 py-3 text-sm font-semibold transition-all duration-200 ${
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
        </div>
      </div>
    </div>
  );
}
