'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Loader2, ShieldOff, Users, FileCheck, Clock,
  ChevronRight, Copy, Check, ExternalLink, RefreshCw,
  UserCheck, Link2, AlertTriangle, Building2, Share2,
  ToggleLeft, ToggleRight, Trash2, XCircle, CheckCircle,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';
import ContractApproveModal from '@/components/affiliate/ContractApproveModal';

// ─── Types ───────────────────────────────────────────────────────

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
  isActive: boolean;
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
    organizationId: string;
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
  metadata?: Record<string, unknown> | null;
  contractType?: string | null;
  tierLabel?: string | null;
  rejectedAt?: string | null;
  rejectReason?: string | null;
  rejectedByName?: string | null;
  hasAccount?: boolean | null;
};

// ─── Constants ────────────────────────────────────────────────

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
  AGENT: 'bg-indigo-100 text-indigo-600',
};

const TIER_LABEL: Record<string, string> = {
  SALES_330: '직속마케터 330만',
  SALES_540: '직속인솔스탭 540만',
  BRANCH_750: '대리점',
  BASIC: '직속마케터 330만',
  STANDARD: '직속인솔스탭 540만',
  PREMIUM: '대리점',
};

const CONTRACT_STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
const CONTRACT_STATUS_LABEL: Record<string, string> = {
  submitted: '검토 대기',
  PROCESSING: '처리중',
  APPROVED: '승인완료',
  rejected: '반려',
};

// ─── CopyBtn ──────────────────────────────────────────────────

function CopyApplyLink({ path = '/affiliate/apply', colorClass = 'bg-white text-blue-700 hover:bg-blue-50', affiliateCode }: { path?: string; colorClass?: string; affiliateCode?: string | null }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullPath = affiliateCode ? `${path}?agentCode=${encodeURIComponent(affiliateCode)}` : path;
  const url = typeof window !== 'undefined' ? `${window.location.origin}${fullPath}` : fullPath;

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <button
      onClick={() => navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      })}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${colorClass}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? '복사됨!' : '링크 복사'}
    </button>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 1800);
      })}
      className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-600 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? '복사됨' : '복사'}
    </button>
  );
}

// ─── 반려 확인 모달 ───────────────────────────────────────────

function RejectModal({
  contractId,
  contractName,
  onClose,
  onRejected,
}: {
  contractId: number;
  contractName: string | null;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/affiliate/contracts/${contractId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '반려 실패'); return; }
      showSuccess('신청이 반려되었습니다.');
      onRejected();
      onClose();
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">계약 신청 반려</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
          <strong>{contractName ?? '해당 신청'}</strong>을 반려합니다.
        </div>
        <form onSubmit={handleReject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">반려 사유 (선택)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="반려 사유를 입력하세요 (예: 정보 불일치, 서류 미비 등)"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              반려 확정
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 계정 삭제 확인 모달 ─────────────────────────────────────

function DeleteMemberModal({
  name,
  orgName,
  onClose,
  onConfirm,
  loading,
}: {
  name: string;
  orgName?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900">계정 삭제 확인</h2>
        <p className="text-sm text-gray-600">
          <strong className="text-red-600">{name}</strong>
          {orgName && <span className="text-gray-500 text-sm ml-1">({orgName})</span>}
          {' '}계정을 삭제합니다.
          <br />이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            취소
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 멤버 액션 버튼 (정지/활성화 + 삭제) ────────────────────

function MemberActions({
  userId,
  orgId,
  orgName,
  isActive,
  displayName,
  onChanged,
  onDeleted,
}: {
  userId: string;
  orgId: string;
  orgName?: string;
  isActive: boolean;
  displayName: string | null;
  onChanged: () => void;
  onDeleted?: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '변경 실패'); return; }
      showSuccess(isActive ? '계정을 정지했습니다.' : '계정을 활성화했습니다.');
      onChanged();
    } catch {
      showError('요청 중 오류가 발생했습니다.');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/members/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '삭제 실패'); return; }
      showSuccess('계정을 삭제했습니다.');
      setShowDeleteModal(false);
      if (onDeleted) onDeleted();
      else onChanged();
    } catch {
      showError('요청 중 오류가 발생했습니다.');
    } finally {
      // React 18: unmounted 상태 setState 안전. 컴포넌트 유지 시에도 스피너 해제 필요
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* 탭 영역 44px 확보 (p-2.5 = 10px padding + 아이콘 = 36px+) */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={isActive ? '계정 정지' : '계정 활성화'}
          className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
        >
          {toggling
            ? <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            : isActive
              ? <ToggleRight className="w-5 h-5 text-green-500" />
              : <ToggleLeft className="w-5 h-5 text-gray-600" />
          }
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
          title="계정 삭제"
          className="p-2.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
        </button>
      </div>

      {showDeleteModal && (
        <DeleteMemberModal
          name={displayName ?? userId}
          orgName={orgName}
          onClose={() => !deleting && setShowDeleteModal(false)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </>
  );
}

// ─── Detail slide-over panel ──────────────────────────────────

function DetailPanel({
  memberId,
  onClose,
  onMemberChanged,
}: {
  memberId: string;
  onClose: () => void;
  onMemberChanged: () => void;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    // 이전 요청 취소 (빠른 패널 전환 시 레이스컨디션 방지)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    fetch(`/api/admin/affiliate-managers/${memberId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setData(res.data);
        else setError(res.error ?? '불러오기 실패');
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('네트워크 오류');
      })
      .finally(() => {
        // abort된 요청은 새 요청이 로딩 중이므로 setLoading 스킵
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [memberId]);

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const handleChanged = useCallback(() => {
    load();
    onMemberChanged();
  }, [load, onMemberChanged]);

  // 대리점장 본인 삭제 시 패널 닫힘
  const handleMainDeleted = useCallback(() => {
    onMemberChanged();
    onClose();
  }, [onMemberChanged, onClose]);

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
            <p className="text-sm text-gray-600 mt-0.5">
              {data?.organization?.name ?? '-'} · {data?.member.phone ?? '-'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button onClick={load} className="text-gray-600 hover:text-gray-600 transition-colors" title="새로고침">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-600 transition-colors">
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
              {/* 대리점장 계정 관리 */}
              <section className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {data.member.displayName ?? data.member.phone ?? '-'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[data.member.role] ?? 'bg-gray-100 text-gray-500'}`}>
                        {ROLE_LABEL[data.member.role] ?? data.member.role}
                      </span>
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${data.member.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {data.member.isActive ? '활성' : '정지됨'}
                      </span>
                    </div>
                  </div>
                  <MemberActions
                    userId={data.member.userId}
                    orgId={data.member.organizationId}
                    orgName={data.organization?.name}
                    isActive={data.member.isActive}
                    displayName={data.member.displayName}
                    onChanged={handleChanged}
                    onDeleted={handleMainDeleted}
                  />
                </div>
              </section>

              {/* A) 어필리에이트 코드 & 추적 링크 */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  A · 어필리에이트 코드 &amp; 추적 링크
                </h3>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                  {data.affiliate ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-sm text-gray-500 shrink-0">코드</span>
                        <span className="flex-1 font-mono text-sm font-semibold text-blue-700 bg-white px-2 py-1 rounded border border-blue-200 truncate">
                          {data.affiliate.affiliateCode ?? '-'}
                        </span>
                        {data.affiliate.affiliateCode && <CopyBtn text={data.affiliate.affiliateCode} />}
                      </div>
                      {data.affiliate.agentCommissionRate != null && (
                        <div className="flex items-center gap-2">
                          <span className="w-16 text-sm text-gray-500 shrink-0">수수료</span>
                          <span className="text-sm font-semibold text-green-700">{data.affiliate.agentCommissionRate}%</span>
                        </div>
                      )}
                      {data.affiliate.links.length === 0 ? (
                        <p className="text-sm text-gray-600">추적 링크가 없습니다.</p>
                      ) : (
                        data.affiliate.links.map((link) => (
                          <div key={link.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-16 text-sm text-gray-500 shrink-0">링크</span>
                              <span className="flex-1 font-mono text-sm text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded truncate">{link.url}</span>
                              <CopyBtn text={link.url} />
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-600 shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <p className="pl-[4.5rem] text-sm text-gray-600">
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

              {/* B) 산하 판매원 (계정 관리 포함) */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  B · 산하 판매원 ({data.subMembers.length}명)
                </h3>
                {data.subMembers.length === 0 ? (
                  <p className="text-sm text-gray-600 py-1">등록된 판매원이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {data.subMembers.map((s) => (
                      <div key={s.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900">{s.displayName ?? '-'}</p>
                            {s.isActive === false && (
                              <span className="text-sm px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">정지됨</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">{s.phone ?? '-'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[s.role] ?? 'bg-gray-100 text-gray-500'}`}>
                            {ROLE_LABEL[s.role] ?? s.role}
                          </span>
                          <MemberActions
                            userId={s.userId}
                            orgId={data.member.organizationId}
                            orgName={data.organization?.name}
                            isActive={s.isActive}
                            displayName={s.displayName}
                            onChanged={handleChanged}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* E) 계약 정보 */}
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  E · 계약 정보
                </h3>
                {data.contracts.length === 0 ? (
                  <p className="text-sm text-gray-600 py-1">등록된 계약 정보가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {data.contracts.map((c) => (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${CONTRACT_STATUS_BADGE[c.status] ?? 'bg-gray-100'}`}>
                            {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                          </span>
                          <span className="text-sm text-gray-600">#{c.id}</span>
                        </div>
                        {c.tierKey != null && (
                          <p className="text-sm font-semibold text-gray-900">
                            {TIER_LABEL[String(c.tierKey)] ?? String(c.tierKey)}
                            {c.amount != null && (
                              <span className="ml-1 text-sm font-normal text-gray-500">({Number(c.amount).toLocaleString()}원)</span>
                            )}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
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
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">조직</h3>
                  <div className="flex items-start gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{data.organization.name}</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {data.organization.plan} · 등록일 {new Date(data.organization.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                      {data.organization.contractRef && (
                        <p className="text-sm text-gray-600">계약번호: {data.organization.contractRef}</p>
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

// ─── Manager card ─────────────────────────────────────────────

function ManagerCard({
  manager,
  onClick,
  onChanged,
}: {
  manager: Manager;
  onClick: () => void;
  onChanged: () => void;
}) {
  return (
    <div className={`border rounded-xl p-4 transition-all ${
      manager.isActive
        ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
        : 'bg-red-50/40 border-red-200 hover:border-red-300'
    }`}>
      <div className="flex items-start justify-between gap-2">
        {/* 클릭 영역 (상세 보기) */}
        <button onClick={onClick} className="min-w-0 flex-1 text-left group">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">
              {manager.displayName || manager.phone || manager.userId}
            </span>
            <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[manager.role] ?? 'bg-gray-100 text-gray-500'}`}>
              {ROLE_LABEL[manager.role] ?? manager.role}
            </span>
            {!manager.isActive && (
              <span className="text-sm px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">정지됨</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{manager.organizationName}</p>
        </button>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1 shrink-0">
          <MemberActions
            userId={manager.userId}
            orgId={manager.organizationId}
            orgName={manager.organizationName}
            isActive={manager.isActive}
            displayName={manager.displayName}
            onChanged={onChanged}
          />
          <button onClick={onClick} className="p-2.5 text-gray-300 hover:text-gray-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {manager.phone && <span className="text-sm text-gray-500">{manager.phone}</span>}
        {manager.affiliateCode ? (
          <span className="font-mono text-sm text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{manager.affiliateCode}</span>
        ) : (
          <span className="text-sm text-gray-300 flex items-center gap-1"><Link2 className="w-3 h-3" />링크 미할당</span>
        )}
        {manager.subMemberCount > 0 && (
          <span className="text-sm text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />산하 {manager.subMemberCount}명</span>
        )}
      </div>
      {/* 판매 파트너 신청 링크 (대리점 고유 코드 포함) */}
      {manager.affiliateCode && (
        <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          <CopyApplyLink
            path="/affiliate/apply"
            affiliateCode={manager.affiliateCode}
            colorClass="bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs px-2 py-1"
          />
          <CopyApplyLink
            path="/affiliate/pre-sales"
            affiliateCode={manager.affiliateCode}
            colorClass="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs px-2 py-1"
          />
        </div>
      )}
    </div>
  );
}

// ─── Shimmer ──────────────────────────────────────────────────

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

// ─── 기존 어필리에이트 자동 연결 모달 ────────────────────────

type AutoLinkRow = { name: string; affiliateCode: string; status: 'linked' | 'skipped' | 'error'; reason?: string };

function AutoLinkModal({ onClose, onLinked }: { onClose: () => void; onLinked: () => void }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ linked_count: number; skipped_count: number; error_count: number; results: AutoLinkRow[] } | null>(null);

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/affiliate-managers/auto-link', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) { showError(data.message ?? '자동 연결 실패'); return; }
      setResults(data.data);
      if (data.data.linked_count > 0) {
        showSuccess(data.message);
        onLinked();
      } else {
        showSuccess(data.message);
      }
    } catch {
      showError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-gray-900">미연결 대리점장 자동 연결</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {!results ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 leading-relaxed">
              크루즈닷몰에 존재하는 <b>BRANCH_MANAGER</b> 어필리에이트 중<br />
              CRM에 아직 연결되지 않은 대리점장을 <b>전부 자동으로 연결</b>합니다.<br />
              기존 크루즈닷몰 비밀번호 그대로 사용 가능합니다.
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">취소</button>
              <button type="button" onClick={handleRun} disabled={running} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {running ? '연결 중...' : '자동 연결 실행'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex flex-col min-h-0">
            <div className="flex gap-3 shrink-0">
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">신규 {results.linked_count}명</span>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold">기존 {results.skipped_count}명</span>
              {results.error_count > 0 && <span className="px-2.5 py-1 bg-red-100 text-red-600 rounded-lg text-sm font-semibold">오류 {results.error_count}명</span>}
            </div>
            <div className="overflow-y-auto flex-1 space-y-1.5 min-h-0">
              {results.results.map((r, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${
                  r.status === 'linked' ? 'bg-green-50 border-green-200' :
                  r.status === 'error'  ? 'bg-red-50 border-red-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{r.affiliateCode}</span>
                    {r.reason && <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>}
                  </div>
                  <span className={`shrink-0 ml-2 text-xs font-semibold ${
                    r.status === 'linked' ? 'text-green-600' :
                    r.status === 'error'  ? 'text-red-600' :
                    'text-gray-400'
                  }`}>
                    {r.status === 'linked' ? '연결됨' : r.status === 'error' ? '오류' : '이미 연결'}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shrink-0">닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function OrganizationsPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const [pendingContracts, setPendingContracts] = useState<PendingContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractStatus, setContractStatus] = useState<string>('submitted');
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('');
  const [contractsTotal, setContractsTotal] = useState<number>(0);

  // 승인 모달: contractId
  const [approveContractId, setApproveContractId] = useState<number | null>(null);
  // 반려 모달
  const [rejectContract, setRejectContract] = useState<PendingContract | null>(null);
  // 기존 계정 연결 모달
  const [showLinkModal, setShowLinkModal] = useState(false);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const contractsFetchAbortRef = useRef<AbortController | null>(null);

  const fetchManagers = useCallback(async (q?: string) => {
    // 이전 요청 취소 (검색 빠른 클릭 레이스컨디션 방지)
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/affiliate-managers?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (data.ok) {
        setManagers(data.data.managers ?? []);
      } else if (res.status === 403) {
        setForbidden(true);
      } else {
        setError(data.error ?? '목록을 불러오지 못했습니다.');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const fetchPendingContracts = useCallback(async () => {
    contractsFetchAbortRef.current?.abort();
    const controller = new AbortController();
    contractsFetchAbortRef.current = controller;
    setContractsLoading(true);
    try {
      const params = new URLSearchParams({ status: contractStatus });
      if (contractTypeFilter) params.set('type', contractTypeFilter);
      const res = await fetch(`/api/affiliate/contracts?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (data.ok) {
        setPendingContracts(data.data.contracts ?? []);
        setContractsTotal(data.data.pagination?.total ?? 0);
      } else {
        showError('계약 목록을 불러오지 못했습니다.');
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') showError('계약 목록 네트워크 오류');
    } finally {
      setContractsLoading(false);
    }
  }, [contractStatus, contractTypeFilter]);

  // searchRef: 검색어 최신값을 ref로 추적 → handleMemberChanged deps에서 search 제거
  // (search가 deps에 있으면 타이핑마다 DetailPanel 리렌더 발생)
  // onChange에서 직접 갱신하므로 별도 useEffect 동기화 불필요
  const searchRef = useRef(search);

  const handleMemberChanged = useCallback(
    () => fetchManagers(searchRef.current),
    [fetchManagers],
  );

  useEffect(() => {
    fetchManagers();
    fetchPendingContracts();
    return () => { fetchAbortRef.current?.abort(); contractsFetchAbortRef.current?.abort(); };
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
        <div className="bg-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold mb-0.5">판매 파트너 계약 신청</p>
              <p className="text-sm text-blue-200 font-mono truncate">
                /affiliate/apply
              </p>
              <p className="text-sm text-blue-300 mt-1">잠재 판매 파트너에게 이 링크를 공유하세요.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyApplyLink path="/affiliate/apply" />
              <a href="/affiliate/apply" target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors" title="페이지 열기">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="bg-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold mb-0.5">크루즈닷 파트너스 가입 신청</p>
              <p className="text-sm text-emerald-200 font-mono truncate">
                /affiliate/pre-sales
              </p>
              <p className="text-sm text-emerald-300 mt-1">잠재 크루즈닷 파트너스에게 이 링크를 공유하세요.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyApplyLink path="/affiliate/pre-sales" colorClass="bg-white text-emerald-700 hover:bg-emerald-50" />
              <a href="/affiliate/pre-sales" target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors" title="페이지 열기">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 파트너스 신청 관리 링크 */}
      <section>
        <a href="/admin/partner-applications" className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors group">
          <div>
            <p className="text-sm font-bold text-blue-800">파트너스 신청 관리</p>
            <p className="text-sm text-blue-600 mt-0.5">크루즈닷 파트너스 가입 신청 검토 · 승인/반려</p>
          </div>
          <ExternalLink className="w-4 h-4 text-blue-500 group-hover:text-blue-700 flex-shrink-0" />
        </a>
      </section>

      {/* 파트너 신청 관리 */}
      <section>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-gray-700">파트너 신청 관리</h2>
            {!contractsLoading && contractsTotal > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                {contractsTotal}
              </span>
            )}
          </div>
          <button
            onClick={fetchPendingContracts}
            disabled={contractsLoading}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${contractsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 상태 필터 탭 */}
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {[
            { val: 'submitted', label: '검토 대기', color: 'bg-amber-500' },
            { val: 'rejected',  label: '반려',      color: 'bg-red-500' },
            { val: 'APPROVED',  label: '승인완료',  color: 'bg-green-500' },
            { val: 'all',       label: '전체',      color: 'bg-gray-500' },
          ].map(({ val, label, color }) => (
            <button
              key={val}
              onClick={() => setContractStatus(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                contractStatus === val
                  ? `${color} text-white`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 유형 필터 */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {[
            { val: '',               label: '전체 유형' },
            { val: 'SALES_AGENT',    label: '대리점·판매원' },
            { val: 'CRUISE_PARTNER', label: '파트너스' },
          ].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setContractTypeFilter(val)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                contractTypeFilter === val
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {contractsLoading ? (
          <div className="h-12 bg-gray-100 animate-pulse rounded-xl" />
        ) : pendingContracts.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-600">
            <Clock className="w-3.5 h-3.5" />
            {contractStatus === 'submitted' ? '검토 대기 중인 신청이 없습니다.' :
             contractStatus === 'rejected'  ? '반려된 신청이 없습니다.' :
             contractStatus === 'APPROVED'  ? '승인된 신청이 없습니다.' :
             '신청 내역이 없습니다.'}
          </div>
        ) : (
          <div className="space-y-2">
            {pendingContracts.map((c) => {
              const isRejected = c.status === 'rejected';
              const isApproved = c.status === 'APPROVED';
              const typeLabel = c.contractType === 'CRUISE_PARTNER' ? '파트너스' :
                                c.tierLabel ?? '대리점·판매원';
              return (
                <div
                  key={c.id}
                  className={`border rounded-xl overflow-hidden ${
                    isRejected ? 'border-red-200 bg-red-50' :
                    isApproved ? 'border-green-200 bg-green-50' :
                    'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* 정보 영역 */}
                    <button
                      type="button"
                      onClick={() => !isRejected && !isApproved && setApproveContractId(c.id)}
                      className={`flex-1 min-w-0 text-left px-4 py-3 transition-colors ${
                        !isRejected && !isApproved ? 'hover:bg-amber-100 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-gray-900">{c.name ?? '이름 없음'}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {typeLabel}
                        </span>
                        {isApproved && c.hasAccount !== null && (
                          c.hasAccount
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">아이디 있음 ✅</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">아이디 미생성 ⚠️</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {c.phone ?? '-'} · {c.email ?? '-'}
                        <span className="ml-2 text-gray-400 text-xs">{new Date(c.createdAt).toLocaleDateString('ko-KR')} 접수</span>
                      </p>
                      {/* 반려 정보 */}
                      {isRejected && (
                        <div className="mt-1.5 space-y-0.5">
                          {c.rejectedAt && (
                            <p className="text-xs text-red-600">
                              반려일시: {new Date(c.rejectedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              {c.rejectedByName && ` · 반려자: ${c.rejectedByName}`}
                            </p>
                          )}
                          {c.rejectReason && (
                            <p className="text-xs text-red-700 font-medium">반려 사유: {c.rejectReason}</p>
                          )}
                        </div>
                      )}
                    </button>

                    {/* 액션 버튼 — 검토대기만 표시 */}
                    {!isRejected && !isApproved && (
                      <div className="flex items-center gap-2 px-3 py-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => setRejectContract(c)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          반려
                        </button>
                        <button
                          type="button"
                          onClick={() => setApproveContractId(c.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          승인
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 대리점 목록 헤더 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">대리점 관리</h1>
          {!loading && <p className="text-sm text-gray-500 mt-0.5">{managers.length}명의 대리점장</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-semibold transition-colors"
            title="크루즈닷몰 기존 대리점장 전체 자동 연결"
          >
            <Link2 className="w-3.5 h-3.5" />
            미연결 자동 연결
          </button>
          <button onClick={() => { searchRef.current = ''; setSearch(''); fetchManagers(); }} className="p-2 text-gray-600 hover:text-gray-600 transition-colors" title="새로고침">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex gap-2">
        <input
          type="text" value={search}
          onChange={(e) => { searchRef.current = e.target.value; setSearch(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') fetchManagers(searchRef.current); }}
          placeholder="이름 / 전화번호 / 조직명 검색"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button onClick={() => fetchManagers(searchRef.current)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors">검색</button>
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
          <><Shimmer /><Shimmer /><Shimmer /></>
        ) : managers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-gray-600">
            <UserCheck className="w-10 h-10" />
            <p className="text-sm">등록된 대리점장이 없습니다.</p>
            <p className="text-sm text-center text-gray-300 leading-relaxed">
              계약서 작성 → 승인 절차를 완료하면<br />대리점장이 자동으로 추가됩니다.
            </p>
          </div>
        ) : (
          managers.map((mgr) => (
            <ManagerCard
              key={mgr.memberId}
              manager={mgr}
              onClick={() => setSelectedMemberId(mgr.memberId)}
              onChanged={handleMemberChanged}
            />
          ))
        )}
      </section>

      {/* 계약 승인 모달 */}
      {approveContractId !== null && (
        <ContractApproveModal
          contractId={approveContractId}
          onClose={() => {
            setApproveContractId(null);
            // 닫기 버튼 클릭 시 목록 새로고침 (승인됐을 수도 있으므로)
            fetchPendingContracts();
            fetchManagers(searchRef.current);
          }}
          onApproved={() => {
            // 모달은 닫지 않음 — 결과 화면(어필리에이트 코드/링크)을 사용자가 확인 후 닫기 버튼 클릭
            fetchPendingContracts();
            fetchManagers(searchRef.current);
          }}
        />
      )}

      {/* 계약 반려 모달 */}
      {rejectContract !== null && (
        <RejectModal
          contractId={rejectContract.id}
          contractName={rejectContract.name}
          onClose={() => setRejectContract(null)}
          onRejected={() => {
            setRejectContract(null);
            fetchPendingContracts();
            fetchManagers(searchRef.current);
          }}
        />
      )}

      {/* 기존 어필리에이트 자동 연결 모달 */}
      {showLinkModal && (
        <AutoLinkModal
          onClose={() => setShowLinkModal(false)}
          onLinked={() => fetchManagers(searchRef.current)}
        />
      )}

      {/* 상세 슬라이드오버 */}
      {selectedMemberId && (
        <DetailPanel
          memberId={selectedMemberId}
          onClose={() => setSelectedMemberId(null)}
          onMemberChanged={handleMemberChanged}
        />
      )}
    </div>
  );
}
