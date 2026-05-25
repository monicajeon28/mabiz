# CRM 연결 및 사용자 역할 테스트 - 문서 인덱스
**작성일**: 2026-05-25  
**버전**: 1.0  
**상태**: ✅ 완성

---

## 📌 개요

마비즈 CRM 시스템의 **Neon DB 복구 이후 모든 사용자 역할 및 기능 정상성을 검증**하기 위한 통합 테스트 계획입니다.

### 핵심 검증 항목
```
✓ 인증 (Clerk/NextAuth) 정상 작동
✓ 역할 기반 접근 제어 (RBAC) 권한 검증
✓ CRM Contact 관리 기능 (CRUD, 렌즈)
✓ CruiseDot API 연동 및 Webhook 처리
✓ 성능 (로딩 속도, 쿼리 최적화)
✓ 데이터 일관성 (Neon DB ↔ CRM)
```

### 테스트 사용자 4가지
| 역할 | 이메일 | 권한 | 테스트 내용 |
|------|--------|------|----------|
| Admin | admin@mabiz.test | GLOBAL_ADMIN | 전체 시스템 접근 |
| Manager | manager@mabiz.test | MEMBER | 팀 관리, 고객 감독 |
| Sales | sales@mabiz.test | MEMBER | 고객 관리, 판매 활동 |
| PreSales | presales@mabiz.test | MEMBER | 초기 상담, 리드 관리 |

---

## 📚 전체 문서 구조

```
CRM 테스트 계획 (총 5개 문서, 2,371줄)
│
├─ 1️⃣ CRM_TEST_PLAN_INDEX.md (이 파일)
│   └─ 목적: 전체 문서 인덱스 및 빠른 네비게이션
│
├─ 2️⃣ CRM_CONNECTION_TEST_PLAN.md (★ 메인 계획서)
│   ├─ 786줄, 22.98 KB
│   ├─ 목적: 테스트 전체 전략 및 상세 가이드
│   ├─ 대상: 테스트 리더, PM, 개발 리더
│   └─ 주요 내용:
│       ├─ 시스템 아키텍처 (인증/권한 체계)
│       ├─ 4가지 사용자 역할 정의
│       ├─ 6가지 Phase별 테스트 항목
│       ├─ 테스트 실행 계획 (4 Stage)
│       ├─ 성공 기준 (필수/권장)
│       └─ 문제 해결 가이드
│
├─ 3️⃣ CRM_CONNECTION_DETAILED_TEST_CASES.md (★ 상세 케이스)
│   ├─ 891줄, 25.78 KB
│   ├─ 목적: 50개 테스트 케이스 상세 실행법
│   ├─ 대상: QA, 테스트 엔지니어
│   └─ 구성:
│       ├─ 사전 설정 (TC 준비)
│       ├─ Phase 1: 인증 (TC-001~010)
│       ├─ Phase 2: 권한 (TC-011~025)
│       ├─ Phase 3: CRM 기능 (TC-026~035)
│       ├─ Phase 4: CruiseDot API (TC-036~045)
│       └─ Phase 5: 성능 (TC-046~050)
│
├─ 4️⃣ CRM_TEST_EXECUTION_QUICK_START.md (★ 빠른 시작)
│   ├─ 355줄, 9.59 KB
│   ├─ 목적: 명령어 기반 빠른 시작 가이드
│   ├─ 대상: 테스트 엔지니어 (일일 실행용)
│   └─ 구성:
│       ├─ 10초 안에 시작하기
│       ├─ 6 Step 단계별 실행
│       ├─ 자동화 테스트 명령어
│       ├─ 수동 E2E 테스트 체크리스트
│       └─ 최종 체크리스트
│
├─ 5️⃣ CRM_TEST_SUMMARY.md (★ 종합 요약)
│   ├─ 363줄, 13.32 KB
│   ├─ 목적: 종합 요약 및 빠른 참고
│   ├─ 대상: 모든 팀 (PM, 개발자, QA)
│   └─ 구성:
│       ├─ 산출물 (4개 문서) 요약
│       ├─ 사용자 역할별 권한 매트릭스
│       ├─ API 엔드포인트 검증 리스트
│       ├─ CRM 렌즈 데이터 필드 매핑
│       └─ 테스트 시간표 & 성공 기준
│
└─ 6️⃣ CRM_TEST_DATA_SETUP.sql
    ├─ 목적: 테스트 데이터 초기화
    ├─ 대상: DBA, 테스트 엔지니어
    └─ 내용:
        ├─ 테스트 조직 생성 (2개)
        ├─ 테스트 사용자 생성 (4명)
        ├─ 테스트 고객 생성 (20명)
        ├─ SMS/이메일 설정
        └─ 데이터 검증 쿼리
```

---

## 🗺️ 문서별 사용 시나리오

### Scenario 1: 테스트 계획을 처음 접하는 경우
```
1. CRM_TEST_SUMMARY.md 읽기 (10분)
   ├─ Overview 이해
   ├─ 사용자 역할 파악
   └─ API 엔드포인트 확인

2. CRM_CONNECTION_TEST_PLAN.md 읽기 (30분)
   ├─ 시스템 아키텍처 이해
   ├─ 테스트 항목 상세 학습
   └─ 성공 기준 확인

3. CRM_TEST_EXECUTION_QUICK_START.md로 빠른 시작 (2분)
   └─ 10초 안에 테스트 시작
```

### Scenario 2: 테스트를 실제로 실행하는 경우
```
1. CRM_TEST_EXECUTION_QUICK_START.md 참고 (30분)
   ├─ Step 1-3: 환경 준비
   └─ Step 4-6: 테스트 실행

2. CRM_CONNECTION_DETAILED_TEST_CASES.md로 상세 확인 (2-3시간)
   ├─ TC-001~010: 인증 테스트
   ├─ TC-011~025: 권한 테스트
   ├─ TC-026~035: CRM 기능 테스트
   ├─ TC-036~045: CruiseDot 테스트
   └─ TC-046~050: 성능 테스트

3. CRM_TEST_SUMMARY.md로 최종 확인 (10분)
   └─ 성공 기준 달성 여부 검증
```

### Scenario 3: 특정 기능만 테스트하는 경우
```
특정 기능: "Contact 고객 권한 검증"

1. CRM_TEST_SUMMARY.md에서 권한 매트릭스 확인
   └─ Contact 관련 권한 찾기

2. CRM_CONNECTION_DETAILED_TEST_CASES.md에서
   └─ TC-014, TC-015 찾기

3. 해당 TC 실행
   └─ 테스트 결과 기록
```

---

## 📖 각 문서의 주요 섹션

### CRM_CONNECTION_TEST_PLAN.md
| 섹션 | 쪽 | 내용 |
|------|-----|------|
| Executive Summary | 1 | 목표 및 핵심 항목 |
| 시스템 아키텍처 | 2 | 인증/권한 체계도 |
| 사용자 정의 | 3-5 | 4가지 사용자 역할 상세 |
| Phase별 체크리스트 | 6-15 | 각 테스트 항목 상세 |
| 테스트 실행 계획 | 16-17 | Stage별 일정 |
| 성공 기준 | 18 | PASS/FAIL 기준 |
| 문제 해결 | 19-22 | 4가지 시나리오 |

### CRM_CONNECTION_DETAILED_TEST_CASES.md
| Phase | TC 범위 | 개수 | 내용 |
|-------|---------|------|------|
| 사전 설정 | - | - | 환경 준비, 테스트 데이터 |
| Phase 1 | TC-001~010 | 10 | 인증 (로그인, 로그아웃, 세션) |
| Phase 2 | TC-011~025 | 15 | 권한 (RBAC, 경로 제어, 조직 격리) |
| Phase 3 | TC-026~035 | 10 | CRM (CRUD, L0-L3 렌즈, SMS) |
| Phase 4 | TC-036~045 | 10 | CruiseDot (상품, Webhook) |
| Phase 5 | TC-046~050 | 5 | 성능 (로딩, 쿼리, 메모리) |

### CRM_TEST_EXECUTION_QUICK_START.md
| Step | 시간 | 내용 |
|------|------|------|
| Step 1 | 15분 | 환경 준비 (npm ci, migrate) |
| Step 2 | 10분 | 테스트 사용자 생성 |
| Step 3 | 30분 | 자동화 테스트 (npm test) |
| Step 4 | 90분 | 수동 E2E 테스트 (4명 사용자) |
| Step 5 | 30분 | CruiseDot API 테스트 |
| Step 6 | 30분 | 성능 테스트 |

---

## 🚀 빠른 시작 (5분)

### 1단계: 문서 준비
```bash
# 이미 다운로드됨
ls -la D:\mabiz-crm\CRM_*.md
```

### 2단계: 환경 설정
```bash
cd D:\mabiz-crm
npm ci
npx prisma migrate deploy
npm run dev
```

### 3단계: 테스트 실행
```bash
# 빠른 시작 가이드 따르기
cat CRM_TEST_EXECUTION_QUICK_START.md
# 또는 상세 케이스로 각 TC 실행
cat CRM_CONNECTION_DETAILED_TEST_CASES.md
```

---

## 🎯 테스트 목표별 문서 선택 가이드

### "시스템 전체를 이해하고 싶다"
→ **CRM_CONNECTION_TEST_PLAN.md** 읽기 (30분)

### "어떻게 테스트를 실행하는지 알고 싶다"
→ **CRM_TEST_EXECUTION_QUICK_START.md** 읽기 (5분)

### "구체적인 테스트 케이스를 실행하고 싶다"
→ **CRM_CONNECTION_DETAILED_TEST_CASES.md** 참고 (2-3시간)

### "핵심만 빠르게 파악하고 싶다"
→ **CRM_TEST_SUMMARY.md** 읽기 (10분)

### "테스트 데이터를 준비하고 싶다"
→ **CRM_TEST_DATA_SETUP.sql** 실행 (10분)

---

## 📊 문서별 분량 및 소요 시간

| 문서 | 줄 수 | 크기 | 읽기 시간 | 실행 시간 |
|------|-------|------|---------|---------|
| CRM_CONNECTION_TEST_PLAN.md | 786 | 23KB | 30분 | - |
| CRM_CONNECTION_DETAILED_TEST_CASES.md | 891 | 26KB | 60분 | 3시간 |
| CRM_TEST_EXECUTION_QUICK_START.md | 355 | 10KB | 5분 | 3시간 |
| CRM_TEST_SUMMARY.md | 363 | 13KB | 10분 | - |
| CRM_TEST_DATA_SETUP.sql | - | - | - | 10분 |
| **합계** | **2,395** | **72KB** | **105분** | **3시간** |

---

## ✅ 품질 보증 기준

### Tier 1: CRITICAL (필수)
```
□ 모든 사용자 역할 로그인 성공
□ RBAC 권한 제어 정상
□ Contact CRUD API 작동
□ CruiseDot Webhook 처리
□ 페이지 로딩 3초 이내
```

### Tier 2: HIGH (권장)
```
□ Lighthouse 점수 > 85
□ API 응답 < 200ms
□ 데이터 무결성 검증
□ N+1 쿼리 제거
```

### Tier 3: MEDIUM (개선)
```
□ 코드 커버리지 > 70%
□ 메모리 누수 없음
□ 동시 요청 처리 100%
```

---

## 📞 문서 관련 문의

### 테스트 계획 관련
- 문서: CRM_CONNECTION_TEST_PLAN.md
- 질문: "테스트 전체 전략을 알고 싶다"
- 담당: 테스트 리더, PM

### 테스트 케이스 상세
- 문서: CRM_CONNECTION_DETAILED_TEST_CASES.md
- 질문: "TC-001은 어떻게 실행하나?"
- 담당: QA, 테스트 엔지니어

### 빠른 실행 방법
- 문서: CRM_TEST_EXECUTION_QUICK_START.md
- 질문: "지금 당장 테스트를 시작하려면?"
- 담당: 테스트 엔지니어

### 핵심 요약
- 문서: CRM_TEST_SUMMARY.md
- 질문: "테스트의 핵심이 뭐야?"
- 담당: 모든 팀

### 데이터 준비
- 문서: CRM_TEST_DATA_SETUP.sql
- 질문: "테스트 데이터를 어떻게 만들지?"
- 담당: DBA, 테스트 엔지니어

---

## 🔗 관련 파일 참고

### 소스 코드
```
D:\mabiz-crm\src\middleware.ts          # 인증/권한 미들웨어
D:\mabiz-crm\src\lib\route-rules.ts      # 경로 규칙
D:\mabiz-crm\src\lib\auth.ts             # 세션 관리
D:\mabiz-crm\prisma\schema.prisma        # DB 스키마
```

### 기존 문서
```
D:\mabiz-crm\CLAUDE.md                   # 에이전트 지시서
D:\mabiz-crm\AGENTS.md                   # Next.js 기본 규칙
```

---

## 📅 예상 일정

### Day 1 (2026-05-26)
```
09:00 ~ 09:30  CRM_TEST_SUMMARY.md 읽기
09:30 ~ 10:00  CRM_CONNECTION_TEST_PLAN.md 읽기
10:00 ~ 10:15  환경 준비
10:15 ~ 11:15  자동화 테스트
11:15 ~ 12:30  수동 E2E 테스트 (Admin)
```

### Day 2 (2026-05-27)
```
09:00 ~ 10:00  수동 E2E 테스트 (Manager/Sales)
10:00 ~ 11:00  CruiseDot API 테스트
11:00 ~ 12:00  성능 테스트
13:00 ~ 14:00  문제 해결 및 재테스트
14:00 ~ 15:00  결과 정리
```

---

## 🎯 최종 체크리스트

테스트 시작 전에 확인:
```
□ 모든 5개 문서 다운로드됨
□ CRM_TEST_DATA_SETUP.sql 준비됨
□ Clerk 테스트 계정 생성됨
□ Neon DB 연결 가능함
□ 개발 환경 구성됨
□ 테스트 팀 구성됨
```

테스트 시작:
```
1. CRM_TEST_EXECUTION_QUICK_START.md 열기
2. Step 1~6 순차 실행
3. 각 단계마다 체크리스트 확인
4. 실패 항목 GitHub Issue로 등록
```

테스트 완료:
```
□ 모든 Phase 완료
□ 테스트 결과 리포팅
□ 실패 이슈 해결
□ 최종 승인 획득
```

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0  
**상태**: ✅ 완성 및 배포 준비 완료

---

**💡 팁**: 이 파일(CRM_TEST_PLAN_INDEX.md)을 북마크하면 나중에 원하는 문서를 빠르게 찾을 수 있습니다.

