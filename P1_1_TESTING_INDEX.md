# P1-1 모바일 테스트 계획 전체 색인 (2026-06-08)

## 📚 문서 체계

총 **6개 문서** + **1개 Playwright 테스트 스크립트** 구성

---

## 📄 문서 목록

### 1. MOBILE_TESTING_OVERVIEW.md (11.3 KB) ⭐ START HERE
**경로**: `D:\mabiz-crm\MOBILE_TESTING_OVERVIEW.md`

**내용**:
- 전체 테스트 계획 시각화 (구조도)
- 테스트 워크플로우 (6단계)
- 각 검증 항목별 상세 기준
- 문서 네비게이션
- 추천 실행 순서
- 최종 승인 체크리스트

**읽는 시간**: 10분  
**적합한 대상**: 테스트 리더, 프로젝트 관리자

**바로 가기**:
```
1. 이 파일부터 시작하세요.
2. 전체 구조를 파악합니다.
3. "추천 실행 순서"를 선택합니다.
```

---

### 2. MOBILE_TESTING_QUICK_START.md (7.9 KB) ⭐ FASTEST
**경로**: `D:\mabiz-crm\MOBILE_TESTING_QUICK_START.md`

**내용**:
- 5분 환경 구성 가이드
- 10분 핵심 검증 (4 Phase × 2-3분)
- DevTools 팁 (Lighthouse, CLS, 터치 타겟)
- 자주 발견되는 이슈 및 수정 방법
- Tailwind CSS 빠른 팁
- 최종 체크리스트

**읽는 시간**: 5분  
**실행 시간**: 30분 (환경 + 검증)  
**적합한 대상**: QA 담당자 (빠른 검증 원할 때)

**바로 가기**:
```
1. "5분 환경 구성" 따라 DevTools 설정
2. "10분 핵심 검증" 4 Phase 순차 실행
3. 이슈 발견 시 기록
```

---

### 3. MOBILE_TESTING_PLAN_P1_1.md (14.3 KB) ⭐⭐ MOST DETAILED
**경로**: `D:\mabiz-crm\MOBILE_TESTING_PLAN_P1_1.md`

**내용**:
- 4개 해상도 정의 (320px, 375px, 640px, 768px)
- 5가지 검증 항목 상세 체크리스트
  1. 텍스트 가독성 (TC-001~004)
  2. 그리드 레이아웃 (TC-005~008)
  3. 이미지 비율 (TC-009~012)
  4. 터치 타겟 (TC-013~016)
  5. 스크롤 성능 (TC-017~020)
- 필수 도구 (Chrome DevTools, Lighthouse)
- 단계별 테스트 시작 가이드
- 각 해상도별 스크린샷 체크리스트
- 이슈 보고 템플릿
- 배포 전 최종 체크리스트

**읽는 시간**: 15분  
**참고 시간**: 테스트 진행 중 계속 참고  
**적합한 대상**: QA 전문가, 테스트 리더

**바로 가기**:
```
1. "📋 검증 항목별 체크리스트" 섹션으로 이동
2. 테스트 중인 해상도의 TC 찾기
3. 검증 기준과 스크린샷 비교
4. 발견 사항 "이슈 보고 템플릿"에 기입
```

---

### 4. SCREENSHOT_VALIDATION_MATRIX.md (16.3 KB) ⭐⭐ DETAILED MATRIX
**경로**: `D:\mabiz-crm\SCREENSHOT_VALIDATION_MATRIX.md`

**내용**:
- 각 해상도별 TC별 **상세 검증 매트릭스** (20개 TC)
  - 320px (iPhone SE): TC-001~003 (로그인, 대시보드, 감사로그)
  - 375px (iPhone 12): TC-004~005 (로그인, 캠페인)
  - 640px (iPad mini): TC-006~007 (대시보드, 감사로그)
  - 768px (iPad): TC-008~009 (대시보드, 캠페인)
- 각 항목별 기준값 / 실제값 / 상태 / 비고 입력 칸
- 최종 종합 체크리스트
- 승인 기준 및 서명란

**읽는 시간**: 처음 5분, 이후 참고용  
**기입 시간**: 각 스크린샷 검증 시 15-20분  
**적합한 대상**: QA 담당자, 검증자

**바로 가기**:
```
1. 스크린샷 캡처
2. "스크린샷 파일명" 참고하여 해당 TC 찾기
3. "기준값" 열의 기준과 비교
4. "실제값" 열에 기입
5. "상태" 열에 ✅/❌ 표시
6. "비고" 열에 발견 사항 기입
```

---

### 5. MOBILE_TESTING_PLAN_P1_1.md (14.3 KB) - 이미 위에 있음

---

### 6. P1_1_TESTING_SUMMARY.md (8.3 KB) ⭐ FINAL REPORT
**경로**: `D:\mabiz-crm\P1_1_TESTING_SUMMARY.md`

**내용**:
- 테스트 목표 및 소요 시간
- 생성된 문서 전체 목록 (요약)
- 테스트 실행 순서 (3가지 옵션)
  - Option A: 수동 테스트 (30분, 권장)
  - Option B: 자동화 테스트 (15분)
  - Option C: 병렬 실행 (20분, 최우선)
- 검증 기준 (Pass/Fail)
- 테스트 관련 파일 목록
- 추천 팀 구성
- FAQ
- 다음 단계 (6단계)

**읽는 시간**: 10분  
**적합한 대상**: 프로젝트 관리자, 테스트 리더

**바로 가기**:
```
1. "📊 검증 기준" 섹션 읽기
2. "🚀 바로 시작하기" 에서 옵션 선택
3. 선택한 옵션 따라 진행
4. 완료 후 "다음 단계" 진행
```

---

## 🧪 자동화 테스트 스크립트

### 7. tests/mobile-responsive.spec.ts (13.8 KB) 🤖
**경로**: `D:\mabiz-crm\tests\mobile-responsive.spec.ts`

**내용**:
- Playwright 기반 자동화 테스트
- 4개 해상도 자동 실행
- 5가지 검증 항목 자동 테스트
  - TC-001: 텍스트 가독성
  - TC-002: 그리드 레이아웃
  - TC-003: 이미지 비율
  - TC-004: 터치 타겟
  - TC-005: 성능 (CLS, 로드 시간)
- 각 해상도별 스크린샷 자동 캡처

**사용법**:
```powershell
# 1. 개발 서버 실행
npm run dev

# 2. 테스트 실행 (headless)
npx playwright test tests/mobile-responsive.spec.ts

# 3. 시각적으로 보기
npx playwright test tests/mobile-responsive.spec.ts --headed

# 4. 특정 해상도만 실행
npx playwright test tests/mobile-responsive.spec.ts -g "320px"

# 5. 결과 확인
# → test-artifacts/ 폴더에 스크린샷 생성
# → 콘솔에서 통과/실패 확인
```

**실행 시간**: 10-15분  
**적합한 대상**: 자동화를 원하는 QA, 개발자

---

## 🎯 사용 시나리오별 추천 경로

### 시나리오 1: "30분 안에 빠르게 검증하고 싶어요"
```
1. MOBILE_TESTING_OVERVIEW.md (5분 읽기)
2. MOBILE_TESTING_QUICK_START.md 따라 실행 (30분)
3. SCREENSHOT_VALIDATION_MATRIX.md에 결과 기입 (5분)
4. 이슈 분류 (5분)
총 45분 ✅
```

### 시나리오 2: "철저하게 검증하고 싶어요"
```
1. MOBILE_TESTING_PLAN_P1_1.md 읽기 (15분)
2. MOBILE_TESTING_QUICK_START.md 환경 구성 (5분)
3. MOBILE_TESTING_PLAN_P1_1.md의 각 TC 순차 실행 (40분)
4. SCREENSHOT_VALIDATION_MATRIX.md 작성 (20분)
5. P1_1_TESTING_SUMMARY.md에서 Pass 기준 확인 (5분)
총 85분 ✅
```

### 시나리오 3: "자동화로 빠르게 처리하고 싶어요"
```
1. MOBILE_TESTING_OVERVIEW.md (5분 읽기)
2. tests/mobile-responsive.spec.ts 실행 (10분)
3. test-artifacts/ 스크린샷 자동 생성 (자동)
4. SCREENSHOT_VALIDATION_MATRIX.md에 자동 로그 분석 (5분)
5. 콘솔 로그에서 실패 항목 확인 (5분)
총 30분 ✅
```

### 시나리오 4: "팀으로 병렬 처리하고 싶어요"
```
담당자 A: MOBILE_TESTING_QUICK_START.md 따라 수동 테스트 (320px, 375px)
담당자 B: tests/mobile-responsive.spec.ts 자동화 테스트 (Playwright)
결과 통합: P1_1_TESTING_SUMMARY.md에서 최종 확인
총 25분 ✅ (병렬이므로 가장 빠름)
```

---

## 📊 문서 선택 매트릭스

| 역할 | 목적 | 추천 문서 | 순서 |
|------|------|---------|------|
| **테스트 리더** | 전체 계획 수립 | OVERVIEW → PLAN → SUMMARY | 1-2-5 |
| **QA 담당자 (빠름)** | 30분 검증 | QUICK_START → MATRIX | 3-4 |
| **QA 담당자 (철저)** | 상세 검증 | PLAN → MATRIX → SUMMARY | 2-4-5 |
| **자동화 담당자** | 스크립트 실행 | OVERVIEW → tests/spec.ts | 1-7 |
| **개발자** | 버그 수정 | MATRIX → PLAN (참고) | 4-2 |
| **PM** | 진행 관리 | SUMMARY → OVERVIEW | 5-1 |

---

## 🔍 각 문서의 핵심 섹션

### MOBILE_TESTING_OVERVIEW.md
- "🎯 테스트 계획 전체도" → 구조 이해
- "📊 테스트 워크플로우" → 실행 순서
- "✅ 최종 승인 체크리스트" → 완료 확인

### MOBILE_TESTING_QUICK_START.md
- "⚡ 5분 환경 구성" → 즉시 시작
- "🚀 10분 핵심 검증" → Phase 1-4 실행
- "🔍 DevTools 팁" → 성능 측정

### MOBILE_TESTING_PLAN_P1_1.md
- "📱 테스트 해상도 정의" → 대상 기기 이해
- "🎯 검증 항목별 체크리스트" → 상세 기준
- "📋 테스트 시작 단계" → Step-by-step

### SCREENSHOT_VALIDATION_MATRIX.md
- "320px (iPhone SE) 검증 매트릭스" → TC-001~003
- "375px (iPhone 12) 검증 매트릭스" → TC-004~005
- "📋 최종 종합 체크리스트" → Pass/Fail 판정

### P1_1_TESTING_SUMMARY.md
- "📌 핵심 정보" → 목표와 소요 시간
- "🎯 테스트 실행 순서" → 3가지 옵션
- "📈 다음 단계" → 배포까지의 로드맵

### tests/mobile-responsive.spec.ts
- "DEVICES 배열" → 테스트 해상도
- "TC-001: 텍스트 가독성 테스트" → 자동 검증
- "콘솔 로그" → 실패 항목 확인

---

## ✅ 읽어야 할 최소 문서

| 역할 | 최소 필독 | 소요 시간 |
|------|---------|---------|
| **테스트 리더 (첫 시작)** | OVERVIEW (5min) + QUICK_START (5min) | 10분 |
| **QA 담당자 (즉시 시작)** | QUICK_START (5min) | 5분 |
| **개발자 (이슈 수정)** | MATRIX (5min) + PLAN (10min) | 15분 |
| **PM (진행 관리)** | SUMMARY (10min) + OVERVIEW (5min) | 15분 |

---

## 🚀 빠른 시작 (지금 바로!)

### 옵션 A: 30분 검증 (권장)
```
1. MOBILE_TESTING_QUICK_START.md 읽기 (5분)
2. 환경 구성 (5분)
3. Phase 1-4 검증 (15분)
4. 이슈 기록 (5분)
```

### 옵션 B: 15분 자동화
```
1. npm run dev
2. npx playwright test tests/mobile-responsive.spec.ts --headed
3. test-artifacts/ 확인
```

---

## 📞 문의

- **전체 계획**: P1_1_TESTING_SUMMARY.md 참고
- **구체적인 기준**: MOBILE_TESTING_PLAN_P1_1.md 참고
- **결과 기록**: SCREENSHOT_VALIDATION_MATRIX.md 참고
- **이슈 수정 가이드**: MOBILE_TESTING_QUICK_START.md의 "자주 발견되는 이슈" 참고

---

## 📈 문서 관계도

```
START
  │
  ├─→ MOBILE_TESTING_OVERVIEW.md (구조 이해)
  │     │
  │     ├─→ Option A: 빠른 검증
  │     │     └─→ MOBILE_TESTING_QUICK_START.md (30분)
  │     │           └─→ SCREENSHOT_VALIDATION_MATRIX.md (기록)
  │     │
  │     ├─→ Option B: 자동화 검증
  │     │     └─→ tests/mobile-responsive.spec.ts (15분)
  │     │           └─→ SCREENSHOT_VALIDATION_MATRIX.md (기록)
  │     │
  │     └─→ Option C: 병렬 검증 (A + B 동시)
  │
  └─→ P1_1_TESTING_SUMMARY.md (최종 정리)
        └─→ 다음 단계 (이슈 수정 → 재검증)
```

---

**색인 생성일**: 2026-06-08  
**버전**: 1.0  
**상태**: 🟢 Complete
