'use client';

import React from 'react';

interface HeaderValue {
  title: string;
  senderPhone?: string;
  category?: string;
  description?: string;
  sendHour: number;
  sendMinute: number;
  arsNum?: string;
}

interface Props {
  value: HeaderValue;
  onChange: (field: keyof HeaderValue, value: string | number) => void;
  groups?: { id: string; name: string }[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export default function FunnelSmsHeader({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          퍼널 제목 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          maxLength={100}
          value={value.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="예) 크루즈 여행 관심 고객 시퀀스"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400 text-right">{value.title.length}/100</p>
      </div>

      {/* 발신번호 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          발신번호
        </label>
        <input
          type="text"
          maxLength={20}
          value={value.senderPhone ?? ''}
          onChange={(e) => onChange('senderPhone', e.target.value)}
          placeholder="예) 0212345678"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 카테고리 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          카테고리
        </label>
        <input
          type="text"
          maxLength={50}
          value={value.category ?? ''}
          onChange={(e) => onChange('category', e.target.value)}
          placeholder="예) 크루즈, 여행, VIP"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 발송 시간 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          발송 시간 <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <select
            value={value.sendHour}
            onChange={(e) => onChange('sendHour', Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}시
              </option>
            ))}
          </select>
          <span className="text-gray-400">:</span>
          <select
            value={value.sendMinute}
            onChange={(e) => onChange('sendMinute', Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}분
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500 ml-1">
            매일 {String(value.sendHour).padStart(2, '0')}:{String(value.sendMinute).padStart(2, '0')} 발송
          </span>
        </div>
      </div>

      {/* 080 수신거부 번호 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          080 수신거부 번호
        </label>
        <input
          type="text"
          maxLength={20}
          value={value.arsNum ?? ''}
          onChange={(e) => onChange('arsNum', e.target.value)}
          placeholder="예) 08012345678"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          설명
        </label>
        <textarea
          maxLength={500}
          rows={3}
          value={value.description ?? ''}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="이 퍼널의 목적이나 대상 고객을 설명해주세요."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="mt-1 text-xs text-gray-400 text-right">
          {(value.description ?? '').length}/500
        </p>
      </div>
    </div>
  );
}
