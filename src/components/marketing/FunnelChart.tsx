import type { Summary } from '@/types/marketing';

interface FunnelChartProps {
  summary: Summary;
}

export function FunnelChart({ summary }: FunnelChartProps) {
  const steps = [
    {
      label: "방문",
      description: "랜딩페이지에 도착한 고객",
      value: summary.totalViews,
      color: "from-emerald-500 to-emerald-600",
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-700",
      dotColor: "bg-emerald-500"
    },
    {
      label: "신청",
      description: "폼 작성 후 신청한 고객",
      value: summary.totalRegistrations,
      color: "from-yellow-500 to-yellow-600",
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-700",
      dotColor: "bg-yellow-500"
    },
    {
      label: "결제진행",
      description: "결제 페이지에 진입한 고객",
      value: summary.totalFunnelEntered,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50",
      textColor: "text-orange-700",
      dotColor: "bg-orange-500"
    },
    {
      label: "구매완료",
      description: "실제로 구매한 고객",
      value: summary.totalPurchased,
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-50",
      textColor: "text-red-700",
      dotColor: "bg-red-500"
    },
  ];

  // 각 단계의 통계 계산
  const stats = steps.map((step, i) => {
    const prev = i > 0 ? steps[i - 1].value : step.value;
    const rate = prev > 0 ? Math.round((step.value / prev) * 100) : 0;
    const dropoff = prev - step.value;
    const dropoffPercent = prev > 0 ? Math.round((dropoff / prev) * 100) : 0;
    return { rate, dropoff, dropoffPercent };
  });

  const maxValue = steps[0].value || 1;

  return (
    <div className="bg-white border rounded-xl p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">구매 경로</h2>
      <p className="text-base text-gray-600 mb-8">
        고객이 방문해서 구매까지 가는 과정입니다. 각 단계에서 몇 명이 빠져나가는지 확인할 수 있습니다.
      </p>

      {/* 세로형 퍼널 시각화 */}
      <div className="space-y-6">
        {steps.map((step, i) => {
          const widthPercent = (step.value / maxValue) * 100;
          const stat = stats[i];

          return (
            <div key={step.label} className="space-y-3">
              {/* 단계 헤더: 번호 + 이름 + 설명 */}
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${step.dotColor} font-bold text-lg text-white flex-shrink-0`}>
                    {i + 1}
                  </span>
                  <div>
                    <div className={`text-xl font-bold ${step.textColor}`}>{step.label}</div>
                    <div className="text-sm text-gray-600 mt-1">{step.description}</div>
                  </div>
                </div>
                {/* 숫자 (오른쪽 정렬, 50대 친화) */}
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {step.value.toLocaleString()}명
                  </div>
                  <div className="text-base font-semibold text-gray-600 mt-1">
                    {i === 0 ? "100%" : `${stat.rate}% 진입`}
                  </div>
                </div>
              </div>

              {/* 진행 막대 (높이 증가 for 50+) */}
              <div className="w-full h-16 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${step.color} rounded-lg transition-all flex items-center justify-center`}
                  style={{ width: `${widthPercent}%` }}
                >
                  {widthPercent > 20 && (
                    <span className="text-white font-bold text-base sm:text-lg">
                      {Math.round(widthPercent)}%
                    </span>
                  )}
                </div>
              </div>

              {/* 탈락 정보 (1단계 제외, 글자 크기 증가) */}
              {i > 0 && stat.dropoff > 0 && (
                <div className={`px-4 py-3 ${step.bgColor} rounded-lg border-2 border-current`}>
                  <p className={`text-base font-medium ${step.textColor}`}>
                    <span className="font-bold">{stat.dropoff.toLocaleString()}명 탈락</span>
                    <span className="text-gray-600"> (이전 단계 대비 {stat.dropoffPercent}%)</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 해석 가이드 (50대 친화 글자크기) */}
      <div className="mt-8 p-5 bg-blue-50 rounded-lg border-2 border-blue-300">
        <div className="flex gap-4">
          <div className="flex-shrink-0 text-3xl">💡</div>
          <div>
            <p className="font-bold text-gray-900 text-lg mb-3">이 차트가 보여주는 것</p>
            <ul className="text-base text-gray-700 space-y-2 ml-0">
              <li>
                <span className="font-bold text-emerald-700">방문:</span> <span className="text-gray-600">랜딩페이지에 도착한 고객</span>
              </li>
              <li>
                <span className="font-bold text-yellow-700">신청:</span> <span className="text-gray-600">신청서를 작성하고 등록한 고객</span>
              </li>
              <li>
                <span className="font-bold text-orange-700">결제진행:</span> <span className="text-gray-600">결제 페이지에 진입한 고객</span>
              </li>
              <li>
                <span className="font-bold text-red-700">구매완료:</span> <span className="text-gray-600">실제로 구매한 고객</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 개선 팁 (50대 친화) */}
      <div className="mt-5 p-5 bg-amber-50 rounded-lg border-2 border-amber-300">
        <p className="text-base text-amber-900 leading-relaxed">
          <span className="font-bold text-lg">💭 개선 팁:</span>
          <br className="sm:hidden" /> 가장 많은 고객이 빠져나가는 단계를 찾아서 그 단계를 개선하면 전체 판매가 늘어납니다.
          <br className="mt-2" />
          예: "신청 → 결제" 단계에서 50%가 빠져나간다면, 결제 페이지를 더 간단하게 만들거나 할부 옵션을 제안하는 것이 도움이 됩니다.
        </p>
      </div>
    </div>
  );
}
