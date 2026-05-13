'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import ComparativeQuote from '@/components/partner/documents/ComparativeQuote';
import Certificate from '@/components/partner/documents/Certificate';
import CertificateApprovals from '@/components/partner/documents/CertificateApprovals';

type TabType = 'comparison' | 'purchase' | 'refund' | 'approvals';

export default function PartnerDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params.partnerId as string;

  const [activeTab, setActiveTab] = useState<TabType>('comparison');
  const [profile, setProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/partner/profile');
        const json = await res.json();
        if (json.ok && json.profile) {
          setProfile(json.profile);
        }
      } catch (error) {
        console.error('[Partner Documents] Failed to load profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    loadProfile();
  }, []);

  const isBranchManager = profile?.type === 'BRANCH_MANAGER';
  // Branch Managers can see all tabs. Sales Agents can see Comparison and Approvals (to view their requests).
  // Actually, Sales Agents should also be able to request Purchase/Refund certificates, so they need those tabs too.
  // The plan says "Partners can request...". So everyone sees all tabs.
  // But only Branch Managers see "Team Requests" in Approvals, which is handled inside the component.

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-10 md:px-6">
        <header className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/partner/${partnerId}/dashboard`)}
                className="inline-flex items-center justify-center rounded-xl bg-white/20 p-2.5 text-white hover:bg-white/30 transition-colors"
              >
                <FiArrowLeft className="text-xl" />
              </button>
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold">서류관리</h1>
                <p className="text-sm text-white/80">
                  {isBranchManager
                    ? '타사 비교 견적서, 구매확인서, 환불완료증서를 생성하고 관리합니다.'
                    : '타사 비교 견적서를 생성하고, 구매/환불 인증서를 요청합니다.'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 bg-white rounded-lg shadow-sm">
          <nav className="flex gap-1 px-4 overflow-x-auto" aria-label="문서 탭">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg whitespace-nowrap ${activeTab === 'comparison'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              비교견적서
            </button>
            <button
              onClick={() => setActiveTab('purchase')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg whitespace-nowrap ${activeTab === 'purchase'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              구매확인증서
            </button>
            <button
              onClick={() => setActiveTab('refund')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg whitespace-nowrap ${activeTab === 'refund'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              환불인증서
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-6 py-4 text-sm font-semibold transition-all duration-200 rounded-t-lg whitespace-nowrap ${activeTab === 'approvals'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              승인 요청 현황
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="min-h-[500px]">
          {activeTab === 'comparison' && (
            <ComparativeQuote />
          )}
          {activeTab === 'purchase' && (
            <Certificate type="purchase" />
          )}
          {activeTab === 'refund' && (
            <Certificate type="refund" />
          )}
          {activeTab === 'approvals' && !isLoadingProfile && (
            <CertificateApprovals partnerRole={profile?.type || 'SALES_AGENT'} />
          )}
          {activeTab === 'approvals' && isLoadingProfile && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
