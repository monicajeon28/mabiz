'use client';

import { useState } from 'react';
import ComparativeQuote from '@/components/admin/documents/ComparativeQuote';
import Certificate from '@/components/admin/documents/Certificate';

type TabType = 'comparison' | 'purchase' | 'refund';

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('comparison');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {/* 탭 네비게이션 */}
        <div className="mb-6 border-b border-gray-200 bg-white rounded-lg shadow-sm">
          <nav className="flex gap-1 px-4" aria-label="문서 탭">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg ${
                activeTab === 'comparison'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              비교견적서
            </button>
            <button
              onClick={() => setActiveTab('purchase')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg ${
                activeTab === 'purchase'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              구매확인증서
            </button>
            <button
              onClick={() => setActiveTab('refund')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg ${
                activeTab === 'refund'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              환불인증서
            </button>
          </nav>
        </div>

        {/* 조건부 렌더링 */}
        <div className="mt-6">
          {activeTab === 'comparison' && <ComparativeQuote key="comparison" />}
          {activeTab === 'purchase' && <Certificate key="purchase" type="purchase" />}
          {activeTab === 'refund' && <Certificate key="refund" type="refund" />}
        </div>
      </div>
    </div>
  );
}