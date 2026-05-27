# Loop 5-B: cruisedot 이미지 참고 가이드

**작성일**: 2026-05-28  
**버전**: 1.0  
**담당**: AI Agent (비주얼 디자인)

---

## 📋 목차
1. Day 0-3별 이미지 키워드
2. Segment별 Day 3 이미지
3. 이미지 소스 플랫폼
4. 색상 필터 CSS 코드
5. 이미지 최적화 가이드

---

## 1️⃣ Day 0-3별 이미지 키워드

### Day 0: 인식 단계 (Problem & Agitation)

**목적**: 현재 상황(회색톤) vs 크루즈(컬러풀) 대비

#### 일상 이미지 (회색톤 처리)
```
Search Keywords (Pexels/Unsplash):
- "office worker tired stressed"
- "businessman tired desk"
- "city commute crowded"
- "working late night tired"
- "exhausted person office"
- "sedentary lifestyle"

Specifications:
- 비율: 16:9 또는 4:3
- 톤: 중립적, 우울함
- 조명: 형광등 또는 어두운 실내
- 표정: 피곤함, 스트레스
```

#### 크루즈 이미지 (컬러풀 강조)
```
Search Keywords:
- "cruise ship sunset tropical"
- "ocean blue beautiful water"
- "cruise ship pool deck"
- "tropical beach paradise"
- "sailing ocean blue sky"
- "vacation happy beach"

Specifications:
- 비율: 16:9 (와이드)
- 톤: 밝고 컬러풀
- 조명: 자연광, 따뜻함
- 요소: 바다, 하늘, 태양
```

#### 처리 방법
```css
/* 일상 이미지: 회색톤으로 변환 */
.day0-life-image {
  filter: grayscale(100%) brightness(0.85) contrast(1.2);
}

/* 크루즈 이미지: 컬러 강화 */
.day0-cruise-image {
  filter: saturate(1.3) brightness(1.1) contrast(1.15);
}

/* 컨테이너: 좌우 분할 */
.day0-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0; /* 분할선 없음 */
  height: 400px;
}
```

---

### Day 1: 관심 단계 (Solution)

**목적**: 크루즈의 4가지 경험을 콜라주로 제시

#### 이미지 1: 선데크 일몰
```
Search Keywords:
- "cruise ship sunset deck"
- "cruise ship balcony ocean view"
- "cruise deck sunset tropical"
- "ship railings ocean golden hour"
- "deck view ocean sunset"

Specifications:
- 비율: 1:1 (Collage용)
- 감정: 로맨틱, 경외감
- 요소: 선데크, 바다 지평선, 따뜻한 조명
- 시간대: Golden Hour (일몰)
```

#### 이미지 2: 미쉐린급 다이닝
```
Search Keywords:
- "fine dining elegant restaurant"
- "luxury dinner table"
- "gourmet food presentation"
- "fine dining interior design"
- "elegant table setting candlelight"
- "cruise ship dining room"

Specifications:
- 비율: 1:1
- 감정: 고급스러움, 우아함
- 요소: 테이블, 음식, 촛불 또는 조명
- 컬러톤: 따뜻한 조명, 흰색 테이블보
```

#### 이미지 3: 액티비티
```
Search Keywords:
- "snorkeling tropical fish"
- "scuba diving coral reef"
- "kayaking ocean blue"
- "swimming pool resort"
- "water sports fun"
- "beach activities adventure"

Specifications:
- 비율: 1:1
- 감정: 액션, 즐거움, 신나함
- 요소: 물, 활동, 사람들, 미소
- 컬러톤: 밝은 파란색, 맑은 물
```

#### 이미지 4: 저녁 쇼/나이트라이프
```
Search Keywords:
- "night entertainment stage lights"
- "theater performance lights"
- "concert stage colorful lights"
- "nightlife entertainment club"
- "performance stage"
- "broadway show lights"

Specifications:
- 비율: 1:1
- 감정: 흥분, 매력, 화려함
- 요소: 무대, 조명, 군중, 에너지
- 컬러톤: 다채로운 조명 (핑크, 블루, 퍼플)
```

#### Collage Grid CSS
```css
.collage-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px; /* 모바일 */
  margin: 40px 0;
}

.grid-item {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(54, 77, 142, 0.15);
  position: relative;
}

.grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.grid-item:hover img {
  transform: scale(1.05);
}

.grid-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  color: white;
  padding: 20px 15px 15px;
  font-size: 14px;
  font-weight: 600;
}

@media (min-width: 1024px) {
  .collage-grid {
    gap: 30px;
  }
}
```

---

### Day 2: 고려 단계 (Offer Narrowing)

**목적**: 객실의 럭셀리함을 강조, 가격 비교

#### 메인 이미지: 객실 내부
```
Search Keywords:
- "luxury cruise ship stateroom"
- "cruise ship balcony room interior"
- "luxury hotel bedroom ocean view"
- "suite interior modern"
- "bedroom with ocean view"
- "luxury bedroom contemporary"

Specifications:
- 비율: 16:9 (와이드)
- 감정: 럭셀리, 편안함, 안정감
- 요소: 침대, 창문, 바다 뷰, 현대적 가구
- 조명: 따뜻한 조명, 자연광
- 포함: 발코니 또는 대형 창문
```

#### 세부 이미지: 욕실 (선택사항)
```
Search Keywords:
- "luxury bathroom spa"
- "marble bathroom modern"
- "bathroom with ocean view"
- "luxury hotel bathroom amenities"

Specifications:
- 비율: 4:3
- 감정: 프리미엄, 고급스러움
- 요소: 욕조, 타일, 조명, 수건
```

#### 레이아웃
```html
<section class="price-day2">
  <div class="room-showcase">
    <div class="room-image">
      <img src="stateroom.jpg" alt="럭셀리 객실 내부" />
    </div>
    <div class="price-comparison">
      <div class="price-original">
        <div class="price-label">원래 가격</div>
        <div class="price-value">$8,999</div>
      </div>
      <div class="price-discount">
        <div class="price-label">지금 가격</div>
        <div class="price-value">$4,999</div>
        <div class="timer">⏰ 48시간</div>
      </div>
    </div>
  </div>
</section>
```

---

### Day 3: 결정 단계 (Action Urging)

**목적**: 행복한 결정의 순간, 감정적 연결 극대화

---

## 2️⃣ Segment별 Day 3 이미지

### Segment A: 30대 신혼부부

**이미지 주제**: "신혼부부의 로맨틱한 크루즈"

```
Search Keywords (우선순위 순):
1. "young couple cruise ship sunset romantic" ⭐⭐⭐
2. "newlyweds holding hands ocean view" ⭐⭐⭐
3. "couple wine toast sunset romantic" ⭐⭐⭐
4. "newly married couple beautiful vacation" ⭐⭐
5. "young lovers ship deck together" ⭐⭐
6. "couple laughing adventure travel" ⭐
7. "honeymoon couple beach tropical" ⭐

Specifications:
- 비율: 16:9 (메인) 또는 4:3 (보조)
- 조성: 2명 (부부), 함께 있는 모습
- 표정: 미소, 행복, 설렘
- 배경: 바다, 선데크, 일몰
- 컬러: 따뜻한 톤, 핑크/오렌지 석양
- 포즈: 손잡기, 포옹, 함께 바라보기
- 의상: 우아하고 캐주얼한 복장
```

**이미지 처리**:
```css
/* Segment A 이미지 필터 */
img[data-segment="A"][data-day="3"] {
  filter: 
    hue-rotate(-10deg)     /* 핑크톤 강조 */
    saturate(1.2)          /* 색상 강화 */
    brightness(1.05)       /* 밝게 */
    contrast(1.1);         /* 대비 강조 */
}
```

---

### Segment B: 40대 가족

**이미지 주제**: "가족과 함께하는 행복한 크루즈"

```
Search Keywords (우선순위 순):
1. "family cruise ship happy vacation" ⭐⭐⭐
2. "multigenerational family beach smiling" ⭐⭐⭐
3. "parents children laughing deck together" ⭐⭐⭐
4. "family group photo ocean tropical" ⭐⭐⭐
5. "family dining cruise ship happy" ⭐⭐
6. "kids parents adventure travel smiling" ⭐⭐
7. "family bonding pool resort" ⭐
8. "grandmother grandfather grandchildren travel" ⭐

Specifications:
- 비율: 16:9 (메인)
- 조성: 4-5명 (부모 + 자녀 2명)
- 표정: 밝은 미소, 함께함의 즐거움
- 배경: 배 갑판, 수영장, 해변
- 컬러: 따뜨한 자연색, 밝은 파란색
- 포즈: 함께 웃기, 손잡기, 포옹
- 의상: 캐주얼하고 편한 여행복장
- 나이대: 부모 40대, 자녀 10-20대
```

**이미지 처리**:
```css
img[data-segment="B"][data-day="3"] {
  filter: 
    hue-rotate(-20deg)     /* 따뜨한 갈색톤 */
    saturate(1.1)
    brightness(1.0)
    contrast(1.1);
}
```

---

### Segment C: 50대 중년

**이미지 주제**: "문화 유산 여행을 즐기는 세련된 부부"

```
Search Keywords (우선순위 순):
1. "mature couple Egypt pyramids smile" ⭐⭐⭐
2. "middle aged couple Greece ancient ruins" ⭐⭐⭐
3. "couple cultural tourism Rome" ⭐⭐⭐
4. "50s business couple luxury cruise" ⭐⭐⭐
5. "mature travelers cultural experience happy" ⭐⭐
6. "elegant couple museum travel" ⭐⭐
7. "sophisticated couple wine tasting" ⭐
8. "cultural heritage travel couple" ⭐

Specifications:
- 비율: 16:9 (메인)
- 조성: 2명 (부부, 50대)
- 표정: 세련된 미소, 만족감
- 배경: 이집트 피라미드, 그리스 유산지, 로마 건축물
- 컬러: 따뜨고 우아한 톤, 금색 강조
- 포즈: 함께 서 있기, 문화유산 감상
- 의상: 우아한 캐주얼, 선글라스, 모자
- 포함: 문화적/역사적 요소 명확
```

**이미지 처리**:
```css
img[data-segment="C"][data-day="3"] {
  filter: 
    hue-rotate(-30deg)     /* 골드톤 강조 */
    saturate(0.9)
    brightness(1.1)        /* 밝게 */
    contrast(1.15);
}
```

---

### Segment D: 60대 VVIP

**이미지 주제**: "럭셀리 크루즈의 프리미엄 경험"

```
Search Keywords (우선순위 순):
1. "luxury cruise penthouse suite interior" ⭐⭐⭐
2. "VIP luxury ship private balcony" ⭐⭐⭐
3. "champagne fine dining luxury cruise" ⭐⭐⭐
4. "premium suite ocean view stars" ⭐⭐⭐
5. "executive lounge luxury ship" ⭐⭐
6. "caviar champagne luxury dinner" ⭐⭐
7. "luxury yacht interior design" ⭐
8. "gold leaf luxury interior design" ⭐

Specifications:
- 비율: 16:9 (극와이드)
- 조성: 럭셀리 객실/라운지 (사람은 미니멀)
- 표정: N/A (공간 우선)
- 배경: 럭셀리 선실, 발코니, 별밤
- 컬러: 다크톤 + 금색, 프리미엄 느낌
- 요소: 샴페인, 꽃, 원목, 대리석, 금색 악센트
- 조명: 따뜨고 우아한 실내 조명
- 포함: 부의 상징, 배타성
```

**이미지 처리**:
```css
img[data-segment="D"][data-day="3"] {
  filter: 
    brightness(0.9)        /* 다크톤 */
    contrast(1.2)          /* 명암 강조 */
    saturate(1.1);
}

/* 추가: 금색 오버레이 선택사항 */
img[data-segment="D"][data-day="3"]::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, transparent, rgba(212, 175, 55, 0.05));
  pointer-events: none;
}
```

---

### Segment E: 70대+ 꿈

**이미지 주제**: "가족과 함께 만드는 회상적 추억"

```
Search Keywords (우선순위 순):
1. "elderly couple grandchildren travel happy" ⭐⭐⭐
2. "grandparents grandchild beach memory" ⭐⭐⭐
3. "senior couple holding hands sunset" ⭐⭐⭐
4. "multigenerational family travel smile" ⭐⭐⭐
5. "older couple romantic sunset travel" ⭐⭐
6. "grandma grandpa vacation together" ⭐⭐
7. "elderly travel adventure happy" ⭐
8. "family reunion vintage photo style" ⭐

Specifications:
- 비율: 4:3 (더 가깝고 친근함)
- 조성: 2-3명 (할아버지/할머니 + 손자/손녀)
- 표정: 부드러운 미소, 따뜻함, 감동
- 배경: 바다, 선데크, 일몰
- 컬러: 따뜨고 회상적인 톤, 세피아
- 포즈: 손잡기, 포옹, 함께 바라보기
- 의상: 편안한 복장, 캐주얼
- 느낌: 회상적, 감정적, 연결감
- 포함: 세대 간 사랑, 유산
```

**이미지 처리**:
```css
img[data-segment="E"][data-day="3"] {
  filter: 
    sepia(0.2)             /* 회상적 톤 */
    saturate(0.9)
    brightness(1.05)
    contrast(1.1);
}
```

---

## 3️⃣ 이미지 소스 플랫폼

### 최우선 플랫폼 (무료, 상업용 가능)

#### 1. Pexels (https://www.pexels.com)
- 검색어: 한글 또는 영문
- 필터: License (모두 무료)
- 장점: 고품질, 빠른 검색, 광고 없음
- 다운로드: 무제한, 전체 해상도

**추천 검색어**:
```
cruise ship sunset
family vacation happy
couple romantic travel
ocean beautiful blue
fine dining elegant
```

#### 2. Unsplash (https://unsplash.com)
- 검색어: 영문 필수
- 필터: Type → License (모두 무료)
- 장점: 매우 고품질, 매주 신규 추가
- 다운로드: 무제한

**추천 검색어**:
```
cruise ship
luxury interior
family travel
couple romantic
ocean sunset
```

#### 3. Pixabay (https://pixabay.com)
- 검색어: 한글/영문
- 필터: Image, Free → All
- 장점: 한글 검색 가능, 많은 선택지
- 다운로드: 무제한

**한글 검색어**:
```
크루즈
여행
가족
바다
럭셀리
```

### 보조 플랫폼 (프리미엄 옵션)

#### 4. Shutterstock (유료)
- 가격: $49/월 (10개), $199/월 (250개)
- 장점: 매우 고품질, 광범위한 선택지
- 추천: 전문적인 이미지 필요 시

#### 5. Getty Images (유료)
- 가격: 이미지당 다양함
- 장점: 최고 품질, 유명 브랜드 선택
- 추천: 전국 광고 캠페인 시

---

## 4️⃣ 색상 필터 CSS 코드

### 전체 필터 라이브러리

#### Day 0 대비 효과
```css
/* 일상 이미지 (좌측) */
.day0-life {
  filter: grayscale(100%) brightness(0.85) contrast(1.2) saturate(0);
}

/* 크루즈 이미지 (우측) */
.day0-cruise {
  filter: saturate(1.3) brightness(1.1) contrast(1.15);
}

/* 분할 레이아웃 */
.day0-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}
```

#### Segment A - 신혼부부 필터
```css
img[data-segment="A"] {
  filter: 
    hue-rotate(-10deg)     /* 핑크톤 강조 */
    saturate(1.2)          /* 생생함 */
    brightness(1.05)       /* 밝음 */
    contrast(1.1)          /* 명암 */
    drop-shadow(0 4px 8px rgba(255, 182, 217, 0.15));
}

/* 호버 애니메이션 */
img[data-segment="A"]:hover {
  filter: 
    hue-rotate(-10deg)
    saturate(1.35)
    brightness(1.15)
    contrast(1.2);
}
```

#### Segment B - 가족 필터
```css
img[data-segment="B"] {
  filter: 
    hue-rotate(-20deg)     /* 따뜨한 갈색 */
    saturate(1.1)
    brightness(1.0)
    contrast(1.1)
    drop-shadow(0 4px 8px rgba(212, 175, 132, 0.15));
}
```

#### Segment C - 중년 필터
```css
img[data-segment="C"] {
  filter: 
    hue-rotate(-30deg)     /* 세련된 골드톤 */
    saturate(0.9)
    brightness(1.1)
    contrast(1.15)
    drop-shadow(0 4px 8px rgba(44, 62, 80, 0.2));
}
```

#### Segment D - VVIP 필터
```css
img[data-segment="D"] {
  filter: 
    brightness(0.9)        /* 다크톤 */
    contrast(1.2)
    saturate(1.1)
    drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));
}

/* 프리미엄 느낌 오버레이 */
img[data-segment="D"]::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, transparent, rgba(212, 175, 55, 0.1));
  pointer-events: none;
}
```

#### Segment E - 70대+ 필터
```css
img[data-segment="E"] {
  filter: 
    sepia(0.2)             /* 회상적 톤 */
    saturate(0.9)
    brightness(1.05)
    contrast(1.1)
    drop-shadow(0 4px 8px rgba(230, 184, 156, 0.2));
}

/* 따뜨한 회상 느낌 */
img[data-segment="E"]::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, transparent 0%, rgba(230, 184, 156, 0.05) 100%);
  pointer-events: none;
}
```

### 동적 필터 적용 (JavaScript)

```javascript
// HTML attribute에서 필터 자동 적용
document.querySelectorAll('img[data-segment]').forEach(img => {
  const segment = img.getAttribute('data-segment');
  const day = img.getAttribute('data-day');
  
  // CSS 클래스 자동 추가
  img.classList.add(`segment-${segment}`, `day-${day}`);
});

// 또는 직접 스타일 적용
function applyFilter(element, segment) {
  const filters = {
    A: 'hue-rotate(-10deg) saturate(1.2) brightness(1.05) contrast(1.1)',
    B: 'hue-rotate(-20deg) saturate(1.1) brightness(1.0) contrast(1.1)',
    C: 'hue-rotate(-30deg) saturate(0.9) brightness(1.1) contrast(1.15)',
    D: 'brightness(0.9) contrast(1.2) saturate(1.1)',
    E: 'sepia(0.2) saturate(0.9) brightness(1.05) contrast(1.1)'
  };
  
  element.style.filter = filters[segment];
}
```

---

## 5️⃣ 이미지 최적화 가이드

### 파일 크기 기준

| 용도 | 권장 크기 | 최대 크기 | 포맷 |
|------|----------|---------|------|
| Hero (PC) | 150KB | 200KB | WebP/JPG |
| Hero (모바일) | 80KB | 120KB | WebP |
| Supporting | 120KB | 150KB | WebP/JPG |
| Collage 아이템 | 60KB | 100KB | WebP |
| Thumbnail | 30KB | 50KB | WebP |

### 해상도 기준

| 용도 | PC 가로 | 모바일 가로 | 높이 |
|------|--------|-----------|------|
| Hero | 1440px | 750px | 9/16 비율 |
| Supporting | 1200px | 400px | 16:9 비율 |
| Collage | 800px | 375px | 1:1 |

### 최적화 도구

#### 1. TinyPNG (https://tinypng.com)
- JPG/PNG 압축
- 품질 유지하며 50-80% 크기 감소
- 드래그 앤 드롭 간편

#### 2. ImageOptim (Mac)
- 무료, 배치 처리
- 최대 70% 압축

#### 3. FFmpeg (명령줄)
```bash
# WebP로 변환
ffmpeg -i input.jpg -c:v libwebp -quality 80 output.webp

# 크기 조정 + 압축
ffmpeg -i input.jpg -vf scale=1440:-1 -c:v libwebp -quality 75 hero-1440.webp
```

### Responsive Image 마크업

```html
<picture>
  <!-- PC WebP -->
  <source 
    srcset="hero-1440.webp" 
    type="image/webp" 
    media="(min-width: 1024px)"
  />
  
  <!-- PC JPG 폴백 -->
  <source 
    srcset="hero-1440.jpg" 
    type="image/jpeg" 
    media="(min-width: 1024px)"
  />
  
  <!-- 모바일 WebP -->
  <source 
    srcset="hero-750.webp" 
    type="image/webp"
  />
  
  <!-- 모바일 JPG 폴백 -->
  <img 
    src="hero-750.jpg" 
    alt="크루즈 여행: 현재와 꿈 비교"
    loading="lazy"
    width="750"
    height="420"
  />
</picture>
```

### Performance Tips

1. **LazyLoad 활성화**
```html
<img src="..." alt="..." loading="lazy" />
```

2. **Srcset 다중 해상도**
```html
<img 
  src="hero-1200.jpg" 
  srcset="
    hero-800.jpg 800w,
    hero-1200.jpg 1200w,
    hero-1600.jpg 1600w
  "
  sizes="(max-width: 768px) 100vw, 90vw"
  alt="..."
/>
```

3. **CDN 활용**
- Cloudinary, imgix, Fastly 등
- 자동 포맷 최적화
- 글로벌 배포로 속도 개선

---

## 부록: 검색 템플릿

### Pexels 빠른 검색 링크

```
Segment A 신혼부부:
https://www.pexels.com/search/couple%20cruise%20sunset/

Segment B 가족:
https://www.pexels.com/search/family%20vacation%20happy/

Segment C 중년:
https://www.pexels.com/search/mature%20couple%20travel/

Segment D VVIP:
https://www.pexels.com/search/luxury%20cruise%20ship/

Segment E 70대+:
https://www.pexels.com/search/elderly%20couple%20travel/
```

---

**버전 히스토리**:
- v1.0 (2026-05-28): 초기 작성

**다음 업데이트**:
- v1.1 (2026-06-01): 직촬 이미지 추가 (선택사항)
- v1.2 (2026-06-10): AI 생성 이미지 옵션 추가
