'use client';

import { useState } from 'react';
import { MessageCircle, ChevronRight } from 'lucide-react';

type SMSVariant = 'family' | 'medical' | 'timing';

interface Day0SMSPreviewProps {
  /** 기본 변형 선택 (default: 'family') */
  defaultVariant?: SMSVariant;
  /** 고객 이름 (개인화용) */
  customerName?: string;
}

/**
 * L10 렌즈 + L7/L9 - Day 0 감정적 마무리 SMS 미리보기
 *
 * 목표: 신청 직후 감정적 commitment를 강화하여 취소율 감소 (목표: -3% 이상)
 *
 * 심리학 기제:
 * 1. 옥시토신 유발 (따뜻함/신뢰): "함께" / "당신의 신뢰" / "가족"
 * 2. 도파민 유발 (기대감/보상): "내일부터 변화" / "100% 준비" / "새로운 경험"
 * 3. 신뢰 강화 (권위성/확신): "의료진 24시간" / "최고 타이밍" / "모든 준비"
 *
 * 3가지 변형:
 * - family: L7 동반자설득 강조 (배우자/가족 함께)
 * - medical: L9 의료신뢰 강조 (의료진 24시간 지원)
 * - timing: L6 손실회피 강조 (최고 타이밍, FOMO)
 */
export function Day0SMSPreview({
  defaultVariant = 'family',
  customerName = '고객님',
}: Day0SMSPreviewProps) {
  const [selectedVariant, setSelectedVariant] = useState<SMSVariant>(defaultVariant);

  const variants: Record<SMSVariant, { title: string; icon: string; message: string; focus: string }> =
    {
      family: {
        title: 'L7 - 동반자설득',
        icon: '👨‍👩‍👧‍👦',
        message: `멤버십 신청 완료! 👨‍👩‍👧‍👦

함께라서 더 강해져요.
당신과 가족의 특별한 시간을 우리가 100% 준비하겠습니다.

의료진도 24시간 대기 중입니다. 💙`,
        focus: '가족의 함께함이 주는 안정감과 신뢰',
      },
      medical: {
        title: 'L9 - 의료신뢰',
        icon: '🏥',
        message: `멤버십 신청 완료! 🏥

의료진이 24시간 지원합니다.
당신의 건강과 안전이 우리의 최우선입니다.

내일부터 변화를 느낄 거예요. ✨`,
        focus: '의료 전문가의 권위성과 안전함',
      },
      timing: {
        title: 'L6 - 손실회피',
        icon: '🎉',
        message: `멤버십 신청 완료! 🎉

이번이 최고의 타이밍이었어요.
내일부터 시작되는 당신의 새로운 경험을 기대하세요.

우리가 모든 준비를 마쳤습니다. 🚀`,
        focus: '시간 제한으로 인한 FOMO와 긴박감',
      },
    };

  const variant = variants[selectedVariant];

  return (
    <div className="bg-gradient-to-b from-blue-50 to-blue-100 rounded-xl p-6 md:p-8 my-8 border border-blue-200">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-lg text-blue-900">
          💬 신청 직후 자동으로 받게 될 메시지
        </h3>
      </div>

      {/* 심리학 설명 */}
      <p className="text-sm text-blue-700 mb-6">
        신청 후 30분 이내에 자동으로 발송되는 감정적 마무리 메시지입니다.
        <br />
        <span className="font-semibold">취소율을 3% 이상 감소시키고 신뢰도를 높입니다.</span>
      </p>

      {/* 변형 선택 버튼 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        {(Object.entries(variants) as Array<[SMSVariant, typeof variants[SMSVariant]]>).map(
          ([key, val]) => (
            <button
              key={key}
              onClick={() => setSelectedVariant(key)}
              className={`flex-1 px-3 py-3 rounded-lg text-sm font-semibold transition-all border-2 ${
                selectedVariant === key
                  ? 'bg-white border-blue-500 text-blue-900 shadow-md'
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <div className="text-lg mb-1">{val.icon}</div>
              <div>{val.title}</div>
            </button>
          )
        )}
      </div>

      {/* SMS 메시지 카드 */}
      <div className="bg-white rounded-lg p-5 mb-6 border border-gray-300 shadow-sm">
        <div className="flex items-start gap-2 mb-4">
          <div className="text-xl">{variant.icon}</div>
          <div className="text-sm font-semibold text-gray-500">자동 발송</div>
        </div>

        {/* 메시지 본문 */}
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line font-medium">
          {variant.message}
        </p>

        {/* 심리학 주석 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            <span className="font-semibold">심리학 포커스:</span> {variant.focus}
          </p>
        </div>
      </div>

      {/* 추가 정보 */}
      <div className="bg-blue-100 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">📝 Day 0 SMS 발송 일정</p>
        <ul className="space-y-1 text-blue-700">
          <li>✓ Day 0 (신청 직후): 감정적 마무리 SMS (위 3가지 중 1개)</li>
          <li>✓ Day 1: Follow-up + 이의 대응</li>
          <li>✓ Day 2: 가치 강조 + 사례 스토리</li>
          <li>✓ Day 3: 긴박감 + 최종 결정 촉구</li>
        </ul>
      </div>
    </div>
  );
}
