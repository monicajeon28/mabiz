'use client';

import React from 'react';

interface Props {
  content: string;
}

/** 현재 시각 HH:MM 반환 */
function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function FunnelSmsPhonePreview({ content }: Props) {
  const timeStr = getCurrentTime();

  return (
    <div className="flex justify-center">
      {/* 폰 외형 */}
      <div
        className="relative bg-gray-900 rounded-[2.5rem] shadow-2xl"
        style={{ width: 280, height: 560 }}
      >
        {/* 상단 노치 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-gray-900 rounded-b-2xl z-10" />

        {/* 화면 */}
        <div
          className="absolute inset-2 bg-white rounded-[2rem] overflow-hidden flex flex-col"
        >
          {/* 상태바 */}
          <div className="flex items-center justify-between px-5 pt-2 pb-1 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-800">{timeStr}</span>
            <div className="flex items-center gap-1">
              {/* 신호 막대 */}
              <div className="flex items-end gap-px h-3">
                {[2, 3, 4, 5].map((h) => (
                  <div
                    key={h}
                    className="w-1 bg-gray-700 rounded-sm"
                    style={{ height: `${h * 2}px` }}
                  />
                ))}
              </div>
              {/* 와이파이 */}
              <svg className="w-3.5 h-3.5 text-gray-700 ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.41 9.59C5.25 5.75 10.46 3.5 12 3.5s6.75 2.25 10.59 6.09L24 8.17C19.68 3.84 15.14 1 12 1S4.32 3.84 0 8.17l1.41 1.42zM12 7.5c2.12 0 4.27.87 5.79 2.39L19.2 8.47C17.32 6.59 14.75 5.5 12 5.5S6.68 6.59 4.8 8.47l1.41 1.42C7.73 8.37 9.88 7.5 12 7.5zm0 4c1.06 0 2.13.44 2.89 1.2L16.3 11.3C15.15 10.15 13.63 9.5 12 9.5s-3.15.65-4.3 1.8l1.41 1.4c.76-.76 1.83-1.2 2.89-1.2zm0 4c.53 0 1.06.22 1.44.59L12 17.5l-1.44-1.41c.38-.37.91-.59 1.44-.59z"/>
              </svg>
              {/* 배터리 */}
              <svg className="w-5 h-3 text-gray-700" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="0.75" y="0.75" width="20.5" height="10.5" rx="2" />
                <rect x="21.25" y="3.5" width="2" height="5" rx="1" fill="currentColor" stroke="none" />
                <rect x="2" y="2" width="15" height="8" rx="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
          </div>

          {/* 수신자 헤더 */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">마</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">마비즈</p>
              <p className="text-xs text-gray-400">문자 메시지</p>
            </div>
          </div>

          {/* 메시지 본문 */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3 bg-gray-50 space-y-2"
            style={{ minHeight: 0 }}
          >
            {content.trim() ? (
              <div className="flex justify-end">
                <div
                  className="max-w-[85%] bg-blue-500 text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 leading-relaxed shadow-sm whitespace-pre-wrap break-words"
                >
                  {content}
                </div>
              </div>
            ) : (
              <div className="flex justify-center mt-8">
                <p className="text-xs text-gray-400">메시지를 입력하면 미리보기가 표시됩니다.</p>
              </div>
            )}
          </div>

          {/* 입력창 흉내 */}
          <div className="px-3 py-2 border-t border-gray-200 bg-white flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5">
              <p className="text-xs text-gray-400">문자 메시지</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        {/* 하단 홈 인디케이터 */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-gray-600 rounded-full" />

        {/* 사이드 버튼 (볼륨) */}
        <div className="absolute left-0 top-20 w-1 h-8 bg-gray-700 rounded-l-sm" />
        <div className="absolute left-0 top-32 w-1 h-8 bg-gray-700 rounded-l-sm" />
        {/* 전원 버튼 */}
        <div className="absolute right-0 top-24 w-1 h-12 bg-gray-700 rounded-r-sm" />
      </div>
    </div>
  );
}
