/**
 * 마비즈 CRM 폰트 설정 (TypeScript)
 *
 * 3가지 폰트 패밀리:
 * 1. Noto Sans KR (한글 본문) - Google Fonts
 * 2. Poppins (영문/숫자) - Google Fonts (조건부 로드)
 * 3. GMarket Sans (제목/브랜드) - 로컬 파일 (선택사항)
 *
 * 타입 안전 + 성능 최적화 + CSS-in-JS 호환
 */

import { Noto_Sans_KR } from "next/font/google";

/* ================================================================
   1. 폰트 정의 (Noto Sans KR - 필수)
   ================================================================ */

export const notoSansKR = Noto_Sans_KR({
  weight: ["400", "600", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI"],
  preload: true,
  // Note: Next.js/Google Fonts doesn't have a "korean" subset,
  // but Noto Sans KR includes Korean glyphs by default.
  // No subset restriction needed for this font.
});

/* ================================================================
   2. TypeScript 타입 정의
   ================================================================ */

/**
 * 사용 가능한 제목 레벨 (h1-h6)
 */
export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/**
 * 사용 가능한 본문 크기
 */
export type BodySize = "base" | "sm" | "xs" | "lg";

/**
 * 폰트 가중치 옵션
 */
export type FontWeight = "normal" | "semibold" | "bold";

/**
 * Tailwind CSS 폰트 패밀리 키
 */
export type FontFamily = "sans" | "heading" | "mono" | "en";

/**
 * 숫자 포맷 옵션
 */
export type NumberFormat = "default" | "currency" | "percent" | "decimal";

/**
 * 라인높이 옵션
 */
export type LineHeight = "tight" | "normal" | "relaxed" | "loose";

/* ================================================================
   3. 폰트 크기 상수 (CSS 클래스명 매핑)
   ================================================================ */

export const FONT_SIZES = {
  // 제목
  display: "text-3xl",  // 32px
  h1: "text-2xl",       // 28px
  h2: "text-xl",        // 24px
  h3: "text-lg",        // 20px
  h4: "text-base",      // 16px
  h5: "text-sm",        // 14px
  h6: "text-xs",        // 12px

  // 본문
  body: "text-base",    // 16px
  "body-sm": "text-sm", // 14px
  body_xs: "text-xs",   // 12px
  body_lg: "text-lg",   // 18px

  // 특수
  caption: "text-xs",   // 12px
  label: "text-sm",     // 13px
} as const;

/**
 * 제목 레벨별 Tailwind 클래스
 */
export const HEADING_CLASSES: Record<HeadingLevel, string> = {
  h1: "text-4xl font-bold",      // 36px
  h2: "text-3xl font-bold",      // 30px
  h3: "text-2xl font-semibold",  // 24px
  h4: "text-xl font-semibold",   // 20px
  h5: "text-lg font-semibold",   // 18px
  h6: "text-base font-semibold", // 16px
} as const;

/**
 * 본문 크기별 Tailwind 클래스
 */
export const BODY_CLASSES: Record<BodySize, string> = {
  base: "text-base leading-relaxed",   // 16px
  sm: "text-sm leading-normal",        // 14px
  xs: "text-xs leading-snug",          // 12px
  lg: "text-lg leading-relaxed",       // 18px
} as const;

/**
 * 폰트 가중치별 Tailwind 클래스
 */
export const WEIGHT_CLASSES: Record<FontWeight, string> = {
  normal: "font-normal",     // 400
  semibold: "font-semibold", // 600
  bold: "font-bold",         // 700
} as const;

/**
 * 라인높이별 Tailwind 클래스
 */
export const LINE_HEIGHT_CLASSES: Record<LineHeight, string> = {
  tight: "leading-tight",      // 1.2
  normal: "leading-normal",    // 1.5
  relaxed: "leading-relaxed",  // 1.7
  loose: "leading-loose",      // 2
} as const;

/* ================================================================
   4. 유틸리티 함수
   ================================================================ */

/**
 * 제목 Tailwind 클래스 생성
 * @example getHeadingClass("h1") // "text-4xl font-bold"
 */
export function getHeadingClass(level: HeadingLevel): string {
  return HEADING_CLASSES[level];
}

/**
 * 본문 Tailwind 클래스 생성
 * @example getBodyClass("base") // "text-base leading-relaxed"
 */
export function getBodyClass(size: BodySize): string {
  return BODY_CLASSES[size];
}

/**
 * 숫자 포맷팅 (통화, 백분율 등)
 * @example formatNumber(1234.56, "currency") // "$1,234.56"
 */
export function formatNumber(
  value: number,
  format: NumberFormat = "default",
  locale: string = "en-US"
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: format === "currency" ? "currency" :
           format === "percent" ? "percent" :
           "decimal",
    currency: format === "currency" ? "USD" : undefined,
    minimumFractionDigits: format === "percent" ? 1 : 2,
    maximumFractionDigits: format === "percent" ? 1 : 2,
  });

  return formatter.format(value);
}

/**
 * 한국어 숫자 포맷팅
 * @example formatNumberKO(1234.56, "currency") // "₩1,234.56"
 */
export function formatNumberKO(
  value: number,
  format: NumberFormat = "default"
): string {
  const formatter = new Intl.NumberFormat("ko-KR", {
    style: format === "currency" ? "currency" :
           format === "percent" ? "percent" :
           "decimal",
    currency: format === "currency" ? "KRW" : undefined,
    minimumFractionDigits: format === "percent" ? 0 : 0,
    maximumFractionDigits: format === "percent" ? 0 : 0,
  });

  return formatter.format(value);
}

/**
 * 조건부 Tailwind 클래스 결합
 * @example combineClasses("text-lg", isBold && "font-bold")
 *          // "text-lg font-bold"
 */
export function combineClasses(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * 폰트 변수 CSS 생성 (서버 컴포넌트)
 * @example getFontVariableStyle(notoSansKR)
 *          // "font-noto-sans-kr: var(--font-noto-sans-kr)"
 */
export function getFontVariableStyle(fontVariable: string): Record<string, string> {
  return {
    "--font-noto-sans-kr": fontVariable,
  } as unknown as Record<string, string>;
}

/**
 * 접근성을 고려한 라인높이 계산
 * WCAG AAA 권장: 1.5 이상 (소수 텍스트), 1.3 이상 (일반 텍스트)
 */
export function getAccessibleLineHeight(fontSize: number): number {
  if (fontSize >= 18) return 1.3; // 본문 (16-20px)
  if (fontSize >= 14) return 1.4; // 소제목
  return 1.5; // 작은 텍스트 (12px 이하)
}

/* ================================================================
   5. CSS 변수 (globals.css와 동기화)
   ================================================================ */

export const CSS_VARIABLES = {
  fontFamily: {
    notoSansKR: "var(--font-noto-sans-kr)",
    system: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI",
  },
  fontSize: {
    display: "32px",
    h1: "28px",
    h2: "24px",
    h3: "20px",
    h4: "16px",
    body: "16px",
    "body-sm": "14px",
    caption: "12px",
  },
  lineHeight: {
    tight: "1.2",
    normal: "1.5",
    relaxed: "1.7",
    loose: "2",
  },
  letterSpacing: {
    tight: "-0.02em",
    normal: "0",
    loose: "0.02em",
  },
} as const;

/* ================================================================
   6. 브랜드 폰트 스택 (fallback 포함)
   ================================================================ */

export const FONT_STACK = {
  /**
   * 본문: Noto Sans KR → System UI → fallback
   */
  body: [
    "var(--font-noto-sans-kr)",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "sans-serif",
  ].join(", "),

  /**
   * 제목: Noto Sans KR (700) → System UI → fallback
   */
  heading: [
    "var(--font-noto-sans-kr)",
    "system-ui",
    "-apple-system",
    "sans-serif",
  ].join(", "),

  /**
   * 코드: Menlo → Monaco → Courier New → Monospace
   */
  mono: [
    "Menlo",
    "Monaco",
    "Courier New",
    "monospace",
  ].join(", "),

  /**
   * 영문: Poppins (선택사항, 나중에 추가)
   */
  en: [
    "Poppins",
    "system-ui",
    "-apple-system",
    "sans-serif",
  ].join(", "),
} as const;

/* ================================================================
   7. 성능 최적화 힌트
   ================================================================ */

export const PERFORMANCE_HINTS = {
  /**
   * Font Display 전략
   * "swap" = 시스템 폰트로 즉시 표시 후 Google 폰트 로드 (권장)
   * "block" = 최대 3초 기다렸다가 시스템 폰트로 fallback
   * "fallback" = 100ms 기다렸다가 fallback, 이후 캐시로 표시
   * "optional" = 로딩 중이면 폰트 사용 중지
   */
  fontDisplay: "swap",

  /**
   * 로드할 폰트 부분집합 (한글만)
   * - korean: 한글 (Noto Sans KR)
   * - latin: 영문 (Poppins)
   * - latin-ext: 확장 영문 (불필요)
   * - cyrillic: 키릴 문자 (불필요)
   */
  subsets: ["korean"],

  /**
   * preload 우선순위
   * Noto Sans KR (본문) = true (높음)
   * Poppins (영문) = false (낮음, 필요시만)
   */
  preload: true,

  /**
   * 권장 로딩 순서
   * 1. Noto Sans KR (본문)
   * 2. Poppins (선택사항, 숫자/영문)
   * 3. GMarket Sans (로컬, 제목만)
   */
  loadingOrder: ["noto-sans-kr", "poppins", "gmarket-sans"],
} as const;

/* ================================================================
   8. Next.js 13+ 호환성 확인
   ================================================================ */

export const NEXT_JS_VERSION = {
  minVersion: "13.0.0",
  testedWith: "15.0.0+",
  features: [
    "next/font/google",
    "CSS variables in layout.tsx",
    "Tailwind CSS v3+",
    "TypeScript 5+",
  ],
} as const;
