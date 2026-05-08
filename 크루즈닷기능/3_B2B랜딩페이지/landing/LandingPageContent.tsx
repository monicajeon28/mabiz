'use client';

import Script from 'next/script';
import { normalizeLandingHtmlContent } from '@/lib/landing-html';

interface LandingPageContentProps {
  htmlContent: string;
  headerScript?: string | null;
}

export default function LandingPageContent({ htmlContent, headerScript }: LandingPageContentProps) {
  return (
    <>
      {headerScript && (
        // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
        <Script
          id="landing-page-header-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: headerScript }}
        />
      )}
      <div
        dangerouslySetInnerHTML={{ __html: normalizeLandingHtmlContent(htmlContent || '') }}
        className="landing-page-content"
      />
    </>
  );
}

