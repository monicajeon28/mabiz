# P1-1 모바일 테스트 전체 구조도

## 🎯 테스트 계획 전체도

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          P1-1 모바일 테스트 계획                              │
│                        (4 Resolutions × 5 Validations)                       │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─── 320px (iPhone SE)
                              │    · TC-001: sign-in 텍스트
                              │    · TC-002: dashboard 레이아웃
        📱 테스트 해상도        │    · TC-003: audit-logs 테이블
        (4가지)               ├─── 375px (iPhone 12)
                              │    · TC-004: sign-in 최적화
                              │    · TC-005: campaigns 카드
                              ├─── 640px (iPad mini)
                              │    · TC-006: dashboard 2열
                              │    · TC-007: audit-logs 최적화
                              └─── 768px (iPad)
                                   · TC-008: dashboard 데스크톱
                                   · TC-009: campaigns 테이블

        ✓ 5가지 검증 항목
        ├─ 텍스트 가독성 (Typography)
        │  └─ font-size ≥ 14px / line-height ≥ 1.5 / WCAG AA 대비도
        │
        ├─ 그리드 레이아웃 (Responsive Grid)
        │  └─ 320-375px: 1열 / 640px: 2열 / 768px: 데스크톱
        │
        ├─ 이미지 비율 (Aspect Ratio)
        │  └─ 변형 없음 / lazy loading / srcset 확인
        │
        ├─ 터치 타겟 (Touch Target)
        │  └─ 최소 44×44px / 간격 ≥ 8px / 오터치 방지
        │
        └─ 성능 (Performance)
           └─ Lighthouse ≥ 80점 / CLS < 0.1 / LCP < 2.5s
```

---

## 📊 테스트 워크플로우

```
Step 1: 환경 구성 (5분)
├─ Chrome DevTools 열기 (F12)
├─ Device Toolbar 활성화 (⌘+Shift+M)
├─ 커스텀 해상도 4개 추가
│  ├─ 320×568 (iPhone SE, 2x DPR)
│  ├─ 375×812 (iPhone 12, 3x DPR)
│  ├─ 640×1024 (iPad mini, 2x DPR)
│  └─ 768×1024 (iPad, 2x DPR)
└─ ✅ 준비 완료

Step 2: 수동 테스트 (30분)
├─ Phase 1: 320px (3분)
│  └─ http://localhost:3000/auth/sign-in
│     └─ 텍스트 ✓ / 레이아웃 ✓ / 터치 타겟 ✓ / 성능 ✓
│
├─ Phase 2: 375px (2분)
│  └─ http://localhost:3000/dashboard/campaigns
│     └─ 텍스트 ✓ / 레이아웃 ✓ / 이미지 ✓ / 성능 ✓
│
├─ Phase 3: 640px (2분)
│  └─ http://localhost:3000/dashboard
│     └─ 레이아웃 2열 ✓ / 이미지 ✓ / 터치 ✓
│
└─ Phase 4: 768px (2분)
   └─ http://localhost:3000/dashboard
      └─ 데스크톱 레이아웃 ✓ / 텍스트 ✓ / 성능 ✓

Step 3: 스크린샷 캡처 (5분)
├─ 각 해상도별 스크린샷 저장
├─ DevTools: ⋮ → "Capture screenshot"
└─ test-artifacts/ 폴더에 저장

Step 4: 결과 검증 (10분)
├─ SCREENSHOT_VALIDATION_MATRIX.md 열기
├─ 각 TC별로 스크린샷 확인
├─ 검증 항목에 실제값 기입
└─ 통과/실패 표시

Step 5: 이슈 분류 (5분)
├─ P0 (긴급): 모바일 사용 불가능
├─ P1 (중요): UX 심각 저해
└─ P2 (개선): 미미한 저해

Step 6: 결과 보고
└─ P1_1_TESTING_SUMMARY.md 최종 업데이트
```

---

## 📋 검증 체크리스트 예시 (320px)

```
[TC-001] 320px - 로그인 페이지

┌─ 텍스트 가독성 ─────────────────────────────────────┐
│ ┌─ h1 (페이지 제목)                                  │
│ │ └─ font-size: 28px ✓ (기준 ≥ 24px)               │
│ │                                                   │
│ ├─ label (입력 라벨)                                │
│ │ ├─ font-size: 14px ✓ (기준 ≥ 14px)              │
│ │ └─ line-height: 1.6 ✓ (기준 ≥ 1.5)              │
│ │                                                   │
│ └─ button (로그인)                                  │
│   └─ font-size: 16px ✓ (기준 ≥ 16px)              │
│                                                     │
├─ 그리드 레이아웃 ──────────────────────────────────┤
│ ├─ 폼 너비: 288px ✓ (기준 ≤ 320 - 32px)           │
│ ├─ 좌측 마진: 16px ✓                              │
│ └─ 우측 마진: 16px ✓                              │
│                                                     │
├─ 터치 타겟 ──────────────────────────────────────┤
│ ├─ 입력 필드 높이: 44px ✓ (기준 ≥ 44px)          │
│ ├─ 버튼 높이: 48px ✓ (기준 ≥ 44px)               │
│ └─ 버튼 너비: 256px ✓ (100% - 32px margin)       │
│                                                     │
└─ 성능 ──────────────────────────────────────────┘
  ├─ Lighthouse Performance: 85점 ✓ (기준 ≥ 80점)
  ├─ Lighthouse Accessibility: 95점 ✓ (기준 ≥ 90점)
  └─ 페이지 로드: 1.2초 ✓ (기준 < 2초)

결과: ✅ PASS (5/5 항목 통과)
```

---

## 🔍 각 검증 항목별 상세 기준

### 1️⃣ 텍스트 가독성 (Typography)

```
┌─ 기본 텍스트 (body)
│  └─ 최소 font-size: 14px
│     line-height: 1.5 배 이상
│     대비도: WCAG AA 4.5:1 이상
│
├─ 제목 (h1, h2, h3)
│  ├─ h1: 24-32px (계층 상위)
│  ├─ h2: 18-24px (계층 중간)
│  └─ h3: 16-20px (계층 하위)
│
└─ 특수 텍스트
   ├─ 라벨: 14px 이상
   ├─ 헬퍼 텍스트: 12px 이상
   └─ 날짜/시간: 12px 이상

검증 도구: DevTools → Elements → Computed Styles
```

### 2️⃣ 그리드 레이아웃 (Responsive)

```
┌─ 320px (iPhone SE)
│  ├─ 카드: 1열 (100% - 32px margin)
│  ├─ 마진: 좌 16px / 우 16px
│  └─ gap: 16px (행 간)
│
├─ 375px (iPhone 12)
│  ├─ 카드: 1열 (100% - 24px margin)
│  ├─ 마진: 좌 12-16px / 우 12-16px
│  └─ gap: 16px
│
├─ 640px (iPad mini)
│  ├─ 카드: 2열 (각 ~300px)
│  ├─ gap: 16px (양쪽)
│  └─ 마진: 좌 16px / 우 16px
│
└─ 768px (iPad)
   ├─ 사이드바: 240-256px (고정)
   ├─ 콘텐츠: 2-3열
   └─ 마진: 24px 이상

검증 도구: DevTools → Elements → Layout (Grid 확인)
```

### 3️⃣ 이미지 비율 (Aspect Ratio)

```
┌─ 상품 썸네일
│  └─ aspect-ratio: 16:9 또는 4:3
│
├─ 프로필 사진
│  └─ aspect-ratio: 1:1
│
├─ 배너 이미지
│  └─ aspect-ratio: 21:9 또는 16:9
│
└─ 로드 최적화
   ├─ srcset 속성 확인 (1x, 2x)
   └─ loading="lazy" 속성 확인

검증 도구: DevTools → Network (이미지 크기 확인)
```

### 4️⃣ 터치 타겟 (Touch Target)

```
┌─ 기본 터치 타겟 크기
│  └─ 최소 44×44px (Apple HIG, Google Material)
│
├─ 버튼 (Button)
│  ├─ 최소 높이: 44px
│  └─ 최소 너비: 44px (정사각형 버튼)
│
├─ 입력 필드 (Input)
│  ├─ 최소 높이: 44px
│  ├─ padding: 12px (수직)
│  └─ padding: 16px (수평)
│
├─ 체크박스 / 라디오
│  ├─ 실제 크기: 20×20px
│  └─ 클릭 영역: 44×44px (padding으로 확장)
│
└─ 터치 간격
   └─ 인접 요소 간: 8px 이상 (오터치 방지)

검증 도구: DevTools → Elements → Computed Width/Height
```

### 5️⃣ 성능 (Performance)

```
┌─ Lighthouse 점수
│  ├─ 320-375px: ≥ 80점 (Good)
│  ├─ 640px: ≥ 75점 (Needs Work → Good)
│  └─ 768px: ≥ 85점 (Good)
│
├─ Core Web Vitals
│  ├─ LCP (Largest Contentful Paint): < 2.5s
│  ├─ CLS (Cumulative Layout Shift): < 0.1
│  ├─ FCP (First Contentful Paint): < 1.8s
│  └─ TTFB (Time To First Byte): < 600ms
│
├─ 프레임 레이트
│  └─ 스크롤 시: 60fps 유지 (프레임 드롭 없음)
│
└─ 이미지 로드
   └─ lazy loading으로 초기 로드 < 2초

검증 도구:
- F12 → Lighthouse → "Analyze page load"
- F12 → Performance → 녹화 버튼 → 스크롤/클릭
```

---

## 📁 문서 네비게이션

```
D:\mabiz-crm\
├─ MOBILE_TESTING_PLAN_P1_1.md ⭐⭐⭐
│  └─ 메인 테스트 계획 (읽기 먼저!)
│
├─ SCREENSHOT_VALIDATION_MATRIX.md ⭐⭐
│  └─ 상세 검증 매트릭스 (스크린샷 기록)
│
├─ MOBILE_TESTING_QUICK_START.md ⭐⭐
│  └─ 빠른 시작 가이드 (30분 안에 검증)
│
├─ tests/mobile-responsive.spec.ts ⭐
│  └─ Playwright 자동화 (선택)
│
├─ P1_1_TESTING_SUMMARY.md ⭐⭐⭐
│  └─ 최종 정리 및 다음 단계
│
└─ MOBILE_TESTING_OVERVIEW.md (이 파일)
   └─ 전체 구조도 및 시각화
```

---

## 🚀 추천 실행 순서

### 옵션 A: 빠른 실행 (권장)
```
1. MOBILE_TESTING_QUICK_START.md (5분 읽기)
2. 환경 구성 (5분)
3. Phase 1-4 순차 검증 (15-20분)
4. 이슈 기록 (5분)
총 30분 ✅
```

### 옵션 B: 철저한 검증
```
1. MOBILE_TESTING_PLAN_P1_1.md 전체 읽기 (15분)
2. 환경 구성 (5분)
3. 각 해상도별 TC 실행 (30분)
4. SCREENSHOT_VALIDATION_MATRIX.md 작성 (20분)
5. 이슈 분류 (10분)
총 80분 ✅
```

### 옵션 C: 자동화 + 수동 병렬
```
담당자 A: 수동 테스트 (320px, 375px) - 15분
담당자 B: Playwright 자동화 - 10분
결과 통합: 5분
총 20분 ⭐ 가장 효율적
```

---

## ✅ 최종 승인 체크리스트

```
모든 항목이 ✅ 체크되면 PASS

┌─ 텍스트 가독성
│  ├─ [ ] 320px 모든 텍스트 ≥ 14px
│  ├─ [ ] 375px 모든 텍스트 ≥ 14px
│  ├─ [ ] 640px 모든 텍스트 ≥ 14px
│  └─ [ ] 768px 모든 텍스트 ≥ 14px
│
├─ 그리드 레이아웃
│  ├─ [ ] 320-375px: 1열 배치
│  ├─ [ ] 640px: 2열 배치
│  └─ [ ] 768px: 데스크톱 레이아웃
│
├─ 이미지 비율
│  └─ [ ] 모든 해상도: aspect-ratio 유지
│
├─ 터치 타겟
│  └─ [ ] 모든 요소: 44×44px 이상 또는 패딩으로 확장
│
├─ 성능
│  ├─ [ ] 320-375px: Lighthouse ≥ 80점
│  ├─ [ ] 640px: Lighthouse ≥ 75점
│  └─ [ ] 768px: Lighthouse ≥ 85점
│
└─ 이슈
   ├─ [ ] P0 (긴급): 0개
   ├─ [ ] P1 (중요): ≤ 2개 (계획 수립)
   └─ [ ] P2 (개선): 제한 없음

최종 상태: 🟢 PASS / 🟡 CONDITIONAL / 🔴 FAIL
```

---

## 📞 연락처 및 지원

- **테스트 리더**: QA Lead
- **자동화 담당**: QA Engineer
- **개발 담당**: Engineering Lead

---

**생성일**: 2026-06-08  
**버전**: 1.0  
**상태**: 🟢 Ready for Testing
