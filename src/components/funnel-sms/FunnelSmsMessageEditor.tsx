'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, HelpCircle } from 'lucide-react';

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

function getDayExplanation(daysAfter: number, sendHour: number, sendMinute: number): string {
  if (daysAfter === 0) {
    return "신청 직후 즉시 발송";
  }
  const timeStr = `${String(sendHour).padStart(2, '0')}:${String(sendMinute).padStart(2, '0')}`;
  const dayLabel = daysAfter === 1 ? "다음날" : `${daysAfter}일 후`;
  return `신청 ${dayLabel} ${timeStr}`;
}

const VARIABLES_HELP = [
  { label: '[이름]', description: '고객 이름' },
  { label: '[전화번호]', description: '고객 휴대폰 번호' },
  { label: '[날짜]', description: '발송 예정일' },
  { label: '[담당자]', description: '담당 대리점장 이름' },
];

interface ProductLink {
  id: string;
  title: string | null;
  targetUrl: string;
  code: string;
  category: string | null;
  isConsulting?: boolean;
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

  // 변수 도움말 표시 상태
  const [showVariablesHelp, setShowVariablesHelp] = useState(false);
  const [showDayHelp, setShowDayHelp] = useState(false);

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
    // 전각 공백 및 다양한 공백 패턴도 빈 문자열로 간주
    const isTrimmedEmpty = /^\s*$/.test(next);
    if (!isTrimmedEmpty) {
      const nextType: 'SMS' | 'LMS' = getEucKrBytes(next) > SMS_LIMIT ? 'LMS' : 'SMS';
      onChange('content', next);
      if (nextType !== message.msgType) onChange('msgType', nextType);
    } else if (next !== message.content) {
      onChange('content', next);
    }
  }, [message.msgType, onChange, message.content]);

  const previewDate = getPreviewDate(message.daysAfter);
  const timeStr = `${String(sendHour).padStart(2, '0')}:${String(sendMinute).padStart(2, '0')}`;

  const simpleVars = [
    { label: '[이름]', variable: '{{name}}' },
    { label: '[전화번호]', variable: '{{phone}}' },
    { label: '[날짜]', variable: '{{date}}' },
    { label: '[담당자]', variable: '{{agent}}' },
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
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">발송 시점</label>
            <button
              type="button"
              onClick={() => setShowDayHelp(!showDayHelp)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
              title="발송 시점 설명"
              aria-label="발송 시점 도움말"
            >
              <HelpCircle className="w-5 h-5 text-gray-500" />
            </button>
          </div>
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
            <span>고객 입장 후 {message.daysAfter}일 ({timeStr}) 발송</span>
          )}
        </div>
      </div>

      {/* Day 0-3 설명 팝오버 */}
      {showDayHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-900">발송 시점 설명</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
              {[0, 1, 2, 3].map(day => (
                <div key={day} className="flex items-start gap-1">
                  <span className="font-semibold">Day {day}:</span>
                  <span>{getDayExplanation(day, sendHour, sendMinute)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-700 mt-2 pt-2 border-t border-blue-200">
              💡 Day 0은 신청 직후 즉시, Day 1-3은 해당 날짜 {String(sendHour).padStart(2, '0')}:{String(sendMinute).padStart(2, '0')}에 자동 발송됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Day 0 메시지 안내 */}
      {message.daysAfter === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-700 font-medium">
            ✓ 이 메시지는 고객이 그룹에 입장하면 바로 발송됩니다. (발송시간 설정 불필요)
          </p>
        </div>
      )}

      {/* 메시지 입력 */}
      <div>
        {/* 변수 버튼 툴바 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600 font-medium">변수 삽입:</span>
            <button
              type="button"
              onClick={() => setShowVariablesHelp(!showVariablesHelp)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 rounded-lg hover:bg-gray-100"
              title="사용 가능한 변수 목록"
              aria-label="변수 도움말"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="text-xs text-gray-600 hover:text-gray-800">도움말</span>
            </button>
          </div>

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
              [상담링크] <ChevronDown className="w-3 h-3" />
            </button>
            {showProductLinks && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[220px] max-h-52 overflow-y-auto">
                {loadingLinks ? (
                  <p className="text-xs text-gray-400 p-3">불러오는 중...</p>
                ) : productLinks.length === 0 ? (
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-2">등록된 상담링크가 없습니다.</p>
                    <a href="/settings/sms" target="_blank" className="text-xs text-emerald-600 underline">
                      상담 링크 설정하기 →
                    </a>
                  </div>
                ) : (
                  <>
                    {productLinks.map(link => (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => handleSelectProductLink(link)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-1.5">
                          {link.isConsulting && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                              상담
                            </span>
                          )}
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {link.title ?? link.code}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{link.targetUrl}</p>
                      </button>
                    ))}
                    {!productLinks.some(l => l.isConsulting) && (
                      <div className="px-3 py-2 border-t border-dashed border-gray-200">
                        <a href="/settings/sms" target="_blank"
                          className="text-xs text-emerald-600 hover:underline">
                          + 상담 링크 설정하기
                        </a>
                      </div>
                    )}
                  </>
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

        {/* 변수 도움말 박스 */}
        {showVariablesHelp && (
          <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-emerald-900 mb-2">사용 가능한 변수</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {VARIABLES_HELP.map(v => (
                <div key={v.label} className="flex items-start gap-2">
                  <span className="font-mono font-medium text-emerald-700 flex-shrink-0">{v.label}</span>
                  <span className="text-emerald-700">{v.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 텍스트영역 */}
        <textarea
          ref={textareaRef}
          rows={6}
          value={message.content}
          onChange={handleContentChange}
          onClick={() => setShowProductLinks(false)}
          placeholder="메시지 내용을 입력하세요."
          disabled={overLimit}
          className={`w-full border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 resize-none max-h-64 ${
            overLimit ? 'border-red-400 focus:ring-red-400 bg-red-50 cursor-not-allowed' : 'border-gray-300 focus:ring-blue-500'
          }`}
        />

        {/* 바이트 카운터 + 초과 경고 */}
        {overLimit && (
          <div className="mt-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-sm font-medium text-red-700">문자 길이 초과</span>
            <span className="text-sm text-red-600">{bytes - LMS_LIMIT}B 초과되어 발송할 수 없습니다.</span>
          </div>
        )}
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
