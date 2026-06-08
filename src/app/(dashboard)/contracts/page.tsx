'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/lib/api/use-toast';
import { Copy, Trash2, RotateCcw, Download, AlertCircle, Loader2, Send } from 'lucide-react';

interface Contract {
  id: string;
  contractorName: string;
  status: 'draft' | 'invited' | 'signed' | 'completed' | 'rejected';
  invitedAt: string | null;
  signedAt: string | null;
  completedAt: string | null;
  submittedAt: string | null;
  mentorCode: string | null;
  smsDay0Sent?: boolean;
  smsDay1Sent?: boolean;
  smsDay2Sent?: boolean;
  lastReminderAt?: string | null;
  contractType?: 'cruisedot-partners' | 'rental-partner' | 'other';
  driveUrl?: string | null;
}

interface ApiResponse {
  ok: boolean;
  contracts: Contract[];
  message?: string;
}

type TabType = 'all' | 'progress' | 'completed' | 'archived';

// L10 렌즈: 계약 진행 단계 계산
function getContractStage(status: string): number {
  switch (status) {
    case 'draft':
      return 0;
    case 'invited':
      return 1;
    case 'signed':
      return 2;
    case 'completed':
      return 3;
    default:
      return 0;
  }
}

// L10 렌즈: 남은 시간 계산
function getTimeRemaining(invitedAt: string | null): string {
  if (!invitedAt) return '-';
  const now = new Date();
  const invited = new Date(invitedAt);
  const diffMs = 7 * 24 * 60 * 60 * 1000 - (now.getTime() - invited.getTime());

  if (diffMs <= 0) return '시간 초과';
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return `${days}일 남음`;
}

// 상태별 배지 색상
const STATUS_CONFIG: Record<string, { color: string; label: string; emoji: string }> = {
  draft: { color: 'bg-yellow-100 text-yellow-800', label: '작성중', emoji: '📝' },
  invited: { color: 'bg-red-100 text-red-800', label: '대기중', emoji: '🔴' },
  signed: { color: 'bg-blue-100 text-blue-800', label: '서명됨', emoji: '✓' },
  completed: { color: 'bg-green-100 text-green-800', label: '완료', emoji: '✅' },
  rejected: { color: 'bg-gray-100 text-gray-800', label: '거절', emoji: '❌' },
};

export default function ContractsPage() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteAction, setDeleteAction] = useState<'trash' | 'restore'>('trash');

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/my/contracts');
      const data: ApiResponse = await res.json();

      if (data.ok) {
        let filtered = data.contracts || [];

        // 탭별 필터링
        if (activeTab === 'progress') {
          filtered = filtered.filter((c) => ['draft', 'invited'].includes(c.status));
        } else if (activeTab === 'completed') {
          filtered = filtered.filter((c) => ['signed', 'completed'].includes(c.status));
        } else if (activeTab === 'archived') {
          filtered = filtered.filter((c) => c.status === 'rejected');
        } else {
          filtered = filtered.filter((c) => c.status !== 'rejected');
        }

        // 최신순 정렬
        filtered.sort((a, b) => {
          const dateA = new Date(a.invitedAt || 0).getTime();
          const dateB = new Date(b.invitedAt || 0).getTime();
          return dateB - dateA;
        });

        setContracts(filtered);
        if (filtered.length > 0 && !selectedId) {
          setSelectedId(filtered[0].id);
        }
      } else {
        toast({
          title: '오류',
          description: data.message || '계약서 목록을 불러올 수 없습니다',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: '네트워크 오류',
        description: '계약서 목록 조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedId, toast]);

  useEffect(() => {
    fetchContracts();
  }, [activeTab, fetchContracts]);

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedId),
    [contracts, selectedId]
  );

  const getStatusBadge = (status: Contract['status']) => {
    const cfg = STATUS_CONFIG[status];
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${cfg.color}`}>
        {cfg.emoji} {cfg.label}
      </span>
    );
  };

  const copySignLink = (contractId: string) => {
    const url = `${window.location.origin}/contract/sign/${contractId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: '복사 완료',
      description: '서명 링크가 복사되었습니다',
      variant: 'success',
    });
  };

  const handleDelete = async (action: 'trash' | 'restore') => {
    if (!deleteTargetId) return;

    try {
      if (action === 'trash') {
        const res = await fetch(`/api/contract-instances/${deleteTargetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected' }),
        });

        if (res.ok) {
          toast({
            title: '삭제 완료',
            description: '계약서가 보관됨으로 이동되었습니다',
            variant: 'success',
          });
        }
      } else if (action === 'restore') {
        const res = await fetch(`/api/contract-instances/${deleteTargetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'draft' }),
        });

        if (res.ok) {
          toast({
            title: '복구 완료',
            description: '계약서가 복구되었습니다',
            variant: 'success',
          });
        }
      }

      setShowDeleteModal(false);
      setDeleteTargetId(null);
      fetchContracts();
    } catch (err) {
      toast({
        title: '오류',
        description: '작업에 실패했습니다',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">계약서 관리</h1>
          <p className="mt-2 text-gray-600">계약서 발송, 진행 상황 추적, 서명 관리</p>
        </div>

        {/* 탭 */}
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          {[
            { key: 'all', label: '전체' },
            { key: 'progress', label: '진행중' },
            { key: 'completed', label: '완료' },
            { key: 'archived', label: '🗑️ 보관됨' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key as TabType);
                setSelectedId(null);
              }}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === key
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 2단 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 계약서 목록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-fit">
              <div className="p-4 border-b border-gray-200">
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium text-sm"
                  title="템플릿에서 새 계약서를 발송하세요"
                >
                  <Send className="h-4 w-4" />
                  새 계약서 보내기
                </button>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">로드 중...</p>
                </div>
              ) : contracts.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">계약서가 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                  {contracts.map((contract) => (
                    <button
                      key={contract.id}
                      onClick={() => setSelectedId(contract.id)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedId === contract.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {contract.contractorName || '(이름 없음)'}
                          </p>
                        </div>
                      </div>
                      <div className="mb-2">{getStatusBadge(contract.status)}</div>

                      {contract.status === 'invited' && (
                        <div className="text-xs text-red-600 font-semibold">
                          ⏰ {getTimeRemaining(contract.invitedAt)}
                        </div>
                      )}

                      {contract.signedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          서명: {new Date(contract.signedAt).toLocaleDateString('ko-KR')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 우측: 계약서 상세 */}
          {selectedContract ? (
            <div className="lg:col-span-2 space-y-6">
              {/* 기본 정보 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">계약서 상세</h2>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">계약자명</span>
                    <span className="font-medium">{selectedContract.contractorName}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">상태</span>
                    {getStatusBadge(selectedContract.status)}
                  </div>

                  {selectedContract.invitedAt && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">발송일</span>
                      <span className="text-sm">
                        {new Date(selectedContract.invitedAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                  )}

                  {selectedContract.signedAt && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">서명일</span>
                      <span className="text-sm">
                        {new Date(selectedContract.signedAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">작업</h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedContract.status === 'invited' && (
                    <>
                      <button
                        onClick={() => copySignLink(selectedContract.id)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        링크 복사
                      </button>

                      <button
                        onClick={() => {
                          setDeleteTargetId(selectedContract.id);
                          setDeleteAction('trash');
                          setShowDeleteModal(true);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 text-sm font-medium transition-colors"
                      >
                        <AlertCircle className="h-4 w-4" />
                        요청 취소
                      </button>
                    </>
                  )}

                  {selectedContract.status === 'completed' && selectedContract.driveUrl && (
                    <button
                      onClick={() => window.open(selectedContract.driveUrl, '_blank')}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium transition-colors col-span-2"
                    >
                      <Download className="h-4 w-4" />
                      PDF 다운로드
                    </button>
                  )}

                  {selectedContract.status !== 'rejected' && selectedContract.status !== 'completed' && (
                    <button
                      onClick={() => {
                        setDeleteTargetId(selectedContract.id);
                        setDeleteAction('trash');
                        setShowDeleteModal(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      삭제
                    </button>
                  )}

                  {selectedContract.status === 'rejected' && (
                    <button
                      onClick={() => {
                        setDeleteTargetId(selectedContract.id);
                        setDeleteAction('restore');
                        setShowDeleteModal(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      복구
                    </button>
                  )}
                </div>
              </div>

              {/* 진행률 표시 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">진행 상황</h3>
                <div className="space-y-3">
                  {[
                    { stage: 0, label: '계약서 작성', icon: '📝' },
                    { stage: 1, label: '초대 발송', icon: '📤' },
                    { stage: 2, label: '서명 완료', icon: '✍️' },
                    { stage: 3, label: '계약 확정', icon: '✅' },
                  ].map(({ stage, label, icon }) => (
                    <div key={stage} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          getContractStage(selectedContract.status) >= stage
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {icon}
                      </div>
                      <span
                        className={`text-sm ${
                          getContractStage(selectedContract.status) >= stage
                            ? 'text-gray-900 font-medium'
                            : 'text-gray-500'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 flex items-center justify-center bg-white rounded-lg border border-gray-200 min-h-[400px]">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">계약서를 선택해주세요</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 삭제/복구 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-2">
              {deleteAction === 'trash' ? '계약서 삭제' : '계약서 복구'}
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              {deleteAction === 'trash'
                ? '이 계약서를 보관함으로 이동하시겠습니까?'
                : '이 계약서를 복구하시겠습니까?'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTargetId(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteAction)}
                className={`flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 font-medium ${
                  deleteAction === 'trash' ? 'bg-red-600' : 'bg-blue-600'
                }`}
              >
                {deleteAction === 'trash' ? '삭제' : '복구'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
