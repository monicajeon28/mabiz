# E2E 테스트 빠른 참고서 (Cheat Sheet)

**버전**: 1.0  
**작성일**: 2026-06-08  
**용도**: 업무 중 빠르게 참고할 수 있는 명령어/코드 스니펫

---

## ⚡ 자주 쓰는 명령어

### 테스트 실행

```powershell
# 전체 E2E 테스트 (모든 해상도)
npm run test:e2e

# 특정 해상도만 테스트
npm run test:e2e:320px
npm run test:e2e:375px
npm run test:e2e:640px
npm run test:e2e:768px

# UI 모드 (시각화)
npm run test:e2e:ui

# 디버그 모드 (한 줄씩)
npm run test:e2e:debug

# 특정 테스트만
npx playwright test -g "TC-E2E-001"
npx playwright test tests/mobile-responsive.spec.ts

# HTML 리포트 보기
npm run test:e2e:report
```

---

## 📝 Playwright 코드 스니펫

### 페이지 접근

```typescript
// 페이지 열기
await page.goto('/dashboard');
await page.goto('http://localhost:3000/dashboard');

// URL 확인
expect(page.url()).toContain('/dashboard');
await expect(page).toHaveURL('/dashboard');
```

### 요소 찾기 (Locator)

```typescript
// ✅ 권장 방법
page.locator('[data-testid="login-button"]');
page.getByRole('button', { name: 'Login' });
page.getByText('Sign In');
page.getByLabel('Email');

// ❌ 피할 것 (자주 깨짐)
page.locator('div > button:nth-child(2)');
page.locator('button.btn-primary.active');
```

### 클릭 및 입력

```typescript
// 클릭
await page.locator('[data-testid="button"]').click();
await page.click('button:has-text("Login")');

// 입력
await page.fill('[data-testid="email"]', 'test@example.com');
await page.locator('input[type="password"]').fill('password123');

// 엔터 키
await page.press('[data-testid="email"]', 'Enter');

// 선택 (dropdown)
await page.selectOption('select', 'value');
```

### 대기 (Waiting)

```typescript
// 요소 표시 대기
await page.locator('[data-testid="loaded"]').waitFor();
await page.waitForSelector('[data-testid="content"]');

// 네트워크 대기 (권장)
await page.waitForLoadState('networkidle');
await page.waitForLoadState('load');

// 타임아웃 설정
await page.locator('[data-testid="button"]').isVisible({ timeout: 5000 });

// 특정 시간 대기 (피할 것 - 마지막 수단)
await page.waitForTimeout(1000);
```

### Assertion (검증)

```typescript
// 존재 여부
await expect(page.locator('[data-testid="button"]')).toBeVisible();
await expect(page.locator('[data-testid="button"]')).toBeHidden();

// 텍스트
await expect(page.locator('h1')).toContainText('Dashboard');
await expect(page.locator('h1')).toHaveText('Dashboard');

// CSS 스타일
await expect(page.locator('h1')).toHaveCSS('font-size', '28px');
await expect(page.locator('h1')).toHaveCSS('color', /rgb/);

// 속성
await expect(page.locator('input')).toHaveAttribute('type', 'email');
await expect(page.locator('button')).toHaveAttribute('disabled');

// 개수
await expect(page.locator('button')).toHaveCount(3);
await expect(page.locator('tr')).toHaveCount(10);

// 상태
await expect(page.locator('input')).toBeDisabled();
await expect(page.locator('input')).toBeEnabled();
await expect(page.locator('input')).toBeChecked();

// Soft Assertion (계속 실행)
await expect.soft(element).toHaveText('Text');
```

### 계산된 스타일

```typescript
// font-size 가져오기
const fontSize = await page.evaluate(
  (selector) => {
    const el = document.querySelector(selector);
    return window.getComputedStyle(el).fontSize;
  },
  '[data-testid="title"]'
);
expect(parseInt(fontSize)).toBeGreaterThanOrEqual(24);

// BoundingBox 가져오기 (너비, 높이, 좌표)
const box = await page.locator('[data-testid="button"]').boundingBox();
console.log(`Width: ${box.width}, Height: ${box.height}`);
expect(box.width).toBeGreaterThanOrEqual(44);
```

### 스크린샷

```typescript
// 전체 페이지 스크린샷
await page.screenshot({ path: 'screenshot.png' });

// 요소 스크린샷
await page.locator('[data-testid="card"]').screenshot({ path: 'card.png' });

// 뷰포트 기준 (디바이스 크기)
await page.screenshot({ path: 'mobile.png', fullPage: true });
```

### 뷰포트 (해상도)

```typescript
// 뷰포트 설정
await page.setViewportSize({ width: 320, height: 568 });
await page.setViewportSize({ width: 375, height: 812 });
await page.setViewportSize({ width: 640, height: 1024 });
await page.setViewportSize({ width: 768, height: 1024 });

// 뷰포트 가져오기
const viewport = page.viewportSize();
```

---

## 🔍 자주 쓰는 검증 기준값

### 텍스트 (Typography)

```typescript
// 최소 글자 크기: 14px
expect(fontSize >= 14).toBeTruthy();

// line-height 비율: 1.5배 이상
const lineHeight = parseInt(computed.lineHeight);
const fontSize = parseInt(computed.fontSize);
expect(lineHeight / fontSize >= 1.5).toBeTruthy();

// 색상 대비도: 4.5:1 (일반), 3:1 (큰 텍스트)
// 또는 WCAG AA 검증
```

### 레이아웃 (Grid)

```typescript
// 320px: 1열
// 375px: 1열
// 640px: 2열
// 768px: 2-3열

// 마진: 16px 이상
const margin = parseInt(computed.marginLeft);
expect(margin >= 16).toBeTruthy();

// gap: 16px
const gap = parseInt(computed.gap);
expect(gap === 16).toBeTruthy();
```

### 터치 타겟 (Touch)

```typescript
// 최소 크기: 44×44px
expect(box.width >= 44 && box.height >= 44).toBeTruthy();

// 간격: 8px 이상
const horizontalGap = box2.x - (box1.x + box1.width);
expect(horizontalGap >= 8).toBeTruthy();
```

### 이미지 (Aspect Ratio)

```typescript
// 비율 유지 (오차 2%)
const naturalRatio = naturalWidth / naturalHeight;
const clientRatio = clientWidth / clientHeight;
const diff = Math.abs(naturalRatio - clientRatio) / naturalRatio;
expect(diff < 0.02).toBeTruthy();

// lazy loading
expect(await img.getAttribute('loading')).toBe('lazy');

// srcset 포함
const srcset = await img.getAttribute('srcset');
expect(srcset).toBeTruthy();
```

### 성능 (Performance)

```typescript
// Lighthouse: 320-375px ≥ 80점, 768px ≥ 85점
expect(lighthouseScore >= 80).toBeTruthy();

// CLS < 0.1
expect(cls < 0.1).toBeTruthy();

// LCP < 2.5s (2500ms)
expect(lcp < 2500).toBeTruthy();

// INP < 100ms
expect(inp < 100).toBeTruthy();
```

---

## 🐛 디버깅 팁

### 로케이터가 깨졌을 때

```powershell
# UI 모드로 시각화
npm run test:e2e:ui

# 어떻게 동작하는지 한 줄씩 실행하며 확인
npm run test:e2e:debug
```

### 테스트가 타임아웃될 때

```typescript
// playwright.config.ts에서 타임아웃 증가
timeout: 60000, // 60초

// 또는 개별 테스트에서
test.setTimeout(60000);

// 로케이터별 타임아웃
await page.locator('[data-testid="button"]').click({ timeout: 10000 });
```

### 요소가 안 보일 때

```typescript
// 1. 스크롤 필요 확인
await page.locator('[data-testid="button"]').scrollIntoViewIfNeeded();

// 2. 로딩 완료 대기
await page.waitForLoadState('networkidle');

// 3. 포커스/클릭 가능 확인
await expect(element).toBeVisible();
await expect(element).toBeEnabled();
```

### 플레이키 테스트 (간헐적 실패)

```typescript
// 1. Soft Assertion으로 계속 실행
await expect.soft(element1).toBeVisible();
await expect.soft(element2).toBeVisible();

// 2. 재시도 설정
test.setTimeout(60000);
test.slow(); // 3배 느리게 처리

// 3. 명시적 대기
await page.waitForLoadState('networkidle');
```

---

## 📊 테스트 파일 구조 (템플릿)

```typescript
import { test, expect } from '@playwright/test';

test.describe('E2E-001 | Login Page', () => {
  let page;
  
  test.beforeEach(async ({ page: p }) => {
    page = p;
    await page.goto('/auth/sign-in');
  });
  
  test.afterEach(async () => {
    // 클린업
  });
  
  test('should render typography correctly', async () => {
    // 1. 요소 선택
    const h1 = page.locator('h1');
    
    // 2. 검증
    const fontSize = await h1.evaluate(
      (el) => window.getComputedStyle(el).fontSize
    );
    expect(parseInt(fontSize)).toBeGreaterThanOrEqual(24);
    
    // 3. 스크린샷 (실패 시에만 자동)
    await expect(h1).toBeVisible();
  });
});
```

---

## 🎯 각 해상도별 기본 테스트

```typescript
const TEST_CASES = {
  '320px': {
    viewport: { width: 320, height: 568 },
    grid_cols: 1,
    sidebar_visible: false,
    min_font_size: 14,
    lighthouse_min: 80,
  },
  '375px': {
    viewport: { width: 375, height: 812 },
    grid_cols: 1,
    sidebar_visible: false,
    min_font_size: 14,
    lighthouse_min: 80,
  },
  '640px': {
    viewport: { width: 640, height: 1024 },
    grid_cols: 2,
    sidebar_visible: false,
    min_font_size: 14,
    lighthouse_min: 75,
  },
  '768px': {
    viewport: { width: 768, height: 1024 },
    grid_cols: 2,
    sidebar_visible: true,
    min_font_size: 14,
    lighthouse_min: 85,
  },
};

// 사용 예
for (const [resolution, config] of Object.entries(TEST_CASES)) {
  test(`Responsive test at ${resolution}`, async ({ page }) => {
    await page.setViewportSize(config.viewport);
    // ... 테스트 로직
  });
}
```

---

## 🚨 자주하는 실수

### ❌ 틀린 예

```typescript
// 1. 하드코딩된 대기
await page.waitForTimeout(1000);

// 2. 복잡한 selector
page.locator('div.container > div.item:nth-child(2) > button.primary');

// 3. 순차 실행 (병렬로 해야 함)
await test1();
await test2();
await test3();

// 4. 스크린샷 없이 assertion만
expect(element).toHaveText('Text'); // 실패 시 왜 실패했는지 모름
```

### ✅ 올바른 예

```typescript
// 1. 의미 있는 대기
await page.waitForLoadState('networkidle');

// 2. 간단한 selector
page.locator('[data-testid="primary-button"]');

// 3. 병렬 테스트
test.parallel();

// 4. 스크린샷 포함
await page.screenshot({ path: 'debug.png' });
await expect(element).toHaveText('Text');
```

---

## 📈 성능 기준값 빠른 참고

| 지표 | 기준값 | 단위 |
|------|--------|------|
| Lighthouse (320-375px) | ≥ 80 | 점 |
| Lighthouse (640px) | ≥ 75 | 점 |
| Lighthouse (768px) | ≥ 85 | 점 |
| LCP | < 2.5 | s |
| CLS | < 0.1 | - |
| INP | < 100 | ms |
| 터치 타겟 최소 | 44×44 | px |
| 텍스트 최소 | 14 | px |
| line-height | ≥ 1.5 | 배 |
| 마진 | ≥ 16 | px |
| gap | 16 | px |
| 색상 대비도 | ≥ 4.5:1 | 비율 |

---

## 🔗 중요 링크

- **공식 문서**: https://playwright.dev
- **Locators 가이드**: https://playwright.dev/docs/locators
- **Assertions 가이드**: https://playwright.dev/docs/assertions
- **Best Practices**: https://playwright.dev/docs/best-practices
- **Debugging**: https://playwright.dev/docs/debug

---

## 📁 자주 쓰는 경로

```
# 테스트 파일
tests/mobile-responsive.spec.ts
tests/mobile-typography.spec.ts
tests/mobile-layout.spec.ts

# 설정
playwright.config.ts

# 결과
playwright-report/
playwright-report/test-results/

# 스크린샷 (실패)
playwright-report/test-results/*/test-failed-1.png
```

---

## ⏱️ 예상 실행 시간

```
npm run test:e2e              # 3-5분 (전체)
npm run test:e2e:320px        # 1-2분
npm run test:e2e:ui           # 5-10분 (UI 사용)
npm run test:e2e:debug        # 10-20분 (디버그)
```

---

## 🎓 한 줄 꿀팁

- **로케이터는 data-testid 우선**: `[data-testid="button"]`
- **대기는 waitForLoadState 사용**: `await page.waitForLoadState('networkidle');`
- **assertion은 soft로 계속 실행**: `await expect.soft(...)`
- **스크린샷은 자동**: `screenshot: 'only-on-failure'` (설정파일)
- **병렬 실행으로 속도 3배**: `workers: 4` (설정파일)

---

**버전**: 1.0  
**최종 업데이트**: 2026-06-08
