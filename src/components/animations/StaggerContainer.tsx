'use client';

import { useRef, ReactNode } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

/**
 * 자식 요소들을 순차적으로 애니메이션하는 컨테이너
 * 각 자식이 순차적으로 나타남 (stagger effect)
 *
 * @example
 * <StaggerContainer staggerDelay={150}>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </StaggerContainer>
 */

interface StaggerContainerProps {
  children: ReactNode;
  staggerDelay?: number; // ms between each child animation
  threshold?: number;
  once?: boolean;
  className?: string;
}

export function StaggerContainer({
  children,
  staggerDelay = 100,
  threshold = 0.1,
  once = true,
  className = '',
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { threshold, once });

  return (
    <div
      ref={ref}
      className={className}
      role="region"
      aria-live="polite"
    >
      {Array.isArray(children) &&
        children.map((child, index) => (
          <div
            key={index}
            style={{
              '--stagger-index': index,
              '--stagger-delay': staggerDelay,
              transitionDelay: isVisible ? `${index * staggerDelay}ms` : '0ms',
            } as React.CSSProperties}
            className={`
              transition-all duration-600 ease-out
              ${
                isVisible
                  ? 'opacity-100 translate-x-0 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }
            `}
          >
            {child}
          </div>
        ))}

      {/* 단일 자식 */}
      {!Array.isArray(children) && (
        <div
          className={`
            transition-all duration-600 ease-out
            ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
        >
          {children}
        </div>
      )}
    </div>
  );
}
