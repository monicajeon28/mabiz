import type { Summary } from '@/types/marketing';

interface FunnelChartProps {
  summary: Summary;
}

export function FunnelChart({ summary }: FunnelChartProps) {
  const steps = [
    { label: "방문", value: summary.totalViews, color: "bg-navy-600" },
    { label: "등록", value: summary.totalRegistrations, color: "bg-blue-500" },
    { label: "퍼널", value: summary.totalFunnelEntered, color: "bg-blue-400" },
    { label: "구매", value: summary.totalPurchased, color: "bg-green-500" },
  ];

  return (
    <div className="bg-white border rounded-xl p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">전환 퍼널</h2>
      <div className="flex items-end gap-2 h-24">
        {steps.map((step, i, arr) => {
          const max = arr[0].value || 1;
          const h = Math.max(4, Math.round(80 * step.value / max));
          const prev = i > 0 ? arr[i - 1].value : step.value;
          const rate = prev > 0 ? Math.round((step.value / prev) * 100) : 0;
          return (
            <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-gray-700">
                {step.value.toLocaleString()}
              </span>
              <div className="w-full flex items-end justify-center">
                <div
                  className={`w-full ${step.color} rounded-t transition-all`}
                  style={{ height: `${h}px` }}
                  suppressHydrationWarning
                />
              </div>
              <span className="text-sm text-gray-500">{step.label}</span>
              {i > 0 && (
                <span className="text-sm text-gray-600">{rate}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
