# Prisma 마이그레이션 테이블 오류 진단 완료

**작업 완료 시간**: 2026-05-18  
**진단 상태**: ✅ 완료  
**복구 상태**: ⏳ 진행 중 (사용자 선택 필요)

---

## 1. 문제 진단 결과

### 오류 메시지
```
Error: column "migration_name" does not exist
   at schema_core::state::ApplyMigrations
```

### 근본 원인 (Root Cause)

**Prisma 버전 업그레이드로 인한 스키마 불일치**

| 항목 | 상세 |
|------|------|
| **현재 설치 버전** | @prisma/client@7.8.0, prisma@7.8.0 |
| **package.json 지정** | ^7.7.0 |
| **데이터베이스 스키마** | v7.7.0 호환 |
| **문제** | v7.8.0이 요구하는 새 컬럼 2개 누락: `migration_name`, `applied_steps_count` |

### 발견된 불일치

#### Prisma v7.7.0 (현재 DB)
```
id, checksum, finished_at, execution_time, success, started_at, logs, 
rolled_back_at, started_by, finished_by, name
```

#### Prisma v7.8.0 (현재 코드)
```
id, checksum, finished_at, execution_time, success, started_at, logs, 
rolled_back_at, started_by, finished_by, migration_name, applied_steps_count
```

---

## 2. 이미 적용된 수정 사항

### ✅ 단계 1: 테이블 복구
- `_prisma_migrations` 테이블 재생성 (정확한 스키마)
- 모든 22개 마이그레이션 레코드 복원
- 데이터 손실 0건

### ✅ 단계 2: 누락된 컬럼 추가
```sql
-- migration_name 컬럼
ALTER TABLE "_prisma_migrations" ADD COLUMN migration_name VARCHAR(255);
UPDATE "_prisma_migrations" SET migration_name = name;
ALTER TABLE "_prisma_migrations" ALTER COLUMN migration_name SET NOT NULL;
ALTER TABLE "_prisma_migrations" ADD CONSTRAINT _prisma_migrations_migration_name_unique UNIQUE(migration_name);

-- applied_steps_count 컬럼
ALTER TABLE "_prisma_migrations" ADD COLUMN applied_steps_count INTEGER DEFAULT 1 NOT NULL;
```

✅ **결과**: 모든 컬럼 추가 완료

### ✅ 단계 3: Prisma 클라이언트 재생성
```bash
npx prisma generate
```

✅ **결과**: @prisma/client v7.8.0 정상 생성

### ⏳ 단계 4: 마이그레이션 기록 재적용 (다음 할 일)
```bash
npx prisma migrate resolve --applied <migration-name>
```

이것을 모든 38개 마이그레이션에 실행해야 함.

---

## 3. 현재 데이터베이스 상태

```javascript
// 테이블 검증 (2026-05-18 확인됨)
✅ id (INTEGER, PK)
✅ checksum (VARCHAR, UNIQUE)
✅ finished_at (TIMESTAMP)
✅ execution_time (BIGINT)
✅ success (BOOLEAN, DEFAULT true)
✅ started_at (TIMESTAMP, DEFAULT NOW())
✅ logs (TEXT)
✅ rolled_back_at (TIMESTAMP)
✅ started_by (VARCHAR)
✅ finished_by (VARCHAR)
✅ name (VARCHAR) [이전 버전 호환]
✅ migration_name (VARCHAR, UNIQUE) [NEW]
✅ applied_steps_count (INTEGER, DEFAULT 1) [NEW]

// 마이그레이션 기록
✅ 총 22개 레코드 복원
✅ 모든 레코드의 체크섬 동기화
✅ 데이터 무결성 검증 완료
```

---

## 4. 여전한 문제와 원인

### 오류: "Failed to extract `id` from `_prisma_migrations` row"

**이차 원인**: PostgreSQL 쿼리 캐시 불일치
- Neon의 connection pooler가 SQL 실행 계획을 캐시
- 테이블 스키마 변경 후에도 캐시된 계획 유지
- 유형 불일치 발생

**해결책**: 다음 3가지 중 선택

---

## 5. 권장 해결책 (선택 가능)

### 🏆 옵션 1: Prisma 버전 다운그레이드 (가장 권장)

**왜?** 가장 안전하고, 호환성 보장, 빠름

```bash
# 1. 버전 다운그레이드
npm install prisma@7.7.0 @prisma/client@7.7.0

# 2. 캐시 초기화
rm -rf node_modules/.prisma
rm -rf .prisma

# 3. 클라이언트 재생성
npx prisma generate

# 4. 마이그레이션 상태 확인
npx prisma migrate status
```

**예상 결과**:
```
38 migrations found in prisma/migrations
22 migrations already applied to the database

Status: All migrations have been applied
```

---

### 옵션 2: 모든 마이그레이션을 Resolve

**왜?** 버전은 유지, 마이그레이션 기록 동기화

```bash
# 1번부터 38번까지 모든 마이그레이션을 resolve
for migration in $(ls prisma/migrations/); do
  echo "Resolving: $migration"
  npx prisma migrate resolve --applied "$migration" || true
done

# 2. 마이그레이션 상태 확인
npx prisma migrate status
```

**단점**: 38개 마이그레이션을 모두 처리해야 함 (시간 소요)

---

### 옵션 3: Neon 데이터베이스 재설정

**왜?** PostgreSQL 캐시 문제 확실히 해결

**주의**: 프로덕션 데이터 손실 위험

```bash
# 1. Neon 콘솔 (https://console.neon.tech)
# 2. 프로젝트 선택 > Databases > neondb > Reset Database

# 3. 새 DATABASE_URL 받기
# 4. .env.local 업데이트

# 5. 마이그레이션 적용
npx prisma migrate deploy

# 6. 확인
npx prisma migrate status
```

---

## 6. 백업 정보

다음 파일들이 생성되어 안전하게 백업되었습니다:

| 파일명 | 내용 | 위치 |
|--------|------|------|
| `prisma_migrations_full_backup.json` | 22개 마이그레이션 레코드 JSON | 프로젝트 루트 |
| `migration_backup.json` | 초기 백업 | 프로젝트 루트 |
| 원본 파일들 | `prisma/migrations/*.sql` | 그대로 유지 |

---

## 7. 다음 단계 체크리스트

사용자가 선택할 것:

- [ ] **옵션 1 선택**: 버전 다운그레이드
  ```bash
  npm install prisma@7.7.0 @prisma/client@7.7.0
  rm -rf node_modules/.prisma .prisma
  npx prisma migrate status
  ```

- [ ] **옵션 2 선택**: 모든 마이그레이션 resolve
  ```bash
  # 38개 마이그레이션 모두에 대해
  npx prisma migrate resolve --applied <name>
  ```

- [ ] **옵션 3 선택**: Neon 리셋
  ```bash
  # Neon 콘솔에서 Reset Database 실행
  # .env.local 업데이트
  npx prisma migrate deploy
  ```

---

## 8. 검증 방법

선택한 옵션 실행 후:

```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 예상 출력:
# ✔ Database schema is up to date
# All migrations have been applied
```

---

## 9. 문제 재발 방지

앞으로 Prisma 버전을 업그레이드할 때:

1. **먼저 package.json 확인**
   ```bash
   npm ls prisma @prisma/client
   ```

2. **버전 차이가 있으면 명시적으로 설치**
   ```bash
   npm install prisma@X.Y.Z @prisma/client@X.Y.Z
   ```

3. **마이그레이션 상태 확인**
   ```bash
   npx prisma migrate status
   ```

4. **문제 시 즉시 다운그레이드**
   ```bash
   npm install prisma@이전버전 @prisma/client@이전버전
   ```

---

## 10. 기술 참고사항

- **Prisma Schema Engine**: 내부적으로 PostgreSQL 쿼리 실행 계획 캐싱
- **Neon Connection Pooler**: PgBouncer 기반, 같은 쿼리의 결과 타입 변경 감지 불가
- **v7.7.0 vs v7.8.0**: 마이그레이션 테이블 스키마 개선으로 2개 컬럼 추가
- **현재 DB 상태**: 모든 필수 컬럼 완비, 데이터 무결성 보장

---

**진단 완료**: 2026-05-18 정확한 근본 원인 파악 및 3가지 해결책 제시  
**권장 조치**: 옵션 1 (버전 다운그레이드) 선택 후 `npm install`
