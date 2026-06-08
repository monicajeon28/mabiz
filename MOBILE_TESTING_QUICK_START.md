# 모바일 테스트 빠른 시작 가이드 (P1-1)

**목표**: 4개 해상도(320px, 375px, 640px, 768px)에서 5가지 검증 항목을 **30분 안에** 검증

---

## ⚡ 5분 환경 구성

### Step 1: Chrome DevTools 열기
```
1. Chrome 열기 → http://localhost:3000/dashboard
2. F12 (또는 ⌘+Option+I) → DevTools 열기
3. ⌘+Shift+M (또는 Ctrl+Shift+M) → Device Toolbar 활성화
```

### Step 2: 커스텀 해상도 추가
```
1. Device Toolbar 좌측: "Responsive" 클릭
2. "Edit custom devices" → "+ Create a new device"
   - iPhone SE: 320×568, 2x DPR
   - iPhone 12: 375×812, 3x DPR
   - iPad mini: 640×1024, 2x DPR
   - iPad: 768×1024, 2x DPR
3. 각 해상도 저장
```

---

## 🚀 10분 핵심 검증 (Manual Checklist)

### Phase 1: 320px 검증 (3분)

**URL**: http://localhost:3000/auth/sign-in

```
┌─ 텍스트 가독성
│  ├─ [ ] 제목이 명확하게 보이는가? (최소 24px)
│  ├─ [ ] 입력 라벨이 명확한가? (최소 14px)
│  └─ [ ] 버튼 텍스트가 명확한가? (최소 16px)
├─ 그리드 레이아웃
│  ├─ [ ] 폼이 화면 너비를 초과하지 않는가?
│  └─ [ ] 좌우 마진이 최소 16px인가?
├─ 터치 타겟
│  ├─ [ ] 입력 필드 높이 ≥ 44px?
│  └─ [ ] 로그인 버튼 높이 ≥ 44px?
└─ 성능
   └─ [ ] 페이지 로드 < 2초?
```

**스크린샷**: F12 → ⋮ → "Capture screenshot"

---

### Phase 2: 375px 검증 (2분)

**URL**: http://localhost:3000/dashboard/campaigns

```
┌─ 텍스트 가독성
│  └─ [ ] 카드 제목/설명이 명확한가?
├─ 그리드 레이아웃
│  └─ [ ] 카드가 1열로 배치되는가? (100% - 마진)
├─ 이미지 비율
│  └─ [ ] 카드 이미지가 변형되지 않는가? (aspect-ratio 유지)
└─ 성능
   └─ [ ] 스크롤 시 프레임 드롭이 없는가? (60fps)
```

---

### Phase 3: 640px 검증 (2분)

**URL**: http://localhost:3000/dashboard

```
┌─ 그리드 레이아웃
│  ├─ [ ] 카드가 2열로 배치되는가?
│  └─ [ ] 카드 간 gap이 일정한가? (16px)
├─ 이미지 비율
│  └─ [ ] 2열에서도 이미지가 유지되는가?
└─ 터치 타겟
   └─ [ ] 카드 클릭 영역이 충분한가?
```

---

### Phase 4: 768px 검증 (2분)

**URL**: http://localhost:3000/dashboard

```
┌─ 그리드 레이아웃
│  ├─ [ ] 사이드바가 표시되는가? (왼쪽 240px)
│  └─ [ ] 메인 콘텐츠가 적절하게 배치되는가?
├─ 텍스트 가독성
│  └─ [ ] 제목/본문 크기가 데스크톱 수준인가?
└─ 성능
   └─ [ ] Lighthouse Performance ≥ 85점?
```

**Lighthouse 실행**: F12 → Lighthouse → "Analyze page load"

---

## 📋 이슈 발견 체크리스트

**발견한 이슈가 있으면 즉시 기록하세요**:

```markdown
## [320px-BUG-001] 로그인 버튼 너비 초과

- **해상도**: 320px
- **페이지**: /auth/sign-in
- **증상**: 로그인 버튼이 화면 너비를 10px 초과
- **예상**: 버튼 너비 ≤ 288px (320 - 32px margin)
- **스크린샷**: [캡처]
```

---

## 🔍 DevTools 팁 (성능 측정)

### Lighthouse 점수 확인
```
1. F12 → Lighthouse 탭
2. "Analyze page load" 클릭
3. Performance 점수 확인
   - ≥ 80점: ✅ PASS
   - 70-79점: ⚠️ 주의
   - < 70점: ❌ FAIL
```

### CLS (Layout Shift) 확인
```
1. F12 → Performance 탭
2. 녹화 시작 (⚫)
3. 페이지 스크롤 또는 상호작용
4. 녹화 중지
5. 결과에서 "Layout Shifts" 확인
   - CLS < 0.1: ✅ PASS
```

### 터치 타겟 크기 확인
```
1. F12 → Elements 탭
2. 요소 선택 (Ctrl+Shift+C)
3. 버튼 클릭
4. Computed Styles에서:
   - width ≥ 44px?
   - height ≥ 44px?
   - padding 확인
```

---

## 📸 스크린샷 캡처 (자동)

### Playwright 자동 테스트 실행
```powershell
# 1. 테스트 실행 (DevTools 열고 보기)
npx playwright test tests/mobile-responsive.spec.ts --headed

# 2. 스크린샷 생성 위치
# test-artifacts/ 폴더에 자동 생성

# 3. 결과 확인
# 콘솔에서 통과/실패 수 확인
```

---

## ✅ 최종 체크리스트 (배포 전)

모든 해상도 테스트 완료 후:

```
┌─ 텍스트 가독성
│  ├─ [ ] 320px: 모든 텍스트 ≥ 14px
│  ├─ [ ] 375px: 모든 텍스트 ≥ 14px
│  ├─ [ ] 640px: 모든 텍스트 ≥ 14px
│  └─ [ ] 768px: 모든 텍스트 ≥ 14px
├─ 그리드 레이아웃
│  ├─ [ ] 320-375px: 1열 배치
│  ├─ [ ] 640px: 2열 배치 가능
│  └─ [ ] 768px: 데스크톱 레이아웃
├─ 이미지 비율
│  └─ [ ] 모든 해상도: aspect-ratio 유지
├─ 터치 타겟
│  └─ [ ] 모든 요소: 최소 44×44px 또는 근처
├─ 성능
│  ├─ [ ] 320-375px: Lighthouse ≥ 80점
│  ├─ [ ] 640px: Lighthouse ≥ 75점
│  └─ [ ] 768px: Lighthouse ≥ 85점
└─ 이슈
   ├─ [ ] P0 (긴급): 0개
   ├─ [ ] P1 (중요): ≤ 2개 (계획 수립)
   └─ [ ] P2 (개선): 제한 없음
```

---

## 🎯 자주 발견되는 이슈

| 이슈 | 원인 | 수정 방법 |
|------|------|---------|
| **버튼 너비 초과** | padding/margin 부족 | `@media (max-width: 375px) { button { width: 100%; } }` |
| **텍스트 작음** | 기본 font-size 12px 이하 | `@media (max-width: 640px) { body { font-size: 14px; } }` |
| **테이블 스크롤** | 컬럼이 너무 많음 | 모바일에서 `display: none`으로 불필요한 컬럼 숨김 |
| **이미지 변형** | aspect-ratio 미설정 | `img { aspect-ratio: 16 / 9; object-fit: cover; }` |
| **CLS (레이아웃 이동)** | 이미지 로드 후 높이 변경 | `img { height: auto; aspect-ratio: 16 / 9; }` |
| **터치 타겟 작음** | 버튼/입력 높이 < 44px | `button { min-height: 44px; }` |

---

## 💡 Tailwind CSS 빠른 팁

### 반응형 클래스
```jsx
// 320px (기본)
<div className="w-full px-4">
  
// 640px 이상
<div className="md:w-2/3 md:px-6">

// 768px 이상
<div className="lg:w-3/4 lg:px-8">
```

### 그리드 레이아웃
```jsx
// 320px: 1열
<div className="grid grid-cols-1 gap-4">
  
// 640px: 2열
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// 768px: 3열
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### 텍스트 크기
```jsx
// 기본: 14px
<p className="text-sm">

// 명확한 제목: 24px
<h1 className="text-2xl md:text-3xl">

// 작은 텍스트: 12px (가능하면 피할 것)
<small className="text-xs">
```

### 터치 타겟
```jsx
// 최소 44×44px
<button className="h-11 px-4 py-2">
  버튼
</button>

// 또는 명시적
<button className="min-h-[44px] min-w-[44px]">
  아이콘 버튼
</button>
```

---

## 🚨 테스트 실패 시 대응

### "버튼이 너무 작습니다" (< 44px)
```jsx
// ❌ 나쁜 예
<button className="px-2 py-1 text-sm">작은 버튼</button>

// ✅ 좋은 예
<button className="min-h-11 px-4 py-3 text-base">큰 버튼</button>
```

### "텍스트가 너무 작습니다" (< 14px)
```jsx
// ❌ 나쁜 예
<p className="text-xs">작은 텍스트</p>

// ✅ 좋은 예
<p className="text-sm md:text-base">읽기 쉬운 텍스트</p>
```

### "테이블이 스크롤됩니다"
```jsx
// ❌ 나쁜 예
<table className="w-full">
  <thead>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Email</th>
      <th>Phone</th>
      <th>Address</th>
      <th>Actions</th>
    </tr>
  </thead>
</table>

// ✅ 좋은 예
<table className="w-full">
  <thead>
    <tr>
      <th>Name</th>
      <th className="hidden md:table-cell">Email</th>
      <th className="hidden lg:table-cell">Phone</th>
      <th>Actions</th>
    </tr>
  </thead>
</table>
```

---

## 📞 도움말

- **Tailwind 반응형**: https://tailwindcss.com/docs/responsive-design
- **WCAG 모바일 가이드**: https://www.w3.org/WAI/test-evaluate/mobile/
- **Apple HIG 터치 타겟**: https://developer.apple.com/design/human-interface-guidelines/mobile/components/interactive-elements/
- **Core Web Vitals**: https://web.dev/vitals/

---

**버전**: 1.0  
**작성**: 2026-06-08
