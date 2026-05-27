# Loop 5-B: 구현 체크리스트

**목적**: 크루즈닷몰 디자인팀이 실행할 수 있는 단계별 체크리스트

**상태**: Ready ✅

---

## 🎯 Phase 1: 기초 설정 (Day 1-2)

### 1.1 Design System 적용
- [ ] Figma 프로젝트 생성
- [ ] 5개 Segment별 색상 라이브러리 추가
  - [ ] Segment A: Primary #FFB6D9, Secondary #87CEEB, Accent #FF69B4
  - [ ] Segment B: Primary #D4AF84, Secondary #F5DEB3, Accent #808000
  - [ ] Segment C: Primary #2C3E50, Secondary #F8F7F4, Accent #D4AF37
  - [ ] Segment D: Primary #1a1a1a, Secondary #F5F3F0, Accent #FFD700
  - [ ] Segment E: Primary #E6B89C, Secondary #FFFFF0, Accent #D4AF37
- [ ] Typography 스타일 등록
  - [ ] H1: Noto Sans KR Bold 28px/42px
  - [ ] H2: Noto Sans KR SemiBold 24px/32px
  - [ ] Body: Noto Sans KR Regular 14px/16px
- [ ] 컴포넌트 생성
  - [ ] CTA Button Variant 1
  - [ ] CTA Button Variant 2
  - [ ] CTA Button Variant 3
  - [ ] Collage Grid 4-cell
  - [ ] Price Comparison 2-col

### 1.2 CSS 변수 설정 (개발팀)
- [ ] CSS root variables 작성
  ```css
  :root[data-segment="A"] { --primary: ... }
  :root[data-segment="B"] { --primary: ... }
  ...
  ```
- [ ] 모든 컴포넌트에 변수 적용
- [ ] 색상 필터 라이브러리 추가
- [ ] 반응형 breakpoint 설정
  - [ ] 375px (모바일)
  - [ ] 768px (태블릿)
  - [ ] 1024px (데스크탑)

### 1.3 이미지 수집 (콘텐츠팀)
- [ ] Day 0 이미지 (2장)
  - [ ] 일상 (회색톤): Pexels 검색 "office worker tired"
  - [ ] 크루즈 (컬러): Pexels 검색 "cruise ship sunset"
- [ ] Day 1 이미지 (4장)
  - [ ] 선데크: Pexels 검색 "cruise deck sunset"
  - [ ] 다이닝: Pexels 검색 "fine dining elegant"
  - [ ] 액티비티: Pexels 검색 "snorkeling tropical"
  - [ ] 쇼: Pexels 검색 "theater lights entertainment"
- [ ] Day 2 이미지 (1장)
  - [ ] 객실: Pexels 검색 "luxury cruise stateroom"
- [ ] Day 3 이미지 (5장, Segment별)
  - [ ] A: "couple cruise sunset romantic"
  - [ ] B: "family vacation cruise happy"
  - [ ] C: "mature couple Egypt pyramids"
  - [ ] D: "luxury cruise penthouse suite"
  - [ ] E: "elderly couple beach travel"

---

## 🎨 Phase 2: Hero Section 설계 (Day 3-4)

### 2.1 Day 0 Hero
- [ ] 배경 이미지 분할 레이아웃 설계
  - [ ] 좌측: 일상 이미지 (grayscale 필터)
  - [ ] 우측: 크루즈 이미지 (saturate 필터)
- [ ] 메시지 텍스트 작성
  - [ ] Main: "지금 vs 30년 후 후회"
  - [ ] Sub: "지금 가면 건강하게, 못 가면 후회합니다"
- [ ] CTA 버튼 배치
  - [ ] Type: Variant 1 (직관적)
  - [ ] Text: "무료 상담 예약"
  - [ ] Color: Segment별 accent color
- [ ] 색상 오버레이 적용
  - [ ] Opacity: 15%
  - [ ] Color: Segment별 primary color
- [ ] 반응형 테스트
  - [ ] 모바일: Hero height 70vh
  - [ ] PC: Hero height 100vh

### 2.2 Day 1 Hero + Collage
- [ ] Hero 메시지 설정
  - [ ] Main: "이 경험을 빼앗길래요?"
  - [ ] Sub: "크루즈의 구체적 경험"
- [ ] CTA 버튼
  - [ ] Type: Variant 2 (액션 지향)
  - [ ] Text: "지금 신청 → "
  - [ ] 화살표 호버 애니메이션
- [ ] Collage Grid 구현
  - [ ] 2×2 그리드 (PC), 1×4 스택 (모바일)
  - [ ] 각 이미지 aspect-ratio: 1/1
  - [ ] 호버: scale(1.05) 애니메이션
  - [ ] 오버레이: 타이틀 + 그래디언트 배경
- [ ] Testimonial 추가 (3개)
  - [ ] 별점 5점 + 한줄평
  - [ ] 이름 + 세그먼트 표시

### 2.3 Day 2 Hero + Price Comparison
- [ ] Hero 메시지
  - [ ] Main: "당신을 위한 럭셀리"
  - [ ] Sub: "이제는 감당할 수 있어요"
- [ ] CTA 버튼
  - [ ] Type: Variant 1 (직관적)
  - [ ] Text: "이 가격에 예약하기"
- [ ] Price Comparison 박스
  - [ ] 2-column 레이아웃
  - [ ] Original: $8,999 (회색, 취소선)
  - [ ] Discount: $4,999 (초록, 크게, bold)
  - [ ] 타이머: "⏰ 48시간 남음"
- [ ] Feature List
  - [ ] 체크마크 아이콘 5개
  - [ ] 각 혜택 한 줄 설명

### 2.4 Day 3 Hero + Countdown
- [ ] Hero 메시지
  - [ ] Main: "결정은 지금. 추억은 평생"
  - [ ] Sub: "행복한 결정의 순간입니다"
- [ ] CTA 버튼
  - [ ] Type: Variant 3 (감정 호소)
  - [ ] Main text: "{{segment-specific}}"
  - [ ] Sub text: "무료 상담 포함"
  - [ ] 깜빡이는 펄싱 애니메이션
- [ ] Countdown Timer
  - [ ] 원형 프로그레스 바
  - [ ] "24시간 59분 47초"
  - [ ] 색상: Segment별 accent color
  - [ ] CSS animation: pulse 2s infinite
- [ ] Exclusivity Signal
  - [ ] "남은 좌석 2/3"
  - [ ] "Last seat" 깜빡임 (빨강)
- [ ] Additional Benefits 그리드
  - [ ] 3개 아이콘 + 텍스트
  - [ ] 예: 🎁 온보드 선물, 🏨 업그레이드 30%, 💳 무이자 할부

---

## 🖼️ Phase 3: Supporting Sections (Day 5-6)

### 3.1 Section Typography 통일
- [ ] 모든 Section h2 스타일 통일
  - [ ] 색상: var(--text)
  - [ ] Border-bottom: 2px solid var(--accent)
  - [ ] Padding-bottom: 15px
- [ ] 모든 섹션 마진/패딩
  - [ ] 모바일: margin 40px 0, padding 0 20px
  - [ ] PC: margin 80px 0, padding 0 60px

### 3.2 Supporting Images
- [ ] 각 섹션별 1-2개 이미지 배치
  - [ ] Border-radius: 12px
  - [ ] Box-shadow: 0 4px 12px var(--shadow)
  - [ ] Aspect-ratio: 16/9
- [ ] 이미지 호버 애니메이션
  - [ ] transform: scale(1.05)
  - [ ] transition: 0.3s ease
- [ ] 이미지 필터 적용
  - [ ] Segment A: hue-rotate(-10deg) saturate(1.2)
  - [ ] Segment B: hue-rotate(-20deg) saturate(1.1)
  - [ ] (나머지는 LOOP5_IMAGE_REFERENCES.md 참조)

### 3.3 Call-to-Action 배치
- [ ] Primary CTA (페이지당 2-3개)
  - [ ] Hero: 각 Variant별
  - [ ] 중간 섹션: Variant 2 (액션 유도)
  - [ ] 하단: Variant 3 (감정 호소)
- [ ] 모든 버튼 스타일 확인
  - [ ] 호버 상태 (각 변형별 다름)
  - [ ] 활성화 상태 (press 애니메이션)
  - [ ] 모바일 터치 대상: 최소 44×44px

---

## 📱 Phase 4: 반응형 최적화 (Day 7-8)

### 4.1 모바일 (375px)
- [ ] Hero height: 70vh → 400px
- [ ] Typography 크기
  - [ ] H1: 28px (42px에서 하향)
  - [ ] H2: 24px (32px에서 하향)
  - [ ] Body: 14px (16px에서 하향)
- [ ] 버튼 사이즈
  - [ ] Padding: 14px 36px (모바일용)
  - [ ] 최소 높이: 44px
- [ ] Collage Grid
  - [ ] 1열 스택 (2×2 → 1×4)
  - [ ] Gap: 15px (30px에서 하향)
- [ ] Price Comparison
  - [ ] 1열 스택 (좌우 → 상하)
  - [ ] Full width
- [ ] 섹션 패딩
  - [ ] padding: 0 20px (60px에서 하향)

### 4.2 태블릿 (768px-1023px)
- [ ] Hero height: 80vh → 500px
- [ ] Typography: 기본값 유지
- [ ] Collage Grid: 2열 유지
- [ ] Price Comparison: 2열 유지
- [ ] Gap: 20-30px (균형)

### 4.3 데스크탑 (1024px+)
- [ ] Hero height: 100vh → 600px
- [ ] Typography
  - [ ] H1: 42px
  - [ ] H2: 32px
  - [ ] Body: 16px
- [ ] Collage Grid: 2×2 유지, gap 30px
- [ ] 섹션 패딩: 0 60px

### 4.4 테스트 체크리스트
- [ ] iPhone 11 (375px)
  - [ ] 가로 스크롤 없음 ✓
  - [ ] 텍스트 가독성 ✓
  - [ ] 버튼 터치 가능 ✓
- [ ] iPad (768px)
  - [ ] 레이아웃 균형 ✓
  - [ ] 이미지 비율 ✓
- [ ] Desktop (1440px)
  - [ ] 전체 구성 보임 ✓
  - [ ] 여백 적절 ✓

---

## 🎬 Phase 5: 인터랙션 & 애니메이션 (Day 9-10)

### 5.1 Button Hover States
- [ ] Variant 1: 직관적
  - [ ] Background: brighten 또는 saturate
  - [ ] Transform: translateY(-2px)
  - [ ] Box-shadow: 강화
- [ ] Variant 2: 액션
  - [ ] Background: filled (호버 시)
  - [ ] Color: inverted (텍스트)
  - [ ] Arrow: 나타남 + 이동
- [ ] Variant 3: 감정
  - [ ] Transform: translateY(-3px)
  - [ ] Box-shadow: 강화
  - [ ] 펄싱 animation 유지

### 5.2 Countdown Timer Animation
- [ ] 펄싱 애니메이션
  ```css
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent); }
    50% { box-shadow: 0 0 0 10px transparent; }
  }
  ```
- [ ] 매 초 업데이트 (JavaScript)
  ```javascript
  setInterval(() => {
    // 카운트다운 로직
  }, 1000);
  ```

### 5.3 Image Hover Effects
- [ ] Scale: 1.05배
- [ ] Transition: 0.3s cubic-bezier
- [ ] 모바일 터치: :active state 추가

### 5.4 Segment 전환 애니메이션 (선택)
- [ ] 색상 변경: fade-in (0.3s)
- [ ] 배경: smooth transition

---

## 🖼️ Phase 6: 이미지 최적화 (Day 11-12)

### 6.1 파일 크기 확인
- [ ] Hero 이미지
  - [ ] PC (1440px): 150KB 이하
  - [ ] 모바일 (750px): 80KB 이하
- [ ] Supporting (1200px): 120KB 이하
- [ ] Collage 아이템 (800px): 60KB 이하
- [ ] Thumbnail (400px): 30KB 이하

### 6.2 포맷 최적화
- [ ] WebP 변환 (TinyPNG 또는 FFmpeg)
  ```bash
  ffmpeg -i input.jpg -c:v libwebp -quality 80 output.webp
  ```
- [ ] JPG 폴백 유지
- [ ] Picture 태그로 구현
  ```html
  <picture>
    <source srcset="...webp" type="image/webp" />
    <img src="...jpg" alt="..." />
  </picture>
  ```

### 6.3 색상 필터 최종 확인
- [ ] Segment A: hue-rotate(-10deg) saturate(1.2) brightness(1.05)
- [ ] Segment B: hue-rotate(-20deg) saturate(1.1) brightness(1.0)
- [ ] Segment C: hue-rotate(-30deg) saturate(0.9) brightness(1.1)
- [ ] Segment D: brightness(0.9) contrast(1.2) saturate(1.1)
- [ ] Segment E: sepia(0.2) saturate(0.9) brightness(1.05)

### 6.4 성능 테스트
- [ ] Google PageSpeed Insights
  - [ ] LCP (Largest Contentful Paint): <2.5s
  - [ ] CLS (Cumulative Layout Shift): <0.1
- [ ] WebPageTest
  - [ ] 로드 시간: <3초 (모바일)

---

## 📊 Phase 7: 분석 설정 (Day 13-14)

### 7.1 Google Analytics 4 Events
- [ ] 이벤트 추적
  - [ ] `cta_click_variant_1`
  - [ ] `cta_click_variant_2`
  - [ ] `cta_click_variant_3`
  - [ ] 각 이벤트: segment 파라미터 포함
- [ ] 페이지 뷰 추적
  - [ ] `page_day_0`, `page_day_1`, `page_day_2`, `page_day_3`
  - [ ] 시간 기준

### 7.2 Conversion Tracking
- [ ] GA4 전환 설정
  - [ ] CTA 클릭 = 1차 전환 (형식: GA 이벤트)
  - [ ] 문의 제출 = 2차 전환
  - [ ] 예약 완료 = 3차 전환
- [ ] UTM 파라미터
  - [ ] `utm_source=cruisedot_web`
  - [ ] `utm_medium=landing_page`
  - [ ] `utm_campaign=loop5_{{segment}}`
  - [ ] `utm_content=day_{{0-3}}`

### 7.3 Dashboard 구성
- [ ] Hero KPI 카드
  - [ ] CTR (클릭 수 / 방문자)
  - [ ] 전환율 (전환 / 클릭)
  - [ ] CPA (비용 / 전환)
- [ ] Segment 분해
  - [ ] 각 Segment별 CTR 비교
  - [ ] 각 Segment별 전환율
  - [ ] Segment 간 성과 차이
- [ ] Day별 분석
  - [ ] Day 0-3 CTR 진행률
  - [ ] 단계별 이탈율

---

## ✅ Phase 8: 최종 검수 (Day 15)

### 8.1 QA Checklist
- [ ] **디자인 일관성**
  - [ ] 모든 페이지 색상 통일 (Segment별)
  - [ ] 폰트 크기/굵기 일관성
  - [ ] 버튼 스타일 3가지 명확 구분
  - [ ] 이미지 필터 Segment별 적용

- [ ] **기능성**
  - [ ] Segment 선택 시 전체 색상 변경
  - [ ] 모든 버튼 클릭 가능
  - [ ] 타이머 실시간 업데이트 (Day 3)
  - [ ] 링크 모두 정상 작동

- [ ] **반응형**
  - [ ] 375px (모바일): 가로 스크롤 X, 레이아웃 정상
  - [ ] 768px (태블릿): Collage 2열 유지
  - [ ] 1024px (PC): 전체 보임

- [ ] **성능**
  - [ ] 로드 시간 <3초
  - [ ] LCP <2.5s
  - [ ] 이미지 최적화 완료
  - [ ] CSS 파일 크기 <100KB

- [ ] **접근성**
  - [ ] 버튼 최소 44×44px
  - [ ] 색상 대비 WCAG AA
  - [ ] 모든 이미지 alt text
  - [ ] 텍스트 가독성 확인

### 8.2 콘텐츠 검수
- [ ] **메시지**
  - [ ] Day 0: "지금 vs 후회" 메시지 명확
  - [ ] Day 1: 4가지 경험 구체적
  - [ ] Day 2: 가격 비교 긴박감
  - [ ] Day 3: 배타성 + 감동
  
- [ ] **이미지**
  - [ ] 모든 이미지 주제 명확 (일상, 크루즈 등)
  - [ ] 필터 적용 Segment별 다름
  - [ ] 해상도 충분함
  
- [ ] **CTA**
  - [ ] 각 Day별 텍스트 다름
  - [ ] 색상 Segment별 다름
  - [ ] 호버 상태 명확

### 8.3 심리학 검증
- [ ] Loss Aversion (L6): Day 0-3에서 시간 압박 명확
- [ ] Urgency (L10): 카운트다운, "Last seat" 배타성
- [ ] Social Proof (사례): Day 1 testimonial 3개 이상
- [ ] Differentiation (L3): Segment C의 "문화 경험" 강조

---

## 🚀 Phase 9: 배포 (Day 16-18)

### 9.1 배포 전 최종 확인
- [ ] 모든 코드 병합 (main branch)
- [ ] 모든 버그 수정
- [ ] 성능 테스트 통과
- [ ] QA 체크리스트 100% 완료

### 9.2 배포 일정
- [ ] **Day 16 (화)**: Staging 배포
  - [ ] 최종 검수 (24시간)
  - [ ] 마케팅팀 확인
  
- [ ] **Day 17 (수)**: Production 배포 20:00 KST
  - [ ] 구글 인덱싱 요청
  - [ ] 캐시 제거
  
- [ ] **Day 18 (목)**: 라이브 모니터링
  - [ ] CTR 실시간 확인
  - [ ] 에러 로그 모니터링
  - [ ] 사용자 피드백 수집

### 9.3 배포 후 모니터링
- [ ] **Day 1-3**: 실시간 CTR 추적
  - [ ] 목표: Day 0 2.3% → 3.1%
  - [ ] 목표: Day 1 1.9% → 2.6%
  - [ ] 목표: Day 2 2.1% → 2.8%
  - [ ] 목표: Day 3 1.8% → 2.4%

- [ ] **Day 7**: 주간 리포팅
  - [ ] Segment별 성과 비교
  - [ ] 예상 vs 실제 분석
  - [ ] 원인 분석 + 개선안

- [ ] **Day 30**: 월간 리포팅
  - [ ] 전환율 측정
  - [ ] CPA 계산
  - [ ] ROI 평가

---

## 📋 점검 항목 요약

```
총 점검 항목: 87개
✅ Phase 1 (기초): 20개
✅ Phase 2 (Hero): 25개
✅ Phase 3 (Supporting): 12개
✅ Phase 4 (반응형): 18개
✅ Phase 5 (인터랙션): 8개
✅ Phase 6 (최적화): 12개
✅ Phase 7 (분석): 10개
✅ Phase 8 (검수): 22개
✅ Phase 9 (배포): 10개
```

---

## 🎯 성공 기준

| 지표 | 기존 | 목표 | 달성율 |
|------|------|------|--------|
| CTR | 2.0% | 2.7% | +35% |
| 전환율 (평균) | 1.66% | 3.08% | +85% |
| 전환율 (A) | 1.8% | 3.2% | +78% |
| 전환율 (B) | 1.5% | 2.6% | +73% |
| 전환율 (C) | 1.6% | 2.9% | +81% |
| 전환율 (D) | 2.2% | 4.5% | +105% |
| 전환율 (E) | 1.2% | 2.2% | +83% |

---

**준비 상태**: ✅ Ready for Implementation  
**추정 기간**: 18 days  
**담당자**: Design Team (Designer 1, Developer 1, QA 1)  
**시작일**: 2026-06-01 (권장)

