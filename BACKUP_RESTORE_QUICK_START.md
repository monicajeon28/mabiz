# 백업 복원 빠른 시작 가이드

마비즈 CRM 데이터를 Google Drive Excel 백업에서 Neon DB로 복원하는 3단계 가이드입니다.

## 1분 안에 시작하기

### 준비 사항

```bash
# 1. 백업 파일 확인
ls -la backups/google-drive-backup-latest/*.xlsx

# 2. 환경 변수 설정
export DATABASE_URL="postgresql://user:password@neon.tech/dbname"

# 3. 의존성 설치 (이미 설치된 경우 생략)
npm install
```

### 복원 실행

```bash
# 전체 복원 (Excel → JSON → 검증 → DB 삽입)
npm run script:restore-from-backup
```

**끝!** 약 2-5분이 소요됩니다.

---

## 단계별 상세 가이드

### Step 1: Excel → JSON 변환

```bash
npm run script:convert-excel
```

**출력**:
- `backups/restore-data/*.json` 파일 생성
- 자동 데이터 타입 변환
  - 날짜: ISO 8601 형식
  - Boolean: true/false
  - Array: 쉼표 구분 배열
  - JSON: 파싱된 객체

**출력 예시**:
```
[RESTORE] Loading backup file: backups/google-drive-backup-latest/crmdata-2026-05-26.xlsx
[RESTORE] Converted organizations (5 rows) -> organizations.json
[RESTORE] Converted contacts (1250 rows) -> contacts.json
[RESTORE] Converted sms_templates (8 rows) -> sms_templates.json
✓ All Excel files converted successfully
```

### Step 2: 데이터 정합성 검증

```bash
npm run script:validate-backup
```

**검증 항목**:
- ✓ 필수 필드 확인
- ✓ 외래키 참조 유효성
- ✓ 중복 데이터 감지
- ✓ 데이터 타입 검증

**결과 해석**:
- `✓ OK`: 문제 없음
- `⚠ WARNING`: 경고만 있음 (진행 가능)
- `✗ FAILED`: 에러 있음 (수정 필요)

**Exit Code**:
- `0`: 성공 또는 경고만 있음
- `1`: 검증 실패

### Step 3: Neon DB에 삽입

```bash
DATABASE_URL="postgresql://..." npm run script:insert-data
```

**삽입 순서** (외래키 제약):
1. organizations
2. organization_members
3. contacts
4. sms_templates

**특징**:
- 중복 레코드 자동 스킵
- 트랜잭션 처리로 데이터 일관성 보장
- 실시간 진행 상황 표시

**출력 예시**:
```
[INSERT] Inserting 5 organizations...
[INSERT] Inserting 12 organization members...
[INSERT] Inserting 1250 contacts...
[INSERT] Inserting 8 SMS templates...

✓ organizations: 5 inserted, 0 skipped, 0 failed
✓ organization_members: 12 inserted, 0 skipped, 0 failed
✓ contacts: 1248 inserted, 2 skipped, 0 failed
✓ sms_templates: 8 inserted, 0 skipped, 0 failed

Total: 1273 inserted, 2 skipped, 0 failed (12.45s)
```

---

## 복원 확인

### 1. 행 수 확인

```bash
psql $DATABASE_URL -c "
SELECT 'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL
SELECT 'sms_templates', COUNT(*) FROM sms_templates;
"
```

**예상 출력**:
```
      table_name      | count
---------------------+-------
 organizations       |     5
 organization_members|    12
 contacts            |  1248
 sms_templates       |     8
```

### 2. 데이터 샘플 확인

```bash
psql $DATABASE_URL -c "SELECT id, name, email, phone FROM contacts LIMIT 5;"
```

### 3. 외래키 무결성 확인

```bash
psql $DATABASE_URL -c "
-- 고아 레코드 확인 (부모가 없는 자식)
SELECT COUNT(*) as orphaned_contacts FROM contacts c
WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.organizationId);
"
```

**예상 결과**: `0` (고아 레코드 없음)

---

## 자동화 옵션

### npm 스크립트

```bash
# 전체 복원 (권장)
npm run script:restore-from-backup

# 개별 단계 실행
npm run script:convert-excel       # Step 1만
npm run script:validate-backup     # Step 2만
npm run script:insert-data         # Step 3만
```

### 수동 실행

```bash
# TypeScript 직접 실행
npx ts-node scripts/restore-from-google-drive.ts
npx ts-node scripts/validate-data-integrity.ts
npx ts-node scripts/insert-restored-data.ts
```

---

## 문제 해결

### 에러 1: "Backup directory not found"

```bash
# 백업 파일 확인
ls backups/google-drive-backup-latest/

# 파일이 없으면 복사
mkdir -p backups/google-drive-backup-latest
cp /경로/백업파일.xlsx backups/google-drive-backup-latest/
```

### 에러 2: "DATABASE_URL not set"

```bash
# 환경 변수 확인
echo $DATABASE_URL

# 설정되지 않았으면
export DATABASE_URL="postgresql://user:password@neon.tech/dbname"

# 또는 .env.local에 추가
echo "DATABASE_URL=postgresql://..." > .env.local
```

### 에러 3: "Foreign key constraint violated"

```bash
# 검증 단계에서 오류 내용 확인
npm run script:validate-backup

# 출력에서 어떤 FK가 위반되었는지 확인
# 예: contacts.id="xyz" not found in contacts table

# Excel에서 해당 부모 레코드 추가 후 다시 실행
```

### 경고: "Invalid date format"

- 경고만 있으면 진행해도 됨
- 해당 날짜 필드는 NULL로 삽입
- 필요시 Excel에서 `YYYY-MM-DD` 형식으로 수정

---

## 성능 팁

### 복원 시간 단축

| 데이터 크기 | 예상 시간 | 최적화 팁 |
|-----------|---------|---------|
| < 1,000 행 | 1-2초 | 기본 설정 사용 |
| 1,000-10,000 행 | 5-15초 | 동일 |
| 10,000-100,000 행 | 30-60초 | 배치 크기 조정 권장 |
| > 100,000 행 | 2분+ | 네온 연결 풀 설정 권장 |

### 연결 풀 설정 (대용량)

```bash
# .env
DATABASE_URL="postgresql://user:pass@neon.tech/db?connection_limit=20"
```

---

## 롤백

복원 후 문제 발견 시:

```bash
# 모든 데이터 삭제
psql $DATABASE_URL << EOF
DELETE FROM scheduled_sms;
DELETE FROM contact_lens_classifications;
DELETE FROM sms_templates;
DELETE FROM contacts;
DELETE FROM organization_members;
DELETE FROM organizations;
EOF

# 복원 다시 실행
npm run script:restore-from-backup
```

---

## FAQ

**Q: 부분 복원이 가능한가요?**
- A: 네. 스크립트를 수정하여 특정 organization만 필터링할 수 있습니다.

**Q: 중단 후 다시 실행하면 어떻게 되나요?**
- A: 안전합니다. 중복은 자동으로 스킵됩니다.

**Q: 이전 데이터와 병합할 수 있나요?**
- A: 가능하지만 ID 충돌 가능성이 있습니다. 먼저 검증 단계를 실행하세요.

**Q: 데이터 검증을 스킵할 수 있나요?**
- A: 권장하지 않지만, `npm run script:convert-excel && npm run script:insert-data`로 가능합니다.

---

## 상세 문서

더 자세한 정보는 **`scripts/RESTORE_GUIDE.md`** 를 참조하세요:
- 각 스크립트의 상세 동작 원리
- 데이터 타입 변환 규칙
- 검증 항목 설명
- 트러블슈팅 가이드
- 성능 최적화 방법

---

## 체크리스트

복원 전:
- [ ] 백업 파일이 `backups/google-drive-backup-latest/` 에 있는지 확인
- [ ] `DATABASE_URL` 환경 변수 설정 확인
- [ ] Neon DB가 비어있는지 확인 (또는 롤백 계획)
- [ ] npm 의존성 설치 확인

복원 중:
- [ ] Step 1: Excel → JSON 변환 성공 확인
- [ ] Step 2: 데이터 검증 성공 또는 경고만 있는지 확인
- [ ] Step 3: DB 삽입 성공 확인

복원 후:
- [ ] 행 수 확인 (총 몇 개 레코드 삽입되었는지)
- [ ] 데이터 샘플 확인 (필드 값이 올바른지)
- [ ] 외래키 무결성 확인 (고아 레코드 없는지)
- [ ] 애플리케이션 테스트 (웹 또는 API)

---

**마지막 업데이트**: 2026-05-26

🎯 **목표**: Google Drive Excel → Neon DB 완전 복원 ✓
