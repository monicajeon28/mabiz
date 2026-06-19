import type { TrendDay } from '@/types/marketing';

interface TrendChartProps {
  trend: TrendDay[];
  loading: boolean;
}

export function TrendChart({ trend, loading }: TrendChartProps) {
  const maxCount = trend.reduce((m, d) => Math.max(m, d.count), 0) ?? 0;

  // 전일 대비 계산
  const getTrendDelta = (idx: number) => {
    if (idx === 0 || !trend[idx - 1]) return null;
    return trend[idx].count - trend[idx - 1].count;
  };

  const getDeltaIcon = (delta: number | null) => {
    if (!delta) return null;
    if (delta > 0) return '↑';
    if (delta < 0) return '↓';
    return '→';
  };

  const getDeltaColor = (delta: number | null) => {
    if (!delta) return 'text-gray-500';
    if (delta > 0) return 'text-green-600';
    if (delta < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-8">
      <h2 className="text-base font-semibold text-navy-900 mb-6">최근 7일 등록 추이</h2>
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : trend.length ? (
        <>
          {/* 바 차트 */}
          <div className="space-y-4 mb-8">
            {trend.map((day, idx) => (
              <div key={day.date}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-base text-gray-700 font-medium w-20 shrink-0">
                    {day.date.slice(5)}일
                  </span>
                  <div
                    className="flex-1 bg-gray-100 rounded h-10 relative"
                    role="img"
                    aria-label={`${day.date.slice(5)}일: ${day.count}명`}
                  >
                    <div
                      className="bg-navy-600 rounded h-10 transition-all flex items-center justify-between px-3"
                      style={{
                        width: `${maxCount > 0 ? (day.count / maxCount) * 100 : 0}%`,
                      }}
                      aria-hidden="true"
                    >
                      {day.count > 0 && (
                        <span className="text-white text-base font-bold">
                          {day.count}명
                        </span>
                      )}
                    </div>
                  </div>
                  {day.count === 0 && (
                    <span className="text-base font-bold text-gray-700 w-16 text-right shrink-0">
                      {day.count}명
                    </span>
                  )}
                </div>
                {/* 전일대비 */}
                {getTrendDelta(idx) !== null && (
                  <div className="pl-24 text-sm text-gray-500">
                    <span className={getDeltaColor(getTrendDelta(idx))}>
                      {getDeltaIcon(getTrendDelta(idx))} {Math.abs(getTrendDelta(idx) ?? 0)}명
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 요약 테이블 */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">요약</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">날짜</th>
                    <th className="text-right py-2 px-3 text-gray-600 font-medium">등록수</th>
                    <th className="text-right py-2 px-3 text-gray-600 font-medium">전일대비</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((day, idx) => (
                    <tr key={day.date} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-700 font-medium">{day.date.slice(5)}일</td>
                      <td className="py-2 px-3 text-right text-gray-900 font-semibold">{day.count}</td>
                      <td className={`py-2 px-3 text-right font-semibold ${getDeltaColor(getTrendDelta(idx))}`}>
                        {getTrendDelta(idx) !== null ? (
                          <>
                            {getDeltaIcon(getTrendDelta(idx))} {Math.abs(getTrendDelta(idx) ?? 0)}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-600">최근 7일 등록 데이터가 없습니다.</p>
      )}
    </div>
  );
}
