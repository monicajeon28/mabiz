# E2E 테스트 완전 가이드 - 문서 인덱스

**버전**: 1.0  
**작성일**: 2026-06-08  
**대상**: mabiz-crm 모바일 반응형 E2E 테스트  
**상태**: 🟢 Complete (4개 문서 작성 완료)

---

## 📚 문서 구성

### 1️⃣ 기초 이해 - MOBILE_TESTING_OVERVIEW.md
**용도**: E2E 테스트의 전체 구조 파악  
**읽는 시간**: 5-10분  
**대상자**: 모든 팀원

**포함 내용**:
- [ ] 4개 해상도별 테스트 목표
- [ ] 5가지 검증 항목 (텍스트, 레이아웃, 이미지, 터치, 성능)
- [ ] 테스트 워크플로우 (Step 1-6)
- [ ] 검증 기준 (텍스트 크기, 그리드, 이미지, 터치, 성능)
- [ ] 문서 네비게이션 맵
- [ ] 추천 실행 순서 (옵션 A-C)
- [ ] 최종 승인 체크리스트

**읽으면 좋은 이유**:
```
빠른 개요를 원할 때: MOBILE_TESTING_OVERVIEW.md 읽기 (5분)
↓
상세 명세가 필요할 때: E2E_TESTING_GUIDE.md 읽기 (20분)
↓
구현 시작할 때: PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md 참고 (체크리스트)
```

---

### 2️⃣ 상세 가이드 - E2E_TESTING_GUIDE.md
**용도**: E2E 테스트 설계 및 실행  
**읽는 시간**: 20-30분  
**대상자**: QA 엔지니어, 개발자

**포함 내용**:
- [ ] 환경 설정 (Playwright 설치, 설정 파일 작성)
- [ ] 10개 테스트 케이스 상세 명세
  - TC-E2E-001: 로그인 페이지 텍스트
  - TC-E2E-002: 대시보드 헤더
  - TC-E2E-003: 카드 그리드 레이아웃
  - TC-E2E-004: 테이블 컬럼 숨김
  - TC-E2E-005: 이미지 비율 유지
  - TC-E2E-006: 터치 타겟 크기
  - TC-E2E-007: Lighthouse 성능 점수
  - TC-E2E-008: 폼 입력 및 제출
  - TC-E2E-009: 스크롤 성능 & CLS
  - TC-E2E-010: 다크모드 전환

- [ ] Assertion 기준값 (텍스트, 터치, 색상, 성능)
- [ ] Helper 함수 예제
- [ ] 에러 처리 패턴
- [ ] 테스트 실행 명령어
- [ ] 결과 분석 방법
- [ ] CI/CD 통합
- [ ] 테스트 유지보수 가이드

**실제 활용**:
```
E2E 테스트를 실행하기 전에 필수로 읽어야 함
각 TC별로 상세한 시나리오 및 assertion이 정의됨
개발자는 이를 바탕으로 테스트 코드 작성
```

---

### 3️⃣ 상세 스펙 - PLAYWRIGHT_TEST_SPECS.md
**용도**: Playwright 테스트 코드 구현 전 상세 명세  
**읽는 시간**: 30-45분  
**대상자**: QA 엔지니어, Playwright 구현자

**포함 내용**:
- [ ] 테스트 구조 및 파일 레이아웃
- [ ] 10개 테스트 케이스 마크다운 스펙
  - 각 TC별 전제조건
  - 단계별 실행 (Step 1-6)
  - 테스트 데이터 정의
  - 기대 결과
  - TypeScript 코드 예제

- [ ] Assertion 기준값 (텍스트, 터치, 색상, 성능)
- [ ] Helper 함수 구현 예제
- [ ] 에러 처리 패턴 (Soft Assertion, Retry, Conditional Skip)

**실제 활용**:
```
이 마크다운 스펙을 보고 실제 TypeScript 코드 작성
각 테스트 케이스별 체계적인 구현 가이드 제공
copy-paste 가능한 코드 스니펫 포함
```

---

### 4️⃣ 구현 체크리스트 - PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md
**용도**: E2E 테스트 구현 체계적으로 진행  
**읽는 시간**: 체크리스트 형식 (필요시만 참고)  
**대상자**: 프로젝트 리더, QA 엔지니어

**포함 내용**:
- [ ] Phase 1: 환경 구성 (1-2시간)
  - Playwright 설치
  - 설정 파일 작성
  - 폴더 구조 생성
  - npm 스크립트 추가

- [ ] Phase 2: 테스트 파일 구현 (3-4시간)
  - Helper 함수 (utils/)
  - Assertions (utils/assertions.ts)
  - Lighthouse (utils/lighthouse.ts)
  - 테스트 케이스 (6개 파일)
  - Fixtures & Page Objects
  - Test Data 준비

- [ ] Phase 3: 로컬 테스트 실행 (1-2시간)
  - 기본 테스트 실행
  - 해상도별 테스트
  - 디버그 모드
  - 보고서 확인

- [ ] Phase 4: 테스트 수정 & 최적화 (1-3시간)
  - 실패 테스트 수정
  - 플레이키 테스트 해결
  - 성능 최적화

- [ ] Phase 5: CI/CD 통합 (1시간)
  - GitHub Actions 워크플로우
  - PR 체크 통합
  - CI 환경 최적화

- [ ] Phase 6: 모니터링 & 유지보수 (지속적)
  - 테스트 결과 모니터링
  - 테스트 유지보수
  - 테스트 확장

- [ ] Phase 7: 최종 배포 (1일)
  - 최종 검증
  - 문서 작성
  - 팀 교육
  - 배포

- [ ] 최종 체크리스트 (모든 항목 확인)

**실제 활용**:
```
프로젝트를 단계적으로 진행하며 각 Phase 체크
필요한 파일/폴더 생성 확인
각 Phase별 예상 시간 측정
팀원과 진행 상황 공유
```

---

## 🎯 사용 시나리오별 읽기 순서

### 시나리오 1: "E2E 테스트가 뭔지 빨리 알고 싶어"
```
1. MOBILE_TESTING_OVERVIEW.md (5분)
   ↓ (테스트 워크플로우 & 구조 이해)
2. 필요시 추가 읽기
```

### 시나리오 2: "내일 부터 E2E 테스트를 시작해야 한다"
```
1. MOBILE_TESTING_OVERVIEW.md (5분)
   ↓ (전체 구조 파악)
2. PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md - Phase 1 (2시간)
   ↓ (환경 구성)
3. E2E_TESTING_GUIDE.md (20분)
   ↓ (각 테스트 케이스 이해)
4. PLAYWRIGHT_TEST_SPECS.md (30분)
   ↓ (상세 스펙 학습)
5. 코드 구현 시작
```

### 시나리오 3: "테스트 코드를 구현할 준비가 된 상태"
```
1. PLAYWRIGHT_TEST_SPECS.md (30분)
   ↓ (각 TC별 마크다운 스펙 읽기)
2. E2E_TESTING_GUIDE.md의 Helper 함수 섹션 (5분)
   ↓ (재사용 가능한 함수 학습)
3. PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md - Phase 2 (3시간)
   ↓ (구체적 구현 항목 확인)
4. 코드 작성
```

### 시나리오 4: "테스트 실행 및 결과 확인"
```
1. PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md - Phase 3 (1시간)
   ↓ (로컬 테스트 실행 명령어)
2. E2E_TESTING_GUIDE.md의 결과 분석 섹션 (5분)
   ↓ (결과 해석 방법)
3. 실패한 테스트 분석
   → PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md - Phase 4 (수정 방법)
```

### 시나리오 5: "CI/CD에 통합하고 싶다"
```
1. E2E_TESTING_GUIDE.md의 CI/CD 통합 섹션 (5분)
2. PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md - Phase 5 (1시간)
   ↓ (GitHub Actions 워크플로우 작성)
3. 배포 및 모니터링
   → Phase 6, 7 참고
```

---

## 📊 문서별 상세 내용 비교

| 문서 | 목적 | 난이도 | 읽는 시간 | 포함 내용 |
|------|------|--------|---------|---------|
| **OVERVIEW** | 전체 구조 이해 | 🟢 쉬움 | 5-10분 | 개념, 워크플로우, 기준값 |
| **E2E GUIDE** | 설계 및 실행 | 🟡 중간 | 20-30분 | 환경설정, 10개 TC, CI/CD |
| **SPECS** | 구현 명세 | 🔴 어려움 | 30-45분 | 마크다운 스펙, 코드 예제 |
| **CHECKLIST** | 구현 진행 | 🟡 중간 | 체크리스트 | 7개 Phase, 100+ 체크 항목 |

---

## 🗂️ 파일 구조

```
D:\mabiz-crm\
├── MOBILE_TESTING_OVERVIEW.md ⭐⭐⭐
│   └─ 전체 구조도 & 시각화
│
├── E2E_TESTING_GUIDE.md ⭐⭐⭐
│   └─ 환경설정 ~ CI/CD 통합
│
├── PLAYWRIGHT_TEST_SPECS.md ⭐⭐⭐
│   └─ 10개 TC 상세 마크다운 스펙
│
├── PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md ⭐⭐
│   └─ 7 Phase 체크리스트
│
├── E2E_TESTING_INDEX.md (이 파일) ⭐
│   └─ 문서 인덱스 & 네비게이션
│
├── MOBILE_TESTING_PLAN_P1_1.md
│   └─ 초기 기획 문서 (참고용)
│
├── SCREENSHOT_VALIDATION_MATRIX.md
│   └─ 수동 테스트 검증 매트릭스
│
├── MOBILE_TESTING_QUICK_START.md
│   └─ 30분 빠른 가이드
│
├── P1_1_TESTING_SUMMARY.md
│   └─ 최종 정리 및 다음 단계
│
└── tests/
    ├── mobile-responsive.spec.ts (구현 예정)
    ├── mobile-typography.spec.ts (구현 예정)
    ├── mobile-layout.spec.ts (구현 예정)
    ├── mobile-images.spec.ts (구현 예정)
    ├── mobile-touch-targets.spec.ts (구현 예정)
    ├── mobile-performance.spec.ts (구현 예정)
    ├── fixtures/
    │   ├── test-data.ts (구현 예정)
    │   └── page-objects.ts (구현 예정)
    └── utils/
        ├── assertions.ts (구현 예정)
        ├── lighthouse.ts (구현 예정)
        └── mobile-helpers.ts (구현 예정)
```

---

## 🚀 빠른 시작 (5분)

### Step 1: 개요 파악
```
→ MOBILE_TESTING_OVERVIEW.md 읽기 (5분)
```

### Step 2: 이해도 확인
```
Q: E2E 테스트가 무엇인가?
A: 실제 사용자가 브라우저에서 하는 행동을 자동으로 시뮬레이션

Q: 왜 4개 해상도를 테스트하는가?
A: iPhone SE(320px) ~ iPad(768px) 모든 디바이스 커버

Q: 검증 항목이 5가지인 이유는?
A: 텍스트·레이아웃·이미지·터치·성능 = 모바일 UX 핵심
```

### Step 3: 다음 단계
```
- 환경 설정 시작: Phase 1 (2시간)
- 테스트 코드 작성: Phase 2 (3시간)
- 로컬 테스트 실행: Phase 3 (1시간)
```

---

## 📌 핵심 수치

| 항목 | 값 | 단위 |
|------|-----|------|
| 테스트 해상도 | 4개 | 개 (320, 375, 640, 768px) |
| 검증 항목 | 5개 | 개 (텍스트, 레이아웃, 이미지, 터치, 성능) |
| 테스트 케이스 | 10개 | 개 (TC-E2E-001 ~ 010) |
| 예상 소요 시간 | 7-10 | 시간 (Phase 1-4) |
| 전체 문서 크기 | 50+ | KB (4개 문서) |
| 코드 라인 예상 | 2000+ | 줄 (6개 테스트 파일) |

---

## ✅ 체크리스트: 이 문서들을 모두 읽었다면

- [ ] E2E 테스트의 목표 및 범위 이해
- [ ] 4개 해상도별 기대 결과 파악
- [ ] 10개 테스트 케이스 주요 내용 숙지
- [ ] Playwright 환경 구성 방법 알기
- [ ] Helper 함수 및 Assertion 패턴 이해
- [ ] 로컬 테스트 실행 명령어 숙지
- [ ] 실패한 테스트 수정 방법 알기
- [ ] CI/CD 통합 프로세스 이해

---

## 🆘 문제 해결

### "너무 많은 문서가 있어서 어디서 시작해야 할지 모르겠어요"
```
→ MOBILE_TESTING_OVERVIEW.md만 먼저 읽기 (5분)
→ 그 후 PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md의 Phase 1 시작
```

### "테스트 코드를 작성해야 하는데 뭘 해야 하나요?"
```
→ PLAYWRIGHT_TEST_SPECS.md의 TC-E2E-001 섹션 읽기
→ 거기에 있는 TypeScript 예제 따라하기
→ 다른 TC들도 같은 패턴으로 구현
```

### "로컬에서 테스트를 실행했는데 실패가 났어요"
```
→ E2E_TESTING_GUIDE.md의 "결과 분석" 섹션 읽기
→ PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md - Phase 4 참고
→ 로케이터 수정 또는 코드 수정
```

### "CI/CD에 어떻게 통합하나요?"
```
→ E2E_TESTING_GUIDE.md의 "CI/CD 통합" 섹션 읽기
→ PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md - Phase 5 따라하기
```

---

## 📞 연락처 및 지원

**Playwright 문제**:
- 공식 문서: https://playwright.dev
- 로케이터 디버깅: `npm run test:e2e:ui` 실행

**테스트 설계 문제**:
- E2E_TESTING_GUIDE.md 참고
- Assertion 기준값 확인

**구현 진행 문제**:
- PLAYWRIGHT_IMPLEMENTATION_CHECKLIST.md의 해당 Phase 참고
- 각 Phase별 예상 시간 참고

---

## 🎓 학습 경로

```
1일차:
  10:00-10:30 → OVERVIEW 읽기
  10:30-11:00 → CHECKLIST Phase 1 실행
  11:00-13:00 → 환경 구성 완료

2일차:
  09:00-10:00 → SPECS 읽기 (TC-E2E-001~005)
  10:00-12:00 → 첫 5개 테스트 구현
  12:00-13:00 → 로컬 실행 및 수정

3일차:
  09:00-10:00 → SPECS 읽기 (TC-E2E-006~010)
  10:00-12:00 → 나머지 5개 테스트 구현
  12:00-13:00 → 전체 테스트 실행 및 수정

4일차:
  09:00-10:00 → CHECKLIST Phase 5 (CI/CD)
  10:00-12:00 → GitHub Actions 설정
  12:00-13:00 → 배포 및 모니터링 설정
```

---

## 📈 진행 상황 추적

```
□ OVERVIEW 읽음 (0.5시간)
□ CHECKLIST Phase 1 완료 (2시간)
  └─ Playwright 설치, playwright.config.ts 작성, 폴더 구조 생성
□ CHECKLIST Phase 2 완료 (4시간)
  └─ 6개 테스트 파일 구현
□ CHECKLIST Phase 3 완료 (2시간)
  └─ 로컬 테스트 실행, 결과 확인
□ CHECKLIST Phase 4 완료 (2시간)
  └─ 실패 테스트 수정, 성능 최적화
□ CHECKLIST Phase 5 완료 (1시간)
  └─ CI/CD 통합
□ CHECKLIST Phase 6-7 진행 중 (지속적)
  └─ 모니터링, 유지보수, 배포

총 소요 시간: ~13시간 (3-4일)
```

---

**버전**: 1.0  
**최종 업데이트**: 2026-06-08  
**상태**: 🟢 Complete & Ready
