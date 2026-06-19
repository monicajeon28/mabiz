import type { Summary } from '@/types/marketing';

interface FunnelChartProps {
  summary: Summary;
}

export function FunnelChart({ summary }: FunnelChartProps) {
  const steps = [
    {
      label: "방문",
      description: "랜딩페이지 도착",
      value: summary.totalViews,
      color: "from-emerald-500 to-green-600",
      bgColor: "bg-emerald-50"
    },
    {
      label: "신청",
      description: "폼 작성 후 등록",
      value: summary.totalRegistrations,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      label: "결제",
      description: "결제 페이지 진입",
      value: summary.totalFunnelEntered,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      label: "완료",
      description: "구매 성공",
      value: summary.totalPurchased,
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-50"
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
      <h2 className="text-xl font-bold text-gray-900 mb-1">구매 경로</h2>
      <p className="text-base text-gray-600 mb-8">
        고객이 방문해서 구매까지 가는 과정. 각 단계에서 몇 명이 빠져나가는지 확인할 수 있습니다.
      </p>

      {/* 세로형 퍼널 시각화 */}
      <div className="space-y-4">
        {steps.map((step, i) => {
          const widthPercent = (step.value / maxValue) * 100;
          const stat = stats[i];

          return (
            <div key={step.label} className="space-y-2">
              {/* 단계 헤더: 번호 + 이름 */}
              <div className="flex items-baseline gap-3">
                <div className="flex items-baseline gap-2 min-w-max">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-bold text-base text-gray-900">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{step.label}</div>
                    <div className="text-sm text-gray-500">{step.description}</div>
                  </div>
                </div>
                <div className="flex-1" />
                {/* 숫자 (오른쪽 정렬) */}
                <div className="text-right min-w-max">
                  <div className="text-xl font-bold text-gray-900">
                    {step.value.toLocaleString()}명
                  </div>
                  <div className="text-sm font-semibold text-gray-600">
                    {i === 0 ? "100%" : `${stat.rate}% 진입`}
                  </div>
                </div>
              </div>

              {/* 진행 막대 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-14 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${step.color} rounded-lg transition-all flex items-center justify-center`}
                    style={{ width: `${widthPercent}%` }}
                  >
                    {widthPercent > 20 && (
                      <span className="text-white font-semibold text-sm">
                        {Math.round(widthPercent)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 탈락 정보 (1단계 제외) */}
              {i > 0 && stat.dropoff > 0 && (
                <div className={`px-4 py-3 ${step.bgColor} rounded-lg border border-gray-200`}>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">{stat.dropoff.toLocaleString()}명 탈락</span>
                    {" "}
                    <span className="text-gray-600">
                      (이전 단계 대비 {stat.dropoffPercent}%)
                    </span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 해석 가이드 */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex gap-3">
          <div className="flex-shrink-0 text-xl">💡</div>
          <div>
            <p className="font-semibold text-gray-900 text-base mb-2">이 차트가 보여주는 것</p>
            <ul className="text-sm text-gray-700 space-y-1 ml-0">
              <li>
                <span className="font-semibold">방문:</span> 랜딩페이지에 도착한 고객 수
              </li>
              <li>
                <span className="font-semibold">신청:</span> 신청서를 작성하고 등록한 고객 수
              </li>
              <li>
                <span className="font-semibold">결제:</span> 결제 페이지에 진입한 고객 수
              </li>
              <li>
                <span className="font-semibold">완료:</span> 실제로 구매한 고객 수
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 개선 팁 */}
      <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-amber-900">
          <span className="font-semibold">💭 개선 팁:</span> 가장 많은 고객이 빠져나가는 단계를 찾아서
          그 단계를 개선하면 전체 판매가 늘어납니다. 예를 들어 "신청 → 결제" 단계에서 50%가 빠져나간다면,
          결제 페이지를 더 간단하게 만들거나 할부 옵션을 제안하는 것이 도움이 될 수 있습니다.
        </p>
      </div>
    </div>
  );
}
