'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  Loader2,
  ShieldOff,
  Users,
  FileCheck,
  Clock,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  UserCheck,
  Link2,
  AlertTriangle,
  Building2,
  Share2,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import ContractApproveModal from '@/components/affiliate/ContractApproveModal';

// ─── Types ───────────────────────────────────────────────────

type Manager = {
  memberId: string;
  userId: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  role: string;
  isActive: boolean;
  organizationId: string;
  organizationName: string;
  organizationPlan: string;
  organizationStatus: string;
  subMemberCount: number;
  hasAffiliateProfile: boolean;
  affiliateCode: string | null;
  affiliateProfileId: number | null;
};

type SubMember = {
  id: string;
  userId: string;
  phone: string | null;
  displayName: string | null;
  role: string;
};

type AffiliateDetail = {
  profileId: number;
  affiliateCode: string | null;
  status: string;
  agentCommissionRate: number | null;
  links: { id: number; code: string; url: string; clickCount: number; conversionCount: number }[];
};

type OrgDetail = {
  id: string;
  name: string;
  plan: string;
  status: string;
  contractRef: string | null;
  createdAt: string;
};

type ContractDetail = {
  id: number;
  status: string;
  name: string | null;
  contractSignedAt: string | null;
  createdAt: string;
  tierKey: unknown;
  amount: unknown;
};

type DetailData = {
  member: {
    id: string;
    userId: string;
    phone: string | null;
    email: string | null;
    displayName: string | null;
    role: string;
    isActive: boolean;
  };
  organization: OrgDetail | null;
  subMembers: SubMember[];
  affiliate: AffiliateDetail | null;
  contracts: ContractDetail[];
};

type PendingContract = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
};

// ─── Constants ────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  BRANCH_MANAGER: '대리점장',
  OWNER: '지점장',
  SALES_AGENT: '판매원',
  FREE_SALES: '프리세일즈',
  PRE_SALES: '프리세일즈',
  AGENT: '에이전트',
};
const ROLE_BADGE: Record<string, string> = {
  BRANCH_MANAGER: 'bg-blue-100 text-blue-700',
  OWNER: 'bg-purple-100 text-purple-700',
  SALES_AGENT: 'bg-green-100 text-green-700',
  FREE_SALES: 'bg-gray-100 text-gray-600',
  PRE_SALES: 'bg-gray-100 text-gray-600',
};

const TIER_LABEL: Record<string, string> = {
  SALES_330: '직속마케터 330만',
  SALES_540: '직속인솔스탭 540만',
  BRANCH_750: '대리점',
  // 구 키 호환
  BASIC: '직속마케터 330만',
  STANDARD: '직속인솔스탭 540만',
  PREMIUM: '대리점',
};

const CONTRACT_STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
};
const CONTRACT_STATUS_LABEL: Record<string, string> = {
  submitted: '접수',
  PROCESSING: '처리중',
  APPROVED: '승인완료',
};

// ─── CopyButton ─────────────────────────────────────────

function CopyApplyLink({
  path = '/affiliate/apply',
  colorClass = 'bg-white text-blue-700 hover:bg-blue-50',
}: {
  path?: string;
  colorClass?: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${colorClass}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? '복사됨!' : '링크 복사'}
    </button>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
      }
      className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? '복사됨' : '복사'}
    </button>
  );
}

// ─── Detail slide-over panel ─────────────────────────────

function DetailPanel({
  memberId,
  onClose,
}: {
  memberId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/affiliate-managers/${memberId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setData(res.data);
        else setError(res.error ?? '불러오기 실패');
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false));
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">
              {data?.member.displayName ?? '대리점 상세'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {data?.organization?.name ?? '-'} · {data?.member.phone ?? '-'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors" title="새로고침">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && !data && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {data && (
            <>
              {/* A) 어필리에이트 코드 & 추적 링크 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  A · 어필리에이트 코드 &amp; 추적 링크
                </h3>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                  {data.affiliate ? (
                    <>
                      {/* 어필리에이트 코드 */}
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-xs text-gray-500 shrink-0">코드</span>
                        <span className="flex-1 font-mono text-sm font-semibold text-blue-700 bg-white px-2 py-1 rounded border border-blue-200 truncate">
                          {data.affiliate.affiliateCode ?? '-'}
                        </span>
                        {data.affiliate.affiliateCode && (
                          <CopyBtn text={data.affiliate.affiliateCode} />
                        )}
                      </div>
                      {/* 수수료 */}
                      {data.affiliate.agentCommissionRate != null && (
                        <div className="flex items-center gap-2">
                          <span className="w-16 text-xs text-gray-500 shrink-0">수수료</span>
                          <span className="text-sm font-semibold text-green-700">
                            {data.affiliate.agentCommissionRate}%
                          </span>
                        </div>
                      )}
                      {/* 추적 링크들 */}
                      {data.affiliate.links.length === 0 ? (
                        <p className="text-xs text-gray-400">추적 링크가 없습니다.</p>
                      ) : (
                        data.affiliate.links.map((link) => (
                          <div key={link.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-16 text-xs text-gray-500 shrink-0">링크</span>
                              <span className="flex-1 font-mono text-xs text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded truncate">
                                {link.url}
                              </span>
                              <CopyBtn text={link.url} />
                              <a href={link.url} target="_blank" rel="noopener noreferrer"
                                className="text-gray-400 hover:text-blue-600 shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <p className="pl-[4.5rem] text-xs text-gray-400">
                              클릭 {link.clickCount.toLocaleString()} · 전환 {link.conversionCount.toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <Link2 className="w-4 h-4 shrink-0" />
                      <span>아직 어필리에이트 코드가 할당되지 않았습니다.</span>
                    </div>
                  )}
                </div>
              </section>

              {/* B) 산하 판매원 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  B · 산하 판매원 ({data.subMembers.length}명)
                </h3>
                {data.subMembers.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1">등록된 판매원이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {data.subMembers.map((s) => (
                      <div key={s.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.displayName ?? '-'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.phone ?? '-'}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[s.role] ?? 'bg-gray-100 text-gray-500'}`}>
                          {ROLE_LABEL[s.role] ?? s.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* E) 계약 정보 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  E · 계약 정보
                </h3>
                {data.contracts.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1">등록된 계약 정보가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {data.contracts.map((c) => (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONTRACT_STATUS_BADGE[c.status] ?? 'bg-gray-100'}`}>
                            {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                          </span>
                          <span className="text-xs text-gray-400">#{c.id}</span>
                        </div>
                        {c.tierKey != null && (
                          <p className="text-sm font-semibold text-gray-900">
                            {TIER_LABEL[String(c.tierKey)] ?? String(c.tierKey)}
                            {c.amount != null && (
                              <span className="ml-1 text-xs font-normal text-gray-500">
                                ({Number(c.amount).toLocaleString()}원)
                              </span>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {c.contractSignedAt
                            ? `계약일: ${new Date(c.contractSignedAt).toLocaleDateString('ko-KR')}`
                            : `접수일: ${new Date(c.createdAt).toLocaleDateString('ko-KR')}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 조직 정보 */}
              {data.organization && (
                <section className="border-t pt-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    조직
                  </h3>
                  <div className="flex items-start gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{data.organization.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {data.organization.plan} · 등록일 {new Date(data.organization.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                      {data.organization.contractRef && (
                        <p className="text-xs text-gray-400">계약번호: {data.organization.contractRef}</p>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Manager card ────────────────────────────────────────

function ManagerCard({ manager, onClick }: { manager: Manager; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">
              {manager.displayName || manager.phone || manager.userId}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[manager.role] ?? 'bg-gray-100 text-gray-500'}`}>
              {ROLE_LABEL[manager.role] ?? manager.role}
            </span>
            {!manager.isActive && (
              <span title="비활성">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">{manager.organizationName}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
      </div>

      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {manager.phone && (
          <span className="text-xs text-gray-500">{manager.phone}</span>
        )}
        {manager.affiliateCode ? (
          <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            {manager.affiliateCode}
          </span>
        ) : (
          <span className="text-xs text-gray-300 flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            링크 미할당
          </span>
        )}
        {manager.subMemberCount > 0 && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            산하 {manager.subMemberCount}명
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Shimmer ─────────────────────────────────────────────

function Shimmer() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 bg-gray-200 rounded" />
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
      </div>
      <div className="h-3 w-24 bg-gray-100 rounded" />
      <div className="flex gap-3">
        <div className="h-3 w-20 bg-gray-100 rounded" />
        <div className="h-3 w-16 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

// ─── Register modal ──────────────────────────────────────

function RegisterModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [orgName, setOrgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) { showError('대리점명을 입력해 주세요.'); return; }
    if (!ownerName.trim()) { showError('대표자명을 입력해 주세요.'); return; }
    if (!ownerPhone.trim()) { showError('연락처를 입력해 주세요.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim(), ownerName: ownerName.trim(), ownerPhone: ownerPhone.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '등록 실패'); return; }
      showSuccess('대리점을 등록했습니다.');
      onCreated();
      onClose();
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">신규 대리점 수동 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: '대리점명', value: orgName, set: setOrgName, type: 'text', placeholder: '예: 크루즈닷몰 부산지점' },
            { label: '대표자명', value: ownerName, set: setOwnerName, type: 'text', placeholder: '예: 홍길동' },
            { label: '연락처', value: ownerPhone, set: setOwnerPhone, type: 'tel', placeholder: '예: 010-1234-5678' },
          ].map(({ label, value, set, type, placeholder }) => (
            <div key={label} className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">
                {label} <span className="text-red-500">*</span>
              </label>
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────

export default function OrganizationsPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [approveContractId, setApproveContractId] = useState<number | null>(null);

  const fetchManagers = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/affiliate-managers?${params}`);
      const data = await res.json();
      if (data.ok) {
        setManagers(data.data.managers ?? []);
      } else if (res.status === 403) {
        setForbidden(true);
      } else {
        setError(data.error ?? '목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingContracts = useCallback(async () => {
    setContractsLoading(true);
    try {
      const res = await fetch('/api/affiliate/contracts?status=submitted');
      const data = await res.json();
      if (data.ok) setPendingContracts(data.data.contracts ?? []);
    } catch {
      // 조용히 실패
    } finally {
      setContractsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagers();
    fetchPendingContracts();
  }, [fetchManagers, fetchPendingContracts]);

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
        <ShieldOff className="w-12 h-12 text-red-400" />
        <h1 className="text-xl font-bold text-gray-800">접근 권한 없음</h1>
        <p className="text-sm text-gray-500">이 페이지는 GLOBAL_ADMIN 전용입니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">

      {/* 계약서 가입 신청 링크 */}
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Share2 className="w-4 h-4 text-gray-500 shrink-0" />
          <h2 className="text-sm font-semibold text-gray-700">계약서 가입 신청 링크</h2>
        </div>

        {/* 판매 파트너 계약 신청 */}
        <div className="bg-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold mb-0.5">판매 파트너 계약 신청</p>
              <p className="text-xs text-blue-200 font-mono truncate">
                {typeof window !== 'undefined' ? window.location.origin : ''}/affiliate/apply
              </p>
              <p className="text-xs text-blue-300 mt-1">
                잠재 판매 파트너에게 이 링크를 공유하세요. 신청 완료 시 아래 승인 대기 목록에 자동 표시됩니다.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyApplyLink path="/affiliate/apply" />
              <a
                href="/affiliate/apply"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors"
                title="페이지 열기"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* 프리세일즈 가입신청 */}
        <div className="bg-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold mb-0.5">프리세일즈 가입 신청</p>
              <p className="text-xs text-emerald-200 font-mono truncate">
                {typeof window !== 'undefined' ? window.location.origin : ''}/affiliate/pre-sales
              </p>
              <p className="text-xs text-emerald-300 mt-1">
                잠재 프리세일즈 파트너에게 이 링크를 공유하세요.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyApplyLink path="/affiliate/pre-sales" colorClass="bg-white text-emerald-700 hover:bg-emerald-50" />
              <a
                href="/affiliate/pre-sales"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors"
                title="페이지 열기"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 계약 승인 대기 */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <FileCheck className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-gray-700">계약 승인 대기</h2>
          {!contractsLoading && pendingContracts.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
              {pendingContracts.length}
            </span>
          )}
        </div>
        {contractsLoading ? (
          <div className="h-12 bg-gray-100 animate-pulse rounded-xl" />
        ) : pendingContracts.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            대기 중인 계약 신청이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {pendingContracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{c.name ?? '이름 없음'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.phone ?? '-'} · {c.email ?? '-'}
                    <span className="ml-2 text-gray-400">{new Date(c.createdAt).toLocaleDateString('ko-KR')} 접수</span>
                  </p>
                </div>
                <button
                  onClick={() => setApproveContractId(c.id)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  승인하기
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">대리점 관리</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">{managers.length}명의 대리점장</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSearch(''); fetchManagers(); }}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            대리점 등록
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') fetchManagers(search); }}
          placeholder="이름 / 전화번호 / 조직명 검색"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={() => fetchManagers(search)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
        >
          검색
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 대리점장 목록 */}
      <section className="space-y-2.5">
        {loading ? (
          <>
            <Shimmer />
            <Shimmer />
            <Shimmer />
          </>
        ) : managers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-gray-400">
            <UserCheck className="w-10 h-10" />
            <p className="text-sm">등록된 대리점장이 없습니다.</p>
            <p className="text-xs text-center text-gray-300 leading-relaxed">
              계약 승인 또는 수동 등록으로<br />대리점장을 추가하세요.
            </p>
          </div>
        ) : (
          managers.map((mgr) => (
            <ManagerCard
              key={mgr.memberId}
              manager={mgr}
              onClick={() => setSelectedMemberId(mgr.memberId)}
            />
          ))
        )}
      </section>

      {/* 계약 승인 모달 */}
      {approveContractId !== null && (
        <ContractApproveModal
          contractId={approveContractId}
          onClose={() => setApproveContractId(null)}
          onApproved={() => {
            setApproveContractId(null);
            fetchPendingContracts();
            fetchManagers(search);
          }}
        />
      )}

      {/* 등록 모달 */}
      {showModal && (
        <RegisterModal
          onClose={() => setShowModal(false)}
          onCreated={() => fetchManagers(search)}
        />
      )}

      {/* 상세 슬라이드오버 */}
      {selectedMemberId && (
        <DetailPanel
          memberId={selectedMemberId}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </div>
  );
}
