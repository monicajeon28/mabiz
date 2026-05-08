// components/admin/pages/EmojiPicker.tsx
// 이모티콘 선택기 컴포넌트 (100개 추천)

'use client';

import { useState, useRef, useEffect } from 'react';
import { FiSmile } from 'react-icons/fi';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  onClose?: () => void;
}

// 100개 추천 이모티콘
const RECOMMENDED_EMOJIS = [
  '🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🍰', '🍕', '🍔', '🍟',
  '🍗', '🍖', '🍝', '🍜', '🍲', '🍱', '🍣', '🍤', '🍙', '🍚',
  '🍘', '🍥', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🍮',
  '🎂', '🧁', '🍰', '🍪', '🍩', '🍫', '🍬', '🍭', '🍯', '🍼',
  '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂',
  '🥃', '🥤', '🧃', '🧉', '🧊', '🥢', '🍽️', '🍴', '🥄', '🔪',
  '🏺', '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋',
  '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️', '🏛️', '🏗️', '🧱',
  '🏘️', '🏚️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨',
  '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽',
];

const CATEGORIES = [
  { name: '축하', emojis: ['🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🎆', '🎇', '✨', '🌟'] },
  { name: '음식', emojis: ['🍕', '🍔', '🍟', '🍗', '🍖', '🍝', '🍜', '🍲', '🍱', '🍣'] },
  { name: '여행', emojis: ['✈️', '🚢', '🚤', '⛵', '🚁', '🚂', '🚃', '🚄', '🚅', '🚆'] },
  { name: '크루즈', emojis: ['🚢', '⚓', '🌊', '🏝️', '🏖️', '🌴', '🌅', '🌇', '🌉', '🌊'] },
  { name: '감정', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇'] },
  { name: '서비스', emojis: ['🧞', '📱', '🎫', '📺', '💬', '🛡️', '🎯', '⭐', '💎', '🏆'] },
  { name: '액션', emojis: ['👍', '👎', '👏', '🙌', '👋', '🤝', '✌️', '🤞', '🤟', '🤘'] },
  { name: '기타', emojis: ['❤️', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️'] },
];

export default function EmojiPicker({ value, onChange, onClose }: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredEmojis = searchQuery
    ? RECOMMENDED_EMOJIS.filter(emoji => emoji.includes(searchQuery))
    : CATEGORIES[selectedCategory].emojis;

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto"
      style={{ top: '100%', left: 0, marginTop: '8px' }}
    >
      {/* 검색 */}
      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="이모티콘 검색..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* 카테고리 탭 */}
      {!searchQuery && (
        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map((category, idx) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(idx)}
              className={`px-2 py-1 text-xs rounded ${
                selectedCategory === idx
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* 이모티콘 그리드 */}
      <div className="grid grid-cols-10 gap-2">
        {filteredEmojis.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            onClick={() => {
              onChange(emoji);
              onClose?.();
            }}
            className={`text-2xl p-2 rounded hover:bg-gray-100 transition-colors ${
              value === emoji ? 'bg-blue-100 ring-2 ring-blue-500' : ''
            }`}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* 추천 100개 전체 보기 */}
      {!searchQuery && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">추천 이모티콘 100개</p>
          <div className="grid grid-cols-10 gap-1">
            {RECOMMENDED_EMOJIS.map((emoji, idx) => (
              <button
                key={`all-${emoji}-${idx}`}
                onClick={() => {
                  onChange(emoji);
                  onClose?.();
                }}
                className="text-lg p-1 rounded hover:bg-gray-100 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

