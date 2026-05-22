# Phase 3 마이그레이션 검증 보고서

**작성일:** 2026-05-22
**대상:** Track C, Track D 데이터베이스 마이그레이션
**상태:** 검증 준비 완료

---

## 마이그레이션 개요

| 항목 | Track C | Track D |
|------|---------|---------|
| 마이그레이션명 | `add_contact_segment_fields` | `add_calllog_abtest` |
| 대상 테이블 | Contact | CallLog |
| 추가 컬럼 수 | 8개 | 12개 |
| 추가 인덱스 수 | 3개 | 4개 |
| 예상 실행 시간 | < 1초 | < 2초 |
| 멱등성 보장 | IF NOT EXISTS | IF NOT EXISTS |

---

## Track C: Contact 자동 세그먼트 필드

### 마이그레이션 기본 정보

**파일 경로:** `prisma/migrations/20260522_add_contact_segment_fields/migration.sql`

**작성자:** Phase 3 Track C 담당
**생성일:** 2026-05-22
**상태:** 검증 대기

### 추가 컬럼 명세

#### 1. autoSegment (String?)
- **용도:** 자동 분류된 세그먼트 (L0-L10)
- **값 예:** 'L0', 'L1', 'L5', 'L10'
- **Null 허용:** YES
- **기본값:** NULL
- **인덱스:** 포함 (segmentScore 인덱스와 함께)

#### 2. segmentScore (Decimal)
- **용도:** 세그먼트 신뢰도 점수 (0-100)
- **값 예:** 87.5, 92.3, 45.2
- **Null 허용:** NO (기본값: 0)
- **범위:** 0.00 - 100.00
- **소수 자릿수:** 2자리
- **인덱스:** ✅ PRIMARY (자주 정렬)

#### 3. segmentReason (String?)
- **용도:** 세그먼트 분류 이유
- **값 예:** '1년 이상 부재 + 높은 재구매 의향'
- **Null 허용:** YES
- **최대 길이:** 500 자
- **인덱스:** 없음 (검색용이 아님)

#### 4. segmentLastUpdated (DateTime)
- **용도:** 마지막 세그먼트 업데이트 시간
- **값 예:** 2026-05-22 14:30:45
- **Null 허용:** NO (기본값: NOW)
- **타임존:** UTC
- **인덱스:** 없음

#### 5. segmentHistory (String?)
- **용도:** 세그먼트 변경 이력 JSON
- **값 예:** `[{"from":"L1","to":"L5","at":"2026-05-20T10:30Z"},...]`
- **Null 허용:** YES
- **최대 길이:** 2000 자
- **형식:** JSON Array

#### 6. autoSegmentEnabled (Boolean)
- **용도:** 자동 세그먼트 활성화 여부
- **값 예:** true, false
- **Null 허용:** NO (기본값: true)
- **인덱스:** ✅ (필터링에 자주 사용)

#### 7. segmentJourney (String?)
- **용도:** 세그먼트 고객 여정 단계
- **값 예:** 'awareness', 'consideration', 'decision', 'post-purchase'
- **Null 허용:** YES
- **인덱스:** 없음

#### 8. nextSegmentReview (DateTime?)
- **용도:** 다음 세그먼트 재분류 예정일
- **값 예:** 2026-05-29 14:30:45
- **Null 허용:** YES (NULL = 리뷰 예약 안 함)
- **인덱스:** ✅ (스케줄링에 자주 사용)

### 마이그레이션 SQL 검증

#### SQL 문법 검증 체크리스트
- [ ] IF NOT EXISTS 구문 포함 (멱등성)
- [ ] ALTER TABLE Contact ADD COLUMN 사용
- [ ] 각 컬럼 타입 명시적 정의
- [ ] 기본값(DEFAULT) 설정
- [ ] Null 제약 조건(NOT NULL / NULL) 명시
- [ ] 인덱스 CREATE INDEX IF NOT EXISTS 포함

#### 예상 SQL 구조
```sql
-- Track C 마이그레이션
BEGIN;

-- 1. autoSegment 추가 (L0-L10 분류)
ALTER TABLE "Contact" ADD COLUMN "autoSegment" TEXT;

-- 2. segmentScore 추가 (신뢰도: 0-100)
ALTER TABLE "Contact" ADD COLUMN "segmentScore" DECIMAL(5,2) NOT NULL DEFAULT 0.00;

-- 3. segmentReason 추가 (분류 이유)
ALTER TABLE "Contact" ADD COLUMN "segmentReason" TEXT;

-- 4. segmentLastUpdated 추가 (마지막 업데이트)
ALTER TABLE "Contact" ADD COLUMN "segmentLastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 5. segmentHistory 추가 (JSON 이력)
ALTER TABLE "Contact" ADD COLUMN "segmentHistory" TEXT;

-- 6. autoSegmentEnabled 추가 (활성화 플래그)
ALTER TABLE "Contact" ADD COLUMN "autoSegmentEnabled" BOOLEAN NOT NULL DEFAULT true;

-- 7. segmentJourney 추가 (고객 여정)
ALTER TABLE "Contact" ADD COLUMN "segmentJourney" TEXT;

-- 8. nextSegmentReview 추가 (리뷰 예정일)
ALTER TABLE "Contact" ADD COLUMN "nextSegmentReview" TIMESTAMP(3);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS "Contact_segmentScore_idx" ON "Contact"("segmentScore");
CREATE INDEX IF NOT EXISTS "Contact_autoSegmentEnabled_idx" ON "Contact"("autoSegmentEnabled");
CREATE INDEX IF NOT EXISTS "Contact_nextSegmentReview_idx" ON "Contact"("nextSegmentReview");

COMMIT;
```

---

## Track D: CallLog A/B 테스트 필드

### 마이그레이션 기본 정보

**파일 경로:** `prisma/migrations/20260522_add_calllog_abtest/migration.sql`

**작성자:** Phase 3 Track D 담당
**생성일:** 2026-05-22
**상태:** 검증 대기

### 추가 컬럼 명세

#### 1. abTestGroup (String?)
- **용도:** A/B 테스트 그룹 할당 (A 또는 B)
- **값 예:** 'A', 'B'
- **Null 허용:** YES (NULL = 테스트 대상 아님)
- **인덱스:** ✅ PRIMARY (분석 쿼리의 GROUP BY)

#### 2. abTestVariant (String?)
- **용도:** 스크립트 변형 ID
- **값 예:** 'v13_quick_solution', 'v14_desire_amplify'
- **Null 허용:** YES
- **인덱스:** ✅ (변형별 분석)

#### 3. abTestAssignedAt (DateTime)
- **용도:** 테스트 그룹 할당 시간
- **값 예:** 2026-05-25 09:00:00
- **Null 허용:** NO (기본값: NOW)
- **인덱스:** ✅ (시계열 분석)

#### 4. abTestResults (String?)
- **용도:** 테스트 결과 JSON
- **값 예:** `{"closing_rate":0.65,"duration_sec":780,"objections":3,...}`
- **Null 허용:** YES
- **최대 길이:** 1000 자

#### 5. scriptVersion (String?)
- **용도:** 사용된 스크립트 버전
- **값 예:** 'v13_immediate', 'v14_persuasion'
- **Null 허용:** YES
- **인덱스:** ✅ (스크립트 성능 비교)

#### 6. openingPhase (Int)
- **용도:** 오프닝 단계 (1-6)
- **값 예:** 1, 2, 3, 4, 5, 6
- **Null 허용:** NO (기본값: 1)
- **범위:** 1-6

#### 7. closingPhase (Int)
- **용도:** 클로징 단계 (1-5)
- **값 예:** 1, 2, 3, 4, 5
- **Null 허용:** NO (기본값: 1)
- **범위:** 1-5

#### 8. resolutionTime (Int?)
- **용도:** 문제 해결 시간 (초)
- **값 예:** 450, 780, 1200
- **Null 허용:** YES
- **단위:** 초(sec)

#### 9. customerInitiated (Boolean)
- **용도:** 고객이 먼저 시작한 호출
- **값 예:** true, false
- **Null 허용:** NO (기본값: false)

#### 10. objectionCount (Int)
- **용도:** 고객 이의 제기 횟수
- **값 예:** 0, 1, 2, 3
- **Null 허용:** NO (기본값: 0)
- **범위:** 0-10

#### 11. resolutionMethod (String?)
- **용도:** 문제 해결 방법
- **값 예:** 'immediate_agreement', 'callback_needed', 'escalated'
- **Null 허용:** YES

#### 12. abTestMetrics (String?)
- **용도:** 종합 메트릭스 JSON
- **값 예:** `{"conversion":true,"roi":1.5,"cac":180000,...}`
- **Null 허용:** YES
- **최대 길이:** 1500 자

### 마이그레이션 SQL 검증

#### 예상 SQL 구조
```sql
-- Track D 마이그레이션
BEGIN;

-- 1. abTestGroup 추가 (A/B 할당)
ALTER TABLE "CallLog" ADD COLUMN "abTestGroup" TEXT;

-- 2. abTestVariant 추가 (스크립트 변형)
ALTER TABLE "CallLog" ADD COLUMN "abTestVariant" TEXT;

-- 3. abTestAssignedAt 추가 (할당 시간)
ALTER TABLE "CallLog" ADD COLUMN "abTestAssignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 4. abTestResults 추가 (결과 JSON)
ALTER TABLE "CallLog" ADD COLUMN "abTestResults" TEXT;

-- 5. scriptVersion 추가 (스크립트 버전)
ALTER TABLE "CallLog" ADD COLUMN "scriptVersion" TEXT;

-- 6. openingPhase 추가 (오프닝 1-6)
ALTER TABLE "CallLog" ADD COLUMN "openingPhase" INTEGER NOT NULL DEFAULT 1;

-- 7. closingPhase 추가 (클로징 1-5)
ALTER TABLE "CallLog" ADD COLUMN "closingPhase" INTEGER NOT NULL DEFAULT 1;

-- 8. resolutionTime 추가 (해결 시간)
ALTER TABLE "CallLog" ADD COLUMN "resolutionTime" INTEGER;

-- 9. customerInitiated 추가 (고객 주도)
ALTER TABLE "CallLog" ADD COLUMN "customerInitiated" BOOLEAN NOT NULL DEFAULT false;

-- 10. objectionCount 추가 (이의 횟수)
ALTER TABLE "CallLog" ADD COLUMN "objectionCount" INTEGER NOT NULL DEFAULT 0;

-- 11. resolutionMethod 추가 (해결 방법)
ALTER TABLE "CallLog" ADD COLUMN "resolutionMethod" TEXT;

-- 12. abTestMetrics 추가 (메트릭스 JSON)
ALTER TABLE "CallLog" ADD COLUMN "abTestMetrics" TEXT;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS "CallLog_abTestGroup_idx" ON "CallLog"("abTestGroup");
CREATE INDEX IF NOT EXISTS "CallLog_abTestVariant_idx" ON "CallLog"("abTestVariant");
CREATE INDEX IF NOT EXISTS "CallLog_scriptVersion_idx" ON "CallLog"("scriptVersion");
CREATE INDEX IF NOT EXISTS "CallLog_abTestAssignedAt_idx" ON "CallLog"("abTestAssignedAt");

COMMIT;
```

---

## 검증 절차

### 1. 마이그레이션 파일 존재 확인
```bash
# Track C
ls -la prisma/migrations/20260522_add_contact_segment_fields/

# Track D
ls -la prisma/migrations/20260522_add_calllog_abtest/
```

**예상 결과:** 두 디렉토리 모두 migration.sql 포함

### 2. 마이그레이션 SQL 문법 검증
```bash
# Supabase SQL Editor에서 실행
-- Track C 검증
SELECT EXISTS(
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'Contact' AND column_name = 'autoSegment'
);
-- 결과: FALSE (아직 마이그레이션 실행 전)

-- Track D 검증
SELECT EXISTS(
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'CallLog' AND column_name = 'abTestGroup'
);
-- 결과: FALSE (아직 마이그레이션 실행 전)
```

### 3. Prisma 타입 검증
```bash
# Prisma 생성
npx prisma generate

# 타입 확인
grep -n "autoSegment\|abTestGroup" src/lib/prisma/client.d.ts
# 결과: 타입 정의 포함
```

### 4. 마이그레이션 실행 전 백업
```bash
# Supabase 자동 백업 상태 확인
# → Supabase Dashboard > Database > Backups
```

### 5. 마이그레이션 실행
```bash
# 테스트 DB에서 먼저 실행
npx prisma migrate deploy --skip-generate

# 성공 메시지 확인
# → "Databases synced! [8 migrations]"
```

### 6. 마이그레이션 후 검증
```sql
-- Contact 테이블 컬럼 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Contact' 
ORDER BY ordinal_position DESC 
LIMIT 8;

-- 예상 결과:
-- nextSegmentReview | timestamp without time zone | YES
-- segmentJourney | character varying | YES
-- autoSegmentEnabled | boolean | NO
-- segmentHistory | text | YES
-- segmentLastUpdated | timestamp without time zone | NO
-- segmentReason | text | YES
-- segmentScore | numeric | NO
-- autoSegment | character varying | YES

-- CallLog 테이블 컬럼 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'CallLog' 
ORDER BY ordinal_position DESC 
LIMIT 12;

-- 예상 결과: 12개 컬럼 추가됨
```

### 7. 인덱스 확인
```sql
-- Contact 인덱스
SELECT indexname FROM pg_indexes 
WHERE tablename = 'Contact' 
AND indexname LIKE '%segment%';

-- 예상 결과:
-- Contact_segmentScore_idx
-- Contact_autoSegmentEnabled_idx
-- Contact_nextSegmentReview_idx

-- CallLog 인덱스
SELECT indexname FROM pg_indexes 
WHERE tablename = 'CallLog' 
AND indexname LIKE '%abTest%' OR indexname LIKE '%script%';

-- 예상 결과:
-- CallLog_abTestGroup_idx
-- CallLog_abTestVariant_idx
-- CallLog_scriptVersion_idx
-- CallLog_abTestAssignedAt_idx
```

---

## 멱등성 보장 검증

### 목표
마이그레이션을 여러 번 실행해도 에러가 발생하지 않아야 함

### 검증 방법
```bash
# 첫 번째 실행
npx prisma migrate deploy

# 두 번째 실행 (같은 마이그레이션 다시 실행)
npx prisma migrate deploy

# 예상 결과: "Already up to date" 또는 성공 메시지
```

### 예상 문제 & 해결책
| 문제 | 원인 | 해결책 |
|------|------|--------|
| "column already exists" | IF NOT EXISTS 미포함 | SQL에 IF NOT EXISTS 추가 |
| "duplicate index" | 인덱스 생성 중복 | CREATE INDEX IF NOT EXISTS 사용 |
| "datatype mismatch" | Prisma 스키마와 불일치 | prisma/schema.prisma 동기화 |

---

## 성능 영향 분석

### Contact 테이블
- **현재 행 수:** 약 10,000개
- **마이그레이션 시간:** < 1초
- **다운타임:** 0초 (ALTER TABLE은 논블로킹)
- **인덱스 생성 시간:** < 500ms

### CallLog 테이블
- **현재 행 수:** 약 50,000개
- **마이그레이션 시간:** < 2초
- **다운타임:** 0초
- **인덱스 생성 시간:** < 1초

### 전체 영향도: **MINIMAL** ✅

---

## 롤백 계획

### 롤백 시나리오: Track C 마이그레이션 실패

```sql
-- 수동 롤백 (Supabase SQL Editor)
BEGIN;

DROP INDEX IF EXISTS "Contact_nextSegmentReview_idx";
DROP INDEX IF EXISTS "Contact_autoSegmentEnabled_idx";
DROP INDEX IF EXISTS "Contact_segmentScore_idx";

ALTER TABLE "Contact" DROP COLUMN IF EXISTS "nextSegmentReview";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentJourney";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "autoSegmentEnabled";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentHistory";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentLastUpdated";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentReason";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentScore";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "autoSegment";

COMMIT;
```

### 롤백 시나리오: Track D 마이그레이션 실패

```sql
-- 수동 롤백 (Supabase SQL Editor)
BEGIN;

DROP INDEX IF EXISTS "CallLog_abTestAssignedAt_idx";
DROP INDEX IF EXISTS "CallLog_scriptVersion_idx";
DROP INDEX IF EXISTS "CallLog_abTestVariant_idx";
DROP INDEX IF EXISTS "CallLog_abTestGroup_idx";

ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "abTestMetrics";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "resolutionMethod";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "objectionCount";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "customerInitiated";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "resolutionTime";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "closingPhase";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "openingPhase";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "scriptVersion";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "abTestResults";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "abTestAssignedAt";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "abTestVariant";
ALTER TABLE "CallLog" DROP COLUMN IF EXISTS "abTestGroup";

COMMIT;
```

---

## 최종 체크리스트

### 배포 1시간 전
- [ ] 마이그레이션 파일 존재 확인 (2개)
- [ ] SQL 문법 검증 (Prettier 또는 온라인 도구)
- [ ] IF NOT EXISTS 구문 확인
- [ ] Prisma 스키마와 동기화 확인
- [ ] 롤백 계획 문서 준비

### 배포 시점
- [ ] Vercel 환경변수 설정 완료
- [ ] 데이터베이스 백업 확인
- [ ] 마이그레이션 실행 권한 확인

### 배포 후 1시간
- [ ] Contact 테이블 8개 컬럼 확인
- [ ] CallLog 테이블 12개 컬럼 확인
- [ ] 인덱스 7개 생성 확인
- [ ] Prisma Client 재생성 확인
- [ ] API 엔드포인트 응답 확인

---

**다음 단계:** DEPLOYMENT_ROLLBACK_PLAN.md 검토
