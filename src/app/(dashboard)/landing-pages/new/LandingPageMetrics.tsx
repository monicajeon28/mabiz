"use client";

import React from "react";

interface LandingPageMetricsProps {
  format?: string;
  title?: string;
  completionRate: number; // 0-100
}

// 형식별 기대 전환율 (렌즈 L2: 복잡도, L10: 긴박감)
const EXPECTED_CONVERSION_BY_FORMAT: Record<string, { baseline: number; optimized: number; lift: number }> = {
  squeeze: { baseline: 15, optimized: 45, lift: 200 },
  vsl: { baseline: 18, optimized: 52, lift: 189 },
  webinar: { baseline: 12, optimized: 48, lift: 300 },
  funnel: { baseline: 8, optimized: 35, lift: 338 },
  tripwire: { baseline: 25, optimized: 60, lift: 140 },
  downsell: { baseline: 30, optimized: 65, lift: 117 },
  launch: { baseline: 20, optimized: 55, lift: 175 },
  hybrid: { baseline: 22, optimized: 58, lift: 164 },
};

export function LandingPageMetrics({
  format = "squeeze",
  title,
  completionRate,
}: LandingPageMetricsProps) {
  const metrics = EXPECTED_CONVERSION_BY_FORMAT[format];

  // Step 2 완성 후에만 표시 (completionRate === 100)
  if (!metrics || completionRate < 100) {
    return null;
  }

  return (
    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 rounded-lg">
      {/* L2: 복잡도 (시장 기준선 제시) */}
      <div className="mb-4">
        <h4 className="font-bold text-gray-900 mb-2">📊 예상 성과 지표</h4>
        <p className="text-sm text-gray-700">
          이 "{format}" 형식으로는 보통{" "}
          <strong className="text-blue-600">{metrics.baseline}%</strong> 전환율을 기대할 수 있습니다.
        </p>
      </div>

      {/* L10: 긴박감 + 목표 (손실회피 심리학) */}
      <div className="bg-white p-3 rounded border border-blue-200 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">최적화 목표:</span>
          <span className="text-2xl font-bold text-green-600">{metrics.optimized}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-600 to-green-600 h-2 rounded-full"
            style={{ width: `${(metrics.optimized / 100) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          ⚡ <strong>최적화 시 +{metrics.lift}% 성장 가능</strong>
        </p>
      </div>

      {/* L10: Day 3 마감 안내 (긴박감 + 손실회피) */}
      <div className="bg-red-50 p-3 rounded border border-red-200">
        <p className="text-sm text-red-700">
          🔥 <strong>중요:</strong> Day 3 메시지에 "마감 24시간" 안내가 포함됩니다.
          <br />
          정확한 마감일을 설정하세요.
        </p>
      </div>
    </div>
  );
}
