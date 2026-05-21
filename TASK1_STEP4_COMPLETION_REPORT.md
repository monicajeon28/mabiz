# Task 1 Step 4 완료 보고서

**에이전트:** γ (검증 쿼리 작성 담당)  
**작성일:** 2026-05-21  
**작업명:** Contact userId 정정 작업 — 최종 검증 쿼리 작성 및 실행 가이드  
**상태:** ✅ 완료 (프로덕션 실행 준비 완료)

---

## 📋 작업 개요

### 목표
Step 5 검증을 위한 SQL 검증 쿼리 작성 및 프로덕션 DB 실행 순서 가이드 문서 완성

### 배경
Contact 테이블의 userId 데이터 정합성 확보를 위해 Phase 1(현황 분석) → Phase 2(테스트) → Phase 3(준비) → **Phase 4(실행)** 진행 중

**현재 위치:** Phase 4 - Step 4 검증 쿼리 작성 완료 → Step 5 프로덕션 실행 대기

---

## ✅ 성과물 (3개 파일)

### 1️⃣ TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql (7.2KB)

**목적:** Contact userId 정정 작업의 3단계 검증 쿼리 모음

**구성:**

| 단계 | 목적 | 쿼리 개수 | 실행 시기 | 주요 기능 |
|-----|------|---------|---------|---------|
| **단계 1** | 데이터 정정 **전** 상태 수집 (베이스라인) | 5개 | SCRIPT 실행 전 | orphaned, duplicate, calllog, inconsistent, 통계 |
| **단계 2** | SCRIPT 1/2/3 순차 실행 후 상태 | 4개 | 각 SCRIPT 후 | 영향도 확인, FK 검증 |
| **단계 3** | FK 무결성 최종 검증 (정정 후) | 7개 | 모든 SCRIPT 후 | orphaned/duplicate/inconsistent 0 확인 |
| **추가** | 성능 확인 + 디버깅 | 6개 | 필요시 | 인덱스, 테이블 크기, 문제 조사 |

**총 22개 검증 쿼리 포함**

**특징:**
- ✅ 모든 쿼리가 읽기 전용 (안전)
- ✅ 단계별 명확한 목적 기술
- ✅ 예상 결과값 주석 포함
- ✅ 성공 조건 명시 (Count = 0 필수)
- ✅ 디버깅용 추가 쿼리 포함

**사용법:**
```
Neon SQL Editor에서 순서대로 실행
→ 결과를 스프레드시트 또는 TASK1_STEP4_EXECUTION_GUIDE.md에 기록
```

---

### 2️⃣ TASK1_STEP4_EXECUTION_GUIDE.md (13.8KB)

**목적:** 프로덕션 DB에서 정정 작업을 실행하는 상세 단계별 지침

**구성:**

#### A. 실행 순서 가이드 (Flow Chart)
```
1단계: Before 데이터 수집 (1-2분)
  ↓
2단계: SCRIPT 1 실행 (1-2분) + 검증
  ↓
2단계: SCRIPT 2 실행 (5-10분) + FK 검증
  ↓
2단계: SCRIPT 3 실행 (2-3분) + 일관성 검증
  ↓
3단계: Final 검증 쿼리 (2-3분)
  ↓
4단계: Git 커밋 (5분)

총: 18-35분 (데이터 규모에 따라 변동)
```

#### B. 단계별 상세 지침
- **2-A: Pre-Flight 체크** (실행 1시간 전)
  - 백업 수행
  - 애플리케이션 상태 확인
  - 팀 및 경영진 대기

- **2-B: Step 1 (Before)** — 5개 쿼리 실행 및 기록
  - 1-1: 고아 Contact 개수
  - 1-2: 중복 Contact 개수
  - 1-3: CallLog 영향도
  - 1-4: 다중 userId 개수
  - 1-5: 전체 통계

- **2-C: SCRIPT 1** — 고아 Contact 정정
  - BEGIN TRANSACTION
  - UPDATE "Contact" (userId = NULL)
  - 결과 확인 (rows_updated)
  - COMMIT 또는 ROLLBACK

- **2-D: SCRIPT 2** — 중복 Contact 병합
  - CREATE TEMP TABLE duplicate_contacts
  - UPDATE "Contact" (soft delete)
  - UPDATE "CallLog" (FK 재지정)
  - CallLog FK 검증

- **2-E: SCRIPT 3** — 다중 userId 표준화
  - CREATE TEMP TABLE latest_user_ids
  - UPDATE "Contact" (userId 표준화)
  - 일관성 재확인

- **2-F: Final 검증** — 7개 검증 쿼리
  - 3-1: orphaned_contacts_final = 0 ✓
  - 3-2: duplicate_phones_final = 0 ✓
  - 3-3: inconsistent_userids_final = 0 ✓
  - 3-4: orphaned_calllogs_final = 0 ✓
  - 3-5: 최종 통계
  - 3-6: 성능 지표
  - 3-7: Before/After 비교

#### C. 검증 쿼리 매핑 (8x4 테이블)
분석 쿼리 ↔ SCRIPT ↔ 검증 쿼리의 연결 관계 명시

#### D. 예상 실행 시간

| 시나리오 | Contact 규모 | 고아/중복/불일치 | 예상 시간 |
|---------|----------|-----------------|---------|
| **A: 소규모** | < 1,000 | 0-10 / 0-5 / 0-3 | 5-8분 |
| **B: 중규모** | 1K-10K | 10-100 / 5-30 / 3-15 | 13-20분 |
| **C: 대규모** | > 10,000 | 100+ / 30+ / 15+ | 22-40분 |

#### E. 모니터링 & 롤백

**모니터링:**
- 연결 상태 확인 (active_connections)
- 테이블 잠금 상태 (lock count)

**롤백 절차:**
- Case 1: SCRIPT 중 오류 → ROLLBACK (< 1초)
- Case 2: SCRIPT 완료 후 문제 → 백업 복구 (5-10분)
- Case 3: 성능 저하 → 인덱스 재구성 (2-5분)

#### F. 최종 체크리스트 (30항목)

| 단계 | 체크사항 | 기록란 |
|-----|---------|-------|
| Pre-Execution | 백업, 애플리케이션 상태, 팀 연락처 | - |
| Step 1 | 5개 Before 쿼리 결과 | __________ |
| Step 2 | SCRIPT 1-3 실행 결과 | __________ |
| Step 3 | Final 검증 (모두 0 필수) | __________ |
| Post | 스모크 테스트, Git 커밋 | - |

**특징:**
- ✅ 완전한 단계별 지침 (초보자도 따라할 수 있음)
- ✅ 각 단계에서 기록해야 할 수치 명시
- ✅ SQL 코드 제공 (복사/붙여넣기 가능)
- ✅ 예상 시간 및 결과값 제시
- ✅ 롤백 절차 상세 기술
- ✅ 모니터링 방법 제공

---

### 3️⃣ TASK1_STEP4_COMPLETION_REPORT.md (이 파일)

**목적:** Step 4 작업 완료를 문서화하고 Step 5 진행을 위한 준비 상태 보고

**포함 내용:**
- 작업 개요 및 배경
- 성과물 3개 파일 상세 설명
- 검증 전략 및 성공 기준
- 예상 위험 및 대응 방안
- 다음 단계 (Step 5) 준비 상태

---

## 🎯 검증 전략 및 성공 기준

### 검증 3단계 전략

#### Stage 1: Baseline (정정 전)
**목적:** 정정 효과를 측정할 기준선 설정

**수집 데이터:**
```
orphaned_contacts_before         = A건
duplicate_groups_before          = B개
calllog_affected_before          = C건
inconsistent_userid_before       = D개
total_active_before              = E건
userId_rate_before               = F%
```

**검증:**
- A > 0이면 SCRIPT 1 필요
- B > 0이면 SCRIPT 2 필요
- D > 0이면 SCRIPT 3 필요

---

#### Stage 2: Intermediate (각 SCRIPT 후)
**목적:** 각 정정 SCRIPT의 영향도 확인 및 부작용 감지

**확인 항목:**

| SCRIPT | 확인 쿼리 | 성공 조건 |
|--------|---------|---------|
| 1 | rows_updated | = A (고아 Contact 개수) |
| 2 | duplicates_removed | = B (중복 그룹 수) |
| 2 | orphaned_logs | = 0 (CallLog FK 무결성) |
| 3 | user_id_standardized | ≥ 0 (표준화된 건수) |
| 3 | inconsistent_groups | = 0 (모두 정정됨) |

---

#### Stage 3: Final (모든 SCRIPT 후)
**목적:** 최종 FK 무결성 및 데이터 일관성 보증

**필수 검증 (모두 0이어야 함):**
```
orphaned_contacts_final          = 0 ✓
duplicate_phones_final           = 0 ✓
inconsistent_userids_final       = 0 ✓
orphaned_calllogs_final          = 0 ✓
orphaned_group_members_final     = 0 ✓
```

**추가 검증:**
```
total_active_final               = E (또는 E - 중복된 Contact)
userId_rate_final                ≥ F% (또는 상향)
latest_update                    = 정정 실행 시간
```

---

### 성공 기준

| 조건 | 상태 | 의미 |
|-----|------|------|
| **orphaned = 0** | ✅ REQUIRED | FK 무결성 보증 |
| **duplicate = 0** | ✅ REQUIRED | 데이터 유일성 보증 |
| **inconsistent = 0** | ✅ REQUIRED | userId 일관성 보증 |
| **orphaned_logs = 0** | ✅ REQUIRED | CallLog FK 무결성 |
| **userId_rate ≥ Before** | ⚠️ EXPECTED | userId 설정률 유지 이상 |
| **모든 SCRIPT COMMIT** | ✅ REQUIRED | 변경사항 영구 반영 |

**최종 판정:** 모든 ✅ REQUIRED 조건 충족 → **Step 5 진행 가능**

---

## 🚨 예상 위험 및 대응 방안

### 위험 1: SCRIPT 실행 중 Timeout
**원인:** 대규모 데이터 업데이트
**신호:** "Connection timeout" 또는 "Query cancelled"
**대응:**
```sql
-- 1. ROLLBACK 즉시 실행
ROLLBACK;

-- 2. 데이터 규모 확인
SELECT COUNT(*) FROM "Contact";

-- 3. 배치 처리로 재시도 (필요시)
-- LIMIT 1000 단위로 UPDATE
```
**소요 시간:** 1-2분

---

### 위험 2: CallLog FK 위반
**원인:** SCRIPT 2 실행 중 CallLog 재지정 실패
**신호:** "Foreign key constraint violation" 또는 "orphaned_logs_after > 0"
**대응:**
```sql
-- 1. 영향받은 CallLog 조사
SELECT c.id, c.phone, c."organizationId", COUNT(*) as calllog_count
FROM "CallLog" cl
LEFT JOIN "Contact" c ON cl."contactId" = c.id
WHERE c.id IS NULL
GROUP BY c.id, c.phone, c."organizationId";

-- 2. 고아 Contact 찾기
SELECT * FROM "Contact" 
WHERE id IN (SELECT "contactId" FROM "CallLog");

-- 3. 백업에서 복구
ROLLBACK;
```
**소요 시간:** 2-5분

---

### 위험 3: 예상과 다른 정정 결과
**원인:** 데이터 상태가 가정과 다름
**신호:** "rows_updated ≠ orphaned_contacts_before"
**대응:**
```sql
-- 1. 상세 조사
SELECT * FROM "Contact"
WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" WHERE "userId" = c."userId"
  );

-- 2. 정정 전 상태 재확인
-- TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql 1-1 재실행

-- 3. 필요시 ROLLBACK 후 재계획
ROLLBACK;
```
**소요 시간:** 3-10분

---

### 위험 4: 성능 저하 (DB 느려짐)
**원인:** 대규모 UPDATE로 인한 I/O 증가
**신호:** "Query execution time > 5분" 또는 "DB CPU > 80%"
**대응:**
```sql
-- 1. 현재 상태 확인
SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';

-- 2. 느린 쿼리 조사
SELECT query, query_start FROM pg_stat_activity 
WHERE state = 'active'
ORDER BY query_start ASC;

-- 3. 필요시 CANCEL
SELECT pg_cancel_backend(pid);

-- 4. ROLLBACK 및 재계획
ROLLBACK;

-- 5. 배치 처리로 분할 실행 검토
```
**소요 시간:** 5-15분

---

### 위험 5: 네트워크 끊김
**원인:** 장시간 실행 중 연결 중단
**신호:** "Connection reset by peer"
**대응:**
```
-- 1. 즉시 재연결 (Neon 콘솔 다시 접속)

-- 2. Transaction 상태 확인
SELECT * FROM pg_stat_activity;

-- 3. 미완료 Transaction이 있으면 ROLLBACK
-- (또는 자동 rollback됨, 일반적으로 15분 타임아웃)

-- 4. 재실행 전 Before 데이터 재수집
-- TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql 1-1 ~ 1-5
```
**소요 시간:** 1-3분

---

## 📊 데이터 규모 기반 예상

### 시나리오별 분석

#### 현재 데이터 규모 (추정)

기존 문서 기반 추정:

```
Contact 테이블:
  - 활성 Contact: ~2,000-5,000건 (추정)
  - userId 설정률: ~60-80% (추정)
  - 중복 그룹: ~5-15개 (추정)
  - 고아 Contact: ~1-5건 (추정)
  - 불일치 그룹: ~1-3개 (추정)

CallLog 테이블:
  - 총 레코드: ~10,000-50,000건 (추정)
  - 중복 Contact 영향: ~100-500건 (추정)

→ 시나리오 B (중규모): 예상 시간 13-20분
```

**최종 확인:** Before 단계의 1-1 ~ 1-5 쿼리 결과로 재판단

---

## ✨ 특별한 고려사항

### A. Contact.userId의 의미

```
타입: Int (nullable)
값: 크루즈닷몰 회원 ID
관계: GoldMember.userId (1:N)
마이그레이션 의미: Contact → GoldMember 업그레이드 추적

상태별 의미:
  - NOT NULL: GoldMember 관계 있음 (활성 고객)
  - NULL: GoldMember 관계 없음 (잠재 고객)
```

### B. Soft Delete의 이유

중복 Contact를 완전히 삭제하지 않고 soft delete(deletedAt 설정)하는 이유:

```
1. 이력 보존
   - 과거 Call 기록 추적 가능
   - 고객 구매 이력 유지

2. 되돌리기 가능
   - 필요시 deletedAt = NULL로 복구
   - 실수 대응 용이

3. 감사 추적 (Audit Trail)
   - who/when/what 기록
   - 규정 준수 (GDPR 등)
```

### C. CallLog FK 재지정 전략

```
삭제 Contact의 CallLog를 어느 Contact로 재지정할 것인가?

선택: phone + org별 최신 Contact (updatedAt DESC)

이유:
  1. 같은 고객의 최신 정보 유지
  2. 최신 Contact가 대표성 가짐
  3. 조회 일관성 확보
```

---

## 📈 Step 4 → Step 5 전환 준비

### Step 4 완료 조건 ✅

- [x] 최종 검증 쿼리 3단계 작성 완료
- [x] 프로덕션 실행 순서 가이드 문서 작성 완료
- [x] 예상 실행 시간 산정 완료
- [x] 위험 분석 및 대응 방안 수립 완료
- [x] 성공 기준 명시 완료

### Step 5 진행 조건 ✅

다음 조건이 충족되면 Step 5(프로덕션 실행) 진행 가능:

1. **사용자 승인** (필수)
   - [ ] 분석 결과 검토 완료
   - [ ] 정정 계획 동의
   - [ ] 위험 인수

2. **팀 준비** (필수)
   - [ ] 개발팀 대기 가능 (실행 시간)
   - [ ] 운영팀 모니터링 준비
   - [ ] 롤백 계획 수립

3. **기술 준비** (필수)
   - [ ] 백업 스크립트 준비
   - [ ] Neon 콘솔 접속 확인
   - [ ] 긴급 연락처 확보

4. **문서 준비** (필수)
   - [x] 검증 쿼리 (TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql)
   - [x] 실행 가이드 (TASK1_STEP4_EXECUTION_GUIDE.md)
   - [x] 체크리스트 (CONTACT_USERID_MIGRATION_CHECKLIST.md)

---

## 📝 Git 커밋 예약

Step 4 완료 후 즉시 커밋 예정:

```bash
git add \
  TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql \
  TASK1_STEP4_EXECUTION_GUIDE.md \
  TASK1_STEP4_COMPLETION_REPORT.md

git commit -m "docs(task1-step4): Contact userId 정정 작업 — 최종 검증 준비 완료

성과물:
- TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql (22개 검증 쿼리)
  ├─ 단계 1: Before 데이터 수집 (5개)
  ├─ 단계 2: SCRIPT 후 상태 확인 (4개)
  ├─ 단계 3: Final FK 무결성 검증 (7개)
  └─ 추가: 성능/디버깅 쿼리 (6개)

- TASK1_STEP4_EXECUTION_GUIDE.md (상세 실행 가이드)
  ├─ 전체 Flow Chart (18-35분)
  ├─ 단계별 상세 지침 (2-A to 2-F)
  ├─ 검증 쿼리 매핑 (분석 ↔ SCRIPT ↔ 검증)
  ├─ 예상 실행 시간 (시나리오 A/B/C)
  ├─ 모니터링 & 롤백 절차
  └─ 최종 체크리스트 (30항목)

검증 전략:
- Stage 1: Baseline (정정 전 현황)
- Stage 2: Intermediate (각 SCRIPT 영향도)
- Stage 3: Final (FK 무결성 보증)

성공 기준:
- orphaned = 0 ✓
- duplicate = 0 ✓
- inconsistent = 0 ✓
- orphaned_logs = 0 ✓

위험 분석:
- 5가지 예상 위험 + 대응 방안 수립
- 데이터 규모별 예상 시간 산정
- 롤백 절차 상세 기술

다음: Step 5 프로덕션 실행 (사용자 승인 후)"
```

---

## 📞 담당자 정보

| 역할 | 담당자 | 연락처 |
|-----|--------|--------|
| 검증 쿼리 작성 | Agent γ | - |
| 실행 가이드 작성 | Agent γ | - |
| 프로덕션 실행 | [사용자] | [TBD] |
| 모니터링 | [운영팀] | [TBD] |
| 롤백 담당 | [기술팀] | [TBD] |

---

## 🎓 교훈 & 예방방안

### 배운 점

1. **단계별 검증의 중요성**
   - Before/After/Final 3단계는 필수
   - 중간 검증으로 부작용 조기 감지

2. **예상 시간 산정**
   - 데이터 규모에 따라 큰 차이
   - 최악의 경우를 고려한 계획 필수

3. **롤백 준비**
   - 모든 단계에서 ROLLBACK 가능
   - 백업은 필수, 선택사항 아님

### 예방방안

**향후 유사한 마이그레이션 작업 시:**

1. 단계별 검증 체크리스트 미리 준비
2. 예상 시간 및 위험 문서화
3. 롤백 절차 사전 테스트
4. 팀 교육 및 리허설
5. 모니터링 도구 준비

---

## ✅ 최종 확인

### Step 4 완료도

| 항목 | 상태 | 비고 |
|-----|------|------|
| 검증 쿼리 3단계 작성 | ✅ | 22개 쿼리 완성 |
| 실행 순서 가이드 | ✅ | 상세 지침 완성 |
| 예상 실행 시간 | ✅ | 3가지 시나리오 |
| 모니터링 절차 | ✅ | 연결/잠금 확인 |
| 롤백 절차 | ✅ | 5가지 케이스 |
| 체크리스트 | ✅ | 30항목 준비 |
| 위험 분석 | ✅ | 5가지 위험 대응 |
| 성공 기준 | ✅ | 명확하게 정의 |

**최종 상태:** ✅ **Step 4 완료, Step 5 진행 준비 완료**

---

## 📚 관련 문서

**Task 1 전체 구조:**

```
Task 1: Contact userId 마이그레이션 전 정정 작업
├─ Phase 1: 현황 분석
│   └─ contact_userId_analysis.sql (10개 분석 쿼리)
│   └─ CONTACT_USERID_ANALYSIS_SUMMARY.md
│   └─ CONTACT_USERID_ANALYSIS_REPORT.md
│
├─ Phase 2: 개발 환경 테스트
│   └─ contact_userId_cleanup_scripts.sql (3개 SCRIPT)
│   └─ CONTACT_USERID_MIGRATION_CHECKLIST.md
│
├─ Phase 3: 프로덕션 준비
│   └─ [사용자 승인 & 팀 준비]
│
├─ Phase 4: 프로덕션 실행 ← **현재 위치 (Step 4)**
│   ├─ Step 4: 최종 검증 쿼리 작성 ✅ (완료)
│   │   └─ TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql
│   │   └─ TASK1_STEP4_EXECUTION_GUIDE.md
│   │   └─ TASK1_STEP4_COMPLETION_REPORT.md
│   │
│   └─ Step 5: 프로덕션 실행 ⏳ (다음)
│       ├─ Before 데이터 수집 (1-5 쿼리)
│       ├─ SCRIPT 1 실행 (고아 정정)
│       ├─ SCRIPT 2 실행 (중복 병합)
│       ├─ SCRIPT 3 실행 (userId 표준화)
│       ├─ Final 검증 (3-1 ~ 3-7 쿼리)
│       └─ Git 커밋
│
└─ Phase 5: 문서화 & 회고
    └─ 실행 리포트 작성
    └─ 팀 회고
```

---

**작성:** Agent γ (2026-05-21)  
**상태:** ✅ 완료  
**검토:** [대기]  
**승인:** [대기]  
**다음:** Step 5 프로덕션 실행 (사용자 승인 후)

