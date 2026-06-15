/**
 * Landing Page Block System Types
 * Russell Brunson 형식 기반 모듈식 블록 시스템
 * 기본 6개 + 선택형 4개 (비디오, 타이머, 후기, FAQ)
 */

export type BlockType =
  | "heading"       // 제목
  | "body"          // 본문
  | "image"         // 이미지
  | "cta"           // 버튼
  | "divider"       // 구분선
  | "footer"        // 하단
  | "video"         // 선택형: 영상
  | "timer"         // 선택형: 카운트다운
  | "testimonial"   // 선택형: 후기
  | "faq";          // 선택형: FAQ

export interface BlockBase {
  id: string;
  type: BlockType;
  order: number;
}

// 각 블록 타입별 데이터 구조
export interface HeadingBlock extends BlockBase {
  type: "heading";
  data: {
    text: string;
    align: "left" | "center" | "right";
    fontSize?: "small" | "medium" | "large" | "xl";
  };
}

export interface BodyBlock extends BlockBase {
  type: "body";
  data: {
    text: string;
    fontSize?: "small" | "medium" | "large";
  };
}

export interface ImageBlock extends BlockBase {
  type: "image";
  data: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
    aspectRatio?: string; // "16/9", "4/3", "1/1" 등
  };
}

export interface CtaBlock extends BlockBase {
  type: "cta";
  data: {
    text: string;
    color: "blue" | "red" | "green" | "yellow" | "dark";
    size?: "small" | "medium" | "large";
    action?: string; // scroll | submit | link
    actionTarget?: string;
  };
}

export interface DividerBlock extends BlockBase {
  type: "divider";
  data: {
    style?: "solid" | "dashed" | "dotted";
    color?: string;
  };
}

export interface FooterBlock extends BlockBase {
  type: "footer";
  data: {
    text: string;
    align?: "left" | "center" | "right";
  };
}

export interface VideoBlock extends BlockBase {
  type: "video";
  data: {
    url: string;
    thumbnail?: string;
    autoplay?: boolean;
    loop?: boolean;
  };
}

export interface TimerBlock extends BlockBase {
  type: "timer";
  data: {
    deadline: string; // ISO 8601 datetime
    enabled: boolean;
    title?: string;
  };
}

export interface TestimonialBlock extends BlockBase {
  type: "testimonial";
  data: {
    items: Array<{
      id: string;
      text: string;
      author: string;
      role?: string;
      image?: string;
    }>;
  };
}

export interface FaqBlock extends BlockBase {
  type: "faq";
  data: {
    items: Array<{
      id: string;
      question: string;
      answer: string;
    }>;
  };
}

export type Block =
  | HeadingBlock
  | BodyBlock
  | ImageBlock
  | CtaBlock
  | DividerBlock
  | FooterBlock
  | VideoBlock
  | TimerBlock
  | TestimonialBlock
  | FaqBlock;

export interface BlocksConfig {
  blocks: Block[];
  selectedFeatures: {
    video: boolean;
    timer: boolean;
    testimonial: boolean;
    faq: boolean;
  };
}

// 블록 생성 헬퍼 함수
export function createBlock(type: BlockType, order: number = 0): Block {
  const id = crypto.randomUUID();

  switch (type) {
    case "heading":
      return {
        id,
        type: "heading",
        order,
        data: { text: "제목을 입력하세요", align: "center", fontSize: "large" },
      } as HeadingBlock;

    case "body":
      return {
        id,
        type: "body",
        order,
        data: { text: "본문 텍스트를 입력하세요", fontSize: "medium" },
      } as BodyBlock;

    case "image":
      return {
        id,
        type: "image",
        order,
        data: { url: "", alt: "이미지", aspectRatio: "16/9" },
      } as ImageBlock;

    case "cta":
      return {
        id,
        type: "cta",
        order,
        data: { text: "신청하기", color: "blue", size: "large" },
      } as CtaBlock;

    case "divider":
      return {
        id,
        type: "divider",
        order,
        data: { style: "solid", color: "#e5e7eb" },
      } as DividerBlock;

    case "footer":
      return {
        id,
        type: "footer",
        order,
        data: { text: "저작권 정보", align: "center" },
      } as FooterBlock;

    case "video":
      return {
        id,
        type: "video",
        order,
        data: { url: "", autoplay: false, loop: false },
      } as VideoBlock;

    case "timer":
      return {
        id,
        type: "timer",
        order,
        data: {
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          enabled: true,
          title: "마감까지",
        },
      } as TimerBlock;

    case "testimonial":
      return {
        id,
        type: "testimonial",
        order,
        data: {
          items: [
            { id: crypto.randomUUID(), text: "후기를 입력하세요", author: "고객명", role: "직급" },
          ],
        },
      } as TestimonialBlock;

    case "faq":
      return {
        id,
        type: "faq",
        order,
        data: {
          items: [
            { id: crypto.randomUUID(), question: "질문을 입력하세요?", answer: "답변을 입력하세요." },
          ],
        },
      } as FaqBlock;

    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}

// 블록 라이브러리 정의 (UI에서 사용)
export const BASIC_BLOCKS = [
  { type: "heading" as BlockType, label: "제목", icon: "📄" },
  { type: "body" as BlockType, label: "본문", icon: "📝" },
  { type: "image" as BlockType, label: "이미지", icon: "🖼️" },
  { type: "cta" as BlockType, label: "버튼", icon: "🔘" },
  { type: "divider" as BlockType, label: "구분선", icon: "─" },
  { type: "footer" as BlockType, label: "하단", icon: "📌" },
] as const;

export const OPTIONAL_BLOCKS = [
  { type: "video" as BlockType, label: "영상", icon: "🎬" },
  { type: "timer" as BlockType, label: "타이머", icon: "⏱️" },
  { type: "testimonial" as BlockType, label: "후기", icon: "💬" },
  { type: "faq" as BlockType, label: "FAQ", icon: "❓" },
] as const;

// 블록 렌더링 미리보기 텍스트
export function getBlockPreview(block: Block): string {
  switch (block.type) {
    case "heading":
      return `📄 제목: "${(block as HeadingBlock).data.text.substring(0, 30)}"`;
    case "body":
      return `📝 본문: "${(block as BodyBlock).data.text.substring(0, 30)}"`;
    case "image":
      return `🖼️ 이미지: ${(block as ImageBlock).data.alt}`;
    case "cta":
      return `🔘 버튼: "${(block as CtaBlock).data.text}"`;
    case "divider":
      return "─ 구분선";
    case "footer":
      return `📌 하단: "${(block as FooterBlock).data.text.substring(0, 20)}"`;
    case "video":
      return "🎬 영상";
    case "timer":
      return "⏱️ 타이머";
    case "testimonial":
      return `💬 후기 ${(block as TestimonialBlock).data.items.length}개`;
    case "faq":
      return `❓ FAQ ${(block as FaqBlock).data.items.length}개`;
    default:
      return "블록";
  }
}
