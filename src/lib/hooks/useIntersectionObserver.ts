'use client';

import { useEffect, useRef, useState, useCallback, RefObject } from 'react';

/**
 * IntersectionObserver Hook 설정
 * - once: true → 애니메이션 1회만 실행
 * - once: false → 반복 실행
 */
export interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  once?: boolean;
}

/**
 * Intersection Observer를 활용한 애니메이션 트리거 Hook
 * SSR 안전, 언마운트 시 정리
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * const isVisible = useIntersectionObserver(ref, { once: true });
 *
 * return (
 *   <div
 *     ref={ref}
 *     className={isVisible ? 'animate-fadeIn' : 'opacity-0'}
 *   >
 *     Content
 *   </div>
 * );
 */
export function useIntersectionObserver<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseIntersectionObserverOptions = {}
): boolean {
  const { threshold = 0.1, rootMargin = '0px', once = true } = options;
  const [isVisible, setIsVisible] = useState(false);
  const hasBeenVisibleRef = useRef(false);

  useEffect(() => {
    // SSR 환경에서 IntersectionObserver 없음
    if (typeof window === 'undefined' || !ref.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          hasBeenVisibleRef.current = true;

          if (once && ref.current) {
            observer.unobserve(ref.current);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(ref.current);

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
      observer.disconnect();
    };
  }, [threshold, rootMargin, once]);

  return isVisible;
}

/**
 * 지연된 시작 Intersection Observer Hook
 * 요소가 보여진 후 N초 후에 애니메이션 시작
 *
 * @example
 * const isVisible = useDelayedIntersectionObserver(ref, { delay: 300 });
 */
export interface UseDelayedIntersectionObserverOptions
  extends UseIntersectionObserverOptions {
  delay?: number; // ms
}

export function useDelayedIntersectionObserver<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseDelayedIntersectionObserverOptions = {}
): boolean {
  const { delay = 0, ...observerOptions } = options;
  const [isDelayedVisible, setIsDelayedVisible] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isIntersecting) {
          setIsIntersecting(true);

          if (delay > 0) {
            timeoutRef.current = setTimeout(() => {
              setIsDelayedVisible(true);
            }, delay);
          } else {
            setIsDelayedVisible(true);
          }

          if (observerOptions.once && ref.current) {
            observer.unobserve(ref.current);
          }
        } else if (!observerOptions.once && !entry.isIntersecting) {
          setIsIntersecting(false);
          setIsDelayedVisible(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        }
      },
      {
        threshold: observerOptions.threshold ?? 0.1,
        rootMargin: observerOptions.rootMargin ?? '0px',
      }
    );

    observer.observe(ref.current);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (ref.current) {
        observer.unobserve(ref.current);
      }
      observer.disconnect();
    };
  }, [delay, isIntersecting, observerOptions]);

  return isDelayedVisible;
}

/**
 * 다중 요소 관찰 Hook
 * 여러 요소의 가시성을 한 번에 관리
 *
 * @example
 * const refs = [ref1, ref2, ref3];
 * const visibilities = useMultipleIntersectionObservers(refs);
 * // visibilities = [true, false, true]
 */
export function useMultipleIntersectionObservers<T extends HTMLElement>(
  refs: RefObject<T | null>[],
  options: UseIntersectionObserverOptions = {}
): boolean[] {
  const { threshold = 0.1, rootMargin = '0px', once = true } = options;
  const [visibilities, setVisibilities] = useState<boolean[]>(
    refs.map(() => false)
  );
  const hasBeenVisibleRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = refs.findIndex((ref) => ref.current === entry.target);
          if (index === -1) return;

          if (entry.isIntersecting) {
            setVisibilities((prev) => {
              const next = [...prev];
              next[index] = true;
              return next;
            });
            hasBeenVisibleRef.current.add(index);

            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setVisibilities((prev) => {
              const next = [...prev];
              next[index] = false;
              return next;
            });
          }
        });
      },
      { threshold, rootMargin }
    );

    refs.forEach((ref) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      refs.forEach((ref) => {
        if (ref.current) {
          observer.unobserve(ref.current);
        }
      });
      observer.disconnect();
    };
  }, [refs, threshold, rootMargin, once]);

  return visibilities;
}

/**
 * Scroll 기반 진행률 Hook
 * 요소가 화면에서 차지하는 비율 반환 (0-1)
 *
 * @example
 * const progress = useScrollProgress(ref);
 * // progress = 0.5 → 50% 스크롤됨
 */
export function useScrollProgress<T extends HTMLElement>(
  ref: RefObject<T | null>
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            const viewportHeight = window.innerHeight;

            // 요소의 상단이 화면 하단에서 얼마나 떨어져 있는가
            const distanceFromBottom = viewportHeight - rect.top;
            const elementHeight = rect.height;

            // 0 = 아직 나타나지 않음, 1 = 완전히 지나감
            const progress = Math.min(
              1,
              Math.max(0, distanceFromBottom / (elementHeight + viewportHeight))
            );

            setProgress(progress);
          }
        });
      },
      { threshold: Array.from({ length: 101 }, (_, i) => i / 100) }
    );

    observer.observe(ref.current);

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
      observer.disconnect();
    };
  }, [ref]);

  return progress;
}
