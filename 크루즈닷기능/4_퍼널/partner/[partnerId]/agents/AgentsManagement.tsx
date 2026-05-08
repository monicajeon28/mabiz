'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiUsers, FiTrendingUp, FiDollarSign, FiEye, FiEyeOff, FiRefreshCw } from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';

interface Agent {
  profileId: number;
  affiliateCode: string;
  type: string;
  status: string;
  displayName: string | null;
  branchLabel: string | null;
  joinedAt: string | null;
  user: {
    id: number | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    mallUserId: string | null;
    mallNickname: string | null;
    password: string | null;
  };
  metrics: {
    leadsTotal: number;
    leadsActive: number;
    salesCount: number;
    totalSalesAmount: number;
    confirmedSalesAmount: number;
    netRevenue: number;
    pendingCommission: number;
    settledCommission: number;
    overrideCommission: number;
    withholding: number;
    lastSaleAt: string | null;
  };
}

interface Summary {
  agentCount: number;
  leadsTotal: number;
  salesCount: number;
  salesAmount: number;
  confirmedSalesAmount: number;
  pendingCommission: number;
  settledCommission: number;
  overrideCommission: number;
}

interface AgentsData {
  ok: boolean;
  role: string;
  managerProfileId: number | null;
  agents: Agent[];
  summary: Summary;
}

export default function AgentsManagement({
  partnerId,
  profile
}: {
  partnerId: string;
  profile: any;
}) {
  const [data, setData] = useState<AgentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/partner/agents');
      const result = await res.json();

      if (!result.ok) {
        throw new Error(result.message || '판매원 정보를 불러오지 못했습니다.');
      }

      setData(result);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      showError(error instanceof Error ? error.message : '판매원 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const togglePasswordVisibility = (agentId: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }));
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess(`${label}을(를) 클립보드에 복사했습니다.`);
    } catch (error) {
      showError('복사에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">판매원 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">판매원 정보를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const { agents, summary } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-10 md:px-6">
        {/* 헤더 */}
        <header className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl shadow-xl shadow-slate-900/20">
          <div className="relative z-10 flex flex-col gap-8 px-6 py-12">
            <div className="flex items-center gap-4">
              <Link
                href={`/partner/${partnerId}/dashboard`}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <FiArrowLeft className="w-5 h-5" />
                <span className="text-sm">대시보드로 돌아가기</span>
              </Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <FiUsers className="w-8 h-8" />
                <h1 className="text-3xl font-black leading-snug md:text-4xl">
                  판매원 관리
                </h1>
              </div>
              <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                소속 판매원의 실적과 수당을 확인하고 관리하세요.
              </p>
            </div>

            {/* 요약 통계 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <FiUsers className="w-4 h-4" />
                  <span>판매원 수</span>
                </div>
                <p className="text-2xl font-bold">{summary.agentCount}명</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <FiTrendingUp className="w-4 h-4" />
                  <span>총 매출</span>
                </div>
                <p className="text-2xl font-bold">
                  {summary.salesAmount.toLocaleString('ko-KR')}원
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <FiDollarSign className="w-4 h-4" />
                  <span>정산 수당</span>
                </div>
                <p className="text-2xl font-bold">
                  {summary.settledCommission.toLocaleString('ko-KR')}원
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
                  <FiDollarSign className="w-4 h-4" />
                  <span>대기 수당</span>
                </div>
                <p className="text-2xl font-bold">
                  {summary.pendingCommission.toLocaleString('ko-KR')}원
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* 새로고침 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={fetchAgents}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">새로고침</span>
          </button>
        </div>

        {/* 판매원 목록 */}
        {agents.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
            <FiUsers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">등록된 판매원이 없습니다</h3>
            <p className="text-slate-600 mb-6">
              대시보드에서 판매원을 초대하여 팀을 구성하세요.
            </p>
            <Link
              href={`/partner/${partnerId}/dashboard`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              대시보드로 이동
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {agents.map((agent) => (
              <div
                key={agent.profileId}
                className="bg-white rounded-3xl shadow-lg overflow-hidden"
              >
                {/* 판매원 기본 정보 */}
                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-900">
                          {agent.displayName || agent.user.name || '이름 없음'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          agent.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {agent.status === 'ACTIVE' ? '활성' : '비활성'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <div>
                          <span className="font-semibold">제휴코드:</span> {agent.affiliateCode}
                        </div>
                        {agent.user.mallUserId && (
                          <div>
                            <span className="font-semibold">판매몰 ID:</span> {agent.user.mallUserId}
                          </div>
                        )}
                        {agent.joinedAt && (
                          <div>
                            <span className="font-semibold">가입일:</span>{' '}
                            {new Date(agent.joinedAt).toLocaleDateString('ko-KR')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상세 정보 그리드 */}
                <div className="grid md:grid-cols-2 gap-6 p-6">
                  {/* 연락처 정보 */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 mb-3">연락처 정보</h4>
                    {agent.user.email && (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-slate-600">이메일</span>
                        <button
                          onClick={() => copyToClipboard(agent.user.email!, '이메일')}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {agent.user.email}
                        </button>
                      </div>
                    )}
                    {agent.user.phone && (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-slate-600">전화번호</span>
                        <button
                          onClick={() => copyToClipboard(agent.user.phone!, '전화번호')}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {agent.user.phone}
                        </button>
                      </div>
                    )}
                    {agent.user.password && (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-slate-600">비밀번호</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(agent.user.password!, '비밀번호')}
                            className="text-sm text-blue-600 hover:text-blue-700 font-mono"
                          >
                            {showPasswords[agent.profileId] ? agent.user.password : '••••••••'}
                          </button>
                          <button
                            onClick={() => togglePasswordVisibility(agent.profileId)}
                            className="p-1 hover:bg-slate-100 rounded"
                          >
                            {showPasswords[agent.profileId] ? (
                              <FiEyeOff className="w-4 h-4 text-slate-600" />
                            ) : (
                              <FiEye className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 실적 정보 */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900 mb-3">실적 현황</h4>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-slate-600">총 리드</span>
                      <span className="text-sm font-semibold">{agent.metrics.leadsTotal}건</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-slate-600">활성 리드</span>
                      <span className="text-sm font-semibold text-green-600">
                        {agent.metrics.leadsActive}건
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-slate-600">총 판매</span>
                      <span className="text-sm font-semibold">{agent.metrics.salesCount}건</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-slate-600">총 매출</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {agent.metrics.totalSalesAmount.toLocaleString('ko-KR')}원
                      </span>
                    </div>
                    {agent.metrics.lastSaleAt && (
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-slate-600">최근 판매</span>
                        <span className="text-sm">
                          {new Date(agent.metrics.lastSaleAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 수당 정보 */}
                  <div className="md:col-span-2 bg-slate-50 rounded-xl p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">수당 현황</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 mb-1">정산 완료</p>
                        <p className="text-lg font-bold text-green-600">
                          {agent.metrics.settledCommission.toLocaleString('ko-KR')}원
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">정산 대기</p>
                        <p className="text-lg font-bold text-orange-600">
                          {agent.metrics.pendingCommission.toLocaleString('ko-KR')}원
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 mb-1">원천징수</p>
                        <p className="text-lg font-bold text-slate-600">
                          {agent.metrics.withholding.toLocaleString('ko-KR')}원
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                {agent.user.mallUserId && (
                  <div className="px-6 py-4 bg-slate-50 border-t flex gap-3">
                    <Link
                      href={`/${agent.user.mallUserId}/shop`}
                      target="_blank"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                    >
                      판매몰 방문
                    </Link>
                    <Link
                      href={`/partner/${agent.user.mallUserId}/dashboard`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold"
                    >
                      대시보드 보기
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
