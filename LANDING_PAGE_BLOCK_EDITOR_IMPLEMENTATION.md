# 🛠️ Landing Page 블록 에디터 - 개발 구현 가이드

**상태**: ✅ 설계 완료 → 개발 단계  
**최종 업데이트**: 2026-06-15  
**담당**: 개발팀

---

## 📊 구현 체크리스트

### Phase 1: 기초 인프라 (Week 1-2)

#### Task 1.1: 상태 관리 설정
```typescript
// src/lib/editor/store.ts (Zustand + Immer)

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type BlockType = 
  | 'hero'
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'button'
  | 'list'
  | 'faq'
  | 'stats'
  | 'spacer'
  | 'divider'
  | 'form'
  | 'feature';

export interface BlockSettings {
  [key: string]: any;
}

export interface Block {
  id: string;
  type: BlockType;
  order: number;
  settings: BlockSettings;
}

export interface EditorState {
  blocks: Block[];
  selectedBlockId: string | null;
  unsaved: boolean;
  history: {
    past: Block[][];
    present: Block[];
    future: Block[][];
  };
}

export interface EditorActions {
  addBlock: (type: BlockType) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, settings: Partial<BlockSettings>) => void;
  selectBlock: (id: string | null) => void;
  moveBlock: (id: string, direction: 'up' | 'down') => void;
  duplicateBlock: (id: string) => void;
  reorderBlocks: (blockIds: string[]) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    blocks: [],
    selectedBlockId: null,
    unsaved: false,
    history: { past: [], present: [], future: [] },

    addBlock: (type) => set((state) => {
      const newBlock: Block = {
        id: `block_${Date.now()}`,
        type,
        order: state.blocks.length,
        settings: getDefaultSettings(type),
      };
      state.blocks.push(newBlock);
      state.selectedBlockId = newBlock.id;
      state.unsaved = true;
    }),

    removeBlock: (id) => set((state) => {
      state.blocks = state.blocks.filter((b) => b.id !== id);
      if (state.selectedBlockId === id) {
        state.selectedBlockId = null;
      }
      state.unsaved = true;
    }),

    updateBlock: (id, settings) => set((state) => {
      const block = state.blocks.find((b) => b.id === id);
      if (block) {
        Object.assign(block.settings, settings);
        state.unsaved = true;
      }
    }),

    selectBlock: (id) => set((state) => {
      state.selectedBlockId = id;
    }),

    moveBlock: (id, direction) => set((state) => {
      const idx = state.blocks.findIndex((b) => b.id === id);
      if (idx === -1) return;

      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= state.blocks.length) return;

      [state.blocks[idx], state.blocks[newIdx]] = [
        state.blocks[newIdx],
        state.blocks[idx],
      ];
      state.unsaved = true;
    }),

    duplicateBlock: (id) => set((state) => {
      const block = state.blocks.find((b) => b.id === id);
      if (!block) return;

      const copy: Block = {
        id: `block_${Date.now()}`,
        type: block.type,
        order: state.blocks.length,
        settings: JSON.parse(JSON.stringify(block.settings)),
      };
      state.blocks.push(copy);
      state.selectedBlockId = copy.id;
      state.unsaved = true;
    }),

    reorderBlocks: (blockIds) => set((state) => {
      const newBlocks = blockIds
        .map((id) => state.blocks.find((b) => b.id === id))
        .filter(Boolean) as Block[];
      state.blocks = newBlocks;
      state.unsaved = true;
    }),

    undo: () => set((state) => {
      if (state.history.past.length === 0) return;
      const past = [...state.history.past];
      const present = past.pop()!;
      state.history.future.unshift(state.history.present);
      state.history.past = past;
      state.history.present = present;
      state.blocks = present;
    }),

    redo: () => set((state) => {
      if (state.history.future.length === 0) return;
      const future = [...state.history.future];
      const next = future.shift()!;
      state.history.past.push(state.history.present);
      state.history.future = future;
      state.history.present = next;
      state.blocks = next;
    }),

    reset: () => set((state) => {
      state.blocks = [];
      state.selectedBlockId = null;
      state.unsaved = false;
      state.history = { past: [], present: [], future: [] };
    }),
  }))
);

function getDefaultSettings(type: BlockType): BlockSettings {
  const defaults: Record<BlockType, BlockSettings> = {
    hero: {
      title: '큰 제목을 입력하세요',
      subtitle: '부제목을 입력하세요',
      buttonText: '신청하기',
      buttonUrl: '#',
      backgroundImage: '',
      backgroundColor: '#667eea',
      backgroundOverlay: 0.3,
      height: '500px',
      textAlign: 'center',
    },
    heading: {
      text: '제목을 입력하세요',
      level: 'h2',
      color: '#000000',
      align: 'left',
      margin: { top: '1.5rem', bottom: '1rem' },
    },
    paragraph: {
      text: '텍스트를 입력하세요',
      color: '#666666',
      fontSize: '16px',
      lineHeight: '1.6',
      align: 'left',
    },
    image: {
      alt: '이미지 설명',
      url: 'https://via.placeholder.com/400x300',
      width: '100%',
      borderRadius: '8px',
    },
    button: {
      text: '버튼 텍스트',
      url: '#',
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      style: 'solid',
      size: 'medium',
    },
    list: {
      items: ['항목 1', '항목 2', '항목 3'],
      type: 'bullet',
    },
    faq: {
      items: [
        { question: '질문 1?', answer: '답변 1' },
        { question: '질문 2?', answer: '답변 2' },
      ],
    },
    stats: {
      items: [
        { number: '1000+', label: '고객' },
        { number: '99%', label: '만족도' },
      ],
    },
    spacer: {
      height: '40px',
    },
    divider: {
      color: '#e5e7eb',
      thickness: '2px',
    },
    form: {
      title: '신청 폼',
      fields: [
        { name: 'name', label: '이름', type: 'text', required: true },
        { name: 'phone', label: '전화번호', type: 'tel', required: true },
        { name: 'email', label: '이메일', type: 'email', required: false },
      ],
      submitText: '신청하기',
      successUrl: '/thank-you',
    },
    feature: {
      items: [
        { icon: '✨', title: '기능 1', description: '설명' },
        { icon: '🎯', title: '기능 2', description: '설명' },
        { icon: '🚀', title: '기능 3', description: '설명' },
      ],
    },
  };

  return defaults[type] || {};
}
```

#### Task 1.2: TypeScript 타입 정의
```typescript
// src/types/landing-page.ts

export interface LandingPageBlockData {
  id: string;
  type: BlockType;
  order: number;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type BlockType = 
  | 'hero'
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'button'
  | 'list'
  | 'faq'
  | 'stats'
  | 'spacer'
  | 'divider'
  | 'form'
  | 'feature';

export interface LandingPageData {
  id: string;
  title: string;
  slug: string;
  blocks: LandingPageBlockData[];
  htmlCache?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Task 1.3: Prisma 마이그레이션
```sql
-- prisma/migrations/20260615000000_add_landing_page_blocks/migration.sql

-- 기존 htmlContent 컬럼 유지 (하위호환성)
-- 신규: JSON 구조화 데이터

ALTER TABLE "LandingPage" ADD COLUMN "blocksData" JSONB DEFAULT '[]';

-- 마이그레이션: htmlContent → blocksData 변환은 별도 스크립트

CREATE TABLE "LandingPageBlock" (
  "id" TEXT NOT NULL,
  "landingPageId" INTEGER NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "order" INTEGER NOT NULL,
  "settings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "LandingPageBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_block_landing_page" FOREIGN KEY ("landingPageId") 
    REFERENCES "LandingPage"("id") ON DELETE CASCADE
);

CREATE INDEX "LandingPageBlock_landingPageId" ON "LandingPageBlock"("landingPageId");
CREATE INDEX "LandingPageBlock_type" ON "LandingPageBlock"("type");
```

#### Task 1.4: API 엔드포인트 작성
```typescript
// src/app/api/landing-pages/[id]/blocks/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { z } from 'zod';

const addBlockSchema = z.object({
  type: z.enum(['hero', 'heading', 'paragraph', 'image', 'button', 'list', 'faq', 'stats', 'spacer', 'divider', 'form', 'feature']),
  settings: z.record(z.any()),
});

// POST /api/landing-pages/[id]/blocks
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pageId = parseInt(params.id);
    const page = await prisma.landingPage.findUnique({
      where: { id: pageId },
    });

    if (!page || page.adminId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const { type, settings } = addBlockSchema.parse(body);

    // 마지막 order 구하기
    const lastBlock = await prisma.landingPageBlock.findFirst({
      where: { landingPageId: pageId },
      orderBy: { order: 'desc' },
    });

    const newBlock = await prisma.landingPageBlock.create({
      data: {
        id: `block_${Date.now()}`,
        landingPageId: pageId,
        type,
        order: (lastBlock?.order ?? -1) + 1,
        settings,
      },
    });

    return NextResponse.json(newBlock, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/landing-pages/[id]/blocks/[blockId]
export async function PUT(req: NextRequest, { params }: { params: { id: string; blockId: string } }) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pageId = parseInt(params.id);
    const page = await prisma.landingPage.findUnique({
      where: { id: pageId },
    });

    if (!page || page.adminId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const { settings } = z.object({ settings: z.record(z.any()) }).parse(body);

    const updatedBlock = await prisma.landingPageBlock.update({
      where: { id: params.blockId },
      data: { settings },
    });

    return NextResponse.json(updatedBlock);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/landing-pages/[id]/blocks/[blockId]
export async function DELETE(req: NextRequest, { params }: { params: { id: string; blockId: string } }) {
  try {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pageId = parseInt(params.id);
    const page = await prisma.landingPage.findUnique({
      where: { id: pageId },
    });

    if (!page || page.adminId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.landingPageBlock.delete({
      where: { id: params.blockId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

---

### Phase 1: UI 컴포넌트 (Week 3-4)

#### Task 2.1: 블록 팔레트 컴포넌트
```typescript
// src/components/landing-editor/BlockPalette.tsx

'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/store';
import { BlockType } from '@/types/landing-page';

const BLOCK_CATEGORIES = {
  hero: {
    icon: '🎯',
    label: 'Hero 섹션',
    category: 'Hero & CTA',
    description: 'Hero section with title and button',
  },
  heading: {
    icon: '📝',
    label: 'Heading',
    category: 'Text',
    description: 'Headings H1-H6',
  },
  // ... 기타 블록
};

export function BlockPalette() {
  const [search, setSearch] = useState('');
  const addBlock = useEditorStore((s) => s.addBlock);

  const filteredBlocks = Object.entries(BLOCK_CATEGORIES).filter(([_, data]) => {
    const term = search.toLowerCase();
    return (
      data.label.toLowerCase().includes(term) ||
      data.description.toLowerCase().includes(term)
    );
  });

  const handleDragStart = (e: React.DragEvent, type: BlockType) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('blockType', type);
  };

  return (
    <div className="palette">
      <div className="palette-header">
        <input
          type="text"
          placeholder="🔍 블록 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="palette-search"
        />
      </div>
      <div className="palette-scroll">
        {filteredBlocks.map(([type, data]) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => handleDragStart(e, type as BlockType)}
            className="block-item"
            onClick={() => addBlock(type as BlockType)}
          >
            <div className="block-item-header">
              <span className="block-item-icon">{data.icon}</span>
              <span className="block-item-label">{data.label}</span>
              <button className="block-item-help" type="button">
                ?
              </button>
            </div>
            <div className="block-item-preview">{data.description}</div>
            <div className="block-item-hint">드래그해서 추가</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Task 2.2: 캔버스 컴포넌트
```typescript
// src/components/landing-editor/Canvas.tsx

'use client';

import { useEditorStore } from '@/lib/editor/store';
import { BlockRenderer } from './BlockRenderer';

export function Canvas() {
  const blocks = useEditorStore((s) => s.blocks);
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const selectBlock = useEditorStore((s) => s.selectBlock);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('blockType');
    // Add block logic
  };

  return (
    <div className="canvas-container" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="canvas-scroll">
        <div className="canvas-inner">
          {blocks.length === 0 ? (
            <div className="canvas-empty">
              <div className="canvas-empty-icon">📦</div>
              <div className="canvas-empty-text">블록을 추가하세요</div>
              <div className="canvas-empty-hint">좌측 팔레트에서 드래그해주세요</div>
            </div>
          ) : (
            blocks.map((block) => (
              <div
                key={block.id}
                className={`block ${block.id === selectedBlockId ? 'selected' : ''}`}
                onClick={() => selectBlock(block.id)}
              >
                <BlockRenderer block={block} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

#### Task 2.3: 블록 렌더러
```typescript
// src/components/landing-editor/BlockRenderer.tsx

'use client';

import { Block } from '@/lib/editor/store';

export function BlockRenderer({ block }: { block: Block }) {
  const { type, settings } = block;

  switch (type) {
    case 'hero':
      return (
        <div
          className="block-hero"
          style={{ backgroundColor: settings.backgroundColor }}
        >
          <h1 className="block-hero-title">{settings.title}</h1>
          <p className="block-hero-subtitle">{settings.subtitle}</p>
          <button className="block-hero-btn">{settings.buttonText}</button>
        </div>
      );

    case 'heading':
      const HeadingTag = settings.level || 'h2';
      return (
        <HeadingTag style={{ color: settings.color }}>
          {settings.text}
        </HeadingTag>
      );

    case 'paragraph':
      return <p style={{ color: settings.color }}>{settings.text}</p>;

    case 'image':
      return <img src={settings.url} alt={settings.alt} />;

    // ... 기타 타입

    default:
      return <div>Unknown block type: {type}</div>;
  }
}
```

#### Task 2.4: 설정 패널 컴포넌트
```typescript
// src/components/landing-editor/SettingsPanel.tsx

'use client';

import { useEditorStore } from '@/lib/editor/store';
import { HeroSettings } from './settings/HeroSettings';
import { HeadingSettings } from './settings/HeadingSettings';
// ... 기타 설정 컴포넌트

export function SettingsPanel() {
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId);
  const blocks = useEditorStore((s) => s.blocks);

  if (!selectedBlockId) {
    return (
      <div className="settings">
        <div className="settings-header">
          <span className="settings-title">설정</span>
        </div>
        <div className="settings-scroll">
          <div className="settings-empty">블록을 선택하면 설정이 표시됩니다</div>
        </div>
      </div>
    );
  }

  const block = blocks.find((b) => b.id === selectedBlockId);
  if (!block) return null;

  return (
    <div className="settings">
      <div className="settings-header">
        <span className="settings-title">설정: {block.type.toUpperCase()}</span>
      </div>
      <div className="settings-scroll">
        {block.type === 'hero' && <HeroSettings block={block} />}
        {block.type === 'heading' && <HeadingSettings block={block} />}
        {/* ... 기타 설정 */}
      </div>
      <div className="settings-footer">
        <button onClick={() => resetSettings()}>↻ 초기화</button>
        <button onClick={() => saveSettings()}>✓ 저장</button>
      </div>
    </div>
  );
}
```

---

### Phase 1: 상호작용 & 저장 (Week 5-6)

#### Task 3.1: 실행 취소/다시 실행
```typescript
// 상태 관리에 이미 포함됨
// useEditorStore.undo() / useEditorStore.redo()

// 키보드 단축키
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.shiftKey ? e.key === 'z' : e.key === 'y')) {
      e.preventDefault();
      redo();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [undo, redo]);
```

#### Task 3.2: 저장/로드
```typescript
// src/app/api/landing-pages/[id]/save-blocks/route.ts

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(req);
    const pageId = parseInt(params.id);
    const { blocks } = await req.json();

    // 트랜잭션: 기존 블록 삭제 → 새 블록 생성
    await prisma.$transaction(async (tx) => {
      await tx.landingPageBlock.deleteMany({
        where: { landingPageId: pageId },
      });

      for (const block of blocks) {
        await tx.landingPageBlock.create({
          data: {
            id: block.id,
            landingPageId: pageId,
            type: block.type,
            order: block.order,
            settings: block.settings,
          },
        });
      }

      // htmlCache 생성
      const htmlCache = generateHtmlFromBlocks(blocks);
      await tx.landingPage.update({
        where: { id: pageId },
        data: {
          htmlContent: htmlCache,
          updatedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
```

---

## 🎨 UI 컴포넌트 예시

### 설정 필드 컴포넌트들

```typescript
// src/components/landing-editor/settings/TextField.tsx
export function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        type="text"
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// src/components/landing-editor/settings/ColorField.tsx
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="field-color">
        <input
          type="color"
          className="field-color-preview"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="field-color-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// src/components/landing-editor/settings/SelectField.tsx
export function SelectField({ 
  label, 
  value, 
  options, 
  onChange 
}: SelectFieldProps) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <select
        className="field-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## 📱 반응형 미리보기

```typescript
// src/components/landing-editor/ResponsivePreview.tsx

const RESPONSIVE_SIZES = {
  pc: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function ResponsivePreview() {
  const [size, setSize] = useState<'pc' | 'tablet' | 'mobile'>('pc');
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.maxWidth = RESPONSIVE_SIZES[size];
    }
  }, [size]);

  return (
    <>
      <div className="canvas-controls">
        <span>반응형 미리보기:</span>
        <div className="canvas-responsive">
          {(['pc', 'tablet', 'mobile'] as const).map((s) => (
            <button
              key={s}
              className={`canvas-responsive-tab ${size === s ? 'active' : ''}`}
              onClick={() => setSize(s)}
            >
              {s === 'pc' ? '💻 PC' : s === 'tablet' ? '⌨️ 태블릿' : '📱 모바일'}
            </button>
          ))}
        </div>
      </div>
      <div className="canvas-inner" ref={canvasRef}>
        {/* Canvas content */}
      </div>
    </>
  );
}
```

---

## 🔍 마이그레이션 스크립트

```typescript
// scripts/migrate-landing-pages-to-blocks.ts

import { prisma } from '@/lib/prisma';
import { parseHtmlToBlocks } from '@/lib/html-parser';

async function migrate() {
  const pages = await prisma.landingPage.findMany();

  for (const page of pages) {
    if (!page.htmlContent) continue;

    // HTML 파싱 → 블록 구조
    const blocks = parseHtmlToBlocks(page.htmlContent);

    // blocksData에 저장
    await prisma.landingPage.update({
      where: { id: page.id },
      data: {
        blocksData: blocks,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Migrated page: ${page.title}`);
  }

  console.log('✅ Migration complete!');
}

migrate().catch(console.error);
```

---

## 🧪 테스트 전략

```typescript
// src/__tests__/editor/store.test.ts

import { renderHook, act } from '@testing-library/react';
import { useEditorStore } from '@/lib/editor/store';

describe('EditorStore', () => {
  it('should add a new block', () => {
    const { result } = renderHook(() => useEditorStore());

    act(() => {
      result.current.addBlock('hero');
    });

    expect(result.current.blocks).toHaveLength(1);
    expect(result.current.blocks[0].type).toBe('hero');
  });

  it('should delete a block', () => {
    const { result } = renderHook(() => useEditorStore());

    act(() => {
      result.current.addBlock('hero');
    });

    const blockId = result.current.blocks[0].id;

    act(() => {
      result.current.removeBlock(blockId);
    });

    expect(result.current.blocks).toHaveLength(0);
  });

  it('should update block settings', () => {
    const { result } = renderHook(() => useEditorStore());

    act(() => {
      result.current.addBlock('hero');
    });

    const blockId = result.current.blocks[0].id;

    act(() => {
      result.current.updateBlock(blockId, { title: '새 제목' });
    });

    expect(result.current.blocks[0].settings.title).toBe('새 제목');
  });
});
```

---

## 📦 파일 구조

```
src/
├── components/
│   └── landing-editor/
│       ├── BlockPalette.tsx
│       ├── Canvas.tsx
│       ├── BlockRenderer.tsx
│       ├── SettingsPanel.tsx
│       ├── BlockControls.tsx
│       └── settings/
│           ├── HeroSettings.tsx
│           ├── HeadingSettings.tsx
│           ├── ParagraphSettings.tsx
│           ├── ImageSettings.tsx
│           ├── FormSettings.tsx
│           └── ...
├── lib/
│   └── editor/
│       ├── store.ts (Zustand)
│       ├── html-generator.ts
│       └── html-parser.ts
├── app/
│   ├── (dashboard)/
│   │   └── landing-pages/
│   │       ├── [id]/
│   │       │   ├── page.tsx (에디터)
│   │       │   └── editor-page.tsx (새 에디터)
│   │       └── page.tsx (목록)
│   └── api/
│       └── landing-pages/
│           └── [id]/
│               └── blocks/
│                   ├── route.ts (CRUD)
│                   └── reorder/route.ts
├── types/
│   └── landing-page.ts
└── __tests__/
    └── editor/
        ├── store.test.ts
        └── BlockRenderer.test.tsx
```

---

## 🚀 배포 체크리스트

- [ ] Phase 1 완료 (기초 인프라)
- [ ] Phase 2 완료 (UI 컴포넌트)
- [ ] Phase 3 완료 (상호작용)
- [ ] 모든 테스트 통과 (100% 커버리지)
- [ ] TypeScript 에러 0개 (tsc --noEmit)
- [ ] Lighthouse 90+ 점수
- [ ] 크로스브라우저 테스트 (Chrome, Safari, Firefox)
- [ ] 모바일 반응형 테스트 (iOS, Android)
- [ ] 보안 검토 (XSS, CSRF, SQL Injection 없음)
- [ ] 성능 최적화 (LCP < 2.5s)
- [ ] 접근성 검토 (WCAG 2.1 AA)

---

**최종 업데이트**: 2026-06-15  
**준비 상태**: ✅ 개발 시작 가능
