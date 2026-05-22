import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  delta?: number | null;
}

export const KpiCard = React.memo(function KpiCard({
  title,
  value,
  sub,
  icon,
  delta,
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start gap-4">
      <div className="bg-navy-50 rounded-lg p-2 shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-navy-900 mt-0.5">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {delta != null && (
          <p
            className={`text-xs font-medium mt-1 ${
              delta >= 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {delta >= 0 ? "↑" : "↓"} 전월 대비 {Math.abs(delta)}%
          </p>
        )}
      </div>
    </div>
  );
});
