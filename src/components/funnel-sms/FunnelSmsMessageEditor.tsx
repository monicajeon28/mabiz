'use client';

import React, { useCallback } from 'react';

interface MessageValue {
  order: number;
  daysAfter: number;
  content: string;
  msgType: 'SMS' | 'LMS';
}

interface Props {
  message: MessageValue;
  onChange: (field: keyof MessageValue, value: number | string | 'SMS' | 'LMS') => void;
  sendHour: number;
  sendMinute: number;
}

/** EUC-KR 기준 바이트 수 계산 (한글 2B, ASCII 1B) */
function getEucKrBytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // EUC-KR: 한글 등 0x80 이상 문자는 2바이트
    bytes += code > 0x7f ? 2 : 1;
  }
  return bytes;
}

/** 오늘로부터 N일 후 날짜 문자열 반환 (YYYY-MM-DD) */
function getPreviewDate(daysAfter: number): string {
  const d = new Date(Date.now() + daysAfter * 86_400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SMS_LIMIT = 80;
const LMS_LIMIT = 2000;

export default function FunnelSmsMessageEditor({
  message,
  onChange,
  sendHour,
  sendMinute,
}: Props) {
  const bytes = getEucKrBytes(message.content);
  const autoMsgType: 'SMS' | 'LMS' = bytes > SMS_LIMIT ? 'LMS' : 'SMS';
  const limit = autoMsgType === 'SMS' ? SMS_LIMIT : LMS_LIMIT;
  const overLimit = bytes > LMS_LIMIT;

  // content가 바뀔 때마다 msgType 자동 동기화
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      const nextBytes = getEucKrBytes(next);
      const nextType: 'SMS' | 'LMS' = nextBytes > SMS_LIMIT ? 'LMS' : 'SMS';
      onChange('content', next);
      if (nextType !== message.msgType) {
        onChange('msgType', nextType);
      }
    },
    [message.msgType, onChange]
  );

  const handleInsertName = useCallback(() => {
    onChange('content', message.content + '[이름]');
  }, [message.content, onChange]);

  const previewDate = getPreviewDate(message.daysAfter);
  const timeStr = `${String(sendHour).padStart(2, '0')}:${String(sendMinute).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* 회차 배지 */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {message.order}회차
        </span>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            autoMsgType === 'LMS'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {autoMsgType}
        </span>
      </div>

      {/* D+N 입력 + 발송일 미리보기 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            발송 시점
          </label>
          <input
            type="number"
            min={0}
            max={36500}
            value={message.daysAfter}
            onChange={(e) =>
              onChange('daysAfter', Math.max(0, Math.min(36500, Number(e.target.value))))
            }
            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">일 후</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>
            {previewDate} {timeStr} 발송 예정
          </span>
        </div>
      </div>

      {/* 메시지 입력 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">메시지 내용</label>
          <button
            type="button"
            onClick={handleInsertName}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50 transition-colors"
          >
            + [이름] 삽입
          </button>
        </div>
        <textarea
          rows={6}
          value={message.content}
          onChange={handleContentChange}
          placeholder="메시지 내용을 입력하세요. [이름] 을 포함하면 발송 시 고객 이름으로 치환됩니다."
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${
            overLimit
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        />
        {/* 바이트 카운터 */}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            발송 시간: {timeStr}
          </span>
          <span
            className={`text-xs font-medium ${
              overLimit
                ? 'text-red-500'
                : bytes > SMS_LIMIT
                ? 'text-purple-600'
                : 'text-gray-500'
            }`}
          >
            {bytes}B / {limit}B
            {overLimit && (
              <span className="ml-1 text-red-500">(초과! {bytes - LMS_LIMIT}B 삭제 필요)</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
