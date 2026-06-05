"use client";

interface SMSSequencePreviewProps {
  category: string;
  segment: string;
}

const SMS_SEQUENCE_MAP: Record<string, any> = {
  healthcare: {
    Day_0: {
      title: "Day 0: 기대감 형성",
      preview: "안녕하세요 모니카님! 아까 얘기 나눴던 건강관리 프로그램 소개해드릴게요",
      icon: "🚀",
      targetRate: 80,
    },
    Day_1: {
      title: "Day 1: 솔루션 간단성",
      preview: "건강검진을 앞두고 복잡하지 않을까? 걱정하시나요? 전혀 복잡하지 않아요!",
      icon: "✨",
      targetRate: 65,
    },
    Day_2: {
      title: "Day 2: 신뢰감 강화",
      preview: "나이 비슷한 분들의 성공사례를 소개합니다. 신혼부부, 자녀있는가정, 시니어",
      icon: "📈",
      targetRate: 52,
    },
    Day_3: {
      title: "Day 3: 배움의 가치",
      preview: "지난 3일 동안 건강관리 진짜 필요하긴 한데... 이렇게 생각했을 것 같아요",
      icon: "🎯",
      targetRate: 45,
    },
  },
  rental: {
    Day_0: {
      title: "Day 0: 단순성 강조",
      preview: "너무 복잡하게 생각하지 마세요. 정말 간단해요: 앱에서 신청(2분)",
      icon: "📱",
      targetRate: 80,
    },
    Day_1: {
      title: "Day 1: 가격 효율성",
      preview: "월 4만원으로 비용 효율적인 렌탈. 50% 할인 첫 달",
      icon: "💰",
      targetRate: 50,
    },
    Day_2: {
      title: "Day 2: 위험 제거",
      preview: "언제든 취소 가능, 위약금 0원, 환불 3일 안에 처리",
      icon: "🛡️",
      targetRate: 40,
    },
    Day_3: {
      title: "Day 3: 긴급성",
      preview: "첫 달 100% 무료 + 배송비 0원 오늘까지만",
      icon: "⏰",
      targetRate: 18,
    },
  },
  product_new_db: {
    Day_0: {
      title: "Day 0: 신뢰감",
      preview: "LG 전자와 함께 만든 상품. 100,000+ 사용자, 4.8/5.0 평점",
      icon: "🏆",
      targetRate: 75,
    },
    Day_1: {
      title: "Day 1: 사회적 증명",
      preview: "실제 고객 후기: 2주 후 변화 감지, 1개월 확실한 변화",
      icon: "⭐",
      targetRate: 55,
    },
    Day_2: {
      title: "Day 2: 간단함",
      preview: "사용법: Step 1) 상자 열기, 2) 5분 준비, 3) 사용 시작",
      icon: "✅",
      targetRate: 45,
    },
    Day_3: {
      title: "Day 3: 희소성",
      preview: "신규가격 2.5만원 (50% 할인) 오늘까지 자정",
      icon: "🔴",
      targetRate: 42,
    },
  },
  product_inactive_db: {
    Day_0: {
      title: "Day 0: 환영 + 업그레이드",
      preview: "모니카님을 위해 준비했어요! LG 전자와 함께 개발한 v2.0",
      icon: "🎉",
      targetRate: 85,
    },
    Day_1: {
      title: "Day 1: 개선사항",
      preview: "v2.0 무엇이 달라졌을까요? 효과 기간 4주→2주, 사용감 50% 개선",
      icon: "📊",
      targetRate: 60,
    },
    Day_2: {
      title: "Day 2: 특별 가격",
      preview: "기존 고객만의 특별 가격: 일반가 5만원 → 특가 2.5만원 (50%)",
      icon: "💝",
      targetRate: 55,
    },
    Day_3: {
      title: "Day 3: 긴급 오퍼",
      preview: "오늘까지만 v2.0 특가 2.5만원 + 추가 1개 20% + 무료배송",
      icon: "⚡",
      targetRate: 32,
    },
  },
};

export function SMSSequencePreview({ category, segment }: SMSSequencePreviewProps) {
  const sequence = SMS_SEQUENCE_MAP[category];
  const days = sequence
    ? Object.entries(sequence)
        .filter(([key]) => key.startsWith("Day_"))
        .map(([_, value]) => value)
    : [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">📧 SMS 3일 시퀀스</h3>
      {days.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          이 카테고리의 SMS 시퀀스가 아직 준비되지 않았습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {days.map((day: any, idx: number) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{day.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{day.title}</div>
                  <div className="text-sm text-gray-600">목표 오픈: {day.targetRate}%</div>
                </div>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2">{day.preview}</p>
            </div>
          ))}
        </div>
      )}
      {/* 전체 보기 링크 — /docs 라우트 미구현 상태이므로 비활성 표시 */}
      <span className="mt-3 block text-center px-3 py-2 text-sm text-gray-400 cursor-not-allowed select-none">
        전체 보기 (준비 중)
      </span>
    </div>
  );
}
