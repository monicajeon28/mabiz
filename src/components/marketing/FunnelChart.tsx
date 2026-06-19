import type { Summary } from '@/types/marketing';

interface FunnelChartProps {
  summary: Summary;
}

export function FunnelChart({ summary }: FunnelChartProps) {
  const steps = [
    {
      label: "랜딩페이지 방문",
      description: "클릭해서 페이지 도착",
      value: summary.totalViews,
      color: "bg-navy-600"
    },
    {
      label: "신청서 제출",
      description: "폼 작성 및 등록",
      value: summary.totalRegistrations,
      color: "bg-blue-500"
    },
    {
      label: "결제페이지 진입",
      description: "신청 후 결제 화면 접속",
      value: summary.totalFunnelEntered,
      color: "bg-blue-400"
    },
    {
      label: "구매 완료",
      description: "결제 성공",
      value: summary.totalPurchased,
      color: "bg-green-500"
    },
  ];

  return (
    <div className="bg-white border rounded-xl p-5 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">구매 경로 분석</h2>
      <p className="text-sm text-gray-600 mb-6">고객들이 방문해서 구매까지 가는 과정을 단계별로 보여줍니다</p>

      {/* 50대 친화: 더 큰 폰트 + 명확한 설명 */}
      <div className="flex items-end gap-3 h-32">
        {steps.map((step, i, arr) => {
          const max = arr[0].value || 1;
          const h = Math.max(4, Math.round(100 * step.value / max));
          const prev = i > 0 ? arr[i - 1].value : step.value;
          const rate = prev > 0 ? Math.round((step.value / prev) * 100) : 0;
          return (
            <div key={step.label} className="flex-1 flex flex-col items-center gap-2">
              {/* 단계 번호 + 숫자 (50대 친화 16px) */}
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Step {i + 1}</div>
                <span className="text-base font-bold text-gray-900">
                  {step.value.toLocaleString()}명
                </span>
              </div>

              {/* 막대 그래프 */}
              <div className="w-full flex items-end justify-center">
                <div
                  className={`w-full ${step.color} rounded-t transition-all`}
                  style={{ height: `${h}px` }}
                  suppressHydrationWarning
                />
              </div>

              {/* 단계명 (50대 친화 14px) */}
              <div className="text-center">
                <span className="text-sm font-medium text-gray-900 block">{step.label}</span>
                <span className="text-xs text-gray-500 block">{step.description}</span>
              </div>

              {/* 전환율 (이전 단계 대비) */}
              {i > 0 && (
                <span className="text-sm font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded">
                  {rate}% 진입
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 50대 친화: 해석 가이드 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-900">
          💡 <strong>어떻게 읽나요?</strong> 첫 번째 단계(방문)에서 마지막 단계(구매)로 갈수록 숫자가 줄어듭니다.
          각 단계의 비율(%)를 높이면 더 많은 고객이 구매까지 가게 됩니다.
        </p>
      </div>
    </div>
  );
}
