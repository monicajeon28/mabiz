// components/admin/SortableItem.tsx
// 드래그 가능한 개별 항목

'use client';

import React, { useState, useEffect } from 'react';
import { FiEdit2, FiX } from 'react-icons/fi';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getColorClasses } from '@/lib/ui/color-palette';

export interface SortableItemProps {
  id: string;
  item: string;
  color: 'green' | 'red';
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onUpdateEdit: (value: string) => void;
  onCancelEdit: () => void;
}

function SortableItem({
  id,
  item,
  color,
  onEdit,
  onDelete,
  isEditing,
  onUpdateEdit,
  onCancelEdit,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // BUG-001 Fix: Controlled input to prevent stale data on rapid edit cycles
  const [editValue, setEditValue] = useState('');

  // Sync editValue when editing starts or item changes
  useEffect(() => {
    if (isEditing) {
      setEditValue(item);
    }
  }, [isEditing, item]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const colors = getColorClasses(color);
  const borderColor = colors.border;
  const handleColor = colors.handle;
  const inputBorderColor = colors.borderFocus;

  const handleBlur = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue) {
      onUpdateEdit(trimmedValue);
    } else {
      // Don't save empty values, just cancel
      onCancelEdit();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 p-4 bg-white border-2 ${borderColor} rounded-lg shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* 드래그 핸들 */}
      <button
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing p-2 ${handleColor} flex-shrink-0 flex items-center justify-center`}
        title="드래그하여 순서 변경"
        type="button"
        style={{ minHeight: '44px', minWidth: '44px' }}
      >
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>

      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const trimmedValue = editValue.trim();
              if (trimmedValue) onUpdateEdit(trimmedValue);
            } else if (e.key === 'Escape') onCancelEdit();
          }}
          autoFocus
          maxLength={100}
          className={`flex-1 px-3 py-2 border-2 ${inputBorderColor} rounded-lg focus:ring-2`}
        />
      ) : (
        <>
          <span className="flex-1 text-base text-gray-800 font-medium">
            {item}
          </span>
          {/* 데스크톱 버튼 (md: 이상) */}
          <button
            onClick={onEdit}
            className="hidden md:flex md:items-center md:justify-center p-3 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors"
            title="수정"
            type="button"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <FiEdit2 size={18} />
          </button>
          <button
            onClick={onDelete}
            className="hidden md:flex md:items-center md:justify-center p-3 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
            title="삭제"
            type="button"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <FiX size={18} />
          </button>

          {/* 모바일 드롭다운 (md: 미만) */}
          <div className="relative group md:hidden">
            <button
              className="flex items-center justify-center p-3 text-gray-400 hover:text-gray-600 transition-colors"
              title="메뉴"
              type="button"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              ⋮
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10 w-32">
              <button
                onClick={onEdit}
                className="block w-full text-left px-4 py-2 hover:bg-green-50 text-sm font-medium text-green-700 transition-colors"
                type="button"
              >
                수정
              </button>
              <button
                onClick={onDelete}
                className="block w-full text-left px-4 py-2 hover:bg-red-50 text-sm font-medium text-red-700 border-t border-gray-100 transition-colors"
                type="button"
              >
                삭제
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default React.memo(SortableItem);
