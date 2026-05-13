'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, XCircle, User, FileText, Calendar, DollarSign, Download, Mail } from 'lucide-react';
import { showSuccess, showError } from '@/components/ui/Toast';
import html2canvas from 'html2canvas';

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
  Customer: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
  };
  Requester?: {
    id: number;
    name: string;
    AffiliateProfile?: {
      type: string;
      displayName: string;
      branchLabel?: string;
    };
  };
  Approver?: {
    id: number;
    name: string;
  };
}

interface CertificateApprovalListProps {
  userRole: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'HQ' | null;
  onApprovalClick?: (approval: ApprovalRequest) => void;
}

export default function CertificateApprovalList({ userRole, onApprovalClick }: CertificateApprovalListProps) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [sendingEmail, setSendingEmail] = useState<number | null>(null);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      // 판매원인 경우: 승인요청 목록을 보지 않음 (null 반환하여 컴포넌트 숨김)
      if (userRole === 'SALES_AGENT') {
        setApprovals([]);
        setLoading(false);
        return;
      }

      // 대리점장/본사인 경우: 판매원이 신청한 승인 대기 목록 조회 (관리자 API 사용)
      if (userRole === 'BRANCH_MANAGER' || userRole === 'HQ') {
        const response = await fetch('/api/admin/certificate-approvals?status=pending', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setApprovals(data.approvals || []);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('[CertificateApprovalList] Load error:', errorData);
          showError(errorData.error || '승인 요청 목록을 불러오지 못했습니다.');
          setApprovals([]);
        }
      } else if (!userRole) {
        // userRole이 null인 경우: 대리점장/본사로 가정하고 승인 대기 목록 조회
        const response = await fetch('/api/admin/certificate-approvals?status=pending', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setApprovals(data.approvals || []);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('[CertificateApprovalList] Load error:', errorData);
          setApprovals([]);
        }
      } else {
        // 기타 역할: 빈 목록
        setApprovals([]);
      }
    } catch (error) {
      console.error('[CertificateApprovalList] Load error:', error);
      showError('승인 요청 목록을 불러오지 못했습니다.');
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleApprove = async (approvalId: number) => {
    if (!confirm('이 요청을 승인하시겠습니까?')) return;

    setProcessing(approvalId);
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
      console.error('[CertificateApprovalList] Approve error:', error);
      showError('승인 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessing(null);
    }
  };

  const handleDownload = async (approval: ApprovalRequest) => {
    if (approval.status !== 'approved') {
      showError('승인 완료 후 다운로드할 수 있습니다.');
      return;
    }

    setDownloading(approval.id);
    try {
      // 인증서 데이터로 PNG 생성
      // 실제 구현에서는 인증서 컴포넌트를 렌더링하여 캡처
      const canvas = document.createElement('canvas');
      canvas.width = 210 * 3.78; // A4 width in pixels (210mm)
      canvas.height = 297 * 3.78; // A4 height in pixels (297mm)
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 인증서 내용 그리기 (간단한 버전)
        ctx.fillStyle = '#000000';
        ctx.font = '24px Arial';
        ctx.fillText(
          approval.certificateType === 'purchase' ? '구매확인증서' : '환불인증서',
          canvas.width / 2 - 100,
          100
        );
        ctx.font = '16px Arial';
        ctx.fillText(`고객명: ${approval.customerName}`, 100, 200);
        ctx.fillText(`상품명: ${approval.productName}`, 100, 250);
        ctx.fillText(`결제금액: ${approval.paymentAmount.toLocaleString()}원`, 100, 300);
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const fileName = approval.certificateType === 'purchase'
            ? `구매확인증서_${approval.customerName}_${new Date().toISOString().split('T')[0]}.png`
            : `환불인증서_${approval.customerName}_${new Date().toISOString().split('T')[0]}.png`;

          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          showSuccess('인증서가 다운로드되었습니다.');
        }
      }, 'image/png');
    } catch (error) {
      console.error('[CertificateApprovalList] Download error:', error);
      showError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(null);
    }
  };

  const handleSendEmail = async (approval: ApprovalRequest) => {
    if (approval.status !== 'approved') {
      showError('승인 완료 후 이메일을 발송할 수 있습니다.');
      return;
    }

    if (!approval.customerEmail) {
      showError('고객 이메일 주소가 없습니다.');
      return;
    }

    setSendingEmail(approval.id);
    try {
      // 인증서 이미지 생성
      const canvas = document.createElement('canvas');
      canvas.width = 210 * 3.78;
      canvas.height = 297 * 3.78;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.font = '24px Arial';
        ctx.fillText(
          approval.certificateType === 'purchase' ? '구매확인증서' : '환불인증서',
          canvas.width / 2 - 100,
          100
        );
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to blob conversion failed'));
        }, 'image/png');
      });

      const formData = new FormData();
      formData.append('to', approval.customerEmail);
      formData.append('subject', `[크루즈닷] 요청하신 ${approval.certificateType === 'purchase' ? '구매확인증서' : '환불인증서'}입니다`);
      formData.append('file', blob, `${approval.certificateType === 'purchase' ? '구매확인증서' : '환불인증서'}_${approval.customerName}_${new Date().toISOString().split('T')[0]}.png`);

      const response = await fetch('/api/email/send', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        showSuccess('메일이 성공적으로 발송되었습니다! 🚀');
      } else {
        showError('전송 실패. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('[CertificateApprovalList] Send email error:', error);
      showError('전송 실패. 다시 시도해주세요.');
    } finally {
      setSendingEmail(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            {userRole === 'SALES_AGENT' ? '승인 대기' : '승인 대기'}
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            완료
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            거부됨
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

  // 판매원인 경우 컴포넌트를 렌더링하지 않음
  if (userRole === 'SALES_AGENT') {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">신청한 고객 승인요청</h2>
        <div className="text-center text-gray-500 py-8">
          승인 대기 중인 요청이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">신청한 고객 승인요청</h2>

      <div className="space-y-4">
        {approvals.map((approval) => (
          <div
            key={approval.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
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

                {/* 고객 정보 */}
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {approval.customerName}
                  </span>
                  {approval.Customer.phone && (
                    <span className="text-xs text-gray-500">({approval.Customer.phone})</span>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="pl-6 space-y-2 text-sm">
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

                {/* 요청자 정보 */}
                {approval.Requester && (
                  <div className="pl-6 text-sm text-gray-600">
                    요청자: {approval.Requester.name}
                    {approval.Requester.AffiliateProfile?.branchLabel && (
                      <span className="ml-2">({approval.Requester.AffiliateProfile.branchLabel})</span>
                    )}
                    {approval.Requester.AffiliateProfile?.type === 'SALES_AGENT' && (
                      <span className="ml-2 text-xs text-purple-600 font-medium">(판매원)</span>
                    )}
                  </div>
                )}

                {/* 승인 정보 */}
                {approval.status === 'approved' && approval.Approver && (
                  <div className="pl-6 text-sm text-green-700">
                    승인자: {approval.Approver.name} ({new Date(approval.approvedAt!).toLocaleString('ko-KR')})
                  </div>
                )}

                {/* 거부 사유 */}
                {approval.status === 'rejected' && approval.rejectedReason && (
                  <div className="pl-6 text-sm text-red-600">
                    거부 사유: {approval.rejectedReason}
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="flex flex-col gap-2">
                {approval.status === 'pending' && (
                  <button
                    onClick={() => handleApprove(approval.id)}
                    disabled={processing === approval.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 font-medium text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    <CheckCircle className="w-4 h-4" />
                    승인
                  </button>
                )}
                {approval.status === 'approved' && (
                  <>
                    <button
                      onClick={() => handleDownload(approval)}
                      disabled={downloading === approval.id}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 font-medium text-sm flex items-center gap-2 whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      {downloading === approval.id ? '다운로드 중...' : 'PNG 다운로드'}
                    </button>
                    {approval.customerEmail && (
                      <button
                        onClick={() => handleSendEmail(approval)}
                        disabled={sendingEmail === approval.id}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300 font-medium text-sm flex items-center gap-2 whitespace-nowrap"
                      >
                        <Mail className="w-4 h-4" />
                        {sendingEmail === approval.id ? '전송 중...' : '이메일 발송'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

