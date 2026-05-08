'use client';

import { useEffect, useState } from 'react';
import { FiFileText, FiDownload, FiCheckCircle, FiClock, FiSend } from 'react-icons/fi';
import dayjs from 'dayjs';
import { showError } from '@/components/ui/Toast';

interface Payslip {
  id: number;
  period: string;
  type: string;
  totalSales: number;
  totalCommission: number;
  totalWithholding: number;
  netPayment: number;
  status: string;
  approvedAt: string | null;
  sentAt: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export default function PayslipsClient({ partnerId }: { partnerId: string }) {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    loadPayslips();
  }, []);

  const loadPayslips = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/affiliate/my-payslips', {
        credentials: 'include',
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || '지급명세서를 불러올 수 없습니다.');
      }

      setPayslips(json.payslips || []);
    } catch (error: any) {
      console.error('[Payslips] Load error:', error);
      showError(error.message || '지급명세서를 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (payslipId: number) => {
    try {
      setDownloadingId(payslipId);
      const res = await fetch(`/api/admin/payslips/${payslipId}/pdf`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('PDF 다운로드에 실패했습니다.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip_${payslipId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('[Payslips] Download error:', error);
      showError(error.message || 'PDF 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            <FiSend /> 발송완료
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            <FiCheckCircle /> 승인됨
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
            <FiClock /> 승인대기
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">지급명세서</h1>
          <p className="mt-2 text-gray-600">월별 정산 내역을 확인하고 다운로드할 수 있습니다.</p>
        </div>

        {payslips.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <FiFileText className="mx-auto mb-4 text-5xl text-gray-400" />
            <p className="text-lg font-semibold text-gray-700">지급명세서가 없습니다.</p>
            <p className="mt-2 text-sm text-gray-500">
              지급명세서는 매월 자동으로 생성됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payslips.map((payslip) => (
              <div
                key={payslip.id}
                className="rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {dayjs(payslip.period).format('YYYY년 MM월')}
                      </h3>
                      {getStatusBadge(payslip.status)}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-sm text-gray-600">총 매출</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(payslip.totalSales)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">총 수당</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(payslip.totalCommission)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">원천징수 (3.3%)</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(payslip.totalWithholding)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">실수령액</p>
                        <p className="text-xl font-bold text-blue-600">
                          {formatCurrency(payslip.netPayment)}
                        </p>
                      </div>
                    </div>

                    {payslip.sentAt && (
                      <p className="mt-3 text-sm text-gray-500">
                        발송일: {dayjs(payslip.sentAt).format('YYYY년 MM월 DD일 HH:mm')}
                      </p>
                    )}
                  </div>

                  <div>
                    <button
                      onClick={() => handleDownloadPDF(payslip.id)}
                      disabled={downloadingId === payslip.id || payslip.status === 'PENDING'}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FiDownload />
                      {downloadingId === payslip.id
                        ? '다운로드 중...'
                        : payslip.status === 'PENDING'
                        ? '승인대기'
                        : 'PDF 다운로드'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



















