import type { TrendDay } from '@/types/marketing';

interface TrendChartProps {
  trend: TrendDay[];
  loading: boolean;
}

export function TrendChart({ trend, loading }: TrendChartProps) {
  const maxCount = trend.reduce((m, d) => Math.max(m, d.count), 0) ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-8">
      <h2 className="text-base font-semibold text-navy-900 mb-4">최근 7일 등록 추이</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : trend.length ? (
        <div className="space-y-3">
          {trend.map((day) => (
            <div key={day.date} className="flex items-center gap-3">
              <span className="text-base text-gray-700 font-medium w-20 shrink-0">
                {day.date.slice(5)}일
              </span>
              <div
                className="flex-1 bg-gray-100 rounded h-8 relative"
                role="img"
                aria-label={`${day.date.slice(5)}일: ${day.count}명`}
              >
                <div
                  className="bg-navy-600 rounded h-8 transition-all flex items-center justify-end pr-3"
                  style={{
                    width: `${maxCount > 0 ? (day.count / maxCount) * 100 : 0}%`,
                  }}
                  aria-hidden="true"
                >
                  {day.count > 0 && (
                    <span className="text-white text-base font-bold">
                      {day.count}
                    </span>
                  )}
                </div>
              </div>
              {day.count === 0 && (
                <span className="text-base font-bold text-gray-700 w-12 text-right shrink-0">
                  {day.count}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">최근 7일 등록 데이터가 없습니다.</p>
      )}
    </div>
  );
}
