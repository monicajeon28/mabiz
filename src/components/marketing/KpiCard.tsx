import React from 'react';

interface KpiCardProps {
  /** 카드 제목. `label`과 중 하나는 반드시 전달해야 합니다. */
  title?: string;
  /** `title`의 별칭 — sales/page 등 기존 호출부 호환용 */
  label?: string;
  value: string | number;
  sub?: string;
  /** 아이콘이 없으면 아이콘 영역을 렌더링하지 않습니다. */
  icon?: React.ReactNode;
  delta?: number | null;
  /**
   * 컨테이너 div에 추가할 Tailwind 색상 클래스.
   * 지정하지 않으면 기본 `bg-white border-gray-200` 스타일이 유지됩니다.
   * 예: "bg-blue-50 border-blue-100"
   */
  color?: string;
}

export const KpiCard = React.memo(function KpiCard({
  title,
  label,
  value,
  sub,
  icon,
  delta,
  color,
}: KpiCardProps) {
  const heading = title ?? label ?? '';
  const containerClass = color
    ? `rounded-xl border p-5 ${color}`
    : 'bg-white rounded-xl border border-gray-200 p-5 shadow-sm';

  return (
    <div className={`${containerClass}${icon ? ' flex items-start gap-4' : ''}`}>
      {icon && (
        <div className="bg-navy-50 rounded-lg p-2 shrink-0">{icon}</div>
      )}
      <div>
        <p className="text-base text-gray-500 font-medium">{heading}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-sm text-gray-600 mt-0.5">{sub}</p>}
        {delta != null && (
          <p
            className={`text-sm font-medium mt-1 ${
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
