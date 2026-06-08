# P1-1 모바일 테스트 계획 (2026-06-08)

**목표**: 4개 해상도(320px, 375px, 640px, 768px)에서 텍스트 가독성, 그리드 레이아웃, 이미지 비율, 터치 타겟, 스크롤 성능 검증

---

## 📱 테스트 해상도 정의

| 기기 | 해상도 | 뷰포트 | 테스트 유형 | 우선순위 |
|-----|--------|--------|-----------|---------|
| **iPhone SE** | 320px | 320×568 | 극단적 소형 폰 | P0 |
| **iPhone 12** | 375px | 375×812 | 주요 휴대폰 | P0 |
| **iPad mini** | 640px | 640×1024 | 태블릿(세로) | P1 |
| **iPad** | 768px | 768×1024 | 태블릿(가로) | P1 |

> **참고**: 마비즈 CRM은 데스크톱 중심이므로, 타블릿(640px+) 이상에서는 데스크톱 CSS 활용 가능

---

## 🎯 검증 항목별 체크리스트

### 1️⃣ 텍스트 가독성 (Typography)

**대상 페이지**:
- 로그인 페이지 (src/app/(auth)/sign-in/)
- 대시보드 헤더 (src/app/(dashboard)/layout.tsx)
- 테이블 페이지 (audit-logs, contacts, campaigns)
- 모달/드로어

**검증 기준**:

| 항목 | 기준값 | 검증 방법 |
|------|--------|---------|
| **최소 font-size** | 14px 이상 (body) | 브라우저 DevTools → 계산된 스타일 확인 |
| **line-height 비율** | 1.5배 이상 | `computed style` line-height ÷ font-size ≥ 1.5 |
| **자간(letter-spacing)** | -0.01em 이상 | 한글 텍스트가 겹치지 않는지 시각 검증 |
| **제목 크기 (h1-h3)** | 적절한 계층(h1 > h2 > h3) | 시각적 위계 확인 |
| **대비도 (Contrast)** | WCAG AA 4.5:1 이상 | DevTools Lighthouse → Accessibility → Color contrast |

**테스트 케이스**:

```
[TC-001] 320px - 로그인 폼 텍스트 가독성
  - 이메일 라벨: 최소 14px, line-height ≥ 1.5
  - 버튼 텍스트: 최소 16px
  - 헬퍼 텍스트: 12px 이상 (회색)
  - 예상: ✅ 텍스트가 선명하고 겹치지 않음

[TC-002] 375px - 대시보드 헤더 제목
  - 페이지 제목 (h1): 24-28px
  - 섹션 제목 (h2): 18-20px
  - 예상: ✅ 계층 명확

[TC-003] 640px - 테이블 텍스트
  - 테이블 셀: 최소 14px
  - 헤더: 14-16px
  - 예상: ✅ 읽기 쉬운 크기

[TC-004] 768px - 모달 콘텐츠
  - 모달 제목: 18px 이상
  - 모달 본문: 14px 이상
  - 예상: ✅ 모달이 너무 크지 않으면서 가독성 유지
```

---

### 2️⃣ 그리드 레이아웃 (Responsive Grid)

**대상 페이지**:
- 대시보드 (카드 그리드)
- 테이블 페이지 (컬럼 가시성)
- 리스트 페이지 (1열 vs 2열)

**검증 기준**:

| 해상도 | 기대 레이아웃 | 검증 항목 |
|--------|------------|---------|
| **320px** | 1열 (100% 너비) | 좌우 마진 16px 이상, 스크롤바 없음 |
| **375px** | 1열 (100% 너비) | 좌우 마진 12-16px |
| **640px** | 2열 또는 카드 그리드 | 컬럼 gap 16px, 각 컬럼 ≥ 300px |
| **768px** | 2-3열 또는 데스크톱 레이아웃 | 컬럼 너비 최적화, 사이드바 표시 |

**테스트 케이스**:

```
[TC-005] 320px - 대시보드 카드 그리드
  - 카드: 1열 배치 (100% - 32px 마진)
  - 카드 높이: 자동 (aspect-ratio 유지 시)
  - 예상: ✅ 카드가 화면을 벗어나지 않음

[TC-006] 375px - 테이블 숨김 컬럼
  - 모바일에서 불필요한 컬럼 숨김 (display: none)
  - 중요 컬럼만 표시 (이름, 상태, 액션)
  - 예상: ✅ 테이블이 스크롤바 없이 가독성 유지

[TC-007] 640px - 2열 레이아웃 전환
  - `md:grid-cols-2` 이상 적용
  - 각 카드 너비: (640 - 32 - 16gap) / 2 = ~296px
  - 예상: ✅ 2개 카드가 나란히 표시

[TC-008] 768px - 사이드바 + 메인 콘텐츠
  - 사이드바: 256px (고정 또는 반응형)
  - 메인: 나머지 영역
  - 예상: ✅ 데스크톱 레이아웃 초기 진입
```

---

### 3️⃣ 이미지 비율 (Aspect Ratio)

**대상 페이지**:
- 상품 이미지 (크루즈, 투어)
- 프로필 사진
- 카드 썸네일

**검증 기준**:

| 항목 | 기준값 | 검증 방법 |
|------|--------|---------|
| **aspect-ratio 유지** | 설정된 비율 유지 | 이미지 변형/늘어남 없음 |
| **이미지 해상도** | `srcset` 최소 2가지 (1x, 2x) | DevTools 네트워크 → 다운로드 크기 |
| **lazy loading** | 뷰포트 외 이미지는 지연 로드 | 초기 로드 시간 측정 |
| **이미지 적응성** | 컨테이너 너비에 맞춤 | 이미지가 컨테이너를 벗어나지 않음 |

**테스트 케이스**:

```
[TC-009] 320px - 상품 카드 이미지
  - 이미지 aspect-ratio: 16:9 또는 4:3 유지
  - 이미지 너비: 100% (패딩 제외)
  - 예상: ✅ 이미지가 변형되지 않음

[TC-010] 375px - 프로필 사진 (원형)
  - aspect-ratio: 1:1 유지
  - 너비: 64-80px (터치 타겟 기준)
  - 예상: ✅ 원형이 찌그러지지 않음

[TC-011] 640px - 갤러리 그리드
  - 이미지 숫자 감소 (2열 → 1.5열)
  - aspect-ratio 유지
  - 예상: ✅ 모든 이미지가 정상 비율

[TC-012] 768px - 이미지 srcset 확인
  - DevTools 네트워크 탭 → 다운로드 파일명 확인
  - 1x: 원본 / 2x: 2배 해상도 (또는 WebP)
  - 예상: ✅ 적절한 이미지 크기 다운로드
```

---

### 4️⃣ 터치 타겟 (Touch Target)

**대상 UI**:
- 버튼
- 입력 필드
- 체크박스/라디오
- 탭/메뉴 아이템

**검증 기준**:

| 항목 | 기준값 | 검증 방법 |
|------|--------|---------|
| **최소 터치 타겟 크기** | 44×44px (Apple HIG) | DevTools 요소 검사 → computed width/height |
| **버튼 padding** | 최소 12px (수직), 16px (수평) | 계산: padding + text |
| **입력 필드 높이** | 최소 44px | height ≥ 44px 또는 padding으로 달성 |
| **아이콘 버튼** | 최소 44×44px | 아이콘만 있는 버튼도 44px 이상 |
| **터치 간격** | 8px 이상 (인접 요소 간) | gap 또는 margin으로 검증 |

**테스트 케이스**:

```
[TC-013] 320px - 폼 입력 필드
  - input.height ≥ 44px
  - label과 input 간격 ≥ 8px
  - 예상: ✅ 한 손 엄지손가락으로 쉽게 탭 가능

[TC-014] 375px - 버튼 그룹 (연속 버튼)
  - 각 버튼: 최소 44×44px
  - 버튼 간 gap: ≥ 8px
  - 예상: ✅ 오터치 없음

[TC-015] 640px - 체크박스/라디오
  - 체크박스: 20×20px (최소)
  - 클릭 영역: 44×44px (전체 셀)
  - 예상: ✅ 정확하게 체크 가능

[TC-016] 768px - 탭 네비게이션
  - 탭 높이: 44px 이상
  - 탭 너비: 각 60px 이상 (균등 분배)
  - 예상: ✅ 오터치 없음
```

---

### 5️⃣ 스크롤 성능 (Core Web Vitals)

**검증 기준** (Lighthouse 기준):

| 지표 | 기준값 | 측정 도구 |
|------|--------|---------|
| **LCP (Largest Contentful Paint)** | < 2.5s | DevTools Lighthouse |
| **CLS (Cumulative Layout Shift)** | < 0.1 | DevTools Lighthouse |
| **INP (Interaction to Next Paint)** | < 100ms | DevTools Lighthouse / Performance |
| **FCP (First Contentful Paint)** | < 1.8s | DevTools Lighthouse |
| **TTFB (Time To First Byte)** | < 600ms | DevTools Network |

**테스트 케이스**:

```
[TC-017] 320px - Lighthouse 성능 점수
  - 성능(Performance): ≥ 80점
  - 접근성(Accessibility): ≥ 90점
  - 모바일 친화성(Mobile): ≥ 95점
  - 예상: ✅ 초록색(Good) 범위

[TC-018] 375px - 스크롤 레이아웃 이동 (CLS)
  - 페이지 로드 후 스크롤 시 레이아웃이 갑자기 이동하지 않음
  - 예상: ✅ CLS < 0.1 (Good)

[TC-019] 640px - 버튼 클릭 응답성 (INP)
  - 버튼 클릭 → 로딩 표시/화면 전환: < 100ms
  - 예상: ✅ INP < 100ms (Good)

[TC-020] 768px - 테이블 스크롤 성능
  - 큰 테이블 수평 스크롤 시 60fps 유지
  - 예상: ✅ 프레임 드롭 없음
```

---

## 🛠️ 테스트 환경 설정

### 필수 도구

1. **Chrome DevTools**
   - F12 → Device Toolbar (⌘Shift+M)
   - Network throttling: Slow 4G (로딩 성능 테스트)

2. **Lighthouse**
   - F12 → Lighthouse → Analyze page load
   - 각 해상도별 스코어 기록

3. **Performance 탭**
   - F12 → Performance → 녹화 → 스크롤/클릭 작업
   - 프레임 레이트 (FPS) 확인

4. **Responsive Design Mode**
   - F12 → Device Toolbar 또는 Edit custom devices 추가

---

## 📋 테스트 시작 단계

### Step 1: 환경 준비 (1시간)
```powershell
# 1. 개발 서버 실행
npm run dev

# 2. Chrome 열기 + DevTools (F12)
# 3. Device Toolbar 활성화 (⌘Shift+M)
# 4. Custom device 4개 추가 (320px, 375px, 640px, 768px)
```

### Step 2: 페이지별 검증 (2-3시간)

**추천 페이지 순서**:

1. **로그인 페이지** (간단 → 복잡)
   - URL: http://localhost:3000/auth/sign-in
   - 예상 이슈: 입력 필드 크기, 버튼 정렬

2. **대시보드 홈** (메인 진입점)
   - URL: http://localhost:3000/dashboard
   - 예상 이슈: 카드 그리드, 사이드바 숨김

3. **테이블 페이지** (audit-logs, contacts)
   - URL: http://localhost:3000/dashboard/admin/audit-logs
   - 예상 이슈: 컬럼 숨김, 스크롤 성능

4. **모달/드로어 페이지** (Contact 생성)
   - URL: http://localhost:3000/dashboard/contacts
   - 예상 이슈: 모달 크기, 입력 필드 가독성

---

## 📸 스크린샷 체크리스트

### 320px (iPhone SE)

| 페이지 | 스크린샷 항목 | 검증 포인트 |
|--------|------------|----------|
| **sign-in** | 전체 폼 | 버튼 너비, 입력 필드 높이 |
| **dashboard** | 상단 섹션 | 헤더 제목, 카드 1열 |
| **audit-logs** | 테이블 헤더+첫 행 | 텍스트 가독성, 숨김 컬럼 |
| **contacts** | 목록+버튼 | 버튼 터치 타겟, 행 높이 |

**저장 경로**: `D:\mabiz-crm\test-artifacts\320px-*.png`

### 375px (iPhone 12)

| 페이지 | 스크린샷 항목 | 검증 포인트 |
|--------|------------|----------|
| **sign-in** | 로그인 폼 | 레이아웃 최적화 |
| **dashboard** | 전체 헤더 | 메뉴 아이콘 간격 |
| **campaigns** | 캠페인 카드 | 카드 크기, 텍스트 오버플로우 |

**저장 경로**: `D:\mabiz-crm\test-artifacts\375px-*.png`

### 640px (iPad mini - 세로)

| 페이지 | 스크린샷 항목 | 검증 포인트 |
|--------|------------|----------|
| **dashboard** | 카드 2열 | 그리드 레이아웃 |
| **audit-logs** | 테이블 2열 | 컬럼 가시성 개선 |
| **contacts** | 리스트 2열 | 체크박스 정렬 |

**저장 경로**: `D:\mabiz-crm\test-artifacts\640px-*.png`

### 768px (iPad - 가로)

| 페이지 | 스크린샷 항목 | 검증 포인트 |
|--------|------------|----------|
| **dashboard** | 전체 + 사이드바 | 데스크톱 레이아웃 진입 |
| **campaigns** | 테이블 3열 | 컬럼 너비 최적화 |
| **settings** | 폼 2열 | 입력 필드 배치 |

**저장 경로**: `D:\mabiz-crm\test-artifacts\768px-*.png`

---

## ✅ 검증 결과 템플릿

### 각 해상도별 최종 체크리스트

```markdown
## [320px - iPhone SE]

### 텍스트 가독성
- [ ] body 폰트: 14px 이상 ✅/❌ 
- [ ] line-height: 1.5배 이상 ✅/❌
- [ ] 제목 계층: h1 > h2 > h3 ✅/❌
- [ ] 대비도: WCAG AA 4.5:1 ✅/❌

### 그리드 레이아웃
- [ ] 1열 배치 (100% - 32px margin) ✅/❌
- [ ] 좌우 마진: 16px 이상 ✅/❌
- [ ] 테이블 컬럼 숨김: 정상 ✅/❌

### 이미지 비율
- [ ] aspect-ratio 유지 ✅/❌
- [ ] lazy loading 적용 ✅/❌

### 터치 타겟
- [ ] 버튼: 44×44px 이상 ✅/❌
- [ ] 입력 필드: 44px 높이 ✅/❌
- [ ] 간격: 8px 이상 ✅/❌

### 성능 (Lighthouse)
- [ ] Performance: ≥ 80점 ✅/❌
- [ ] Accessibility: ≥ 90점 ✅/❌
- [ ] CLS < 0.1 ✅/❌

### 발견된 이슈
1. [이슈]: ...
2. [이슈]: ...

### 추천 수정사항
1. [수정]: ...
2. [수정]: ...
```

---

## 🎬 자동화 체크: Playwright 스크립트 (Optional)

만약 **자동화 테스트**를 원한다면, 아래 Playwright 패턴을 사용할 수 있습니다:

```typescript
// tests/mobile-responsive.spec.ts
import { test, expect } from '@playwright/test';

const devices = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'iPhone 12', width: 375, height: 812 },
  { name: 'iPad mini', width: 640, height: 1024 },
  { name: 'iPad', width: 768, height: 1024 },
];

devices.forEach(device => {
  test(`${device.name}: Responsive layout`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/dashboard');

    // 텍스트 가독성 검증
    const title = page.locator('h1');
    const fontSize = await title.evaluate((el) => 
      window.getComputedStyle(el).fontSize
    );
    expect(parseInt(fontSize)).toBeGreaterThanOrEqual(24);

    // 터치 타겟 검증
    const buttons = page.locator('button');
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await context.close();
  });
});
```

---

## 📞 이슈 보고 템플릿

발견된 버그는 아래 형식으로 기록하세요:

```
## [P1-1-BUG-001] 320px에서 버튼 너비 초과

**해상도**: 320px (iPhone SE)  
**페이지**: /dashboard/sign-in  
**컴포넌트**: LoginButton  
**심각도**: High (UX 저해)  

**발견 사항**:
- 로그인 버튼 너비: 350px (뷰포트 초과)
- 예상: 너비 ≤ 288px (320 - 32px margin)

**스크린샷**: [링크 또는 파일명]  

**권장 수정**:
```css
@media (max-width: 375px) {
  button { width: 100% - 32px; }
}
```

**수정 커밋**: [커밋해시] 또는 [PR링크]
```

---

## 🎯 일정 및 담당자

| 단계 | 담당자 | 기간 | 상태 |
|------|--------|------|------|
| 테스트 환경 준비 | Engineering | 1시간 | 대기 |
| 텍스트 가독성 검증 | QA | 1시간 | 대기 |
| 레이아웃/그리드 검증 | QA | 1시간 | 대기 |
| 이미지/터치 타겟 검증 | QA | 1시간 | 대기 |
| 성능 (Lighthouse) 검증 | Performance | 1시간 | 대기 |
| **이슈 수정** | Engineering | 2-3일 | 대기 |
| **재검증** | QA | 1일 | 대기 |

---

## 참고 문서

- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [WCAG 2.1 모바일 체크리스트](https://www.w3.org/WAI/test-evaluate/mobile/)
- [Apple HIG: Touch Targets](https://developer.apple.com/design/human-interface-guidelines/mobile/components/interactive-elements/)
- [Web Vitals 가이드](https://web.dev/vitals/)

---

**최종 업데이트**: 2026-06-08  
**버전**: 1.0
