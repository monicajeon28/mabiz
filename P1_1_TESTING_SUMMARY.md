# P1-1 모바일 테스트 계획 최종 정리 (2026-06-08)

---

## 📌 핵심 정보

**목표**: 마비즈 CRM의 4개 해상도(320px, 375px, 640px, 768px)에서 **5가지 검증 항목**을 체계적으로 검증

**예상 소요 시간**:
- 환경 구성: 5분
- 수동 테스트: 30분 (빠른 시작)
- 자동화 테스트: 10분 (Playwright)
- 이슈 수정: 2-3일

---

## 📁 생성된 문서

### 1. MOBILE_TESTING_PLAN_P1_1.md (메인 테스트 계획)
**경로**: `D:\mabiz-crm\MOBILE_TESTING_PLAN_P1_1.md`

**포함 내용**:
- 4개 해상도 정의 및 우선순위
- 5가지 검증 항목별 상세 체크리스트
  1. 텍스트 가독성 (TC-001~004)
  2. 그리드 레이아웃 (TC-005~008)
  3. 이미지 비율 (TC-009~012)
  4. 터치 타겟 (TC-013~016)
  5. 스크롤 성능 (TC-017~020)
- 필수 도구 (Chrome DevTools, Lighthouse, Performance)
- 단계별 테스트 시작 가이드
- 각 해상도별 스크린샷 체크리스트
- 이슈 보고 템플릿

**사용법**:
```
1. MOBILE_TESTING_PLAN_P1_1.md 열기
2. 각 TC 번호별로 스크린샷 캡처
3. 검증 기준과 비교
4. 발견 사항 기록
```

---

### 2. SCREENSHOT_VALIDATION_MATRIX.md (상세 검증 매트릭스)
**경로**: `D:\mabiz-crm\SCREENSHOT_VALIDATION_MATRIX.md`

**포함 내용**:
- 각 해상도별 TC별 상세 검증 항목 (20개 TC)
- 텍스트 가독성, 그리드, 이미지, 터치, 성능에 대한 세부 검증
- 320px (iPhone SE) - 4개 TC
- 375px (iPhone 12) - 2개 TC
- 640px (iPad mini) - 2개 TC
- 768px (iPad) - 2개 TC
- 최종 종합 체크리스트 및 승인 기준

**사용법**:
```
1. 스크린샷 캡처 후
2. SCREENSHOT_VALIDATION_MATRIX.md의 해당 TC 찾기
3. 각 검증 항목에 실제값 기입
4. 통과/실패 표시
5. 발견된 이슈 작성
```

---

### 3. tests/mobile-responsive.spec.ts (Playwright 자동화 테스트)
**경로**: `D:\mabiz-crm\tests\mobile-responsive.spec.ts`

**포함 내용**:
- 4개 해상도에서 5가지 검증 항목을 **자동 실행**하는 Playwright 스크립트
- TC-001: 텍스트 가독성 (font-size, line-height, 대비도)
- TC-002: 그리드 레이아웃 (컬럼, 마진, gap)
- TC-003: 이미지 비율 (aspect-ratio, lazy loading)
- TC-004: 터치 타겟 (버튼, 입력 필드 크기)
- TC-005: 성능 (Lighthouse 점수, CLS, 로드 시간)
- 각 해상도별 스크린샷 자동 캡처

**사용법**:
```powershell
# 1. 개발 서버 실행
npm run dev

# 2. 테스트 실행 (headless 모드)
npx playwright test tests/mobile-responsive.spec.ts

# 3. 테스트 실행 (시각적으로 보기)
npx playwright test tests/mobile-responsive.spec.ts --headed

# 4. 결과 확인
# → test-artifacts/ 폴더에 스크린샷 생성
# → 콘솔에서 통과/실패 확인
```

---

### 4. MOBILE_TESTING_QUICK_START.md (빠른 시작 가이드)
**경로**: `D:\mabiz-crm\MOBILE_TESTING_QUICK_START.md`

**포함 내용**:
- 5분 환경 구성 (DevTools 설정, 커스텀 해상도 추가)
- 10분 핵심 검증 (4개 Phase × 2-3분)
- DevTools 팁 (Lighthouse, CLS, 터치 타겟)
- 자주 발견되는 이슈 및 수정 방법
- Tailwind CSS 빠른 팁
- 테스트 실패 시 대응 방법

**사용법**:
```
1. 환경 구성 (5분)
2. Phase 1-4 순차 검증 (10분)
3. 이슈 발견 시 기록
4. 다른 페이지로 반복
```

---

## 🎯 테스트 실행 순서

### Option A: 수동 테스트 (권장 - 빠름)
```
Step 1: MOBILE_TESTING_QUICK_START.md 따라 환경 구성 (5분)
Step 2: 각 해상도별로 4개 페이지 검증 (20-30분)
        - sign-in
        - dashboard
        - campaigns
        - audit-logs
Step 3: SCREENSHOT_VALIDATION_MATRIX.md에 결과 기록 (10분)
Step 4: 이슈 분류 (P0/P1/P2) 및 보고 (5분)
```

**총 소요 시간**: 40-50분

---

### Option B: 자동화 테스트 (철저함)
```
Step 1: npm run dev (개발 서버 실행)
Step 2: npx playwright test tests/mobile-responsive.spec.ts --headed
Step 3: test-artifacts/ 폴더에서 스크린샷 확인
Step 4: 콘솔 로그에서 실패 항목 확인
Step 5: SCREENSHOT_VALIDATION_MATRIX.md에서 자동 로그 분석
```

**총 소요 시간**: 15-20분

---

### Option C: 병렬 실행 (최우선 - 가장 빠름)
```
Step 1: 2명 팀 분할
       - QA 담당자 A: 수동 테스트 (320px, 375px)
       - QA 담당자 B: 자동화 테스트 (Playwright 실행)
Step 2: 동시 진행 (15-20분)
Step 3: 결과 통합 및 검증 (5분)
```

**총 소요 시간**: 20-25분

---

## 📊 검증 기준

### Pass 조건

✅ **텍스트 가독성**
- body: 14px 이상
- 제목: 24px 이상 (h1), 18px 이상 (h2)
- 대비도: WCAG AA 4.5:1 이상

✅ **그리드 레이아웃**
- 320-375px: 1열 배치 (100% - 32px margin)
- 640px: 2열 배치 가능
- 768px: 데스크톱 레이아웃 (사이드바 + 콘텐츠)

✅ **이미지 비율**
- aspect-ratio 유지 (변형 없음)
- lazy loading 적용 (초기 로드 최소화)

✅ **터치 타겟**
- 최소 44×44px (Apple HIG 기준)
- 인접 요소 간 8px 이상 간격

✅ **성능**
- Lighthouse Performance: 320-375px ≥ 80점, 640px ≥ 75점, 768px ≥ 85점
- CLS (Cumulative Layout Shift): < 0.1
- LCP (Largest Contentful Paint): < 2.5s

✅ **이슈**
- P0 (긴급): 0개 (모바일 사용 불가능)
- P1 (중요): ≤ 2개 (UX 심각 저해)
- P2 (개선): 제한 없음

---

## 🔴 Fail 조건

❌ **P0 이슈 발견**
- 텍스트 < 12px (읽을 수 없음)
- 버튼 < 40px (클릭 불가능)
- 뷰포트 오버플로우 (수평 스크롤 필수)
- CLS > 0.5 (심각한 레이아웃 이동)

❌ **성능 부족**
- Lighthouse < 70점
- 페이지 로드 > 5초

---

## 📋 테스트 관련 파일 목록

| 파일 | 용도 | 상태 |
|------|------|------|
| MOBILE_TESTING_PLAN_P1_1.md | 전체 테스트 계획 | ✅ 생성 완료 |
| SCREENSHOT_VALIDATION_MATRIX.md | 상세 검증 매트릭스 | ✅ 생성 완료 |
| tests/mobile-responsive.spec.ts | Playwright 자동화 | ✅ 생성 완료 |
| MOBILE_TESTING_QUICK_START.md | 빠른 시작 가이드 | ✅ 생성 완료 |
| test-artifacts/ (폴더) | 스크린샷 저장 폴더 | 📁 필요 시 생성 |

---

## 🚀 바로 시작하기

### 1. 수동 테스트 (지금 바로)
```powershell
# 1. DevTools 열기
# 2. MOBILE_TESTING_QUICK_START.md 참고
# 3. 각 해상도별로 4개 페이지 검증
# 4. SCREENSHOT_VALIDATION_MATRIX.md에 기록
```

### 2. 자동화 테스트 (선택)
```powershell
# 1. npm run dev
# 2. npx playwright test tests/mobile-responsive.spec.ts --headed
# 3. test-artifacts/ 스크린샷 확인
```

### 3. 이슈 수정
```powershell
# 1. 발견된 이슈를 우선순위별로 정렬
# 2. P0부터 순차 수정
# 3. 각 해상도별 재검증
```

---

## 💡 추천 팀 구성

| 역할 | 담당자 | 작업 | 소요 시간 |
|------|--------|------|---------|
| **QA 리드** | 테스트 전문가 | 테스트 계획 수립, 결과 검증 | 1시간 |
| **QA Engineer A** | QA 담당자 | 320px, 375px 수동 테스트 | 30분 |
| **QA Engineer B** | QA 담당자 | 640px, 768px + 자동화 테스트 | 30분 |
| **Engineer** | 개발자 | P0/P1 이슈 수정 | 2-3일 |
| **QA Validator** | 검증자 | 수정 후 재검증 | 1일 |

---

## 📞 FAQ

**Q: 테스트를 지금 시작해야 하나요?**
A: 네. 환경 구성 없이 바로 시작 가능합니다. MOBILE_TESTING_QUICK_START.md의 5분 구성 단계를 따르세요.

**Q: 모든 페이지를 검증해야 하나요?**
A: 아니요. 계획 문서에서 4개 주요 페이지(sign-in, dashboard, campaigns, audit-logs)만 검증하면 됩니다. 추가 페이지는 이슈 발견 후 필요시 검증하세요.

**Q: 이슈가 많으면 어떻게 하나요?**
A: P0 (긴급) → P1 (중요) → P2 (개선) 순서로 우선순위를 지정하고, P0부터 순차 수정합니다.

**Q: 자동화 테스트는 필수인가요?**
A: 아니요. 수동 테스트만으로도 충분합니다. 자동화는 속도 향상을 원할 때 선택입니다.

**Q: 얼마나 자주 테스트해야 하나요?**
A: 모바일 기능 추가 시, 반응형 CSS 변경 시, 배포 전 최소 1회 실행합니다.

---

## 📈 다음 단계

1. **지금**: MOBILE_TESTING_QUICK_START.md 따라 수동 테스트 (30분)
2. **오늘**: 발견된 이슈 분류 및 보고
3. **내일**: 개발팀에서 P0/P1 이슈 수정 시작
4. **내일+1**: 재검증 및 최종 승인

---

**작성**: 2026-06-08  
**버전**: 1.0  
**상태**: 🟢 Ready to Test
