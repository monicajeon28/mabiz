'use client';

import { useRef, useState, useEffect } from 'react';
import { useIntersectionObserver } from '@/lib/hooks';

/**
 * Scroll 진입 시 숫자를 카운트업하는 컴포넌트
 * Trust badge로 자주 사용됨 (예: "10,000+ 고객")
 *
 * @example
 * <CountUpNumber end={10000} duration={2000} suffix="+" prefix="$" />
 */

interface CountUpNumberProps {
  end: number;
  start?: number;
  duration?: number; // ms
  prefix?: string;
  suffix?: string;
  decimals?: number;
  threshold?: number;
  className?: string;
}

export function CountUpNumber({
  end,
  start = 0,
  duration = 2000,
  prefix = '',
  suffix = '',
  decimals = 0,
  threshold = 0.2,
  className = '',
}: CountUpNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(start);
  const isVisible = useIntersectionObserver(ref, { threshold, once: true });
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!isVisible || hasStartedRef.current) return;

    hasStartedRef.current = true;

    const startTime = Date.now();
    const increment = end - start;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentCount = start + increment * easeProgress;
      setCount(Math.round(currentCount * Math.pow(10, decimals)) / Math.pow(10, decimals));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);

    return () => {
      hasStartedRef.current = false;
    };
  }, [isVisible, end, start, duration, decimals]);

  const displayNumber = decimals > 0
    ? count.toFixed(decimals)
    : count.toString();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {displayNumber.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      {suffix}
    </span>
  );
}
