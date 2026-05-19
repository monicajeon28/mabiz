"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CRUISE_PRODUCTS,
  SEGMENT_COLORS,
  PASONA_COLORS,
  ProductCode,
} from "@/constants/products";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";

type ObjectionState = Record<string, boolean>;

export default function TrainingPage() {
  const { toast } = useToast();
  const productCodes = useMemo(
    () => Object.keys(CRUISE_PRODUCTS) as ProductCode[],
    []
  );
  const [activeProduct, setActiveProduct] = useState<ProductCode>("GOLD_MEMBERSHIP");
  const [objectionStates, setObjectionStates] = useState<ObjectionState>({});

  const product = CRUISE_PRODUCTS[activeProduct];

  // useCallback으로 최적화
  const handleTabChange = useCallback((code: ProductCode) => {
    setActiveProduct(code);
    setObjectionStates({});

    toast({
      title: "교육 탭 변경",
      description: `${CRUISE_PRODUCTS[code].name}로 전환했습니다.`,
      variant: "default",
    });

    logger.log("[TrainingPage]", {
      action: "tab-change",
      product: code,
      status: "success",
    });
  }, [toast]);

  const toggleObjection = useCallback((index: number) => {
    const key = `${activeProduct}-${index}`;
    setObjectionStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

    const objection = CRUISE_PRODUCTS[activeProduct].topObjections[index];
    const newState = !objectionStates[key];

    logger.log("[TrainingPage]", {
      action: "objection-toggle",
      product: activeProduct,
      objectionIndex: index,
      isOpen: newState,
      status: "success",
    });

    if (newState) {
      toast({
        title: "대응 방법",
        description: objection.objection,
        variant: "default",
      });
    }
  }, [activeProduct, objectionStates, toast]);

  const isObjectionOpen = useCallback((index: number) => {
    return objectionStates[`${activeProduct}-${index}`] || false;
  }, [objectionStates, activeProduct]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          상품 교육 센터
        </h1>
        <p className="text-gray-600 text-sm md:text-base mt-2">
          5개 상품의 PASONA 프레임워크, 추천 대상, 자주 나오는 거절 대응을 확인하세요.
        </p>
      </div>

      {/* 상품 탭 네비게이션 */}
      <div className="mb-8 overflow-x-auto">
        <div className="flex gap-2 pb-2 md:pb-0 flex-nowrap md:flex-wrap">
          {productCodes.map((code) => (
            <motion.button
              key={code}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTabChange(code)}
              className={`px-4 py-3 rounded-lg font-medium text-sm md:text-base whitespace-nowrap transition-all ${
                activeProduct === code
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {CRUISE_PRODUCTS[code].name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 상품 상세 컨텐츠 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeProduct}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
        {/* 1. 상품 소개 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                {product.name}
              </h2>
              <p className="text-lg text-gray-600 mt-2 italic">{product.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-sm md:text-base text-gray-500 font-medium">
                가격: 문의 필요
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {product.type === "subscription" ? "구독형" : "1회 구매"}
              </p>
            </div>
          </div>
          <p className="text-gray-700 text-base md:text-lg leading-relaxed">
            {product.description}
          </p>

          {/* 주요 기능 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-900 mb-3">주요 기능</p>
            <div className="flex flex-wrap gap-2">
              {product.features.map((feature, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                >
                  ✓ {feature}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 2. 추천 대상 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">추천 대상</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(["A", "B", "C", "D", "E"] as const).map((segment) => {
              const isRecommended = product.recommendedSegments.some(s => s === segment);
              const colors = SEGMENT_COLORS[segment];
              return (
                <div
                  key={segment}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isRecommended
                      ? `${colors.bg} ${colors.border} border-2`
                      : "bg-gray-100 border-gray-300 opacity-50"
                  }`}
                >
                  <p className={`text-center font-bold text-lg ${isRecommended ? colors.text : "text-gray-500"}`}>
                    {segment}
                  </p>
                  {isRecommended && (
                    <div className="text-center mt-2">
                      <span className="inline-block px-2 py-1 bg-white rounded text-xs font-semibold text-green-700">
                        추천
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. PASONA 프레임워크 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">PASONA 판매 프레임워크</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {[
              { key: "problem", value: product.pasona.problem },
              { key: "affinity", value: product.pasona.affinity },
              { key: "solution", value: product.pasona.solution },
              { key: "offer", value: product.pasona.offer },
            ].map(({ key, value }) => {
              const colors = PASONA_COLORS[key as keyof typeof PASONA_COLORS];
              return (
                <div
                  key={key}
                  className={`${colors.bg} ${colors.accent} p-4 md:p-6 rounded-lg`}
                >
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                    {colors.emoji} {colors.label}
                  </p>
                  <p className="text-gray-900 font-medium text-sm md:text-base leading-relaxed">
                    {value}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. 자주 나오는 거절과 대응 */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            자주 나오는 거절 & 대응 스크립트
          </h2>
          <motion.div className="space-y-4">
            {product.topObjections.map((objection, idx) => (
              <motion.div
                key={idx}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* 거절 헤더 (항상 표시) */}
                <motion.button
                  whileHover={{ backgroundColor: "rgba(254, 226, 226, 1)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleObjection(idx)}
                  className="w-full p-4 md:p-5 bg-gradient-to-r from-red-50 to-red-100 text-left transition-colors flex items-start justify-between"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-xl mt-1 flex-shrink-0">❌</span>
                    <p className="text-gray-900 font-semibold text-sm md:text-base">
                      {objection.objection}
                    </p>
                  </div>
                  <motion.span
                    animate={{ rotate: isObjectionOpen(idx) ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl flex-shrink-0 ml-2"
                  >
                    ▼
                  </motion.span>
                </motion.button>

                {/* 대응 (토글 시 표시) */}
                <AnimatePresence>
                  {isObjectionOpen(idx) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="p-4 md:p-5 bg-green-50 border-t border-green-200"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl flex-shrink-0">✅</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">
                            추천 대응
                          </p>
                          <p className="text-gray-900 text-sm md:text-base leading-relaxed">
                            {objection.response}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* 5. CTA 버튼 */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              toast({
                title: "구매 페이지로 이동",
                description: `${CRUISE_PRODUCTS[activeProduct].name} 구매를 시작합니다.`,
                variant: "default",
              });
              logger.log("[TrainingPage]", {
                action: "cta-purchase",
                product: activeProduct,
                status: "success",
              });
            }}
            className="px-6 md:px-8 py-3 md:py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base"
          >
            지금 구매하기
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              toast({
                title: "더 알아보기",
                description: `${CRUISE_PRODUCTS[activeProduct].name}의 상세 정보를 확인하세요.`,
                variant: "default",
              });
              logger.log("[TrainingPage]", {
                action: "cta-learn-more",
                product: activeProduct,
                status: "success",
              });
            }}
            className="px-6 md:px-8 py-3 md:py-4 bg-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm md:text-base"
          >
            더 알아보기
          </motion.button>
        </motion.section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
