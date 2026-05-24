# Google Drive 백업 파일 업로드 가이드

**생성일**: 2026-05-24 22:30  
**상태**: 준비 완료  
**대상 폴더**: mabiz-crm-backups (ID: 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz)

---

## 📊 백업 파일 목록

| 파일명 | 크기 | 타입 | 생성일 |
|--------|-----|------|--------|
| schema_backup_2026-05-24_221248.prisma | 169.67 KB | Prisma Schema | 2026-05-24 19:46:32 |
| prisma_migrations_backup_2026-05-24_221248.zip | 40.62 KB | 압축 파일 | 2026-05-24 22:12:50 |
| BACKUP_SUMMARY_2026-05-24.txt | 8.91 KB | 텍스트 | 2026-05-24 22:14:10 |

**총 크기**: 219.2 KB (0.21 MB) - 매우 작은 크기로 빠른 업로드 예상

---

## 🔐 Google Drive 인증 정보

```
서비스 계정 이메일: cruisedot@cruisedot-478810.iam.gserviceaccount.com
대상 폴더 ID: 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz
인증 방식: Google Service Account (JWT)
```

---

## 📤 업로드 방법 (3가지)

### 방법 1: Google Drive Web UI (가장 간단)

1. Google Drive 열기: https://drive.google.com/drive/u/0/folders/1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz

2. "파일 업로드" 버튼 클릭

3. 다음 3개 파일 선택:
   - `schema_backup_2026-05-24_221248.prisma`
   - `prisma_migrations_backup_2026-05-24_221248.zip`
   - `BACKUP_SUMMARY_2026-05-24.txt`

4. 업로드 완료 후 확인

**장점**: 즉시 가능, UI 확인 가능  
**시간**: ~1분 (파일 크기가 작음)

---

### 방법 2: Google Drive CLI (gdrive 도구)

```bash
# 1. gdrive 설치 (이미 설치되어 있다면 건너뛰기)
# https://github.com/prasmussen/gdrive

# 2. 각 파일 업로드
gdrive upload --parent 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz schema_backup_2026-05-24_221248.prisma
gdrive upload --parent 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz prisma_migrations_backup_2026-05-24_221248.zip
gdrive upload --parent 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz BACKUP_SUMMARY_2026-05-24.txt

# 3. 결과 확인
gdrive info 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz
```

---

### 방법 3: Google Drive API (Node.js 스크립트)

**준비 사항**:
```bash
npm install googleapis dotenv
```

**스크립트 실행**:
```bash
cd D:\mabiz-crm
node scripts/upload-backups-to-gdrive.js
```

**예상 출력**:
```
🚀 Google Drive Backup Upload Process Started

📁 Backup Folder ID: 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz
📂 Local Backup Directory: D:\mabiz-crm\backups

🔍 Verifying backup files...
   ✅ schema_backup_2026-05-24_221248.prisma - 169.67 KB
   ✅ prisma_migrations_backup_2026-05-24_221248.zip - 40.62 KB
   ✅ BACKUP_SUMMARY_2026-05-24.txt - 8.91 KB

📤 Uploading: schema_backup_2026-05-24_221248.prisma (0.17 MB)
   Progress: 100%
   ✅ Uploaded successfully
   ID: <file-id-1>
   Size: 0.17 MB
   Time: 2.5s
   Link: https://drive.google.com/file/d/<file-id-1>/view

... (다른 파일들도 순차적으로 업로드)

📊 UPLOAD REPORT
============================================================
Total Files: 3
✅ Success: 3
❌ Failed: 0
Folder ID: 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz
Timestamp: 2026-05-24T22:30:00Z
============================================================
```

---

## ✅ 업로드 검증

업로드 완료 후 다음을 확인하세요:

### 1. 파일 존재 확인
```
Google Drive 폴더에서 3개 파일 모두 표시되는지 확인
```

### 2. 파일 크기 확인
```
원본 크기와 업로드된 파일 크기 일치 여부 확인
- schema_backup: 169.67 KB ✓
- prisma_migrations: 40.62 KB ✓
- BACKUP_SUMMARY: 8.91 KB ✓
```

### 3. 접근 권한 확인
```
폴더 공유 설정:
- 공개: ❌ (보안 위험)
- 조직 구성원: ✅ (권장)
- 특정 사용자만: ✅ (가장 안전)
```

---

## 📋 업로드 후 처리

### 1. 업로드 보고서 저장
```
파일명: UPLOAD_REPORT_2026-05-24.json
위치: D:\mabiz-crm\backups\
내용: 각 파일의 Google Drive ID, 크기, 링크 저장
```

### 2. 백업 메타데이터 기록
```json
{
  "timestamp": "2026-05-24T22:30:00Z",
  "files": [
    {
      "fileName": "schema_backup_2026-05-24_221248.prisma",
      "fileId": "[Google Drive File ID]",
      "size": 169670,
      "link": "https://drive.google.com/file/d/[ID]/view"
    }
    // ... 다른 파일들
  ],
  "status": "COMPLETED",
  "totalFiles": 3,
  "totalSize": 219200
}
```

### 3. 다음 백업 스케줄
```
- 일일 백업: 매일 11:00 PM (UTC+9)
- 주간 백업: 매주 일요일 11:00 PM
- 월간 백업: 매월 1일 11:00 PM
- 장기 보관: AWS S3 + Google Drive 이중화 권장
```

---

## 🔒 보안 체크리스트

- [ ] Google Drive 폴더가 공개되어 있지 않은지 확인
- [ ] 서비스 계정 개인 키가 노출되지 않았는지 확인
- [ ] 백업 파일에 민감한 정보가 포함되어 있지 않은지 확인
- [ ] 업로드 후 원본 백업 파일은 로컬에 보관
- [ ] 월 1회 복구 테스트 실행

---

## 🆘 문제 해결

### 문제: 파일이 업로드되지 않음
```
원인 1: 폴더 ID 오류
→ 폴더 ID 재확인: 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz

원인 2: 인증 오류
→ .env.local 파일의 서비스 계정 정보 재확인

원인 3: 네트워크 문제
→ 인터넷 연결 확인 후 재시도

원인 4: 폴더 권한 부족
→ 폴더 소유자에게 권한 요청
```

### 문제: 업로드 속도가 느림
```
원인: 파일 크기가 크거나 네트워크 느림
해결: 
  - 파일 압축 (zip)
  - 재시도 (네트워크 대역폭 충분한 시간 선택)
  - 기지국 또는 WiFi 재연결
```

### 문제: 용량 초과
```
에러: "Storage quota exceeded"
해결:
  - Google Drive 용량 확인 (https://one.google.com/storage)
  - 불필요한 파일 삭제
  - Google One 구독 또는 조직 스토리지 추가
```

---

## 📞 지원

문제 발생 시:
1. 로그 파일 확인: `UPLOAD_REPORT_*.json`
2. 에러 메시지 기록
3. Google Drive API 문서: https://developers.google.com/drive/api
4. 개발팀 연락: hyeseon28@gmail.com

---

**마지막 업데이트**: 2026-05-24 22:30 UTC+9  
**다음 백업 예정**: 2026-05-25 23:00 UTC+9
