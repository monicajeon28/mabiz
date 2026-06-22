# M3-5 통합 테스트 검토 및 계획 (2026-06-22)

**Phase**: Phase 1C (Passport 백업 심화)  
**마일스톤**: M3-5 (Restore API 통합 테스트)  
**담당**: Agent-Test (Team 5 - QA + Deployment)  
**상태**: 🚀 준비 완료 (M2 완료 후 즉시 실행)  
**예상 기간**: 4-5시간  
**목표**: 50+ 테스트 케이스 설계 + 실행 + 검증

---

## 📋 테스트 전략 개요

### M3 Restore API의 테스트 목표

| 축 | 목표 | 성공 기준 |
|------|------|---------|
| **기능성** | 3개 API + 권한 검증 | 50+ 테스트 케이스 통과 |
| **보안** | 조직/Trip/역할 격리 | 모든 401/403 시나리오 커버 |
| **성능** | 응답시간 SLA | 목록<500ms, 다운로드<3초, 복구<10초 |
| **안정성** | 오류 처리 + 재시도 | 토큰 갱신, 타임아웃, 네트워크 실패 |
| **데이터 무결성** | 트랜잭션 보호 | 부분 실패 시 롤백 확인 |

---

## 🧪 50+ 테스트 케이스 분류

### 1️⃣ M3-1: REST 엔드포인트 (12개 케이스)

#### 1.1 GET /api/backup/passport/{tripId} - 목록 조회

| # | 테스트명 | 입력 | 예상 결과 | 검증 항목 |
|---|----------|------|---------|---------|
| **1-1** | 정상 목록 조회 | 유효한 tripId | 200 + 파일 배열 | `ok=true`, `files[]`, `pagination` |
| **1-2** | 빈 목록 (파일 없음) | Trip 파일 0개 | 200 + `files=[]` | `total=0`, `hasMore=false` |
| **1-3** | Pagination - 첫 페이지 | limit=20, offset=0 | 200 + 20개 | `hasMore=true` (21개 이상일 때) |
| **1-4** | Pagination - 두 번째 페이지 | limit=20, offset=20 | 200 + 나머지 | `hasMore=false` (마지막일 때) |
| **1-5** | Trip 없음 (404) | tripId=99999 | 404 | `error="Trip 없음"` |
| **1-6** | 권한 없음 (다른 조직) | 다른 조직 Trip | 403 | `error="권한 없음"` |
| **1-7** | 인증 없음 (401) | 토큰 없음 | 401 | `error="인증 필요"` |
| **1-8** | 토큰 만료 (갱신 후 재시도) | 만료된 토큰 | 재시도 후 200 | 토큰 갱신 로그 확인 |
| **1-9** | 파일명 정렬 | 최신순 정렬 | 200 + 역시간순 | `files[0].createdAt >= files[1].createdAt` |
| **1-10** | 파일 크기 검증 | 다양한 크기 | 200 | `files[].size > 0` |
| **1-11** | MIME 타입 검증 | JSON/WebP 혼합 | 200 | `mimeType in ['application/json', 'image/webp']` |
| **1-12** | 대량 파일 (1000+) | 대량 파일 Trip | 200 + 페이징 | 응답시간 < 500ms |

#### 1.2 GET /api/backup/passport/{tripId}/download/{fileId} - 파일 다운로드

| # | 테스트명 | 입력 | 예상 결과 | 검증 항목 |
|---|----------|------|---------|---------|
| **2-1** | 정상 다운로드 (JSON) | 유효한 fileId | 200 + JSON | `Content-Type=application/json` |
| **2-2** | 정상 다운로드 (WebP) | 유효한 fileId | 200 + 이미지 | `Content-Type=image/webp` |
| **2-3** | 파일 없음 (404) | fileId=invalid | 404 | `error="파일 없음"` |
| **2-4** | 다른 Trip의 파일 (403) | 다른 Trip fileId | 403 | `error="파일 접근 권한 없음"` |
| **2-5** | 권한 없음 (403) | 다른 조직 사용자 | 403 | `error="권한 없음"` |
| **2-6** | 대용량 다운로드 (50MB) | 50MB 파일 | 200 | 응답시간 < 3초 |
| **2-7** | 청크 다운로드 | 100MB+ 파일 | 스트리밍 | `Content-Length` 헤더 |
| **2-8** | 토큰 만료 (갱신 재시도) | 만료된 토큰 | 재시도 후 200 | 자동 토큰 갱신 |
| **2-9** | 파일 손상 (SHA256 실패) | 손상된 파일 | 500 + 재시도 | 3회 재시도 후 실패 |
| **2-10** | 범위 요청 (Range Header) | Range: bytes=0-999 | 206 Partial Content | Content-Range 헤더 |

#### 1.3 POST /api/backup/passport/{tripId}/restore/{fileId} - 복구

| # | 테스트명 | 입력 | 예상 결과 | 검증 항목 |
|---|----------|------|---------|---------|
| **3-1** | 전체 복구 (restore_all) | action=restore_all | 200 + 복구됨 | `restoredGuests > 0` |
| **3-2** | 선택 필드 복구 | fields=["firstName","lastName"] | 200 | 해당 필드만 업데이트 |
| **3-3** | 덮어쓰기 금지 (overwrite=false) | 기존 게스트 | 200 | 새 게스트만 생성 |
| **3-4** | 덮어쓰기 허용 (overwrite=true) | 기존 게스트 | 200 | 기존 데이터 갱신 |
| **3-5** | 부분 실패 (3/5 성공) | 일부 잘못된 데이터 | 200 | `restoredCount=3, errorCount=2` |
| **3-6** | 복구 권한 - OWNER | OWNER 역할 | 200 | 복구 성공 |
| **3-7** | 복구 권한 - ADMIN | ADMIN 역할 | 200 | 복구 성공 |
| **3-8** | 복구 권한 - MANAGER (거부) | MANAGER 역할 | 403 | `error="복구 권한 없음"` |
| **3-9** | 파일 없음 (404) | fileId=invalid | 404 | `error="파일 없음"` |
| **3-10** | 잘못된 action | action=invalid | 400 | `error="잘못된 요청"` |

---

### 2️⃣ M3-2: Google Drive 통합 (13개 케이스)

#### 2.1 토큰 관리

| # | 테스트명 | 시나리오 | 예상 결과 | 검증 항목 |
|---|----------|---------|---------|---------|
| **4-1** | 유효한 토큰 (갱신 불필요) | expiresAt > now + 5min | 토큰 사용 | DB 업데이트 안 됨 |
| **4-2** | 토큰 거의 만료 (5분 전) | expiresAt < now + 5min | 자동 갱신 | refreshToken으로 새 accessToken |
| **4-3** | 토큰 만료 (API 호출 중) | 401 응답 | 재시도 + 갱신 | 한 번 재시도 후 성공 |
| **4-4** | 갱신 실패 (RefreshToken 무효) | refresh 401 | 500 에러 | Slack 알림 |
| **4-5** | 토큰 암호화 (저장 시) | accessToken 저장 | 암호화됨 | base64 또는 hex 확인 불가 |
| **4-6** | 토큰 복호화 (사용 시) | 저장된 accessToken | 원본과 동일 | Google Drive API 정상 작동 |

#### 2.2 파일 다운로드 + 재시도

| # | 테스트명 | 시나리오 | 예상 결과 | 검증 항목 |
|---|----------|---------|---------|---------|
| **5-1** | 정상 다운로드 (첫 시도) | 네트워크 정상 | 200 + 파일 | 1회 시도 |
| **5-2** | 네트워크 오류 (첫 시도) | 500ms 타임아웃 | 재시도 후 성공 | 3회 시도 (지수 백오프) |
| **5-3** | 3회 모두 실패 | 네트워크 다운 | 500 에러 | errorLog 기록 |
| **5-4** | 타임아웃 (55초 AbortSignal) | 느린 네트워크 | 500 에러 | AbortSignal.timeout 확인 |
| **5-5** | 100MB 파일 다운로드 | 대용량 파일 | 진행률 0-100% | 스트리밍 확인 |
| **5-6** | 청크 다운로드 | 1MB 단위 청크 | 모두 병합 | 최종 해시 검증 |

#### 2.3 Google Drive API 에러 처리

| # | 테스트명 | API 응답 | 예상 처리 | 검증 항목 |
|---|----------|----------|---------|---------|
| **6-1** | 401 Unauthorized | "Invalid token" | 토큰 갱신 재시도 | refreshToken 사용 |
| **6-2** | 403 Forbidden | "Access denied" | 권한 검증 실패 | 에러 로깅 |
| **6-3** | 404 Not Found | "File not found" | 파일 없음 에러 | PassportBackupRestoreLog 기록 |
| **6-4** | 429 Rate Limited | "Quota exceeded" | 재시도 (지수 백오프) | 5초, 10초, 20초 대기 |
| **6-5** | 500 Server Error | "Internal error" | 재시도 | 3회 후 실패 로깅 |

---

### 3️⃣ M3-3: 권한 검증 (14개 케이스)

#### 3.1 Trip 소유권 검증

| # | 테스트명 | 입력 | 예상 결과 | 검증 항목 |
|---|----------|------|---------|---------|
| **7-1** | 같은 조직의 Trip | organizationId 일치 | ✅ 소유권 확인 | DB 조회 결과 일치 |
| **7-2** | 다른 조직의 Trip | organizationId 불일치 | ❌ 소유권 없음 | false 반환 |
| **7-3** | Trip 없음 | tripId=99999 | ❌ 소유권 없음 | false 반환 |
| **7-4** | NULL organizationId (fallback) | organizationId=null | fallback: USER_{tripId} | 대체값 사용 |

#### 3.2 역할 기반 권한 검증

| # | 테스트명 | 역할 | 액션 | 예상 결과 |
|---|----------|------|------|---------|
| **8-1** | OWNER - list | OWNER | list | ✅ 허용 |
| **8-2** | OWNER - download | OWNER | download | ✅ 허용 |
| **8-3** | OWNER - restore | OWNER | restore | ✅ 허용 |
| **8-4** | ADMIN - list | ADMIN | list | ✅ 허용 |
| **8-5** | ADMIN - download | ADMIN | download | ✅ 허용 |
| **8-6** | ADMIN - restore | ADMIN | restore | ✅ 허용 |
| **8-7** | MANAGER - list | MANAGER | list | ✅ 허용 |
| **8-8** | MANAGER - download | MANAGER | download | ✅ 허용 |
| **8-9** | MANAGER - restore | MANAGER | restore | ❌ 거부 (403) |
| **8-10** | VIEWER - list | VIEWER | list | ❌ 거부 (403) |
| **8-11** | VIEWER - download | VIEWER | download | ❌ 거부 (403) |
| **8-12** | VIEWER - restore | VIEWER | restore | ❌ 거부 (403) |
| **8-13** | 없는 역할 (403) | null | any | ❌ 거부 (401) |

#### 3.3 파일 접근 권한 검증

| # | 테스트명 | 시나리오 | 예상 결과 | 검증 항목 |
|---|----------|---------|---------|---------|
| **9-1** | 같은 Trip의 파일 | fileId in Trip폴더 | ✅ 접근 허용 | Google Drive API 확인 |
| **9-2** | 다른 Trip의 파일 | fileId not in Trip폴더 | ❌ 접근 거부 (403) | parents[] 확인 |
| **9-3** | Google Drive 설정 없음 | googleDriveFolderId=null | ❌ 접근 거부 | 설정 없음 에러 |
| **9-4** | 삭제된 파일 | 파일 삭제됨 | ❌ 404 에러 | Google Drive API 404 |

#### 3.4 감사 로깅

| # | 테스트명 | 액션 | 기록되는 정보 | 검증 항목 |
|---|----------|------|-------------|---------|
| **10-1** | LIST 액션 로깅 | GET /list | action=LIST, status | PassportBackupRestoreLog 생성 |
| **10-2** | DOWNLOAD 액션 로깅 | GET /download | action=DOWNLOAD, fileId | 파일명 저장 |
| **10-3** | RESTORE 액션 로깅 | POST /restore | action=RESTORE, restoredCount | 복구 개수 저장 |
| **10-4** | 실패 액션 로깅 | 권한 없음 | status=FAILED, errorMessage | 에러 메시지 저장 |
| **10-5** | IP 주소 로깅 | 모든 액션 | ipAddress 저장 | 감사용 IP 기록 |
| **10-6** | 타임스탬프 로깅 | 모든 액션 | timestamp=now() | 시간 정확도 확인 |

---

### 4️⃣ M3-4: 데이터베이스 복구 (11개 케이스)

#### 4.1 백업 파일 파싱

| # | 테스트명 | 파일 형식 | 예상 결과 | 검증 항목 |
|---|----------|---------|---------|---------|
| **11-1** | JSON 파일 (guests[]) | 유효한 JSON | 파싱 성공 | guests[] 배열 추출 |
| **11-2** | JSON 메타데이터 | metadata 필드 | 메타데이터 추출 | backupAt, version 확인 |
| **11-3** | WebP 이미지 파일 | 유효한 WebP | 이미지 data 추출 | buffer + mimeType |
| **11-4** | JPEG 이미지 파일 | 유효한 JPEG | 이미지 data 추출 | buffer + mimeType |
| **11-5** | 손상된 JSON | 구문 에러 | 파싱 실패 (SyntaxError) | 에러 메시지 기록 |
| **11-6** | 지원하지 않는 형식 | .txt 파일 | 파싱 실패 | "지원하지 않는 형식" |

#### 4.2 게스트 데이터 복구

| # | 테스트명 | 데이터 상태 | 옵션 | 예상 결과 |
|---|----------|---------|------|---------|
| **12-1** | 새 게스트 추가 | 백업: guest-1 | overwrite=false | INSERT 1행 |
| **12-2** | 기존 게스트 보존 | DB: guest-1 존재 | overwrite=false | UPDATE 0행 (스킵) |
| **12-3** | 기존 게스트 덮어쓰기 | DB: guest-1 존재 | overwrite=true | UPDATE 1행 |
| **12-4** | 선택 필드만 복구 | fields=["firstName"] | restore_fields | firstName만 UPDATE |
| **12-5** | 100명 복구 | 100 guests | restore_all | restoredCount=100 |
| **12-6** | 1000명 복구 (성능) | 1000 guests | restore_all | < 10초 내 완료 |
| **12-7** | 부분 실패 (일부 유효하지 않은 데이터) | 50/100 유효 | restore_all | restoredCount=50, errorCount=50 |
| **12-8** | 중복 여권번호 처리 | 중복 passportNumber | overwrite=true | 마지막 데이터로 업데이트 |
| **12-9** | 필수 필드 누락 | passportNumber=null | restore_all | 해당 게스트 스킵 |
| **12-10** | 날짜 형식 검증 | dateOfBirth 유효성 | restore_all | ISO 8601 형식 확인 |
| **12-11** | 트랜잭션 롤백 | DB 오류 발생 | restore_all | 모든 변경사항 취소 |

#### 4.3 복구 이력 기록

| # | 테스트명 | 시나리오 | 기록되는 정보 | 검증 항목 |
|---|----------|---------|------------|---------|
| **13-1** | 성공 복구 이력 | restoredCount=100 | status=SUCCESS | PassportBackupRestoreLog 생성 |
| **13-2** | 부분 실패 이력 | errorCount > 0 | status=PARTIAL | 성공/실패 모두 기록 |
| **13-3** | 완전 실패 이력 | errorCount=100 | status=FAILED | 에러 메시지 저장 |
| **13-4** | 복구 개수 기록 | 100명 복구 | restoredCount=100 | 정확한 개수 저장 |

---

### 5️⃣ M3-5: 통합 E2E 테스트 (10개 케이스)

#### 5.1 전체 흐름

| # | 테스트명 | 시나리오 | 단계 | 예상 결과 |
|---|----------|---------|------|---------|
| **14-1** | 정상 E2E | 정상 조건 | 1. LIST → 2. DOWNLOAD → 3. RESTORE | 모두 200 |
| **14-2** | 권한 체크 E2E | VIEWER 역할 | 1. LIST (403) | 조기 종료 (403) |
| **14-3** | 토큰 갱신 E2E | 토큰 만료 | 1. LIST (갱신 후 200) | 자동 갱신 + 성공 |
| **14-4** | 네트워크 재시도 E2E | 네트워크 오류 | 1. LIST (재시도 후 200) | 3회 시도 후 성공 |
| **14-5** | 대량 파일 E2E | 100+ 파일 | 1. LIST 페이지 1 → 2. LIST 페이지 2 | 모두 200 |
| **14-6** | 부분 실패 복구 E2E | 50/100 유효 | 1. DOWNLOAD → 2. RESTORE | restoredCount=50 |
| **14-7** | 동시 요청 E2E | 병렬 LIST × 3 | 동시 요청 | 모두 200 (Race 없음) |
| **14-8** | 시간 초과 E2E | 느린 다운로드 | 1. DOWNLOAD 100MB (55초 이상) | 408 Timeout |
| **14-9** | 장기 실행 E2E | 1시간 연속 요청 | 100회 LIST | 모두 성공, 토큰 갱신 자동 |
| **14-10** | 롤백 E2E | 복구 중 DB 오류 | 1. RESTORE (트랜잭션 실패) | 모든 변경사항 취소 |

---

### 6️⃣ 성능 테스트 (7개 케이스)

#### 6.1 응답시간 SLA

| # | 테스트명 | 작업 | 데이터량 | SLA | 허용 범위 |
|---|----------|------|--------|-----|---------|
| **15-1** | LIST API 응답시간 | 20개 파일 목록 | 20 files | < 500ms | 100ms (overhead) |
| **15-2** | DOWNLOAD API 응답시간 | JSON 다운로드 | 1MB | < 1초 | 스트리밍 시작 |
| **15-3** | 대용량 DOWNLOAD | WebP 이미지 | 50MB | < 3초 | 청크 다운로드 |
| **15-4** | RESTORE API 응답시간 | 100명 복구 | 100 guests | < 5초 | 트랜잭션 포함 |
| **15-5** | 대규모 RESTORE | 1000명 복구 | 1000 guests | < 10초 | 배치 처리 |
| **15-6** | 토큰 갱신 시간 | OAuth 호출 | 1회 | < 2초 | Google OAuth API |
| **15-7** | 파일 해시 검증 | SHA256 계산 | 50MB | < 1초 | 암호화 성능 |

#### 6.2 메모리 사용량

| # | 테스트명 | 작업 | 피크 메모리 | 기준 | 검증 |
|---|----------|------|-----------|-----|------|
| **16-1** | 큰 파일 스트리밍 | 1GB 다운로드 | < 100MB | 청크 기반 | 메모리 누수 없음 |
| **16-2** | 대량 게스트 복구 | 10000명 | < 500MB | 배치 처리 | 스택 오버플로우 없음 |

#### 6.3 동시성 테스트

| # | 테스트명 | 동시 요청 | 시나리오 | 예상 결과 |
|---|----------|----------|---------|---------|
| **17-1** | 10개 LIST 동시 요청 | parallelism=10 | 동일 Trip | 모두 200 |
| **17-2** | 10개 RESTORE 동시 요청 | parallelism=10 | 다른 파일 | 모두 200 (원자성) |
| **17-3** | 혼합 요청 (LIST+RESTORE) | 5 LIST + 5 RESTORE | 동시 실행 | 데이터 일관성 유지 |

---

### 7️⃣ 보안 테스트 (8개 케이스)

#### 7.1 인증/권한

| # | 테스트명 | 시나리오 | 예상 결과 | 검증 항목 |
|---|----------|---------|---------|---------|
| **18-1** | 토큰 없이 접근 | Authorization 헤더 없음 | 401 | 인증 필수 |
| **18-2** | 유효하지 않은 토큰 | 잘못된 JWT | 401 | 토큰 검증 |
| **18-3** | 권한 없는 사용자 | VIEWER 역할 | 403 | 역할 검증 |
| **18-4** | 다른 조직 사용자 | organizationId 불일치 | 403 | 조직 격리 |
| **18-5** | 토큰 위조 | 수정된 payload | 401 | 서명 검증 |

#### 7.2 데이터 보안

| # | 테스트명 | 위협 | 예방 | 검증 항목 |
|---|----------|------|------|---------|
| **19-1** | SQL Injection | tripId에 SQL 삽입 | Prisma 파라미터 바인딩 | SQL 실행 안 됨 |
| **19-2** | XSS (파일명 조작) | <script> 파일명 | HTML escape | 파일명 렌더링 안 됨 |
| **19-3** | Path Traversal | fileId="../../../" | 파일 경로 검증 | 접근 거부 (403) |
| **19-4** | 토큰 누출 (로그) | 로그에 accessToken | 마스킹 처리 | 로그에 ***** |

#### 7.3 감사/추적

| # | 테스트명 | 액션 | 로깅 | 검증 항목 |
|---|----------|------|------|---------|
| **20-1** | 모든 액션 감사 로깅 | 모든 API 호출 | PassportBackupRestoreLog | 생성됨 |
| **20-2** | IP 주소 기록 | 요청 출처 | ipAddress 저장 | 조회 가능 |

---

## 🔄 테스트 실행 순서 및 의존성

### Phase 1: 단위 테스트 (병렬 가능)

```
Team 1 (API)      Team 2 (GDrive)    Team 3 (Auth)     Team 4 (DB)
├─ 1-1~1-12      ├─ 4-1~4-6        ├─ 7-1~10-6      ├─ 11-1~13-4
│ 12개            │ 6개              │ 14개           │ 11개
└─ 로컬 테스트    └─ Google API 테스트 └─ RBAC 검증    └─ 트랜잭션 검증
```

**소요 시간**: 각 팀별 1-2시간 (병렬)  
**검증**: npx tsc --noEmit, Jest 테스트

### Phase 2: 통합 테스트 (순차)

```
API (M3-1 완료) → GDrive (M3-2) → Auth (M3-3) → DB (M3-4)
   ↓
 M3-5 통합 E2E 테스트 (14-1~14-10, 10개 케이스)
```

**소요 시간**: 2-3시간  
**환경**: 스테이징 데이터베이스

### Phase 3: 성능 + 보안 테스트 (병렬)

```
성능 테스트 (15-1~17-3)    보안 테스트 (18-1~20-2)
├─ 응답시간 SLA            ├─ 인증/권한
├─ 메모리 사용            ├─ 데이터 보안
└─ 동시성                  └─ 감사/추적
```

**소요 시간**: 1-2시간  
**도구**: k6 (성능), OWASP ZAP (보안)

### Phase 4: 배포 전 최종 검증

```
체크리스트:
- [ ] 50+ 테스트 케이스 모두 통과
- [ ] npx tsc --noEmit 0 에러
- [ ] ESLint 0 경고
- [ ] npm run build 성공
- [ ] 보안 감사 완료
- [ ] 성능 SLA 확인
- [ ] Git 충돌 0개
```

---

## 📊 테스트 환경 준비

### 로컬 테스트 환경

```bash
# 1. 테스트 DB 초기화
npx prisma migrate deploy --preview-feature

# 2. 테스트 데이터 시드
npm run seed:test  # 또는 직접 생성

# 3. Google Drive 테스트 폴더
# 🗂️ 마비즈CRM-테스트-여권백업/
# ├─ Org-test-org-1/
# │  └─ Trip-123/
# │     ├─ 여권이미지/ (guest-1.webp, guest-2.webp)
# │     └─ OCR데이터/ (guest-1.json, guest-2.json)

# 4. 테스트 실행
npm run test:backup-restore  # 모든 테스트
npm run test:backup-restore -- --testPathPattern="M3-1"  # 특정 마일스톤
```

### 테스트 데이터 구성

```typescript
// test/fixtures/backup-restore.fixtures.ts

export const testTrip = {
  id: 123,
  organizationId: 'test-org-1',
  userId: 1,
};

export const testGuests = [
  {
    passportNumber: 'A1234567',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
  },
  // ... 50명 추가
];

export const testFiles = {
  json: {
    id: 'file-json-1',
    name: 'guest-1.json',
    mimeType: 'application/json',
    size: 15000,
    createdTime: '2026-06-22T10:00:00Z',
  },
  webp: {
    id: 'file-webp-1',
    name: 'guest-1.webp',
    mimeType: 'image/webp',
    size: 250000,
    createdTime: '2026-06-22T11:00:00Z',
  },
};
```

---

## ✅ 테스트 검증 체크리스트

### M3-1: REST 엔드포인트 (12개)

- [ ] 모든 12개 테스트 케이스 통과
- [ ] 응답 형식 검증 (JSON + HTTP 상태코드)
- [ ] 에러 메시지 일관성 확인
- [ ] TypeScript 타입 검증

### M3-2: Google Drive 통합 (13개)

- [ ] 토큰 관리 (6개)
- [ ] 다운로드 + 재시도 (6개)
- [ ] API 에러 처리 (5개)
- [ ] Google Drive API 할당량 확인

### M3-3: 권한 검증 (14개)

- [ ] Trip 소유권 (4개)
- [ ] 역할 기반 권한 (13개)
- [ ] 파일 접근 권한 (4개)
- [ ] 감사 로깅 (6개)
- [ ] PassportBackupRestoreLog 테이블 확인

### M3-4: 데이터베이스 복구 (11개)

- [ ] 파일 파싱 (6개)
- [ ] 게스트 복구 (11개)
- [ ] 복구 이력 (4개)
- [ ] 트랜잭션 원자성 확인

### M3-5: 통합 E2E (10개)

- [ ] 정상 흐름 (1-1 → 1-2 → 1-3)
- [ ] 권한 검증 흐름
- [ ] 토큰 갱신 흐름
- [ ] 네트워크 복원력
- [ ] 부분 실패 복구

### 성능 테스트 (7개)

- [ ] LIST: < 500ms
- [ ] DOWNLOAD (1MB): < 1초
- [ ] DOWNLOAD (50MB): < 3초
- [ ] RESTORE (100명): < 5초
- [ ] RESTORE (1000명): < 10초

### 보안 테스트 (8개)

- [ ] 인증 검증 (5개)
- [ ] 데이터 보안 (4개)
- [ ] 감사 추적 (2개)

### 전체 통합

- [ ] **총 50+ 테스트 케이스 모두 통과**
- [ ] npx tsc --noEmit **0 에러**
- [ ] ESLint **0 경고**
- [ ] npm run build **성공** (dev 서버 종료 후)
- [ ] **보안 감사** 완료
- [ ] **성능 SLA** 확인
- [ ] **모니터링** 설정

---

## 📈 테스트 커버리지 목표

| 영역 | 목표 | 현재 | 상태 |
|------|------|------|------|
| **라인** | 90% | 85% | 🔴 (5% 개선 필요) |
| **분기** | 85% | 80% | 🟡 (5% 개선 필요) |
| **함수** | 95% | 90% | 🟡 (5% 개선 필요) |
| **보안** | 100% | 95% | 🟡 (인증/권한) |

**개선 방법**:
1. 엣지 케이스 추가 (부분 실패, 타임아웃)
2. 권한 조합 테스트 (RBAC 매트릭스)
3. 에러 경로 테스트 (예외 처리)

---

## 🚀 배포 체크리스트

### Phase 1: 스테이징 배포

```
┌─────────────────────────────┐
│ 1. 코드 리뷰 완료           │
├─────────────────────────────┤
│ 2. 모든 테스트 통과         │
├─────────────────────────────┤
│ 3. npm run build 성공       │
├─────────────────────────────┤
│ 4. 스테이징에 배포          │
├─────────────────────────────┤
│ 5. 회귀 테스트 (수동)      │
├─────────────────────────────┤
│ 6. 성능 모니터링 24시간     │
└─────────────────────────────┘
```

### Phase 2: 프로덕션 배포

```
┌─────────────────────────────┐
│ 1. 최종 QA 승인             │
├─────────────────────────────┤
│ 2. 릴리스 노트 작성         │
├─────────────────────────────┤
│ 3. 롤백 계획 확인           │
├─────────────────────────────┤
│ 4. 프로덕션 배포            │
├─────────────────────────────┤
│ 5. 실시간 모니터링          │
├─────────────────────────────┤
│ 6. 사용자 피드백 수집       │
└─────────────────────────────┘
```

---

## 📝 테스트 리포트 템플릿

### 단위 테스트 리포트 (각 팀별)

```
📋 M3-1: REST 엔드포인트 테스트 리포트

테스트 실행 날짜: 2026-06-22
담당 팀: Team 1 (Agent-API)
테스트 환경: 로컬 (Windows 11, Node 20.x)

✅ 통과: 12/12 (100%)
  ├─ 1-1: 정상 목록 조회 ✓
  ├─ 1-2: 빈 목록 ✓
  ├─ ...
  └─ 1-12: 대량 파일 ✓

⚠️ 경고: 2개
  ├─ 응답시간 1-1: 450ms (SLA < 500ms ✓)
  └─ 응답시간 1-12: 480ms (대량 파일)

❌ 실패: 0개

성능 요약:
  평균 응답시간: 320ms
  최악의 경우: 480ms
  P99: 450ms

코드 커버리지:
  라인: 95/100 (95%) ✓
  분기: 18/20 (90%) ⚠️

다음 단계:
  - 분기 커버리지 2% 개선 필요
  - M3-2와 통합 테스트 준비
```

### 통합 테스트 리포트

```
📋 M3-5: 통합 E2E 테스트 리포트

테스트 실행 날짜: 2026-06-23
담당 팀: Team 5 (Agent-Test)
테스트 환경: 스테이징 (Ubuntu, Node 20.x, PostgreSQL 15)

✅ 통과: 10/10 (100%)
  ├─ 14-1: 정상 E2E ✓ (2100ms)
  ├─ 14-2: 권한 체크 ✓ (350ms)
  ├─ 14-3: 토큰 갱신 ✓ (3200ms)
  ├─ ...
  └─ 14-10: 롤백 E2E ✓ (5100ms)

성능 요약:
  평균: 2500ms
  최악: 5100ms (롤백 E2E)
  P99: 4500ms

보안 검증:
  인증: ✓ (401/403 모두 정상)
  권한: ✓ (RBAC 모든 조합)
  감사: ✓ (로그 기록 확인)

배포 준비:
  ✅ 모든 테스트 통과
  ✅ 성능 SLA 달성
  ✅ 보안 검증 완료
  ✅ 배포 준비 완료
```

---

## 📞 테스트 중 이슈 처리

### 예상 이슈 및 해결책

| 이슈 | 원인 | 해결책 |
|------|------|--------|
| **토큰 만료** | OAuth 토큰 유효기간 | `.env.local` 갱신 후 재실행 |
| **Google Drive API 할당량 초과** | Rate limiting | 1시간 대기 후 재실행 |
| **DB 연결 실패** | Supabase 다운 | DDL 수동 실행 또는 로컬 DB 사용 |
| **테스트 타임아웃** | 네트워크 지연 | 타임아웃 값 증가 (테스트용만) |
| **메모리 부족** | 대량 데이터 | 청크 크기 감소 또는 배치 처리 |

---

## 🎓 테스트 작성 가이드

### 테스트 구조 (Jest)

```typescript
describe('M3-1: REST Endpoints', () => {
  describe('GET /api/backup/passport/{tripId}', () => {
    beforeEach(async () => {
      // 테스트 데이터 준비
      await setupTestTrip();
      await uploadTestFiles();
    });

    afterEach(async () => {
      // 정리
      await cleanupTestData();
    });

    it('should return 200 with file list on success', async () => {
      // Arrange
      const tripId = 123;
      const token = getTestToken('owner@example.com');

      // Act
      const response = await fetch(
        `http://localhost:3000/api/backup/passport/${tripId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Assert
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data.files)).toBe(true);
    });

    it('should return 403 when user has no permission', async () => {
      // Arrange
      const tripId = 123; // 다른 조직의 Trip
      const token = getTestToken('viewer@other-org.com');

      // Act
      const response = await fetch(
        `http://localhost:3000/api/backup/passport/${tripId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Assert
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('권한 없음');
    });
  });
});
```

---

## 📅 예상 일정

```
2026-06-22 (Day 1): M3-1~4 구현 완료
├─ Team 1: M3-1 API (2-3시간)
├─ Team 2: M3-2 Google Drive (3-4시간)
├─ Team 3: M3-3 Authorization (2-3시간)
└─ Team 4: M3-4 Database (3-4시간)

2026-06-23 (Day 2): M3-5 테스트 실행
├─ 단위 테스트 (각 팀별, 병렬)
├─ 통합 E2E 테스트 (순차)
├─ 성능 + 보안 테스트 (병렬)
└─ 최종 검증

2026-06-24 (Day 3): 배포 준비
├─ 스테이징 배포
├─ 회귀 테스트 (수동)
└─ 프로덕션 준비

2026-06-25: 프로덕션 배포
```

---

## 🎯 성공 기준

✅ **M3-5 테스트 완료 조건**:

1. **50+ 테스트 케이스 모두 통과**
2. **코드 커버리지 90% 이상**
3. **성능 SLA 달성** (LIST < 500ms, DOWNLOAD < 3s, RESTORE < 10s)
4. **보안 감사 완료** (인증, 권한, 감사 로깅)
5. **npx tsc --noEmit 0 에러**
6. **배포 체크리스트 완료**

---

**작성일**: 2026-06-22  
**버전**: M3-5 Test Review v1.0  
**담당**: Agent-Test (Team 5)  
**예상 완료**: 2026-06-24  
**다음 단계**: 프로덕션 배포 (2026-06-25)
