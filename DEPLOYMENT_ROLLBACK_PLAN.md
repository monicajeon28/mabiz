# Phase 3 배포 롤백 계획

**작성일:** 2026-05-22
**대상:** Track A/C/D P0 산출물
**상태:** 비상 계획 (예방적)

---

## 롤백 개요

| 항목 | 설명 |
|------|------|
| **롤백 타입** | Code + Database 함께 실행 |
| **예상 복구 시간** | 30-60분 |
| **RPO (복구 시점 목표)** | < 1시간 (마이그레이션 전) |
| **RTO (복구 시간 목표)** | < 30분 |
| **다운타임** | < 5분 |
| **백업 위치** | Supabase 자동 백업 + GitHub |

---

## 시나리오별 롤백 절차

### 시나리오 1: 마이그레이션 SQL 에러

#### 증상
```
[Vercel] Error: "syntax error" in migration SQL
또는
[Supabase] "duplicate column" when adding Contact.autoSegment
또는
[Vercel] "Databases synced with errors!" message
```

#### 원인 분석
1. SQL 문법 오류 (IF NOT EXISTS 누락)
2. 컬럼 이름 충돌 (기존 컬럼명과 중복)
3. 데이터 타입 불일치 (Prisma 스키마와 SQL)

#### 롤백 절차 (5단계 / 약 15분)

**Step 1: 마이그레이션 중단**
```bash
# Vercel 빌드 로그에서 마이그레이션 상태 확인
# → 만약 RUNNING 상태면 1분 대기 (자동 중단)

# GitHub에서 최신 커밋 확인
git log --oneline -1
# 결과: f7da5da feat(phase3): Track A/C/D P0 무한루프 Cycle 1 완료
```

**Step 2: 수동 롤백 (Supabase SQL Editor)**

Track C 마이그레이션 롤백:
```sql
-- Supabase > SQL Editor > New query
-- 복사-붙여넣기 후 "Run" 클릭

BEGIN;

-- Step 1: 인덱스 삭제
DROP INDEX IF EXISTS "Contact_segmentScore_idx";
DROP INDEX IF EXISTS "Contact_autoSegmentEnabled_idx";
DROP INDEX IF EXISTS "Contact_nextSegmentReview_idx";

-- Step 2: 컬럼 삭제
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "nextSegmentReview";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentJourney";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "autoSegmentEnabled";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentHistory";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentLastUpdated";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentReason";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "segmentScore";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "autoSegment";

COMMIT;

-- 확인 쿼리
SELECT COUNT(*) as column_count FROM information_schema.columns 
WHERE table_name = 'Contact' AND column_name LIKE '%segment%';
-- 결과: 0 (모든 segment 컬럼 삭제됨)
```

Track D 마이그레이션 롤백:
```sql
BEGIN;

-- Step 1: 인덱스 삭제
DROP INDEX IF EXISTS "CallLog_abTestGroup_idx";
DROP INDEX IF EXISTS "CallLog_abTestVariant_idx";
DROP INDEX IF EXISTS "CallLog_scriptVersion_idx";
DROP INDEX IF EXISTS "CallLog_abTestAssignedAt_idx";

-- Step 2: 컬럼 삭제
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

-- 확인 쿼리
SELECT COUNT(*) as column_count FROM information_schema.columns 
WHERE table_name = 'CallLog' AND column_name LIKE '%test%' OR column_name LIKE '%script%';
-- 결과: 0 (모든 test 컬럼 삭제됨)
```

**Step 3: 마이그레이션 파일 비활성화**
```bash
# 옵션 A: 마이그레이션 파일 리네임 (비활성화)
mv prisma/migrations/20260522_add_contact_segment_fields \
   prisma/migrations/20260522_add_contact_segment_fields.disabled

mv prisma/migrations/20260522_add_calllog_abtest \
   prisma/migrations/20260522_add_calllog_abtest.disabled

# 옵션 B: Prisma 마이그레이션 히스토리 수정 (고급)
# → Supabase의 _prisma_migrations 테이블에서 행 삭제
DELETE FROM "_prisma_migrations" 
WHERE migration = '20260522_add_contact_segment_fields';

DELETE FROM "_prisma_migrations" 
WHERE migration = '20260522_add_calllog_abtest';
```

**Step 4: Vercel 배포 롤백**
```bash
# Vercel Dashboard > Deployments
# → 이전 배포 선택 (배포 전 마지막 성공 배포)
# → "Redeploy" 클릭

# 또는 CLI 사용
vercel rollback
# 프롬프트: "Are you sure? [y/N]"
# → "y" 입력

# 롤백 확인
vercel list --deployments
# 결과: 이전 배포 상태 표시
```

**Step 5: 검증**
```bash
# Contact 테이블 검증
curl https://mabiz.vercel.app/api/contacts/list
# 결과: 200 OK (새 필드 없음)

# CallLog 테이블 검증
curl https://mabiz.vercel.app/api/analytics/metrics
# 결과: 200 OK (새 필드 없음)

# 데이터 무결성 확인
# Supabase > Table Editor > Contact
# → 데이터 손실 없음 확인
```

---

### 시나리오 2: 빌드 실패 (TypeScript 에러)

#### 증상
```
[Vercel] Error: "Type 'Contact' is missing property 'autoSegment'"
또는
[Local] npm run build: error TS2304: Cannot find name 'CallLog'
```

#### 원인 분석
1. Prisma Client 재생성 미실행
2. Prisma 스키마와 마이그레이션 불일치
3. TypeScript 타입 캐시 문제

#### 롤백 절차 (4단계 / 약 10분)

**Step 1: Prisma 캐시 초기화**
```bash
# 로컬 개발 환경에서
rm -rf node_modules/.prisma
rm -rf .next

# Prisma Client 재생성
npx prisma generate

# 빌드 재시도
npm run build
```

**Step 2: 스키마 검증**
```bash
# prisma/schema.prisma 확인
grep -A 5 "model Contact {" prisma/schema.prisma
grep -A 5 "model CallLog {" prisma/schema.prisma

# Prisma 포맷팅
npx prisma format

# Vercel에 푸시
git add prisma/
git commit -m "fix(prisma): regenerate schema"
git push origin main
```

**Step 3: 마이그레이션 미연결 처리**
```bash
# Prisma와 DB의 마이그레이션 동기화 상태 확인
npx prisma migrate status

# 결과:
# ✓ Database schema is up to date
# 또는
# ✗ Migrations already applied to the database: ...

# 만약 동기화되지 않은 마이그레이션이 있으면:
# → Supabase SQL Editor에서 _prisma_migrations 테이블 확인
# → 해당 행 삭제 또는 마이그레이션 수동 실행
```

**Step 4: Vercel 재배포**
```bash
# Vercel Dashboard에서 수동 재배포
vercel deploy --prod

# 또는 GitHub push 후 자동 배포 대기
git push origin main
```

---

### 시나리오 3: 런타임 에러 (프로덕션 API 오류)

#### 증상
```
[Sentry] Error: "Cannot read property 'autoSegment' of undefined"
또는
[API Logs] 500 Internal Server Error at /api/contacts/segment-auto-fields
또는
[Monitoring] Database connection timeout
```

#### 원인 분석
1. Prisma Client 런타임 문제
2. API 엔드포인트에서 새 필드 접근 시도
3. 데이터베이스 마이그레이션 부분 완료

#### 롤백 절차 (6단계 / 약 30분)

**Step 1: 에러 파악**
```bash
# Sentry 대시보드에서 에러 스택 추적
# → https://sentry.io/organizations/mabiz/issues/

# 에러 메시지 예시:
# "TypeError: contact.autoSegment is undefined at segment-classifier.ts:45"

# → 해당 파일의 해당 줄 확인
cat src/lib/contact/segment-classifier.ts | sed -n '40,50p'
```

**Step 2: API 엔드포인트 임시 비활성화**
```bash
# 에러를 일으키는 API 엔드포인트 찾기
grep -r "autoSegment" src/app/api/

# 예상 결과:
# src/app/api/contacts/segment-auto-fields/route.ts
# src/app/api/analytics/ab-test-metrics/route.ts

# 해당 파일 수정 (예외 처리 추가)
# 또는 엔드포인트 비활성화

# 예: segment-auto-fields/route.ts
# if (!contact.autoSegment) {
#   return NextResponse.json(
#     { error: 'Feature temporarily disabled' },
#     { status: 503 }
#   );
# }
```

**Step 3: 핫픽스 커밋**
```bash
git add src/app/api/
git commit -m "fix(api): add null checks for new fields"
git push origin main
```

**Step 4: Vercel 재배포 대기**
```bash
# Vercel 자동 배포 진행
# → Vercel Dashboard > Deployments에서 모니터링

# 배포 완료 시까지 대기 (약 3-5분)
```

**Step 5: 모니터링**
```bash
# Sentry 에러 확인
# → 같은 에러 발생 여부 확인

# API 엔드포인트 테스트
curl https://mabiz.vercel.app/api/contacts/segment-auto-fields
# 결과: 503 Service Unavailable (임시 비활성화 상태)

# 다른 API 엔드포인트 정상 작동 확인
curl https://mabiz.vercel.app/api/health
# 결과: 200 OK
```

**Step 6: 근본 원인 해결**
```bash
# 로컬에서 재현 시도
npm run dev

# 같은 에러 발생 여부 확인
curl http://localhost:3000/api/contacts/segment-auto-fields

# 문제 파일 수정
# → null 체크 추가
# → 타입 가드 강화
# → 마이그레이션 상태 확인

# 다시 커밋 및 푸시
git add src/
git commit -m "fix(contacts): handle missing segment fields"
git push origin main

# API 엔드포인트 다시 활성화
# → 503 상태 코드 제거
```

---

### 시나리오 4: 데이터 마이그레이션 부분 완료

#### 증상
```
[Monitoring] Contact 테이블:
- autoSegment 컬럼: 존재
- segmentScore 컬럼: 존재
- 하지만 CallLog 테이블:
  - abTestGroup 컬럼: 없음 (마이그레이션 실패)
```

#### 롤백 절차 (3단계 / 약 20분)

**Step 1: 부분 마이그레이션 파악**
```sql
-- Supabase SQL Editor

-- Contact 테이블 확인
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'Contact' AND column_name LIKE '%segment%';
-- 결과: 8 (완전히 마이그레이션됨)

-- CallLog 테이블 확인
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'CallLog' AND column_name LIKE '%test%';
-- 결과: 0 (마이그레이션 실패)

-- _prisma_migrations 확인
SELECT migration, finished_at FROM "_prisma_migrations" 
ORDER BY finished_at DESC LIMIT 5;
```

**Step 2: Contact 롤백 (Step 1 시나리오 참고)**

**Step 3: CallLog 재마이그레이션**
```bash
# 마이그레이션 파일 수정 (SQL 문법 오류 해결)
# → prisma/migrations/20260522_add_calllog_abtest/migration.sql

# Supabase에서 수동 실행
# → SQL Editor > 수정된 SQL 복사-붙여넣기 > Run

# Prisma 동기화
npx prisma migrate resolve --applied 20260522_add_calllog_abtest
npx prisma generate

# 재배포
vercel deploy --prod
```

---

## 롤백 전 확인 체크리스트

### 긴급 상황 전 (15분)
- [ ] Sentry 에러 로그 캡처 (스크린샷)
- [ ] Vercel 빌드 로그 다운로드
- [ ] GitHub 최신 커밋 확인
- [ ] Supabase 백업 존재 여부 확인

### 롤백 중 (실시간)
- [ ] SQL 명령어 복사-붙여넣기 (타이핑 오류 방지)
- [ ] 각 단계 완료 후 검증
- [ ] 롤백 진행 상황 문서화
- [ ] 필요 시 다른 팀원에게 알림

### 롤백 후 (1시간)
- [ ] 프로덕션 데이터 무결성 확인
- [ ] 사용자 기능 정상 작동 확인
- [ ] 모니터링 대시보드 에러 0개 확인
- [ ] 사후 분석(Post-mortem) 계획

---

## 예상 복구 시간

| 시나리오 | 원인 파악 | 롤백 실행 | 검증 | 총 시간 |
|---------|---------|---------|------|--------|
| SQL 에러 | 5분 | 10분 | 5분 | **20분** |
| 빌드 에러 | 5분 | 5분 | 5분 | **15분** |
| 런타임 에러 | 10분 | 10분 | 10분 | **30분** |
| 부분 마이그레이션 | 10분 | 15분 | 10분 | **35분** |

---

## 예방 조치

### 배포 전 (이 문서 작성 후)
- [ ] 로컬 전체 빌드 테스트 (`npm run build`)
- [ ] Supabase 테스트 DB에서 마이그레이션 사전 실행
- [ ] Prisma 스키마와 SQL 마이그레이션 자동 검증
- [ ] TypeScript 타입 오류 0개 확인

### 배포 중 (Vercel 배포 실행 후)
- [ ] Vercel 빌드 로그 실시간 모니터링
- [ ] 데이터베이스 마이그레이션 상태 모니터링
- [ ] API 엔드포인트 헬스 체크 실행

### 배포 후 (1시간)
- [ ] Sentry 에러 로그 모니터링
- [ ] 사용자 기능 스모크 테스트
- [ ] 데이터베이스 성능 메트릭 확인

---

## 담당자 및 긴급 연락

| 역할 | 이름 | 연락처 | 대기시간 |
|------|------|--------|---------|
| 배포 담당 | 전혜선 | hyeseon28@gmail.com | 즉시 |
| Track A 담당 | - | - | 평일 09:00-18:00 |
| Track C 담당 | - | - | 평일 09:00-18:00 |
| Track D 담당 | - | - | 평일 09:00-18:00 |

---

## 추가 리소스

### 온라인 참고 자료
- [Prisma 마이그레이션 문제 해결](https://www.prisma.io/docs/orm/reference/error-reference)
- [Supabase 데이터베이스 복구](https://supabase.com/docs/guides/platform/backups)
- [Vercel 배포 롤백](https://vercel.com/docs/deployments/rollback)
- [PostgreSQL 컬럼 삭제](https://www.postgresql.org/docs/current/sql-altertable.html)

### 내부 문서
- [DEPLOYMENT_READY_CHECKLIST.md](./DEPLOYMENT_READY_CHECKLIST.md)
- [MIGRATION_VALIDATION_REPORT.md](./MIGRATION_VALIDATION_REPORT.md)
- [Phase 3 Track A/C/D P0 분석](./phase3_complete_final.md)

---

## 최종 확인

**롤백 계획 검토 완료 여부:**
- [ ] 4가지 시나리오 이해됨
- [ ] SQL 명령어 복사 준비됨
- [ ] 담당자 연락처 확인됨
- [ ] 긴급 연락처 저장됨
- [ ] 예방 조치 실행 준비됨

**다음 단계:**
1. DEPLOYMENT_READY_CHECKLIST.md 최종 검토
2. Track A/B/C/D 담당자에게 배포 일정 공지
3. 2026-05-24 오후 2시: 최종 배포 회의
4. 2026-05-24 오후 3시: 배포 시작

---

**작성자:** Phase 3 배포 담당
**최종 검토 예정:** 2026-05-23
**문서 버전:** v1.0
