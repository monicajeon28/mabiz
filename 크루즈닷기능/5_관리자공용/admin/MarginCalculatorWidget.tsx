'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  calculateMargin,
  formatAmount,
  formatDetailAmount,
  formatPercent,
  getStatusColor,
  getDefaultFixedCosts,
  getDefaultVariableCosts,
  MarginCalculationResult,
  SalesData,
  CommissionData,
  FixedCostData,
  VariableCostData,
} from '@/lib/margin-calculator';

interface MarginCalculatorWidgetProps {
  // 실제 데이터 연동 시 사용
  initialSalesData?: Partial<SalesData>;
  initialCommissionData?: Partial<CommissionData>;
  onCalculate?: (result: MarginCalculationResult) => void;
}

// 숫자 입력 컴포넌트
function NumberInput({
  label,
  value,
  onChange,
  placeholder = '0',
  suffix = '원',
  className = '',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  suffix?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value > 0 ? value.toLocaleString() : '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10) || 0;
    setDisplayValue(num > 0 ? num.toLocaleString() : '');
    onChange(num);
  };

  useEffect(() => {
    setDisplayValue(value > 0 ? value.toLocaleString() : '');
  }, [value]);

  return (
    <div className={className}>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {suffix}
        </span>
      </div>
    </div>
  );
}

// 빠른 금액 버튼
function QuickAmountButtons({
  amounts,
  onSelect,
}: {
  amounts: number[];
  onSelect: (amount: number) => void;
}) {
  return (
    <div className="flex gap-1 mt-1">
      {amounts.map((amount) => (
        <button
          key={amount}
          onClick={() => onSelect(amount)}
          className="flex-1 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
        >
          {formatAmount(amount)}
        </button>
      ))}
    </div>
  );
}

export default function MarginCalculatorWidget({
  initialSalesData,
  initialCommissionData,
  onCalculate,
}: MarginCalculatorWidgetProps) {
  // 매출 데이터
  const [salesData, setSalesData] = useState<SalesData>({
    totalSales: initialSalesData?.totalSales || 0,
    salesCount: initialSalesData?.salesCount || 0,
    refundAmount: initialSalesData?.refundAmount || 0,
    refundCount: initialSalesData?.refundCount || 0,
  });

  // 수당 데이터
  const [commissionData, setCommissionData] = useState<CommissionData>({
    salesAgentCommission: initialCommissionData?.salesAgentCommission || 0,
    mentorCommission: initialCommissionData?.mentorCommission || 0,
    branchManagerCommission: initialCommissionData?.branchManagerCommission || 0,
    otherCommission: initialCommissionData?.otherCommission || 0,
  });

  // 고정비 데이터
  const [fixedCosts, setFixedCosts] = useState<FixedCostData>(getDefaultFixedCosts());

  // 변동비 데이터
  const [variableCosts, setVariableCosts] = useState<VariableCostData>(getDefaultVariableCosts());

  // UI 상태
  const [activeTab, setActiveTab] = useState<'summary' | 'sales' | 'costs' | 'analysis'>('summary');
  const [showDetailedCosts, setShowDetailedCosts] = useState(false);

  // 마진 계산
  const result = useMemo<MarginCalculationResult | null>(() => {
    if (salesData.totalSales <= 0) return null;

    const calcResult = calculateMargin({
      sales: salesData,
      commission: commissionData,
      fixedCosts,
      variableCosts,
    });

    onCalculate?.(calcResult);
    return calcResult;
  }, [salesData, commissionData, fixedCosts, variableCosts, onCalculate]);

  const statusColor = result ? getStatusColor(result.profitStatus) : null;

  // 매출 업데이트 핸들러
  const updateSales = (key: keyof SalesData, value: number) => {
    setSalesData((prev) => ({ ...prev, [key]: value }));
  };

  // 수당 업데이트 핸들러
  const updateCommission = (key: keyof CommissionData, value: number) => {
    setCommissionData((prev) => ({ ...prev, [key]: value }));
  };

  // 고정비 업데이트 핸들러
  const updateFixedCost = (key: keyof FixedCostData, value: number) => {
    setFixedCosts((prev) => ({ ...prev, [key]: value }));
  };

  // 변동비 업데이트 핸들러
  const updateVariableCost = (key: keyof VariableCostData, value: number) => {
    setVariableCosts((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <span>📊</span> 본사 마진 계산기
          </h3>
          {result && (
            <span className={`text-xs px-2 py-1 rounded-full ${result.isProfitable ? 'bg-white/20' : 'bg-red-500'}`}>
              {result.isProfitable ? '흑자' : '적자'}
            </span>
          )}
        </div>
        <p className="text-xs text-white/80 mt-1">
          매출, 수당, 비용을 입력하면 순이익을 자동 계산합니다
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'summary', label: '요약', icon: '📈' },
          { id: 'sales', label: '매출/수당', icon: '💰' },
          { id: 'costs', label: '비용', icon: '💸' },
          { id: 'analysis', label: '분석', icon: '🔍' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 요약 탭 */}
      {activeTab === 'summary' && (
        <div className="p-4 space-y-4">
          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 순매출 */}
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-600 mb-1">순매출</p>
              <p className="text-xl font-bold text-blue-700">
                {result ? formatAmount(result.netSales) : '-'}
              </p>
              {result && result.refundRate > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  환불 {formatPercent(result.refundRate)} ({formatAmount(result.refundAmount)})
                </p>
              )}
            </div>

            {/* 순이익 */}
            <div className={`rounded-xl p-3 ${result?.isProfitable ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-xs mb-1 ${result?.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                순이익
              </p>
              <p className={`text-xl font-bold ${result?.isProfitable ? 'text-green-700' : 'text-red-700'}`}>
                {result ? formatAmount(result.netProfit, true) : '-'}
              </p>
              <p className={`text-xs mt-1 ${result?.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                마진율 {result ? formatPercent(result.netProfitMargin) : '-'}
              </p>
            </div>
          </div>

          {/* 상태 메시지 */}
          {result && statusColor && (
            <div className={`${statusColor.bg} ${statusColor.border} border rounded-xl p-3`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{statusColor.icon}</span>
                <div>
                  <p className={`font-medium ${statusColor.text}`}>
                    {result.statusMessage}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    손익분기점 대비 {formatPercent(result.salesVsBreakEven)}
                    {result.salesVsBreakEven >= 100 ? ' (안전)' : ' (위험)'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 비용 구조 바 차트 */}
          {result && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">비용 구조 (매출 대비)</p>
              <div className="h-8 bg-gray-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-orange-400 h-full"
                  style={{ width: `${Math.min(result.costStructure.commissionPercent, 100)}%` }}
                  title={`수당 ${formatPercent(result.costStructure.commissionPercent)}`}
                />
                <div
                  className="bg-purple-400 h-full"
                  style={{ width: `${Math.min(result.costStructure.fixedPercent, 100)}%` }}
                  title={`고정비 ${formatPercent(result.costStructure.fixedPercent)}`}
                />
                <div
                  className="bg-pink-400 h-full"
                  style={{ width: `${Math.min(result.costStructure.variablePercent, 100)}%` }}
                  title={`변동비 ${formatPercent(result.costStructure.variablePercent)}`}
                />
                {result.costStructure.profitPercent > 0 && (
                  <div
                    className="bg-green-400 h-full"
                    style={{ width: `${Math.min(result.costStructure.profitPercent, 100)}%` }}
                    title={`순이익 ${formatPercent(result.costStructure.profitPercent)}`}
                  />
                )}
              </div>
              <div className="flex text-xs gap-4 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-orange-400 rounded" /> 수당
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-purple-400 rounded" /> 고정비
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-pink-400 rounded" /> 변동비
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-400 rounded" /> 이익
                </span>
              </div>
            </div>
          )}

          {/* 빠른 매출 입력 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              빠른 매출 입력
            </label>
            <NumberInput
              label=""
              value={salesData.totalSales}
              onChange={(v) => updateSales('totalSales', v)}
              placeholder="총 매출을 입력하세요"
            />
            <QuickAmountButtons
              amounts={[10000000, 50000000, 100000000, 500000000]}
              onSelect={(v) => updateSales('totalSales', v)}
            />
          </div>

          {/* 결과 없을 때 */}
          {!result && (
            <div className="py-6 text-center text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm">매출을 입력하면</p>
              <p className="text-sm">마진을 자동 계산합니다</p>
            </div>
          )}
        </div>
      )}

      {/* 매출/수당 탭 */}
      {activeTab === 'sales' && (
        <div className="p-4 space-y-4">
          {/* 매출 섹션 */}
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span>💵</span> 매출 정보
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="총 매출"
                value={salesData.totalSales}
                onChange={(v) => updateSales('totalSales', v)}
              />
              <NumberInput
                label="판매 건수"
                value={salesData.salesCount}
                onChange={(v) => updateSales('salesCount', v)}
                suffix="건"
              />
              <NumberInput
                label="환불 금액"
                value={salesData.refundAmount}
                onChange={(v) => updateSales('refundAmount', v)}
              />
              <NumberInput
                label="환불 건수"
                value={salesData.refundCount}
                onChange={(v) => updateSales('refundCount', v)}
                suffix="건"
              />
            </div>
            {result && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">환불율</span>
                  <span className={result.refundRate > 10 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                    {formatPercent(result.refundRate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 수당 섹션 */}
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span>👥</span> 수당 지출
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="판매원 수당"
                value={commissionData.salesAgentCommission}
                onChange={(v) => updateCommission('salesAgentCommission', v)}
              />
              <NumberInput
                label="멘토 수당"
                value={commissionData.mentorCommission}
                onChange={(v) => updateCommission('mentorCommission', v)}
              />
              <NumberInput
                label="대리점장 오버라이드"
                value={commissionData.branchManagerCommission}
                onChange={(v) => updateCommission('branchManagerCommission', v)}
              />
              <NumberInput
                label="기타 수당"
                value={commissionData.otherCommission}
                onChange={(v) => updateCommission('otherCommission', v)}
              />
            </div>
            {result && (
              <div className="mt-2 p-2 bg-orange-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-700">총 수당 지출</span>
                  <span className="text-orange-700 font-medium">
                    {formatDetailAmount(result.totalCommission)} ({formatPercent(result.commissionRate)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 비용 탭 */}
      {activeTab === 'costs' && (
        <div className="p-4 space-y-4">
          {/* 고정비 섹션 */}
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span>🏢</span> 고정비 (매월 발생)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="사무실 월세"
                value={fixedCosts.officeRent}
                onChange={(v) => updateFixedCost('officeRent', v)}
              />
              <NumberInput
                label="전기세"
                value={fixedCosts.electricity}
                onChange={(v) => updateFixedCost('electricity', v)}
              />
              <NumberInput
                label="수도세"
                value={fixedCosts.water}
                onChange={(v) => updateFixedCost('water', v)}
              />
              <NumberInput
                label="인터넷/통신비"
                value={fixedCosts.internet}
                onChange={(v) => updateFixedCost('internet', v)}
              />
              <NumberInput
                label="AI 플랫폼 비용"
                value={fixedCosts.aiPlatformFee}
                onChange={(v) => updateFixedCost('aiPlatformFee', v)}
              />
              <NumberInput
                label="서버/호스팅"
                value={fixedCosts.serverCost}
                onChange={(v) => updateFixedCost('serverCost', v)}
              />
              <NumberInput
                label="보험료"
                value={fixedCosts.insurance}
                onChange={(v) => updateFixedCost('insurance', v)}
              />
              <NumberInput
                label="기타 고정비"
                value={fixedCosts.otherFixed}
                onChange={(v) => updateFixedCost('otherFixed', v)}
              />
            </div>
            {result && (
              <div className="mt-2 p-2 bg-purple-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-purple-700">총 고정비</span>
                  <span className="text-purple-700 font-medium">
                    {formatDetailAmount(result.totalFixedCosts)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 변동비 섹션 */}
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span>📢</span> 변동비 (상황에 따라 변동)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="마케팅/광고비"
                value={variableCosts.marketingCost}
                onChange={(v) => updateVariableCost('marketingCost', v)}
              />
              <NumberInput
                label="영업비"
                value={variableCosts.salesCost}
                onChange={(v) => updateVariableCost('salesCost', v)}
              />
              <NumberInput
                label="출장비"
                value={variableCosts.travelCost}
                onChange={(v) => updateVariableCost('travelCost', v)}
              />
              <NumberInput
                label="접대비"
                value={variableCosts.entertainmentCost}
                onChange={(v) => updateVariableCost('entertainmentCost', v)}
              />
              <NumberInput
                label="소모품비"
                value={variableCosts.suppliesCost}
                onChange={(v) => updateVariableCost('suppliesCost', v)}
              />
              <NumberInput
                label="기타 변동비"
                value={variableCosts.otherVariable}
                onChange={(v) => updateVariableCost('otherVariable', v)}
              />
            </div>
            {result && (
              <div className="mt-2 p-2 bg-pink-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-pink-700">총 변동비</span>
                  <span className="text-pink-700 font-medium">
                    {formatDetailAmount(result.totalVariableCosts)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 분석 탭 */}
      {activeTab === 'analysis' && result && (
        <div className="p-4 space-y-4">
          {/* 손익계산서 스타일 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-800 mb-3">손익계산서</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">총 매출</span>
                <span className="font-medium">{formatDetailAmount(result.grossSales)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>(-) 환불</span>
                <span>{formatDetailAmount(result.refundAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>순매출</span>
                <span>{formatDetailAmount(result.netSales)}</span>
              </div>
              <div className="flex justify-between text-orange-600">
                <span>(-) 총 수당</span>
                <span>{formatDetailAmount(result.totalCommission)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium text-blue-700">
                <span>매출총이익</span>
                <span>{formatDetailAmount(result.grossProfit)} ({formatPercent(result.grossProfitMargin)})</span>
              </div>
              <div className="flex justify-between text-purple-600">
                <span>(-) 고정비</span>
                <span>{formatDetailAmount(result.totalFixedCosts)}</span>
              </div>
              <div className="flex justify-between text-pink-600">
                <span>(-) 변동비</span>
                <span>{formatDetailAmount(result.totalVariableCosts)}</span>
              </div>
              <div className={`flex justify-between border-t-2 pt-2 text-lg font-bold ${result.isProfitable ? 'text-green-700' : 'text-red-700'}`}>
                <span>순이익</span>
                <span>
                  {formatDetailAmount(result.netProfit)}
                  <span className="text-sm font-normal ml-1">
                    ({formatPercent(result.netProfitMargin)})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* 주요 지표 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">매출총이익률</p>
              <p className="text-xl font-bold text-blue-600">
                {formatPercent(result.grossProfitMargin)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">영업이익률</p>
              <p className={`text-xl font-bold ${result.operatingProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(result.operatingProfitMargin)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">손익분기점 매출</p>
              <p className="text-xl font-bold text-gray-700">
                {formatAmount(result.breakEvenSales)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">손익분기 달성률</p>
              <p className={`text-xl font-bold ${result.salesVsBreakEven >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(result.salesVsBreakEven)}
              </p>
            </div>
          </div>

          {/* 수당 상세 내역 */}
          <div className="bg-orange-50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-orange-800 mb-3">수당 상세 내역</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-orange-700">판매원 수당</span>
                <span className="font-medium text-orange-700">
                  {formatDetailAmount(result.commissionBreakdown.salesAgent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-700">멘토 수당</span>
                <span className="font-medium text-orange-700">
                  {formatDetailAmount(result.commissionBreakdown.mentor)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-700">대리점장 오버라이드</span>
                <span className="font-medium text-orange-700">
                  {formatDetailAmount(result.commissionBreakdown.branchManager)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-700">기타</span>
                <span className="font-medium text-orange-700">
                  {formatDetailAmount(result.commissionBreakdown.other)}
                </span>
              </div>
              <div className="flex justify-between border-t border-orange-200 pt-2 font-bold">
                <span className="text-orange-800">수당 합계</span>
                <span className="text-orange-800">
                  {formatDetailAmount(result.totalCommission)} ({formatPercent(result.commissionRate)})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 분석 탭 - 결과 없을 때 */}
      {activeTab === 'analysis' && !result && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">매출을 입력하면</p>
          <p className="text-sm">상세 분석을 확인할 수 있습니다</p>
        </div>
      )}

      {/* 푸터 */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          * 본 계산은 참고용이며, 실제 회계 처리와 다를 수 있습니다
        </p>
      </div>
    </div>
  );
}
