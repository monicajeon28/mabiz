# 마비즈 CRM 데이터 복원 스크립트 - 최종 요약

**작성일**: 2026-05-26
**상태**: ✅ 완성 및 테스트 준비 완료

---

## 📦 생성된 파일 목록

### 3가지 메인 복원 스크립트

| 파일명 | 라인 수 | 목적 | 실행 시간 |
|--------|--------|------|---------|
| `scripts/restore-from-google-drive.ts` | 394 | Excel → JSON 변환 | 1-2초 |
| `scripts/validate-data-integrity.ts` | 482 | 데이터 정합성 검증 | 2-5초 |
| `scripts/insert-restored-data.ts` | 541 | Neon DB 삽입 | 10-30초 |
| **Total** | **1,417** | **전체 복원** | **15-60초** |

### 문서

| 파일명 | 내용 |
|--------|------|
| `BACKUP_RESTORE_QUICK_START.md` | 1분 시작 가이드 + 문제 해결 |
| `scripts/RESTORE_GUIDE.md` | 상세 기술 문서 (성능, FAQ, 트러블슈팅) |
| `RESTORE_SCRIPTS_SUMMARY.md` | 이 파일 - 빠른 참조 |

### package.json 업데이트

4개의 새 npm 스크립트 추가:
```json
"script:restore-from-backup"  → 전체 복원 (Step 1-3)
"script:validate-backup"      → Step 2만 (검증)
"script:convert-excel"        → Step 1만 (Excel 변환)
"script:insert-data"          → Step 3만 (DB 삽입)
```

---

## 🚀 빠른 실행

### 전체 복원 (권장)
```bash
npm run script:restore-from-backup
```

### 개별 단계
```bash
npm run script:convert-excel      # Step 1: Excel → JSON
npm run script:validate-backup    # Step 2: 데이터 검증
npm run script:insert-data        # Step 3: DB 삽입
```

---

## 📋 각 스크립트 상세

### 1️⃣ restore-from-google-drive.ts (394줄)

**목표**: Google Drive Excel → JSON 변환

**입력**:
- `backups/google-drive-backup-latest/*.xlsx` (가장 최신 파일 자동 감지)

**출력**:
- `backups/restore-data/organizations.json`
- `backups/restore-data/organization_members.json`
- `backups/restore-data/contacts.json`
- `backups/restore-data/contact_lens_classifications.json`
- `backups/restore-data/sms_templates.json`
- `backups/restore-data/scheduled_sms.json`
- `backups/restore-data/gm_users.json`

**자동 데이터 타입 변환**:
```javascript
// 날짜: Excel 시리얼 → ISO 8601
45000 → "2023-01-15T00:00:00.000Z"

// Boolean: 다양한 형식 → true/false
"true"/"1"/"yes" → true
"false"/"0"/"no" → false

// Array: 쉼표 구분 → JSON 배열
"vip,renewal,inquiry" → ["vip", "renewal", "inquiry"]

// JSON: 문자열 → 파싱된 객체
'{"level": 1}' → {"level": 1}
```

**핵심 기능**:
- [x] Excel 시트 자동 감지 (8개 테이블)
- [x] UTF-8 인코딩 처리
- [x] 날짜 형식 변환 (Excel 시리얼 포함)
- [x] 외래키 ID 매핑 준비
- [x] 상세 진행 로깅

---

### 2️⃣ validate-data-integrity.ts (482줄)

**목표**: 복원 전 데이터 정합성 검증

**검증 항목**:

1. **필수 필드** ✓
   - organizations: id, name, slug
   - contacts: id, phone, organizationId
   - organization_members: id, organizationId, userId

2. **외래키 제약** ✓
   - contacts.organizationId → organizations.id
   - organization_members.organizationId → organizations.id
   - contact_lens_classifications.contactId → contacts.id
   - contact_lens_classifications.organizationId → organizations.id
   - sms_templates.organizationId → organizations.id
   - scheduled_sms.organizationId → organizations.id

3. **고유성 제약** ✓
   - organizations.slug (중복 검사)

4. **데이터 타입** ⚠️
   - Boolean: true/false 확인
   - Integer: 정수 확인
   - Float: 숫자 확인
   - Date: ISO 형식 확인

**출력**:
```
✓ organizations (5 rows)
✓ organization_members (12 rows)
✓ contacts (1250 rows)
✗ contact_lens_classifications (45 rows)
  Errors: 2
    - Row 12: contactId - Foreign key constraint violated
    - Row 34: organizationId - Foreign key constraint violated

SUMMARY: 1312 total rows | 2 errors | 0 warnings
```

**Exit Code**:
- `0`: 성공 (또는 경고만 있음)
- `1`: 실패 (에러 있음)

---

### 3️⃣ insert-restored-data.ts (541줄)

**목표**: Neon DB에 데이터 삽입

**삽입 순서** (외래키 제약):
1. organizations (부모)
2. organization_members (부모)
3. contacts (자식)
4. sms_templates (자식)
5. contact_lens_classifications (자식)

**특징**:

- **중복 방지**: 같은 ID 레코드 자동 스킵
- **트랜잭션**: Prisma 클라이언트 사용으로 원자성 보장
- **진행 추적**: 실시간 `[현재/전체]` 표시
- **에러 처리**: 일부 실패 후에도 계속 진행

**Prisma 모델 매핑**:
```typescript
// Organization
{
  id, name, slug, plan, status,
  externalAffiliateProfileId, contractRef,
  createdAt, updatedAt
}

// Contact (50+ 필드)
{
  id, phone, organizationId, name, email,
  // L0 렌즈 (부재 고객)
  reactivationSegment, reactivationLikelihood, lastCruiseDate,
  smsDay0Sent, smsDay0SentAt, ...
  // L2 렌즈 (준비 불안도)
  anxietyScore, anxietyCategory, preparationStage,
  // L3 렌즈 (차별성)
  competitorMentioned, competitorNames, differentiationScore,
  // L5 렌즈 (자기투영)
  selfProjectionScore, personalHealthCondition,
  // ... 기타 모든 필드
}
```

**출력**:
```
[INSERT] Inserting 5 organizations...
  [5/5] Inserted: 5, Skipped: 0
✓ Organizations: 5 inserted, 0 skipped, 0 failed

[INSERT] Inserting 12 organization members...
  [12/12] Inserted: 12, Skipped: 0
✓ Organization Members: 12 inserted, 0 skipped, 0 failed

[INSERT] Inserting 1250 contacts...
  [1250/1250] Inserted: 1248, Skipped: 2
✓ Contacts: 1248 inserted, 2 skipped, 0 failed

[INSERT] Inserting 8 SMS templates...
✓ SMS Templates: 8 inserted, 0 skipped, 0 failed

Total: 1273 inserted, 2 skipped, 0 failed (12.45s)
```

---

## 📊 데이터 흐름

```
Google Drive Excel
        ↓
[restore-from-google-drive.ts]
        ↓
JSON 파일 (backups/restore-data/)
        ↓
[validate-data-integrity.ts]
        ↓
✓ 검증 성공
        ↓
[insert-restored-data.ts]
        ↓
Neon Database
```

---

## 🔑 핵심 설계 원칙

### 1. 안전성
- 중복 레코드 자동 스킵
- 트랜잭션 처리로 원자성 보장
- 검증 단계에서 문제 조기 감지

### 2. 성능
- 배치 처리로 메모리 효율
- 실시간 진행 상황 표시
- 에러 시에도 계속 진행 (실패 행 로깅)

### 3. 관찰성
- 각 단계별 상세 로깅
- 에러 행번호 및 원인 명시
- 진행률 실시간 표시

### 4. 복구성
- 중단 후 재실행 가능
- 롤백 절차 문서화
- 문제 진단용 상세 로그

---

## ⚙️ 기술 스택

| 항목 | 사용 기술 | 버전 |
|------|---------|------|
| 언어 | TypeScript | 5.0+ |
| 런타임 | Node.js | 18+ |
| Excel | xlsx | 0.18.5 |
| DB | PostgreSQL (Neon) | 13+ |
| ORM | Prisma | 7.7.0+ |
| 실행 | ts-node | 내장 |

---

## 📈 성능 예상

| 데이터 크기 | 예상 시간 | 메모리 |
|-----------|---------|--------|
| 1K 행 | ~2초 | <50MB |
| 10K 행 | ~5초 | <100MB |
| 100K 행 | ~30초 | ~200MB |
| 1M 행 | ~3분 | ~500MB |

---

## 🛡️ 에러 처리

### 자동 처리되는 에러
- ✓ 중복 레코드 (스킵)
- ✓ NULL 값 (허용 또는 기본값)
- ✓ 날짜 파싱 실패 (NULL로 설정)

### 수동 처리 필요
- ✗ 외래키 제약 (Excel에서 수정)
- ✗ 필수 필드 NULL (Excel에서 채우기)
- ✗ DATABASE_URL 미설정 (환경 변수 설정)

---

## 🔄 복원 재실행

중단 또는 실패 후 재실행 가능:

```bash
# 모든 단계 다시 실행 (안전)
npm run script:restore-from-backup

# 특정 단계만 다시 실행
npm run script:validate-backup    # 검증만 재실행
npm run script:insert-data        # DB 삽입만 재실행
```

**동작**:
- Step 1 (Excel → JSON): 기존 JSON 파일 덮어쓰기
- Step 2 (검증): 읽기만 (부작용 없음)
- Step 3 (DB 삽입): 중복 ID 자동 스킵

---

## 📚 문서 가이드

### 빠른 시작 (1-2분)
→ **`BACKUP_RESTORE_QUICK_START.md`**
- 명령어만 필요한 경우
- 기본 문제 해결

### 상세 기술 문서
→ **`scripts/RESTORE_GUIDE.md`**
- 각 스크립트 동작 원리
- 데이터 타입 변환 규칙
- 검증 항목 상세 설명
- 성능 최적화
- FAQ

### 스크립트 코드
→ **`scripts/*.ts`**
- 인라인 주석 포함
- 각 함수별 설명
- 에러 처리 로직

---

## ✅ 배포 체크리스트

### 실행 전
- [ ] 백업 파일 준비 (`backups/google-drive-backup-latest/*.xlsx`)
- [ ] 환경 변수 설정 (`DATABASE_URL`)
- [ ] 의존성 설치 (`npm install`)
- [ ] Neon DB 비우기 (또는 롤백 계획 수립)

### 실행 중
- [ ] Step 1 성공 확인 (JSON 파일 생성)
- [ ] Step 2 성공 또는 경고만 있는지 확인
- [ ] Step 3 완료 및 행 수 확인

### 실행 후
- [ ] 총 행 수 확인
- [ ] 데이터 샘플 검증
- [ ] 외래키 무결성 확인
- [ ] 애플리케이션 테스트

---

## 🎯 다음 단계

1. **즉시 실행 준비**
   - Google Drive에서 최신 백업 파일 다운로드
   - `backups/google-drive-backup-latest/` 에 저장

2. **환경 설정**
   ```bash
   export DATABASE_URL="postgresql://user:password@neon.tech/dbname"
   ```

3. **복원 실행**
   ```bash
   npm run script:restore-from-backup
   ```

4. **검증**
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM contacts;"
   ```

---

## 📞 문의

문제 발생 시:
1. `BACKUP_RESTORE_QUICK_START.md` 의 "문제 해결" 섹션 참조
2. `scripts/RESTORE_GUIDE.md` 의 "문제 해결" 섹션 참조
3. 스크립트 출력 로그 검토
4. GitHub Issues에 로그와 함께 보고

---

## 📋 파일 목록 최종 확인

```
✓ D:\mabiz-crm\scripts\restore-from-google-drive.ts (394줄)
✓ D:\mabiz-crm\scripts\validate-data-integrity.ts (482줄)
✓ D:\mabiz-crm\scripts\insert-restored-data.ts (541줄)
✓ D:\mabiz-crm\BACKUP_RESTORE_QUICK_START.md
✓ D:\mabiz-crm\scripts\RESTORE_GUIDE.md
✓ D:\mabiz-crm\RESTORE_SCRIPTS_SUMMARY.md (이 파일)
✓ D:\mabiz-crm\package.json (스크립트 4개 추가)
```

---

**상태**: ✅ 완성 (2026-05-26)

**다음**: Google Drive 백업 파일 준비 후 `npm run script:restore-from-backup` 실행
