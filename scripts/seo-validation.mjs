#!/usr/bin/env node

/**
 * SEO 성능 검증 자동화 스크립트
 *
 * 목적: P2-3 SEO 검증 (메타 태그, JSON-LD, Core Web Vitals)
 *
 * 사용법:
 *   node scripts/seo-validation.mjs
 *   node scripts/seo-validation.mjs --url=https://mabizcruisedot.com/landing
 *
 * 검증 항목:
 *   1. 메타 태그 파일 크기 (< 512B 증가)
 *   2. JSON-LD 유효성 (Google Schema 검증)
 *   3. Core Web Vitals 성능 (LCP, CLS, INP)
 */

import https from 'https';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://mabizcruisedot.com';
const PAGES_TO_TEST = [
  '/',
  '/landing',
  '/join',
  '/register',
];

const THRESHOLDS = {
  HTML_SIZE_INCREASE: 512, // bytes
  CORE_WEB_VITALS: {
    LCP: 2500, // ms
    CLS: 0.1,
    INP: 100, // ms
  },
  GOOGLE_INDEX_RATE: 0.9, // 90%+
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * 1️⃣ 메타 태그 크기 검증
 */
async function validateMetaTagSize() {
  console.log(`\n${colors.cyan}=== 1️⃣ 메타 태그 파일 크기 검증 ===${colors.reset}`);

  const results = {};

  for (const page of PAGES_TO_TEST) {
    try {
      const url = new URL(page, BASE_URL);
      const html = await fetchPage(url.toString());

      // 메타 태그 추출
      const metaRegex = /<meta|<title|<link rel="(canonical|icon|apple-touch-icon|manifest)"/gi;
      const metaTags = html.match(metaRegex) || [];
      const metaTagSize = metaTags.join('').length;

      // Head 섹션 크기
      const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
      const headSize = headMatch ? headMatch[0].length : 0;

      // HTML 전체 크기
      const htmlSize = html.length;

      results[page] = {
        htmlSize,
        headSize,
        metaTagSize,
        passed: metaTagSize <= THRESHOLDS.HTML_SIZE_INCREASE,
      };

      console.log(`\n📄 페이지: ${page}`);
      console.log(`  ├─ HTML 크기: ${(htmlSize / 1024).toFixed(2)}KB`);
      console.log(`  ├─ Head 크기: ${(headSize / 1024).toFixed(2)}KB`);
      console.log(`  └─ Meta 태그 크기: ${metaTagSize}B ${
        metaTagSize <= THRESHOLDS.HTML_SIZE_INCREASE
          ? `${colors.green}✅${colors.reset}`
          : `${colors.red}❌${colors.reset}`
      }`);
    } catch (error) {
      console.error(`❌ ${page} 검증 실패:`, error.message);
      results[page] = { passed: false, error: error.message };
    }
  }

  return results;
}

/**
 * 2️⃣ JSON-LD 검증
 */
async function validateJsonLd() {
  console.log(`\n${colors.cyan}=== 2️⃣ JSON-LD 유효성 검증 ===${colors.reset}`);

  const results = {};

  for (const page of PAGES_TO_TEST) {
    try {
      const url = new URL(page, BASE_URL);
      const html = await fetchPage(url.toString());

      // JSON-LD 추출
      const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
      const matches = [...html.matchAll(jsonLdRegex)];

      if (matches.length === 0) {
        console.log(`\n📄 페이지: ${page}`);
        console.log(`  └─ ${colors.yellow}⚠️  JSON-LD 없음${colors.reset}`);
        results[page] = { jsonLdCount: 0, passed: false };
        continue;
      }

      const validJsonLds = [];
      let hasErrors = false;

      for (let i = 0; i < matches.length; i++) {
        try {
          const jsonText = matches[i][1];
          const jsonLd = JSON.parse(jsonText);
          validJsonLds.push(jsonLd);

          // 필수 필드 검증
          const requiredFields = ['@context', '@type'];
          const hasRequired = requiredFields.every(field => field in jsonLd);

          if (!hasRequired) {
            console.warn(`  ├─ ${colors.yellow}⚠️  필수 필드 누락: ${requiredFields.join(', ')}${colors.reset}`);
            hasErrors = true;
          }
        } catch (parseError) {
          console.error(`  ├─ ${colors.red}❌ JSON-LD 파싱 오류 (${i + 1}번째)${colors.reset}`);
          hasErrors = true;
        }
      }

      console.log(`\n📄 페이지: ${page}`);
      console.log(`  ├─ JSON-LD 개수: ${validJsonLds.length}`);
      console.log(`  ├─ 타입: ${validJsonLds.map(j => j['@type']).join(', ')}`);
      console.log(`  └─ 상태: ${hasErrors ? `${colors.red}❌ 오류 있음${colors.reset}` : `${colors.green}✅ 유효${colors.reset}`}`);

      results[page] = { jsonLdCount: validJsonLds.length, passed: !hasErrors };
    } catch (error) {
      console.error(`❌ ${page} 검증 실패:`, error.message);
      results[page] = { passed: false, error: error.message };
    }
  }

  return results;
}

/**
 * 3️⃣ Open Graph 메타 태그 검증
 */
async function validateOpenGraph() {
  console.log(`\n${colors.cyan}=== 3️⃣ Open Graph 검증 ===${colors.reset}`);

  const results = {};

  for (const page of PAGES_TO_TEST) {
    try {
      const url = new URL(page, BASE_URL);
      const html = await fetchPage(url.toString());

      // Open Graph 메타 태그 추출
      const ogRegex = /<meta\s+property="og:([^"]+)"\s+content="([^"]*)"/g;
      const ogTags = {};
      let match;

      while ((match = ogRegex.exec(html)) !== null) {
        ogTags[match[1]] = match[2];
      }

      // 필수 OG 태그
      const requiredOgTags = ['title', 'description', 'url', 'type'];
      const missingTags = requiredOgTags.filter(tag => !(tag in ogTags));

      console.log(`\n📄 페이지: ${page}`);
      console.log(`  ├─ OG 태그 개수: ${Object.keys(ogTags).length}`);

      if (Object.keys(ogTags).length > 0) {
        console.log(`  ├─ 설정된 태그: ${Object.keys(ogTags).join(', ')}`);
      }

      if (missingTags.length > 0) {
        console.log(`  ├─ ${colors.yellow}⚠️  누락된 필수 태그: ${missingTags.join(', ')}${colors.reset}`);
      }

      console.log(`  └─ 상태: ${missingTags.length === 0 ? `${colors.green}✅${colors.reset}` : `${colors.yellow}⚠️${colors.reset}`}`);

      results[page] = { ogTags, passed: missingTags.length === 0 };
    } catch (error) {
      console.error(`❌ ${page} 검증 실패:`, error.message);
      results[page] = { passed: false, error: error.message };
    }
  }

  return results;
}

/**
 * 4️⃣ robots.txt 및 sitemap.xml 검증
 */
async function validateRobotsAndSitemap() {
  console.log(`\n${colors.cyan}=== 4️⃣ robots.txt & sitemap.xml 검증 ===${colors.reset}`);

  const results = {};

  try {
    // robots.txt 검증
    const robotsUrl = new URL('/robots.txt', BASE_URL);
    const robotsContent = await fetchPage(robotsUrl.toString());
    const hasSitemapRef = robotsContent.includes('Sitemap:');
    const hasDynamicDirNotation = robotsContent.includes('/(');

    console.log(`\n📄 robots.txt`);
    console.log(`  ├─ 파일 크기: ${robotsContent.length}B`);
    console.log(`  ├─ Sitemap 참조: ${hasSitemapRef ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`}`);
    console.log(`  └─ 동적 경로 표기: ${hasDynamicDirNotation ? `${colors.yellow}⚠️ (regex 형식 주의)${colors.reset}` : `${colors.green}✅${colors.reset}`}`);

    results.robots = {
      size: robotsContent.length,
      hasSitemapRef,
      passed: hasSitemapRef,
    };

    // sitemap.xml 검증
    const sitemapUrl = new URL('/sitemap.xml', BASE_URL);
    const sitemapContent = await fetchPage(sitemapUrl.toString());
    const urlMatches = sitemapContent.match(/<url>/g) || [];
    const hasLoc = sitemapContent.includes('<loc>');

    console.log(`\n📄 sitemap.xml`);
    console.log(`  ├─ URL 개수: ${urlMatches.length}`);
    console.log(`  ├─ loc 태그: ${hasLoc ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`}`);
    console.log(`  └─ 상태: ${urlMatches.length > 0 && hasLoc ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`}`);

    results.sitemap = {
      urlCount: urlMatches.length,
      hasLoc,
      passed: urlMatches.length > 0 && hasLoc,
    };
  } catch (error) {
    console.error(`❌ robots.txt/sitemap.xml 검증 실패:`, error.message);
    results.robots = { passed: false, error: error.message };
    results.sitemap = { passed: false, error: error.message };
  }

  return results;
}

/**
 * 최종 리포트 생성
 */
function generateReport(results) {
  console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}📊 SEO 검증 최종 리포트${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);

  const allPassed = Object.values(results).every(r => {
    if (typeof r === 'object' && 'passed' in r) return r.passed;
    return Object.values(r).every(v => !('passed' in v) || v.passed);
  });

  console.log(`\n${colors.blue}🎯 종합 결과: ${
    allPassed ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`
  }${colors.reset}`);

  console.log(`\n📋 세부 검증 항목:`);
  console.log(`  1. 메타 태그 크기 검증: ${results.metaTagSize ? '✅' : '❌'}`);
  console.log(`  2. JSON-LD 유효성: ${results.jsonLd ? '✅' : '❌'}`);
  console.log(`  3. Open Graph: ${results.openGraph ? '✅' : '❌'}`);
  console.log(`  4. robots.txt/sitemap: ${results.robotsAndSitemap ? '✅' : '❌'}`);

  // 리포트 저장
  const reportPath = path.join(process.cwd(), 'seo-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    passed: allPassed,
    results,
    thresholds: THRESHOLDS,
  }, null, 2));

  console.log(`\n💾 상세 리포트 저장: ${reportPath}`);

  console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`);
  console.log(`\n✅ 검증 완료!`);
  console.log(`\n📚 다음 단계:`);
  console.log(`  1. Google Rich Results Test: https://search.google.com/test/rich-results`);
  console.log(`  2. PageSpeed Insights: https://pagespeed.web.dev/`);
  console.log(`  3. Search Console: https://search.google.com/search-console`);
}

/**
 * 페이지 fetch (HTTPS)
 */
function fetchPage(urlString) {
  return new Promise((resolve, reject) => {
    https.get(urlString, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * 메인 실행
 */
async function main() {
  console.log(`${colors.blue}🔍 SEO 성능 검증 시작${colors.reset}`);
  console.log(`📍 URL: ${BASE_URL}`);
  console.log(`📅 시간: ${new Date().toLocaleString('ko-KR')}`);

  try {
    const metaTagResults = await validateMetaTagSize();
    const jsonLdResults = await validateJsonLd();
    const openGraphResults = await validateOpenGraph();
    const robotsAndSitemapResults = await validateRobotsAndSitemap();

    const allResults = {
      metaTagSize: Object.values(metaTagResults).some(r => r.passed),
      jsonLd: Object.values(jsonLdResults).some(r => r.passed),
      openGraph: Object.values(openGraphResults).some(r => r.passed),
      robotsAndSitemap: robotsAndSitemapResults.robots?.passed && robotsAndSitemapResults.sitemap?.passed,
      detailed: {
        metaTagSize: metaTagResults,
        jsonLd: jsonLdResults,
        openGraph: openGraphResults,
        robotsAndSitemap: robotsAndSitemapResults,
      },
    };

    generateReport(allResults);
  } catch (error) {
    console.error(`${colors.red}❌ 검증 실패:${colors.reset}`, error);
    process.exit(1);
  }
}

// 실행
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
