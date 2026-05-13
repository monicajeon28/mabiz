'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, FileText, User, Calendar } from 'lucide-react';
import { showSuccess, showError } from '@/components/ui/Toast';

interface ApprovalRequest {
    id: number;
    type: 'PURCHASE_CERTIFICATE' | 'REFUND_CERTIFICATE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requestDate: string;
    processedDate?: string;
    rejectionReason?: string;
    customerName: string;
    productName: string;
    amount?: number;
    requesterName: string;
    requesterId: number;
}

interface CertificateApprovalsProps {
    partnerRole: 'BRANCH_MANAGER' | 'SALES_AGENT';
}

export default function CertificateApprovals({ partnerRole }: CertificateApprovalsProps) {
    const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
    const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);

    // 거절 사유 모달 상태
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [selectedRejectId, setSelectedRejectId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const fetchApprovals = useCallback(async () => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('view', activeTab);
            if (statusFilter !== 'ALL') {
                queryParams.append('status', statusFilter);
            }

            const response = await fetch(`/api/partner/documents/approvals?${queryParams.toString()}`);
            if (response.ok) {
                const result = await response.json();
                if (result.ok) {
                    setApprovals(result.approvals || []);
                }
            }
        } catch (error) {
            console.error('[Approvals] Fetch error:', error);
            showError('목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, statusFilter]);

    useEffect(() => {
        fetchApprovals();
    }, [fetchApprovals]);

    const handleApprove = async (id: number) => {
        if (!confirm('이 요청을 승인하시겠습니까?')) return;

        setProcessingId(id);
        try {
            const response = await fetch(`/api/partner/documents/approvals/${id}/approve`, {
                method: 'POST',
            });
            const result = await response.json();

            if (result.ok) {
                showSuccess('승인되었습니다.');
                fetchApprovals(); // 목록 갱신
            } else {
                showError(result.error || '승인 처리에 실패했습니다.');
            }
        } catch (error) {
            console.error('[Approve] Error:', error);
            showError('오류가 발생했습니다.');
        } finally {
            setProcessingId(null);
        }
    };

    const openRejectModal = (id: number) => {
        setSelectedRejectId(id);
        setRejectReason('');
        setRejectModalOpen(true);
    };

    const handleReject = async () => {
        if (!selectedRejectId || !rejectReason.trim()) {
            showError('거절 사유를 입력해주세요.');
            return;
        }

        setProcessingId(selectedRejectId);
        try {
            const response = await fetch(`/api/partner/documents/approvals/${selectedRejectId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: rejectReason }),
            });
            const result = await response.json();

            if (result.ok) {
                showSuccess('거절되었습니다.');
                setRejectModalOpen(false);
                fetchApprovals(); // 목록 갱신
            } else {
                showError(result.error || '거절 처리에 실패했습니다.');
            }
        } catch (error) {
            console.error('[Reject] Error:', error);
            showError('오류가 발생했습니다.');
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">승인됨</span>;
            case 'REJECTED':
                return <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded">거절됨</span>;
            case 'PENDING':
                return <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">대기중</span>;
            default:
                return <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded">{status}</span>;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'PURCHASE_CERTIFICATE':
                return '구매확인증서';
            case 'REFUND_CERTIFICATE':
                return '환불인증서';
            default:
                return type;
        }
    };

    return (
        <div className="space-y-6">
            {/* 탭 및 필터 */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {partnerRole === 'BRANCH_MANAGER' ? (
                    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('my')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'my'
                                    ? 'bg-white text-gray-900 shadow'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            나의 요청
                        </button>
                        <button
                            onClick={() => setActiveTab('team')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'team'
                                    ? 'bg-white text-gray-900 shadow'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            팀원 요청
                        </button>
                    </div>
                ) : (
                    <h2 className="text-lg font-bold text-gray-900">나의 요청 목록</h2>
                )}

                <div className="flex gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="rounded-lg border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="ALL">전체 상태</option>
                        <option value="PENDING">대기중</option>
                        <option value="APPROVED">승인됨</option>
                        <option value="REJECTED">거절됨</option>
                    </select>
                    <button
                        onClick={fetchApprovals}
                        className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                        title="새로고침"
                    >
                        <Clock className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* 목록 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
                        <p>목록을 불러오는 중...</p>
                    </div>
                ) : approvals.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        요청 내역이 없습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청일</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유형</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">고객명 / 상품명</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청자</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                    {activeTab === 'team' && (
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {approvals.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(item.requestDate).toLocaleDateString('ko-KR')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <FileText className="w-4 h-4 text-gray-400 mr-2" />
                                                <span className="text-sm font-medium text-gray-900">{getTypeLabel(item.type)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{item.customerName}</div>
                                            <div className="text-sm text-gray-500">{item.productName}</div>
                                            {item.amount && (
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {item.amount.toLocaleString()}원
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <User className="w-4 h-4 text-gray-400 mr-2" />
                                                <span className="text-sm text-gray-900">{item.requesterName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                {getStatusBadge(item.status)}
                                                {item.status === 'REJECTED' && item.rejectionReason && (
                                                    <span className="text-xs text-red-600 max-w-[150px] truncate" title={item.rejectionReason}>
                                                        사유: {item.rejectionReason}
                                                    </span>
                                                )}
                                                {item.processedDate && (
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(item.processedDate).toLocaleDateString('ko-KR')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {activeTab === 'team' && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {item.status === 'PENDING' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleApprove(item.id)}
                                                            disabled={processingId === item.id}
                                                            className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-2 rounded-full transition-colors"
                                                            title="승인"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openRejectModal(item.id)}
                                                            disabled={processingId === item.id}
                                                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded-full transition-colors"
                                                            title="거절"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 거절 사유 모달 */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">거절 사유 입력</h3>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="거절 사유를 입력해주세요 (예: 정보 불일치, 금액 오류 등)"
                            className="w-full h-32 rounded-lg border-2 border-gray-300 p-3 text-sm focus:border-indigo-500 focus:outline-none resize-none mb-4"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setRejectModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!rejectReason.trim() || processingId !== null}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium disabled:bg-red-300"
                            >
                                {processingId ? '처리 중...' : '거절하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
