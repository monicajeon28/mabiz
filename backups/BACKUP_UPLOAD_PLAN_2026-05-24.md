# Google Drive 백업 업로드 계획서

**문서 생성**: 2026-05-24 22:30 UTC+9  
**상태**: ✅ 준비 완료  
**예상 업로드 시간**: ~2분  
**총 파일 크기**: 219.2 KB (0.21 MB)

---

## 📋 업로드 파일 목록

### 1. Prisma Schema 백업
```
파일명: schema_backup_2026-05-24_221248.prisma
크기: 169.67 KB
타입: 텍스트 (Prisma 스키마)
용도: 데이터베이스 스키마 복구용
생성: 2026-05-24 19:46:32 UTC+9
```

### 2. Prisma Migrations 백업
```
파일명: prisma_migrations_backup_2026-05-24_221248.zip
크기: 40.62 KB
타입: ZIP 압축 파일
용도: 데이터베이스 마이그레이션 히스토리
생성: 2026-05-24 22:12:50 UTC+9
```

### 3. 백업 요약 정보
```
파일명: BACKUP_SUMMARY_2026-05-24.txt
크기: 8.91 KB
타입: 텍스트 문서
용도: 백업 메타데이터 및 체크리스트
생성: 2026-05-24 22:14:10 UTC+9
```

---

## 🎯 업로드 대상

**Google Drive 폴더**: mabiz-crm-backups  
**폴더 ID**: `1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz`  
**소유자**: cruisedot@cruisedot-478810.iam.gserviceaccount.com  
**접근 권한**: 조직 구성원 (공개 안 함)

---

## ✅ 실행 전 체크리스트

- [x] 로컬 백업 파일 3개 모두 존재 확인
- [x] 파일 크기 및 무결성 확인
- [x] Google Drive 폴더 ID 확인
- [x] 서비스 계정 인증 정보 준비 (.env.local)
- [x] 업로드 매니페스트 생성 (UPLOAD_MANIFEST_2026-05-24.json)
- [ ] 실제 업로드 실행
- [ ] Google Drive 폴더에서 파일 확인
- [ ] 업로드 보고서 생성 및 저장

---

## 🚀 추천 업로드 방식

### 방식 1: Google Drive 웹 UI (가장 빠르고 간단) ⭐ 권장

**단계**:
1. 브라우저에서 Google Drive 폴더 열기:
   ```
   https://drive.google.com/drive/u/0/folders/1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz
   ```

2. "파일 업로드" 또는 "폴더 업로드" 클릭

3. 다음 3개 파일 선택 (또는 D:\mabiz-crm\backups 폴더 전체 선택):
   - `schema_backup_2026-05-24_221248.prisma`
   - `prisma_migrations_backup_2026-05-24_221248.zip`
   - `BACKUP_SUMMARY_2026-05-24.txt`

4. 업로드 대기 (진행률 확인 가능)

**예상 시간**: 30초 ~ 1분  
**장점**: 즉시 가능, 진행 상황 시각화  
**단점**: 수동 작업

---

### 방식 2: CLI 도구 사용 (자동화 가능)

#### A. rclone 사용 (권장)
```bash
# 1. rclone 설치 (https://rclone.org/downloads/)
# 2. Google Drive 설정
rclone config create gdrive google

# 3. 폴더 업로드
rclone copy D:\mabiz-crm\backups gdrive:/mabiz-crm-backups/2026-05-24/ \
  --progress \
  --transfers 4 \
  --checkers 8

# 4. 검증
rclone ls gdrive:/mabiz-crm-backups/
```

#### B. gdrive CLI 사용
```bash
# 1. gdrive 설치 (https://github.com/prasmussen/gdrive)
# 2. 인증 설정
gdrive auth

# 3. 각 파일 업로드
cd D:\mabiz-crm\backups

gdrive upload --parent 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz \
  schema_backup_2026-05-24_221248.prisma

gdrive upload --parent 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz \
  prisma_migrations_backup_2026-05-24_221248.zip

gdrive upload --parent 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz \
  BACKUP_SUMMARY_2026-05-24.txt
```

**예상 시간**: 1-2분  
**장점**: 자동화 가능, 배치 업로드  
**단점**: CLI 도구 설치 필요

---

### 방식 3: Google Drive API + Node.js (프로그래밍 방식)

```bash
# 1. 의존성 확인
npm list googleapis

# 2. 스크립트 실행
cd D:\mabiz-crm
node scripts/upload-backups-to-gdrive.js
```

**예상 시간**: 2-3분  
**장점**: 완전 자동화, 로깅 포함  
**단점**: Node.js 환경 설정 필요

---

## 📊 업로드 후 예상 결과

### Google Drive 폴더 상태

```
mabiz-crm-backups/
├── schema_backup_2026-05-24_221248.prisma (169.67 KB)
├── prisma_migrations_backup_2026-05-24_221248.zip (40.62 KB)
└── BACKUP_SUMMARY_2026-05-24.txt (8.91 KB)

총 파일: 3개
총 크기: 219.2 KB
```

### 생성될 파일 (로컬)

```
D:\mabiz-crm\backups\
├── UPLOAD_MANIFEST_2026-05-24.json
│   └── 파일 메타데이터 및 Google Drive ID 목록
├── UPLOAD_REPORT_2026-05-24.json
│   └── 업로드 결과 (파일 ID, 링크, 시간)
└── GOOGLE_DRIVE_UPLOAD_GUIDE.md
    └── 상세 업로드 가이드 (이 문서의 확장판)
```

---

## 🔐 보안 및 유지보수

### 업로드 후 필수 확인 사항

1. **접근 권한 확인**
   ```
   Google Drive 폴더 공유 설정:
   ✓ 공개 (링크 공유) - 불가 (보안 위험)
   ✓ 조직 구성원 (마비즈 팀) - 권장
   ✓ 특정 사용자만 - 최고 보안
   ```

2. **파일 무결성 검증**
   ```
   각 파일 크기 확인:
   - 원본: schema_backup = 169.67 KB
   - Google Drive: 169.67 KB (일치)
   
   ZIP 파일 압축 해제 테스트:
   - prisma_migrations.zip 정상 압축 확인
   ```

3. **복구 테스트** (월 1회)
   ```
   Google Drive에서 파일 다운로드 후:
   - 파일 포맷 확인
   - Prisma 스키마 문법 검증
   - 마이그레이션 파일 정상 로드 확인
   ```

---

## 📅 백업 스케줄

| 백업 주기 | 시간 | 대상 |
|----------|------|------|
| 일일 백업 | 매일 23:00 UTC+9 | 로컬 + Google Drive |
| 주간 백업 | 매주 일요일 23:00 | 전체 데이터베이스 |
| 월간 백업 | 매월 1일 23:00 | AWS S3 (장기 보관) |

---

## 💾 백업 용량 예측

| 날짜 | 파일 수 | 크기 | 누적 |
|------|--------|------|------|
| 2026-05-24 | 3 | 219 KB | 219 KB |
| 2026-06-24 | 3 | 219 KB | 438 KB |
| 2026-12-24 | 3 | 219 KB | 1.3 MB |
| 2027-05-24 | 3 | 219 KB | 2.6 MB |

**Google Drive 용량**: 15GB (대부분 미사용)  
**예상 사용 가능 기간**: ~60년 (일일 백업 기준)

---

## 🆘 트러블슈팅

### 문제: "파일을 업로드할 수 없습니다"

**확인 사항**:
1. Google Drive 계정이 활성화되어 있는가?
2. 폴더 ID가 올바른가? (1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz)
3. 서비스 계정이 폴더에 대한 접근 권한이 있는가?
4. 인터넷 연결이 정상인가?

**해결 방법**:
```bash
# 폴더 공유 재설정
# 1. Google Drive에서 폴더 열기
# 2. 공유 버튼 클릭
# 3. cruisedot@cruisedot-478810.iam.gserviceaccount.com 추가
# 4. 편집 권한 부여
```

---

### 문제: "Token 만료됨" 에러

**해결 방법**:
```bash
# Node.js 스크립트 재실행 (새 토큰 생성)
node scripts/upload-backups-to-gdrive.js

# 또는 CLI 도구 재인증
gdrive auth
```

---

### 문제: 업로드 속도가 느림

**원인 및 해결**:
- **네트워크 대역폭 부족**: WiFi 재연결, 더 빠른 네트워크 사용
- **대용량 파일**: 파일 크기 확인 (현재 219 KB는 매우 작음)
- **Google Drive 과부하**: 다른 시간대에 재시도

---

## 📞 지원 연락처

- **개발팀**: hyeseon28@gmail.com
- **Google Drive 문제**: support.google.com/drive
- **Node.js 도움**: nodejs.org

---

## 📝 완료 체크리스트

업로드 완료 후 다음 항목을 확인하세요:

- [ ] 3개 파일이 Google Drive에 업로드됨
- [ ] 각 파일의 Google Drive ID 기록됨
- [ ] UPLOAD_MANIFEST_2026-05-24.json 생성됨
- [ ] UPLOAD_REPORT_2026-05-24.json 생성됨
- [ ] 폴더 접근 권한이 올바르게 설정됨
- [ ] 복구 테스트 완료 (선택사항)
- [ ] 다음 백업 스케줄 설정됨

---

**마지막 업데이트**: 2026-05-24 22:30 UTC+9  
**작성자**: Claude Code Agent  
**버전**: 1.0
