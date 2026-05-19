'use client';

import { DefaultMessages } from '@/hooks/useDeltaWizard';

/**
 * MessageSelector Component
 * Delta SMS 마법사의 Step 2 - 메시지 내용 선택 및 입력
 *
 * 두 가지 모드:
 * 1. "기본값 사용" - 미리 작성된 메시지 사용 (읽기전용)
 * 2. "직접 입력" - 사용자가 직접 메시지 입력
 */

interface MessageSelectorProps {
  triggerType: 'PURCHASE' | 'ABANDONED';
  useDefault: boolean;
  onToggleDefault: () => void;
  messages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
  onMessageChange: (day: 'day0' | 'day1' | 'day2' | 'day3', content: string) => void;
  defaultMessages: DefaultMessages;
}

export default function MessageSelector({
  triggerType,
  useDefault,
  onToggleDefault,
  messages,
  onMessageChange,
  defaultMessages,
}: MessageSelectorProps) {
  // 각 Day별 최대 글자수
  const charLimits = {
    day0: 90,
    day1: 160,
    day2: 160,
    day3: 160,
  };

  type DayKey = 'day0' | 'day1' | 'day2' | 'day3';
  const days: { key: DayKey; label: string; icon: string }[] = [
    { key: 'day0', label: 'Day 0: 구매 직후', icon: '📲' },
    { key: 'day1', label: 'Day 1: +1일', icon: '📤' },
    { key: 'day2', label: 'Day 2: +2일', icon: '⏰' },
    { key: 'day3', label: 'Day 3: +3일', icon: '🚨' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-semibold">Step 2: 메시지 설정</h2>
        <p className="text-sm text-gray-600 mt-1">4일에 걸쳐 발송할 메시지 내용을 선택하거나 입력하세요.</p>
      </div>

      {/* 모드 선택 라디오 */}
      <div className="space-y-3 border-b pb-6">
        {/* Mode 1: 기본값 사용 */}
        <label className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition ${
          useDefault
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 bg-white hover:bg-gray-50'
        }`}>
          <input
            type="radio"
            name="messageMode"
            checked={useDefault}
            onChange={onToggleDefault}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-900">기본값 사용 (추천)</p>
            <p className="text-sm text-gray-600 mt-1">
              심리학 기반으로 최적화된 기본 메시지를 사용합니다. 변경 없이 바로 사용 가능합니다.
            </p>
            <span className="inline-block mt-2 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded">
              ⭐ 추천
            </span>
          </div>
        </label>

        {/* Mode 2: 직접 입력 */}
        <label className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition ${
          !useDefault
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-white hover:bg-gray-50'
        }`}>
          <input
            type="radio"
            name="messageMode"
            checked={!useDefault}
            onChange={onToggleDefault}
            className="mt-1 w-4 h-4 cursor-pointer"
          />
          <div className="flex-1">
            <p className="font-medium text-gray-900">직접 입력</p>
            <p className="text-sm text-gray-600 mt-1">
              각 Day별로 메시지를 직접 작성하여 커스터마이징할 수 있습니다.
            </p>
          </div>
        </label>
      </div>

      {/* 메시지 입력 영역 */}
      <div className="space-y-5">
        {days.map(({ key, label, icon }) => {
          const charLimit = charLimits[key];
          const currentLength = useDefault ? defaultMessages[key].length : messages[key].length;
          const displayText = useDefault ? defaultMessages[key] : messages[key];
          const isDay3 = key === 'day3';

          // Day 3는 선택사항 표시 (현재는 필수)
          const isBadgeRequired = isDay3;

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className="font-medium text-gray-900">{label}</span>
                  {isBadgeRequired && (
                    <span className="inline-block bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded">
                      ✅ 필수
                    </span>
                  )}
                </label>
                <span className="text-xs text-gray-500">
                  {currentLength}/{charLimit}
                </span>
              </div>

              {useDefault ? (
                // 기본값 모드: 읽기전용 표시
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 font-mono break-words whitespace-pre-wrap">
                  {displayText}
                </div>
              ) : (
                // 직접입력 모드: Textarea
                <textarea
                  value={displayText}
                  onChange={(e) => onMessageChange(key, e.target.value)}
                  maxLength={charLimit}
                  rows={key === 'day0' ? 2 : 3}
                  placeholder={`Day ${parseInt(key.replace('day', ''))} 메시지를 입력하세요...`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                />
              )}

              {/* 글자수 경고 */}
              {currentLength > charLimit * 0.8 && (
                <p className="text-xs text-amber-600">
                  ⚠️ {charLimit - currentLength}자 남음 (초과 시 LMS로 전환)
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* 도움말 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <div>
          <h3 className="font-medium text-sm text-blue-900">📝 메시지 작성 가이드</h3>
          <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
            <li>
              <strong>Day 0:</strong> 구매 직후 (문제 인식 + 간편성 강조) - 최대 90자
            </li>
            <li>
              <strong>Day 1:</strong> +1일 (사회적 증거 + 구체적 수치) - 최대 160자
            </li>
            <li>
              <strong>Day 2:</strong> +2일 (긴급성 + 희소성 + 보상) - 최대 160자
            </li>
            <li>
              <strong>Day 3:</strong> +3일 (최종 긴급성 + 손실회피) - 최대 160자
            </li>
          </ul>
        </div>
        <div className="pt-2 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            💡 기본값 사용 시 이미 최적화된 심리학 기반 메시지가 적용되므로, 경험이 없다면 추천 모드를 선택하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
