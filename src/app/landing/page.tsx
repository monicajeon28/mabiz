/**
 * Landing 페이지 (SEO 최적화 버전)
 *
 * 변경 사항:
 * 1. 'use client' 제거 → 정적 렌더링으로 메타 태그 활성화
 * 2. 스크롤 추적은 클라이언트 컴포넌트로 분리
 * 3. JSON-LD 스키마는 layout.tsx에서 주입
 *
 * 이유: 'use client' 컴포넌트에서는 메타 태그가 무시됨
 * 해결: 정적 서버 컴포넌트로 변경하여 메타 태그 활성화
 */

import React from 'react';
import HeroSection from '@/components/landing/HeroSection';
import ProblemSection from '@/components/landing/ProblemSection';
import SolutionSection from '@/components/landing/SolutionSection';
import ProofSection from '@/components/landing/ProofSection';
import OfferSection from '@/components/landing/OfferSection';
import UrgencySection from '@/components/landing/UrgencySection';
import CTASection from '@/components/landing/CTASection';
import LandingClientWrapper from '@/components/landing/LandingClientWrapper';

export default function LandingPage() {
  return (
    <LandingClientWrapper>
      <div className="bg-white">
        {/* Main content */}
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <ProofSection />
        <OfferSection />
        <UrgencySection />
        <CTASection />
      </div>
    </LandingClientWrapper>
  );
}
