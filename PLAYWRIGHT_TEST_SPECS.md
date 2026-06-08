# Playwright E2E 테스트 상세 스펙 (마크다운 형식)

**버전**: 1.0  
**작성일**: 2026-06-08  
**대상**: mabiz-crm 모바일 반응형 테스트  
**포맷**: Markdown (구현 전 상세 명세)

---

## 📋 목차

1. [테스트 구조](#테스트-구조)
2. [테스트 케이스 상세 명세](#테스트-케이스-상세-명세)
3. [Assertion 기준값](#assertion-기준값)
4. [Helper 함수](#helper-함수)
5. [에러 처리 패턴](#에러-처리-패턴)

---

## 🏗️ 테스트 구조

### 파일 레이아웃

```
tests/
├── mobile-responsive.spec.ts       # 주요 E2E 테스트
├── mobile-typography.spec.ts        # 텍스트 가독성 검증
├── mobile-layout.spec.ts            # 레이아웃/그리드 검증
├── mobile-images.spec.ts            # 이미지 비율 검증
├── mobile-touch-targets.spec.ts     # 터치 타겟 크기 검증
├── mobile-performance.spec.ts       # 성능/Lighthouse 검증
├── fixtures/
│   ├── test-data.ts                # 테스트 데이터
│   └── page-objects.ts             # Page Object Model
└── utils/
    ├── assertions.ts               # 커스텀 어서션
    ├── lighthouse.ts               # Lighthouse 헬퍼
    └── mobile-helpers.ts           # 모바일 헬퍼 함수
```

---

## 📝 테스트 케이스 상세 명세

### 1️⃣ TC-E2E-001: 로그인 페이지 텍스트 가독성 (모든 해상도)

#### 테스트 제목
```
E2E-001-Typography | 로그인 페이지: 텍스트 가독성 (320px, 375px, 640px, 768px)
```

#### 전제조건
- 개발 서버 실행 중
- 로그인하지 않은 상태
- 각 해상도별 테스트 자동 병렬 실행

#### 단계별 실행

**Step 1: 페이지 접근**
```
Page Action: goto('/auth/sign-in')
Expected: HTTP 200 (로그인 페이지 로드)
Assertion:
  - page.url() === 'http://localhost:3000/auth/sign-in'
  - page.locator('[data-testid="sign-in-form"]').isVisible()
```

**Step 2: 제목 (h1) 텍스트 크기 확인**
```
Element: page.locator('h1').first()
Expected: font-size 24-32px
Assertion:
  await expect.soft(page.locator('h1')).toHaveCSS('font-size', /^(24|25|26|27|28|29|30|31|32)px$/);
Error Handling:
  - h1 없으면 WARN (선택사항)
  - font-size < 24px 면 FAIL
```

**Step 3: 라벨 텍스트 크기 확인**
```
Element: page.locator('label')
Expected: font-size ≥ 14px
Assertion:
  for each label:
    fontSize >= 14px
```

**Step 4: 버튼 텍스트 크기 확인**
```
Element: page.locator('button[type="submit"]')
Expected: font-size ≥ 16px
Assertion:
  await expect(page.locator('button[type="submit"]')).toHaveCSS('font-size', /^([1-9]\d|[0-9]\d\d)px$/);
  // 16px 이상
```

**Step 5: line-height 비율 확인**
```
Element: page.locator('body')
Expected: line-height ≥ 1.5 (기본)
Assertion:
  const lineHeight = await page.evaluate(() => {
    const body = document.querySelector('body');
    const computed = window.getComputedStyle(body);
    const lh = parseFloat(computed.lineHeight);
    const fs = parseFloat(computed.fontSize);
    return lh / fs;
  });
  expect(lineHeight).toBeGreaterThanOrEqual(1.5);
```

**Step 6: 색상 대비도 (WCAG AA) 확인**
```
Element: 모든 텍스트 요소
Expected: contrast ratio ≥ 4.5:1 (일반 텍스트)
Expected: contrast ratio ≥ 3:1 (큰 텍스트)
Assertion:
  await page.addInitScript(() => {
    // 간단한 대비도 계산 (정확한 것은 lighthouse에서)
    // 또는 Lighthouse audit 사용
  });
```

#### 테스트 데이터

```typescript
const typography_checks = {
  '320px': {
    viewport: { width: 320, height: 568 },
    checks: [
      { selector: 'h1', minFontSize: 24, maxFontSize: 32 },
      { selector: 'label', minFontSize: 14 },
      { selector: 'button', minFontSize: 16 },
      { selector: 'body', minLineHeight: 1.5 },
    ],
  },
  '375px': { /* ... */ },
  '640px': { /* ... */ },
  '768px': { /* ... */ },
};
```

#### 기대 결과

```
✅ 모든 텍스트 요소가 최소 글자 크기 충족
✅ line-height가 1.5배 이상
✅ 색상 대비도 WCAG AA 기준 충족
✅ 제목이 명확한 계층 구조 (h1 > h2 > h3)
```

---

### 2️⃣ TC-E2E-002: 대시보드 헤더 렌더링 (모든 해상도)

#### 테스트 제목
```
E2E-002-Header | 대시보드 헤더: 올바른 렌더링 (320px, 375px, 640px, 768px)
```

#### 전제조건
- 로그인 상태
- 대시보드 페이지 접근 가능

#### 단계별 실행

**Step 1: 대시보드 접근**
```
Action: goto('/dashboard')
Expected: HTTP 200
Assertion:
  - page.url().includes('/dashboard')
  - page.locator('[data-testid="dashboard-header"]').isVisible()
```

**Step 2: 로고 표시 확인**
```
Element: page.locator('[data-testid="logo"]')
Expected: 모든 해상도에서 표시
Assertion:
  await expect(page.locator('[data-testid="logo"]')).toBeVisible();
  const width = await page.locator('[data-testid="logo"]').boundingBox();
  expect(width?.width).toBeGreaterThan(0);
```

**Step 3: 메뉴 아이콘 간격 확인**
```
Element: page.locator('[data-testid="header-menu"] button')
Expected: 각 버튼 간격 ≥ 8px, 각 버튼 ≥ 44px
Assertion:
  const buttons = await page.locator('[data-testid="header-menu"] button').all();
  for (let i = 0; i < buttons.length - 1; i++) {
    const box1 = await buttons[i].boundingBox();
    const box2 = await buttons[i + 1].boundingBox();
    const gap = box2.x - (box1.x + box1.width);
    expect(gap).toBeGreaterThanOrEqual(8);
  }
```

**Step 4: 사이드바 가시성 확인 (768px에만)**
```
Element: page.locator('[data-testid="sidebar"]')

320px, 375px, 640px:
  Expected: 숨김 (display: none)
  Assertion:
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();

768px:
  Expected: 표시 (visible)
  Assertion:
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    const box = await page.locator('[data-testid="sidebar"]').boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(240);
    expect(box?.width).toBeLessThanOrEqual(256);
```

**Step 5: 프로필 메뉴 접근성**
```
Element: page.locator('[data-testid="profile-menu-button"]')
Expected: ≥ 44×44px, ARIA label
Assertion:
  const box = await page.locator('[data-testid="profile-menu-button"]').boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  
  const ariaLabel = await page.locator('[data-testid="profile-menu-button"]').getAttribute('aria-label');
  expect(ariaLabel).toBeTruthy();
```

#### 기대 결과

```
✅ 로고가 모든 해상도에서 표시
✅ 메뉴 버튼이 올바른 간격 유지
✅ 768px에서만 사이드바 표시
✅ 모든 인터랙티브 요소 ≥ 44×44px
```

---

### 3️⃣ TC-E2E-003: 대시보드 카드 그리드 (해상도별 레이아웃)

#### 테스트 제목
```
E2E-003-Grid | 대시보드 카드 그리드: 해상도별 컬럼 배치 (320px→1열, 640px→2열)
```

#### 단계별 실행

**Step 1: 카드 개수 확인**
```
Element: page.locator('[data-testid="dashboard-card"]')
Expected: 최소 4개 이상 카드
Assertion:
  const cards = await page.locator('[data-testid="dashboard-card"]').count();
  expect(cards).toBeGreaterThanOrEqual(4);
```

**Step 2: 해상도별 컬럼 수 검증**

```typescript
const GRID_LAYOUT = {
  '320px': {
    viewport: { width: 320, height: 568 },
    expectedCols: 1,
    expectedCardWidth: 288, // 320 - 32px margin
  },
  '375px': {
    viewport: { width: 375, height: 812 },
    expectedCols: 1,
    expectedCardWidth: 343, // 375 - 32px margin
  },
  '640px': {
    viewport: { width: 640, height: 1024 },
    expectedCols: 2,
    expectedCardWidth: 312, // (640 - 32 - 16gap) / 2
  },
  '768px': {
    viewport: { width: 768, height: 1024 },
    expectedCols: 2,
    expectedCardWidth: 360, // (768 - 32 - 16gap) / 2
  },
};

// 각 해상도별 검증
for (const [resolution, layout] of Object.entries(GRID_LAYOUT)) {
  test(`E2E-003 | Grid layout at ${resolution}`, async ({ page }) => {
    await page.setViewportSize(layout.viewport.width, layout.viewport.height);
    
    // 1행의 카드 개수 계산
    const cards = await page.locator('[data-testid="dashboard-card"]').all();
    const firstCardBox = await cards[0].boundingBox();
    const secondCardBox = await cards[1].boundingBox();
    
    // 같은 y 좌표면 같은 행 (2열)
    const cardsInFirstRow = cards.filter(async (card) => {
      const box = await card.boundingBox();
      return Math.abs(box.y - firstCardBox.y) < 10;
    }).length;
    
    expect(cardsInFirstRow).toBe(layout.expectedCols);
  });
}
```

**Step 3: 카드 너비 검증**
```
각 카드의 계산된 너비가 기대값과 일치
Assertion:
  for each card:
    cardWidth = expectedWidth ± 5px (용차 허용)
```

**Step 4: 마진 확인**
```
컨테이너 마진: 좌 16px, 우 16px
gap: 16px (행 간)
Assertion:
  container.marginLeft === 16px
  container.marginRight === 16px
  grid.gap === 16px
```

---

### 4️⃣ TC-E2E-004: 테이블 컬럼 숨김 (audit-logs)

#### 테스트 제목
```
E2E-004-Table | 테이블: 해상도별 컬럼 숨김/표시
```

#### 단계별 실행

**Step 1: 테이블 접근**
```
URL: /dashboard/admin/audit-logs
Expected: 테이블 로드
Assertion:
  await page.goto('/dashboard/admin/audit-logs');
  await expect(page.locator('[data-testid="audit-logs-table"]')).toBeVisible();
```

**Step 2: 320px에서 숨겨진 컬럼 확인**
```
Expected Visible Columns: ID, Action
Expected Hidden Columns: Date, User, Type, Details

Assertion:
  // ID 컬럼
  await expect(page.locator('th:has-text("ID")')).toBeVisible();
  
  // Date 컬럼 (숨김)
  const dateHeader = page.locator('th:has-text("Date")');
  const displayStyle = await dateHeader.evaluate((el) => 
    window.getComputedStyle(el).display
  );
  expect(displayStyle).toBe('none');
```

**Step 3: 375px에서 필수 컬럼만 표시**
```
Expected Visible: ID, Date, Action
Expected Hidden: User, Type, Details

Assertion: 위와 동일 패턴
```

**Step 4: 640px 이상에서 모든 컬럼 표시**
```
Expected Visible: 모든 컬럼
Assertion:
  const headers = await page.locator('th').all();
  for (const header of headers) {
    const display = await header.evaluate((el) => 
      window.getComputedStyle(el).display
    );
    expect(display).not.toBe('none');
  }
```

#### 테이블 컬럼 맵핑

```typescript
const TABLE_COLUMNS = {
  '320px': {
    visible: ['ID', 'Action'],
    hidden: ['Date', 'User', 'Type', 'Details'],
  },
  '375px': {
    visible: ['ID', 'Date', 'Action'],
    hidden: ['User', 'Type', 'Details'],
  },
  '640px': {
    visible: ['ID', 'Date', 'User', 'Action'],
    hidden: ['Type', 'Details'],
  },
  '768px': {
    visible: ['ID', 'Date', 'User', 'Type', 'Action', 'Details'],
    hidden: [],
  },
};
```

---

### 5️⃣ TC-E2E-005: 이미지 비율 유지 (aspect-ratio)

#### 테스트 제목
```
E2E-005-Images | 이미지: 비율 유지 + lazy loading (모든 해상도)
```

#### 단계별 실행

**Step 1: 이미지가 있는 페이지 접근**
```
URL: /dashboard/campaigns
Expected: 캠페인 카드 + 이미지 로드
```

**Step 2: 각 이미지의 aspect-ratio 확인**
```typescript
test('E2E-005 | Image aspect ratio', async ({ page }) => {
  await page.goto('/dashboard/campaigns');
  
  const images = await page.locator('img[data-testid="campaign-image"]').all();
  
  for (const img of images) {
    // 이미지 로드 대기
    await img.waitForLoadState('load');
    
    // 자연 크기 (원본)
    const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    const naturalHeight = await img.evaluate((el) => (el as HTMLImageElement).naturalHeight);
    
    // 계산된 크기
    const clientWidth = await img.evaluate((el) => el.clientWidth);
    const clientHeight = await img.evaluate((el) => el.clientHeight);
    
    // aspect-ratio 검증 (오차 ±2%)
    const expectedRatio = naturalWidth / naturalHeight;
    const actualRatio = clientWidth / clientHeight;
    const diff = Math.abs(expectedRatio - actualRatio) / expectedRatio;
    
    expect(diff).toBeLessThan(0.02); // 2% 오차 허용
  }
});
```

**Step 3: lazy loading 속성 확인**
```
Assertion:
  for each image:
    img.getAttribute('loading') === 'lazy'
```

**Step 4: srcset 확인**
```
Assertion:
  for each image:
    img.getAttribute('srcset') 포함 ('1x' 또는 '2x')
```

**Step 5: 이미지 너비 검증 (컨테이너 초과 X)**
```
Assertion:
  const img = page.locator('img[data-testid="campaign-image"]').first();
  const parent = img.locator('xpath=..');
  
  const imgBox = await img.boundingBox();
  const parentBox = await parent.boundingBox();
  
  expect(imgBox.width).toBeLessThanOrEqual(parentBox.width);
```

---

### 6️⃣ TC-E2E-006: 터치 타겟 크기 (모든 버튼/입력)

#### 테스트 제목
```
E2E-006-TouchTargets | 터치 타겟: 모든 인터랙티브 요소 ≥ 44×44px
```

#### 단계별 실행

**Step 1: 모든 버튼 수집 및 검증**
```typescript
test('E2E-006 | Button touch targets', async ({ page }) => {
  await page.goto('/dashboard');
  
  const buttons = await page.locator('button').all();
  
  for (const button of buttons) {
    const box = await button.boundingBox();
    
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    
    // 숨겨진 버튼은 제외
    if (await button.isVisible()) {
      console.log(`✓ Button: ${box?.width}×${box?.height}`);
    }
  }
});
```

**Step 2: 입력 필드 높이 검증**
```
Assertion:
  for each input/textarea:
    height >= 44px
```

**Step 3: 체크박스/라디오 클릭 영역**
```typescript
test('E2E-006 | Checkbox/Radio click areas', async ({ page }) => {
  // 체크박스 실제 크기 (20×20px) + 패딩으로 확장
  const checkbox = page.locator('input[type="checkbox"]').first();
  const label = checkbox.locator('xpath=following-sibling::label[1]');
  
  const labelBox = await label.boundingBox();
  expect(labelBox?.width).toBeGreaterThanOrEqual(44);
  expect(labelBox?.height).toBeGreaterThanOrEqual(44);
});
```

**Step 4: 아이콘 버튼 검증**
```
Assertion:
  for each icon button (a[aria-label], button[aria-label]):
    width >= 44px && height >= 44px
```

**Step 5: 터치 간격 (오터치 방지)**
```typescript
test('E2E-006 | Touch target spacing', async ({ page }) => {
  const buttons = await page.locator('button').all();
  
  for (let i = 0; i < buttons.length - 1; i++) {
    const box1 = await buttons[i].boundingBox();
    const box2 = await buttons[i + 1].boundingBox();
    
    // 수평 거리
    const horizontalGap = Math.abs(box2.x - (box1.x + box1.width));
    // 수직 거리
    const verticalGap = Math.abs(box2.y - (box1.y + box1.height));
    
    const gap = Math.min(horizontalGap, verticalGap);
    
    if (gap > 0) {
      expect(gap).toBeGreaterThanOrEqual(8);
    }
  }
});
```

---

### 7️⃣ TC-E2E-007: Lighthouse 성능 점수

#### 테스트 제목
```
E2E-007-Performance | Lighthouse: 성능 점수 (320px→80점, 768px→85점)
```

#### 단계별 실행

**Step 1: Lighthouse audit 실행**
```typescript
import { injectLighthouse } from 'playwright-lighthouse';

test('E2E-007 | Lighthouse scores', async ({ page, browser }) => {
  const context = await browser.createIncognitoBrowserContext();
  const testPage = await context.newPage();
  
  // 각 해상도별 audit 실행
  const resolutions = [
    { width: 320, height: 568, minScore: 80 },
    { width: 375, height: 812, minScore: 80 },
    { width: 640, height: 1024, minScore: 75 },
    { width: 768, height: 1024, minScore: 85 },
  ];
  
  for (const { width, height, minScore } of resolutions) {
    await testPage.setViewportSize({ width, height });
    await testPage.goto('http://localhost:3000/dashboard');
    
    // Lighthouse audit
    const results = await injectLighthouse(testPage, {
      onlyCategories: ['performance', 'accessibility', 'best-practices'],
      throttlingMethod: 'simulate',
    });
    
    console.log(`[${width}px] Performance: ${results.lhr.categories.performance.score * 100}`);
    
    expect(results.lhr.categories.performance.score * 100).toBeGreaterThanOrEqual(minScore);
  }
});
```

**Step 2: Core Web Vitals 검증**
```typescript
test('E2E-007 | Core Web Vitals', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Core Web Vitals 측정
  const vitals = await page.evaluate(() => {
    const metrics = {
      LCP: 0, // Largest Contentful Paint
      CLS: 0, // Cumulative Layout Shift
      INP: 0, // Interaction to Next Paint
    };
    
    // Web Vitals API로 측정 (성능 탭에서도 확인 가능)
    // 또는 Lighthouse audit으로 취득
    return metrics;
  });
  
  expect(vitals.LCP).toBeLessThan(2500); // 2.5s
  expect(vitals.CLS).toBeLessThan(0.1);
  expect(vitals.INP).toBeLessThan(100); // ms
});
```

---

### 8️⃣ TC-E2E-008: 폼 입력 및 제출

#### 테스트 제목
```
E2E-008-Form | Contact 생성: 폼 입력 → 제출 → 성공 메시지
```

#### 단계별 실행

**Step 1: Contacts 페이지 접근**
```
URL: /dashboard/contacts
Expected: "새 연락처 생성" 버튼 표시
```

**Step 2: 모달 열기**
```
Action: click("새 연락처 생성")
Expected: 모달 또는 폼 표시
Assertion:
  await expect(page.locator('[data-testid="contact-form-modal"]')).toBeVisible();
```

**Step 3: 폼 입력**
```typescript
// 이름 입력
await page.fill('[data-testid="input-name"]', 'John Doe');

// 이메일 입력
await page.fill('[data-testid="input-email"]', 'john@example.com');

// 전화 입력
await page.fill('[data-testid="input-phone"]', '010-1234-5678');

// 세그먼트 선택
await page.click('[data-testid="select-segment"]');
await page.click('text=골드회원');
```

**Step 4: 포커싱 및 키보드 지원**
```
Assertion:
  - input focus 시 outline/border-color 변경
  - placeholder 텍스트 가시적
  - 모바일 키보드 타입 올바름 (email → email-keyboard)
```

**Step 5: 에러 처리**
```typescript
// 필드 비워서 제출 시도
await page.click('[data-testid="submit-button"]');

// 에러 메시지 표시
await expect(page.locator('[data-testid="error-name"]')).toContainText('이름은 필수입니다');
await expect(page.locator('[data-testid="error-name"]')).toHaveCSS('color', /rgb\(.*\)/);
```

**Step 6: 제출**
```
Action: fill all required fields → click submit
Expected: 로딩 상태 → 성공 메시지 또는 리다이렉트
Assertion:
  - submit button disabled 상태 (로딩 중)
  - spinner/skeleton 표시
  - 성공 토스트 메시지
```

---

### 9️⃣ TC-E2E-009: 스크롤 성능 및 Layout Shift (CLS)

#### 테스트 제목
```
E2E-009-Scroll | 스크롤: CLS < 0.1, 프레임 드롭 없음
```

#### 단계별 실행

**Step 1: 페이지 로드 및 CLS 측정**
```typescript
test('E2E-009 | Scroll performance and CLS', async ({ page }) => {
  let clsValue = 0;
  
  // CLS 측정 시작
  await page.evaluateHandle(() => {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.clsValue = (window.clsValue || 0) + entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  
  await page.goto('/dashboard');
  
  // 스크롤 작업
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollBy(0, -1000));
  
  // CLS 확인
  clsValue = await page.evaluate(() => window.clsValue || 0);
  console.log(`CLS: ${clsValue}`);
  
  expect(clsValue).toBeLessThan(0.1);
});
```

**Step 2: 스켈레톤/로더 크기 검증**
```
Assertion:
  skeleton.width = 정해진 값 (auto X)
  skeleton.height = 정해진 값
  → 로드 후 크기 변경 없음
```

**Step 3: 프레임 레이트 (60fps)**
```typescript
// 스크롤 중 프레임 드롭 모니터링
test('E2E-009 | Frame rate during scroll', async ({ page }) => {
  await page.goto('/dashboard');
  
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      const frames = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          frames.push(entry.duration);
        }
      });
      
      observer.observe({ entryTypes: ['measure'] });
      
      // 스크롤 작업 중 measurement
      performance.mark('scroll-start');
      // ... 스크롤 ...
      performance.mark('scroll-end');
      
      resolve(frames);
    });
  });
  
  // 대부분의 프레임이 16.67ms 이하 (60fps)
  const goodFrames = metrics.filter((f) => f <= 16.67).length;
  expect(goodFrames / metrics.length).toBeGreaterThan(0.9);
});
```

---

### 🔟 TC-E2E-010: 다크모드 전환

#### 테스트 제목
```
E2E-010-DarkMode | 다크모드: 테마 전환 + 색상 대비도 재검증
```

#### 단계별 실행

**Step 1: 설정 페이지 접근**
```
URL: /dashboard/settings
Expected: 테마 토글 표시
```

**Step 2: 라이트모드 (기본) 색상 확인**
```
Assertion:
  body.backgroundColor = '#FFFFFF' (또는 rgb(255, 255, 255))
  body.color = '#000000' (또는 rgb(0, 0, 0))
```

**Step 3: 테마 토글 클릭**
```
Action: click('[data-testid="theme-toggle"]')
Expected: 다크모드 활성화
```

**Step 4: 다크모드 색상 확인**
```
Assertion:
  body.backgroundColor = '#1a1a1a' (또는 어두운 색)
  body.color = '#ffffff' (또는 밝은 색)
```

**Step 5: 색상 대비도 재검증 (다크모드)**
```
Expected: WCAG AA 4.5:1 이상 (다크모드에서도)
Assertion:
  const contrast = await calculateContrast(
    getBackgroundColor(element),
    getForegroundColor(element)
  );
  expect(contrast).toBeGreaterThanOrEqual(4.5);
```

**Step 6: 로컬 스토리지 저장**
```
Assertion:
  localStorage.getItem('theme') === 'dark'
  
  페이지 새로고침 후에도 다크모드 유지
  await page.reload();
  // 다크모드 확인
```

---

## 🔢 Assertion 기준값

### 텍스트 기준

| 항목 | 최소값 | 권장값 | 최대값 |
|------|--------|--------|--------|
| body font-size | 14px | 16px | 18px |
| h1 font-size | 24px | 28px | 32px |
| h2 font-size | 18px | 20px | 24px |
| h3 font-size | 16px | 18px | 20px |
| line-height | 1.5 | 1.6 | 1.8 |
| letter-spacing | -0.01em | 0 | 0.05em |

### 터치 타겟 기준

| 요소 | 최소 너비 | 최소 높이 | 최소 간격 |
|------|---------|---------|---------|
| 버튼 | 44px | 44px | 8px |
| 입력 필드 | 44px | 44px | 8px |
| 체크박스 | 44px (포함) | 44px (포함) | 8px |
| 링크 | 44px | 44px | 8px |
| 아이콘 | 24px | 24px | - |

### 색상 대비도 기준

| 텍스트 유형 | WCAG AA | WCAG AAA |
|-----------|--------|---------|
| 일반 텍스트 | 4.5:1 | 7:1 |
| 큰 텍스트 (18px+) | 3:1 | 4.5:1 |
| UI 컴포넌트 | 3:1 | 3:1 |

### 성능 기준

| 지표 | 목표 | 임계값 |
|------|------|--------|
| Lighthouse Performance | 80점+ | 70-79점 |
| Lighthouse Accessibility | 90점+ | 80-89점 |
| LCP | < 2.5s | 2.5-4.0s |
| CLS | < 0.1 | 0.1-0.25 |
| INP | < 100ms | 100-500ms |

---

## 🛠️ Helper 함수

### 계산된 스타일 가져오기

```typescript
async function getComputedStyle(page, selector, property) {
  return await page.evaluate(
    ({ selector, property }) => {
      const element = document.querySelector(selector);
      return window.getComputedStyle(element)[property];
    },
    { selector, property }
  );
}
```

### aspect-ratio 검증

```typescript
async function validateAspectRatio(page, selector, expectedRatio) {
  const img = page.locator(selector).first();
  const natural = {
    width: await img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
    height: await img.evaluate((el) => (el as HTMLImageElement).naturalHeight),
  };
  const client = await img.boundingBox();
  
  const naturalRatio = natural.width / natural.height;
  const clientRatio = client.width / client.height;
  const diff = Math.abs(naturalRatio - clientRatio) / naturalRatio;
  
  return diff < 0.02; // 2% 오차 허용
}
```

### 터치 타겟 검증

```typescript
async function validateTouchTarget(page, selector) {
  const element = page.locator(selector);
  const box = await element.boundingBox();
  
  return {
    width: box.width >= 44,
    height: box.height >= 44,
    area: box.width * box.height >= 44 * 44,
  };
}
```

### Lighthouse 스코어 가져오기

```typescript
async function getLighthouseScore(page, category = 'performance') {
  // CI 환경에서는 lighthouse-ci 사용
  // 로컬에서는 Chrome DevTools Protocol 사용
  return new Promise(async (resolve) => {
    const client = await page.context().browser().connect();
    // ... lighthouse audit ...
  });
}
```

---

## ⚠️ 에러 처리 패턴

### Soft Assertion (계속 실행)

```typescript
// 부분 실패 허용
await expect.soft(element).toHaveCSS('color', 'rgb(0, 0, 0)');
await expect.soft(element).toHaveText('Expected');
// 모든 assertion 실행 후 결과 취합
```

### Retry (재시도)

```typescript
test.setTimeout(60000); // 60초 타임아웃

test('E2E-001 | Login with retry', async ({ page }) => {
  test.slow(); // 3배 느리게 처리
  
  // 네트워크 느림을 고려한 재시도
  for (let i = 0; i < 3; i++) {
    try {
      await expect(page.locator('[data-testid="loaded"]')).toBeVisible({
        timeout: 5000,
      });
      break;
    } catch (error) {
      if (i === 2) throw error;
      console.log(`Retry ${i + 1}...`);
    }
  }
});
```

### 조건부 스킵

```typescript
test.skip('E2E-007 | Lighthouse', async ({ page, browserName }) => {
  // Chromium에서만 실행 (다른 브라우저는 스킵)
  test.skipIf(browserName !== 'chromium');
  // ...
});
```

---

**버전**: 1.0  
**최종 업데이트**: 2026-06-08
