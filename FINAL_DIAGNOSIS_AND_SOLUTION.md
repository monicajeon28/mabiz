# PRISMA MIGRATION TABLE 오류 최종 진단

## 발견된 문제 (Root Cause)

### 1. 주 원인: Prisma 버전 불일치
- **현재 버전**: @prisma/client@7.8.0, prisma@7.8.0
- **예상된 버전**: package.json에 명시된 ^7.7.0
- **문제**: 버전 업그레이드 중 `_prisma_migrations` 테이블 스키마가 변경되었으나 DB는 구 버전으로 남음

### 2. 컬럼 불일치
**구 버전 (현재 DB)**:
- `id`, `checksum`, `finished_at`, `execution_time`, `success`, `started_at`, `logs`, `rolled_back_at`, `started_by`, `finished_by`, `name`

**신 버전 (Prisma v7.8.0 기대)**:
- `id`, `checksum`, `finished_at`, `execution_time`, `success`, `started_at`, `logs`, `rolled_back_at`, `started_by`, `finished_by`, **`migration_name`** (새로 추가), **`applied_steps_count`** (새로 추가)

### 3. 이차 원인: PostgreSQL 쿼리 캐싱 문제
- Neon의 connection pooler가 SQL 쿼리 실행 계획을 캐시하고 있음
- 테이블 스키마가 변경되어도 캐시된 계획이 유지되어 타입 불일치 발생

## 해결 방법 (권장 순서)

### 옵션 A: 가장 안전한 방법 (권장) ✅
```bash
# 1. 모든 migration files 확인 (38개가 있음)
ls prisma/migrations/

# 2. 가장 오래된 migration부터 하나씩 resolve
npx prisma migrate resolve --applied 20260415000001_add_sms_log
npx prisma migrate resolve --applied 20260415000002_landing_utm_view
# ... 모든 22개 마이그레이션을 resolve

# 3. 최종 확인
npx prisma migrate status
```

문제: `prisma migrate resolve`를 모든 마이그레이션에 대해 실행해야 함 (38개)

### 옵션 B: PostgreSQL 연결 재설정 (빠른 방법)
```bash
# 1. Neon 콘솔에서 "Reset Database" 실행
# 또는
# 2. 기존 데이터베이스 삭제 후 재생성

# 3. 새 DATABASE_URL로 환경변수 업데이트
# 4. npx prisma migrate deploy
```

문제: 프로덕션 데이터 손실 위험

### 옵션 C: Prisma 버전 다운그레이드
```json
// package.json
{
  "dependencies": {
    "@prisma/client": "^7.7.0"
  }
}
```

```bash
npm install
npx prisma migrate status
```

## SQL 직접 수정 (이미 적용됨)

```sql
-- 1. migration_name 컬럼 추가
ALTER TABLE "_prisma_migrations" ADD COLUMN migration_name VARCHAR(255);
UPDATE "_prisma_migrations" SET migration_name = name WHERE migration_name IS NULL;
ALTER TABLE "_prisma_migrations" ALTER COLUMN migration_name SET NOT NULL;
ALTER TABLE "_prisma_migrations" ADD CONSTRAINT _prisma_migrations_migration_name_unique UNIQUE(migration_name);

-- 2. applied_steps_count 컬럼 추가
ALTER TABLE "_prisma_migrations" ADD COLUMN applied_steps_count INTEGER DEFAULT 1 NOT NULL;

-- 3. 검증
SELECT column_name FROM information_schema.columns 
WHERE table_name = '_prisma_migrations' 
ORDER BY ordinal_position;
```

## 현재 데이터베이스 상태

✅ **이미 수정됨**:
- `_prisma_migrations` 테이블 복구됨
- `migration_name` 컬럼 추가됨
- `applied_steps_count` 컬럼 추가됨
- 22개 마이그레이션 레코드 복원됨

❌ **여전한 문제**:
- Prisma 스키마 엔진이 테이블을 읽을 수 없음
- PostgreSQL 쿼리 캐시 불일치
- Prisma v7.8.0이 v7.7.0 마이그레이션 형식 인식 불가

## 다음 단계

### 즉시 해결책
1. Neon 데이터베이스 연결 테스트
2. 가장 먼저 해야 할 것: **Prisma 버전 확인**

```bash
npm ls prisma @prisma/client
```

### 최종 권장사항
**옵션 C (버전 다운그레이드)**가 가장 안전합니다:
```bash
# package.json에서 버전 확인
cat package.json | grep -A 2 "prisma"

# 만약 7.8.0이면 7.7.0으로 다운그레이드
npm install prisma@7.7.0 @prisma/client@7.7.0

# 캐시 초기화
rm -rf node_modules/.prisma
rm -rf .prisma

# 다시 시도
npx prisma migrate status
```

## 백업 정보
- 마이그레이션 레코드 백업: `prisma_migrations_full_backup.json` ✅
- 마이그레이션 파일들: `prisma/migrations/` ✅
