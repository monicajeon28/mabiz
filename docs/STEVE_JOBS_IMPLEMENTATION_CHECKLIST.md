# Steve Jobs UI/UX 구현 체크리스트
**마비즈 CRM | 2026-06-15 | 배포 전 필수**

---

## 📋 구현 단계별 체크리스트

### Phase 1: 기획 & 설계 (3일)

#### 1.1 콘셉트 정의

- [ ] **페이지 목표 명확화**
  - 사용자가 이 페이지에서 할 일 1-2가지만 정의
  - 예: "가격이 비싼 고객한테 자동으로 할부 메시지 보내기"
  
- [ ] **타겟 사용자 확인**
  - [ ] 주 사용자: 50대 (40-60살)
  - [ ] 스마트폰: iPhone 또는 안드로이드?
  - [ ] 인터넷 속도: 모바일 4G/LTE?

- [ ] **요구사항 정리**
  - [ ] 필수 기능: 3가지 이하 (집중)
  - [ ] 선택 기능: 2가지 이하 (복잡도 ↑)
  - [ ] 기술용어 리스트: 모두 일상 한글로 변환

#### 1.2 정보 구조 설계 (IA)

- [ ] **화면 흐름**
  - [ ] 시작: 어디서?
  - [ ] 선택: 몇 개 단계?
  - [ ] 완료: 언제 확인?

- [ ] **요소 배치**
  - [ ] 섹션 4개 이하
  - [ ] 섹션 간 순서: 논리적?
  - [ ] CTA 위치: 페이지 중간 또는 끝?

- [ ] **색상 선택**
  - [ ] 렌즈 확인: L0-L10 중 어느 것?
  - [ ] 주색 선택: 해당 렌즈 색상
  - [ ] 배경색 선택: 주색 + 15% 투명도

---

### Phase 2: 디자인 (5일)

#### 2.1 타이포그래피 지정

**파일: `/src/styles/typography.css` 또는 설정**

```css
/* 제목 (페이지 레벨) */
.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1A1A1A;
  line-height: 1.2;
  margin-bottom: 24px;
}

/* 섹션 헤드 */
.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1A1A1A;
  line-height: 1.3;
  margin-bottom: 16px;
}

/* 본문 */
.body-text {
  font-size: 16px;
  font-weight: 400;
  color: #333333;
  line-height: 1.6;
}

/* 설명/도움말 */
.help-text {
  font-size: 14px;
  font-weight: 400;
  color: #666666;
  line-height: 1.5;
}

/* 라벨 */
.label-text {
  font-size: 14px;
  font-weight: 500;
  color: #1A1A1A;
  line-height: 1.4;
}
```

**체크리스트:**
- [ ] 제목 24px 확인
- [ ] 본문 16px 확인
- [ ] 설명 14px 확인
- [ ] 색상 코드 일치
- [ ] 라인 높이 적용

#### 2.2 색상 시스템 지정

**파일: `/src/styles/colors.css` 또는 설정**

```css
/* 렌즈별 색상 (L0-L10) */
:root {
  /* L0: 부재중 고객 */
  --lens-0-primary: #9B59B6;
  --lens-0-bg: #F3E5F5;
  
  /* L1: 가격 이의 */
  --lens-1-primary: #FFD700;
  --lens-1-bg: #FFFACD;
  
  /* L3: 경쟁사 비교 */
  --lens-3-primary: #4A90E2;
  --lens-3-bg: #EBF4FF;
  
  /* L6: 타이밍/손실 */
  --lens-6-primary: #E74C3C;
  --lens-6-bg: #FADBD8;
  
  /* L10: 즉시 구매 */
  --lens-10-primary: #27AE60;
  --lens-10-bg: #D5F4E6;
}
```

**체크리스트:**
- [ ] 렌즈 확인: 이 페이지는 L몇?
- [ ] 주색 지정: 해당 렌즈 색상
- [ ] 배경색 지정: 대조색
- [ ] CSS 변수 적용 확인

#### 2.3 버튼 스타일 지정

**파일: `/src/components/Button.tsx` 또는 HTML**

```css
/* 기본 버튼 */
.btn {
  min-width: 120px;
  padding: 12px 24px;
  height: 48px;
  font-size: 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 주 버튼 */
.btn-primary {
  background-color: var(--lens-10-primary);
  color: white;
}

.btn-primary:hover {
  background-color: #229954;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.btn-primary:focus {
  outline: 2px solid var(--lens-10-primary);
  outline-offset: 2px;
}

/* 보조 버튼 */
.btn-secondary {
  background-color: #F5F5F5;
  color: #333333;
}

.btn-secondary:hover {
  background-color: #E0E0E0;
}
```

**체크리스트:**
- [ ] 높이 48px 확인
- [ ] 호버 상태 색상 확인
- [ ] 포커스 표시 (테두리) 확인
- [ ] 클릭 피드백 (색상 변경) 확인

#### 2.4 간격 시스템 지정

**파일: `/src/styles/spacing.css` 또는 설정**

```css
:root {
  /* 간격 스케일 */
  --spacing-0: 0;
  --spacing-2: 8px;    /* 작은 간격 */
  --spacing-3: 12px;   /* 폼 필드 패딩 */
  --spacing-4: 16px;   /* 기본 간격 */
  --spacing-5: 20px;   /* 크지만 작은 간격 */
  --spacing-6: 24px;   /* 섹션 간격 */
}

/* 섹션 */
.section {
  margin-bottom: var(--spacing-6);
  padding: var(--spacing-4);
  border-radius: 8px;
  background-color: #F9F9F9;
}

/* 카드 */
.card {
  padding: var(--spacing-4);
  border: 1px solid #E0E0E0;
  border-radius: 8px;
}

/* 버튼 그룹 */
.button-group {
  display: flex;
  gap: var(--spacing-4);
}
```

**체크리스트:**
- [ ] 섹션 간격 24px 적용
- [ ] 요소 간격 16px 적용
- [ ] 카드 패딩 16px 적용
- [ ] 라인 높이 1.6 적용

---

### Phase 3: 마크업 (HTML) (3일)

#### 3.1 시맨틱 HTML 구조

**파일: `/src/app/.../*.tsx` 또는 `.html`**

```html
<!-- ❌ 나쁜 예 -->
<div>
  <div>가격이 비싼 고객</div>
  <div>
    <input type="radio"> 안함
    <input type="radio"> 응
  </div>
</div>

<!-- ✅ 좋은 예 -->
<section class="lens-config" aria-labelledby="lens-1-title">
  <h2 id="lens-1-title" class="section-title">
    💰 가격이 비싼 고객
  </h2>
  
  <p class="help-text">
    이런 고객한테 자동으로 메시지 보낼래?
  </p>
  
  <fieldset class="radio-group">
    <legend>활성화</legend>
    <label for="lens-1-disabled">
      <input type="radio" id="lens-1-disabled" name="lens-1" value="false">
      안함
    </label>
    <label for="lens-1-enabled">
      <input type="radio" id="lens-1-enabled" name="lens-1" value="true" checked>
      응! 해줘
    </label>
  </fieldset>
</section>
```

**체크리스트:**
- [ ] `<h1>` 페이지 제목 포함
- [ ] `<h2>` 섹션 제목 포함
- [ ] `<label for="">` 모든 입력 필드
- [ ] `<fieldset>` `<legend>` 라디오/체크박스 그룹
- [ ] `aria-*` 접근성 속성 (ARIA)
- [ ] `class` 명확한 이름 (camelCase)

#### 3.2 반응형 마크업

```html
<!-- 모바일 우선 (Mobile First) -->
<div class="container">
  <!-- 모바일: 1칼럼 (기본) -->
  <!-- 태블릿: 2칼럼 (@media 640px) -->
  <!-- 데스크톱: 3칼럼 (@media 1024px) -->
</div>
```

**체크리스트:**
- [ ] Mobile First 원칙 (기본 = 모바일)
- [ ] `@media (min-width: 640px)` 태블릿
- [ ] `@media (min-width: 1024px)` 데스크톱
- [ ] Safe Area 적용 (iPhone)

#### 3.3 폼 필드 마크업

```html
<!-- ❌ 나쁜 예 -->
<input type="text" placeholder="예: 김철수">

<!-- ✅ 좋은 예 -->
<div class="form-group">
  <label for="customer-name" class="label-text">
    이름 <span class="required">*</span>
  </label>
  
  <input 
    type="text" 
    id="customer-name" 
    name="customerName"
    class="input-field"
    placeholder="예: 김철수"
    required
  >
  
  <div class="help-text">
    고객의 실명을 입력하세요 (한글)
  </div>
</div>
```

**체크리스트:**
- [ ] `<label for="">` 모든 필드
- [ ] `placeholder=""` 명확한 예시
- [ ] `<div class="help-text">` 도움말
- [ ] `required` 필수 필드 표시
- [ ] 입력창 높이 48px 이상

---

### Phase 4: 스타일링 (CSS/JS) (5일)

#### 4.1 반응형 CSS

**파일: `/src/styles/responsive.css` 또는 `*.module.css`**

```css
/* 모바일 (기본) */
.section {
  width: 100%;
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

/* 태블릿 (640px+) */
@media (min-width: 640px) {
  .section {
    width: 48%;
    display: inline-block;
  }
}

/* 데스크톱 (1024px+) */
@media (min-width: 1024px) {
  .section {
    width: 31%;
  }
}

/* iPhone Safe Area */
@media (min-width: 375px) {
  .page {
    padding-left: max(var(--spacing-4), env(safe-area-inset-left));
    padding-right: max(var(--spacing-4), env(safe-area-inset-right));
    padding-bottom: max(var(--spacing-6), env(safe-area-inset-bottom));
  }
}
```

**체크리스트:**
- [ ] Mobile First (640px 미만)
- [ ] Tablet (640px-1024px)
- [ ] Desktop (1024px+)
- [ ] iPhone Safe Area 적용

#### 4.2 호버 & 포커스 상태

```css
/* 호버 상태 */
.interactive-element:hover {
  background-color: #F0F0F0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

/* 포커스 상태 (Tab 키) */
.interactive-element:focus {
  outline: 2px solid var(--lens-color);
  outline-offset: 2px;
}

/* 포커스 & 호버 (마우스) */
.interactive-element:focus:not(:focus-visible) {
  outline: none;
}
```

**체크리스트:**
- [ ] 호버 피드백 명확 (색상 또는 그림자)
- [ ] 포커스 테두리 2px 이상
- [ ] 포커스 오프셋 2px (배치 변경 금지)

#### 4.3 로딩 & 에러 상태

```css
/* 로딩 상태 */
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.loading::after {
  content: "";
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-left: 8px;
  border: 2px solid #FFF;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* 에러 상태 */
.input-field.error {
  border-color: #E74C3C;
  background-color: #FADBD8;
}

.error-message {
  color: #C0392B;
  font-size: 14px;
  margin-top: 4px;
}
```

**체크리스트:**
- [ ] 로딩 스피너 표시
- [ ] 에러 메시지 빨간색
- [ ] 성공 메시지 초록색

---

### Phase 5: 상호작용 (JavaScript) (5일)

#### 5.1 실시간 미리보기

**파일: `/src/components/PreviewPanel.tsx` 또는 `.js`**

```javascript
// ✅ 미리보기 즉시 반영
const handleSelectChange = (e) => {
  const selectedTemplate = e.target.value;
  
  // 1. 즉시 상태 업데이트 (0ms)
  setPreviewContent(templates[selectedTemplate]);
  
  // 2. 로딩 표시 (1초 이상 걸릴 시)
  if (needsFetch) {
    setIsLoading(true);
    
    // 3. 백그라운드 데이터 로딩
    fetchTemplateData(selectedTemplate)
      .then((data) => {
        setPreviewContent(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
      });
  }
};
```

**체크리스트:**
- [ ] 선택 → 즉시 미리보기 (0ms)
- [ ] 1초+ 걸리면 로딩 스피너
- [ ] 에러 시 빨간색 경고

#### 5.2 폼 제출 피드백

```javascript
// ✅ 제출 후 피드백
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // 1. 제출 버튼 비활성화 + 로딩 표시
  setIsSubmitting(true);
  submitBtn.textContent = "⏳ 저장 중...";
  submitBtn.disabled = true;
  
  try {
    // 2. 서버 요청
    const response = await fetch("/api/save", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    
    if (!response.ok) throw new Error("저장 실패");
    
    // 3. 성공 피드백 (2초)
    submitBtn.textContent = "✅ 저장 완료!";
    submitBtn.style.backgroundColor = "#27AE60";
    
    // 4. 2초 후 원래대로
    setTimeout(() => {
      setIsSubmitting(false);
      submitBtn.textContent = "저장하기";
      submitBtn.style.backgroundColor = "";
      submitBtn.disabled = false;
    }, 2000);
    
  } catch (err) {
    // 5. 오류 피드백
    submitBtn.textContent = "❌ 저장 실패";
    submitBtn.style.backgroundColor = "#E74C3C";
    alert(err.message);
    
    setTimeout(() => {
      setIsSubmitting(false);
      submitBtn.textContent = "저장하기";
      submitBtn.disabled = false;
    }, 2000);
  }
};
```

**체크리스트:**
- [ ] 제출 → 버튼 비활성화
- [ ] 로딩 중 → 스피너 + 텍스트
- [ ] 완료 → 체크마크 + 초록색 (2초)
- [ ] 오류 → 오류 메시지 + 빨간색 (2초)

#### 5.3 접근성 (키보드 네비게이션)

```javascript
// ✅ Tab 키로 순서대로 이동 가능
const handleKeyDown = (e) => {
  // Tab 키
  if (e.key === "Tab") {
    // 자동으로 다음 포커스 가능 요소로 이동
    // (수동 처리 불필요 - 브라우저가 처리)
  }
  
  // Enter 키
  if (e.key === "Enter" && e.target.tagName === "BUTTON") {
    e.target.click();
  }
  
  // Space 키
  if (e.key === " " && e.target.tagName === "INPUT") {
    if (e.target.type === "checkbox") {
      e.target.checked = !e.target.checked;
    }
  }
};
```

**체크리스트:**
- [ ] Tab 키로 모든 버튼 접근 가능
- [ ] Enter 키로 폼 제출 가능
- [ ] 라디오 버튼 Space 키 토글
- [ ] 포커스 시작 위치 명확

---

### Phase 6: 검증 (QA) (3일)

#### 6.1 브라우저 호환성

| 브라우저 | 버전 | Desktop | Mobile |
|---------|------|---------|--------|
| Chrome | 최신 | ✅ | ✅ |
| Safari | 최신 | ✅ | ✅ |
| Firefox | 최신 | ✅ | ✅ |
| Edge | 최신 | ✅ | ✅ |

**체크리스트:**
- [ ] Chrome 최신 버전: 정상
- [ ] Safari 최신 버전: 정상
- [ ] Firefox 최신 버전: 정상
- [ ] iPhone Safari: 정상
- [ ] Android Chrome: 정상

#### 6.2 성능 검증

**도구: Google Lighthouse**

```
Performance: 90+ (목표)
├─ LCP (Largest Contentful Paint): < 2.5초
├─ FID (First Input Delay): < 100ms
├─ CLS (Cumulative Layout Shift): < 0.1
└─ TTFB (Time to First Byte): < 600ms
```

**체크리스트:**
- [ ] Lighthouse Performance 90+ (모바일)
- [ ] Lighthouse SEO 90+
- [ ] Lighthouse Best Practices 90+
- [ ] Lighthouse Accessibility 95+

#### 6.3 접근성 검증

**도구: axe DevTools 또는 WAVE**

```
WCAG 2.1 AA 기준
├─ 색상 대비: 4.5:1 이상 (텍스트)
├─ 키보드 네비게이션: 완전 가능
├─ ARIA 레이블: 모든 버튼/폼
├─ 포커스 표시: 2px 테두리
└─ 순서: Tab 키 순서 논리적
```

**체크리스트:**
- [ ] axe DevTools: 0개 오류
- [ ] 색상 대비: 4.5:1 이상
- [ ] Tab 키 순서: 논리적
- [ ] ARIA 레이블: 모두 있음
- [ ] 스크린리더 테스트: 가능

#### 6.4 사용성 테스트 (50대 사용자)

**참여자: 3-5명 (50-60살)**

```
테스트 시나리오:
1. "이 화면에서 뭘 하는 거죠?" → 5초 이내 이해?
2. "가격이 비싼 고객한테 메시지를 보내주세요" → 순서 명확?
3. "저장하기 버튼을 눌러주세요" → 버튼 크기 충분?
4. "모바일에서도 잘 보이나요?" → 가독성 문제?
5. "다시 하려면 어떻게 해요?" → 취소/리셋 가능?
```

**체크리스트:**
- [ ] 사용성 테스트 3명 완료
- [ ] 모든 참여자가 이해 (5초 이내)
- [ ] 버튼 크기 만족 (48px+)
- [ ] 폰트 크기 만족 (16px+)
- [ ] 색상 구분 만족 (명확)

---

### Phase 7: 배포 (1일)

#### 7.1 최종 체크

```
배포 전 체크리스트 (필수)

타이포그래피:
- [ ] 제목: 20px 이상 ✅
- [ ] 본문: 16px 이상 ✅
- [ ] 모든 텍스트 명확한 한글 ✅

버튼 & 터치:
- [ ] 모든 버튼: 48px × 48px ✅
- [ ] 버튼 간격: 16px+ ✅
- [ ] 호버/포커스 피드백 ✅
- [ ] 키보드 네비게이션 ✅

색상 & 대비:
- [ ] 배경/텍스트 구분 명확 ✅
- [ ] 렌즈별 색상 일관성 ✅
- [ ] 대비도 4.5:1+ ✅

구조 & 배치:
- [ ] 한 화면: 4개 섹션 이하 ✅
- [ ] 섹션 간: 24px ✅
- [ ] 요소 간: 16px ✅

언어 & 설명:
- [ ] 기술용어: 0개 ✅
- [ ] 도움말: 모두 있음 ✅
- [ ] 예시: 명확 ✅

미리보기:
- [ ] 즉시 반영 (0.2초) ✅
- [ ] 로딩 스피너 ✅
- [ ] 완료 메시지 ✅

반응형:
- [ ] 모바일 1칼럼 ✅
- [ ] 태블릿 2칼럼 ✅
- [ ] 데스크톱 3칼럼 ✅
- [ ] iPhone Safe Area ✅

성능:
- [ ] Lighthouse 90+ ✅
- [ ] LCP < 2.5초 ✅
- [ ] CLS < 0.1 ✅

접근성:
- [ ] axe DevTools 0 오류 ✅
- [ ] 색상 대비 4.5:1+ ✅
- [ ] 키보드 네비게이션 ✅

사용성:
- [ ] 50대 테스트 3명 ✅
- [ ] 모두 5초 이내 이해 ✅
```

#### 7.2 배포

```bash
# 1. 최종 빌드 검증
npm run build

# 2. TSC 타입 검증
npx tsc --noEmit

# 3. Lighthouse 검증
npm run lighthouse

# 4. Git 커밋
git add .
git commit -m "feat: Steve 50대 친화적 UI/UX 적용 (2026-06-15)"

# 5. Vercel 배포
git push origin main
# → Vercel 자동 배포
```

**체크리스트:**
- [ ] `npm run build` 성공
- [ ] `npx tsc --noEmit` 0 에러
- [ ] Lighthouse 90+ 달성
- [ ] Git 커밋 완료
- [ ] Vercel 배포 완료

---

## 📊 체크리스트 추적

### 프로젝트별 추적 테이블

| 프로젝트 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Phase 7 | 상태 |
|---------|--------|--------|--------|--------|--------|--------|--------|------|
| SMS 설정 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⏳ | 배포 전 |
| 홈 대시보드 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⏳ | 배포 전 |
| 연락처 생성 | ✅ | ✅ | ⏳ | - | - | - | - | Phase 3 진행 |
| 메시지 편집 | - | - | - | - | - | - | - | 예정 |

### 주간 체크인

| 주차 | Phase | 완료율 | 이슈 | 담당자 |
|-----|-------|--------|------|--------|
| 1주 | 1-2 | 100% | 없음 | Design Team |
| 2주 | 3-4 | 85% | 폼 스타일 수정 중 | Dev Team |
| 3주 | 5-6 | 0% | 예정 | QA Team |
| 4주 | 7 | 0% | 배포 예정 | Ops Team |

---

## 💾 문서 및 참고자료

### 필수 문서
- `CLAUDE.md` — 에이전트 지시서 (v5.0)
- `STEVE_JOBS_UI_UX_GUIDE.md` — 50대 친화적 UI/UX 가이드
- `STEVE_JOBS_IMPLEMENTATION_CHECKLIST.md` — 이 문서

### 기술 참고
- [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/)
- [Google Material Design](https://material.io/design/)
- [Web Content Accessibility Guidelines](https://www.w3.org/WAI/test-evaluate/)

---

**최종 수정**: 2026-06-15
**버전**: 1.0 (완성)
**담당**: Design Team + Dev Team
**다음 검토**: 2026-07-15
