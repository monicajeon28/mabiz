// components/admin/ItemForm.tsx
// 항목 입력 폼 + 제안 드롭다운

'use client';

import React from 'react';
import { FiPlus, FiChevronDown } from 'react-icons/fi';
import { getColorClasses } from '@/lib/ui/color-palette';

export interface ItemFormProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: (item?: string) => void;
  suggestions: string[];
  showDropdown: boolean;
  onToggleDropdown: (show: boolean) => void;
  color: 'green' | 'red';
}

const ItemForm = React.memo(function ItemForm({
  value,
  onChange,
  onAdd,
  suggestions,
  showDropdown,
  onToggleDropdown,
  color,
}: ItemFormProps) {
  const colors = getColorClasses(color);
  const borderColor = colors.borderFocus;
  const buttonColor = colors.button;
  const dropdownBorderColor = colors.dropdownBorder;
  const hoverBgColor = colors.bgHover;
  const placeholder = color === 'green' ? '포함 사항을 입력하거나 추천 항목을 선택하세요...' : '불포함 사항을 입력하거나 추천 항목을 선택하세요...';

  // P1-2: Typography hierarchy - determine if we have suggestions to show
  const hasSuggestions = suggestions.length > 0;

  return (
    <div className="relative flex gap-3">
      <div className="flex-1 relative">
        {/* P1-2: Typography hierarchy - helper text above input */}
        {value && !hasSuggestions && (
          <p className="text-xs text-gray-400 mb-1 px-1 font-normal">
            Type to search suggestions
          </p>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          onFocus={() => onToggleDropdown(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
              onToggleDropdown(false);
            } else if (e.key === 'Escape') {
              onToggleDropdown(false);
            }
          }}
          placeholder={placeholder}
          maxLength={100}
          className={`w-full px-4 py-3 pr-10 border-2 ${borderColor} rounded-lg focus:ring-2 focus:border-transparent text-base text-gray-900 placeholder-gray-400 font-normal`}
        />
        <button
          type="button"
          onClick={() => onToggleDropdown(!showDropdown)}
          className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-12 md:h-10 md:w-10 text-gray-400 hover:text-gray-600 transition-colors"
          title="제안 드롭다운 토글"
        >
          <FiChevronDown
            size={20}
            className={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
        </button>

        {showDropdown && suggestions.length > 0 && (
          <div
            className={`absolute z-50 w-full mt-1 bg-white border-2 ${dropdownBorderColor} rounded-lg shadow-lg max-h-60 overflow-auto`}
          >
            {/* P1-2: Helper text for dropdown (secondary color) */}
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 sticky top-0">
              <p className="text-xs text-gray-500 font-medium">
                Suggested items ({suggestions.length})
              </p>
            </div>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onAdd(suggestion);
                  onToggleDropdown(false);
                }}
                className={`w-full text-left px-4 py-2.5 min-h-11 md:min-h-auto flex items-center ${hoverBgColor} focus:bg-opacity-50 focus:outline-none transition-colors text-base text-gray-900 font-normal`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* P1-2: Button with strong typography (semibold) - primary action */}
      <button
        type="button"
        onClick={() => {
          onAdd();
          onToggleDropdown(false);
        }}
        className={`h-12 md:h-auto px-6 py-3 ${buttonColor} text-white rounded-lg font-semibold text-base flex items-center gap-2 shadow-md transition-all hover:shadow-lg`}
        title="항목 추가 (Enter 키로도 가능)"
      >
        <FiPlus size={20} />
        <span>추가</span>
      </button>
    </div>
  );
});

export default ItemForm;
