'use client';

import { useEffect, useRef, useState, RefObject } from 'react';

/**
 * Framer Motion 동작 유사 CSS 애니메이션 Hook
 * 설치된 framer-motion 라이브러리와 유사한 API 제공
 */

export interface AnimationVariant {
  initial: Record<string, any>;
  animate: Record<string, any>;
  transition?: {
    duration?: number;
    delay?: number;
    ease?: 'easeIn' | 'easeOut' | 'easeInOut' | 'linear';
  };
}

export interface UseAnimationOptions {
  variants?: Record<string, AnimationVariant>;
  animate?: string;
  initial?: string;
  onComplete?: () => void;
  disabled?: boolean;
}

/**
 * CSS 기반 Framer Motion 유사 애니메이션 Hook
 * Intersection Observer와 통합
 *
 * @example
 * const controls = useAnimation();
 * const ref = useRef<HTMLDivElement>(null);
 *
 * useEffect(() => {
 *   if (isVisible) {
 *     controls.start('animate');
 *   }
 * }, [isVisible]);
 *
 * return (
 *   <motion.div
 *     ref={ref}
 *     animate={controls}
 *     variants={variants}
 *   />
 * );
 */

export interface AnimationControls {
  start: (variant: string) => Promise<void>;
  stop: () => void;
  set: (variant: string) => void;
}

export function useAnimation(
  options: UseAnimationOptions = {}
): AnimationControls {
  const { variants = {}, disabled = false } = options;
  const elementRef = useRef<HTMLElement | null>(null);
  const animationRef = useRef<Animation | null>(null);

  const start = async (variantKey: string): Promise<void> => {
    if (disabled || !elementRef.current || !variants[variantKey]) {
      return;
    }

    const variant = variants[variantKey];
    const animateProps = variant.animate;
    const transitionConfig = variant.transition ?? {};

    // CSS 문자열로 변환
    const styleUpdates = Object.entries(animateProps).reduce(
      (acc, [key, value]) => {
        const cssKey = camelToKebab(key);
        acc.push(`${cssKey}: ${value};`);
        return acc;
      },
      [] as string[]
    );

    const duration = transitionConfig.duration ?? 300;
    const delay = transitionConfig.delay ?? 0;
    const easeValue = easeFunction(transitionConfig.ease ?? 'easeInOut');

    // 기존 애니메이션 중지
    if (animationRef.current) {
      animationRef.current.cancel();
    }

    // Web Animation API로 애니메이션 실행
    const keyframes = [
      variant.initial || {},
      animateProps,
    ];

    try {
      animationRef.current = elementRef.current.animate(keyframes, {
        duration,
        delay,
        easing: easeValue,
        fill: 'forwards',
      });

      await animationRef.current.finished;
      options.onComplete?.();
    } catch (error) {
      console.error('Animation failed:', error);
    }
  };

  const stop = () => {
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }
  };

  const set = (variantKey: string) => {
    if (!elementRef.current || !variants[variantKey]) {
      return;
    }

    const variant = variants[variantKey];
    Object.assign(elementRef.current.style, variant.animate);
  };

  return {
    start,
    stop,
    set,
  };
}

/**
 * Framer Motion의 `whileInView` 유사 Hook
 * 요소가 화면에 보일 때 자동 애니메이션 시작
 */
export function useInViewAnimation(
  ref: RefObject<HTMLElement>,
  animationVariants: Record<string, AnimationVariant>,
  options: {
    trigger?: 'immediately' | 'onScroll';
    threshold?: number;
    once?: boolean;
  } = {}
) {
  const { trigger = 'onScroll', threshold = 0.2, once = true } = options;
  const [isInView, setIsInView] = useState(false);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) {
      return;
    }

    if (trigger === 'immediately') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          hasTriggeredRef.current = true;

          if (once && ref.current) {
            observer.unobserve(ref.current);
          }
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold }
    );

    observer.observe(ref.current);

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
      observer.disconnect();
    };
  }, [ref, trigger, threshold, once]);

  return isInView;
}

/**
 * Stagger 애니메이션 Hook
 * 여러 자식 요소를 순차적으로 애니메이션
 */
export interface StaggerAnimationOptions {
  staggerChildren?: number; // ms
  delayChildren?: number; // ms
}

export function useStaggerAnimation(
  parentRef: RefObject<HTMLElement>,
  options: StaggerAnimationOptions = {}
) {
  const { staggerChildren = 100, delayChildren = 0 } = options;

  useEffect(() => {
    if (!parentRef.current) return;

    const children = parentRef.current.querySelectorAll('[data-stagger]');

    children.forEach((child, index) => {
      const element = child as HTMLElement;
      const delay = delayChildren + index * staggerChildren;
      element.style.setProperty('--animation-delay', `${delay}ms`);
    });
  }, [parentRef, staggerChildren, delayChildren]);
}

// Helper Functions

/**
 * camelCase를 kebab-case로 변환
 */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Easing 함수 이름을 CSS 값으로 변환
 */
function easeFunction(ease: string): string {
  const easeMap: Record<string, string> = {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear',
  };

  return easeMap[ease] || easeMap.easeInOut;
}

/**
 * Object를 CSS 문자열로 변환
 */
export function styleToCSS(style: Record<string, any>): string {
  return Object.entries(style)
    .map(([key, value]) => `${camelToKebab(key)}: ${value};`)
    .join(' ');
}
