// app/partner/[partnerId]/statements/PartnerStatementsClient.tsx
// 파트너 지급명세서 확인 클라이언트 컴포넌트

'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiRefreshCw,
  FiCheckCircle,
  FiClock,
  FiImage,
  FiEye,
  FiX,
  FiAlertCircle,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import html2canvas from 'html2canvas';

type Settlement = {
  id: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  paymentDate: string | null;
};

type Statement = {
  profileId: number;
  affiliateCode: string | null;
  displayName: string | null;
  type: string;
  periodStart: string;
  periodEnd: string;
  // 판매 정보
  salesCount: number;
  totalSaleAmount: number;
  // 수당 정보
  salesCommission: number;
  branchCommission: number;
  overrideCommission: number;
  grossAmount: number;
  withholdingAmount: number;
  withholdingRate: number;
  netAmount: number;
  entryCount: number;
  // 은행 정보
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  // 확인 상태
  confirmed: boolean;
  confirmedAt: string | null;
  details?: Array<{
    entryId: number;
    saleId: number | null;
    productCode: string | null;
    saleAmount: number | null;
    saleDate: string | null;
    entryType: string;
    amount: number;
    withholdingAmount: number;
    netAmount: number;
  }>;
};

type PartnerStatementsClientProps = {
  currentUser: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    mallUserId: string;
    mallNickname: string | null;
  };
  profile: {
    id: number;
    type: string;
    affiliateCode: string | null;
    displayName: string | null;
  };
};

export default function PartnerStatementsClient({ currentUser, profile }: PartnerStatementsClientProps) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const statementRef = useRef<HTMLDivElement>(null);

  const partnerBase = `/partner/${currentUser.mallUserId}`;
  const dashboardUrl = `/partner/${currentUser.mallUserId}/dashboard`;

  useEffect(() => {
    loadSettlements();
  }, []);

  const loadSettlements = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/affiliate/settlements-list?limit=100');
      const json = await res.json();
      if (res.ok && json.ok) {
        setSettlements(json.settlements || []);
      }
    } catch (error: any) {
      console.error('[PartnerStatements] load error', error);
      showError(error.message || '정산 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatement = async (settlementId: number) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/affiliate/settlements/${settlementId}/statement?profileId=${profile.id}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '지급명세서를 불러오지 못했습니다.');
      }

      if (json.statements && json.statements.length > 0) {
        setStatement(json.statements[0]);
        setSelectedSettlement(json.settlement);
        setIsDetailModalOpen(true);
      } else {
        // 빈 명세서도 보여주기
        setStatement({
          profileId: profile.id,
          affiliateCode: profile.affiliateCode || null,
          displayName: profile.displayName || null,
          type: profile.type,
          periodStart: json.settlement?.periodStart || '',
          periodEnd: json.settlement?.periodEnd || '',
          salesCount: 0,
          totalSaleAmount: 0,
          salesCommission: 0,
          branchCommission: 0,
          overrideCommission: 0,
          grossAmount: 0,
          withholdingAmount: 0,
          withholdingRate: 3.3,
          netAmount: 0,
          entryCount: 0,
          bankName: null,
          bankAccount: null,
          bankAccountHolder: null,
          confirmed: false,
          confirmedAt: null,
          details: [],
        });
        setSelectedSettlement(json.settlement);
        setIsDetailModalOpen(true);
      }
    } catch (error: any) {
      console.error('[PartnerStatements] load statement error', error);
      showError(error.message || '지급명세서를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSettlement || !statement || !statementRef.current) return;

    if (!confirm('지급명세서를 확인하시겠습니까? 3.3% 원천징수 금액을 확인해주세요.')) {
      return;
    }

    try {
      setConfirming(true);

      // 1. 지급명세서 확인 API 호출
      const res = await fetch(`/api/admin/affiliate/settlements/${selectedSettlement.id}/statement`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '지급명세서 확인에 실패했습니다.');
      }

      // 2. PNG 생성 및 Google Drive 백업
      const A4_WIDTH = 794;
      const canvas = await html2canvas(statementRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: A4_WIDTH,
        windowWidth: A4_WIDTH,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Blob 변환 실패'));
        }, 'image/png');
      });

      const periodLabel = `${new Date(statement.periodStart).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit' })}`;
      const fileName = `지급명세서_${statement.displayName || statement.affiliateCode}_${periodLabel}.png`;

      // Google Drive에 백업 + 스프레드시트 기록
      const formData = new FormData();
      formData.append('file', blob, fileName);
      formData.append('settlementId', selectedSettlement.id.toString());
      formData.append('profileId', statement.profileId.toString());
      formData.append('displayName', statement.displayName || '');
      formData.append('periodStart', statement.periodStart);
      formData.append('periodEnd', statement.periodEnd);
      formData.append('affiliateCode', statement.affiliateCode || '');
      formData.append('type', statement.type);
      formData.append('salesCount', statement.salesCount.toString());
      formData.append('totalSaleAmount', statement.totalSaleAmount.toString());
      formData.append('salesCommission', statement.salesCommission.toString());
      formData.append('branchCommission', statement.branchCommission.toString());
      formData.append('overrideCommission', statement.overrideCommission.toString());
      formData.append('grossAmount', statement.grossAmount.toString());
      formData.append('withholdingRate', statement.withholdingRate.toString());
      formData.append('withholdingAmount', statement.withholdingAmount.toString());
      formData.append('netAmount', statement.netAmount.toString());
      formData.append('bankName', statement.bankName || '');
      formData.append('bankAccount', statement.bankAccount || '');
      formData.append('bankAccountHolder', statement.bankAccountHolder || '');

      const backupRes = await fetch('/api/partner/statements/backup', {
        method: 'POST',
        body: formData,
      });

      const backupJson = await backupRes.json();
      if (backupRes.ok && backupJson.ok) {
        showSuccess('지급명세서가 확인되었습니다.');
      } else {
        console.warn('[PartnerStatements] Google Drive backup failed:', backupJson.message);
        showSuccess('지급명세서가 확인되었습니다.');
      }

      if (statement) {
        setStatement({ ...statement, confirmed: true, confirmedAt: new Date().toISOString() });
      }
    } catch (error: any) {
      console.error('[PartnerStatements] confirm error', error);
      showError(error.message || '지급명세서 확인 중 오류가 발생했습니다.');
    } finally {
      setConfirming(false);
    }
  };

  const handleExportPNG = async () => {
    if (!statementRef.current || !statement || !selectedSettlement) return;

    try {
      setExporting(true);

      // A4 사이즈 (210mm x 297mm) - 96 DPI 기준 약 794 x 1123 픽셀
      const A4_WIDTH = 794;

      const canvas = await html2canvas(statementRef.current, {
        scale: 2, // 고해상도
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: A4_WIDTH,
        windowWidth: A4_WIDTH,
      });

      // Canvas를 Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Blob 변환 실패'));
        }, 'image/png');
      });

      // PNG 다운로드
      const periodLabel = `${new Date(statement.periodStart).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit' })}`;
      const fileName = `지급명세서_${statement.displayName || statement.affiliateCode}_${periodLabel}.png`;

      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Google Drive에 백업 + 스프레드시트 기록
      try {
        const formData = new FormData();
        formData.append('file', blob, fileName);
        formData.append('settlementId', selectedSettlement.id.toString());
        formData.append('profileId', statement.profileId.toString());
        formData.append('displayName', statement.displayName || '');
        formData.append('periodStart', statement.periodStart);
        formData.append('periodEnd', statement.periodEnd);
        // 추가 정보 (스프레드시트 기록용)
        formData.append('affiliateCode', statement.affiliateCode || '');
        formData.append('type', statement.type);
        formData.append('salesCount', statement.salesCount.toString());
        formData.append('totalSaleAmount', statement.totalSaleAmount.toString());
        formData.append('salesCommission', statement.salesCommission.toString());
        formData.append('branchCommission', statement.branchCommission.toString());
        formData.append('overrideCommission', statement.overrideCommission.toString());
        formData.append('grossAmount', statement.grossAmount.toString());
        formData.append('withholdingRate', statement.withholdingRate.toString());
        formData.append('withholdingAmount', statement.withholdingAmount.toString());
        formData.append('netAmount', statement.netAmount.toString());
        formData.append('bankName', statement.bankName || '');
        formData.append('bankAccount', statement.bankAccount || '');
        formData.append('bankAccountHolder', statement.bankAccountHolder || '');

        const backupRes = await fetch('/api/partner/statements/backup', {
          method: 'POST',
          body: formData,
        });

        const backupJson = await backupRes.json();
        if (backupRes.ok && backupJson.ok) {
          showSuccess('지급명세서가 다운로드되고 백업되었습니다.');
        } else {
          console.warn('[PartnerStatements] Google Drive backup failed:', backupJson.message);
          showSuccess('지급명세서 이미지가 다운로드되었습니다. (백업 실패)');
        }
      } catch (backupError) {
        console.warn('[PartnerStatements] Google Drive backup error:', backupError);
        showSuccess('지급명세서 이미지가 다운로드되었습니다.');
      }
    } catch (error: any) {
      console.error('[PartnerStatements] PNG export error', error);
      showError(error.message || 'PNG 내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-600';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700';
      case 'PAID':
        return 'bg-blue-50 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return '초안';
      case 'APPROVED':
        return '승인됨';
      case 'PAID':
        return '지급완료';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-10 md:px-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Link
            href={dashboardUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <FiArrowLeft className="text-base" />
            돌아가기
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">지급명세서</h1>
        </div>

        {/* 필터 및 액션 */}
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">월별 정산 내역</h2>
              <p className="text-sm text-gray-600 mt-1">
                지급명세서를 확인하고 3.3% 원천징수 금액을 검증하세요.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadSettlements}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <FiRefreshCw className="text-base" />
                새로고침
              </button>
            </div>
          </div>
        </section>

        {/* 정산 목록 */}
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">정산 기간</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-600">지급일</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                      정산 목록을 불러오는 중입니다...
                    </td>
                  </tr>
                )}
                {!isLoading && settlements.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                      정산 내역이 없습니다.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-blue-50/40">
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {new Date(settlement.periodStart).toLocaleDateString('ko-KR')} ~{' '}
                          {new Date(settlement.periodEnd).toLocaleDateString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(settlement.status)}`}
                        >
                          {getStatusLabel(settlement.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {settlement.paymentDate
                          ? new Date(settlement.paymentDate).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => loadStatement(settlement.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            <FiEye />
                            명세서 보기
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 지급명세서 상세 모달 */}
        {isDetailModalOpen && selectedSettlement && statement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white z-10">
                <h2 className="text-xl font-extrabold text-gray-900">지급명세서</h2>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedSettlement(null);
                    setStatement(null);
                  }}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              <div ref={statementRef} className="px-8 py-8 space-y-6 bg-white" style={{ width: '794px', maxWidth: '100%' }}>
                {/* 크루즈닷 로고 (상단 중앙) */}
                <div className="flex flex-col items-center justify-center mb-8">
                  <img
                    src="/images/ai-cruise-logo.png"
                    alt="크루즈닷 로고"
                    className="h-20 object-contain mb-3"
                  />
                  <h1 className="text-2xl font-bold text-gray-900">지급명세서</h1>
                  <p className="text-sm text-gray-500 mt-1">PAYMENT STATEMENT</p>
                </div>

                {/* 기본 정보 */}
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-blue-600 mb-1">정산 기간</label>
                      <div className="text-base font-bold text-gray-900">
                        {new Date(statement.periodStart).toLocaleDateString('ko-KR')} ~ {new Date(statement.periodEnd).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-blue-600 mb-1">수령인</label>
                      <div className="text-base font-bold text-gray-900">
                        {statement.displayName || statement.affiliateCode || '-'}
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({statement.type === 'BRANCH_MANAGER' ? '대리점장' : '판매원'})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 판매 실적 요약 */}
                <div className="rounded-xl border border-gray-200 p-5 bg-gray-50">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
                    판매 실적
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">총 판매 건수</label>
                      <div className="text-2xl font-bold text-blue-700">
                        {statement.salesCount.toLocaleString()}건
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">총 판매 금액</label>
                      <div className="text-2xl font-bold text-blue-700">
                        {statement.totalSaleAmount.toLocaleString()}원
                      </div>
                    </div>
                  </div>
                </div>

                {/* 수당 상세 */}
                <div className="rounded-xl border border-gray-200 p-5 bg-gray-50">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-green-600 rounded-full"></span>
                    수당 내역
                  </h3>
                  <div className="space-y-3">
                    {/* 판매 수당 */}
                    {statement.salesCommission > 0 && (
                      <div className="flex items-center justify-between bg-white rounded-lg p-4 border border-gray-200">
                        <span className="text-sm font-semibold text-gray-700">판매 수당</span>
                        <span className="text-lg font-bold text-gray-900">{statement.salesCommission.toLocaleString()}원</span>
                      </div>
                    )}
                    {/* 대리점 수당 */}
                    {statement.branchCommission > 0 && (
                      <div className="flex items-center justify-between bg-white rounded-lg p-4 border border-gray-200">
                        <span className="text-sm font-semibold text-gray-700">대리점 수당</span>
                        <span className="text-lg font-bold text-gray-900">{statement.branchCommission.toLocaleString()}원</span>
                      </div>
                    )}
                    {/* 오버라이딩 커미션 (대리점장만) */}
                    {statement.overrideCommission > 0 && (
                      <div className="flex items-center justify-between bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                        <span className="text-sm font-semibold text-purple-700">오버라이딩 커미션</span>
                        <span className="text-lg font-bold text-purple-700">{statement.overrideCommission.toLocaleString()}원</span>
                      </div>
                    )}
                    {/* 총 수당 */}
                    <div className="flex items-center justify-between bg-blue-100 rounded-lg p-4 border-2 border-blue-300 mt-4">
                      <span className="text-sm font-bold text-blue-800">총 수당</span>
                      <span className="text-xl font-bold text-blue-800">{statement.grossAmount.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>

                {/* 원천징수 및 실지급액 */}
                <div className="rounded-xl border-2 border-gray-300 p-5 bg-white">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-red-600 rounded-full"></span>
                    세금 공제 및 실지급액
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-sm text-gray-600">총 수당</span>
                      <span className="text-base font-semibold text-gray-900">{statement.grossAmount.toLocaleString()}원</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-sm text-red-600">원천징수 ({statement.withholdingRate}%)</span>
                      <span className="text-base font-semibold text-red-600">-{statement.withholdingAmount.toLocaleString()}원</span>
                    </div>
                    <div className="flex items-center justify-between py-3 bg-emerald-50 rounded-lg px-4 mt-2">
                      <span className="text-base font-bold text-emerald-800">실지급 예정액</span>
                      <span className="text-2xl font-bold text-emerald-700">{statement.netAmount.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>

                {/* 지급 계좌 정보 */}
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-base font-bold text-amber-900 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-amber-600 rounded-full"></span>
                    지급 계좌
                  </h3>
                  {statement.bankName && statement.bankAccount ? (
                    <div className="bg-white rounded-lg p-4 border border-amber-200">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">은행</label>
                          <div className="text-base font-bold text-gray-900">{statement.bankName}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">계좌번호</label>
                          <div className="text-base font-bold text-gray-900 font-mono">{statement.bankAccount}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">예금주</label>
                          <div className="text-base font-bold text-gray-900">{statement.bankAccountHolder || statement.displayName}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg p-4 border border-amber-200 text-center">
                      <p className="text-sm text-amber-700">계좌 정보가 등록되지 않았습니다. 관리자에게 문의해주세요.</p>
                    </div>
                  )}
                </div>

                {/* 상세 내역 테이블 */}
                {statement.details && statement.details.length > 0 && (
                  <div className="rounded-xl border border-gray-200 p-5 bg-gray-50">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-5 bg-gray-600 rounded-full"></span>
                      상세 내역
                    </h3>
                    <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상품코드</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">판매일</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">수당</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">원천징수</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">실지급액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {statement.details.map((detail, index) => (
                            <tr key={detail.entryId || index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                                {detail.productCode || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {detail.saleDate ? new Date(detail.saleDate).toLocaleDateString('ko-KR') : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-900">
                                {detail.amount.toLocaleString()}원
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-red-600">
                                -{detail.withholdingAmount.toLocaleString()}원
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                                {detail.netAmount.toLocaleString()}원
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">합계</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{statement.grossAmount.toLocaleString()}원</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-red-600">-{statement.withholdingAmount.toLocaleString()}원</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600">{statement.netAmount.toLocaleString()}원</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* 감사 메시지 */}
                <div className="text-center py-6 border-t border-gray-200">
                  <p className="text-lg font-semibold text-gray-700">함께 해 주셔서 늘 감사합니다.</p>
                  <p className="text-sm text-gray-500 mt-2">크루즈닷 주식회사</p>
                </div>

                {/* 크루즈닷 확인 도장 (하단) */}
                <div className="flex flex-col items-center justify-center mt-8 pt-6 border-t border-gray-200">
                  <img
                    src="/images/cruisedot-stamp.png"
                    alt="크루즈닷 확인 도장"
                    className="h-24 w-24 object-contain"
                  />
                  <p className="text-xs text-gray-500 mt-2">크루즈닷 주식회사</p>
                  <p className="text-xs text-gray-400">발급일: {new Date().toLocaleDateString('ko-KR')}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 sticky bottom-0 bg-white z-10">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedSettlement(null);
                    setStatement(null);
                  }}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  닫기
                </button>
                <button
                  onClick={handleExportPNG}
                  disabled={exporting}
                  className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  <FiImage className="inline mr-2" />
                  {exporting ? '저장 중...' : 'PNG 저장'}
                </button>
                {!statement.confirmed && (
                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {confirming ? '확인 중...' : '지급명세서 확인'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}










