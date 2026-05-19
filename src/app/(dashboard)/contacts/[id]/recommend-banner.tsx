/**
 * Contact 상세 페이지 상품 추천 배너
 * 고객 세그먼트 기반 자동 추천 표시
 *
 * Track D 개선사항:
 * - Toast 알림 추가
 * - Framer Motion 애니메이션
 * - 로깅 강화
 * - useMemo 성능 최적화
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { detectSegment } from "@/lib/segment-detector";
import {
  recommendProducts,
  getRecommendationMessage,
} from "@/lib/product-recommender";
import { CRUISE_PRODUCTS } from "@/constants/products";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";

interface RecommendBannerProps {
  age?: number | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
  contactId?: string;
}

export function RecommendBanner({
  age,
  maritalStatus,
  childrenCount,
  contactId = "unknown",
}: RecommendBannerProps) {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(true);

  // 세그먼트 감지 (useMemo로 캐시)
  const segment = useMemo(() => {
    const result = detectSegment({
      age: age ?? 45,
      maritalStatus: maritalStatus && maritalStatus.trim() ? maritalStatus : undefined,
      childrenCount: childrenCount ?? 0,
    });

    logger.log("[RecommendBanner]", {
      action: "detect-segment",
      contactId,
      age,
      maritalStatus,
      childrenCount,
      segment: result,
      status: "success",
    });

    return result;
  }, [age, maritalStatus, childrenCount, contactId]);

  // 추천 상품 (useMemo로 캐시)
  const recommendations = useMemo(() => {
    const recs = recommendProducts(segment);
    logger.log("[RecommendBanner]", {
      action: "fetch-recommendations",
      contactId,
      segment,
      count: recs.length,
      status: "success",
    });
    return recs;
  }, [segment, contactId]);

  const message = useMemo(
    () => getRecommendationMessage(segment),
    [segment]
  );

  // 상품 클릭 핸들러 (useCallback으로 최적화)
  const handleProductClick = useCallback(
    (productCode: string) => {
      toast({
        title: "상품 선택",
        description: `${CRUISE_PRODUCTS[productCode as keyof typeof CRUISE_PRODUCTS]?.name || productCode} 상품이 선택되었습니다.`,
        variant: "success",
      });

      logger.log("[RecommendBanner]", {
        action: "product-click",
        contactId,
        segment,
        productCode,
        status: "success",
      });
    },
    [contactId, segment, toast]
  );

  // 배너 닫기 (useCallback으로 최적화)
  const handleClose = useCallback(() => {
    logger.log("[RecommendBanner]", {
      action: "banner-close",
      contactId,
      segment,
      status: "success",
    });
    setIsVisible(false);
  }, [contactId, segment]);

  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      {segment && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500 shadow-sm"
          role="region"
          aria-label="고객 세그먼트 추천 배너"
        >
          <div className="flex items-start gap-3">
            {/* 아이콘 */}
            <div className="text-2xl flex-shrink-0 mt-1" aria-hidden="true">
              💡
            </div>

            {/* 내용 */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-blue-900 text-sm md:text-base mb-3">
                {message}
              </h3>

              {/* 추천 상품 카드 */}
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, staggerChildren: 0.1 }}
              >
                {recommendations.map((rec, idx) => {
                  const product = CRUISE_PRODUCTS[rec.productCode];
                  const isPrimary = rec.rank === "primary";

                  return (
                    <motion.button
                      key={rec.productCode}
                      type="button"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      aria-label={`${product.name} 추천 (${rec.reason})`}
                      onClick={() => handleProductClick(rec.productCode)}
                      className={`w-full p-3 rounded-lg border transition-all text-left focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        isPrimary
                          ? "bg-blue-500 text-white border-blue-600 shadow-md focus:ring-blue-400"
                          : "bg-white border-gray-300 text-gray-700 focus:ring-blue-500"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-lg flex-shrink-0 mt-0.5" aria-hidden="true">
                          {isPrimary ? "⭐" : "💬"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm md:text-base">
                            {idx === 0 ? "1순위" : "2순위"}: {product.name}
                          </div>
                          <div
                            className={`text-xs md:text-sm mt-1 ${
                              isPrimary ? "text-blue-100" : "text-gray-600"
                            }`}
                          >
                            {rec.reason}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* 설명 텍스트 */}
              <p className="text-xs text-blue-700 mt-3 italic">
                💬 이 추천은 고객의 나이, 결혼 상태, 자녀 수를 기반으로 자동 생성되었습니다.
                세그먼트는 직접 수정할 수 있습니다.
              </p>
            </div>

            {/* 닫기 버튼 */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClose}
              aria-label="배너 닫기"
              className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors p-1"
            >
              ✕
            </motion.button>
          </div>
        </motion.div>
      )}

      {!segment && isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl flex-shrink-0 mt-1" aria-hidden="true">
              ⚠️
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900 text-sm">세그먼트 감지 불가</h3>
              <p className="text-xs text-yellow-700 mt-1">
                고객 정보(나이, 결혼상태, 자녀 수)를 입력하면 맞춤형 추천을 받을 수 있습니다.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClose}
              aria-label="배너 닫기"
              className="flex-shrink-0 text-yellow-400 hover:text-yellow-600 transition-colors p-1"
            >
              ✕
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
