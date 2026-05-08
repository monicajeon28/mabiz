// components/admin/ItemSection.tsx
// 포함/불포함 섹션 (ItemList + ItemForm 통합)

'use client';

import React, { useMemo } from 'react';
import {
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useItemSection } from '@/hooks/useItemSection';
import { getColorClasses } from '@/lib/ui/color-palette';
import ItemList from './ItemList';
import ItemForm from './ItemForm';

export interface ItemSectionProps {
  type: 'included' | 'excluded';
  items: string[];
  onChange: (items: string[]) => void;
  suggestionsData: string[];
}

const ItemSection = React.memo(function ItemSection({
  type,
  items,
  onChange,
  suggestionsData,
}: ItemSectionProps) {
  const { state, dispatch, addItem, updateItem, removeItem, moveItem } =
    useItemSection(items, suggestionsData, onChange);

  const itemIds = useMemo(
    () => state.items.map((item, idx) => `${item}::${idx}`),
    [state.items]
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // P1-2: Typography hierarchy constants
  const MAX_ITEMS_PER_SET = 500;

  const color = type === 'included' ? ('green' as const) : ('red' as const);
  const colors = getColorClasses(color);
  const bgColor = colors.bg;
  const borderColor = type === 'included' ? 'border-green-200' : 'border-red-200';
  const emoji = type === 'included' ? '✅' : '❌';
  const title = type === 'included' ? '포함 사항 설정' : '불포함 사항 설정';

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = itemIds.indexOf(active.id as string);
      const newIdx = itemIds.indexOf(over.id as string);
      if (oldIdx !== -1 && newIdx !== -1) {
        moveItem(oldIdx, newIdx);
      }
    }
  };

  return (
    <div className={`space-y-4 ${bgColor} p-6 rounded-lg border-2 ${borderColor}`}>
      {/* P1-2: Typography hierarchy - section header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          {title}
        </h3>
        {/* P1-2: Item count feedback (tertiary color) */}
        <span className="text-xs text-gray-400 font-medium">
          {state.items.length} / {MAX_ITEMS_PER_SET} items
        </span>
      </div>

      <ItemList
        items={state.items}
        itemIds={itemIds}
        color={color}
        editingIndex={state.editingIndex}
        onEdit={(index) => dispatch({ type: 'SET_EDITING', index })}
        onDelete={removeItem}
        onUpdateEdit={updateItem}
        onCancelEdit={() => dispatch({ type: 'SET_EDITING', index: null })}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      />

      <ItemForm
        value={state.newItem}
        onChange={(value) => dispatch({ type: 'SET_NEW_ITEM', value })}
        onAdd={addItem}
        suggestions={state.filteredSuggestions}
        showDropdown={state.showDropdown}
        onToggleDropdown={(show) => dispatch({ type: 'SET_DROPDOWN', show })}
        color={color}
      />
    </div>
  );
});

export default ItemSection;
