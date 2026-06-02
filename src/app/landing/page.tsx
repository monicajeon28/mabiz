'use client';

import React, { useState, useEffect } from 'react';
import HeroSection from '@/components/landing/HeroSection';
import ProblemSection from '@/components/landing/ProblemSection';
import SolutionSection from '@/components/landing/SolutionSection';
import ProofSection from '@/components/landing/ProofSection';
import OfferSection from '@/components/landing/OfferSection';
import UrgencySection from '@/components/landing/UrgencySection';
import CTASection from '@/components/landing/CTASection';
import { track } from '@/lib/landing/analytics';

export default function LandingPage() {
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
    <div className="bg-white">
      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 z-50 transition-all duration-300"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Main content */}
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <ProofSection />
      <OfferSection />
      <UrgencySection />
      <CTASection />
    </div>
  );
}
