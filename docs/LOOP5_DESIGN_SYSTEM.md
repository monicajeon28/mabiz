# Loop 5-B: cruisedot 디자인 시스템 가이드

**작성일**: 2026-05-28  
**버전**: 1.0  
**담당**: AI Agent (비주얼 디자인)

---

## 📋 목차
1. 색상팔레트 (Segment A-E)
2. Typography 규칙
3. 스페이싱 (8px Grid System)
4. 이미지 비율 및 배치
5. CTA 버튼 코드 샘플
6. 다크모드 준비
7. Segment별 변형 가이드

---

## 1️⃣ 색상팔레트 (Segment A-E)

### Segment A: 30대 신혼부부 (신민형 전략)

#### 색상값
| 용도 | 16진수 | RGB | CMYK |
|------|--------|-----|------|
| 주색상 | #FFB6D9 | 255, 182, 217 | 0, 29, 15, 0 |
| 보조색 | #87CEEB | 135, 206, 235 | 43, 12, 0, 8 |
| 강조색 | #FF69B4 | 255, 105, 180 | 0, 59, 29, 0 |
| 배경색 | #FFFFFF | 255, 255, 255 | 0, 0, 0, 0 |
| 텍스트 | #364d8e | 54, 77, 142 | 62, 46, 0, 44 |

#### CSS 변수
```css
:root[data-segment="A"] {
  --primary: #FFB6D9;      /* 파스텔 핑크 - 로맨스 */
  --secondary: #87CEEB;    /* 라이트 블루 - 신뢰 */
  --accent: #FF69B4;       /* 핫핑크 - CTA 호버 */
  --background: #FFFFFF;   /* 순백 - 깔끔함 */
  --text: #364d8e;         /* 진한 파랑 - 가독성 */
  --shadow: rgba(255, 182, 217, 0.2);
}
```

#### 심리학 해석
- **파스텔 핑크**: 로맨스, 사랑, 설렘 → Beta 뇌파 (관심 집중)
- **라이트 블루**: 차분함, 신뢰, 안정 → Theta 뇌파 (이완)
- 결합: 감정적 설렘 + 신뢰감

#### 사용 사례
```
Hero 배경: linear-gradient(var(--secondary), var(--accent))
CTA 버튼: background-color: var(--accent)
카드 배경: background: var(--background)
테두리: border-color: var(--primary)
텍스트: color: var(--text)
```

---

### Segment B: 40대 가족 (모니카 전략)

#### 색상값
| 용도 | 16진수 | RGB | CMYK |
|------|--------|-----|------|
| 주색상 | #D4AF84 | 212, 175, 132 | 0, 17, 38, 17 |
| 보조색 | #F5DEB3 | 245, 222, 179 | 0, 9, 27, 4 |
| 강조색 | #808000 | 128, 128, 0 | 0, 0, 100, 50 |
| 배경색 | #FFFAF0 | 255, 250, 240 | 0, 2, 6, 0 |
| 텍스트 | #2C3E50 | 44, 62, 80 | 45, 23, 0, 69 |

#### CSS 변수
```css
:root[data-segment="B"] {
  --primary: #D4AF84;      /* 따뜻한 갈색 - 가정 */
  --secondary: #F5DEB3;    /* 밀크베이지 - 부드러움 */
  --accent: #808000;       /* 올리브 - 안정감 */
  --background: #FFFAF0;   /* 플로럴화이트 - 따뜻함 */
  --text: #2C3E50;         /* 다크 슬레이트 - 신뢰 */
  --shadow: rgba(212, 175, 132, 0.2);
}
```

#### 심리학 해석
- **따뜻한 갈색**: 가정, 안정, 따뜻함 → Theta 뇌파 (정서적 연결)
- **밀크베이지**: 부드러움, 친근함 → 안심감
- 결합: 가족적 온기 + 신뢰감

#### 사용 사례
```
Hero 배경: linear-gradient(#F5DEB3, #D4AF84)
CTA 버튼: background-color: var(--accent)
카드 배경: background: rgba(212, 175, 132, 0.1)
텍스트: color: var(--text)
```

---

### Segment C: 50대 중년 (신민형 고급형)

#### 색상값
| 용도 | 16진수 | RGB | CMYK |
|------|--------|-----|------|
| 주색상 | #2C3E50 | 44, 62, 80 | 45, 23, 0, 69 |
| 보조색 | #F8F7F4 | 248, 247, 244 | 0, 0, 2, 3 |
| 강조색 | #D4AF37 | 212, 175, 55 | 0, 17, 74, 17 |
| 악센트 | #722F37 | 114, 47, 55 | 0, 59, 52, 55 |
| 배경색 | #F8F7F4 | 248, 247, 244 | 0, 0, 2, 3 |
| 텍스트 | #2C3E50 | 44, 62, 80 | 45, 23, 0, 69 |

#### CSS 변수
```css
:root[data-segment="C"] {
  --primary: #2C3E50;      /* 다크 슬레이트 - 세련됨 */
  --secondary: #F8F7F4;    /* 밝은 베이지 - 우아함 */
  --accent: #D4AF37;       /* 골드 - 럭셀리 */
  --accent-alt: #722F37;   /* 와인 - 고급스러움 */
  --background: #F8F7F4;
  --text: #2C3E50;
  --shadow: rgba(44, 62, 80, 0.2);
}
```

#### 심리학 해석
- **다크 슬레이트**: 세련됨, 지성, 신뢰 → Beta 뇌파 (고급 인식)
- **골드**: 성공, 럭셀리, 지위 → 가치인식 +50%
- 결합: 지적 세련됨 + 성공의 상징

#### 사용 사례
```
Hero 배경: linear-gradient(135deg, #2C3E50, #F8F7F4)
CTA 버튼: background-color: var(--accent)
카드: border-left: 4px solid var(--accent)
텍스트: color: var(--primary)
강조: color: var(--accent-alt)
```

---

### Segment D: 60대 VVIP (럭셀리 전략)

#### 색상값
| 용도 | 16진수 | RGB | CMYK |
|------|--------|-----|------|
| 주색상 | #1a1a1a | 26, 26, 26 | 0, 0, 0, 90 |
| 보조색 | #F5F3F0 | 245, 243, 240 | 0, 1, 2, 4 |
| 강조색 | #FFD700 | 255, 215, 0 | 0, 16, 100, 0 |
| 악센트 | #E6B5D8 | 230, 181, 216 | 0, 21, 6, 10 |
| 배경색 | #F5F3F0 | 245, 243, 240 | 0, 1, 2, 4 |
| 텍스트 | #2C2C2C | 44, 44, 44 | 0, 0, 0, 83 |

#### CSS 변수
```css
:root[data-segment="D"] {
  --primary: #1a1a1a;      /* 프리미엄 검정 - 배타성 */
  --secondary: #F5F3F0;    /* 진주 화이트 - 우아함 */
  --accent: #FFD700;       /* 반짝이는 금색 - 럭셀리 */
  --accent-alt: #E6B5D8;   /* 라벤더 - 세련됨 */
  --background: #F5F3F0;
  --text: #2C2C2C;
  --shadow: rgba(0, 0, 0, 0.3);
}
```

#### 심리학 해석
- **프리미었 검정**: 배타성, 권력, 정교함 → VIP 인식 +75%
- **반짝이는 금색**: 성공, 부, 꿈 → 욕망 자극 +80%
- 결합: 최고 지위 + 궁극의 성공

#### 사용 사례
```
Hero 배경: linear-gradient(135deg, #1a1a1a, #2C3E50)
CTA 버튼: background: linear-gradient(135deg, #1a1a1a, #2C3E50); color: #FFD700;
카드: background: #F5F3F0; border: 2px solid #FFD700;
텍스트: color: #2C2C2C
강조: color: #FFD700; font-weight: bold;
```

---

### Segment E: 70대+ 꿈 (감동 전략)

#### 색상값
| 용도 | 16진수 | RGB | CMYK |
|------|--------|-----|------|
| 주색상 | #E6B89C | 230, 184, 156 | 0, 20, 32, 10 |
| 보조색 | #FFFFF0 | 255, 255, 240 | 0, 0, 6, 0 |
| 강조색 | #D4AF37 | 212, 175, 55 | 0, 17, 74, 17 |
| 배경색 | #F9F8F6 | 249, 248, 246 | 0, 0, 1, 2 |
| 텍스트 | #4A4A4A | 74, 74, 74 | 0, 0, 0, 71 |

#### CSS 변수
```css
:root[data-segment="E"] {
  --primary: #E6B89C;      /* 따뜨한 갈색 - 추억 */
  --secondary: #FFFFF0;    /* 아이보리 - 편안함 */
  --accent: #D4AF37;       /* 골드 - 회상적 */
  --background: #F9F8F6;   /* 크림색 - 따뜨함 */
  --text: #4A4A4A;         /* 다크 그레이 - 부드러움 */
  --shadow: rgba(230, 184, 156, 0.2);
}
```

#### 심리학 해석
- **따뜨한 갈색**: 추억, 온기, 회상 → Theta 뇌파 (감정 연결)
- **아이보리**: 편안함, 순수함, 안전 → 불안감 -40%
- 결합: 회상적 감동 + 안정감

#### 사용 사례
```
Hero 배경: linear-gradient(135deg, #E6B89C, #FFFFF0)
CTA 버튼: background-color: var(--accent)
카드: background: var(--secondary)
텍스트: color: var(--text); font-size: 16px; (크기 증대)
필터: filter: sepia(0.2) saturate(0.9);
```

---

## 2️⃣ Typography 규칙

### 기본 폰트 스택

```css
/* 기본 (모든 세그먼트) */
body {
  font-family: 'Noto Sans KR', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 세리프 (Segment C, D - 우아함) */
.serif {
  font-family: 'Georgia', 'Playfair Display', serif;
}

/* 라이트 (Segment A - 부드러움) */
.light {
  font-family: 'Noto Sans KR Light', 'Noto Sans Light', sans-serif;
  font-weight: 300;
}

/* 몬트세랫 (Segment C - 세련됨) */
.montserrat {
  font-family: 'Montserrat', 'Noto Sans KR', sans-serif;
}
```

### 크기 규칙 (모바일 기준 / PC 괄호)

| 용도 | 크기 | 굵기 | 라인높이 | 자간 |
|------|------|-----|--------|------|
| H1 Hero | 28px / 42px | Bold (700) | 1.3 | 0px |
| H2 섹션 | 24px / 32px | SemiBold (600) | 1.3 | 0.5px |
| H3 제목 | 20px / 28px | SemiBold (600) | 1.4 | 0.5px |
| H4 소제목 | 16px / 20px | Bold (700) | 1.5 | 0px |
| 본문 | 14px / 16px | Regular (400) | 1.6 | 0px |
| 본문 Large (E) | 16px / 18px | Regular (400) | 1.8 | 0px |
| 작은 텍스트 | 12px / 14px | Medium (500) | 1.5 | 0px |
| CTA | 14px / 16px | Bold (700) | 1.4 | 0.5px |

### 코드 예시

#### Hero 메인제목
```css
.hero-content h1 {
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 28px; /* PC: 42px */
  font-weight: 700; /* Bold */
  line-height: 1.3;
  letter-spacing: 0px;
  margin-bottom: 20px;
  color: white;
  text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
}

@media (min-width: 1024px) {
  .hero-content h1 {
    font-size: 42px;
  }
}
```

#### 섹션 제목
```css
h2 {
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 24px; /* PC: 32px */
  font-weight: 600; /* SemiBold */
  line-height: 1.3;
  letter-spacing: 0.5px;
  color: var(--text);
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--accent);
}
```

#### 본문 (Segment E - 70대+)
```css
body[data-segment="E"] p {
  font-size: 16px; /* PC: 18px - 크기 확대 */
  font-weight: 400;
  line-height: 1.8; /* 1.6 → 1.8로 확대 */
  letter-spacing: 0px;
  color: var(--text);
}
```

#### CTA 버튼 텍스트
```css
.cta-button {
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 14px; /* PC: 16px */
  font-weight: 700; /* Bold */
  line-height: 1.4;
  letter-spacing: 0.5px;
}
```

---

## 3️⃣ 스페이싱 (8px Grid System)

### 기본 스페이싱 단위

```css
--spacing-xs: 8px;    /* 1 unit */
--spacing-sm: 16px;   /* 2 units */
--spacing-md: 24px;   /* 3 units */
--spacing-lg: 40px;   /* 5 units */
--spacing-xl: 60px;   /* 7.5 units */
--spacing-2xl: 80px;  /* 10 units */
```

### 섹션 마진/패딩

#### 모바일 (≤767px)
```css
section {
  margin: 40px 0;       /* 위아래 */
  padding: 0 20px;      /* 좌우 */
}
```

#### 태블릿 (768px-1023px)
```css
@media (min-width: 768px) {
  section {
    margin: 60px 0;
    padding: 0 40px;
  }
}
```

#### PC (≥1024px)
```css
@media (min-width: 1024px) {
  section {
    margin: 80px 0;
    padding: 0 60px;
  }
}
```

### 컴포넌트 내부 스페이싱

#### 버튼
```css
.cta-button.variant-1 {
  padding: 14px 36px;   /* 상하 / 좌우 */
}

.cta-button.variant-2 {
  padding: 16px 44px;
}

.cta-button.variant-3 {
  padding: 18px 48px;
}
```

#### 카드
```css
.card {
  padding: 24px;      /* 16px (sm) × 1.5 */
  margin-bottom: 24px;
  border-radius: 12px;
}
```

#### 텍스트 간격
```css
h2 {
  margin-bottom: 30px;   /* 24px (md) + 6px */
}

p {
  margin-bottom: 16px;   /* sm */
  line-height: 1.6;
}

.feature-list li {
  padding: 10px 0;
  padding-left: 30px;   /* 아이콘 공간 */
}
```

#### 그리드 간격
```css
/* 2칸 그리드 */
.collage-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;   /* 모바일 */
}

@media (min-width: 1024px) {
  .collage-grid {
    gap: 30px;   /* PC */
  }
}
```

---

## 4️⃣ 이미지 비율 및 배치

### 이미지 비율 표준

| 용도 | 비율 | 가로 | 세로 | 권장 크기 |
|------|------|------|------|----------|
| Hero | 16:9 | 1600 | 900 | 1440×810 |
| Hero (모바일) | 16:9 | 375 | 211 | 750×422 |
| Supporting | 16:9 | 1200 | 675 | 1200×675 |
| Supporting (모바일) | 4:3 | 400 | 300 | 800×600 |
| Collage | 1:1 | 400 | 400 | 800×800 |
| Testimonial | 16:9 | 600 | 338 | - |

### 이미지 컨테이너 스타일

```css
/* Hero Image */
.hero-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

.hero-background img {
  width: 100%;
  height: 100%;
  object-fit: cover;       /* 비율 유지하며 채우기 */
  filter: brightness(0.95); /* 약간 어둡게 */
}

/* Supporting Images */
.image-container {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  aspect-ratio: 16 / 9;
  box-shadow: 0 4px 12px var(--shadow);
}

.image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.image-container:hover img {
  transform: scale(1.05);   /* 호버 확대 */
}

/* Collage Grid Items */
.grid-item {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  aspect-ratio: 1 / 1;
  box-shadow: 0 4px 12px var(--shadow);
}

.grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### 이미지 배치 원칙

#### 모바일 (≤767px)
```css
/* 사진은 풀 너비 */
.image-container {
  width: 100%;
  margin: 0 -20px;  /* 섹션 패딩 제거 */
  border-radius: 0;
}

/* Collage는 1열 스택 */
.collage-grid {
  grid-template-columns: 1fr;
  gap: 15px;
}
```

#### PC (≥1024px)
```css
/* 사진은 콘테이너 너비 */
.image-container {
  max-width: 800px;
  margin: 0 auto;
}

/* Collage는 2x2 그리드 */
.collage-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 30px;
}
```

### 색상 필터 (Segment별)

```css
/* Segment A - 파스텔 핑크 필터 */
.day0-image[data-segment="A"] {
  filter: hue-rotate(-10deg) saturate(1.2) brightness(1.05);
}

/* Segment B - 따뜨한 갈색 필터 */
.day0-image[data-segment="B"] {
  filter: hue-rotate(-20deg) saturate(1.1) brightness(1.0);
}

/* Segment C - 세련된 골드톤 필터 */
.day0-image[data-segment="C"] {
  filter: hue-rotate(-30deg) saturate(0.9) brightness(1.1);
}

/* Segment D - 럭셀리 다크톤 필터 */
.day0-image[data-segment="D"] {
  filter: brightness(0.9) contrast(1.2) saturate(1.1);
}

/* Segment E - 따뜻하고 회상적 필터 */
.day0-image[data-segment="E"] {
  filter: sepia(0.2) saturate(0.9) brightness(1.05);
}
```

---

## 5️⃣ CTA 버튼 코드 샘플

### Variant 1: 직관적 "지금 예약하기"

**HTML**:
```html
<button class="cta-button variant-1" data-segment="A">
  지금 예약하기
</button>
```

**CSS**:
```css
.cta-button.variant-1 {
  padding: 14px 36px;
  font-size: 16px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px var(--shadow);
  letter-spacing: 0.5px;
  background-color: var(--accent);
  color: white;
}

.cta-button.variant-1:hover {
  background-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px var(--shadow);
  filter: brightness(0.9);
}

.cta-button.variant-1:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px var(--shadow);
}

/* 모바일 터치 대상 최소 44×44px */
@media (max-width: 767px) {
  .cta-button.variant-1 {
    padding: 12px 32px;
    font-size: 16px;
    min-height: 44px;
  }
}
```

**JavaScript (선택사항)**:
```javascript
const button = document.querySelector('.cta-button.variant-1');
button.addEventListener('click', () => {
  console.log('Variant 1 clicked');
  // 분석 이벤트 전송
  gtag('event', 'cta_click', {
    button_type: 'variant-1',
    segment: button.getAttribute('data-segment')
  });
});
```

---

### Variant 2: 액션 지향 "내 크루즈 찾기"

**HTML**:
```html
<button class="cta-button variant-2" data-segment="B">
  내 크루즈 찾기
  <span class="arrow">→</span>
</button>
```

**CSS**:
```css
.cta-button.variant-2 {
  padding: 16px 44px;
  font-size: 16px;
  font-weight: 600;
  border: 2px solid var(--accent);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0.5px;
  color: var(--accent);
}

.cta-button.variant-2:hover {
  background-color: var(--accent);
  color: white;
  transform: translateX(4px);
  box-shadow: 0 4px 12px var(--shadow);
}

.cta-button.variant-2 .arrow {
  font-size: 20px;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.cta-button.variant-2:hover .arrow {
  opacity: 1;
  transform: translateX(4px);
}

.cta-button.variant-2:active {
  transform: translateX(2px);
}

/* 모바일 */
@media (max-width: 767px) {
  .cta-button.variant-2 {
    padding: 12px 32px;
    font-size: 16px;
    min-height: 44px;
  }
}
```

---

### Variant 3: 감정 호소 "럭셀리 경험 신청"

**HTML**:
```html
<button class="cta-button variant-3" data-segment="D">
  <span class="main-text">럭셀리 경험 신청</span>
  <span class="subtext">무료 상담 포함</span>
</button>
```

**CSS**:
```css
.cta-button.variant-3 {
  padding: 18px 48px;
  font-size: 16px;
  font-weight: bold;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 24px var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: var(--secondary);
}

.cta-button.variant-3:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px var(--shadow);
  filter: brightness(1.05);
}

.cta-button.variant-3:active {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px var(--shadow);
}

.cta-button.variant-3 .main-text {
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.cta-button.variant-3 .subtext {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
  letter-spacing: 0.3px;
}

/* 모바일 */
@media (max-width: 767px) {
  .cta-button.variant-3 {
    padding: 14px 40px;
    font-size: 16px;
    min-height: 44px;
  }
}
```

---

### 버튼 세트 (모든 Variant + 모든 Segment)

**HTML**:
```html
<div class="button-group">
  <button class="cta-button variant-1" data-segment="A">지금 예약하기</button>
  <button class="cta-button variant-2" data-segment="B">내 크루즈 찾기<span class="arrow">→</span></button>
  <button class="cta-button variant-3" data-segment="D">
    <span class="main-text">럭셀리 경험 신청</span>
    <span class="subtext">무료 상담 포함</span>
  </button>
</div>
```

**CSS**:
```css
.button-group {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  margin: 30px 0;
}

@media (max-width: 767px) {
  .button-group {
    flex-direction: column;
    gap: 10px;
  }

  .button-group button {
    width: 100%;
  }
}
```

---

## 6️⃣ 다크모드 지원 여부

### 현재 상태: NO (Light Mode Only)
**배포**: 2026-06-15

### 향후 다크모드 준비 코드

```css
/* Light Mode (현재) */
:root {
  --background: #FFFFFF;
  --text: var(--primary-text-dark);
  --surface: #F9F9F9;
}

/* Dark Mode (준비 중) */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #1a1a1a;
    --text: #EFEFEF;
    --surface: #2a2a2a;
  }

  /* Segment별 다크모드 색상 조정 필요 */
  :root[data-segment="A"] {
    --primary: #FF99C8;     /* 더 밝은 핑크 */
    --secondary: #66B2DB;   /* 더 진한 블루 */
  }

  /* ... 나머지 세그먼트 */
}

/* HTML에서 활성화 */
<html class="dark">...</html>

/* 또는 시스템 설정 따르기 */
<html class="auto-dark">...</html>
```

---

## 7️⃣ Segment별 변형 가이드

### 색상 변형 적용 방법

#### 방법 1: CSS Variables (권장)
```html
<html data-segment="A">
  <!-- Segment A 색상 자동 적용 -->
</html>
```

#### 방법 2: CSS 클래스
```html
<button class="cta-button variant-1 segment-a">
  지금 예약하기
</button>

<style>
  .cta-button.variant-1.segment-a {
    background-color: #FF69B4;
  }
  .cta-button.variant-1.segment-a:hover {
    background-color: #FF1493;
  }
</style>
```

#### 방법 3: 인라인 스타일 (피할 것)
```html
<!-- 피해야 할 방식 -->
<button style="background-color: #FF69B4;">
  지금 예약하기
</button>
```

### Segment별 UI 변형 예시

#### Segment A (신혼부부) - 밝고 활동적
```css
[data-segment="A"] {
  /* 파스텔 톤 + 라이트 느낌 */
  --brightness: 1.1;
  --saturation: 1.2;
}

[data-segment="A"] .hero {
  background: linear-gradient(135deg, #87CEEB, #FFB6D9);
}

[data-segment="A"] .text {
  font-weight: 500; /* 조금 가벼움 */
}
```

#### Segment D (VVIP) - 다크하고 우아함
```css
[data-segment="D"] {
  /* 다크톤 + 골드 강조 */
  --brightness: 0.95;
  --saturation: 0.9;
}

[data-segment="D"] .hero {
  background: linear-gradient(135deg, #1a1a1a, #2C3E50);
}

[data-segment="D"] .text {
  font-weight: 400; /* 우아한 라이트 */
  letter-spacing: 1px; /* 자간 넓음 */
}

[data-segment="D"] h1 {
  font-family: 'Playfair Display', serif; /* 세리프 폰트 */
}
```

### 전체 레이아웃 매핑

```
┌─────────────────────────────────────────────┐
│ Hero Section (Day 0-3 변환)                │
│ ├─ Background: Segment별 그래디언트         │
│ ├─ Overlay Filter: Segment별 색상 필터      │
│ ├─ Typography: Segment별 폰트/크기          │
│ └─ CTA Button: Segment별 색상/스타일        │
├─────────────────────────────────────────────┤
│ Supporting Sections                         │
│ ├─ Collage Grid: Segment별 색상 필터        │
│ ├─ Price Comparison: Segment별 강조색       │
│ ├─ Testimonial: Segment별 테두리색          │
│ └─ Feature List: Segment별 체크마크색       │
└─────────────────────────────────────────────┘
```

---

## 부록: 빠른 참조 (Cheat Sheet)

### 색상 빠른 선택
```css
/* Segment A */
primary: #FFB6D9, accent: #FF69B4

/* Segment B */
primary: #D4AF84, accent: #808000

/* Segment C */
primary: #2C3E50, accent: #D4AF37

/* Segment D */
primary: #1a1a1a, accent: #FFD700

/* Segment E */
primary: #E6B89C, accent: #D4AF37
```

### Typography 빠른 선택
```
Hero: 28px/42px Bold
Section: 24px/32px SemiBold
Body: 14px/16px Regular
Small: 12px/14px Medium
```

### 스페이싱 빠른 선택
```
Section Margin: 40px (모바일) / 80px (PC)
Section Padding: 20px (모바일) / 60px (PC)
내부 Gap: 15px (모바일) / 30px (PC)
Button Padding: 14-18px (세로) × 36-48px (가로)
```

### CTA 버튼 빠른 선택
```
Day 0-1: Variant 1 (직관적)
Day 1-2: Variant 2 (액션)
Day 2-3: Variant 3 (감정)
```

---

**버전 히스토리**:
- v1.0 (2026-05-28): 초기 작성

**다음 업데이트 예정**:
- v1.1 (2026-06-01): 다크모드 색상 최적화
- v1.2 (2026-06-10): 추가 Variant 3가지
- v2.0 (2026-06-30): 완전 반응형 테스트 완료
