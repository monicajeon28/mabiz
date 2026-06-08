'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';

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

interface ProductLink {
  id: string;
  title: string | null;
  targetUrl: string;
  code: string;
  category: string | null;
}

/** EUC-KR 기준 바이트 수 계산 (한글 2B, ASCII 1B) */
function getEucKrBytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    bytes += text.charCodeAt(i) > 0x7f ? 2 : 1;
  }
  return bytes;
}

/** 오늘로부터 N일 후 날짜 문자열 반환 */
function getPreviewDate(daysAfter: number): string {
  const d = new Date(Date.now() + daysAfter * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SMS_LIMIT = 80;
const LMS_LIMIT = 2000;

export default function FunnelSmsMessageEditor({ message, onChange, sendHour, sendMinute }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 상품링크 드롭다운 상태
  const [showProductLinks, setShowProductLinks] = useState(false);
  const [productLinks, setProductLinks] = useState<ProductLink[]>([]);
  const [kakaoOpenChat, setKakaoOpenChat] = useState('');
  const [loadingLinks, setLoadingLinks] = useState(false);

  const bytes = getEucKrBytes(message.content);
  const autoMsgType: 'SMS' | 'LMS' = bytes > SMS_LIMIT ? 'LMS' : 'SMS';
  const limit = autoMsgType === 'SMS' ? SMS_LIMIT : LMS_LIMIT;
  const overLimit = bytes > LMS_LIMIT;

  // 마운트 시 카톡방 링크 + 상품링크 미리 로드
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    fetch('/api/settings/sms-defaults', { signal })
      .then(r => r.json())
      .then(d => { if (d.ok) setKakaoOpenChat(d.kakaoOpenChat ?? ''); })
      .catch(err => { if (err instanceof Error && err.name !== 'AbortError') {} });

    setLoadingLinks(true);
    fetch('/api/settings/product-links', { signal })
      .then(r => r.json())
      .then(d => { if (d.ok) setProductLinks(d.links ?? []); })
      .catch(err => { if (err instanceof Error && err.name !== 'AbortError') {} })
      .finally(() => { if (!signal.aborted) setLoadingLinks(false); });
    return () => ctrl.abort();
  }, []);

  /** 커서 위치에 변수 삽입 */
  const insertAtCursor = useCallback((variable: string) => {
    const el = textareaRef.current;
    if (!el) { onChange('content', message.content + variable); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = message.content.slice(0, start) + variable + message.content.slice(end);
    onChange('content', next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }, [message.content, onChange]);

  /** 상품링크 선택 */
  const handleSelectProductLink = useCallback((link: ProductLink) => {
    insertAtCursor(link.targetUrl);
    setShowProductLinks(false);
  }, [insertAtCursor]);

  /** 카톡방링크 삽입 */
  const handleKakaoLink = useCallback(() => {
    if (kakaoOpenChat) {
      insertAtCursor(kakaoOpenChat);
    } else {
      insertAtCursor('https://open.kakao.com/');
    }
  }, [kakaoOpenChat, insertAtCursor]);

  /** content 변경 + msgType 자동 동기화 */
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const nextType: 'SMS' | 'LMS' = getEucKrBytes(next) > SMS_LIMIT ? 'LMS' : 'SMS';
    onChange('content', next);
    if (nextType !== message.msgType) onChange('msgType', nextType);
  }, [message.msgType, onChange]);

  const previewDate = getPreviewDate(message.daysAfter);
  const timeStr = `${String(sendHour).padStart(2, '0')}:${String(sendMinute).padStart(2, '0')}`;

  const simpleVars = [
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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          autoMsgType === 'LMS' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
        }`}>
          {autoMsgType}
        </span>
      </div>

      {/* D+N 입력 + 발송일 미리보기 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">발송 시점</label>
          <input
            type="number" min={0} max={36500}
            value={message.daysAfter}
            onChange={(e) => onChange('daysAfter', Math.max(0, Math.min(36500, Number(e.target.value))))}
            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">일 후</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
          {message.daysAfter === 0 ? (
            <span>입장 즉시 발송</span>
          ) : (
            <span>고객 입장 후 Day {message.daysAfter} ({timeStr}) 발송</span>
          )}
        </div>
      </div>

      {/* Day 0 메시지 안내 */}
      {message.daysAfter === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-700 font-medium">
            ✓ 이 메시지는 고객이 그룹에 입장하면 즉시 발송됩니다. (발송시간 설정 불필요)
          </p>
        </div>
      )}

      {/* 메시지 입력 */}
      <div>
        {/* 변수 버튼 툴바 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className="text-xs text-gray-400 mr-1">삽입:</span>

          {/* 단순 변수들 */}
          {simpleVars.map(({ label, variable }) => (
            <button key={variable} type="button" onClick={() => insertAtCursor(variable)}
              className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50 transition-colors">
              {label}
            </button>
          ))}

          {/* 상품링크 드롭다운 */}
          <div className="relative">
            <button type="button"
              onClick={() => setShowProductLinks(v => !v)}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded px-2 py-0.5 hover:bg-emerald-50 transition-colors">
              [상품링크] <ChevronDown className="w-3 h-3" />
            </button>
            {showProductLinks && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[220px] max-h-52 overflow-y-auto">
                {loadingLinks ? (
                  <p className="text-xs text-gray-400 p-3">불러오는 중...</p>
                ) : productLinks.length === 0 ? (
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-2">등록된 상담링크가 없습니다.</p>
                    <a href="/links" target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                      단축링크 관리 <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  productLinks.map(link => (
                    <button key={link.id} type="button"
                      onClick={() => handleSelectProductLink(link)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                      <p className="font-medium text-gray-800 truncate">{link.title ?? link.code}</p>
                      <p className="text-xs text-gray-400 truncate">{link.targetUrl}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 카톡방링크 */}
          <button type="button" onClick={handleKakaoLink}
            className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-800 border border-yellow-200 rounded px-2 py-0.5 hover:bg-yellow-50 transition-colors"
            title={kakaoOpenChat || '카카오 오픈채팅 링크'}>
            [카톡방링크]
          </button>
        </div>

        {/* 텍스트영역 */}
        <textarea
          ref={textareaRef}
          rows={6}
          value={message.content}
          onChange={handleContentChange}
          onClick={() => setShowProductLinks(false)}
          placeholder="메시지 내용을 입력하세요."
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${
            overLimit ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-500'
          }`}
        />

        {/* 바이트 카운터 */}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {message.daysAfter === 0 ? '즉시 발송' : `발송: ${timeStr}`}
          </span>
          <span className={`text-xs font-medium ${
            overLimit ? 'text-red-500' : bytes > SMS_LIMIT ? 'text-purple-600' : 'text-gray-500'
          }`}>
            {bytes}B / {limit}B
            {overLimit && <span className="ml-1 text-red-500">({bytes - LMS_LIMIT}B 초과)</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
