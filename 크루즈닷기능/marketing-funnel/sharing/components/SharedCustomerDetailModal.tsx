'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FiX,
  FiUser,
  FiPhone,
  FiMail,
  FiCalendar,
  FiFileText,
  FiMic,
  FiDownload,
  FiFile,
  FiSend,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiLink,
  FiCopy,
  FiArrowRight,
  FiArrowLeft,
  FiTag,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';

// ===== 타입 정의 =====
type ViewerType = 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';

type InteractionMedia = {
  id: number;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  url: string;
  isBackedUp: boolean;
  googleDriveFileId: string | null;
};

type Interaction = {
  id: number;
  interactionType: string;
  occurredAt: string;
  note: string | null;
  profileId: number | null;
  createdBy: {
    id: number;
    name: string | null;
    phone: string | null;
  } | null;
  createdByType?: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';
  media?: InteractionMedia[];
};

type CustomerDetail = {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail?: string | null;
  mallUserId?: string | null;
  status: string;
  notes: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  passportRequestedAt: string | null;
  passportCompletedAt: string | null;
  source: string | null;
  groupId: number | null;
  groupName?: string | null;
  manager: {
    id: number;
    displayName: string | null;
    affiliateCode: string | null;
  } | null;
  agent: {
    id: number;
    displayName: string | null;
    affiliateCode: string | null;
  } | null;
  ownership: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';
  interactions: Interaction[];
  // 전달 이력
  transferHistory?: Array<{
    date: string;
    fromProfileId: number | null;
    fromProfileName: string | null;
    toProfileId: number | null;
    toProfileName: string | null;
  }>;
  // User 연결 정보 (여권/PNR 링크용)
  userId?: number | null;
};

type CustomerGroup = {
  id: number;
  name: string;
  leadCount: number;
};

type StatusOption = {
  value: string;
  label: string;
};

type Props = {
  leadId: number;
  isOpen: boolean;
  onClose: () => void;
  viewerType: ViewerType;
  viewerProfileId?: number;
  // 콜백
  onCustomerUpdate?: () => void;
  onTransfer?: (leadId: number, targetType: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT', targetProfileId?: number) => void;
  onRecall?: (leadId: number) => void;
  // 추가 옵션
  teamAgents?: Array<{ id: number; displayName: string | null; affiliateCode: string | null }>;
  statusOptions?: StatusOption[];
};

// ===== 유틸 함수 =====
function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatChatDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === -1) return '어제';
  if (diffDays === 1) return '내일';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function groupInteractionsByDate(interactions: Interaction[]) {
  const groups: Record<string, Interaction[]> = {};

  interactions.forEach((interaction) => {
    const date = new Date(interaction.occurredAt);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().split('T')[0];

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(interaction);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((dateKey) => ({
    date: dateKey,
    interactions: groups[dateKey].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    ),
  }));
}

// 유입 경로 딱지 색상
function getSourceBadge(source: string | null) {
  if (!source) return null;

  const sourceMap: Record<string, { label: string; color: string }> = {
    'landing-page': { label: '랜딩페이지', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    'test-guide': { label: '3일체험', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    'phone-consultation': { label: '전화문의', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    'mall-signup': { label: '크루즈몰가입', color: 'bg-green-100 text-green-700 border-green-200' },
    'product-inquiry': { label: '상품문의', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    'cruise-guide': { label: '구매고객', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    'affiliate-contract-approval': { label: '계약승인', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    'affiliate-manual-creation': { label: '수동등록', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  // B2B 계열 처리
  if (source.startsWith('B2B')) {
    return { label: 'B2B', color: 'bg-pink-100 text-pink-700 border-pink-200' };
  }

  return sourceMap[source] || { label: source, color: 'bg-gray-100 text-gray-700 border-gray-200' };
}

// 기본 상태 옵션
const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'NEW', label: '신규' },
  { value: 'CONTACTED', label: '소통중' },
  { value: 'IN_PROGRESS', label: '진행중' },
  { value: 'PURCHASED', label: '구매완료' },
  { value: 'REFUNDED', label: '환불' },
  { value: 'TEST_GUIDE', label: '3일체험중' },
  { value: 'CLOSED', label: '종료' },
];

// ===== 메인 컴포넌트 =====
export default function SharedCustomerDetailModal({
  leadId,
  isOpen,
  onClose,
  viewerType,
  viewerProfileId,
  onCustomerUpdate,
  onTransfer,
  onRecall,
  teamAgents = [],
  statusOptions = DEFAULT_STATUS_OPTIONS,
}: Props) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);

  // 상담기록 폼
  const [interactionForm, setInteractionForm] = useState({
    note: '',
    status: '',
    nextActionAt: '',
    occurredAt: '',
    files: [] as File[],
  });
  const [interactionSaving, setInteractionSaving] = useState(false);

  // 고객 상세 로드
  const loadCustomerDetail = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/shared/customers/${leadId}?viewerType=${viewerType}${viewerProfileId ? `&viewerProfileId=${viewerProfileId}` : ''}`, {
        credentials: 'include',
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '고객 정보를 불러올 수 없습니다.');
      }

      setCustomer(json.customer);
    } catch (err) {
      console.error('[SharedCustomerDetail] Load error:', err);
      setError(err instanceof Error ? err.message : '고객 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [leadId, viewerType, viewerProfileId]);

  // 고객 그룹 로드 (파트너만 - HQ는 그룹 기능 미사용)
  const loadCustomerGroups = useCallback(async () => {
    // HQ(관리자)는 파트너 고객 그룹 API 접근 불가 - 스킵
    if (viewerType === 'HQ') {
      setCustomerGroups([]);
      return;
    }

    try {
      const res = await fetch('/api/partner/customer-groups', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.ok) {
        setCustomerGroups(json.groups || []);
      }
    } catch (error) {
      console.error('[SharedCustomerDetail] Load groups error:', error);
    }
  }, [viewerType]);

  useEffect(() => {
    if (isOpen && leadId) {
      loadCustomerDetail();
      loadCustomerGroups();
    }
  }, [isOpen, leadId, loadCustomerDetail, loadCustomerGroups]);

  // 고객 정보 업데이트
  const handleUpdateCustomer = async (updates: Record<string, unknown>) => {
    if (!leadId) return;
    setUpdating(true);

    try {
      const res = await fetch(`/api/shared/customers/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...updates, viewerType, viewerProfileId }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '고객 정보 수정에 실패했습니다.');
      }

      showSuccess('고객 정보가 업데이트되었습니다.');
      setCustomer(json.customer);
      onCustomerUpdate?.();
    } catch (error) {
      console.error('[SharedCustomerDetail] Update error:', error);
      showError(error instanceof Error ? error.message : '고객 정보 수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  // 상담기록 추가
  const handleAddInteraction = async () => {
    if (!leadId) return;
    if (!interactionForm.note.trim()) {
      showError('상담 내용을 입력해주세요.');
      return;
    }

    setInteractionSaving(true);

    try {
      const payload: Record<string, unknown> = {
        note: interactionForm.note,
        interactionType: 'NOTE',
        viewerType,
        viewerProfileId,
      };
      if (interactionForm.status) payload.status = interactionForm.status;
      if (interactionForm.nextActionAt) payload.nextActionAt = interactionForm.nextActionAt;
      if (interactionForm.occurredAt) payload.occurredAt = interactionForm.occurredAt;

      const res = await fetch(`/api/shared/customers/${leadId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '상담 기록 저장에 실패했습니다.');
      }

      // 파일 업로드 (있는 경우)
      const filesToUpload = [...interactionForm.files];
      const interactionId = json.interaction?.id;

      if (filesToUpload.length > 0 && interactionId) {
        showSuccess(`상담 기록 저장됨. 파일 ${filesToUpload.length}개 업로드 중...`);

        Promise.all(
          filesToUpload.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            try {
              const uploadRes = await fetch(`/api/admin/affiliate/interactions/${interactionId}/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
              });
              return uploadRes.ok;
            } catch {
              return false;
            }
          })
        ).then((results) => {
          const successCount = results.filter(Boolean).length;
          if (successCount === filesToUpload.length) {
            showSuccess(`파일 ${successCount}개 업로드 완료!`);
          } else {
            showSuccess(`파일 ${successCount}/${filesToUpload.length}개 업로드 완료`);
          }
          loadCustomerDetail();
        });
      } else {
        showSuccess('상담 기록이 추가되었습니다.');
      }

      setInteractionForm({ note: '', status: '', nextActionAt: '', occurredAt: '', files: [] });
      loadCustomerDetail();
      onCustomerUpdate?.();
    } catch (error) {
      console.error('[SharedCustomerDetail] Add interaction error:', error);
      showError(error instanceof Error ? error.message : '상담 기록 저장에 실패했습니다.');
    } finally {
      setInteractionSaving(false);
    }
  };

  // 파일 변경
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setInteractionForm((prev) => ({ ...prev, files: [...prev.files, ...files] }));
  };

  const removeFile = (index: number) => {
    setInteractionForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  // 여권/PNR 링크 복사
  const handleCopyLink = async (mode: 'passport' | 'pnr') => {
    try {
      if (!customer?.userId) {
        showError('해당 고객의 계정(User) 정보를 찾을 수 없습니다.');
        return;
      }

      const response = await fetch('/api/admin/passport-request/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: customer.userId }),
      });

      const data = await response.json();
      if (data.ok) {
        const link = mode === 'passport' ? data.passportLink : data.pnrLink;
        await navigator.clipboard.writeText(link);
        showSuccess(`${mode === 'passport' ? '여권' : 'PNR'} 등록 링크가 복사되었습니다.`);
      } else {
        showError('링크 생성 실패: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to copy link:', error);
      showError('링크 복사 중 오류가 발생했습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">고객 상세 정보</h2>
            {customer && (
              <span className="text-white/80 text-sm">
                {customer.customerName || '이름 없음'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && customer && (
            <div className="space-y-6">
              {/* ===== 기본 정보 섹션 ===== */}
              <section className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FiUser className="text-blue-500" />
                    기본 정보
                  </h3>
                  {/* 유입 경로 딱지 */}
                  {customer.source && (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${getSourceBadge(customer.source)?.color}`}>
                      <FiTag className="text-xs" />
                      {getSourceBadge(customer.source)?.label}
                    </span>
                  )}
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {/* 왼쪽 컬럼 */}
                  <div className="space-y-4">
                    {/* 이름 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">이름</label>
                      <input
                        type="text"
                        defaultValue={customer.customerName || ''}
                        onBlur={(e) => handleUpdateCustomer({ customerName: e.target.value })}
                        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        placeholder="고객명"
                      />
                    </div>

                    {/* 연락처 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">연락처</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="tel"
                          defaultValue={customer.customerPhone || ''}
                          onBlur={(e) => handleUpdateCustomer({ customerPhone: e.target.value })}
                          className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          placeholder="010-0000-0000"
                        />
                        {customer.customerPhone && (
                          <a
                            href={`tel:${customer.customerPhone.replace(/[^0-9]/g, '')}`}
                            className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
                          >
                            <FiPhone /> 전화
                          </a>
                        )}
                      </div>
                    </div>

                    {/* 크루즈몰 ID */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">크루즈몰 ID</label>
                      <div className="bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-900">
                        {customer.mallUserId || '연동 안됨'}
                      </div>
                    </div>

                    {/* 이메일 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">이메일</label>
                      <input
                        type="email"
                        defaultValue={customer.customerEmail || ''}
                        onBlur={(e) => handleUpdateCustomer({ customerEmail: e.target.value })}
                        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        placeholder="email@example.com"
                      />
                    </div>

                    {/* 메모 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">메모</label>
                      <textarea
                        defaultValue={customer.notes || ''}
                        onBlur={(e) => handleUpdateCustomer({ notes: e.target.value })}
                        rows={3}
                        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        placeholder="고객 메모를 입력하세요."
                      />
                    </div>
                  </div>

                  {/* 오른쪽 컬럼 */}
                  <div className="space-y-4">
                    {/* 상태 변경 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">상태 변경</label>
                      <select
                        value={customer.status}
                        disabled={updating}
                        onChange={(e) => handleUpdateCustomer({ status: e.target.value })}
                        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 bg-white"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 담당자 정보 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">담당자</label>
                      <div className="space-y-2">
                        {customer.manager && (
                          <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                            <span className="text-xs font-bold text-purple-700 bg-purple-200 px-2 py-0.5 rounded">대리점장</span>
                            <span className="text-sm font-medium text-purple-900">{customer.manager.displayName || customer.manager.affiliateCode}</span>
                          </div>
                        )}
                        {customer.agent && (
                          <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                            <span className="text-xs font-bold text-blue-700 bg-blue-200 px-2 py-0.5 rounded">판매원</span>
                            <span className="text-sm font-medium text-blue-900">{customer.agent.displayName || customer.agent.affiliateCode}</span>
                          </div>
                        )}
                        {!customer.manager && !customer.agent && (
                          <div className="bg-slate-50 px-3 py-2 rounded-lg text-sm text-slate-500">
                            본사 직속
                          </div>
                        )}
                      </div>

                      {/* 대리점장인 경우 판매원 할당 */}
                      {viewerType === 'BRANCH_MANAGER' && teamAgents.length > 0 && (
                        <div className="mt-2">
                          <select
                            value={customer.agent?.id || ''}
                            disabled={updating}
                            onChange={(e) => handleUpdateCustomer({ agentProfileId: e.target.value || null })}
                            className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          >
                            <option value="">대리점장이 직접 관리</option>
                            {teamAgents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.displayName || '판매원'} ({agent.affiliateCode || '코드 없음'})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* 고객 그룹 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">고객 그룹</label>
                      <select
                        value={customer.groupId || ''}
                        onChange={async (e) => {
                          const newGroupId = e.target.value === '' ? null : parseInt(e.target.value);
                          await handleUpdateCustomer({ groupId: newGroupId });
                        }}
                        className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">그룹 없음</option>
                        {customerGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name} ({group.leadCount}명)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 여권/PNR 버튼 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">여권 상태</label>
                      <div className="space-y-2">
                        {customer.passportCompletedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                            <FiCheckCircle /> 여권 완료
                          </span>
                        ) : customer.passportRequestedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-bold text-yellow-700 border border-yellow-200">
                            <FiClock /> 요청됨 (대기중)
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">미요청</span>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyLink('passport')}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border-2 border-blue-500 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            <FiFileText /> 여권 링크
                          </button>
                          <button
                            onClick={() => handleCopyLink('pnr')}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border-2 border-purple-500 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors"
                          >
                            <FiLink /> PNR 링크
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DB 전달/회수 버튼 (본사, 대리점장만) */}
                {(viewerType === 'HQ' || viewerType === 'BRANCH_MANAGER') && (onTransfer || onRecall) && (
                  <div className="mt-6 pt-6 border-t-2 border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-3">DB 관리</label>
                    <div className="flex gap-2">
                      {onTransfer && (
                        <button
                          onClick={() => onTransfer(leadId, viewerType === 'HQ' ? 'BRANCH_MANAGER' : 'SALES_AGENT')}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
                        >
                          <FiArrowRight /> DB 전달
                        </button>
                      )}
                      {onRecall && customer.agent && viewerType === 'BRANCH_MANAGER' && (
                        <button
                          onClick={() => onRecall(leadId)}
                          className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 transition-colors"
                        >
                          <FiArrowLeft /> DB 회수
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* ===== 상담 기록 섹션 ===== */}
              <section className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900">상담 기록</h3>
                  <button
                    onClick={loadCustomerDetail}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FiRefreshCw /> 새로고침
                  </button>
                </div>

                {/* 상담 기록 입력 폼 */}
                <div className="space-y-4 bg-slate-50 rounded-xl p-5 border-2 border-slate-200 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">상담 내용</label>
                    <textarea
                      value={interactionForm.note}
                      onChange={(e) => setInteractionForm((prev) => ({ ...prev, note: e.target.value }))}
                      rows={3}
                      placeholder="상담 내용을 입력하세요."
                      className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">상담 일시</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={interactionForm.occurredAt ? interactionForm.occurredAt.split('T')[0] : ''}
                          onChange={(e) => {
                            const dateValue = e.target.value;
                            const timeValue = interactionForm.occurredAt
                              ? new Date(interactionForm.occurredAt).toTimeString().slice(0, 5)
                              : new Date().toTimeString().slice(0, 5);
                            setInteractionForm((prev) => ({
                              ...prev,
                              occurredAt: dateValue ? `${dateValue}T${timeValue}` : '',
                            }));
                          }}
                          className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                        <input
                          type="time"
                          value={interactionForm.occurredAt ? new Date(interactionForm.occurredAt).toTimeString().slice(0, 5) : ''}
                          onChange={(e) => {
                            const timeValue = e.target.value;
                            const dateValue = interactionForm.occurredAt
                              ? interactionForm.occurredAt.split('T')[0]
                              : new Date().toISOString().split('T')[0];
                            setInteractionForm((prev) => ({
                              ...prev,
                              occurredAt: dateValue && timeValue ? `${dateValue}T${timeValue}` : prev.occurredAt,
                            }));
                          }}
                          className="w-28 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">다음 상담</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={interactionForm.nextActionAt ? interactionForm.nextActionAt.split('T')[0] : ''}
                          onChange={(e) => {
                            const dateValue = e.target.value;
                            const timeValue = interactionForm.nextActionAt
                              ? new Date(interactionForm.nextActionAt).toTimeString().slice(0, 5)
                              : '09:00';
                            setInteractionForm((prev) => ({
                              ...prev,
                              nextActionAt: dateValue ? `${dateValue}T${timeValue}` : '',
                            }));
                          }}
                          className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                        <input
                          type="time"
                          value={interactionForm.nextActionAt ? new Date(interactionForm.nextActionAt).toTimeString().slice(0, 5) : ''}
                          onChange={(e) => {
                            const timeValue = e.target.value;
                            const dateValue = interactionForm.nextActionAt
                              ? interactionForm.nextActionAt.split('T')[0]
                              : new Date().toISOString().split('T')[0];
                            setInteractionForm((prev) => ({
                              ...prev,
                              nextActionAt: dateValue && timeValue ? `${dateValue}T${timeValue}` : prev.nextActionAt,
                            }));
                          }}
                          className="w-28 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">상담 후 상태</label>
                    <select
                      value={interactionForm.status}
                      onChange={(e) => setInteractionForm((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">상태 유지</option>
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">기록/녹음 파일 업로드</label>
                    <input
                      type="file"
                      multiple
                      accept="audio/*,video/*,image/*"
                      onChange={handleFileChange}
                      className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                    {interactionForm.files.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {interactionForm.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs border border-slate-200">
                            <span className="flex items-center gap-2">
                              <FiMic className="text-blue-500" />
                              <span className="font-medium">{file.name}</span>
                              <span className="text-slate-500">({(file.size / 1024).toFixed(1)}KB)</span>
                            </span>
                            <button onClick={() => removeFile(index)} className="text-red-600 hover:text-red-800 font-bold">
                              <FiX />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleAddInteraction}
                    disabled={interactionSaving}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                  >
                    {interactionSaving ? '저장 중...' : '상담 기록 추가'}
                  </button>
                </div>

                {/* 상담 기록 목록 (채팅 형식) */}
                <div className="space-y-4">
                  {customer.interactions?.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                      등록된 상담 기록이 없습니다. 위의 입력 폼에서 상담 기록을 추가해주세요.
                    </div>
                  ) : (
                    groupInteractionsByDate(customer.interactions || []).map((group) => (
                      <div key={group.date} className="space-y-3">
                        <div className="flex items-center justify-center my-4">
                          <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm">
                            <FiCalendar className="text-xs text-slate-400" />
                            <span className="text-xs font-semibold text-slate-600">
                              {formatChatDate(group.date)}
                            </span>
                          </div>
                        </div>

                        {group.interactions.map((interaction) => {
                          // 작성자 유형 판단
                          const isHQ = interaction.createdByType === 'HQ';
                          const isManager = interaction.createdByType === 'BRANCH_MANAGER' || interaction.profileId === customer.manager?.id;
                          const isAgent = interaction.createdByType === 'SALES_AGENT' || interaction.profileId === customer.agent?.id;

                          const bgColor = isHQ
                            ? 'bg-emerald-50 border-emerald-200'
                            : isManager
                              ? 'bg-purple-50 border-purple-200'
                              : isAgent
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-slate-50 border-slate-200';

                          const badgeColor = isHQ
                            ? 'bg-emerald-100 text-emerald-700'
                            : isManager
                              ? 'bg-purple-100 text-purple-700'
                              : isAgent
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600';

                          const badgeLabel = isHQ ? '본사' : isManager ? '대리점장' : isAgent ? '판매원' : '기타';

                          return (
                            <div key={interaction.id} className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm ${bgColor}`}>
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                                  <FiUser className="text-slate-400" />
                                  <span>{interaction.createdBy?.name || '알 수 없음'}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeColor}`}>
                                    {badgeLabel}
                                  </span>
                                </div>
                                <span className="text-[10px]">{formatTime(interaction.occurredAt)}</span>
                              </div>

                              <div className="text-sm whitespace-pre-line leading-relaxed">
                                <div className="text-xs font-semibold mb-2 opacity-70">{interaction.interactionType}</div>
                                <p>{interaction.note || '메모 없음'}</p>

                                {/* 첨부 파일 */}
                                {interaction.media && interaction.media.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-slate-200">
                                    <div className="flex flex-wrap gap-2">
                                      {interaction.media.map((file) => (
                                        <a
                                          key={file.id}
                                          href={file.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                          title={file.fileName || '파일 열기'}
                                        >
                                          {file.mimeType?.startsWith('audio/') ? (
                                            <FiMic className="text-blue-500 flex-shrink-0" />
                                          ) : (
                                            <FiFile className="text-slate-400 flex-shrink-0" />
                                          )}
                                          <span className="truncate max-w-[120px] font-medium">
                                            {file.fileName || '파일'}
                                          </span>
                                          {file.isBackedUp && (
                                            <span className="text-emerald-500" title="Google Drive 백업됨">
                                              <FiCheckCircle className="text-[10px]" />
                                            </span>
                                          )}
                                          <FiDownload className="text-blue-500 flex-shrink-0" />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
