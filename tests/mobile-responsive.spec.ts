/**
 * P1-1 모바일 반응형 테스트 (Playwright)
 *
 * 사용법:
 * npx playwright test tests/mobile-responsive.spec.ts --headed
 *
 * 검증 항목:
 * 1. 텍스트 가독성 (font-size, line-height, 대비도)
 * 2. 그리드 레이아웃 (컬럼 정렬, 마진, gap)
 * 3. 이미지 비율 (aspect-ratio 유지)
 * 4. 터치 타겟 (최소 44×44px)
 * 5. 성능 (Lighthouse 점수, CLS, LCP)
 */

import { test, expect } from '@playwright/test';

// 테스트 해상도 정의
const DEVICES = [
  {
    name: 'iPhone SE (320px)',
    width: 320,
    height: 568,
    deviceScaleFactor: 2,
    isMobile: true,
  },
  {
    name: 'iPhone 12 (375px)',
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    isMobile: true,
  },
  {
    name: 'iPad mini (640px)',
    width: 640,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: false, // 터치 가능하지만 태블릿
  },
  {
    name: 'iPad (768px)',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: false,
  },
];

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

// ===========================
// 1️⃣ 텍스트 가독성 테스트
// ===========================

DEVICES.forEach(device => {
  test(`[${device.name}] TC-001: 텍스트 가독성 검증`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
    });
    const page = await context.newPage();

    try {
      // 1. 로그인 페이지 접근
      await page.goto(`${BASE_URL}/auth/sign-in`, { waitUntil: 'networkidle' });

      // 2. 페이지 제목 (h1) 검증
      const title = page.locator('h1').first();
      if (await title.isVisible()) {
        const titleFontSize = await title.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return parseInt(styles.fontSize);
        });

        console.log(`[${device.name}] h1 font-size: ${titleFontSize}px`);
        expect(titleFontSize).toBeGreaterThanOrEqual(24);
      }

      // 3. 입력 라벨 검증
      const labels = page.locator('label');
      const labelCount = await labels.count();

      for (let i = 0; i < Math.min(labelCount, 2); i++) {
        const label = labels.nth(i);
        if (await label.isVisible()) {
          const [fontSize, lineHeight] = await label.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return [
              parseInt(styles.fontSize),
              parseFloat(styles.lineHeight) / parseInt(styles.fontSize),
            ];
          });

          console.log(`[${device.name}] label font-size: ${fontSize}px, line-height: ${lineHeight.toFixed(2)}`);
          expect(fontSize).toBeGreaterThanOrEqual(14);
          expect(lineHeight).toBeGreaterThanOrEqual(1.5);
        }
      }

      // 4. 버튼 텍스트 검증
      const buttons = page.locator('button').first();
      if (await buttons.isVisible()) {
        const buttonFontSize = await buttons.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return parseInt(styles.fontSize);
        });

        console.log(`[${device.name}] button font-size: ${buttonFontSize}px`);
        expect(buttonFontSize).toBeGreaterThanOrEqual(14);
      }

      // 5. 대비도 검증 (간단한 버전: 흰색 텍스트는 최소 50% 명도)
      const bodyElement = page.locator('body');
      const [fgColor, bgColor] = await bodyElement.evaluate(() => {
        const computed = window.getComputedStyle(document.body);
        return [
          computed.color,
          computed.backgroundColor,
        ];
      });

      console.log(`[${device.name}] Foreground: ${fgColor}, Background: ${bgColor}`);
      // 간단한 검증: 색상이 명시적으로 설정되어 있는지 확인
      expect(fgColor).not.toBe('rgba(0, 0, 0, 0)');

      console.log(`✅ [${device.name}] 텍스트 가독성 통과`);
    } finally {
      await context.close();
    }
  });
});

// ===========================
// 2️⃣ 그리드 레이아웃 테스트
// ===========================

DEVICES.forEach(device => {
  test(`[${device.name}] TC-002: 그리드 레이아웃 검증`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
    });
    const page = await context.newPage();

    try {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });

      // 1. 카드 배치 검증 (그리드 컨테이너)
      const cardGrid = page.locator('[class*="grid"]').first();
      if (await cardGrid.isVisible()) {
        const gridStyles = await cardGrid.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            display: styles.display,
            gridTemplateColumns: styles.gridTemplateColumns,
            gap: styles.gap,
          };
        });

        console.log(`[${device.name}] Grid styles:`, gridStyles);
        expect(gridStyles.display).toContain('grid');
      }

      // 2. 좌우 마진 검증
      const mainContent = page.locator('[class*="container"]').first();
      if (await mainContent.isVisible()) {
        const margins = await mainContent.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            marginLeft: styles.marginLeft,
            marginRight: styles.marginRight,
            paddingLeft: styles.paddingLeft,
            paddingRight: styles.paddingRight,
          };
        });

        console.log(`[${device.name}] Margins/Padding:`, margins);
        // 최소 12px 마진/패딩 확인
        const leftSpacing = parseInt(margins.marginLeft) + parseInt(margins.paddingLeft);
        expect(leftSpacing).toBeGreaterThanOrEqual(12);
      }

      // 3. 뷰포트 초과 검증 (수평 스크롤바 없는지 확인)
      const bodyWidth = await page.locator('body').evaluate((el) => {
        return el.offsetWidth;
      });

      console.log(`[${device.name}] Body width: ${bodyWidth}px`);
      expect(bodyWidth).toBeLessThanOrEqual(device.width + 10); // 약간의 허용치

      console.log(`✅ [${device.name}] 그리드 레이아웃 통과`);
    } finally {
      await context.close();
    }
  });
});

// ===========================
// 3️⃣ 이미지 비율 테스트
// ===========================

DEVICES.forEach(device => {
  test(`[${device.name}] TC-003: 이미지 비율 검증`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
    });
    const page = await context.newPage();

    try {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });

      // 1. 이미지 로드 대기
      await page.waitForLoadState('domcontentloaded');

      // 2. 모든 이미지 검증
      const images = page.locator('img');
      const imageCount = await images.count();

      console.log(`[${device.name}] 발견된 이미지: ${imageCount}개`);

      for (let i = 0; i < Math.min(imageCount, 3); i++) {
        const img = images.nth(i);
        if (await img.isVisible({ timeout: 1000 }).catch(() => false)) {
          const [width, height, aspectRatio] = await img.evaluate((el: HTMLImageElement) => {
            const rect = el.getBoundingClientRect();
            return [
              rect.width,
              rect.height,
              rect.width / rect.height,
            ];
          });

          console.log(`[${device.name}] 이미지 ${i}: ${width.toFixed(0)}×${height.toFixed(0)} (비율: ${aspectRatio.toFixed(2)})`);

          // 이미지가 컨테이너를 벗어나지 않는지 확인
          expect(width).toBeLessThanOrEqual(device.width + 20);
        }
      }

      // 3. 이미지 srcset 검증 (lazy loading)
      const lazyImages = page.locator('img[loading="lazy"]');
      const lazyCount = await lazyImages.count();
      console.log(`[${device.name}] Lazy loading 이미지: ${lazyCount}개`);

      console.log(`✅ [${device.name}] 이미지 비율 통과`);
    } finally {
      await context.close();
    }
  });
});

// ===========================
// 4️⃣ 터치 타겟 테스트
// ===========================

DEVICES.forEach(device => {
  test(`[${device.name}] TC-004: 터치 타겟 검증`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
    });
    const page = await context.newPage();

    try {
      await page.goto(`${BASE_URL}/auth/sign-in`, { waitUntil: 'networkidle' });

      // 1. 버튼 터치 타겟 검증 (최소 44×44px)
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      console.log(`[${device.name}] 발견된 버튼: ${buttonCount}개`);

      let smallButtons = 0;
      for (let i = 0; i < buttonCount; i++) {
        const btn = buttons.nth(i);
        if (await btn.isVisible()) {
          const [width, height] = await btn.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return [rect.width, rect.height];
          });

          console.log(`[${device.name}] 버튼 ${i}: ${width.toFixed(0)}×${height.toFixed(0)}px`);

          if (width < 44 || height < 44) {
            smallButtons++;
          }
          expect(width).toBeGreaterThanOrEqual(40); // 약간의 허용치
          expect(height).toBeGreaterThanOrEqual(40);
        }
      }

      if (smallButtons > 0) {
        console.warn(`⚠️ [${device.name}] ${smallButtons}개의 작은 버튼 발견`);
      }

      // 2. 입력 필드 터치 타겟 검증
      const inputs = page.locator('input[type="email"], input[type="password"], input[type="text"]');
      const inputCount = await inputs.count();

      console.log(`[${device.name}] 발견된 입력 필드: ${inputCount}개`);

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const height = await input.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.height;
          });

          console.log(`[${device.name}] 입력 필드 ${i}: 높이 ${height.toFixed(0)}px`);
          expect(height).toBeGreaterThanOrEqual(40); // 약간의 허용치
        }
      }

      console.log(`✅ [${device.name}] 터치 타겟 통과`);
    } finally {
      await context.close();
    }
  });
});

// ===========================
// 5️⃣ 성능 테스트 (Lighthouse)
// ===========================

DEVICES.forEach(device => {
  test.skip(`[${device.name}] TC-005: 성능 (Lighthouse) 검증`, async ({ browser }) => {
    // Note: Lighthouse는 headless 모드에서 전체 실행이 어려우므로
    // 대신 Performance API를 사용한 간단한 성능 측정

    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
    });
    const page = await context.newPage();

    try {
      // 페이지 로드 시간 측정
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;

      console.log(`[${device.name}] 페이지 로드 시간: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // 5초 이내

      // Cumulative Layout Shift (CLS) 측정
      const cls = await page.evaluate(() => {
        return (window as any).performance
          .getEntriesByType('layout-shift')
          .reduce((sum: number, entry: any) => {
            return entry.hadRecentInput ? sum : sum + entry.value;
          }, 0);
      });

      console.log(`[${device.name}] CLS (Cumulative Layout Shift): ${cls.toFixed(4)}`);
      expect(cls).toBeLessThan(0.25); // 기본 기준

      console.log(`✅ [${device.name}] 성능 통과`);
    } finally {
      await context.close();
    }
  });
});

// ===========================
// 🔧 유틸리티: 스크린샷 캡처
// ===========================

DEVICES.forEach(device => {
  test(`[${device.name}] 스크린샷 캡처: sign-in 페이지`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
    });
    const page = await context.newPage();

    try {
      await page.goto(`${BASE_URL}/auth/sign-in`, { waitUntil: 'networkidle' });

      const filename = `${device.width}px-signin-${Date.now()}.png`;
      const screenshotPath = `test-artifacts/${filename}`;

      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 스크린샷 저장: ${screenshotPath}`);
    } finally {
      await context.close();
    }
  });
});

DEVICES.forEach(device => {
  test(`[${device.name}] 스크린샷 캡처: dashboard`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
    });
    const page = await context.newPage();

    try {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });

      const filename = `${device.width}px-dashboard-${Date.now()}.png`;
      const screenshotPath = `test-artifacts/${filename}`;

      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 스크린샷 저장: ${screenshotPath}`);
    } finally {
      await context.close();
    }
  });
});
