'use client';

import { useRef, ReactNode } from 'react';
import { useScrollProgress } from '@/lib/hooks';

/**
 * Parallax 스크롤 효과 컴포넌트
 * 스크롤 진행에 따라 배경/콘텐츠가 다른 속도로 움직임
 *
 * @example
 * <ParallaxScroll speed={0.5}>
 *   <div className="bg-blue-500">Background</div>
 *   <div className="text-white">Content</div>
 * </ParallaxScroll>
 */

interface ParallaxScrollProps {
  children: ReactNode;
  speed?: number; // 0-1, 낮을수록 느림
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

export function ParallaxScroll({
  children,
  speed = 0.5,
  direction = 'up',
  className = '',
}: ParallaxScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);

  // 진행률을 변환값으로 변환
  const getTransform = () => {
    const offset = progress * 100 * speed; // 최대 이동량

    switch (direction) {
      case 'up':
        return `translateY(-${offset}px)`;
      case 'down':
        return `translateY(${offset}px)`;
      case 'left':
        return `translateX(-${offset}px)`;
      case 'right':
        return `translateX(${offset}px)`;
      default:
        return `translateY(-${offset}px)`;
    }
  };

  return (
    <div
      ref={ref}
      className={`overflow-hidden ${className}`}
    >
      <div
        style={{
          transform: getTransform(),
          transition: 'transform 0.1s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
