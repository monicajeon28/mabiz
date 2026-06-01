'use client';

import { Shield, Heart, Users, Award, Clock } from 'lucide-react';

interface TrustBadgeProps {
  /** 그룹 이름 (사용자화용) */
  groupName?: string;
}

/**
 * L7 (동반자설득) + L9 (의료신뢰) 신뢰 배지 섹션
 *
 * 심리학 원리:
 * 1. Authority (권위성): 의료진 자격, 인증서
 * 2. Social Proof (사회증명): 기존 고객 수, 만족도
 * 3. Reciprocity (상호성): "우리가 준비하겠습니다"
 *
 * 효과:
 * - L7: "함께라서 더 강해져요" → 감정적 연결
 * - L9: "의료진 24시간 지원" → 불안감 제거
 */
export function TrustBadge({ groupName = '크루즈닷' }: TrustBadgeProps) {
  return (
    <div className="my-8 space-y-6">
      {/* L7: 동반자설득 섹션 */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Users className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-lg text-purple-900 mb-2">
              👨‍👩‍👧‍👦 함께라서 더 강해져요
            </h4>
            <p className="text-sm text-purple-800 mb-3">
              배우자, 친구, 자녀와 함께라서 더 안전하고, 더 즐겁고, 더 강해져요.
              <br />
              <span className="font-semibold">혼자가 아닙니다. 우리가 함께합니다.</span>
            </p>
            <ul className="space-y-2 text-sm text-purple-700">
              <li>✓ 다양한 연령대 그룹 시너지</li>
              <li>✓ 동료 지지 커뮤니티</li>
              <li>✓ 객실에서 함께하는 특별한 순간들</li>
            </ul>
          </div>
        </div>
      </div>

      {/* L9: 의료신뢰 섹션 */}
      <div className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-lg text-blue-900 mb-2">
              🏥 의료진이 24시간 지원합니다
            </h4>
            <p className="text-sm text-blue-800 mb-3">
              당신의 건강과 안전은 우리의 최우선입니다.
              <br />
              <span className="font-semibold">
                배멀미, 고혈압, 당뇨병 - 모든 응급 상황을 배 위에서 처리합니다.
              </span>
            </p>

            {/* 의료진 자격 증명 */}
            <div className="bg-white rounded-lg p-3 mb-3 border border-blue-100">
              <p className="text-sm font-semibold text-blue-900 mb-2">🎓 의료진 자격 증명</p>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>
                  • <span className="font-semibold">대학병원 응급의학 전문의</span> (5년
                  이상 경력)
                </li>
                <li>• 한국 크루즈 협회 의료 승인</li>
                <li>• 건강보험심사평가원 공식 의료 프로그램</li>
              </ul>
            </div>

            <ul className="space-y-2 text-sm text-blue-700">
              <li>✓ 의료진 감시 시스템 (24시간 응급 대응)</li>
              <li>✓ 응급 의료 장비 완비</li>
              <li>✓ 해상 응급 의료 프로토콜 준비</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 사회증명: 기존 고객 수 + 만족도 */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* 통계 1: 멤버 수 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-navy-900">2,000+</div>
          <p className="text-sm text-gray-600 mt-2">활성 멤버들이 함께하고 있습니다</p>
        </div>

        {/* 통계 2: 만족도 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-2xl">⭐</span>
            <span className="text-3xl font-bold text-amber-600">4.8</span>
          </div>
          <p className="text-sm text-gray-600">5.0 만점</p>
        </div>

        {/* 통계 3: 만족도 비율 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">98%</div>
          <p className="text-sm text-gray-600 mt-2">고객 만족도</p>
        </div>
      </div>

      {/* 최종 신뢰 메시지 */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 text-center">
        <Heart className="w-5 h-5 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-green-900">
          당신의 신뢰와 건강이 우리의 책임입니다.
        </p>
        <p className="text-sm text-green-700 mt-2">
          {groupName} 프리미엄 멤버십으로 안심하고 시작하세요.
        </p>
      </div>
    </div>
  );
}
