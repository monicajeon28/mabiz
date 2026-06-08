# P1-1 모바일 E2E 테스트 가이드 (Playwright)

**버전**: 1.0  
**작성일**: 2026-06-08  
**대상**: mabiz-crm 모바일 반응형 디자인  
**도구**: Playwright (E2E 자동화)

---

## 📋 목차

1. [환경 설정](#환경-설정)
2. [E2E 테스트 케이스 명세](#e2e-테스트-케이스-명세)
3. [테스트 실행](#테스트-실행)
4. [결과 분석](#결과-분석)
5. [CI/CD 통합](#cicd-통합)

---

## 🛠️ 환경 설정

### 1. Playwright 설치 확인

```powershell
# Playwright 설치 확인
npm list @playwright/test

# 미설치 시 설치
npm install --save-dev @playwright/test@latest

# 브라우저 설치
npx playwright install
```

### 2. Playwright 설정 (playwright.config.ts)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-320px',
      use: {
        ...devices['Pixel 2'],
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'chromium-375px',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'chromium-640px',
      use: {
        ...devices['iPad'],
        viewport: { width: 640, height: 1024 },
      },
    },
    {
      name: 'chromium-768px',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 📝 E2E 테스트 케이스 명세

### TC-E2E-001: 로그인 페이지 (모든 해상도)

**목표**: 로그인 폼이 모든 해상도에서 올바르게 렌더링되고 기능 작동 확인

**테스트 시나리오**:

1. 로그인 페이지 접근
2. 이메일 입력 필드 포커싱
3. 이메일 입력
4. 비밀번호 입력
5. 로그인 버튼 클릭
6. 대시보드로 리다이렉트 확인

**검증 항목**:

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| 텍스트 가독성 | font-size ≥ 14px | computedStyle fontSize 확인 |
| 버튼 크기 | ≥ 44×44px | boundingBox width/height |
| 입력 필드 높이 | ≥ 44px | input height 확인 |
| 폼 너비 | ≤ 뷰포트 - 32px | form width 검증 |
| 레이아웃 | 1열 (320-375px) | margin/padding 검증 |

---

### TC-E2E-002: 대시보드 헤더 (모든 해상도)

**목표**: 대시보드 헤더가 각 해상도에서 올바르게 렌더링

**테스트 시나리오**:

1. 대시보드 접근
2. 헤더 요소 확인 (로고, 메뉴, 프로필)
3. 사이드바 가시성 확인 (768px에만 표시)
4. 제목 텍스트 크기 확인

**검증 항목**:

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| h1 폰트 크기 | 24-32px | fontSize computed style |
| 제목 color contrast | WCAG AA (4.5:1) | accessibilityAudit |
| 아이콘 크기 | ≥ 24×24px | icon width/height |
| 사이드바 (768px) | 240-256px 너비 | sidebar width 확인 |
| 사이드바 (320-640px) | 숨김 | display: none 검증 |

---

### TC-E2E-003: 대시보드 카드 그리드 (해상도별 레이아웃)

**목표**: 카드 그리드가 각 해상도에서 올바른 컬럼 수로 배치

**테스트 시나리오**:

1. 대시보드 접근
2. 카드 개수 확인
3. 각 해상도별 컬럼 수 검증
   - 320px: 1열
   - 375px: 1열
   - 640px: 2열
   - 768px: 2-3열
4. 카드 간격 확인

**검증 항목**:

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| 320px 컬럼 | 1열 | grid-template-columns 개수 확인 |
| 375px 컬럼 | 1열 | grid-template-columns 개수 확인 |
| 640px 컬럼 | 2열 | grid-template-columns 개수 확인 |
| 768px 컬럼 | 2-3열 | grid-template-columns 개수 확인 |
| gap | 16px | gap computed style 확인 |
| 마진 | 16px | margin-left/right 확인 |
| 카드 높이 | 자동 | aspect-ratio 유지 검증 |

---

### TC-E2E-004: 테이블 페이지 - 컬럼 숨김 (audit-logs)

**목표**: 테이블이 해상도별로 적절한 컬럼 숨김/표시

**테스트 시나리오**:

1. audit-logs 페이지 접근
2. 320px에서 숨겨진 컬럼 확인
3. 375px에서 필수 컬럼만 표시 확인
4. 640px 이상에서 모든 컬럼 표시 확인

**검증 항목**:

| 해상도 | 표시 컬럼 | 숨김 컬럼 |
|--------|--------|---------|
| 320px | ID, Action | Date, User, Type |
| 375px | ID, Date, Action | User, Type, Details |
| 640px | ID, Date, User, Action | Type, Details |
| 768px | 모두 표시 | 없음 |

---

### TC-E2E-005: 이미지 비율 유지 (aspect-ratio)

**목표**: 모든 이미지가 설정된 비율을 유지하고 변형되지 않음

**테스트 시나리오**:

1. 이미지가 있는 페이지 접근 (campaigns, dashboard)
2. 각 이미지의 계산된 크기 확인
3. aspect-ratio 유지 검증
4. lazy loading 적용 확인

**검증 항목**:

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| aspect-ratio | 16:9 또는 4:3 | naturalWidth/Height 확인 |
| 이미지 너비 | 컨테이너 <= | clientWidth 비교 |
| lazy loading | loading="lazy" | getAttribute 확인 |
| srcset | 최소 2가지 | getAttribute srcset 확인 |
| 로드 시간 | < 3초 | waitForLoadState 'networkidle' |

---

### TC-E2E-006: 터치 타겟 크기 (모든 버튼/입력)

**목표**: 모든 상호작용 요소가 44×44px 이상 터치 타겟 크기

**테스트 시나리오**:

1. 페이지의 모든 버튼 수집
2. 모든 입력 필드 수집
3. 각 요소의 boundingBox 확인
4. 최소 크기 검증

**검증 항목**:

| 요소 | 최소 너비 | 최소 높이 | 검증 |
|------|---------|---------|------|
| 버튼 | 44px | 44px | ✓ |
| 입력 필드 | 44px | 44px | ✓ |
| 체크박스 | 44px (포함 영역) | 44px (포함 영역) | ✓ |
| 라디오 | 44px (포함 영역) | 44px (포함 영역) | ✓ |
| 링크 | 44px | 44px | ✓ |

---

### TC-E2E-007: Lighthouse 성능 점수 (모든 해상도)

**목표**: 각 해상도에서 Lighthouse 성능 점수 기준 충족

**테스트 시나리오**:

1. 페이지 접근
2. Lighthouse audit 실행 (Chrome DevTools Protocol)
3. 각 카테고리 점수 확인
4. Core Web Vitals 측정

**검증 항목**:

| 해상도 | Performance | Accessibility | Best Practices | SEO |
|--------|-----------|---------------|----------------|-----|
| 320px | ≥ 80 | ≥ 90 | ≥ 80 | ≥ 90 |
| 375px | ≥ 80 | ≥ 90 | ≥ 80 | ≥ 90 |
| 640px | ≥ 75 | ≥ 90 | ≥ 80 | ≥ 90 |
| 768px | ≥ 85 | ≥ 90 | ≥ 80 | ≥ 90 |

**Core Web Vitals**:

| 지표 | 기준 |
|------|------|
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 100ms |

---

### TC-E2E-008: 폼 입력 및 제출 (Contact 생성)

**목표**: 모바일에서 폼 입력과 제출이 정상 작동

**테스트 시나리오**:

1. Contacts 페이지 접근
2. "새 연락처 생성" 버튼 클릭
3. 모달/폼 열림 확인
4. 입력 필드에 데이터 입력
5. 제출 버튼 클릭
6. 성공 메시지 확인

**검증 항목**:

| 항목 | 기준 | 검증 |
|------|------|------|
| 입력 필드 포커싱 | 포커스 시각 표시 | outline/border-color 변경 |
| 키보드 표시 | 모바일 키보드 표시 | user-select 없음 |
| 에러 메시지 | 가시적 에러 | text-red-600 또는 aria-invalid |
| 제출 버튼 | 활성화/비활성화 | button:disabled 상태 검증 |
| 로딩 상태 | 로딩 표시 | spinner/skeleton 확인 |

---

### TC-E2E-009: 스크롤 성능 및 Layout Shift (CLS)

**목표**: 스크롤 시 레이아웃이 이동하지 않고 부드러운 스크롤 성능

**테스트 시나리오**:

1. 페이지 로드
2. 페이지 스크롤 (상 → 하 → 상)
3. 스크롤 중 요소 이동 확인
4. 프레임 레이트 측정

**검증 항목**:

| 항목 | 기준 | 검증 방법 |
|------|------|---------|
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse audit |
| 스크롤 지연 | < 100ms | scroll event 측정 |
| 프레임 드롭 | 없음 | requestAnimationFrame 모니터링 |
| 스켈레톤/로더 | 크기 고정 | width/height 고정 검증 |

---

### TC-E2E-010: 다크모드 전환 (설정 페이지)

**목표**: 다크모드 전환이 모든 해상도에서 정상 작동

**테스트 시나리오**:

1. 설정 페이지 접근
2. 테마 토글 클릭
3. 배경색 변경 확인
4. 텍스트 색상 대비도 재검증

**검증 항목**:

| 항목 | 기준 | 검증 |
|------|------|------|
| 배경색 변경 | light → dark | backgroundColor computed style |
| 텍스트 색상 | dark → light | color computed style |
| 대비도 (다크모드) | WCAG AA (4.5:1) | contrast audit |
| 아이콘 색상 | 가시적 | icon color 검증 |

---

## 🚀 테스트 실행

### 모든 테스트 실행

```powershell
# 전체 테스트 실행 (모든 브라우저 + 해상도)
npx playwright test

# 특정 브라우저만 실행
npx playwright test --project=chromium-320px
npx playwright test --project=chromium-375px
npx playwright test --project=chromium-640px
npx playwright test --project=chromium-768px
```

### 디버그 모드

```powershell
# Inspector 열기 (한 줄씩 실행)
npx playwright test --debug

# UI 모드 (비주얼)
npx playwright test --ui
```

### 특정 테스트만 실행

```powershell
# 특정 파일만 실행
npx playwright test tests/mobile-responsive.spec.ts

# 특정 테스트만 실행
npx playwright test -g "TC-E2E-001"

# 특정 해상도만 실행
npx playwright test --project=chromium-320px tests/mobile-responsive.spec.ts
```

### 결과 확인

```powershell
# HTML 리포트 열기
npx playwright show-report
```

---

## 📊 결과 분석

### 테스트 실행 후 확인사항

1. **전체 통과율**
   - 목표: 100% (0 failure)
   - 허용: 95% 이상 (테스트 버그 가능성)

2. **해상도별 결과**
   - 각 해상도 (320px, 375px, 640px, 768px)별 통과 여부 확인

3. **성능 점수**
   - Lighthouse 점수 기준 충족 여부
   - Core Web Vitals 통과 여부

4. **실패 테스트 분석**
   ```
   Failed: TC-E2E-003
   Error: Expected 2 columns, got 1 column
   解决: CSS media query 수정 필요
   ```

---

## 🔄 CI/CD 통합

### GitHub Actions 워크플로우

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests (Mobile)

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload Playwright Report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
      
      - name: Comment PR
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '❌ E2E 테스트 실패. Playwright Report를 확인해주세요.'
            })
```

### 로컬 실행 전 체크리스트

```powershell
# 1. 개발 서버 실행 (다른 터미널)
npm run dev

# 2. E2E 테스트 실행
npx playwright test

# 3. 리포트 확인
npx playwright show-report

# 4. 스크린샷 확인 (실패 시)
# playwright-report/test-results/ 폴더에서 스크린샷 확인
```

---

## 📋 테스트 유지보수

### 테스트 수정 가이드

**테스트가 실패하면**:

1. 에러 메시지 확인
2. Playwright Report에서 스크린샷 확인
3. 원인 파악 (코드 변경 vs 환경 문제)
4. 테스트 수정 또는 코드 수정

**로케이터 유지보수**:

```typescript
// ❌ 위험한 로케이터 (자주 깨짐)
page.locator('button').first();
page.locator('div > p:nth-child(3)');

// ✅ 안전한 로케이터
page.locator('[data-testid="login-button"]');
page.locator('text=Login');
page.getByRole('button', { name: 'Login' });
```

---

## 📝 테스트 케이스 체크리스트

최종 배포 전 확인:

- [ ] TC-E2E-001: 로그인 페이지 (모든 해상도)
- [ ] TC-E2E-002: 대시보드 헤더 (모든 해상도)
- [ ] TC-E2E-003: 대시보드 카드 그리드 (해상도별 레이아웃)
- [ ] TC-E2E-004: 테이블 페이지 - 컬럼 숨김
- [ ] TC-E2E-005: 이미지 비율 유지
- [ ] TC-E2E-006: 터치 타겟 크기
- [ ] TC-E2E-007: Lighthouse 성능 점수
- [ ] TC-E2E-008: 폼 입력 및 제출
- [ ] TC-E2E-009: 스크롤 성능 및 CLS
- [ ] TC-E2E-010: 다크모드 전환

---

## 📚 참고 자료

- [Playwright 공식 문서](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Web Vitals](https://web.dev/vitals/)

---

**버전**: 1.0  
**최종 업데이트**: 2026-06-08
