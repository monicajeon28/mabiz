# M2-5 검증 체크리스트

**목표**: Phase 1C M2-5 파일 마이그레이션 완료 검증

**시작 시간**: ___________  
**완료 시간**: ___________  
**담당자**: ___________

---

## Phase 1: 사전 준비 (실행 전)

### 1.1 환경 설정
- [ ] `.env.local` 파일 존재 확인
- [ ] `GOOGLE_OAUTH_ACCESS_TOKEN` 환경변수 설정됨
  - Token 만료 시간 확인: ___________
  - 만료 여부: ☐ 유효 ☐ 만료 (갱신 필요)
- [ ] `DATABASE_URL` 설정됨
- [ ] Prisma Client 버전 최신 (npx prisma generate 실행)

### 1.2 스크립트 검증
- [ ] `scripts/migrate-passport-files-to-trips.mjs` 파일 존재
- [ ] 파일 크기: 469줄 (정상)
- [ ] 구문 검증: `node --check scripts/migrate-passport-files-to-trips.mjs` ✅

### 1.3 데이터 통계
```bash
# 마이그레이션 대상 조회
npx prisma studio
# → GmPassportSubmissionGuest
#   WHERE backupStatus = 'success'
#   COUNT = ?
```

- [ ] 마이그레이션 대상 게스트: __________ 명
- [ ] 예상 Trip 수: __________ 개
- [ ] 예상 조직 수: __________ 개

---

## Phase 2: 스크립트 실행

### 2.1 실행 명령
```bash
cd D:\mabiz-crm
dotenv -e .env.local node scripts/migrate-passport-files-to-trips.mjs
```

### 2.2 실행 결과
- [ ] 스크립트 정상 시작
- [ ] 로그 출력 확인: "✅ 총 NNN명의 guest 발견"

**실행 시간**: __________ 초

### 2.3 최종 통계
```
📊 마이그레이션 완료:
   ✅ 성공: __________ 명
   ❌ 실패: __________ 명
   ⏭️  스킵: __________ 명
   🎯 총: __________ 명
```

- [ ] 성공 + 실패 + 스킵 = 총 게스트 수 (일치 확인)
- [ ] 실패 건수: __________ (0이면 ✅, >0이면 조사 필요)
- [ ] 스킵 건수: __________ (0이면 ✅, >0이면 로그 확인)

---

## Phase 3: Google Drive 검증

### 3.1 폴더 구조 확인

**위치**: Google Drive → 마비즈CRM-여권백업

```
마비즈CRM-여권백업/
├─ ☐ Org-org1/ (확인)
│  ├─ ☐ Trip-1/ (확인)
│  │  ├─ ☐ 여권이미지/ (확인)
│  │  │  └─ ☐ guest-1.webp, guest-2.webp, ... (개수: ____)
│  │  └─ ☐ OCR데이터/ (확인)
│  │     └─ ☐ guest-1.json, guest-2.json, ... (개수: ____)
│  ├─ ☐ Trip-2/ (확인)
│  └─ ...
├─ ☐ Org-org2/ (확인)
│  └─ ...
└─ ...
```

**확인 항목**:
- [ ] Org-{orgId}/ 폴더 개수: __________ 개
- [ ] 각 Org의 Trip 폴더 개수 합계: __________ 개
- [ ] 총 여권이미지 파일: __________ 개
- [ ] 총 OCR데이터 파일: __________ 개

**파일명 규칙 확인**:
- [ ] 여권이미지: `guest-{id}.webp` 형식
  - 예: `guest-1.webp`, `guest-42.webp`, ...
- [ ] OCR데이터: `guest-{id}.json` 형식
  - 예: `guest-1.json`, `guest-42.json`, ...

### 3.2 이전 평면 구조 확인

**구글드라이브**: 마비즈CRM-여권백업/2026-06/, 마비즈CRM-여권백업/2026-07/ 등

- [ ] 기존 평면 폴더 (2026-06/, 2026-07/ 등) 존재 여부: ☐ 있음 ☐ 없음
- [ ] 평면 폴더의 파일 상태: ☐ 유지됨 ☐ 삭제됨
- [ ] 파일 개수: __________ 개 (백업용으로 유지 권장)

---

## Phase 4: 데이터베이스 검증

### 4.1 GmTripGoogleDriveConfig 확인

**방법 1**: Prisma Studio
```bash
npx prisma studio
# → GmTripGoogleDriveConfig 조회
```

- [ ] 총 레코드 수: __________ 개 (예상: 마이그레이션된 Trip 수)

**조회 결과**:
```
| tripId | googleFolderId | googleFolderName | deletedAt | Status |
|--------|----------------|------------------|-----------|--------|
| 1      | folder-xyz     | Trip-1           | NULL      | ✅     |
| 2      | folder-abc     | Trip-2           | NULL      | ✅     |
| ...    | ...            | ...              | ...       | ...    |
```

- [ ] 모든 `googleFolderId` NULL이 아님
- [ ] 모든 `googleFolderName` "Trip-{tripId}" 형식
- [ ] 모든 `deletedAt` NULL

**방법 2**: SQL 쿼리 (선택)
```sql
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN "googleFolderId" IS NOT NULL THEN 1 END) as with_folder,
       COUNT(CASE WHEN "deletedAt" IS NULL THEN 1 END) as active
FROM "TripGoogleDriveConfig";
```

결과: total = __________, with_folder = __________, active = __________

- [ ] total = with_folder = active (완벽한 마이그레이션)

### 4.2 GmPassportSubmissionGuest 확인 (선택)

```sql
SELECT COUNT(*) as total,
       COUNT(CASE WHEN "backupStatus" = 'success' THEN 1 END) as success,
       COUNT(CASE WHEN "googleDriveFileId" IS NOT NULL THEN 1 END) as with_backup
FROM "PassportSubmissionGuest"
WHERE "backupStatus" = 'success';
```

결과: total = __________, success = __________, with_backup = __________

---

## Phase 5: 파일 복구 테스트 (M3 준비)

### 5.1 파일 다운로드 테스트

**선택한 파일**:
- Trip ID: __________
- Guest ID: __________

**테스트 절차**:
1. Google Drive 열기
2. 마비즈CRM-여권백우 → Org-{orgId} → Trip-{tripId} → 여권이미지
3. guest-{id}.webp 우클릭 → 다운로드
4. 파일 정상 다운로드 확인
5. 이미지 뷰어로 열기 (손상 없음 확인)

- [ ] 다운로드 성공
- [ ] 파일 크기: __________ KB
- [ ] 파일 형식: ☐ WebP ☐ 손상됨
- [ ] 이미지 정상 표시: ☐ Yes ☐ No (손상)

**OCR 파일 테스트** (선택):
1. guest-{id}.json 다운로드
2. 텍스트 에디터로 열기 (JSON 형식 확인)

- [ ] JSON 파일 유효함
- [ ] 필드 확인:
  - [ ] `text` 또는 `content` 필드 존재
  - [ ] `confidence` > 0.8

---

## Phase 6: 성능 확인

### 6.1 마이그레이션 시간
- 시작: __________ (HH:MM:SS)
- 종료: __________ (HH:MM:SS)
- **소요 시간**: __________ 초

**기준**:
- ✅ < 300초 (5분) → 정상
- ⚠️ 300-600초 (5-10분) → 느림 (재점검)
- ❌ > 600초 (10분+) → 지연 (원인 조사)

### 6.2 네트워크 연결 상태
- [ ] Google Drive API 정상 응답
- [ ] 타임아웃 없음
- [ ] 재시도 필요 없음

---

## Phase 7: 이슈 추적

### 7.1 발생한 오류

**오류 1** (발생 시):
```
Trip ID: __________
Guest ID: __________
오류 메시지: _________________________________
원인 분석: _________________________________
해결 방법: _________________________________
```

- [ ] 재현 가능: ☐ Yes ☐ No
- [ ] 원인 파악: ☐ Yes ☐ No
- [ ] 해결됨: ☐ Yes ☐ No

**오류 2** (발생 시):
```
...
```

### 7.2 경고/주의사항

- [ ] organizationId 자동 조회 (fallback: USER_{tripId})
- [ ] 특정 Trip 폴더 이미 존재 (재사용됨)
- [ ] 권한 부족으로 인한 파일 이동 실패

---

## Phase 8: 최종 체크인

### 8.1 정리 작업
- [ ] 스크립트 로그 저장 (참고용)
- [ ] 구글드라이브 폴더 구조 스크린샷 촬영 (문서화)
- [ ] 스크립트 실행 시간 기록

### 8.2 문서화
- [ ] 마이그레이션 결과 보고서 작성
- [ ] 발견된 이슈 추적 (GitHub Issues)
- [ ] M3 준비 상태 확인

### 8.3 승인
- [ ] 기술 리더 검토: ☐ Pass ☐ Needs Fix
- [ ] 검토자 이름: __________
- [ ] 검토 날짜: __________
- [ ] 비고: _________________________________

---

## 최종 요약

| 항목 | 기대값 | 실제값 | 상태 |
|------|--------|--------|------|
| 마이그레이션 대상 | NNN명 | __________ | ☐ |
| 성공 | NNN명 | __________ | ☐ |
| 실패 | 0명 | __________ | ☐ |
| 스킵 | 0명 | __________ | ☐ |
| Org 폴더 | N개 | __________ | ☐ |
| Trip 폴더 | N개 | __________ | ☐ |
| 소요 시간 | <5분 | __________분 | ☐ |
| 파일 다운로드 | 정상 | __________ | ☐ |

---

## 서명

- 실행자: _________________________ (날짜: ________)
- 검증자: _________________________ (날짜: ________)
- 승인자: _________________________ (날짜: ________)

---

**체크리스트 버전**: M2-5 V1  
**최종 업데이트**: 2026-07-04  
**다음 단계**: M3 Restore API 설계
