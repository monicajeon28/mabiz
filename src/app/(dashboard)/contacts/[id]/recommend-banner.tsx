/**
 * Contact 상세 페이지 상품 추천 배너
 * 고객 세그먼트 기반 자동 추천 표시
 */

"use client";

import { detectSegment } from "@/lib/segment-detector";
import {
  recommendProducts,
  getRecommendationMessage,
  RECOMMENDATION_COLORS,
} from "@/lib/product-recommender";
import { CRUISE_PRODUCTS } from "@/constants/products";

interface RecommendBannerProps {
  age?: number | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
}

export function RecommendBanner({
  age,
  maritalStatus,
  childrenCount,
}: RecommendBannerProps) {
  // 세그먼트 자동 감지
  // 빈 문자열 명시적 처리 (segment-detector에서도 정규화됨)
  const segment = detectSegment({
    age: age ?? 45,
    maritalStatus: maritalStatus && maritalStatus.trim() ? maritalStatus : undefined,
    childrenCount: childrenCount ?? 0,
  });

  if (!segment) {
    // 세그먼트 감지 실패 시 기본 UI 표시
    return (
      <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0 mt-1">⚠️</div>
          <div className="flex-1">
            <h3 className="font-bold text-yellow-900 text-sm">세그먼트 감지 불가</h3>
            <p className="text-xs text-yellow-700 mt-1">
              고객 정보(나이, 결혼상태, 자녀 수)를 입력하면 맞춤형 추천을 받을 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const recommendations = recommendProducts(segment);
  const message = getRecommendationMessage(segment);

  return (
    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500 shadow-sm">
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <div className="text-2xl flex-shrink-0 mt-1">💡</div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-blue-900 text-sm md:text-base mb-3">
            {message}
          </h3>

          {/* 추천 상품 카드 */}
          <div className="space-y-2">
            {recommendations.map((rec, idx) => {
              const product = CRUISE_PRODUCTS[rec.productCode];
              const isPrimary = rec.rank === "primary";

              return (
                <button
                  key={rec.productCode}
                  type="button"
                  aria-label={`${product.name} 추천 (${rec.reason})`}
                  className={`w-full p-3 rounded-lg border transition-all text-left focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isPrimary
                      ? "bg-blue-500 text-white border-blue-600 shadow-md focus:ring-blue-400"
                      : "bg-white border-gray-300 text-gray-700 focus:ring-blue-500"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="text-lg flex-shrink-0 mt-0.5">
                      {isPrimary ? "⭐" : "💬"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm md:text-base">
                        {idx === 0 ? "1순위" : "2순위"}: {product.name}
                      </div>
                      <div className={`text-xs md:text-sm mt-1 ${isPrimary ? "text-blue-100" : "text-gray-600"}`}>
                        {rec.reason}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 설명 텍스트 */}
          <p className="text-xs text-blue-700 mt-3 italic">
            💬 이 추천은 고객의 나이, 결혼 상태, 자녀 수를 기반으로 자동 생성되었습니다.
            세그먼트는 직접 수정할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
