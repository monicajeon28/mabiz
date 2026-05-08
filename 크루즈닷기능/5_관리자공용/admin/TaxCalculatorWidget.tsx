'use client';

import { useState, useMemo } from 'react';
import {
  calculateTax,
  calculateMonthlyTaxSummary,
  formatCurrency,
  formatDetailedCurrency,
  getTaxBracketColor,
  getDaysUntilTaxFiling,
  TaxCalculationResult,
} from '@/lib/tax-calculator';

interface TaxCalculatorWidgetProps {
  // 실제 수당 데이터 연동 시 사용
  initialMonthlyCommission?: number;
  commissionHistory?: number[];
  compact?: boolean;
}

export default function TaxCalculatorWidget({
  initialMonthlyCommission = 0,
  commissionHistory,
  compact = false,
}: TaxCalculatorWidgetProps) {
  const [monthlyInput, setMonthlyInput] = useState<string>(
    initialMonthlyCommission > 0 ? initialMonthlyCommission.toString() : ''
  );
  const [showDetails, setShowDetails] = useState(false);

  // 입력값 파싱
  const monthlyCommission = useMemo(() => {
    const cleaned = monthlyInput.replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
  }, [monthlyInput]);

  // 세금 계산
  const taxResult: TaxCalculationResult | null = useMemo(() => {
    if (monthlyCommission <= 0 && (!commissionHistory || commissionHistory.length === 0)) {
      return null;
    }

    return calculateTax({
      monthlyCommission: monthlyCommission > 0 ? monthlyCommission : undefined,
      commissionHistory: commissionHistory,
      hasSimplifiedDeduction: true,
    });
  }, [monthlyCommission, commissionHistory]);

  // 월간 요약
  const monthlySummary = useMemo(() => {
    if (monthlyCommission <= 0) return null;
    return calculateMonthlyTaxSummary(monthlyCommission);
  }, [monthlyCommission]);

  // 종합소득세 신고까지 남은 일수
  const daysUntilFiling = getDaysUntilTaxFiling();

  // 입력 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setMonthlyInput(value);
  };

  // 입력 포맷팅 (쉼표 추가)
  const formattedInput = monthlyInput
    ? parseInt(monthlyInput, 10).toLocaleString()
    : '';

  // Compact 모드 (간단한 정보만)
  if (compact && taxResult) {
    const bracketColor = getTaxBracketColor(taxResult.incomeTaxRate);
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span>💰</span> 예상 세금
          </h3>
          <span className={`text-xs px-2 py-1 rounded-full ${bracketColor.bg} ${bracketColor.text}`}>
            {taxResult.incomeTaxBracket}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">연간 예상 세금</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(taxResult.totalTaxDue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">5월 정산</p>
            <p className={`text-lg font-bold ${taxResult.isRefund ? 'text-green-600' : 'text-red-600'}`}>
              {taxResult.isRefund ? '환급 ' : '추가 납부 '}
              {formatCurrency(Math.abs(taxResult.additionalPayment))}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <span>🧮</span> 세금 계산기
          </h3>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
            종합소득세 신고 D-{daysUntilFiling}
          </span>
        </div>
        <p className="text-xs text-white/80 mt-1">
          월 수당을 입력하면 예상 세금을 자동 계산합니다
        </p>
      </div>

      {/* 입력 영역 */}
      <div className="p-4 border-b border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          월 평균 수당
        </label>
        <div className="relative">
          <input
            type="text"
            value={formattedInput}
            onChange={handleInputChange}
            placeholder="예: 3,000,000"
            className="w-full px-4 py-3 pr-12 text-xl font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
            원
          </span>
        </div>

        {/* 빠른 입력 버튼 */}
        <div className="flex gap-2 mt-3">
          {[1000000, 2000000, 3000000, 5000000].map((amount) => (
            <button
              key={amount}
              onClick={() => setMonthlyInput(amount.toString())}
              className="flex-1 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
            >
              {formatCurrency(amount)}
            </button>
          ))}
        </div>
      </div>

      {/* 월간 요약 (원천징수) */}
      {monthlySummary && (
        <div className="p-4 bg-gray-50 border-b border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span>📋</span> 월간 수당 내역
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500">총 수당</p>
              <p className="text-base font-semibold text-gray-900">
                {formatCurrency(monthlySummary.gross)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-orange-200">
              <p className="text-xs text-orange-600">원천징수 (3.3%)</p>
              <p className="text-base font-semibold text-orange-600">
                -{formatCurrency(monthlySummary.withholding)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <p className="text-xs text-green-600">실수령액</p>
              <p className="text-base font-semibold text-green-600">
                {formatCurrency(monthlySummary.net)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 연간 세금 계산 결과 */}
      {taxResult && (
        <>
          {/* 핵심 정보 카드 */}
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span>📊</span> 연간 세금 예상 (종합소득세 기준)
            </h4>

            {/* 메인 결과 카드 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* 연간 총 수당 */}
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-xs text-indigo-600 mb-1">연간 총 수당</p>
                <p className="text-2xl font-bold text-indigo-700">
                  {formatCurrency(taxResult.grossIncome)}
                </p>
                <p className="text-xs text-indigo-500 mt-1">
                  월평균 {formatCurrency(taxResult.monthlyAverage)}
                </p>
              </div>

              {/* 연간 총 세금 */}
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-xs text-red-600 mb-1">연간 총 세금</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(taxResult.totalTaxDue)}
                </p>
                <p className="text-xs text-red-500 mt-1">
                  실효세율 {taxResult.effectiveTaxRate.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* 5월 정산 결과 (가장 중요!) */}
            <div className={`rounded-xl p-4 ${taxResult.isRefund ? 'bg-green-50 border-2 border-green-200' : 'bg-orange-50 border-2 border-orange-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${taxResult.isRefund ? 'text-green-700' : 'text-orange-700'}`}>
                    5월 종합소득세 신고 시
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${taxResult.isRefund ? 'text-green-700' : 'text-orange-700'}`}>
                    {taxResult.isRefund ? '환급 예상' : '추가 납부'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${taxResult.isRefund ? 'text-green-700' : 'text-orange-700'}`}>
                    {formatCurrency(Math.abs(taxResult.additionalPayment))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    이미 납부: {formatCurrency(taxResult.alreadyPaid)}
                  </p>
                </div>
              </div>
            </div>

            {/* 상세 보기 토글 */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full mt-4 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1"
            >
              {showDetails ? '간단히 보기 ▲' : '상세 계산 보기 ▼'}
            </button>
          </div>

          {/* 상세 계산 내역 */}
          {showDetails && (
            <div className="px-4 pb-4 space-y-3">
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-700 mb-3">세금 계산 상세</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">① 총 수입</span>
                    <span className="font-medium">{formatDetailedCurrency(taxResult.grossIncome)}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>② 필요경비 ({taxResult.deductionRate}%)</span>
                    <span className="font-medium">-{formatDetailedCurrency(taxResult.deductionAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">③ 과세표준 (① - ②)</span>
                    <span className="font-medium">{formatDetailedCurrency(taxResult.taxableIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">④ 적용 세율</span>
                    <span className={`font-medium px-2 py-0.5 rounded ${getTaxBracketColor(taxResult.incomeTaxRate).bg} ${getTaxBracketColor(taxResult.incomeTaxRate).text}`}>
                      {taxResult.incomeTaxBracket}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">⑤ 산출 세액</span>
                    <span className="font-medium">{formatDetailedCurrency(taxResult.calculatedIncomeTax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">⑥ 지방소득세 (⑤의 10%)</span>
                    <span className="font-medium">{formatDetailedCurrency(taxResult.localIncomeTax)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-red-600">
                    <span className="font-medium">총 납부 세금 (⑤ + ⑥)</span>
                    <span className="font-bold">{formatDetailedCurrency(taxResult.totalTaxDue)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>기납부 원천징수세</span>
                    <span className="font-medium">-{formatDetailedCurrency(taxResult.alreadyPaid)}</span>
                  </div>
                  <div className={`flex justify-between border-t pt-2 text-lg font-bold ${taxResult.isRefund ? 'text-green-600' : 'text-orange-600'}`}>
                    <span>{taxResult.isRefund ? '환급 예상액' : '추가 납부액'}</span>
                    <span>{formatDetailedCurrency(Math.abs(taxResult.additionalPayment))}</span>
                  </div>
                </div>
              </div>

              {/* 연간 실수령액 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-700 mb-2">연간 실수령액</h5>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(taxResult.netIncomeAfterTax)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  월평균 약 {formatCurrency(taxResult.monthlyNetIncome)}
                </p>
              </div>
            </div>
          )}

          {/* 안내 문구 */}
          <div className="px-4 pb-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">
                <strong>참고:</strong> 본 계산은 단순경비율 적용 시 예상치입니다.
                실제 세금은 다른 소득, 공제 항목에 따라 달라질 수 있으니
                세무사와 상담하시기 바랍니다.
              </p>
            </div>
          </div>
        </>
      )}

      {/* 입력 안내 (결과 없을 때) */}
      {!taxResult && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-sm">월 평균 수당을 입력하면</p>
          <p className="text-sm">예상 세금을 계산해 드립니다</p>
        </div>
      )}
    </div>
  );
}
