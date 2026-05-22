import { formatAmount, formatMonth } from '@/lib/marketing-utils';
import type { MonthlyRow } from '@/types/marketing';

interface SalesBarChartProps {
  monthly: MonthlyRow[];
}

export function SalesBarChart({ monthly }: SalesBarChartProps) {
  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">최근 6개월 매출</h2>
      <div className="flex items-end gap-3 h-40">
        {monthly.map((row) => {
          const heightPct = Math.max((row.revenue / maxRevenue) * 100, 2);
          return (
            <div key={row.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400 truncate w-full text-center">
                {row.revenue > 0 ? formatAmount(row.revenue) : ""}
              </span>
              <div
                className="w-full rounded-t-md bg-blue-500 transition-all"
                style={{ height: `${heightPct}%` }}
                title={`${row.month}: ${formatAmount(row.revenue)} (${row.count}건)`}
                role="img"
                aria-label={`${row.month}: ${formatAmount(row.revenue)}, ${row.count}건`}
              />
              <span className="text-xs text-gray-500 mt-1">{formatMonth(row.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
