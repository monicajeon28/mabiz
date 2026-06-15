"use client";

import React, { useCallback } from "react";
import {
  Block,
  HeadingBlock,
  BodyBlock,
  ImageBlock,
  CtaBlock,
  VideoBlock,
  TimerBlock,
  TestimonialBlock,
  FaqBlock,
} from "@/lib/landing-page-blocks";
import { Trash2, Plus } from "lucide-react";

interface BlockPropsPanelProps {
  block: Block | null;
  onBlockUpdate: (block: Block) => void;
  onBlockDelete?: (id: string) => void;
}

// 심리학 색상 맵 (Grant Cardone 10렌즈 기반)
const PSYCHOLOGY_COLOR_MAP: Record<
  string,
  { emoji: string; label: string; psychology: string }
> = {
  blue: {
    emoji: "🔵",
    label: "신뢰",
    psychology: "L9 의료/안전 신뢰도",
  },
  red: {
    emoji: "🔴",
    label: "긴급",
    psychology: "L10 즉시 구매 긴박감",
  },
  green: {
    emoji: "🟢",
    label: "성공",
    psychology: "L2 가치 해결책",
  },
  yellow: {
    emoji: "🟡",
    label: "주의",
    psychology: "L6 타이밍 손실회피",
  },
  dark: {
    emoji: "⬛",
    label: "신중",
    psychology: "L1 가격 이의 대응",
  },
};

const CTA_ACTION_MAP: Record<string, string> = {
  submit: "폼 제출",
  scroll: "페이지 스크롤",
  link: "외부 링크",
};

/**
 * BlockPropsPanel: 선택된 블록의 속성을 편집하는 통합 패널
 * 타입별로 자동으로 올바른 입력 필드 렌더링
 */
export function BlockPropsPanel({
  block,
  onBlockUpdate,
  onBlockDelete,
}: BlockPropsPanelProps) {
  // 블록이 없으면 메시지 표시
  if (!block) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <p className="text-sm font-medium">블록을 선택하세요</p>
        <p className="text-xs text-gray-500 mt-1">
          왼쪽 캔버스에서 블록을 클릭하면 여기에서 편집할 수 있습니다
        </p>
      </div>
    );
  }

  // 블록 타입별로 올바른 패널 렌더링
  switch (block.type) {
    case "heading":
      return (
        <HeadingPropsPanel
          block={block as HeadingBlock}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    case "body":
      return (
        <BodyPropsPanel
          block={block as BodyBlock}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    case "image":
      return (
        <ImagePropsPanel
          block={block as ImageBlock}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    case "cta":
      return (
        <CtaPropsPanel
          block={block as CtaBlock}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    case "video":
      return (
        <VideoPropsPanel
          block={block as VideoBlock}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    case "timer":
      return (
        <TimerPropsPanel
          block={block as TimerBlock}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    case "testimonial":
      return (
        <TestimonialPropsPanel
          block={block as TestimonialBlock}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    case "faq":
      return (
        <FaqPropsPanel
          block={block as FaqBlock}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    case "divider":
      return (
        <DividerPropsPanel
          block={block}
          onDelete={onBlockDelete}
        />
      );

    case "footer":
      return (
        <FooterPropsPanel
          block={block}
          onUpdate={onBlockUpdate}
          onDelete={onBlockDelete}
        />
      );

    default:
      return (
        <div className="p-3 bg-red-50 rounded border border-red-200 text-sm text-red-600">
          미지원 블록 타입
        </div>
      );
  }
}

// ════════════════════════════════════════════════════════════════════════
// HeadingPropsPanel (~30줄)
// ════════════════════════════════════════════════════════════════════════

function HeadingPropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: HeadingBlock;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          제목 텍스트
        </label>
        <textarea
          value={block.data.text}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, text: e.target.value },
            })
          }
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
          placeholder="제목을 입력하세요"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          정렬
        </label>
        <div className="flex gap-2">
          {["left", "center", "right"].map((align) => (
            <button
              key={align}
              onClick={() =>
                onUpdate({
                  ...block,
                  data: {
                    ...block.data,
                    align: align as "left" | "center" | "right",
                  },
                })
              }
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                block.data.align === align
                  ? "bg-green-500 text-white border-green-600"
                  : "border-gray-300 text-gray-700 hover:border-green-400"
              }`}
            >
              {align === "left" ? "좌측" : align === "center" ? "중앙" : "우측"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          크기
        </label>
        <select
          value={block.data.fontSize || "large"}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: {
                ...block.data,
                fontSize: e.target.value as "small" | "medium" | "large" | "xl",
              },
            })
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        >
          <option value="small">작음 (16px)</option>
          <option value="medium">중간 (24px)</option>
          <option value="large">크음 (32px)</option>
          <option value="xl">매우 크음 (48px)</option>
        </select>
      </div>

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// BodyPropsPanel (~25줄)
// ════════════════════════════════════════════════════════════════════════

function BodyPropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: BodyBlock;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          본문 텍스트
        </label>
        <textarea
          value={block.data.text}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, text: e.target.value },
            })
          }
          rows={5}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
          placeholder="본문 텍스트를 입력하세요"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          텍스트 크기
        </label>
        <select
          value={block.data.fontSize || "medium"}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: {
                ...block.data,
                fontSize: e.target.value as "small" | "medium" | "large",
              },
            })
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        >
          <option value="small">작음 (14px)</option>
          <option value="medium">중간 (16px)</option>
          <option value="large">크음 (18px)</option>
        </select>
      </div>

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ImagePropsPanel (~35줄)
// ════════════════════════════════════════════════════════════════════════

function ImagePropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: ImageBlock;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  const isValidUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return ["http:", "https:", "data:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          이미지 URL
        </label>
        <input
          type="url"
          value={block.data.url}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, url: e.target.value },
            })
          }
          placeholder="https://example.com/image.jpg"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            block.data.url && !isValidUrl(block.data.url)
              ? "border-red-300 focus:border-red-500 focus:ring-red-200"
              : "border-gray-300 focus:border-green-500 focus:ring-green-200"
          }`}
        />
        {block.data.url && !isValidUrl(block.data.url) && (
          <p className="text-xs text-red-500 mt-1">유효한 URL을 입력하세요</p>
        )}
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          대체 텍스트 (alt)
        </label>
        <input
          type="text"
          value={block.data.alt}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, alt: e.target.value },
            })
          }
          placeholder="이미지 설명 (접근성)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          가로세로비
        </label>
        <select
          value={block.data.aspectRatio || "16/9"}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, aspectRatio: e.target.value },
            })
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        >
          <option value="16/9">16:9 (와이드)</option>
          <option value="4/3">4:3 (표준)</option>
          <option value="1/1">1:1 (정사각형)</option>
          <option value="3/4">3:4 (세로)</option>
        </select>
      </div>

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CtaPropsPanel (~50줄, 심리학 적용)
// ════════════════════════════════════════════════════════════════════════

function CtaPropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: CtaBlock;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          버튼 텍스트
        </label>
        <input
          type="text"
          value={block.data.text}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, text: e.target.value },
            })
          }
          placeholder="신청하기"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          색상 (심리학 기반)
        </label>
        <div className="space-y-2">
          {Object.entries(PSYCHOLOGY_COLOR_MAP).map(([color, info]) => (
            <button
              key={color}
              onClick={() =>
                onUpdate({
                  ...block,
                  data: { ...block.data, color: color as any },
                })
              }
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                block.data.color === color
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-green-300"
              }`}
            >
              <span className="text-xl">{info.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700">
                  {info.label}
                </p>
                <p className="text-xs text-gray-500">{info.psychology}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          버튼 크기
        </label>
        <select
          value={block.data.size || "medium"}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: {
                ...block.data,
                size: e.target.value as "small" | "medium" | "large",
              },
            })
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        >
          <option value="small">작음</option>
          <option value="medium">중간</option>
          <option value="large">크음</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          액션
        </label>
        <select
          value={block.data.action || "submit"}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: {
                ...block.data,
                action: e.target.value,
              },
            })
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        >
          <option value="submit">폼 제출</option>
          <option value="scroll">페이지 스크롤</option>
          <option value="link">외부 링크</option>
        </select>
      </div>

      {block.data.action === "link" && (
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            링크 URL
          </label>
          <input
            type="url"
            value={block.data.actionTarget || ""}
            onChange={(e) =>
              onUpdate({
                ...block,
                data: {
                  ...block.data,
                  actionTarget: e.target.value,
                },
              })
            }
            placeholder="https://example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
          />
        </div>
      )}

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// VideoPropsPanel (~25줄)
// ════════════════════════════════════════════════════════════════════════

function VideoPropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: VideoBlock;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          영상 URL (YouTube/Vimeo)
        </label>
        <input
          type="url"
          value={block.data.url}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, url: e.target.value },
            })
          }
          placeholder="https://youtube.com/watch?v=..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        />
      </div>

      <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={block.data.autoplay || false}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, autoplay: e.target.checked },
            })
          }
          className="w-4 h-4 rounded accent-green-600"
        />
        <span className="text-sm text-gray-700 font-medium">자동 재생</span>
      </label>

      <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={block.data.loop || false}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, loop: e.target.checked },
            })
          }
          className="w-4 h-4 rounded accent-green-600"
        />
        <span className="text-sm text-gray-700 font-medium">반복 재생</span>
      </label>

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TimerPropsPanel (~25줄)
// ════════════════════════════════════════════════════════════════════════

function TimerPropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: TimerBlock;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          마감 시간 (L6 손실회피 강화)
        </label>
        <input
          type="datetime-local"
          value={block.data.deadline?.slice(0, 16) || ""}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: {
                ...block.data,
                deadline: new Date(e.target.value).toISOString(),
              },
            })
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          타이머 제목
        </label>
        <input
          type="text"
          value={block.data.title || ""}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, title: e.target.value },
            })
          }
          placeholder="마감까지"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
        />
      </div>

      <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={block.data.enabled || false}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...block.data, enabled: e.target.checked },
            })
          }
          className="w-4 h-4 rounded accent-green-600"
        />
        <span className="text-sm text-gray-700 font-medium">활성화</span>
      </label>

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TestimonialPropsPanel (~30줄)
// ════════════════════════════════════════════════════════════════════════

function TestimonialPropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: TestimonialBlock;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold text-gray-600">
          후기 항목 {block.data.items.length}개 (사회증명 L8)
        </p>
      </div>

      {block.data.items.map((item, idx) => (
        <div key={item.id} className="p-3 bg-white rounded-lg border border-green-200 space-y-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-600">
              후기 #{idx + 1}
            </span>
            <button
              onClick={() =>
                onUpdate({
                  ...block,
                  data: {
                    ...block.data,
                    items: block.data.items.filter((i) => i.id !== item.id),
                  },
                })
              }
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              삭제
            </button>
          </div>

          <input
            type="text"
            placeholder="고객명"
            value={item.author}
            onChange={(e) =>
              onUpdate({
                ...block,
                data: {
                  ...block.data,
                  items: block.data.items.map((i) =>
                    i.id === item.id ? { ...i, author: e.target.value } : i
                  ),
                },
              })
            }
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
          />

          <input
            type="text"
            placeholder="역할 (예: CEO, 고객)"
            value={item.role || ""}
            onChange={(e) =>
              onUpdate({
                ...block,
                data: {
                  ...block.data,
                  items: block.data.items.map((i) =>
                    i.id === item.id ? { ...i, role: e.target.value } : i
                  ),
                },
              })
            }
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
          />

          <textarea
            placeholder="후기 내용"
            value={item.text}
            onChange={(e) =>
              onUpdate({
                ...block,
                data: {
                  ...block.data,
                  items: block.data.items.map((i) =>
                    i.id === item.id ? { ...i, text: e.target.value } : i
                  ),
                },
              })
            }
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
          />

          <input
            type="url"
            placeholder="이미지 URL (선택)"
            value={item.image || ""}
            onChange={(e) =>
              onUpdate({
                ...block,
                data: {
                  ...block.data,
                  items: block.data.items.map((i) =>
                    i.id === item.id ? { ...i, image: e.target.value } : i
                  ),
                },
              })
            }
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
          />
        </div>
      ))}

      <button
        onClick={() =>
          onUpdate({
            ...block,
            data: {
              ...block.data,
              items: [
                ...block.data.items,
                {
                  id: crypto.randomUUID(),
                  text: "",
                  author: "",
                  role: "",
                  image: "",
                },
              ],
            },
          })
        }
        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium bg-green-200 text-green-800 rounded-lg hover:bg-green-300 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        후기 추가
      </button>

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// FaqPropsPanel (~30줄)
// ════════════════════════════════════════════════════════════════════════

function FaqPropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: FaqBlock;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold text-gray-600">
          FAQ 항목 {block.data.items.length}개 (이의 대응)
        </p>
      </div>

      {block.data.items.map((item, idx) => (
        <div key={item.id} className="p-3 bg-white rounded-lg border border-green-200 space-y-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-600">
              Q{idx + 1}
            </span>
            <button
              onClick={() =>
                onUpdate({
                  ...block,
                  data: {
                    ...block.data,
                    items: block.data.items.filter((i) => i.id !== item.id),
                  },
                })
              }
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              삭제
            </button>
          </div>

          <input
            type="text"
            placeholder="질문"
            value={item.question}
            onChange={(e) =>
              onUpdate({
                ...block,
                data: {
                  ...block.data,
                  items: block.data.items.map((i) =>
                    i.id === item.id
                      ? { ...i, question: e.target.value }
                      : i
                  ),
                },
              })
            }
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-green-500 font-medium"
          />

          <textarea
            placeholder="답변"
            value={item.answer}
            onChange={(e) =>
              onUpdate({
                ...block,
                data: {
                  ...block.data,
                  items: block.data.items.map((i) =>
                    i.id === item.id ? { ...i, answer: e.target.value } : i
                  ),
                },
              })
            }
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-green-500"
          />
        </div>
      ))}

      <button
        onClick={() =>
          onUpdate({
            ...block,
            data: {
              ...block.data,
              items: [
                ...block.data.items,
                {
                  id: crypto.randomUUID(),
                  question: "",
                  answer: "",
                },
              ],
            },
          })
        }
        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium bg-green-200 text-green-800 rounded-lg hover:bg-green-300 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        FAQ 추가
      </button>

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DividerPropsPanel (구분선 - 설정 없음)
// ════════════════════════════════════════════════════════════════════════

function DividerPropsPanel({
  block,
  onDelete,
}: {
  block: Block;
  onDelete?: (id: string) => void;
}) {
  const handleUpdate = (b: Block) => {
    // Divider는 특별한 업데이트 없음
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center text-sm text-gray-600">
        <p>─ 구분선 (추가 설정 없음)</p>
      </div>
      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// FooterPropsPanel (~20줄)
// ════════════════════════════════════════════════════════════════════════

function FooterPropsPanel({
  block,
  onUpdate,
  onDelete,
}: {
  block: Block;
  onUpdate: (b: Block) => void;
  onDelete?: (id: string) => void;
}) {
  const b = block as any;
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          하단 텍스트
        </label>
        <textarea
          value={b.data.text}
          onChange={(e) =>
            onUpdate({
              ...block,
              data: { ...b.data, text: e.target.value },
            })
          }
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
          placeholder="저작권, 개인정보처리방침 등"
        />
      </div>

      <DeleteButton onDelete={onDelete} blockId={block.id} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 공용 컴포넌트: DeleteButton
// ════════════════════════════════════════════════════════════════════════

function DeleteButton({
  onDelete,
  blockId,
}: {
  onDelete?: (id: string) => void;
  blockId: string;
}) {
  if (!onDelete) return null;

  return (
    <button
      onClick={() => onDelete(blockId)}
      className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
    >
      <Trash2 className="w-3.5 h-3.5" />
      블록 삭제
    </button>
  );
}
