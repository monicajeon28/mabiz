"use client";

interface StockGaugeWidgetProps {
  currentStock: number;
  totalStock: number;
  weeklyBurnRate: number;
  weeksToZero: number;
}

export function StockGaugeWidget({
  currentStock,
  totalStock,
  weeklyBurnRate,
  weeksToZero,
}: StockGaugeWidgetProps) {
  const percentage = (currentStock / totalStock) * 100;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">🪑 남은 자리 현황</h3>
        <span className="text-sm text-gray-600">
          <strong className="text-red-600">{currentStock}</strong> / {totalStock}
        </span>
      </div>

      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>지금 ({currentStock}개)</span>
          <span>{weeksToZero}주뒤 (3개)</span>
          <span>매진</span>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800 font-medium">
        ⚠️ <strong>평균 예약 속도: 주 {weeklyBurnRate}개</strong> 소진 중
      </div>
    </div>
  );
}
