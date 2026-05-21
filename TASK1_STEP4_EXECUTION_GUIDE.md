# Task 1 Step 4: Contact userId 정정 작업 — 최종 검증 실행 가이드

**작성:** Agent γ (2026-05-21)  
**목표:** Step 5 검증을 위한 SQL 검증 쿼리 작성 및 프로덕션 DB 실행 순서 가이드  
**상태:** 프로덕션 실행 준비 완료 (SQL 실행은 사용자 승인 후)

---

## 📋 목차

1. [실행 순서 가이드 (전체 플로우)](#1-실행-순서-가이드)
2. [단계별 상세 지침](#2-단계별-상세-지침)
3. [검증 쿼리 매핑](#3-검증-쿼리-매핑)
4. [예상 실행 시간](#4-예상-실행-시간)
5. [모니터링 & 롤백](#5-모니터링--롤백)
6. [체크리스트](#6-최종-체크리스트)

---

## 1. 실행 순서 가이드

### 전체 Flow (프로덕션 DB)

```
┌─────────────────────────────────────────────────────────┐
│ 1단계: 데이터 정정 "전" 상태 수집 (베이스라인)            │
│ └─ 단계 1-1 ~ 1-5 쿼리 실행 (읽기 전용)                  │
│    예상 시간: 1-2분                                      │
│    저장: 스프레드시트 또는 파일                            │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│ 2단계: 정정 SCRIPT 순차 실행                             │
│                                                          │
│ Step 2-A: SCRIPT 1 실행 (고아 Contact 정정)             │
│ └─ BEGIN TRANSACTION                                    │
│    ├─ UPDATE "Contact" (userId → NULL)                 │
│    ├─ 결과 확인 (rows_updated)                          │
│    └─ COMMIT                                            │
│    예상 시간: 1-2분                                      │
│                                                          │
│ Step 2-B: SCRIPT 2 실행 (중복 Contact 병합)             │
│ └─ BEGIN TRANSACTION                                    │
│    ├─ CREATE TEMP TABLE duplicate_contacts              │
│    ├─ UPDATE "Contact" (soft delete)                    │
│    ├─ UPDATE "CallLog" (FK 재지정)                      │
│    └─ COMMIT                                            │
│    예상 시간: 5-10분                                     │
│                                                          │
│ Step 2-C: SCRIPT 3 실행 (다중 userId 표준화)            │
│ └─ BEGIN TRANSACTION                                    │
│    ├─ CREATE TEMP TABLE latest_user_ids                │
│    ├─ UPDATE "Contact" (userId 표준화)                  │
│    └─ COMMIT                                            │
│    예상 시간: 2-3분                                      │
│                                                          │
│ Total: 8-15분                                            │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│ 3단계: SCRIPT 4 검증 쿼리 (최종 상태 확인)              │
│ └─ 단계 3-1 ~ 3-7 쿼리 실행 (읽기 전용)                 │
│    예상 시간: 2-3분                                      │
│    저장: 검증 결과 리포트                                 │
│    ⚠️ 중요: orphaned_contacts_final = 0 확인            │
│    ⚠️ 중요: duplicate_phones_final = 0 확인             │
│    ⚠️ 중요: inconsistent_userids_final = 0 확인         │
│    ⚠️ 중요: orphaned_calllogs_final = 0 확인            │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│ 4단계: 최종 정리 & 커밋                                  │
│ └─ Git 커밋 (검증 결과 문서화)                           │
│    └─ commit message: "fix(db): Contact userId 정정     │
│                       완료 (orphaned/duplicate/          │
│                       inconsistent 0건)"               │
│    예상 시간: 5분                                        │
└─────────────────────────────────────────────────────────┘
```

**총 소요 시간: 18-35분 (데이터 규모에 따라 변동)**

---

## 2. 단계별 상세 지침

### 2-A. Pre-Flight 체크 (실행 1시간 전)

실행 전 필수 확인 사항:

```markdown
## ☑️ Pre-Flight 체크리스트

- [ ] 백업 완료
  ```bash
  pg_dump -h ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech \
    -U neondb_owner -d neondb \
    > backup_before_contact_cleanup_$(date +%Y%m%d_%H%M%S).sql
  echo "Backup file: backup_before_contact_cleanup_*.sql"
  ```

- [ ] 애플리케이션 상태 확인
  - CRM 웹 UI 접속 가능?
  - API 응답 정상?
  - Contact 목록 조회 가능?

- [ ] 팀 및 경영진 대기 (긴급 연락처 확보)
  - 개발팀: 재연성
  - 운영팀: 모니터링
  - 경영진: 승인

- [ ] Neon 콘솔 준비
  - SQL Editor 접속 가능?
  - 데이터베이스 선택 확인?
```

### 2-B. Step 1: 데이터 정정 "전" 상태 수집

**실행 시각:** [시작 시간 기록]

Neon SQL Editor에서 다음을 순서대로 실행:

#### 1-1. 고아 Contact 개수
```sql
-- QUERY: 고아 Contact 개수 (정정 전)
SELECT COUNT(*) as orphaned_contacts_before
FROM "Contact" c
WHERE c."userId" IS NOT NULL
  AND c."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
  );
```

**기록:**
```
orphaned_contacts_before: __________ 건
```

**분석:**
- 0건: 이미 정정된 상태
- 1-100건: 정상 범위 (SCRIPT 1 실행 후 userId = NULL로 변경)
- 100+건: 대량 정정 (모니터링 주의)

---

#### 1-2. 중복 Contact 개수
```sql
-- QUERY: 중복 Contact 개수 (정정 전)
SELECT COUNT(*) as duplicate_groups_before
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(*) > 1
) t;
```

**기록:**
```
duplicate_groups_before: __________ 개
```

**분석:**
- 0개: 이미 정정된 상태
- 1-50개: 정상 범위 (SCRIPT 2 실행 후 soft delete)
- 50+개: 대량 정정 (시간 주의)

---

#### 1-3. CallLog 영향도
```sql
-- QUERY: 중복 Contact에 영향받는 CallLog
SELECT COUNT(*) as calllog_affected_before
FROM "CallLog" cl
WHERE EXISTS (
  SELECT 1 FROM "Contact" c
  WHERE c.id = cl."contactId"
    AND c."deletedAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM (
        SELECT phone, "organizationId"
        FROM "Contact"
        WHERE "deletedAt" IS NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(*) > 1
      ) t
      WHERE t.phone = c.phone
        AND t."organizationId" = c."organizationId"
    )
);
```

**기록:**
```
calllog_affected_before: __________ 건
```

**분석:**
- SCRIPT 2 실행 후에도 이 개수가 동일해야 함
- FK 무결성 검증에 사용

---

#### 1-4. 다중 userId 개수
```sql
-- QUERY: 다중 userId 그룹 (정정 전)
SELECT COUNT(*) as inconsistent_userid_groups_before
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(DISTINCT "userId") > 1
) t;
```

**기록:**
```
inconsistent_userid_groups_before: __________ 개
```

**분석:**
- 0개: 이미 정정된 상태
- 1-20개: 정상 범위 (SCRIPT 3 실행 후 0이 되어야 함)
- 20+개: 데이터 정합성 주의

---

#### 1-5. 전체 통계
```sql
-- QUERY: 전체 Contact 통계 (정정 전)
SELECT
  COUNT(*) as total_active_before,
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userId_before,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userId_before,
  COUNT(DISTINCT phone) as unique_phones_before,
  ROUND(100.0 * COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) / COUNT(*), 2) as userId_rate_before
FROM "Contact"
WHERE "deletedAt" IS NULL;
```

**기록:**
```
total_active_before:    __________ 건
with_userId_before:     __________ 건 (____%)
without_userId_before:  __________ 건 (____%)
unique_phones_before:   __________ 개
userId_rate_before:     ____%
```

**분석:**
- userId_rate_before를 기준선으로 설정
- 정정 후 이 비율이 상향되면 정상

---

### 2-C. Step 2: SCRIPT 1 실행 및 검증

**실행 시각:** [시간 기록]

#### SCRIPT 1: 고아 Contact 정정

Neon SQL Editor에서:

```sql
BEGIN TRANSACTION;

UPDATE "Contact"
SET
  "userId" = NULL,
  "updatedAt" = NOW()
WHERE "userId" IS NOT NULL
  AND "deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
  );

-- 결과 확인
SELECT COUNT(*) as rows_updated FROM "Contact"
WHERE "userId" IS NULL
  AND "updatedAt" >= NOW() - INTERVAL '1 minute';

-- 확인 후:
COMMIT;  -- 또는 ROLLBACK;
```

**체크:**
- [ ] rows_updated 확인
  ```
  rows_updated: __________ 건
  (orphaned_contacts_before와 같아야 함)
  ```
- [ ] 외래키 제약 조건 위반 없음
- [ ] Contact.name, Contact.phone 보존됨 (확인)
  ```sql
  SELECT COUNT(DISTINCT "name") FROM "Contact" WHERE "userId" IS NULL;
  ```

**완료 시각:** [시간 기록]

---

### 2-D. Step 3: SCRIPT 2 실행 및 검증

**실행 시각:** [시간 기록]

#### SCRIPT 2: 중복 Contact 병합

```sql
BEGIN TRANSACTION;

-- Step 1: 중복 그룹별 대표 Contact 선정
CREATE TEMP TABLE duplicate_contacts AS
SELECT
  c.id,
  c.phone,
  c."organizationId",
  ROW_NUMBER() OVER (PARTITION BY c.phone, c."organizationId" ORDER BY c."updatedAt" DESC) as rn
FROM "Contact" c
WHERE c."deletedAt" IS NULL;

-- Step 2: 대표가 아닌 Contact soft delete
UPDATE "Contact" c
SET "deletedAt" = NOW(), "updatedAt" = NOW()
WHERE c.id IN (
  SELECT id FROM duplicate_contacts WHERE rn > 1
);

-- Step 3: 삭제된 Contact와 연결된 CallLog를 대표 Contact로 재지정
UPDATE "CallLog" cl
SET
  "contactId" = (
    SELECT c2.id
    FROM "Contact" c2
    WHERE c2.phone = c1.phone
      AND c2."organizationId" = c1."organizationId"
      AND c2."deletedAt" IS NULL
    ORDER BY c2."updatedAt" DESC
    LIMIT 1
  ),
  "updatedAt" = NOW()
FROM "Contact" c1
WHERE cl."contactId" = c1.id
  AND c1."deletedAt" = NOW()::date;

-- 결과 확인
SELECT COUNT(*) as duplicates_removed FROM "Contact"
WHERE "deletedAt" >= NOW() - INTERVAL '1 minute';

-- 확인 후:
COMMIT;  -- 또는 ROLLBACK;
```

**체크:**
- [ ] duplicates_removed 확인
  ```
  duplicates_removed: __________ 건
  (duplicate_groups_before와 같아야 함)
  ```
- [ ] CallLog FK 무결성 검증
  ```sql
  SELECT COUNT(*) as orphaned_logs
  FROM "CallLog" cl
  WHERE NOT EXISTS (
    SELECT 1 FROM "Contact" c WHERE c.id = cl."contactId"
  );
  -- 결과: 0 (필수)
  ```

**완료 시각:** [시간 기록]

---

### 2-E. Step 4: SCRIPT 3 실행 및 검증

**실행 시각:** [시간 기록]

#### SCRIPT 3: 다중 userId 표준화

```sql
BEGIN TRANSACTION;

-- phone+org별로 최신 userId 찾기
CREATE TEMP TABLE latest_user_ids AS
SELECT
  phone,
  "organizationId",
  (ARRAY_AGG("userId" ORDER BY "updatedAt" DESC))[1] as latest_userId
FROM "Contact"
WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
GROUP BY phone, "organizationId";

-- 해당 phone의 모든 Contact를 최신 userId로 일치시키기
UPDATE "Contact" c
SET
  "userId" = lui."latest_userId",
  "updatedAt" = NOW()
FROM latest_user_ids lui
WHERE c.phone = lui.phone
  AND c."organizationId" = lui."organizationId"
  AND c."deletedAt" IS NULL
  AND c."userId" != lui."latest_userId";

-- 결과 확인
SELECT COUNT(*) as user_id_standardized FROM "Contact"
WHERE "updatedAt" >= NOW() - INTERVAL '1 minute';

-- 확인 후:
COMMIT;  -- 또는 ROLLBACK;
```

**체크:**
- [ ] user_id_standardized 확인
  ```
  user_id_standardized: __________ 건
  ```
- [ ] userId 일관성 재확인
  ```sql
  SELECT COUNT(*) as inconsistencies
  FROM (
    SELECT phone, "organizationId"
    FROM "Contact"
    WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
    GROUP BY phone, "organizationId"
    HAVING COUNT(DISTINCT "userId") > 1
  ) t;
  -- 결과: 0 (필수)
  ```

**완료 시각:** [시간 기록]

---

### 2-F. Step 5: 최종 검증 쿼리

**실행 시각:** [시간 기록]

#### 3-1. orphaned_contacts_final

```sql
SELECT COUNT(*) as orphaned_contacts_final
FROM "Contact" c
WHERE c."userId" IS NOT NULL
  AND c."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
  );
```

**결과:** __________ 건 ✓ (반드시 0)

---

#### 3-2. duplicate_phones_final

```sql
SELECT COUNT(*) as duplicate_phones_final
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(*) > 1
) t;
```

**결과:** __________ 개 ✓ (반드시 0)

---

#### 3-3. inconsistent_userids_final

```sql
SELECT COUNT(*) as inconsistent_userids_final
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(DISTINCT "userId") > 1
) t;
```

**결과:** __________ 개 ✓ (반드시 0)

---

#### 3-4. orphaned_calllogs_final

```sql
SELECT COUNT(*) as orphaned_calllogs_final
FROM "CallLog" cl
WHERE NOT EXISTS (
  SELECT 1 FROM "Contact" c
  WHERE c.id = cl."contactId" AND c."deletedAt" IS NULL
);
```

**결과:** __________ 건 ✓ (반드시 0)

---

#### 3-5. 최종 통계

```sql
SELECT
  COUNT(*) as total_active_final,
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userId_final,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userId_final,
  COUNT(DISTINCT phone) as unique_phones_final,
  ROUND(100.0 * COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) / COUNT(*), 2) as userId_rate_final
FROM "Contact"
WHERE "deletedAt" IS NULL;
```

**기록:**
```
total_active_final:    __________ 건
with_userId_final:     __________ 건 (____%)
without_userId_final:  __________ 건 (____%)
unique_phones_final:   __________ 개
userId_rate_final:     ____%
```

**비교:**
```
Before:  total __________ | userId rate ____% | duplicates __________ | inconsistencies __________
After:   total __________ | userId rate ____% | duplicates 0 ✓       | inconsistencies 0 ✓
```

**검증 완료 시각:** [시간 기록]

---

## 3. 검증 쿼리 매핑

### 분석 쿼리 ↔ SCRIPT ↔ 검증 쿼리 매핑

| Phase | 쿼리 파일 | 쿼리 번호 | 설명 | 예상 결과 |
|-------|---------|---------|------|---------|
| **Before** | TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql | 1-1 to 1-5 | 정정 전 현황 수집 | TBD (기록) |
| **SCRIPT 1** | contact_userId_cleanup_scripts.sql | SCRIPT 1 | 고아 Contact 정정 | rows_updated ≥ 0 |
| **After-1** | TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql | 2-1 | SCRIPT 1 후 상태 | userId NULL이 증가 |
| **SCRIPT 2** | contact_userId_cleanup_scripts.sql | SCRIPT 2 | 중복 Contact 병합 | duplicates_removed ≥ 0 |
| **After-2** | TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql | 2-2, 2-3 | SCRIPT 2 후 CallLog FK | orphaned_logs = 0 |
| **SCRIPT 3** | contact_userId_cleanup_scripts.sql | SCRIPT 3 | 다중 userId 표준화 | user_id_standardized ≥ 0 |
| **After-3** | TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql | 2-4 | SCRIPT 3 후 일관성 | inconsistent_groups = 0 |
| **Final** | TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql | 3-1 to 3-7 | 최종 검증 | 모두 0 (필수) |

---

## 4. 예상 실행 시간

### 데이터 규모별 예상 시간

#### 시나리오 A: 소규모 (Contact < 1,000)

```
1단계 (Before): 1분
  ├─ orphaned: 0-10건
  ├─ duplicate_groups: 0-5개
  ├─ calllog_affected: 0-50건
  └─ inconsistent: 0-3개

2단계 (SCRIPT 1-3): 3-5분
  ├─ SCRIPT 1: 1분 (rows < 10)
  ├─ SCRIPT 2: 1분 (groups < 5)
  └─ SCRIPT 3: 1분 (records < 10)

3단계 (Final): 1분
  └─ 모든 검증 쿼리

총: 5-8분
```

#### 시나리오 B: 중규모 (Contact 1,000-10,000)

```
1단계 (Before): 1-2분
  ├─ orphaned: 10-100건
  ├─ duplicate_groups: 5-30개
  ├─ calllog_affected: 50-500건
  └─ inconsistent: 3-15개

2단계 (SCRIPT 1-3): 8-15분
  ├─ SCRIPT 1: 2분 (rows 10-100)
  ├─ SCRIPT 2: 5-10분 (groups 5-30, CallLog 50-500)
  └─ SCRIPT 3: 2-3분 (records 10-100)

3단계 (Final): 2-3분
  └─ 모든 검증 쿼리

총: 13-20분
```

#### 시나리오 C: 대규모 (Contact > 10,000)

```
1단계 (Before): 2-3분
  ├─ orphaned: 100+건
  ├─ duplicate_groups: 30+개
  ├─ calllog_affected: 500+건
  └─ inconsistent: 15+개

2단계 (SCRIPT 1-3): 15-30분
  ├─ SCRIPT 1: 2-3분 (rows 100+)
  ├─ SCRIPT 2: 10-20분 (groups 30+, CallLog 500+)
  └─ SCRIPT 3: 3-5분 (records 100+)

3단계 (Final): 3-5분
  └─ 모든 검증 쿼리

총: 22-40분
```

### 실제 데이터 규모 확인

Before 단계에서 1-5 쿼리 결과로 시나리오 판단:

```python
orphaned = 1-1 결과
duplicates = 1-2 결과
total_contact = 1-5 결과의 total_active_before

if total_contact < 1000:
    print("시나리오 A: 5-8분 예상")
elif total_contact < 10000:
    print("시나리오 B: 13-20분 예상")
else:
    print("시나리오 C: 22-40분 예상")
```

---

## 5. 모니터링 & 롤백

### 실행 중 모니터링

#### 연결 상태 확인

```sql
-- Neon 콘솔에서 주기적 실행 (1-2분마다)
SELECT
  current_timestamp as check_time,
  COUNT(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'neondb' AND state = 'active';

-- 예상: 1-3개 (정상)
-- 주의: 10+개면 다른 작업 진행 중 (대기 권장)
```

#### 테이블 잠금 상태

```sql
-- Transaction 실행 중 다른 창에서 확인
SELECT
  schemaname,
  tablename,
  COUNT(*) as lock_count
FROM pg_locks
WHERE relation IS NOT NULL
GROUP BY schemaname, tablename
HAVING tablename IN ('Contact', 'CallLog');

-- 예상: Contact, CallLog에만 X lock
```

### 롤백 절차

#### 케이스 1: SCRIPT 중 오류 발생

```sql
-- 즉시 실행
ROLLBACK;

-- 확인
SELECT COUNT(*) FROM "Contact" WHERE "deletedAt" >= NOW() - INTERVAL '5 minutes';
-- 결과: 0 (변경 없음)
```

**시간:** < 1초

---

#### 케이스 2: SCRIPT 완료 후 문제 발견

```bash
# 백업에서 복구
psql -h ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech \
  -U neondb_owner -d neondb < backup_before_contact_cleanup_[timestamp].sql

# 또는 Neon 콘솔에서:
# Database → Backup & Restore → [backup 선택] → Restore
```

**시간:** 5-10분

---

### 성능 저하 시 대응

```sql
-- 인덱스 재구성
REINDEX TABLE "Contact";
REINDEX TABLE "CallLog";

-- 통계 업데이트
ANALYZE "Contact";
ANALYZE "CallLog";

-- 캐시 초기화 (필요시 애플리케이션 재시작)
SELECT pg_reload_conf();
```

**시간:** 2-5분

---

## 6. 최종 체크리스트

### Pre-Execution (실행 1시간 전)

- [ ] 백업 수행
  ```bash
  pg_dump ... > backup_before_contact_cleanup_$(date +%Y%m%d_%H%M%S).sql
  ```
  백업 파일: `backup_before_contact_cleanup_20260521_143000.sql`

- [ ] 애플리케이션 상태 확인
  - [ ] CRM UI 접속 가능
  - [ ] API 정상 응답
  - [ ] Contact 목록 조회 정상

- [ ] 팀 연락처 확보
  - [ ] 개발팀 대기
  - [ ] 운영팀 모니터링
  - [ ] 긴급 연락처 기록

### Step 1: Before 데이터 수집

- [ ] 1-1 orphaned_contacts_before: __________ 건
- [ ] 1-2 duplicate_groups_before: __________ 개
- [ ] 1-3 calllog_affected_before: __________ 건
- [ ] 1-4 inconsistent_userid_before: __________ 개
- [ ] 1-5 전체 통계 기록

### Step 2: SCRIPT 실행

- [ ] SCRIPT 1 실행 완료
  - [ ] COMMIT 확인
  - [ ] rows_updated: __________ 건

- [ ] SCRIPT 2 실행 완료
  - [ ] COMMIT 확인
  - [ ] duplicates_removed: __________ 건
  - [ ] CallLog FK 검증: orphaned = 0

- [ ] SCRIPT 3 실행 완료
  - [ ] COMMIT 확인
  - [ ] user_id_standardized: __________ 건

### Step 3: Final 검증

- [ ] 3-1 orphaned_contacts_final: __________ ✓ (반드시 0)
- [ ] 3-2 duplicate_phones_final: __________ ✓ (반드시 0)
- [ ] 3-3 inconsistent_userids_final: __________ ✓ (반드시 0)
- [ ] 3-4 orphaned_calllogs_final: __________ ✓ (반드시 0)
- [ ] 3-5 최종 통계 기록
- [ ] 3-6 성능 지표 확인

### Step 4: Post-Execution

- [ ] 애플리케이션 스모크 테스트
  - [ ] Contact 목록 조회
  - [ ] Contact 상세 조회
  - [ ] 새로운 Contact 생성
  - [ ] CallLog 조회

- [ ] 에러 로그 확인 (없어야 함)

- [ ] 사용자 피드백 대기 (1시간)

- [ ] Git 커밋
  ```bash
  git add TASK1_STEP4_EXECUTION_GUIDE.md TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql
  git commit -m "fix(db): Contact userId 정정 완료
  
  - orphaned_contacts: X건 → 0건 ✓
  - duplicate_phones: Y개 → 0개 ✓
  - inconsistent_userids: Z개 → 0개 ✓
  - CallLog FK: 무결성 보증 ✓
  
  Phase: Step 4 검증 완료, Step 5 진행 준비"
  ```

---

## 📞 비상 연락처

- **기술 담당:** [이름] ([전화])
- **운영 담당:** [이름] ([전화])
- **경영진:** [이름] ([전화])

---

## 📎 참고 자료

### 파일 위치
- 분석 쿼리: `contact_userId_analysis.sql`
- 정정 SCRIPT: `contact_userId_cleanup_scripts.sql`
- 검증 쿼리: `TASK1_STEP4_FINAL_VALIDATION_QUERIES.sql`
- 체크리스트: `CONTACT_USERID_MIGRATION_CHECKLIST.md`

### 관련 테이블
- `Contact` (primary)
- `GoldMember` (reference)
- `CallLog` (foreignKey: contactId)
- `ContactGroupMember` (related)

### DB 접근
```
Host: ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech
Database: neondb
User: neondb_owner
Port: 5432
```

---

**작성:** Agent γ (2026-05-21)  
**상태:** 프로덕션 실행 준비 완료  
**다음:** Step 5 진행 대기

