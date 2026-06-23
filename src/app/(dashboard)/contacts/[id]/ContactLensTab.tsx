"use client";

/**
 * ContactLensTab — 심리렌즈 L0-L10 표시
 * - 주요 렌즈 1개 + 차순위 3개 표시
 * - 컴팩트 버전 (높이 200px)
 * - 각 렌즈: 이름 + 설명 + 점수 진행바
 */

import React from "react";
import { Contact } from "@/types/contact";

// 기본 여행 고객용 렌즈 정보
const LENS_INFO_DEFAULT = [
  { id: "L0", name: "부재중 고객", description: "3-6/6-12/1년+ 미접촉" },
  { id: "L1", name: "가격 민감도", description: "할부/할인 관심" },
  { id: "L2", name: "준비 복잡도", description: "서류·예약 우려" },
  { id: "L3", name: "경쟁사 비교", description: "다른 회사와 비교 중" },
  { id: "L4", name: "가족 설득", description: "배우자·자녀 동의 필요" },
  { id: "L5", name: "자기투영", description: "본인 경험치 강조" },
  { id: "L6", name: "타이밍·손실", description: "지금 안 사면 후회 심함" },
  { id: "L7", name: "동반자·가족", description: "함께할 사람 중요" },
  { id: "L8", name: "재구매·습관", description: "과거 이용 경험 있음" },
  { id: "L9", name: "건강·안전", description: "의료·건강 신뢰도 중요" },
  { id: "L10", name: "즉시 구매", description: "지금 바로 결정하려 함" },
];

// 교육 고객용 렌즈 정보 (강사 신뢰도, 커뮤니티, 자기개발 강조)
const LENS_INFO_EDUCATION = [
  { id: "L0", name: "학습 준비도", description: "수강 준비 완료 여부" },
  { id: "L1", name: "비용 효율성", description: "가격 대비 가치 인식" },
  { id: "L2", name: "커리큘럼 난이도", description: "난이도 우려/적응도" },
  { id: "L3", name: "경쟁 학원 비교", description: "다른 학원과 비교 중" },
  { id: "L4", name: "부모 설득", description: "부모 동의·지원 필요" },
  { id: "L5", name: "강사 경험·신뢰", description: "강사 경력·성공률 중요" },
  { id: "L6", name: "수강 시간·기간", description: "시간 제약·마감일 촉박" },
  { id: "L7", name: "커뮤니티·동료", description: "함께할 학생들 중요" },
  { id: "L8", name: "재수강·습관", description: "과거 학습 경험 있음" },
  { id: "L9", name: "성적 향상 신뢰", description: "성적 보장·신뢰도 중요" },
  { id: "L10", name: "지금 등록 결정", description: "현재 기수 신청 의사" },
];

// 골드 회원용 렌즈 정보 (VIP 경험, 신뢰도, 시간 민감도 강조)
const LENS_INFO_GOLD = [
  { id: "L0", name: "VIP 경험 기대", description: "프리미엄 서비스 경험" },
  { id: "L1", name: "프리미엄 가격", description: "고가 상품 구매력 있음" },
  { id: "L2", name: "VIP 신청 절차", description: "간편한 프로세스 원함" },
  { id: "L3", name: "프리미엄 경쟁사", description: "고급 경쟁사와 비교 중" },
  { id: "L4", name: "가족 공동 여행", description: "가족 전체 포함 계획" },
  { id: "L5", name: "개인맞춤 서비스", description: "맞춤형 옵션 선호" },
  { id: "L6", name: "시간 민감도", description: "명사 마감·한정 기간" },
  { id: "L7", name: "VIP 네트워크", description: "상위층 사람들과의 연결" },
  { id: "L8", name: "재방문·특전", description: "VIP 전용 특전·혜택" },
  { id: "L9", name: "서비스 신뢰도", description: "브랜드 신뢰·품질 보장" },
  { id: "L10", name: "VIP 즉시 승격", description: "지금 바로 VIP 전환" },
];

/**
 * 고객 유형별 렌즈 정보 선택 함수
 */
function getLensInfoByType(sourceType?: string | null): typeof LENS_INFO_DEFAULT {
  switch (sourceType) {
    case 'education':
      return LENS_INFO_EDUCATION;
    case 'gold_member':
      return LENS_INFO_GOLD;
    default:
      return LENS_INFO_DEFAULT;
  }
}

export default function ContactLensTab({ contact }: { contact: Contact }) {
  // lensInfo가 없으면 빈 객체 사용
  const lensScores = contact.lensInfo || {};

  // 고객 유형별 렌즈 정보 선택
  const lensInfo = getLensInfoByType(contact.sourceType);

  // 모든 렌즈 점수를 배열로 변환 후 정렬
  const sortedLenses = lensInfo
    .map(lens => ({
      ...lens,
      score: lensScores[lens.id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  // 상위 4개만 표시 (주요 1개 + 차순위 3개)
  const topLenses = sortedLenses.slice(0, 4);

  // 고객 유형별 타이틀
  const typeLabel = contact.sourceType === 'education' ? '교육 고객 특화' : contact.sourceType === 'gold_member' ? 'VIP 특화' : '여행 고객';

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
