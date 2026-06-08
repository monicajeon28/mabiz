/**
 * 마비즈 CRM 타이포그래피 컴포넌트
 *
 * 10개의 재사용 가능한 Typography 컴포넌트:
 * - Heading, Body, Caption, Label, Code
 * - Number, Stat, Highlight, Hero, Breadcrumb
 *
 * 모두 TypeScript 완벽 지원 + 접근성 WCAG 2.1 AA 준수
 */

import React from "react";
import type { ReactNode, CSSProperties, ElementType } from "react";
import {
  combineClasses,
  formatNumber,
  formatNumberKO,
  getHeadingClass,
  getBodyClass,
  type HeadingLevel,
  type BodySize,
  type NumberFormat,
  type LineHeight,
} from "@/lib/fonts";

/* ================================================================
   1. Heading 컴포넌트 (h1-h6)
   ================================================================ */

interface HeadingProps {
  level: HeadingLevel;
  children: ReactNode;
  className?: string;
  id?: string;
  align?: "left" | "center" | "right";
}

/**
 * 제목 컴포넌트 (h1-h6)
 *
 * @example
 * <Heading level="h1">페이지 제목</Heading>
 * <Heading level="h2" align="center">중앙 정렬 부제목</Heading>
 */
export function Heading({
  level,
  children,
  className,
  id,
  align = "left",
}: HeadingProps): React.ReactElement {
  const Tag = level as ElementType;
  const baseClass = getHeadingClass(level);
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  const finalClass = combineClasses(baseClass, alignClass, className);

  return (
    <Tag id={id} className={finalClass}>
      {children}
    </Tag>
  );
}

/* ================================================================
   2. Body 컴포넌트 (본문 텍스트)
   ================================================================ */

interface BodyProps {
  size?: BodySize;
  children: ReactNode;
  className?: string;
  as?: "p" | "div" | "span";
  lineHeight?: LineHeight;
  muted?: boolean;
}

/**
 * 본문 텍스트 컴포넌트
 *
 * @example
 * <Body>일반 본문입니다.</Body>
 * <Body size="sm">작은 본문입니다.</Body>
 * <Body as="div" muted>보조 텍스트입니다.</Body>
 */
export function Body({
  size = "base",
  children,
  className,
  as = "p",
  lineHeight = "relaxed",
  muted = false,
}: BodyProps): React.ReactElement {
  const Tag = as as ElementType;
  const baseClass = getBodyClass(size);
  const mutedClass = muted ? "text-muted-foreground" : "text-foreground";
  const lineHeightClass = {
    tight: "leading-tight",
    normal: "leading-normal",
    relaxed: "leading-relaxed",
    loose: "leading-loose",
  }[lineHeight];

  const finalClass = combineClasses(baseClass, mutedClass, lineHeightClass, className);

  return (
    <Tag className={finalClass}>
      {children}
    </Tag>
  );
}

/* ================================================================
   3. Caption 컴포넌트 (작은 텍스트)
   ================================================================ */

interface CaptionProps {
  children: ReactNode;
  className?: string;
  as?: "span" | "div" | "p";
  uppercase?: boolean;
}

/**
 * 캡션 텍스트 (12px, 보조 정보)
 *
 * @example
 * <Caption>최종 수정: 2026-06-09</Caption>
 * <Caption uppercase>선택사항</Caption>
 */
export function Caption({
  children,
  className,
  as = "span",
  uppercase = false,
}: CaptionProps): React.ReactElement {
  const Tag = as as ElementType;
  const uppercaseClass = uppercase ? "uppercase" : "";

  const finalClass = combineClasses(
    "text-xs text-muted-foreground leading-snug",
    uppercaseClass,
    className
  );

  return (
    <Tag className={finalClass}>
      {children}
    </Tag>
  );
}

/* ================================================================
   4. Label 컴포넌트 (폼 라벨)
   ================================================================ */

interface LabelProps {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  required?: boolean;
}

/**
 * 폼 라벨 컴포넌트 (13px)
 *
 * @example
 * <Label htmlFor="email">이메일</Label>
 * <Label required>필수 항목</Label>
 */
export function Label({
  children,
  htmlFor,
  className,
  required = false,
}: LabelProps): React.ReactElement {
  return (
    <label
      htmlFor={htmlFor}
      className={combineClasses(
        "text-sm font-medium leading-snug text-foreground",
        className
      )}
    >
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}

/* ================================================================
   5. Code 컴포넌트 (인라인 코드)
   ================================================================ */

interface CodeProps {
  children: ReactNode;
  className?: string;
  inline?: boolean;
  copy?: boolean;
}

/**
 * 인라인 또는 블록 코드 컴포넌트
 *
 * @example
 * <Code>const message = "Hello"</Code>
 * <Code inline>npm install</Code>
 */
export function Code({
  children,
  className,
  inline = true,
  copy = false,
}: CodeProps): React.ReactElement {
  const Tag = inline ? "code" : "pre";
  const baseClass = inline
    ? "bg-muted px-2 py-1 rounded font-mono text-sm"
    : "bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto";

  const handleCopy = async () => {
    if (copy && typeof children === "string") {
      await navigator.clipboard.writeText(children);
    }
  };

  return React.createElement(Tag, {
    className: combineClasses(baseClass, className),
    onClick: handleCopy,
    role: copy ? "button" : undefined,
    tabIndex: copy ? 0 : undefined,
    children,
  });
}

/* ================================================================
   6. Number 컴포넌트 (숫자 포맷팅)
   ================================================================ */

interface NumberProps {
  value: number;
  format?: NumberFormat;
  locale?: "en-US" | "ko-KR";
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * 숫자 포맷팅 컴포넌트
 *
 * @example
 * <Number value={1234.56} format="currency" locale="ko-KR" />
 * // 결과: ₩1,234.56 (또는 원화 기호)
 *
 * <Number value={0.456} format="percent" />
 * // 결과: 45.6%
 */
export function Number({
  value,
  format = "default",
  locale = "en-US",
  className,
  prefix,
  suffix,
}: NumberProps): React.ReactElement {
  const formatted =
    locale === "ko-KR"
      ? formatNumberKO(value, format)
      : formatNumber(value, format, locale);

  return (
    <span className={combineClasses("font-tabular-nums", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/* ================================================================
   7. Stat 컴포넌트 (통계 박스)
   ================================================================ */

interface StatProps {
  label: string;
  value: number | string;
  unit?: string;
  change?: number;
  className?: string;
  format?: NumberFormat;
}

/**
 * 통계 박스 (레이블 + 값)
 *
 * @example
 * <Stat
 *   label="총 매출"
 *   value={1234567}
 *   unit="원"
 *   change={12.5}
 *   format="currency"
 * />
 */
export function Stat({
  label,
  value,
  unit,
  change,
  className,
  format = "default",
}: StatProps): React.ReactElement {
  const isNumeric = typeof value === "number";
  const displayValue = isNumeric ? (
    <Number value={value} format={format} />
  ) : (
    value
  );

  return (
    <div className={combineClasses("flex flex-col gap-1", className)}>
      <Caption>{label}</Caption>
      <div className="flex items-baseline gap-2">
        <Heading level="h3" className="text-2xl">
          {displayValue}
        </Heading>
        {unit && <Caption>{unit}</Caption>}
        {change !== undefined && (
          <Caption
            className={change >= 0 ? "text-green-600" : "text-red-600"}
          >
            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
          </Caption>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   8. Highlight 컴포넌트 (강조 텍스트)
   ================================================================ */

interface HighlightProps {
  children: ReactNode;
  color?: "yellow" | "blue" | "green" | "red" | "gold";
  className?: string;
  bold?: boolean;
}

/**
 * 강조 텍스트 컴포넌트
 *
 * @example
 * <Body>이것은 <Highlight color="gold">중요한</Highlight> 내용입니다.</Body>
 */
export function Highlight({
  children,
  color = "yellow",
  className,
  bold = false,
}: HighlightProps): React.ReactElement {
  const colorClass = {
    yellow: "bg-yellow-200 text-yellow-900",
    blue: "bg-blue-200 text-blue-900",
    green: "bg-green-200 text-green-900",
    red: "bg-red-200 text-red-900",
    gold: "bg-gold-100 text-gold-500",
  }[color];

  const boldClass = bold ? "font-semibold" : "";

  return (
    <mark className={combineClasses(colorClass, boldClass, className)}>
      {children}
    </mark>
  );
}

/* ================================================================
   9. Hero 컴포넌트 (히어로 섹션)
   ================================================================ */

interface HeroProps {
  title: string;
  subtitle?: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
}

/**
 * 히어로 섹션 컴포넌트
 *
 * @example
 * <Hero
 *   title="크루즈닷 파트너 CRM"
 *   subtitle="차별화된 영업 도구"
 *   description="모든 고객을 한 곳에서 관리하세요"
 *   align="center"
 * />
 */
export function Hero({
  title,
  subtitle,
  description,
  className,
  align = "center",
}: HeroProps): React.ReactElement {
  const alignClass = align === "center" ? "text-center" : "text-left";

  return (
    <section className={combineClasses("space-y-4", alignClass, className)}>
      {subtitle && (
        <Caption uppercase className="text-primary">
          {subtitle}
        </Caption>
      )}
      <Heading level="h1" className="text-4xl">
        {title}
      </Heading>
      {description && (
        <Body size="lg" muted>
          {description}
        </Body>
      )}
    </section>
  );
}

/* ================================================================
   10. Breadcrumb 컴포넌트 (경로 네비게이션)
   ================================================================ */

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: string;
}

/**
 * 브레드크럼 네비게이션 컴포넌트
 *
 * @example
 * <Breadcrumb
 *   items={[
 *     { label: "홈", href: "/" },
 *     { label: "고객관리", href: "/contacts" },
 *     { label: "상세 정보" },
 *   ]}
 * />
 */
export function Breadcrumb({
  items,
  className,
  separator = "/",
}: BreadcrumbProps): React.ReactElement {
  return (
    <nav
      className={combineClasses("flex items-center gap-2", className)}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <Caption className="text-muted-foreground">{separator}</Caption>
          )}
          {item.href ? (
            <a
              href={item.href}
              className="text-primary hover:underline"
            >
              <Caption>{item.label}</Caption>
            </a>
          ) : (
            <Caption className="text-foreground font-medium">
              {item.label}
            </Caption>
          )}
        </div>
      ))}
    </nav>
  );
}

/* ================================================================
   타입 exports (외부에서 사용)
   ================================================================ */

export type {
  HeadingProps,
  BodyProps,
  CaptionProps,
  LabelProps,
  CodeProps,
  NumberProps,
  StatProps,
  HighlightProps,
  HeroProps,
  BreadcrumbProps,
  BreadcrumbItem,
};
