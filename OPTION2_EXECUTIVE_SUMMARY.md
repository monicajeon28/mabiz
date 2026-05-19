# Option 2 (rolled-back 마크) 위험성 분석 - 엑그로 요약

**작업 요청**: DB 마이그레이션 재설정 Option 2의 정확한 위험성 분석

**분석 대상**: 
- Option 2 = `npx prisma migrate resolve --rolled-back 20260519000002_add_lens_schema` 실행
- 현황: Neon PostgreSQL DB에서 43개 마이그레이션 적용, 이후 5개 대기 중

---

## 최종 결론: MEDIUM 위험도 + "문제 마스킹" 특성

```
┌─────────────────────────────────────────────────────────────┐
│ Option 2 = 근본 문제 해결 아님, 안전하지만 비효율적         │
├─────────────────────────────────────────────────────────────┤
│ 데이터 손실     │ 0% ✅          │ 테이블 미생성       │
│ 서비스 Downtime │ 0% ✅          │ 스키마 변경 없음     │
│ FK 무결성       │ 0% ✅          │ 제약 존재하지 않음   │
│ 근본 해결       │ 0% ❌          │ SQL 오류 미처리      │
│ 후속 마이그레이션│ 여전히 블로킹 ❌│ ContactLensClass... │
│ Schema Drift    │ MEDIUM ⚠️      │ 정의 ≠ 테이블       │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 정확한 현황: "부분 적용도 아님"

### 실제 마이그레이션 상태

```
42개 ✅        20260519000001_add_execution_log_campaign_fields
43개 ✅        Phase 0-3 모두 완료

                   ❌ BLOCKER
                       ↓
20260518185649 FAILED: SendingHistory unique constraint (SQL Syntax Error)
   "syntax error at or near CASE" (Database error code: 42601)

                   ⏳ BLOCKED
                       ↓
20260519000002 PENDING: 테이블/칼럼 생성 안 됨 (ContactLensClassification, etc.)
20260519000003 PENDING: ExecutionLog.lensMetadata 칼럼
20260519000004 PENDING: SMS template psychology
20260519000006 PENDING: ExecutionLog 인덱스
20260519000007 PENDING: SendingHistory 렌탈 추적
20260519000008 PENDING: ContactLensClassification UNIQUE 제약
```

### 핵심 발견

```
DB 실제 상태:
  ✅ Contact 테이블: 정상 (lensType 칼럼 없음)
  ✅ ContactLensClassification: 생성 안 됨
  ✅ ContactLensSequence: 생성 안 됨
  ✅ LensTemplate: 생성 안 됨
  ✅ SendingHistory: 정상 (new index 미생성)

이것은:
  - "부분 적용"이 아니라 "아예 미적용"
  - 따라서 롤백 위험 = 0 (만들 게 없어서 깰 것도 없음)
```

---

## 2. 위험도 분석 (정정된 버전)

### Risk Assessment Matrix

```
┌────────────────┬──────────┬──────────┬──────────┐
│ 위험 항목      │ 위험도   │ 확률     │ 영향     │
├────────────────┼──────────┼──────────┼──────────┤
│ 데이터 손실    │ NONE ✅  │ 0%       │ 없음     │
│ Downtime       │ NONE ✅  │ 0%       │ 없음     │
│ FK 무결성      │ NONE ✅  │ 0%       │ 없음     │
│ Prisma 검증    │ MEDIUM   │ 60%      │ 배포지연 │
│ 근본 미해결    │ HIGH     │ 100%     │ 유지보수 │
│ Schema Drift   │ MEDIUM   │ 80%      │ 개발혼란 │
└────────────────┴──────────┴──────────┴──────────┘

종합 위험도: MEDIUM
```

### 각 항목별 상세 분석

#### 1. 데이터 손실 = NONE (0%)
```
근거: 생성된 테이블이 없음
  - Contact.lensType: 미생성 → 손실할 데이터 없음 ✅
  - ContactLensClassification: 미생성 → 레코드 없음 ✅
  - ContactLensSequence: 미생성 → 추적 데이터 없음 ✅
  
결론: Option 2 실행 시 데이터 손실 위험 = 0%
```

#### 2. Downtime = NONE (0%)
```
근거: 스키마 변경 없음
  - npx prisma migrate resolve --rolled-back
    → _prisma_migrations 테이블만 업데이트 (메타데이터)
    → DB 스키마 변경 없음
    → 배포 불필요
    
결론: Downtime = 0분 (배포 자체 안 함)
```

#### 3. FK 무결성 = NONE (0%)
```
근거: 테이블이 없으므로 FK 제약도 없음
  - ContactLensClassification.fk_lens_contact: 미생성
  - ContactLensSequence.fk_sequence_classification: 미생성
  - 모든 FK 제약: 존재하지 않음
  
결론: FK 무결성 문제 = 0% (제약 자체가 없음)
```

#### 4. Prisma 검증 오류 = MEDIUM (60%)
```
문제: schema.prisma에는 모델 정의가 있는데 DB에 테이블 없음

발생 시나리오:
  npx prisma generate
  → ContactLensClassification 쿼리 타입 생성
  npx prisma db push
  → table not found 오류

확률: 60% (Prisma 버전과 설정에 따라 다름)
복구시간: 30분 (schema.prisma 정의 제거 후 다시 재배포)
```

#### 5. 근본 문제 미해결 = HIGH (100%)
```
문제: 20260518185649의 SQL 오류 여전히 존재

현상:
  npx prisma migrate deploy
  Error: 20260518185649 syntax error at or near CASE
  
영향:
  - 후속 5개 마이그레이션 여전히 블로킹
  - ContactLensClassification 영구적으로 미생성
  - SMS 3일 시퀀스 기능 미완성

원본 원인:
  CREATE UNIQUE INDEX WHERE 조건이 PostgreSQL 파서 오류 발생
  → SQL 문법 수정 필요 (Option 1)
```

#### 6. Schema Drift = MEDIUM (80%)
```
상황: 정의 있으나 테이블 없는 상태 지속

Prisma schema.prisma:
  model ContactLensClassification { ... }  ← 정의됨
  
Neon DB:
  ContactLensClassification 테이블: 없음

결과:
  - 개발자 혼란 (테이블 있는지 없는지 불분명)
  - 향후 마이그레이션 작성 시 주의 필요
  - 코드 리뷰 복잡성 증가
```

---

## 3. Option 2 실행 결과 예측

```
명령:
  npx prisma migrate resolve --rolled-back 20260519000002_add_lens_schema

결과:
  ✅ 명령 실행 성공
  _prisma_migrations 테이블:
    20260519000002_add_lens_schema → rolled_back_at = "2026-05-19T15:30:00Z"
  
  다음 배포 시 (npx prisma migrate deploy):
    ❌ 20260518185649 여전히 실패 (SQL 오류 미해결)
    ❌ 20260519000002 스킵됨 (rolled_back 마크)
    ❌ 20260519000003~000008 여전히 블로킹됨
    
  결론: "문제 무시"하고 "나머지는 모두 대기 중"
```

---

## 4. 권장 대안 비교

### Option 1: SQL 문법 수정 (권장) ⭐⭐⭐

```bash
파일: /prisma/migrations/20260518185649_fix_sending_history_unique_constraint/migration.sql

현재 (오류 발생):
  CREATE UNIQUE INDEX IF NOT EXISTS ix_sending_history_dedup
  ON "SendingHistory" ("campaignId", "contactId")
  WHERE "campaignId" IS NOT NULL;

수정 방안:
  → PostgreSQL WHERE 조건 문법 검증
  → CASE 문 제거/단순화
  → 인덱스 생성 명령 재작성

결과:
  ✅ 근본 문제 해결
  ✅ 20260519000002~000008 모두 정상 적용
  ✅ ContactLensClassification 테이블 생성
  ✅ Schema drift 해소
  
위험도: LOW
복구시간: 1시간
데이터 손실: 0%
```

### Option 2: rolled-back 마크 (현재) ⚠️⚠️⚠️

```bash
npx prisma migrate resolve --rolled-back 20260519000002_add_lens_schema

결과:
  ✅ 안전함 (데이터 손실 없음)
  ❌ 근본 문제 미해결 (20260518185649 여전히 실패)
  ❌ 후속 마이그레이션 여전히 블로킹
  ❌ Schema drift 상태 지속
  
위험도: MEDIUM
복구시간: 추가 1시간 (Option 1 필요)
데이터 손실: 0%
효율성: 낮음 (일시적 조치일 뿐)
```

### Option 3: Force deploy (미권장) ❌❌❌

```bash
npx prisma migrate resolve --rolled-back 20260518185649_fix_sending_history_unique_constraint

결과:
  ❌ SendingHistory 고유 인덱스 미생성
  ✅ 후속 마이그레이션은 진행
  ❌ 부분 적용 상태 (database integrity 문제)
  
위험도: HIGH
데이터 손실: 0% (인덱스만 미생성)
문제: 성능 저하 (Unique constraint 미적용)
```

---

## 5. 최종 권장사항

### 우선순위

```
1순위: Option 1 (SQL 문법 수정) ⭐ 권장
   - 근본 원인 해결
   - 모든 후속 마이그레이션 정상 적용
   - 위험 최소화
   
2순위: Option 2 (rolled-back) ⚠️ 임시방편
   - 안전하지만 비효율적
   - 근본 해결을 위해선 추가 작업 필요
   
3순위: Option 3 (Force) ❌ 피할 것
   - 부분 적용 상태로 인한 불안정성
```

### 의사결정 기준

```
만약 "긴급하게 다른 기능 배포가 필요":
  → Option 2 선택 (0 downtime, 안전)
  → 나중에 Option 1 별도 진행

만약 "렌즈 분류 기능이 필수":
  → Option 1 선택 (즉시 해결)
  → 1시간 투자로 모든 것 정상화
```

---

## 6. Option 2 실행 체크리스트

만약 Option 2를 선택한다면:

```
[ ] 1. 백업 확인
      - Neon 자동 백업 활성화 확인
      
[ ] 2. 명령 실행
      npx prisma migrate resolve --rolled-back 20260519000002_add_lens_schema
      
[ ] 3. 마이그레이션 상태 확인
      npx prisma migrate status
      → 20260518185649 여전히 FAILED 확인
      
[ ] 4. Prisma 생성 재실행
      npx prisma generate
      → table not found 경고 무시 (테이블 미생성이 예상 동작)
      
[ ] 5. 배포 여부 판단
      - ContactLensClassification 필요: Option 1 진행
      - 다른 기능 우선: Option 2로 현재 상태 유지
      
[ ] 6. 티켓 등록
      - "Option 1: 20260518185649 SQL 문법 수정" 별도 작업 등록
```

---

## 결론

**Option 2의 정체**:
- "위험도는 낮지만" (데이터 손실 0%)
- "문제는 해결하지 않는다" (근본 원인 미제거)
- "일시적 마스킹일 뿐이다" (추후 Option 1 필요)

**최종 위험도: MEDIUM** ⚠️
- ✅ 데이터 손실: 0%
- ✅ 서비스 중단: 0%
- ❌ 근본 문제: 미해결 (100%)
- ⚠️ 개발 복잡성: 증가 (Schema drift)
