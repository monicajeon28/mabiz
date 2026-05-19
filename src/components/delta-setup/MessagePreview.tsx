'use client';

/**
 * Delta SMS MessagePreview Component
 *
 * Step 3: 메시지 미리보기
 * 고객에게 표시될 4개의 Day별 메시지를 모바일 SMS 창처럼 시뮬레이션
 *
 * Props:
 * - messages: Day 0-3 메시지 객체
 */

interface MessagePreviewProps {
  messages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
}

/**
 * 메시지 길이에 따른 상태 타입
 */
type MessageStatus = 'safe' | 'warning' | 'danger';

/**
 * 메시지 길이 인디케이터 상태 계산
 * - safe: 0-90자 (SMS, 초록)
 * - warning: 91-130자 (LMS, 노랑)
 * - danger: 131자+ (LMS, 빨강)
 */
function getMessageStatus(length: number): MessageStatus {
  if (length <= 90) return 'safe';
  if (length <= 130) return 'warning';
  return 'danger';
}

/**
 * 메시지 길이 상태별 색상 및 라벨
 */
function getStatusInfo(status: MessageStatus) {
  const infos = {
    safe: {
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      badgeColor: 'bg-green-100 text-green-800',
      icon: '✓',
      label: 'SMS (안전)',
    },
    warning: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-800',
      icon: '⚠',
      label: 'LMS (주의)',
    },
    danger: {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      badgeColor: 'bg-red-100 text-red-800',
      icon: '✗',
      label: 'LMS (길음)',
    },
  };
  return infos[status];
}

/**
 * Day별 메시지 카드 컴포넌트
 */
function MessageCard({
  day,
  message,
  label,
  description,
}: {
  day: number;
  message: string;
  label: string;
  description: string;
}) {
  const status = getMessageStatus(message.length);
  const statusInfo = getStatusInfo(status);

  // 프로그레스 바 계산 (최대 160자 기준)
  const maxChars = day === 0 ? 90 : 160;
  const progress = Math.min((message.length / maxChars) * 100, 100);

  return (
    <div
      className={`border rounded-lg overflow-hidden ${statusInfo.bgColor} ${statusInfo.borderColor}`}
      role="region"
      aria-label={`Day ${day} 메시지: ${statusInfo.label}`}
    >
      {/* 헤더: Day 레이블 */}
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 text-sm">{label}</h3>
            <p className="text-xs text-gray-600 mt-0.5">{description}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.badgeColor}`}>
            {statusInfo.icon} {statusInfo.label}
          </span>
        </div>
      </div>

      {/* 메시지 본문 (모바일 SMS 창처럼) */}
      <div className="p-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
          <div className="text-sm text-gray-800 leading-relaxed break-words">
            💬 {message}
          </div>
        </div>

        {/* 더미 액션 버튼 (실제 기능 없음, UI만) */}
        <div className="flex gap-2 mb-3">
          <button
            disabled
            className="text-xs px-3 py-1.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
          >
            자세히
          </button>
          <button
            disabled
            className="text-xs px-3 py-1.5 rounded bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 disabled:opacity-50"
          >
            닫기
          </button>
        </div>

        {/* 메시지 길이 정보 */}
        <div className="text-xs text-gray-600">
          <div className="flex justify-between mb-1">
            <span>글자 수: {message.length}/{maxChars}</span>
            <span className={statusInfo.color}>{statusInfo.label}</span>
          </div>

          {/* 프로그레스 바 */}
          <div
            className="h-2 rounded-full bg-gray-200 overflow-hidden"
            role="progressbar"
            aria-valuenow={message.length}
            aria-valuemin={0}
            aria-valuemax={maxChars}
            aria-label={`메시지 길이: ${message.length}/${maxChars}자`}
          >
            <div
              className={`h-full transition-all ${
                status === 'safe'
                  ? 'bg-green-500'
                  : status === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 메인 MessagePreview 컴포넌트
 */
export default function MessagePreview({ messages }: MessagePreviewProps) {
  const dayCards = [
    {
      day: 0,
      key: 'day0',
      label: '📲 Day 0: 구매 직후',
      description: '구매 당일 오전 발송',
    },
    {
      day: 1,
      key: 'day1',
      label: '📤 Day 1: +1일',
      description: '구매 다음날 오후 발송',
    },
    {
      day: 2,
      key: 'day2',
      label: '⏰ Day 2: +2일',
      description: '구매 3일 후 저녁 발송',
    },
    {
      day: 3,
      key: 'day3',
      label: '🚨 Day 3: +3일 (선택)',
      description: '구매 4일 후 저녁 발송 (선택사항)',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* 섹션 헤더 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Step 3: 메시지 미리보기
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          고객에게 이렇게 보입니다. 메시지 길이와 발송 형식을 확인하세요.
        </p>
      </div>

      {/* 메시지 카드 리스트 (스크롤 가능) */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {dayCards.map(({ day, key, label, description }) => (
          <MessageCard
            key={key}
            day={day}
            label={label}
            description={description}
            message={messages[key as keyof typeof messages]}
          />
        ))}
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">💡 메시지 형식 안내</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>
            ✓ <strong>SMS (0-90자)</strong>: 초록 표시 - 요금 저렴, 빠른 전송
          </li>
          <li>
            ⚠ <strong>LMS (91-160자)</strong>: 노랑/빨강 표시 - 장문 메시지 가능
          </li>
          <li>
            📌 <strong>Day 3</strong>는 선택사항이지만 모두 입력된 상태입니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
