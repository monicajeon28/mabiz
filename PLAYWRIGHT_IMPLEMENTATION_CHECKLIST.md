# Playwright E2E 테스트 구현 체크리스트

**버전**: 1.0  
**작성일**: 2026-06-08  
**목표**: E2E 테스트 완전 구현 및 배포

---

## 📋 Phase 1: 환경 구성 (1-2시간)

### 1.1 Playwright 설치

- [ ] 패키지 설치 확인
  ```powershell
  npm list @playwright/test
  ```
  
- [ ] 미설치 시 설치
  ```powershell
  npm install --save-dev @playwright/test@latest
  ```
  
- [ ] 브라우저 설치
  ```powershell
  npx playwright install chromium firefox webkit
  ```
  
- [ ] 설치 확인
  ```powershell
  npx playwright --version
  ```

### 1.2 Playwright 설정 파일

- [ ] `playwright.config.ts` 생성 또는 수정
  - [ ] testDir: './tests' 설정
  - [ ] webServer: npm run dev 자동 실행
  - [ ] 4개 프로젝트 정의 (320px, 375px, 640px, 768px)
  - [ ] reporter: 'html' 설정
  - [ ] screenshot: 'only-on-failure' 설정

### 1.3 테스트 폴더 구조

- [ ] `tests/` 디렉토리 생성
  ```
  tests/
  ├── mobile-responsive.spec.ts
  ├── mobile-typography.spec.ts
  ├── mobile-layout.spec.ts
  ├── mobile-images.spec.ts
  ├── mobile-touch-targets.spec.ts
  ├── mobile-performance.spec.ts
  ├── fixtures/
  │   ├── test-data.ts
  │   └── page-objects.ts
  └── utils/
      ├── assertions.ts
      ├── lighthouse.ts
      └── mobile-helpers.ts
  ```

### 1.4 package.json 스크립트

- [ ] npm 스크립트 추가
  ```json
  {
    "scripts": {
      "test:e2e": "playwright test",
      "test:e2e:ui": "playwright test --ui",
      "test:e2e:debug": "playwright test --debug",
      "test:e2e:320px": "playwright test --project=chromium-320px",
      "test:e2e:report": "playwright show-report"
    }
  }
  ```

---

## 📝 Phase 2: 테스트 파일 구현 (3-4시간)

### 2.1 기초 헬퍼 함수 (utils/)

#### `utils/mobile-helpers.ts`

- [ ] 해상도별 뷰포트 설정 함수
  ```typescript
  async function setViewport(page, resolution: '320px' | '375px' | '640px' | '768px')
  ```

- [ ] 텍스트 크기 검증 함수
  ```typescript
  async function getFontSize(page, selector: string): Promise<number>
  ```

- [ ] 터치 타겟 검증 함수
  ```typescript
  async function getTouchTargetSize(page, selector: string): Promise<{width, height}>
  ```

- [ ] 그리드 컬럼 수 계산 함수
  ```typescript
  async function getGridColumns(page, selector: string): Promise<number>
  ```

- [ ] 색상 대비도 계산 함수
  ```typescript
  async function getContrastRatio(color1: string, color2: string): Promise<number>
  ```

#### `utils/assertions.ts`

- [ ] 커스텀 어서션 매처 (expect 확장)
  - [ ] `toHaveFontSize(min, max)`
  - [ ] `toHaveLineHeight(min)`
  - [ ] `toHaveTouchTarget(minSize)`
  - [ ] `toHaveContrast(min)`
  - [ ] `toHaveAspectRatio(expected, tolerance)`

#### `utils/lighthouse.ts`

- [ ] Lighthouse 실행 함수
  ```typescript
  async function runLighthouse(page, url: string): Promise<LighthouseReport>
  ```

- [ ] 스코어 검증 함수
  ```typescript
  function assertLighthouseScore(report, category: string, minScore: number)
  ```

### 2.2 테스트 케이스 구현

#### `tests/mobile-responsive.spec.ts` (메인 테스트)

- [ ] 테스트 프레임워크 설정
  - [ ] describe() 블록 구성
  - [ ] beforeEach() 페이지 설정
  - [ ] afterEach() 클린업

- [ ] TC-E2E-001: 로그인 페이지 텍스트
  ```typescript
  test('E2E-001 | Login page typography', async ({ page }) => {
    // 구현
  })
  ```

- [ ] TC-E2E-002: 대시보드 헤더
  ```typescript
  test('E2E-002 | Dashboard header rendering', async ({ page }) => {
    // 구현
  })
  ```

- [ ] TC-E2E-003: 카드 그리드 레이아웃
  ```typescript
  test('E2E-003 | Dashboard grid layout', async ({ page }) => {
    // 구현
  })
  ```

#### `tests/mobile-typography.spec.ts`

- [ ] 모든 텍스트 요소 검증
- [ ] line-height 비율 검증
- [ ] 제목 계층 검증
- [ ] 색상 대비도 검증

#### `tests/mobile-layout.spec.ts`

- [ ] 320px: 1열 배치
- [ ] 375px: 1열 배치
- [ ] 640px: 2열 배치
- [ ] 768px: 데스크톱 레이아웃

#### `tests/mobile-images.spec.ts`

- [ ] aspect-ratio 유지 검증
- [ ] lazy loading 속성 검증
- [ ] srcset 검증
- [ ] 이미지 로드 시간 측정

#### `tests/mobile-touch-targets.spec.ts`

- [ ] 모든 버튼 ≥ 44×44px
- [ ] 모든 입력 필드 ≥ 44px 높이
- [ ] 체크박스 클릭 영역
- [ ] 요소 간 간격 ≥ 8px

#### `tests/mobile-performance.spec.ts`

- [ ] Lighthouse 점수 검증
- [ ] Core Web Vitals 측정
- [ ] CLS < 0.1 검증
- [ ] LCP < 2.5s 검증

### 2.3 Fixtures & Page Objects

#### `fixtures/page-objects.ts`

- [ ] LoginPage class
  ```typescript
  class LoginPage {
    emailInput: Locator;
    passwordInput: Locator;
    submitButton: Locator;
    
    async fill(email, password)
    async submit()
  }
  ```

- [ ] DashboardPage class
  ```typescript
  class DashboardPage {
    header: Locator;
    sidebar: Locator;
    cardGrid: Locator;
    
    async getCardCount()
    async getGridColumns()
  }
  ```

- [ ] ContactsPage class
- [ ] AuditLogsPage class

#### `fixtures/test-data.ts`

- [ ] 테스트 사용자 데이터
- [ ] 테스트 컨택트 데이터
- [ ] 기기별 뷰포트 설정
- [ ] 예상 결과값

### 2.4 테스트 데이터 준비

- [ ] 테스트 데이터베이스 seed 스크립트
  ```powershell
  npm run seed:test
  ```

- [ ] 테스트 계정 생성
  - [ ] 이메일: test@example.com
  - [ ] 비밀번호: TestPassword123!

---

## 🧪 Phase 3: 로컬 테스트 실행 (1-2시간)

### 3.1 기본 테스트 실행

- [ ] 개발 서버 실행
  ```powershell
  npm run dev
  ```

- [ ] 전체 E2E 테스트 실행
  ```powershell
  npm run test:e2e
  ```

- [ ] 테스트 결과 확인
  - [ ] 통과율 확인
  - [ ] 실패한 테스트 원인 파악
  - [ ] 스크린샷 확인

### 3.2 해상도별 테스트

- [ ] 320px 테스트
  ```powershell
  npm run test:e2e:320px
  ```

- [ ] 375px 테스트
  ```powershell
  npm run test:e2e:375px
  ```

- [ ] 640px 테스트
  ```powershell
  npm run test:e2e:640px
  ```

- [ ] 768px 테스트
  ```powershell
  npm run test:e2e:768px
  ```

### 3.3 디버그 모드

- [ ] UI 모드로 시각화 실행
  ```powershell
  npm run test:e2e:ui
  ```

- [ ] Inspector로 한 줄씩 실행
  ```powershell
  npm run test:e2e:debug
  ```

### 3.4 보고서 확인

- [ ] HTML 보고서 생성
  ```powershell
  npm run test:e2e:report
  ```

- [ ] 실패 스크린샷 확인
  - [ ] 각 해상도별 스크린샷 분석
  - [ ] 시각적 회귀 확인

---

## ✅ Phase 4: 테스트 수정 및 최적화 (1-3시간)

### 4.1 실패 테스트 수정

- [ ] 각 실패 테스트별 원인 파악
- [ ] 테스트 로직 수정 또는 코드 수정
- [ ] 로케이터 안정성 개선
  - [ ] `data-testid` 사용
  - [ ] `getByRole()` 사용
  - [ ] 피할 것: nth-child, 복잡한 CSS selector

### 4.2 플레이키 테스트 해결

- [ ] 재시도 로직 추가
  - [ ] `expect().toBeVisible({ timeout: 5000 })`
  - [ ] `waitForLoadState('networkidle')`

- [ ] 명시적 대기 추가
  ```typescript
  await page.waitForSelector('[data-testid="loaded"]');
  ```

### 4.3 성능 최적화

- [ ] 병렬 실행 활성화
  ```
  workers: 4 (playwright.config.ts)
  ```

- [ ] 불필요한 대기 제거
  ```typescript
  // ❌ 피할 것
  await page.waitForTimeout(1000);
  
  // ✅ 올바른 방법
  await page.waitForLoadState('networkidle');
  ```

---

## 🔄 Phase 5: CI/CD 통합 (1시간)

### 5.1 GitHub Actions 워크플로우

- [ ] `.github/workflows/e2e-tests.yml` 생성
  - [ ] Node 18 이상 설정
  - [ ] Playwright 브라우저 설치
  - [ ] E2E 테스트 실행
  - [ ] 보고서 업로드

- [ ] 샘플 워크플로우
  ```yaml
  name: E2E Tests
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
          with:
            node-version: '18'
        - run: npm ci
        - run: npx playwright install
        - run: npm run test:e2e
  ```

### 5.2 PR 체크 통합

- [ ] PR 시 자동 E2E 테스트 실행
- [ ] 실패 시 PR 머지 차단
- [ ] 보고서 댓글 자동 작성

### 5.3 CI 환경 최적화

- [ ] 타임아웃 설정
  ```typescript
  timeout: 60000 // 60초
  ```

- [ ] 재시도 설정
  ```typescript
  retries: 2 // CI에서만
  ```

---

## 📊 Phase 6: 모니터링 및 유지보수 (지속적)

### 6.1 테스트 결과 모니터링

- [ ] 주간 테스트 결과 리뷰
  - [ ] 통과율
  - [ ] 실패 원인
  - [ ] 성능 추이

- [ ] 이슈 추적
  ```
  테스트 실패 → Issue 생성 → 해결 → 재테스트
  ```

### 6.2 테스트 유지보수

- [ ] 코드 변경 시 테스트 수정
  - [ ] UI 변경 → Locator 업데이트
  - [ ] 기능 변경 → 테스트 로직 업데이트

- [ ] 로케이터 안정성 점검
  - [ ] 주기적 리뷰
  - [ ] 깨진 로케이터 수정

### 6.3 테스트 확장

- [ ] 신규 페이지 테스트 추가
- [ ] 신규 기능 테스트 추가
- [ ] 엣지 케이스 테스트 추가

---

## 🚀 Phase 7: 최종 배포 (1일)

### 7.1 최종 검증

- [ ] 모든 E2E 테스트 통과 (100% 또는 95%+)
- [ ] Lighthouse 점수 기준 충족
- [ ] Core Web Vitals 통과
- [ ] 성능 리포트 검토

### 7.2 문서 작성

- [ ] E2E 테스트 실행 가이드
- [ ] 테스트 결과 리포트
- [ ] 알려진 이슈 및 제한사항

### 7.3 팀 교육

- [ ] Playwright 기본 교육
- [ ] 테스트 수정 방법 설명
- [ ] CI/CD 파이프라인 설명

### 7.4 배포

- [ ] 메인 브랜치 머지
- [ ] CI/CD 실행 확인
- [ ] 프로덕션 배포

---

## 📋 최종 체크리스트

### 설정 완료

- [ ] playwright.config.ts 설정 완료
- [ ] 4개 기기 프로젝트 정의 완료
- [ ] webServer 설정 완료
- [ ] reporter 설정 완료

### 테스트 구현 완료

- [ ] 10개 메인 테스트 케이스 구현
  - [ ] TC-E2E-001: 로그인 페이지 텍스트
  - [ ] TC-E2E-002: 대시보드 헤더
  - [ ] TC-E2E-003: 카드 그리드 레이아웃
  - [ ] TC-E2E-004: 테이블 컬럼 숨김
  - [ ] TC-E2E-005: 이미지 비율 유지
  - [ ] TC-E2E-006: 터치 타겟 크기
  - [ ] TC-E2E-007: Lighthouse 성능
  - [ ] TC-E2E-008: 폼 입력 제출
  - [ ] TC-E2E-009: 스크롤 성능 & CLS
  - [ ] TC-E2E-010: 다크모드 전환

- [ ] Helper 함수 구현
- [ ] Page Objects 구현
- [ ] Test Data 준비

### 로컬 테스트 완료

- [ ] 전체 테스트 실행: 통과율 95% 이상
- [ ] 320px 테스트: 모두 통과
- [ ] 375px 테스트: 모두 통과
- [ ] 640px 테스트: 모두 통과
- [ ] 768px 테스트: 모두 통과

### 성능 기준 충족

- [ ] Lighthouse Performance: 320-375px ≥ 80점
- [ ] Lighthouse Performance: 640px ≥ 75점
- [ ] Lighthouse Performance: 768px ≥ 85점
- [ ] CLS < 0.1
- [ ] LCP < 2.5s

### CI/CD 통합 완료

- [ ] GitHub Actions 워크플로우 생성
- [ ] PR 시 자동 테스트 실행 확인
- [ ] 실패 시 알림 확인

### 문서 작성 완료

- [ ] E2E_TESTING_GUIDE.md (작성됨)
- [ ] PLAYWRIGHT_TEST_SPECS.md (작성됨)
- [ ] PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md (이 파일)
- [ ] 테스트 실행 가이드 (README)
- [ ] 트러블슈팅 가이드

### 팀 교육 완료

- [ ] Playwright 기본 교육
- [ ] 테스트 수정 교육
- [ ] CI/CD 파이프라인 교육

---

## 📞 지원 및 문의

**테스트 실행 문제**:
- 로케이터 깨짐 → `npm run test:e2e:ui` 실행하여 시각화
- 타임아웃 → playwright.config.ts의 timeout 값 증가
- 네트워크 문제 → throttling 설정 확인

**성능 문제**:
- 느린 테스트 → 병렬 workers 감소
- 메모리 부족 → 테스트 파일 분할

---

**버전**: 1.0  
**최종 업데이트**: 2026-06-08  
**상태**: 🟢 Ready for Implementation
