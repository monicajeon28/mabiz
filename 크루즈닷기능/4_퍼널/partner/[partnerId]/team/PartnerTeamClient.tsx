'use client';

import { useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  FiNavigation,
  FiRefreshCw,
  FiChevronRight,
  FiUsers,
  FiTrendingUp,
  FiCreditCard,
  FiArrowLeft,
  FiSend,
  FiX,
  FiCheck,
  FiSearch,
  FiEye,
  FiExternalLink,
  FiEyeOff,
} from 'react-icons/fi';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { showError, showSuccess } from '@/components/ui/Toast';
import { getAffiliateTerm } from '@/lib/utils';

type AgentMetrics = {
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

type AgentRecord = {
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
    password: string | null; // 비밀번호 추가
  };
  metrics: AgentMetrics;
};

type AgentsResponse = {
  ok: boolean;
  role: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'HQ';
  managerProfileId: number | null;
  agents: AgentRecord[];
  summary: {
    agentCount: number;
    leadsTotal: number;
    salesCount: number;
    salesAmount: number;
    confirmedSalesAmount: number;
    pendingCommission: number;
    settledCommission: number;
    overrideCommission: number;
  };
};

function formatCurrency(value: number) {
  return value.toLocaleString('ko-KR');
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// 리드 상태를 한글로 변환
function formatLeadStatus(status: string) {
  const statusMap: Record<string, string> = {
    'NEW': '신규',
    'CONTACTED': '소통중',
    'QUALIFIED': '자격확인',
    'CONVERTED': '전환 완료',
    'LOST': '손실',
    'IN_PROGRESS': '진행 중',
    'PURCHASED': '구매 완료',
    'REFUNDED': '환불',
    'CLOSED': '종료',
    'TEST_GUIDE': '3일부재',
  };
  return statusMap[status] || status;
}

type Customer = {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  agent: {
    id: number;
    displayName: string | null;
  } | null;
};

export default function PartnerTeamClient() {
  const params = useParams();
  const pathname = usePathname();
  const affiliateTerm = getAffiliateTerm(pathname || undefined);
  const partnerId = params?.partnerId as string;
  const [data, setData] = useState<AgentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDbTransferModal, setShowDbTransferModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(new Set());
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [contracts, setContracts] = useState<Array<{
    id: number;
    userId: number;
    name: string;
    phone: string;
    email: string | null;
    status: string;
    submittedAt: string | null;
    completedAt: string | null;
    invitedByProfileId: number | null;
    mentor?: {
      id: number;
      displayName: string | null;
      affiliateCode: string;
      branchLabel: string | null;
    } | null;
  }>>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState<'all' | 'submitted' | 'completed' | 'rejected'>('all');
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [showContractDetail, setShowContractDetail] = useState(false);
  const [loadingContractDetail, setLoadingContractDetail] = useState(false);
  const [completingContract, setCompletingContract] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);
  const [rejectingContract, setRejectingContract] = useState(false);
  const [deletingContract, setDeletingContract] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/partner/agents', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '판매원 정보를 불러오지 못했습니다.');
      }
      setData(json as AgentsResponse);
      setError(null);
    } catch (err) {
      logger.error('[PartnerTeamClient] load error', err);
      const message = err instanceof Error ? err.message : '판매원 정보를 불러오지 못했습니다.';
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (data && data.role === 'BRANCH_MANAGER') {
      loadContracts();
    }
  }, [data]);

  const loadContracts = async () => {
    if (!data || data.role !== 'BRANCH_MANAGER') return;
    try {
      setLoadingContracts(true);
      const res = await fetch('/api/partner/contracts', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.ok && Array.isArray(json.contracts)) {
        setContracts(json.contracts);
      }
    } catch (error) {
      logger.error('[PartnerTeamClient] load contracts error:', error);
    } finally {
      setLoadingContracts(false);
    }
  };

  // 계약서 완료 (PDF 이메일 전송)
  const handleCompleteContract = async (contractId: number) => {
    if (!confirm('이 계약서를 완료하여 PDF를 이메일로 전송하시겠습니까?')) return;
    try {
      setCompletingContract(true);
      const res = await fetch(`/api/partner/contracts/${contractId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || '계약서 완료 처리에 실패했습니다.');
      }
      showSuccess(json.message || '계약서가 완료되었습니다.');
      setShowContractDetail(false);
      setSelectedContract(null);
      loadContracts();
    } catch (error: any) {
      logger.error('[PartnerTeamClient] complete error', error);
      showError(error.message || '계약서 완료 처리 중 오류가 발생했습니다.');
    } finally {
      setCompletingContract(false);
    }
  };

  // PDF 전송
  const handleSendPdf = async (contractId: number) => {
    if (!confirm('계약서 PDF를 계약자 이메일 주소로 전송하시겠습니까?')) return;
    try {
      setSendingPdf(true);
      const res = await fetch(`/api/partner/contracts/${contractId}/send-pdf`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || 'PDF 전송에 실패했습니다.');
      }
      showSuccess(json.message || 'PDF가 성공적으로 전송되었습니다.');
    } catch (error: any) {
      logger.error('[PartnerTeamClient] send PDF error', error);
      showError(error.message || 'PDF 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingPdf(false);
    }
  };

  // 계약서 거부
  const handleRejectContract = async (contractId: number) => {
    const reason = prompt('거부 사유를 입력하세요:');
    if (!reason) return;
    try {
      setRejectingContract(true);
      const res = await fetch(`/api/partner/contracts/${contractId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '계약서 거부에 실패했습니다.');
      }
      showSuccess('계약서가 거부되었습니다.');
      setShowContractDetail(false);
      setSelectedContract(null);
      loadContracts();
    } catch (error: any) {
      logger.error('[PartnerTeamClient] reject error', error);
      showError(error.message || '계약서 거부 중 오류가 발생했습니다.');
    } finally {
      setRejectingContract(false);
    }
  };

  // 계약서 삭제
  const handleDeleteContract = async (contractId: number) => {
    if (!confirm('정말로 이 계약서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      setDeletingContract(true);
      const res = await fetch(`/api/partner/contracts/${contractId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '계약서 삭제에 실패했습니다.');
      }
      showSuccess('계약서가 삭제되었습니다.');
      setShowContractDetail(false);
      setSelectedContract(null);
      loadContracts();
    } catch (error: any) {
      logger.error('[PartnerTeamClient] delete error', error);
      showError(error.message || '계약서 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingContract(false);
    }
  };

  const loadAvailableCustomers = async () => {
    if (!selectedAgentId) return;
    setLoadingCustomers(true);
    try {
      // 대리점장 소유의 고객 중, 아직 판매원에게 할당되지 않았거나 다른 판매원에게 할당된 고객 조회
      const res = await fetch('/api/partner/customers?page=1&limit=1000', {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        // 대리점장 소유의 고객만 필터링 (agent가 없거나 다른 판매원에게 할당된 고객)
        const customers = (json.customers || []).filter((customer: Customer) => {
          // 현재 선택한 판매원에게 이미 할당된 고객은 제외
          return !customer.agent || customer.agent.id !== selectedAgentId;
        });
        setAvailableCustomers(customers);
      } else {
        throw new Error(json?.message || '고객 목록을 불러오지 못했습니다.');
      }
    } catch (error) {
      logger.error('[PartnerTeamClient] load customers error', error);
      showError(error instanceof Error ? error.message : '고객 목록을 불러오는 중 오류가 발생했습니다.');
      setAvailableCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleTransferCustomers = async () => {
    if (!selectedAgentId || selectedCustomerIds.size === 0) {
      showError('전송할 고객을 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedCustomerIds.size}명의 고객을 판매원에게 전송하시겠습니까?`)) {
      return;
    }

    setTransferring(true);
    try {
      const customerIds = Array.from(selectedCustomerIds);
      let successCount = 0;
      let failCount = 0;

      // 각 고객을 순차적으로 판매원에게 할당
      for (const customerId of customerIds) {
        try {
          const res = await fetch(`/api/partner/customers/${customerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              agentProfileId: selectedAgentId,
            }),
          });
          const json = await res.json();
          if (res.ok && json?.ok) {
            successCount++;
          } else {
            failCount++;
            console.error(`[PartnerTeamClient] Failed to transfer customer ${customerId}:`, json?.message);
          }
        } catch (error) {
          failCount++;
          console.error(`[PartnerTeamClient] Error transferring customer ${customerId}:`, error);
        }
      }

      if (successCount > 0) {
        showSuccess(`${successCount}명의 고객이 성공적으로 전송되었습니다.${failCount > 0 ? ` (${failCount}명 실패)` : ''}`);
        setShowDbTransferModal(false);
        setSelectedAgentId(null);
        setSelectedCustomerIds(new Set());
        setAvailableCustomers([]);
        loadData(); // 판매원 목록 새로고침
      } else {
        showError('고객 전송에 실패했습니다.');
      }
    } catch (error) {
      logger.error('[PartnerTeamClient] transfer error', error);
      showError('고객 전송 중 오류가 발생했습니다.');
    } finally {
      setTransferring(false);
    }
  };

  const isBranchManager = useMemo(() => data?.role === 'BRANCH_MANAGER', [data]);

  const summaryCards = useMemo(() => {
    if (!data) return [];
    const cards = [
      {
        title: '팀 판매원 수',
        value: `${data.summary.agentCount.toLocaleString()}명`,
        icon: <FiUsers />,
        description: '관리 중인 파트너 인원',
      },
      {
        title: '총 판매 금액',
        value: `${formatCurrency(data.summary.salesAmount)}원`,
        icon: <FiTrendingUp />,
        description: '전체 판매 집계',
      },
      {
        title: '확정 수당',
        value: `${formatCurrency(data.summary.settledCommission)}원`,
        icon: <FiCreditCard />,
        description: '정산 완료된 금액',
      },
      {
        title: '미정산 수당',
        value: `${formatCurrency(data.summary.pendingCommission)}원`,
        icon: <FiNavigation />,
        description: '정산 예정 금액',
      },
    ];
    return cards;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 mx-auto border-2 border-blue-500 border-b-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">판매원 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4">
        <div className="max-w-md rounded-3xl bg-white p-8 shadow-xl space-y-4 text-center">
          <h1 className="text-lg font-bold text-rose-600">판매원 정보를 불러오지 못했습니다.</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            <FiRefreshCw /> 다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-10 md:px-6">
        <header className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-xl shadow-slate-900/20">
          <Link
            href={`/partner/${partnerId}/dashboard`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm"
          >
            <FiArrowLeft /> 대시보드로 돌아가기
          </Link>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Partner Team</p>
              <h1 className="text-3xl font-black leading-snug md:text-4xl">
                {isBranchManager ? '판매원 팀 관리' : '나의 판매 실적'}
              </h1>
              <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                팀 판매원들의 활동 현황과 정산 수당을 한눈에 확인하세요. 판매 실적과 수당 정보가 실시간으로 반영됩니다.
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                요약 지표
              </p>
              <div className="mt-4 grid gap-3 text-sm text-white">
                <div className="flex items-center gap-3">
                  <FiUsers /> <span>판매원 {data.summary.agentCount.toLocaleString()}명</span>
                </div>
                <div className="flex items-center gap-3">
                  <FiTrendingUp /> 총 판매 {formatCurrency(data.summary.salesAmount)}원
                </div>
                <div className="flex items-center gap-3">
                  <FiCreditCard /> 확정 수당 {formatCurrency(data.summary.settledCommission)}원
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="text-slate-500 text-sm">{card.title}</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="text-2xl text-slate-600">{card.icon}</div>
                <div className="text-xl font-bold text-slate-900">{card.value}</div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{card.description}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isBranchManager ? '판매원 목록' : '판매 성과'}
              </h2>
              <p className="text-sm text-slate-500">
                {isBranchManager
                  ? '각 판매원의 판매 실적과 수당 현황을 확인하세요.'
                  : '본인의 판매 현황과 수당 요약입니다.'}
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <FiRefreshCw /> 새로고침
            </button>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    판매원
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    연락처 / 파트너몰
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    판매 현황
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    수당 요약
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    최근 판매
                  </th>
                  {isBranchManager && (
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      작업
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.agents.length === 0 ? (
                  <tr>
                    <td colSpan={isBranchManager ? 6 : 5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <FiUsers className="text-4xl text-slate-300" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-700">표시할 판매원이 없습니다</p>
                          <p className="text-xs text-slate-500">
                            {isBranchManager 
                              ? `판매원을 초대하면 여기에 표시됩니다. 판매원 초대는 기존 "${affiliateTerm} > 팀 관리" 페이지에서 진행할 수 있습니다.`
                              : '판매 실적이 없습니다. 고객을 유치하고 판매를 진행하면 실적이 표시됩니다.'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.agents.map((agent) => (
                    <tr key={agent.profileId} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-900">
                            {agent.displayName ?? agent.user.mallNickname ?? agent.user.mallUserId ?? '판매원'}
                          </span>
                          <span className="text-xs text-slate-500">
                            코드: {agent.affiliateCode}
                          </span>
                          <span className="text-xs text-slate-400">
                            가입일 {formatDate(agent.joinedAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>{agent.user.phone ?? '연락처 미등록'}</span>
                          {agent.user.password && (
                            <span className="text-xs font-mono font-semibold text-purple-700">
                              비밀번호: {agent.user.password}
                            </span>
                          )}
                          {agent.user.mallUserId ? (
                            <Link
                              href={`/products/${agent.user.mallUserId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              파트너몰: /products/{agent.user.mallUserId}
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-500">파트너몰 미발급</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>총 {agent.metrics.salesCount.toLocaleString()}건 / {formatCurrency(agent.metrics.totalSalesAmount)}원</span>
                          <span className="text-xs text-slate-500">
                            활성 리드 {agent.metrics.leadsActive.toLocaleString()}건
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>확정 {formatCurrency(agent.metrics.settledCommission)}원</span>
                          <span className="text-xs text-slate-500">
                            미정산 {formatCurrency(agent.metrics.pendingCommission)}원 · 오버라이드 {formatCurrency(agent.metrics.overrideCommission)}원
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {agent.metrics.lastSaleAt ? (
                          <div className="flex items-center justify-between gap-2">
                            <span>{formatDate(agent.metrics.lastSaleAt)}</span>
                            <FiChevronRight className="text-slate-400" />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">최근 판매 없음</span>
                        )}
                      </td>
                      {isBranchManager && (
                        <td className="px-6 py-4 text-sm text-slate-700">
                          <button
                            onClick={() => {
                              setSelectedAgentId(agent.profileId);
                              setShowDbTransferModal(true);
                              loadAvailableCustomers();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            <FiSend className="text-xs" />
                            DB 전송
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {isBranchManager ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
              판매원 초대는 기존 &quot;{affiliateTerm} &gt; 팀 관리&quot; 페이지에서 진행할 수 있으며, 초대한 판매원이 승인되면 목록에 자동으로 반영됩니다.
            </div>
          ) : null}
        </section>

        {/* 계약서 목록 섹션 (대리점장만) */}
        {isBranchManager && (
          <>
            {/* 판매원 계약서 관리 섹션 */}
            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">판매원 계약서 관리</h2>
                  <p className="text-sm text-slate-500">
                    판매원 계약서 상태를 확인하고 관리하세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadContracts}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <FiRefreshCw /> 새로고침
                </button>
              </div>

              {/* 필터 섹션 */}
              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="relative flex-1 max-w-md">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={contractSearch}
                      onChange={(e) => setContractSearch(e.target.value)}
                      placeholder="이름, 전화번호, 이메일 검색..."
                      className="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <select
                    value={contractStatusFilter}
                    onChange={(e) => setContractStatusFilter(e.target.value as typeof contractStatusFilter)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">전체</option>
                    <option value="submitted">제출됨</option>
                    <option value="completed">완료됨</option>
                    <option value="rejected">거부됨</option>
                  </select>
                </div>
              </div>

              {/* 계약서 목록 테이블 */}
              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
                {loadingContracts ? (
                  <div className="py-12 text-center">
                    <div className="h-8 w-8 mx-auto border-2 border-blue-500 border-b-transparent rounded-full animate-spin" />
                    <p className="mt-3 text-sm text-slate-500">계약서 목록을 불러오는 중입니다...</p>
                  </div>
                ) : (() => {
                  // 필터링된 계약서 목록
                  const filteredContracts = contracts.filter((contract) => {
                    // 검색 필터
                    if (contractSearch.trim()) {
                      const searchLower = contractSearch.toLowerCase();
                      const matchesSearch = 
                        contract.name.toLowerCase().includes(searchLower) ||
                        contract.phone.includes(contractSearch) ||
                        (contract.email && contract.email.toLowerCase().includes(searchLower));
                      if (!matchesSearch) return false;
                    }
                    // 상태 필터
                    if (contractStatusFilter !== 'all' && contract.status !== contractStatusFilter) {
                      return false;
                    }
                    return true;
                  });

                  if (filteredContracts.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <p className="text-sm font-semibold text-slate-700">계약서가 없습니다</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {contractSearch || contractStatusFilter !== 'all' 
                            ? '검색 조건에 맞는 계약서가 없습니다.'
                            : '판매원이 계약서를 제출하면 여기에 표시됩니다.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            신청자 정보
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            초대한 사람
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            상태
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            제출일
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            완료일
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            액션
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredContracts.map((contract) => {
                          const getStatusInfo = () => {
                            switch (contract.status) {
                              case 'completed':
                                return {
                                  label: '완료됨',
                                  color: 'text-purple-600',
                                  bgColor: 'bg-purple-50',
                                  icon: <FiCheck className="text-xs" />,
                                };
                              case 'submitted':
                                return {
                                  label: '제출됨',
                                  color: 'text-blue-600',
                                  bgColor: 'bg-blue-50',
                                  icon: <FiNavigation className="text-xs" />,
                                };
                              case 'rejected':
                                return {
                                  label: '거부됨',
                                  color: 'text-red-600',
                                  bgColor: 'bg-red-50',
                                  icon: <FiX className="text-xs" />,
                                };
                              default:
                                return {
                                  label: contract.status,
                                  color: 'text-gray-600',
                                  bgColor: 'bg-gray-50',
                                  icon: null,
                                };
                            }
                          };
                          const statusInfo = getStatusInfo();
                          return (
                            <tr key={contract.id} className="hover:bg-slate-50">
                              <td className="px-4 py-4">
                                <div className="text-sm font-semibold text-slate-900">{contract.name}</div>
                                <div className="text-xs text-slate-500">{contract.phone}</div>
                                {contract.email && (
                                  <div className="text-xs text-slate-500">{contract.email}</div>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {contract.mentor ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                        판매원
                                      </span>
                                      <span className="text-sm font-semibold text-slate-900">
                                        {contract.mentor.displayName || contract.mentor.affiliateCode || '이름 없음'}
                                      </span>
                                    </div>
                                    {contract.mentor.branchLabel && (
                                      <div className="text-xs text-slate-500">
                                        {contract.mentor.branchLabel}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">직접 신청</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.color}`}>
                                  {statusInfo.icon}
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-600">
                                {contract.submittedAt ? formatDate(contract.submittedAt) : '—'}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-600">
                                {contract.completedAt ? formatDate(contract.completedAt) : '—'}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        setLoadingContractDetail(true);
                                        const res = await fetch(`/api/partner/contracts/${contract.id}`, {
                                          credentials: 'include',
                                        });
                                        const json = await res.json();
                                        if (!res.ok || !json.ok) {
                                          throw new Error(json.message || '계약서 정보를 불러오지 못했습니다.');
                                        }
                                        setSelectedContract(json.contract);
                                        setShowContractDetail(true);
                                      } catch (error: any) {
                                        logger.error('[PartnerTeamClient] view detail error', error);
                                        showError(error.message || '계약서 정보를 불러오는 중 오류가 발생했습니다.');
                                      } finally {
                                        setLoadingContractDetail(false);
                                      }
                                    }}
                                    disabled={loadingContractDetail}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <FiEye className="text-xs" />
                                    상세
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </section>
          </>
        )}

        {/* 계약서 상세보기 모달 */}
        {isBranchManager && showContractDetail && selectedContract && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-2xl font-bold text-gray-900">계약서 상세</h2>
                <button
                  onClick={() => {
                    setShowContractDetail(false);
                    setSelectedContract(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiEyeOff className="text-xl text-gray-600" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">이름</p>
                    <p className="text-base text-gray-900">{selectedContract.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">전화번호</p>
                    <p className="text-base text-gray-900">{selectedContract.phone}</p>
                  </div>
                  {selectedContract.email && (
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-gray-500 mb-1">이메일</p>
                      <p className="text-base text-gray-900">{selectedContract.email}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-1">상태</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                      selectedContract.status === 'completed' ? 'bg-purple-50 text-purple-700' :
                      selectedContract.status === 'submitted' ? 'bg-blue-50 text-blue-700' :
                      selectedContract.status === 'rejected' ? 'bg-red-50 text-red-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {selectedContract.status === 'completed' ? '완료됨' :
                       selectedContract.status === 'submitted' ? '제출됨' :
                       selectedContract.status === 'rejected' ? '거부됨' :
                       selectedContract.status}
                    </span>
                  </div>
                  {selectedContract.submittedAt && (
                    <div>
                      <p className="text-sm font-semibold text-gray-500 mb-1">제출일</p>
                      <p className="text-base text-gray-900">{formatDate(selectedContract.submittedAt)}</p>
                    </div>
                  )}
                  {selectedContract.completedAt && (
                    <div>
                      <p className="text-sm font-semibold text-gray-500 mb-1">완료일</p>
                      <p className="text-base text-gray-900">{formatDate(selectedContract.completedAt)}</p>
                    </div>
                  )}
                </div>
                {selectedContract.mentor && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-semibold text-blue-700 mb-2">담당 멘토</p>
                    <p className="text-base text-blue-900 mb-1">{selectedContract.mentor.displayName || '정보 없음'}</p>
                    {selectedContract.mentor.branchLabel && (
                      <p className="text-sm text-blue-600">{selectedContract.mentor.branchLabel}</p>
                    )}
                    {selectedContract.mentor.contactPhone && (
                      <p className="text-sm text-blue-600">{selectedContract.mentor.contactPhone}</p>
                    )}
                  </div>
                )}
                {/* 계약서 싸인 섹션 */}
                {(selectedContract.metadata?.signatures || selectedContract.metadata?.signature) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">계약서 싸인</h3>
                    <div className="space-y-4">
                      {selectedContract.metadata?.signatures?.education?.url && (
                        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                          <h4 className="text-sm font-semibold text-blue-700 mb-2">교육 계약서 싸인</h4>
                          {selectedContract.metadata.signatures.education.originalName && (
                            <p className="text-xs text-blue-600 mb-2">
                              파일명: {selectedContract.metadata.signatures.education.originalName}
                            </p>
                          )}
                          <img
                            src={selectedContract.metadata.signatures.education.url}
                            alt="교육 계약서 서명"
                            className="max-w-full h-auto rounded-lg"
                          />
                        </div>
                      )}
                      {selectedContract.metadata?.signatures?.b2b?.url && (
                        <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
                          <h4 className="text-sm font-semibold text-purple-700 mb-2">B2B 계약서 싸인</h4>
                          {selectedContract.metadata.signatures.b2b.originalName && (
                            <p className="text-xs text-purple-600 mb-2">
                              파일명: {selectedContract.metadata.signatures.b2b.originalName}
                            </p>
                          )}
                          <img
                            src={selectedContract.metadata.signatures.b2b.url}
                            alt="B2B 계약서 서명"
                            className="max-w-full h-auto rounded-lg"
                          />
                        </div>
                      )}
                      {selectedContract.metadata?.signatures?.main?.url && (
                        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
                          <h4 className="text-sm font-semibold text-green-700 mb-2">계약서 싸인</h4>
                          {selectedContract.metadata.signatures.main.signedBy && (
                            <p className="text-xs text-green-600 mb-1">
                              서명자: {selectedContract.metadata.signatures.main.signedBy}
                            </p>
                          )}
                          {selectedContract.metadata.signatures.main.signedAt && (
                            <p className="text-xs text-green-600 mb-2">
                              서명일시: {new Date(selectedContract.metadata.signatures.main.signedAt).toLocaleString('ko-KR')}
                            </p>
                          )}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedContract.metadata.signatures.main.url}
                            alt="계약서 서명"
                            className="max-w-full h-auto max-h-48 bg-white p-2 rounded-lg border"
                          />
                        </div>
                      )}
                      {selectedContract.metadata?.signature && (
                        <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">계약서 싸인</h4>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedContract.metadata.signature}
                            alt="계약서 서명"
                            className="max-w-full h-auto rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3 pt-4 border-t">
                  {/* 액션 버튼들 */}
                  <div className="flex flex-wrap gap-2">
                    {/* 제출됨 상태: 완료 승인, 거부, 삭제 버튼 */}
                    {selectedContract.status === 'submitted' && (
                      <>
                        <button
                          onClick={() => handleCompleteContract(selectedContract.id)}
                          disabled={completingContract}
                          className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                          {completingContract ? (
                            <>
                              <div className="h-4 w-4 border-2 border-white border-b-transparent rounded-full animate-spin" />
                              처리 중...
                            </>
                          ) : (
                            <>
                              <FiCheck className="text-sm" />
                              완료 승인
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleRejectContract(selectedContract.id)}
                          disabled={rejectingContract}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {rejectingContract ? '처리 중...' : '거부'}
                        </button>
                      </>
                    )}
                    {/* 완료됨 상태: PDF 전송 버튼 */}
                    {selectedContract.status === 'completed' && (
                      <button
                        onClick={() => handleSendPdf(selectedContract.id)}
                        disabled={sendingPdf}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {sendingPdf ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white border-b-transparent rounded-full animate-spin" />
                            전송 중...
                          </>
                        ) : (
                          <>
                            <FiSend className="text-sm" />
                            PDF 전송
                          </>
                        )}
                      </button>
                    )}
                    {/* 삭제 버튼 (submitted 또는 rejected 상태에서만) */}
                    {(selectedContract.status === 'submitted' || selectedContract.status === 'rejected') && (
                      <button
                        onClick={() => handleDeleteContract(selectedContract.id)}
                        disabled={deletingContract}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingContract ? '삭제 중...' : '삭제'}
                      </button>
                    )}
                  </div>
                  {/* 닫기 버튼 */}
                  <button
                    onClick={() => {
                      setShowContractDetail(false);
                      setSelectedContract(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DB 전송 모달 */}
      {isBranchManager && showDbTransferModal && selectedAgentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">고객 DB 전송</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {data?.agents.find(a => a.profileId === selectedAgentId)?.displayName || '판매원'}에게 전송할 고객을 선택하세요.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDbTransferModal(false);
                  setSelectedAgentId(null);
                  setSelectedCustomerIds(new Set());
                  setAvailableCustomers([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 border-2 border-blue-500 border-b-transparent rounded-full animate-spin" />
                </div>
              ) : availableCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">전송 가능한 고객이 없습니다.</p>
                  <p className="text-xs text-gray-400 mt-2">
                    대리점장 소유의 고객만 전송할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">
                      총 {availableCustomers.length}명의 고객 중 {selectedCustomerIds.size}명 선택됨
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (selectedCustomerIds.size === availableCustomers.length) {
                            setSelectedCustomerIds(new Set());
                          } else {
                            setSelectedCustomerIds(new Set(availableCustomers.map(c => c.id)));
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        {selectedCustomerIds.size === availableCustomers.length ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 w-12">
                            <input
                              type="checkbox"
                              checked={selectedCustomerIds.size === availableCustomers.length && availableCustomers.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCustomerIds(new Set(availableCustomers.map(c => c.id)));
                                } else {
                                  setSelectedCustomerIds(new Set());
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">고객명</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">연락처</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">상태</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">현재 담당</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {availableCustomers.map((customer) => (
                          <tr key={customer.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedCustomerIds.has(customer.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedCustomerIds);
                                  if (e.target.checked) {
                                    newSet.add(customer.id);
                                  } else {
                                    newSet.delete(customer.id);
                                  }
                                  setSelectedCustomerIds(newSet);
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {customer.customerName || '이름 없음'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {customer.customerPhone || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                                customer.status === 'PURCHASED' ? 'bg-green-100 text-green-700' :
                                customer.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-700' :
                                customer.status === 'CONTACTED' ? 'bg-yellow-100 text-yellow-700' :
                                customer.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                                customer.status === 'QUALIFIED' ? 'bg-indigo-100 text-indigo-700' :
                                customer.status === 'CONVERTED' ? 'bg-emerald-100 text-emerald-700' :
                                customer.status === 'LOST' ? 'bg-red-100 text-red-700' :
                                customer.status === 'REFUNDED' ? 'bg-rose-100 text-rose-700' :
                                customer.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' :
                                customer.status === 'TEST_GUIDE' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {formatLeadStatus(customer.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {customer.agent?.displayName || '담당자 없음'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDbTransferModal(false);
                  setSelectedAgentId(null);
                  setSelectedCustomerIds(new Set());
                  setAvailableCustomers([]);
                }}
                disabled={transferring}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleTransferCustomers}
                disabled={transferring || selectedCustomerIds.size === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {transferring ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-b-transparent rounded-full animate-spin" />
                    전송 중...
                  </>
                ) : (
                  <>
                    <FiSend />
                    {selectedCustomerIds.size}명 전송하기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
