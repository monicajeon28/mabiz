// components/admin/ItemList.tsx
// 항목 목록 + 드래그앤드롭

'use client';

import React, { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  Sensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableItem from './SortableItem';

export interface ItemListProps {
  items: string[];
  itemIds: string[];
  color: 'green' | 'red';
  editingIndex: number | null;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onUpdateEdit: (index: number, value: string) => void;
  onCancelEdit: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  sensors: Sensors;
}

const ItemList = React.memo(function ItemList({
  items,
  itemIds,
  color,
  editingIndex,
  onEdit,
  onDelete,
  onUpdateEdit,
  onCancelEdit,
  onDragEnd,
  sensors,
}: ItemListProps) {
  const emptyMessage =
    color === 'green' ? '포함 사항이 없습니다.' : '불포함 사항이 없습니다.';
  const borderColorClass = color === 'green' ? 'border-green-300' : 'border-red-300';

  const handleEditItem = useCallback((index: number) => onEdit(index), [onEdit]);
  const handleDeleteItem = useCallback((index: number) => onDelete(index), [onDelete]);
  const handleUpdateItem = useCallback(
    (index: number, value: string) => onUpdateEdit(index, value),
    [onUpdateEdit]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 mb-4">
          {items.length === 0 ? (
            <div
              className={`text-center py-8 bg-white rounded-lg border-2 border-dashed ${borderColorClass}`}
            >
              {/* P1-2: Typography hierarchy - helper text (smaller, lighter) */}
              <p className="text-sm text-gray-400 font-normal">
                {emptyMessage}
              </p>
            </div>
          ) : (
            items.map((item, index) => (
              <SortableItem
                key={itemIds[index]}
                id={itemIds[index]}
                item={item}
                color={color}
                isEditing={editingIndex === index}
                onEdit={() => handleEditItem(index)}
                onDelete={() => handleDeleteItem(index)}
                onUpdateEdit={(value) => handleUpdateItem(index, value)}
                onCancelEdit={onCancelEdit}
              />
            ))
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
});

export default ItemList;
