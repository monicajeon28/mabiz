/**
 * Landing 클라이언트 래퍼
 *
 * 목적:
 * - 'use client' 로직 분리 (page.tsx는 정적 렌더링)
 * - 스크롤 추적, 진행률 표시 등 클라이언트 기능
 * - page.tsx 메타 태그 활성화 유지
 */

'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { track } from '@/lib/landing/analytics';

interface LandingClientWrapperProps {
  readonly children: ReactNode;
}

export default function LandingClientWrapper({
  children,
}: LandingClientWrapperProps) {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Page view tracking
    track('landing_page_view', {
      timestamp: new Date().toISOString(),
      source: new URLSearchParams(window.location.search).get('source') || 'organic',
    });

    // Scroll depth tracking at 25%, 50%, 75%, 100%
    const depthIntervals = [25, 50, 75, 100];
    const trackedDepths = new Set<number>();

    const handleDepthScroll = () => {
      depthIntervals.forEach((depth) => {
        if (scrollProgress >= depth && !trackedDepths.has(depth)) {
          trackedDepths.add(depth);
          track('scroll_depth', { depth });
        }
      });
    };

    handleDepthScroll();
  }, [scrollProgress]);

  return (
    <>
      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 z-50 transition-all duration-300"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Main content */}
      {children}
    </>
  );
}
