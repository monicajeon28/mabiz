"use client";

import React, { useState, useCallback } from "react";
import {
  Block,
  BlockType,
  BASIC_BLOCKS,
  OPTIONAL_BLOCKS,
  createBlock,
  getBlockPreview,
} from "@/lib/landing-page-blocks";
import { CanvasPreview } from "./CanvasPreview";
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { BlockPropsPanel } from "./BlockPropsPanel";

interface BlockEditorProps {
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  selectedFeatures: {
    video: boolean;
    timer: boolean;
    testimonial: boolean;
    faq: boolean;
  };
  onFeaturesChange: (features: {
    video: boolean;
    timer: boolean;
    testimonial: boolean;
    faq: boolean;
  }) => void;
}

export function BlockEditor({
  blocks,
  onBlocksChange,
  selectedFeatures,
  onFeaturesChange,
}: BlockEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [showBlockPanel, setShowBlockPanel] = useState(true);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | "tablet">("desktop");

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  // 블록 추가
  const addBlock = useCallback(
    (type: BlockType) => {
      const newBlock = createBlock(type, blocks.length);
      const updatedBlocks = [...blocks, newBlock].map((b, idx) => ({
        ...b,
        order: idx,
      }));
      onBlocksChange(updatedBlocks);
      setSelectedBlockId(newBlock.id);
    },
    [blocks, onBlocksChange]
  );

  // 블록 삭제
  const deleteBlock = useCallback(
    (id: string) => {
      const filtered = blocks
        .filter((b) => b.id !== id)
        .map((b, idx) => ({ ...b, order: idx }));
      onBlocksChange(filtered);
      if (selectedBlockId === id) setSelectedBlockId(null);
    },
    [blocks, selectedBlockId, onBlocksChange]
  );

  // 블록 복제
  const duplicateBlock = useCallback(
    (id: string) => {
      const blockToDupe = blocks.find((b) => b.id === id);
      if (!blockToDupe) return;
      const newBlock = {
        ...JSON.parse(JSON.stringify(blockToDupe)),
        id: crypto.randomUUID(),
      };
      const idx = blocks.findIndex((b) => b.id === id);
      const updated = [
        ...blocks.slice(0, idx + 1),
        newBlock,
        ...blocks.slice(idx + 1),
      ].map((b, i) => ({ ...b, order: i }));
      onBlocksChange(updated);
    },
    [blocks, onBlocksChange]
  );

  // 블록 이동 (위/아래)
  const moveBlock = useCallback(
    (id: string, direction: "up" | "down") => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;
      if (direction === "up" && idx > 0) {
        const updated = [...blocks];
        [updated[idx], updated[idx - 1]] = [updated[idx - 1], updated[idx]];
        onBlocksChange(updated.map((b, i) => ({ ...b, order: i })));
      } else if (direction === "down" && idx < blocks.length - 1) {
        const updated = [...blocks];
        [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
        onBlocksChange(updated.map((b, i) => ({ ...b, order: i })));
      }
    },
    [blocks, onBlocksChange]
  );

  // 블록 업데이트
  const updateBlock = useCallback(
    (id: string, data: Partial<Block>) => {
      const updated = blocks.map((b) =>
        b.id === id ? ({ ...b, ...data } as Block) : b
      );
      onBlocksChange(updated);
    },
    [blocks, onBlocksChange]
  );

  return (
    <div className="flex gap-4 h-screen bg-gray-50 overflow-hidden">
      {/* ════════════════════════════ 좌측: 블록 라이브러리 ════════════════════════════ */}
      <div className="w-80 bg-blue-50 border-r border-blue-200 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-4 py-4 border-b border-blue-200 bg-white">
          <h3 className="font-bold text-sm text-gray-900">블록 추가</h3>
          <p className="text-xs text-gray-500 mt-1">드래그하여 캔버스에 추가</p>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* 기본 블록 */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 px-2">기본</p>
            <div className="space-y-2">
              {BASIC_BLOCKS.map((block) => (
                <div
                  key={block.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer?.setData("blockType", block.type);
                  }}
                  onClick={() => addBlock(block.type)}
                  className="p-3 bg-white rounded-lg border border-blue-200 hover:border-blue-400 hover:shadow-md cursor-move transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{block.icon}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {block.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 선택형 블록 */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 px-2">
              추가 기능
            </p>
            <div className="space-y-2">
              {OPTIONAL_BLOCKS.map((block) => {
                const featureKey = block.type as keyof typeof selectedFeatures;
                const isEnabled = selectedFeatures[featureKey];
                return (
                  <label
                    key={block.type}
                    className="flex items-center p-3 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => {
                        onFeaturesChange({
                          ...selectedFeatures,
                          [featureKey]: e.target.checked,
                        });
                        if (e.target.checked) {
                          addBlock(block.type);
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 accent-blue-600 mr-2"
                    />
                    <span className="text-lg mr-2">{block.icon}</span>
                    <span className="text-sm font-medium text-gray-700 flex-1">
                      {block.label}
                    </span>
                    {isEnabled && (
                      <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                        활성
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════ 중앙: 캔버스 + 미리보기 ════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 캔버스 헤더 */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-gray-900">에디터</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {blocks.length}개 블록
            </p>
          </div>

          {/* 미리보기 모드 토글 */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setPreviewMode("desktop")}
              className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${
                previewMode === "desktop"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="PC 미리보기"
            >
              💻 PC
            </button>
            <button
              onClick={() => setPreviewMode("tablet")}
              className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${
                previewMode === "tablet"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="태블릿 미리보기"
            >
              📱 태블릿
            </button>
            <button
              onClick={() => setPreviewMode("mobile")}
              className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${
                previewMode === "mobile"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="모바일 미리보기"
            >
              📱 모바일
            </button>
          </div>

          <button
            onClick={() => setShowBlockPanel(!showBlockPanel)}
            className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {showBlockPanel ? "설정 숨기기" : "설정 보기"}
          </button>
        </div>

        {/* 캔버스 본체: 3-패널 레이아웃 */}
        <div className="flex-1 overflow-auto flex gap-4 p-4 bg-gray-50">
          {/* 좌측: 블록 목록 */}
          <div className="flex-1 flex flex-col min-w-0">
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p className="text-lg font-medium mb-2">블록을 추가하세요</p>
                <p className="text-sm">
                  왼쪽 패널에서 드래그하거나 클릭하여 블록을 추가할 수 있습니다
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-2">
                {blocks.map((block, idx) => {
                  const isSelected = block.id === selectedBlockId;
                  return (
                    <div
                      key={block.id}
                      draggable
                      onDragStart={() => setDraggedBlockId(block.id)}
                      onDragEnd={() => setDraggedBlockId(null)}
                      onClick={() => setSelectedBlockId(block.id)}
                      className={`p-4 rounded-lg border-2 transition-all cursor-move group ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      {/* 블록 헤더 */}
                      <div className="flex items-center gap-3 mb-2">
                        <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                        <span className="text-sm font-semibold text-gray-700 flex-1 truncate">
                          {getBlockPreview(block)}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded shrink-0">
                          #{idx + 1}
                        </span>
                      </div>

                      {/* 블록 작업 버튼 (호버 시 표시) */}
                      <div className="flex items-center gap-2 hidden group-hover:flex mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlock(block.id, "up");
                          }}
                          disabled={idx === 0}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded disabled:opacity-30 transition-colors"
                          title="위로 이동"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlock(block.id, "down");
                          }}
                          disabled={idx === blocks.length - 1}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded disabled:opacity-30 transition-colors"
                          title="아래로 이동"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateBlock(block.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded transition-colors"
                          title="복제"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBlock(block.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 중앙: Canvas Preview */}
          <div className="flex-1 min-w-0">
            <CanvasPreview blocks={blocks} mode={previewMode} />
          </div>
        </div>
      </div>

      {/* ════════════════════════════ 우측: 블록 설정 패널 ════════════════════════════ */}
      {showBlockPanel && (
        <div className="w-80 bg-green-50 border-l border-green-200 flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="px-4 py-4 border-b border-green-200 bg-white">
            <h3 className="font-bold text-sm text-gray-900">블록 설정</h3>
            <p className="text-xs text-gray-500 mt-1">
              {selectedBlock ? "선택된 블록 설정" : "블록을 선택하세요"}
            </p>
          </div>

          {/* 설정 내용 */}
          <div className="flex-1 overflow-y-auto p-4">
            <BlockPropsPanel
              block={selectedBlock ?? null}
              onBlockUpdate={(block) => updateBlock(block.id, block)}
              onBlockDelete={deleteBlock}
            />
          </div>
        </div>
      )}
    </div>
  );
}

