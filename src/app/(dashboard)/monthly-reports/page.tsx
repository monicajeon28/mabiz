import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Monthly Reports',
  description: 'View monthly settlement reports'
};

export default async function MonthlyReportsPage() {
  const session = await getMabizSession();

  if (!session?.organizationId) {
    return notFound();
  }

  // 최근 12개월 MonthlySettlement 조회
  // 📌 P0-SEC-001: 테넌트 격리 필터 필요
  // TODO: MonthlySettlement 스키마에 organizationId 추가 필수
  // 현재: 스키마에 organizationId 없음 → summary.organizationId에 저장된 값 확인 필요
  const allSettlements = await prisma.monthlySettlement.findMany({
    orderBy: { periodStart: 'desc' },
    take: 24 // 더 많이 조회해서 필터링
  });

  // 현재 조직의 settlement만 필터링 (summary.organizationId 기반)
  const settlements = allSettlements.filter((s: any) => {
    const summary = s.summary as any;
    return summary?.organizationId === session.organizationId;
  }).slice(0, 12);

  // 총 통계 계산
  const totalAmount = settlements.reduce((sum: number, s: any) => {
    const summary = s.summary as any;
    return sum + (summary?.totalCommission || 0);
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getPeriodLabel = (periodStart: Date) => {
    return periodStart.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
      APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800' },
      LOCKED: { label: 'Locked', color: 'bg-blue-100 text-blue-800' },
      PAID: { label: 'Paid', color: 'bg-purple-100 text-purple-800' }
    };

    const map = statusMap[status] || statusMap['DRAFT'];
    return map;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Monthly Settlements</h1>
        <p className="text-gray-600 mt-1">
          View monthly settlement and commission reports
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <div className="text-sm text-gray-600 font-semibold">
          Total Commission (Last 12 Months)
        </div>
        <div className="text-3xl font-bold mt-2 text-green-600">
          {formatCurrency(totalAmount)}
        </div>
        <div className="text-sm text-gray-500 mt-2">
          Based on {settlements.length} monthly settlements
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Period
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                  Total Commission
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                  Settled
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                  Unsettled
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {settlements.length > 0 ? (
                settlements.map((settlement: any) => {
                  const summary = settlement.summary as any;
                  const totalComm = summary?.totalCommission || 0;
                  const settledComm = summary?.settledCommission || 0;
                  const unsettledComm = summary?.unsettledCommission || 0;
                  const statusBadge = getStatusBadge(settlement.status);

                  return (
                    <tr key={settlement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {getPeriodLabel(settlement.periodStart)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">
                        {formatCurrency(totalComm)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-700">
                        {formatCurrency(settledComm)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-700">
                        {formatCurrency(unsettledComm)}
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No settlements available yet. Settlements are generated
                    automatically on the 1st of each month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>ℹ️ Note:</strong> Monthly settlements are automatically generated
        at 1:00 AM UTC on the 1st of each month. They aggregate commission data
        from the previous month.
      </div>
    </div>
  );
}
