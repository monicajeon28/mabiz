'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, FileText, Calendar, DollarSign } from 'lucide-react';
import { showSuccess, showError } from '@/components/ui/Toast';

interface ApprovalRequest {
  id: number;
  certificateType: 'purchase' | 'refund';
  status: 'pending' | 'approved' | 'rejected';
  customerName: string;
  customerEmail?: string;
  productName: string;
  paymentAmount: number;
  paymentDate: string;
  refundAmount?: number;
  refundDate?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedReason?: string;
  Requester: {
    id: number;
    name: string;
    phone: string;
    AffiliateProfile?: {
      type: string;
      displayName: string;
      branchLabel?: string;
    };
  };
  Customer: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
  };
  Approver?: {
    id: number;
    name: string;
  };
}

export default function CertificateApprovals() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'refund'>('all');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadApprovals();
  }, [statusFilter, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/admin/certificate-approvals?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setApprovals(data.approvals || []);
      } else {
        showError('승인 요청 목록을 불러오지 못했습니다.');
      }
    } catch (error) {
      console.error('[CertificateApprovals] Load error:', error);
      showError('승인 요청 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId: number) => {
    if (!confirm('이 요청을 승인하시겠습니까?')) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/admin/certificate-approvals/${approvalId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        showSuccess('승인되었습니다.');
        loadApprovals();
      } else {
        showError(data.error || '승인 처리 실패');
      }
    } catch (error) {
      console.error('[CertificateApprovals] Approve error:', error);
      showError('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    if (!rejectReason.trim()) {
      showError('거부 사유를 입력해주세요.');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/admin/certificate-approvals/${selectedApproval.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: rejectReason }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        showSuccess('거부되었습니다.');
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedApproval(null);
        loadApprovals();
      } else {
        showError(data.error || '거부 처리 실패');
      }
    } catch (error) {
      console.error('[CertificateApprovals] Reject error:', error);
      showError('거부 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            승인 대기
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            구매확인증서완료
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            승인 거부
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'purchase' ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
        구매확인
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
        환불인증
      </span>
    );
  };

  const getRoleBadge = (type?: string) => {
    switch (type) {
      case 'BRANCH_MANAGER':
        return <span className="text-xs text-blue-600 font-medium">대리점장</span>;
      case 'SALES_AGENT':
        return <span className="text-xs text-purple-600 font-medium">판매원</span>;
      default:
        return <span className="text-xs text-gray-600 font-medium">파트너</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">신청한 고객 승인요청</h2>

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                전체
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                대기중
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                승인됨
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                거부됨
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                전체
              </button>
              <button
                onClick={() => setTypeFilter('purchase')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'purchase'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                구매확인
              </button>
              <button
                onClick={() => setTypeFilter('refund')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'refund'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                환불인증
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 승인 요청 목록 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            로딩 중...
          </div>
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            승인 요청이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {approvals.map((approval) => (
              <div key={approval.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* 헤더 */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {getTypeBadge(approval.certificateType)}
                      {getStatusBadge(approval.status)}
                      <span className="text-xs text-gray-500">
                        {new Date(approval.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>

                    {/* 요청자 정보 */}
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {approval.Requester.name}
                      </span>
                      {getRoleBadge(approval.Requester.AffiliateProfile?.type)}
                      {approval.Requester.AffiliateProfile?.branchLabel && (
                        <span className="text-xs text-gray-500">
                          ({approval.Requester.AffiliateProfile.branchLabel})
                        </span>
                      )}
                    </div>

                    {/* 고객 정보 */}
                    <div className="pl-6 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">고객:</span>
                        <span className="text-gray-900">{approval.customerName}</span>
                        {approval.Customer.phone && (
                          <span className="text-gray-500">({approval.Customer.phone})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{approval.productName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">
                          결제: {approval.paymentAmount.toLocaleString()}원
                        </span>
                        <Calendar className="w-4 h-4 text-gray-400 ml-2" />
                        <span className="text-gray-600">{approval.paymentDate}</span>
                      </div>
                      {approval.certificateType === 'refund' && approval.refundAmount && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-red-400" />
                          <span className="text-red-600 font-medium">
                            환불: {approval.refundAmount.toLocaleString()}원
                          </span>
                          {approval.refundDate && (
                            <>
                              <Calendar className="w-4 h-4 text-red-400 ml-2" />
                              <span className="text-red-600">{approval.refundDate}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 승인/거부 정보 */}
                    {approval.status === 'approved' && approval.Approver && (
                      <div className="pl-6 text-sm text-green-700">
                        승인자: {approval.Approver.name} ({new Date(approval.approvedAt!).toLocaleString('ko-KR')})
                      </div>
                    )}
                    {approval.status === 'rejected' && (
                      <div className="pl-6 space-y-1">
                        {approval.Approver && (
                          <div className="text-sm text-red-700">
                            거부자: {approval.Approver.name}
                          </div>
                        )}
                        {approval.rejectedReason && (
                          <div className="text-sm text-red-600">
                            사유: {approval.rejectedReason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  {approval.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        disabled={processing}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 font-medium text-sm flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        승인
                      </button>
                      <button
                        onClick={() => {
                          setSelectedApproval(approval);
                          setShowRejectModal(true);
                        }}
                        disabled={processing}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 font-medium text-sm flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        거부
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 거부 사유 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">승인 거부</h3>
            <p className="text-sm text-gray-600 mb-4">
              거부 사유를 입력해주세요. 요청자에게 전달됩니다.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 환불 정책에 부합하지 않습니다."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedApproval(null);
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 font-medium"
              >
                {processing ? '처리 중...' : '거부'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

























