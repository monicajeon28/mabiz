'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, Eye, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

type ContractStatus = 'submitted' | 'PROCESSING' | 'APPROVED' | 'rejected';

interface Application {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: ContractStatus;
  createdAt: string;
  metadata: {
    type?: string;
    supervisorName?: string;
    supervisorAgency?: string;
    supervisorPhone?: string;
    snsChannels?: Record<string, string>;
    applyNote?: string;
    approvedAt?: string;
    rejectedAt?: string;
    rejectReason?: string;
    idPhotoUrl?: string;
    bankBookUrl?: string;
  } | null;
}

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; icon: React.ReactNode }> = {
  submitted: {
    label: '검토 대기',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  PROCESSING: {
    label: '처리 중',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
  },
  APPROVED: {
    label: '승인 완료',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: '반려',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

const SNS_LABELS: Record<string, string> = {
  youtube: '유튜브',
  instagram: '인스타그램',
  blog: '블로그',
  kakao: '카카오채널',
  etc: '기타',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── 신청 상세 카드 ────────────────────────────────────────────────────

function ApplicationCard({
  app,
  onApprove,
  onReject,
}: {
  app: Application;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showIdPhoto, setShowIdPhoto] = useState(false);
  const [showBankBook, setShowBankBook] = useState(false);
  const statusCfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.submitted;
  const meta = app.metadata;
  const hasSns = meta?.snsChannels && Object.keys(meta.snsChannels).length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* 헤더 */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-700 font-bold text-sm">{(app.name || '?')[0]}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{app.name}</p>
            <p className="text-sm text-gray-500">{app.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full border ${statusCfg.color}`}>
            {statusCfg.icon}
            {statusCfg.label}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-600 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 담당 대리점장 표시 */}
      {meta?.supervisorName && (
        <div className="px-5 pb-3">
          <span className="inline-flex items-center gap-1.5 text-sm bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2.5 py-1">
            담당: {meta.supervisorName} ({meta.supervisorAgency || '-'})
          </span>
        </div>
      )}

      {/* 신청 시각 */}
      <div className="px-5 pb-3">
        <p className="text-sm text-gray-600">신청: {formatDate(app.createdAt)}</p>
        {meta?.approvedAt && <p className="text-sm text-green-600">승인: {formatDate(meta.approvedAt)}</p>}
        {meta?.rejectedAt && <p className="text-sm text-red-500">반려: {formatDate(meta.rejectedAt)}{meta.rejectReason ? ` · ${meta.rejectReason}` : ''}</p>}
      </div>

      {/* 확장 상세 */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {app.email && (
              <div>
                <p className="text-sm text-gray-500 mb-0.5">이메일</p>
                <p className="text-gray-800 text-sm">{app.email}</p>
              </div>
            )}
            {app.address && (
              <div>
                <p className="text-sm text-gray-500 mb-0.5">주소</p>
                <p className="text-gray-800 text-sm">{app.address}</p>
              </div>
            )}
          </div>

          {/* SNS 채널 */}
          {hasSns && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">SNS 채널</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(meta!.snsChannels!).map(([key, url]) => (
                  <a
                    key={key}
                    href={url.startsWith('http') ? url : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm bg-white border border-gray-200 text-blue-600 hover:text-blue-800 rounded-full px-2.5 py-1 transition"
                  >
                    <Eye className="w-3 h-3" />
                    {SNS_LABELS[key] ?? key}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 지원동기 */}
          {meta?.applyNote && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">지원 동기</p>
              <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-xl p-3 leading-relaxed">{meta.applyNote}</p>
            </div>
          )}

          {/* 첨부 서류 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-600">첨부 서류</p>
            <div className="grid grid-cols-2 gap-2">
              {meta?.idPhotoUrl ? (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">신분증</p>
                  {showIdPhoto ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={meta.idPhotoUrl} alt="신분증" className="w-full rounded-xl border border-gray-200" />
                      <button
                        onClick={() => setShowIdPhoto(false)}
                        className="absolute top-1 right-1 bg-white/80 text-gray-600 rounded-full w-6 h-6 flex items-center justify-center text-sm"
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowIdPhoto(true)}
                      className="w-full text-sm bg-white border border-gray-200 rounded-xl py-2 text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> 확인
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl py-3 text-center">신분증 없음</div>
              )}
              {meta?.bankBookUrl ? (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">통장사본</p>
                  {showBankBook ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={meta.bankBookUrl} alt="통장사본" className="w-full rounded-xl border border-gray-200" />
                      <button
                        onClick={() => setShowBankBook(false)}
                        className="absolute top-1 right-1 bg-white/80 text-gray-600 rounded-full w-6 h-6 flex items-center justify-center text-sm"
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowBankBook(true)}
                      className="w-full text-sm bg-white border border-gray-200 rounded-xl py-2 text-blue-600 hover:bg-blue-50 transition flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> 확인
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl py-3 text-center">통장사본 없음</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 승인/반려 버튼 */}
      {app.status === 'submitted' && (
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={() => onReject(app.id)}
            className="flex-1 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-4 h-4" />
            반려
          </button>
          <button
            onClick={() => onApprove(app.id)}
            className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            승인
          </button>
        </div>
      )}
    </div>
  );
}

// ── 반려 모달 ─────────────────────────────────────────────────────────

function RejectModal({
  contractId,
  name,
  onConfirm,
  onClose,
}: {
  contractId: number;
  name: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">신청 반려</h3>
          <p className="text-sm text-gray-500 mt-1">{name}님의 신청을 반려합니다.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">반려 사유 (선택)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="신청자에게 전달할 반려 사유를 입력해 주세요"
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none resize-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition"
          >
            반려 확정
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 클라이언트 컴포넌트 ──────────────────────────────────────────────────────

interface PartnerApplicationsClientProps {
  initialRole: string;
}

export default function PartnerApplicationsClient({ initialRole }: PartnerApplicationsClientProps) {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('submitted');
  const [rejectTarget, setRejectTarget] = useState<{ id: number; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const refreshApplications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/affiliate/contracts?status=${statusFilter}&page=1`);
      const data = await res.json();
      if (data.ok) {
        // CRUISE_PARTNER 타입만 필터링
        const cruisePartners = (data.data.contracts as Application[]).filter(
          (c) => (c.metadata as Record<string, unknown>)?.type === 'CRUISE_PARTNER',
        );
        setApplications(cruisePartners);
      }
    } catch {
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 권한 확인 (GLOBAL_ADMIN만)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/');
          return;
        }
        const ctx = await res.json();
        if (ctx.role !== 'GLOBAL_ADMIN') {
          router.push('/');
          return;
        }
        setAuthChecked(true);
      } catch {
        router.push('/');
      }
    };
    checkAuth();
  }, [router]);

  // ✅ 수정: statusFilter와 authChecked를 의존성 배열에 포함 (exhaustive-deps 충족)
  useEffect(() => {
    if (!authChecked) return;
    refreshApplications();
  }, [statusFilter, authChecked]);

  const handleApprove = async (contractId: number) => {
    if (!confirm('이 신청을 승인하시겠습니까?')) return;
    setActionLoading(contractId);
    try {
      const res = await fetch(`/api/affiliate/contracts/${contractId}/simple-approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('승인되었습니다.', 'success');
        refreshApplications();
      } else {
        showToast(data.message || '승인 실패', 'error');
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    const { id } = rejectTarget;
    setRejectTarget(null);
    setActionLoading(id);
    try {
      const res = await fetch(`/api/affiliate/contracts/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('반려되었습니다.', 'success');
        refreshApplications();
      } else {
        showToast(data.message || '반려 실패', 'error');
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = applications.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">파트너스 신청 관리</h1>
              <p className="text-sm text-gray-500 mt-0.5">크루즈닷 파트너스 가입 신청 검토</p>
            </div>
            <button
              onClick={refreshApplications}
              className="p-2 text-gray-600 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* 상태 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { value: 'submitted', label: '검토 대기', count: null },
            { value: 'APPROVED', label: '승인 완료', count: null },
            { value: 'rejected', label: '반려', count: null },
            { value: 'all', label: '전체', count: null },
          ] as const).map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                statusFilter === item.value
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 결과 요약 */}
        {!isLoading && (
          <p className="text-sm text-gray-500">
            총 <strong className="text-gray-800">{pendingCount}건</strong>
            {statusFilter === 'submitted' && pendingCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">검토가 필요합니다</span>
            )}
          </p>
        )}

        {/* 목록 */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <CheckCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">
              {statusFilter === 'submitted' ? '검토 대기 중인 신청이 없습니다.' : '해당하는 신청이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className={actionLoading === app.id ? 'opacity-60 pointer-events-none' : ''}>
                <ApplicationCard
                  app={app}
                  onApprove={handleApprove}
                  onReject={(id) => setRejectTarget({ id, name: app.name })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 반려 모달 */}
      {rejectTarget && (
        <RejectModal
          contractId={rejectTarget.id}
          name={rejectTarget.name}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
        />
      )}

      {/* 토스트 */}
      {toastMsg && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium text-white transition-all ${
          toastMsg.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastMsg.text}
        </div>
      )}
    </div>
  );
}
