declare module 'react-beautiful-dnd' {
  import * as React from 'react';

  export interface DraggableLocation {
    droppableId: string;
    index: number;
  }

  export interface DropResult {
    draggableId: string;
    type: string;
    source: DraggableLocation;
    destination: DraggableLocation | null;
    reason: 'DROP' | 'CANCEL';
    combine?: unknown;
    mode: 'FLUID' | 'SNAP';
  }

  export interface DroppableProvided {
    innerRef: (element: HTMLElement | null) => void;
    droppableProps: Record<string, unknown>;
    placeholder: React.ReactElement | null;
  }

  export interface DraggableProvided {
    innerRef: (element: HTMLElement | null) => void;
    draggableProps: Record<string, unknown>;
    dragHandleProps: Record<string, unknown> | null;
  }

  export interface DraggableSnapshot {
    isDragging: boolean;
    isDropAnimating: boolean;
  }

  export interface DroppableSnapshot {
    isDraggingOver: boolean;
    draggingOverWith: string | null;
  }

  export function DragDropContext(props: {
    onDragEnd: (result: DropResult) => void;
    children: React.ReactNode;
  }): React.ReactElement;

  export function Droppable(props: {
    droppableId: string;
    children: (provided: DroppableProvided, snapshot: DroppableSnapshot) => React.ReactElement;
  }): React.ReactElement;

  export function Draggable(props: {
    draggableId: string;
    index: number;
    children: (provided: DraggableProvided, snapshot: DraggableSnapshot) => React.ReactElement;
  }): React.ReactElement;
}
