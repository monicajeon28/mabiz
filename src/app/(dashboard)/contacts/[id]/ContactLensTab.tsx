"use client";

/**
 * ContactLensTab — 심리렌즈 L0-L10 표시
 * - 주요 렌즈 1개 + 차순위 3개 표시
 * - 컴팩트 버전 (높이 200px)
 * - 각 렌즈: 이름 + 설명 + 점수 진행바
 */

import React, { useMemo } from "react";
import { Contact } from "@/types/contact";
import { SOURCE_TYPES, normalizeSourceType } from "@/constants/source-types";

/**
 * 렌즈 정보 - 각 렌즈의 기본 구조 + 고객유형별 변형
 * 렌즈 ID: L0-L10 (11개)
 * DRY: 타입별 이름/설명만 다르고 ID는 공통
 */
const LENS_VARIANTS = {
  L0: {
    default: { name: "부재중 고객", description: "3-6/6-12/1년+ 미접촉" },
    education: { name: "학습 준비도", description: "수강 준비 완료 여부" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "VIP 경험 기대", description: "프리미엄 서비스 경험" },
  },
  L1: {
    default: { name: "가격 민감도", description: "할부/할인 관심" },
    education: { name: "비용 효율성", description: "가격 대비 가치 인식" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "프리미엄 가격", description: "고가 상품 구매력 있음" },
  },
  L2: {
    default: { name: "준비 복잡도", description: "서류·예약 우려" },
    education: { name: "커리큘럼 난이도", description: "난이도 우려/적응도" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "VIP 신청 절차", description: "간편한 프로세스 원함" },
  },
  L3: {
    default: { name: "경쟁사 비교", description: "다른 회사와 비교 중" },
    education: { name: "경쟁 학원 비교", description: "다른 학원과 비교 중" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "프리미엄 경쟁사", description: "고급 경쟁사와 비교 중" },
  },
  L4: {
    default: { name: "가족 설득", description: "배우자·자녀 동의 필요" },
    education: { name: "부모 설득", description: "부모 동의·지원 필요" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "가족 공동 여행", description: "가족 전체 포함 계획" },
  },
  L5: {
    default: { name: "자기투영", description: "본인 경험치 강조" },
    education: { name: "강사 경험·신뢰", description: "강사 경력·성공률 중요" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "개인맞춤 서비스", description: "맞춤형 옵션 선호" },
  },
  L6: {
    default: { name: "타이밍·손실", description: "지금 안 사면 후회 심함" },
    education: { name: "수강 시간·기간", description: "시간 제약·마감일 촉박" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "시간 민감도", description: "명사 마감·한정 기간" },
  },
  L7: {
    default: { name: "동반자·가족", description: "함께할 사람 중요" },
    education: { name: "커뮤니티·동료", description: "함께할 학생들 중요" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "VIP 네트워크", description: "상위층 사람들과의 연결" },
  },
  L8: {
    default: { name: "재구매·습관", description: "과거 이용 경험 있음" },
    education: { name: "재수강·습관", description: "과거 학습 경험 있음" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "재방문·특전", description: "VIP 전용 특전·혜택" },
  },
  L9: {
    default: { name: "건강·안전", description: "의료·건강 신뢰도 중요" },
    education: { name: "성적 향상 신뢰", description: "성적 보장·신뢰도 중요" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "서비스 신뢰도", description: "브랜드 신뢰·품질 보장" },
  },
  L10: {
    default: { name: "즉시 구매", description: "지금 바로 결정하려 함" },
    education: { name: "지금 등록 결정", description: "현재 기수 신청 의사" },
    [SOURCE_TYPES.GOLD_MEMBER]: { name: "VIP 즉시 승격", description: "지금 바로 VIP 전환" },
  },
} as const;

/**
 * 렌즈 ID 목록 (L0-L10)
 */
const LENS_IDS = ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"] as const;

/**
 * 고객 유형별 렌즈 정보 배열 생성
 * @param sourceType - 고객 유형 (default | education | gold_member)
 * @returns 렌즈 배열 [{id, name, description}, ...]
 */
function getLensInfoByType(sourceType?: string | null) {
  const normalized = (normalizeSourceType(sourceType) ?? "default") as keyof typeof LENS_VARIANTS.L0;

  // normalized가 유효한 타입인지 확인
  const isValidType = normalized === "default" || normalized === SOURCE_TYPES.EDUCATION || normalized === SOURCE_TYPES.GOLD_MEMBER;
  const type = isValidType ? normalized : "default";

  return LENS_IDS.map((lensId) => ({
    id: lensId,
    ...LENS_VARIANTS[lensId][type],
  }));
}

export default function ContactLensTab({ contact }: { contact: Contact }) {
  // 고객 유형별 렌즈 정보 선택
  const lensInfo = getLensInfoByType(contact.sourceType);

  // useMemo로 렌즈 정렬 최적화 (P1: 성능 개선)
  // 의존성: contact.lensInfo (DB 점수), contact.sourceType (렌즈 배열 결정)
  const topLenses = useMemo(() => {
    // lensInfo가 없으면 빈 객체 사용
    const lensScores = contact.lensInfo || {};
    const sortedLenses = lensInfo
      .map(lens => ({
        ...lens,
        score: lensScores[lens.id] ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    // 상위 4개만 표시 (주요 1개 + 차순위 3개)
    return sortedLenses.slice(0, 4);
  }, [contact.lensInfo, contact.sourceType]);

  // 고객 유형별 타이틀
  const normalized = normalizeSourceType(contact.sourceType);
  const typeLabel = normalized === SOURCE_TYPES.EDUCATION ? '교육 고객 특화' : normalized === SOURCE_TYPES.GOLD_MEMBER ? 'VIP 특화' : '여행 고객';

  return (
    <div className="space-y-3">
      {topLenses.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          아직 심리렌즈 데이터가 없습니다.
        </p>
      ) : (
        topLenses.map((lens, idx) => (
          <div
            key={lens.id}
            className="bg-white border border-gray-200 rounded-lg p-3"
          >
            {/* 헤더: 순위 + 이름 */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {idx === 0 ? (
                    <span className="text-lg font-bold text-amber-500">⭐</span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">
                      #{idx + 1}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-900">
                    {lens.name}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {lens.description}
                </p>
              </div>
              {/* 점수 표시 */}
              <div className="text-right">
                <p className="text-sm font-bold text-blue-600">
                  {lens.score}
                </p>
                <p className="text-xs text-gray-400">/100</p>
              </div>
            </div>

            {/* 진행바 */}
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(2, lens.score)}%` }}
              />
            </div>
          </div>
        ))
      )}

      {/* 하단 안내 */}
      {topLenses.length > 0 && (
        <div className="pt-2 border-t border-gray-100 space-y-1">
          <p className="text-xs text-gray-400 text-center">
            상위 4개 심리렌즈 표시 (⭐ 가장 높은 점수)
          </p>
          <p className="text-xs text-blue-600 text-center font-medium">
            {typeLabel}
          </p>
        </div>
      )}
    </div>
  );
}
