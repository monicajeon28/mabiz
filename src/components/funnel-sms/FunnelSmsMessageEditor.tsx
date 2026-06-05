'use client';

import React, { useCallback, useRef, useState } from 'react';

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

/** URL 입력 팝오버 상태 */
type PopoverType = '상품링크' | '카톡방링크' | null;

export default function FunnelSmsMessageEditor({
  message,
  onChange,
  sendHour,
  sendMinute,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [popover, setPopover] = useState<PopoverType>(null);
  const [urlInput, setUrlInput] = useState('');

  const bytes = getEucKrBytes(message.content);
  const autoMsgType: 'SMS' | 'LMS' = bytes > SMS_LIMIT ? 'LMS' : 'SMS';
  const limit = autoMsgType === 'SMS' ? SMS_LIMIT : LMS_LIMIT;
  const overLimit = bytes > LMS_LIMIT;

  /** 커서 위치에 변수 삽입 */
  const insertAtCursor = useCallback(
    (variable: string) => {
      const el = textareaRef.current;
      if (!el) {
        onChange('content', message.content + variable);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next =
        message.content.slice(0, start) + variable + message.content.slice(end);
      onChange('content', next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    },
    [message.content, onChange]
  );

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

  /** [상품링크] / [카톡방링크] 팝오버 확인 */
  const handleUrlConfirm = useCallback(() => {
    if (!popover) return;
    const trimmed = urlInput.trim();
    if (trimmed) {
      insertAtCursor(`[${popover}:${trimmed}]`);
    } else {
      insertAtCursor(`[${popover}]`);
    }
    setPopover(null);
    setUrlInput('');
  }, [popover, urlInput, insertAtCursor]);

  const handlePopoverOpen = useCallback(
    (type: '상품링크' | '카톡방링크') => {
      setUrlInput('');
      setPopover(type);
    },
    []
  );

  const handlePopoverCancel = useCallback(() => {
    setPopover(null);
    setUrlInput('');
  }, []);

  const previewDate = getPreviewDate(message.daysAfter);
  const timeStr = `${String(sendHour).padStart(2, '0')}:${String(sendMinute).padStart(2, '0')}`;

  /** 단순 변수 버튼 목록 */
  const simpleVars: { label: string; variable: string }[] = [
    { label: '[이름]', variable: '[이름]' },
    { label: '[전화번호]', variable: '[전화번호]' },
    { label: '[날짜]', variable: '[날짜]' },
    { label: '[담당자]', variable: '[담당자]' },
  ];

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
        <label className="text-sm font-medium text-gray-700 block mb-2">메시지 내용</label>

        {/* 변수 칩 버튼 줄 */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {simpleVars.map(({ label, variable }) => (
            <button
              key={label}
              type="button"
              onClick={() => insertAtCursor(variable)}
              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50 transition-colors"
            >
              {label}
            </button>
          ))}
          {/* 상품링크 */}
          <button
            type="button"
            onClick={() => handlePopoverOpen('상품링크')}
            className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded px-2 py-0.5 hover:bg-indigo-50 transition-colors"
          >
            [상품링크]
          </button>
          {/* 카톡방링크 */}
          <button
            type="button"
            onClick={() => handlePopoverOpen('카톡방링크')}
            className="inline-flex items-center text-xs text-yellow-700 hover:text-yellow-900 border border-yellow-400 rounded px-2 py-0.5 hover:bg-yellow-50 transition-colors"
          >
            [카톡방링크]
          </button>
        </div>

        {/* URL 인라인 팝오버 */}
        {popover !== null && (
          <div className="mb-2 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
              {popover} URL:
            </span>
            <input
              autoFocus
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlConfirm();
                if (e.key === 'Escape') handlePopoverCancel();
              }}
              placeholder="https://..."
              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleUrlConfirm}
              className="text-xs bg-blue-600 text-white rounded px-2.5 py-1 hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              삽입
            </button>
            <button
              type="button"
              onClick={handlePopoverCancel}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              취소
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
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
          <span className="text-xs text-gray-400">발송 시간: {timeStr}</span>
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
