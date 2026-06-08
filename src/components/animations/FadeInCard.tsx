'use client';

import { useRef, ReactNode } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

/**
 * 재사용 가능한 FadeIn 애니메이션 카드
 * 요소가 화면에 진입하면 페이드인 + 슬라이드업 효과
 *
 * @example
 * <FadeInCard delay={100}>
 *   <h3>Title</h3>
 *   <p>Content</p>
 * </FadeInCard>
 */

interface FadeInCardProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  threshold?: number;
  once?: boolean;
  className?: string;
}

export function FadeInCard({
  children,
  delay = 0,
  duration = 600,
  threshold = 0.1,
  once = true,
  className = '',
}: FadeInCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { threshold, once });

  return (
    <div
      ref={ref}
      style={{
        '--animation-delay': `${delay}ms`,
        '--animation-duration': `${duration}ms`,
      } as React.CSSProperties}
      className={`
        transition-all
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        ${className}
      `}
      // Inline style for animation timing
      onAnimationStart={() => {
        if (ref.current) {
          ref.current.style.transitionDuration = `${duration}ms`;
          ref.current.style.transitionDelay = `${delay}ms`;
        }
      }}
    >
      {children}
    </div>
  );
}
