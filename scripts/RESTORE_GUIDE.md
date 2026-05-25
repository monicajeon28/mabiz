# 마비즈 CRM 데이터 복원 가이드

Google Drive에 백업된 Excel 파일을 Neon DB로 복원하는 완전한 스크립트 모음입니다.

## 개요

3단계 자동화 복원 프로세스:

1. **Excel → JSON 변환** (`restore-from-google-drive.ts`)
   - Google Drive Excel 백업 파일 읽기
   - UTF-8 인코딩 처리
   - 데이터 타입 자동 변환 (날짜, Boolean, 정수, 배열 등)

2. **데이터 정합성 검증** (`validate-data-integrity.ts`)
   - 외래키 참조 유효성 검사
   - 중복 데이터 감지
   - NULL 값 검증
   - 타입 검증

3. **Neon DB 삽입** (`insert-restored-data.ts`)
   - Prisma 클라이언트 사용
   - 트랜잭션 처리로 원자성 보장
   - 중복 데이터 스킵
   - 상세 에러 로깅

---

## 빠른 시작

### 1. 전체 복원 실행 (권장)

```bash
npm run script:restore-from-backup
```

이 명령어는 3단계를 모두 자동 실행합니다:
- Excel → JSON 변환
- 데이터 정합성 검증
- Neon DB 삽입

### 2. 개별 단계 실행

필요한 경우 단계별로 실행할 수 있습니다:

```bash
# Step 1: Excel → JSON 변환만
npm run script:convert-excel

# Step 2: 데이터 검증만
npm run script:validate-backup

# Step 3: DB 삽입만
npm run script:insert-data
```

---

## 상세 사용 방법

### Step 1: Excel → JSON 변환

```bash
npx ts-node scripts/restore-from-google-drive.ts
```

**입력:**
- `backups/google-drive-backup-latest/*.xlsx` - 최신 백업 파일

**출력:**
- `backups/restore-data/organizations.json`
- `backups/restore-data/organization_members.json`
- `backups/restore-data/contacts.json`
- `backups/restore-data/contact_lens_classifications.json`
- `backups/restore-data/sms_templates.json`
- `backups/restore-data/scheduled_sms.json`
- `backups/restore-data/gm_users.json`

**처리 내용:**
- Excel 셀 값 → JSON 타입 자동 변환
- 날짜: ISO 8601 형식으로 변환 (Excel Serial Date 포함)
- Boolean: "true"/"false"/"1"/"yes" → true/false
- Integer: 정수로 변환
- JSON: JSON 문자열 파싱
- Array: 쉼표 구분 문자열 → 배열로 변환

**예시 (Contact 필드 변환):**

```javascript
// Excel 입력
{
  "id": "cuid123",
  "phone": "010-1234-5678",
  "organizationId": "org_id_1",
  "tags": "vip,renewal,inquiry",
  "visaRequired": "true",
  "childrenCount": "2",
  "lensMetadata": '{"decisionLevel": 1, "readinessScore": 45}',
  "createdAt": 45000  // Excel 시리얼 날짜
}

// JSON 출력
{
  "id": "cuid123",
  "phone": "010-1234-5678",
  "organizationId": "org_id_1",
  "tags": ["vip", "renewal", "inquiry"],
  "visaRequired": true,
  "childrenCount": 2,
  "lensMetadata": {"decisionLevel": 1, "readinessScore": 45},
  "createdAt": "2023-01-15T00:00:00.000Z"
}
```

---

### Step 2: 데이터 정합성 검증

```bash
npx ts-node scripts/validate-data-integrity.ts
```

**검증 항목:**

1. **필수 필드 검증**
   - 각 테이블의 필수 필드 확인
   - NULL 또는 빈 값 감지

2. **외래키 참조 검증**
   - `contact.organizationId` → `organization.id` 존재 확인
   - `organizationMember.organizationId` → `organization.id` 존재 확인
   - `contactLensClassification.contactId` → `contact.id` 존재 확인
   - 고아(orphaned) 레코드 감지

3. **고유성 제약 검증**
   - `organization.slug` 중복 확인
   - 기타 고유 필드 중복 확인

4. **데이터 타입 검증**
   - Boolean 필드 타입 확인
   - Integer 필드 타입 확인
   - Float 필드 타입 확인
   - Date 필드 형식 확인

**출력 예시:**

```
================================================================================
DATA INTEGRITY VALIDATION REPORT
================================================================================

✓ organizations (5 rows)
✓ organization_members (12 rows)
✓ contacts (1250 rows)
✗ contact_lens_classifications (45 rows)
  Errors: 2
    - Row 12: contactId - Foreign key constraint violated: contactId="xyz" not found in contacts.id
    - Row 34: organizationId - Foreign key constraint violated: organizationId="abc" not found in organizations.id

================================================================================
SUMMARY: 1312 total rows | 2 errors | 0 warnings
================================================================================
```

**Exit Code:**
- `0`: 검증 성공 (또는 경고만 있음)
- `1`: 검증 실패 (에러 있음)

---

### Step 3: Neon DB 삽입

```bash
DATABASE_URL=postgresql://... npx ts-node scripts/insert-restored-data.ts
```

**환경 변수:**
- `DATABASE_URL`: Neon PostgreSQL 연결 문자열

**처리 순서** (외래키 제약으로 인해):
1. Organizations
2. Organization Members
3. Contacts
4. SMS Templates

**특징:**

- **중복 방지**: 같은 ID의 레코드가 이미 있으면 스킵
- **트랜잭션 처리**: 각 테이블별로 일관성 보장
- **상세 로깅**: 진행 상황 실시간 출력
- **에러 복구**: 일부 행의 삽입 실패 후에도 계속 진행

**출력 예시:**

```
[INSERT] Loading data files...
[INSERT] Inserting 5 organizations...
  [50/5] Inserted: 5, Skipped: 0
✓ Organizations: 5 inserted, 0 skipped, 0 failed
[INSERT] Inserting 12 organization members...
  [12/12] Inserted: 12, Skipped: 0
✓ Organization Members: 12 inserted, 0 skipped, 0 failed
[INSERT] Inserting 1250 contacts...
  [1250/1250] Inserted: 1248, Skipped: 2
✓ Contacts: 1248 inserted, 2 skipped, 0 failed
[INSERT] Inserting 8 SMS templates...
✓ SMS Templates: 8 inserted, 0 skipped, 0 failed

================================================================================
DATA INSERTION SUMMARY
================================================================================

✓ organizations: 5 inserted, 0 skipped, 0 failed
✓ organization_members: 12 inserted, 0 skipped, 0 failed
✓ contacts: 1248 inserted, 2 skipped, 0 failed
✓ sms_templates: 8 inserted, 0 skipped, 0 failed

Total: 1273 inserted, 2 skipped, 0 failed (12.45s)
```

---

## 디렉토리 구조

```
D:\mabiz-crm\
├── scripts/
│   ├── restore-from-google-drive.ts      # Step 1: Excel → JSON
│   ├── validate-data-integrity.ts        # Step 2: 데이터 검증
│   ├── insert-restored-data.ts           # Step 3: DB 삽입
│   └── RESTORE_GUIDE.md                  # 이 파일
└── backups/
    ├── google-drive-backup-latest/       # 입력: Excel 파일
    │   ├── crmdata-2026-05-25.xlsx
    │   └── crmdata-2026-05-26.xlsx
    └── restore-data/                     # 출력: JSON 파일
        ├── organizations.json
        ├── contacts.json
        └── ...
```

---

## 복원 전 체크리스트

- [ ] Neon DB가 비어있는 상태인지 확인
  ```bash
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM organizations;"
  ```

- [ ] 최신 Google Drive 백업 파일이 `backups/google-drive-backup-latest/` 에 있는지 확인

- [ ] `DATABASE_URL` 환경 변수가 올바르게 설정되었는지 확인
  ```bash
  echo $DATABASE_URL
  ```

- [ ] Node.js 및 TypeScript 종속성이 설치되었는지 확인
  ```bash
  npm list xlsx ts-node
  ```

---

## 복원 후 검증

복원 완료 후 데이터 무결성을 확인하세요:

```bash
# 1. 총 행 수 확인
psql $DATABASE_URL << EOF
SELECT 'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL
SELECT 'sms_templates', COUNT(*) FROM sms_templates;
EOF

# 2. 외래키 제약 확인 (고아 레코드 감지)
psql $DATABASE_URL << EOF
-- organization_members의 고아 레코드 확인
SELECT COUNT(*) FROM organization_members om
WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = om.organizationId);

-- contacts의 고아 레코드 확인
SELECT COUNT(*) FROM contacts c
WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.organizationId);
EOF

# 3. 데이터 샘플 확인
psql $DATABASE_URL -c "SELECT * FROM contacts LIMIT 5;"
```

---

## 문제 해결

### 에러: "Backup directory not found"

**원인**: 백업 파일이 올바른 위치에 없음

**해결책**:
```bash
# 백업 파일 위치 확인
ls -la backups/google-drive-backup-latest/

# 또는 다른 위치에서 파일을 복사
mkdir -p backups/google-drive-backup-latest
cp /path/to/backup/*.xlsx backups/google-drive-backup-latest/
```

### 에러: "Foreign key constraint violated"

**원인**: 부모 테이블 레코드가 없음

**해결책**:
1. `validate-data-integrity.ts` 실행하여 어떤 FK 제약이 위반되었는지 확인
2. Excel 파일에서 해당 부모 레코드 추가
3. 다시 복원 실행

### 에러: "DATABASE_URL not set"

**원인**: 환경 변수 미설정

**해결책**:
```bash
# .env.local 파일에 추가
echo "DATABASE_URL=postgresql://user:password@neon.tech/dbname" > .env.local

# 또는 직접 설정
export DATABASE_URL=postgresql://...
npm run script:insert-data
```

### 경고: "Invalid date format"

**원인**: Excel 날짜 형식이 인식되지 않음

**대처**:
- 검증 단계에서 경고만 표시되고 진행
- 해당 필드는 NULL로 삽입됨
- 필요시 Excel에서 ISO 8601 형식(YYYY-MM-DD)으로 수정

---

## 성능 최적화

### 대용량 데이터 복원 (10,000+ 행)

1. **배치 크기 조정** (`insert-restored-data.ts`):
   ```typescript
   // 기존: 모든 행을 한 번에 처리
   // 최적화: 배치로 나누어 처리
   const BATCH_SIZE = 500;
   for (let i = 0; i < rows.length; i += BATCH_SIZE) {
     const batch = rows.slice(i, i + BATCH_SIZE);
     // 배치 처리
   }
   ```

2. **Prisma 연결 풀 설정** (`.env`):
   ```
   DATABASE_URL="postgresql://user:pass@host/db?connection_limit=20"
   ```

3. **인덱스 비활성화** (복원 중):
   ```sql
   ALTER TABLE contacts DISABLE TRIGGER ALL;
   -- 복원 실행
   ALTER TABLE contacts ENABLE TRIGGER ALL;
   REINDEX TABLE contacts;
   ```

---

## 트러블슈팅 로그

각 스크립트는 상세 로깅을 포함합니다:

```bash
# 상세 로그와 함께 실행
npx ts-node scripts/restore-from-google-drive.ts 2>&1 | tee restore.log
npx ts-node scripts/validate-data-integrity.ts 2>&1 | tee validate.log
npx ts-node scripts/insert-restored-data.ts 2>&1 | tee insert.log
```

로그 파일을 검토하여 문제의 정확한 위치를 파악합니다.

---

## 롤백

복원 후 문제가 발견되면 롤백할 수 있습니다:

```bash
# 모든 데이터 삭제 (주의!)
psql $DATABASE_URL << EOF
DELETE FROM scheduled_sms;
DELETE FROM contact_lens_classifications;
DELETE FROM sms_templates;
DELETE FROM contacts;
DELETE FROM organization_members;
DELETE FROM organizations;
EOF

# 그 후 복원 다시 실행
npm run script:restore-from-backup
```

---

## FAQ

### Q: 복원 중 중단되었어요. 다시 실행해도 될까요?

**A**: 네. 스크립트는 이미 삽입된 ID를 감지하고 스킵합니다. 따라서 안전하게 다시 실행할 수 있습니다.

### Q: 특정 조직의 데이터만 복원하고 싶어요.

**A**: `insert-restored-data.ts`를 수정하여 필터링을 추가할 수 있습니다:
```typescript
const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  .filter(row => row.organizationId === 'target_org_id');
```

### Q: 복원 중 데이터 검증을 스킵할 수 있나요?

**A**: 권장하지 않지만, 다음과 같이 스킵할 수 있습니다:
```bash
npm run script:convert-excel && npm run script:insert-data
```

### Q: Prisma 스키마를 업데이트했어요. 복원이 영향을 받을까요?

**A**: 네. 스키마 변경 후에는 다음 명령어를 실행하세요:
```bash
npx prisma generate
npm run script:restore-from-backup
```

---

## 버전 정보

- **작성일**: 2026-05-26
- **마비즈 CRM 버전**: 0.1.0
- **Node.js**: 18+
- **PostgreSQL**: 13+
- **Prisma**: 7.7.0+

---

## 문의 및 지원

복원 중 문제가 발생하면:

1. 로그 파일 검토 (`*.log`)
2. 이 가이드의 "문제 해결" 섹션 확인
3. GitHub Issues에 로그와 함께 보고

---

**마지막 업데이트**: 2026-05-26
