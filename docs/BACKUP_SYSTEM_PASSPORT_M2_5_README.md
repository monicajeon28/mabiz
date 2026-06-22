# M2-5 마이그레이션 빠른 시작 가이드

## ⚡ 5분 안에 시작하기

### 1. 스크립트 위치
```
D:\mabiz-crm\scripts\migrate-passport-files-to-trips.mjs
```

### 2. 사전 확인 (필수)

```bash
# .env.local 확인
echo $GOOGLE_OAUTH_ACCESS_TOKEN

# 만료됨? → Google OAuth에서 새 토큰 발급 후 .env.local 업데이트
```

### 3. 스크립트 실행

```bash
cd D:\mabiz-crm

# 드라이런 (로컬 테스트)
dotenv -e .env.local node scripts/migrate-passport-files-to-trips.mjs
```

### 4. 결과 확인

```
✅ 성공: NNN명
❌ 실패: N명
⏭️  스킵: N명
```

### 5. Google Drive 확인

```
마비즈CRM-여권백업/
└─ Org-{orgId}/
   └─ Trip-{tripId}/
      ├─ 여권이미지/ (WebP 파일들)
      └─ OCR데이터/ (JSON 파일들)
```

---

## 📋 상세 작업지시서

**긴 버전**: [`BACKUP_SYSTEM_PASSPORT_PHASE1C_M2_5_MIGRATION.md`](./BACKUP_SYSTEM_PASSPORT_PHASE1C_M2_5_MIGRATION.md)

---

## 🔍 스크립트 구조

### 주요 함수

| 함수 | 역할 |
|------|------|
| `getOrganizationIdForTrip()` | Trip의 organizationId 조회 |
| `getOrCreateTripFolder()` | Trip 폴더 생성/조회 |
| `getOrCreateSubFolder()` | 여권이미지/OCR데이터 폴더 생성 |
| `moveFileToFolder()` | 파일 이동 |
| `renameFile()` | 파일명 변경 |
| `migrateFilesToTripFolders()` | 메인 마이그레이션 로직 |

### 처리 흐름

```
1. 모든 guests (backup status = 'success') 조회
   ↓
2. Trip별 그룹화
   ↓
3. 각 Trip마다:
   - organizationId 조회
   - Org-{orgId}/Trip-{tripId} 폴더 생성
   - 여권이미지/, OCR데이터/ 서브폴더 생성
   ↓
4. 각 파일:
   - 이동: guest-{id}.webp / guest-{id}.json
   ↓
5. 통계 리포팅
```

---

## ❌ 문제 해결

### "Google Drive 폴더 생성 실패"
→ GOOGLE_OAUTH_ACCESS_TOKEN 만료  
→ Google OAuth에서 새 토큰 발급

### "organizationId 조회 실패"
→ fallback: USER_{tripId} 폴더 생성  
→ 정상 동작 (개별 사용자 시스템)

### "파일 이동 실패"
→ Google Drive API Rate Limit 또는 권한 부족  
→ 스크립트 재실행 (다시 시도)

---

## ✅ 검증 체크리스트

- [ ] 스크립트 실행 완료 (exit code = 0)
- [ ] 성공: NNN명 (예상과 일치)
- [ ] Google Drive 폴더 구조 확인
  - [ ] Org-{orgId}/ 폴더 존재
  - [ ] Trip-{tripId}/ 폴더 존재
  - [ ] 여권이미지/ 폴더 + 파일들 존재
  - [ ] OCR데이터/ 폴더 + 파일들 존재
- [ ] 파일명: guest-{id}.webp, guest-{id}.json
- [ ] Prisma Studio에서 GmTripGoogleDriveConfig 확인
  - [ ] googleFolderId NOT NULL
  - [ ] googleFolderName = Trip-{tripId}

---

## 🚀 다음 단계

1. **M3**: Restore API (Trip 폴더 접근 제어)
2. **M4**: OCR 백업 통합
3. **M5**: 부하 테스트 (1,000명)

---

## 📞 문의

스크립트 오류:
1. 로그 확인 (특정 tripId / guestId)
2. 상세 작업지시서 "문제 해결" 섹션 참고
3. Agent-Passport 팀 문의

---

**최종 업데이트**: 2026-07-04  
**상태**: 📋 Ready for M2-5 Execution
