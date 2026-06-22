# M3-5 상세 테스트 시나리오 (실행 가이드)

**Purpose**: M3-5 통합 테스트의 구체적인 실행 절차 및 검증 방법  
**Target**: QA 엔지니어, 테스트 자동화 담당자  
**Created**: 2026-06-22  
**Status**: Ready for Execution

---

## 🧪 테스트 시나리오 실행 방법

### 시나리오 구조

각 시나리오는 다음과 같이 구성됩니다:

```
📌 시나리오 ID: 1-1
📝 제목: 정상 목록 조회
🎯 목표: LIST API가 파일 목록을 정상 반환하는지 확인

📋 사전 조건:
  - Trip: ID=123, Organization=test-org-1
  - Google Drive: 20개 파일 저장됨

📝 실행 절차:
  Step 1: GET /api/backup/passport/123 호출
  Step 2: Authorization 헤더에 유효한 토큰 포함
  Step 3: limit=20, offset=0 파라미터 전달

✅ 예상 결과:
  - HTTP 200
  - Response: { ok: true, data: { files: [...], pagination: {...} } }

🔍 검증 항목:
  - response.ok === true
  - Array.isArray(response.data.files)
  - response.data.files.length === 20
  - response.data.pagination.hasMore === false

⏱️ 소요 시간: < 500ms
```

---

## 1️⃣ M3-1: REST 엔드포인트 시나리오 (12개)

### 시나리오 1-1: 정상 목록 조회

```
📌 ID: 1-1
📝 제목: GET /api/backup/passport/{tripId} - 정상 목록 조회

🎯 검증: API가 파일 목록을 정상 반환

📋 사전 조건:
  Trip ID: 123
  Organization: test-org-1
  Files: 20개 (JSON + WebP 혼합)
  User: OWNER role

🔧 테스트 코드:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/123?limit=20&offset=0',
    {
      headers: {
        'Authorization': 'Bearer ' + ownerToken,
        'Content-Type': 'application/json'
      }
    }
  );

✅ 예상 결과:
  Status: 200
  Body: {
    ok: true,
    data: {
      tripId: 123,
      files: [
        {
          id: 'drive-file-1',
          name: 'guest-1.webp',
          createdAt: '2026-06-22T10:00:00Z',
          size: 250000,
          mimeType: 'image/webp'
        },
        // ... 19개 더
      ],
      pagination: {
        total: 20,
        limit: 20,
        offset: 0,
        hasMore: false
      }
    },
    timestamp: '2026-06-22T10:05:00Z'
  }

🔍 검증 코드:
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.ok, true);
  assert(Array.isArray(response.data.files));
  assert.strictEqual(response.data.files.length, 20);
  assert.strictEqual(response.data.pagination.hasMore, false);

📊 성능:
  응답 시간: 300-500ms
  네트워크: 정상

⏰ 소요 시간: 2분
```

### 시나리오 1-2: 빈 목록 (파일 없음)

```
📌 ID: 1-2
📝 제목: 파일이 없는 Trip의 목록 조회

🎯 검증: 빈 배열을 정상 반환

📋 사전 조건:
  Trip ID: 999 (파일 없음)
  Organization: test-org-1

🔧 테스트:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/999',
    { headers: { 'Authorization': 'Bearer ' + ownerToken } }
  );

✅ 예상 결과:
  Status: 200
  Body.data.files: []
  Body.data.pagination.total: 0
  Body.data.pagination.hasMore: false

🔍 검증:
  assert.deepStrictEqual(response.data.files, []);
  assert.strictEqual(response.data.pagination.total, 0);
```

### 시나리오 1-3: Pagination - 첫 페이지

```
📌 ID: 1-3
📝 제목: Pagination - 첫 페이지 (offset=0)

🎯 검증: limit=20으로 처음 20개 반환, hasMore=true

📋 사전 조건:
  Trip ID: 123
  파일 개수: 50개

🔧 테스트:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/123?limit=20&offset=0',
    { headers: { 'Authorization': 'Bearer ' + token } }
  );

✅ 예상 결과:
  Status: 200
  files.length: 20
  pagination.hasMore: true (21개 이상 있으므로)
  pagination.total: 50
  files[0].createdAt >= files[1].createdAt (역시간순)
```

### 시나리오 1-4: Pagination - 두 번째 페이지

```
📌 ID: 1-4
📝 제목: Pagination - 두 번째 페이지 (offset=20)

🔧 테스트:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/123?limit=20&offset=20',
    { headers: { 'Authorization': 'Bearer ' + token } }
  );

✅ 예상 결과:
  Status: 200
  files.length: 20 (더 있으면 20, 없으면 10)
  pagination.hasMore: false (마지막 페이지)
```

### 시나리오 1-5: Trip 없음 (404)

```
📌 ID: 1-5
📝 제목: 존재하지 않는 Trip 조회

🎯 검증: 404 Not Found 반환

🔧 테스트:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/99999',
    { headers: { 'Authorization': 'Bearer ' + ownerToken } }
  );

✅ 예상 결과:
  Status: 404
  Body: { error: 'Trip을 찾을 수 없습니다' }

🔍 검증:
  assert.strictEqual(response.status, 404);
  assert(response.error.includes('Trip'));
```

### 시나리오 1-6: 권한 없음 (다른 조직)

```
📌 ID: 1-6
📝 제목: 다른 조직의 Trip에 접근

🎯 검증: 403 Forbidden 반환

📋 사전 조건:
  Trip ID: 123 (Organization: test-org-1에 속함)
  User: 다른 조직 (test-org-2) 사용자

🔧 테스트:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/123',
    { headers: { 'Authorization': 'Bearer ' + otherOrgUserToken } }
  );

✅ 예상 결과:
  Status: 403
  Body: { error: '권한이 없습니다' }

🔍 검증:
  assert.strictEqual(response.status, 403);
  assert(response.error.includes('권한'));
```

### 시나리오 1-7: 인증 없음 (401)

```
📌 ID: 1-7
📝 제목: 토큰 없이 접근

🎯 검증: 401 Unauthorized 반환

🔧 테스트:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/123'
    // Authorization 헤더 없음
  );

✅ 예상 결과:
  Status: 401
  Body: { error: '인증이 필요합니다' }
```

### 시나리오 1-8: 토큰 만료 후 갱신 재시도

```
📌 ID: 1-8
📝 제목: Google Drive 토큰 만료 시 자동 갱신

🎯 검증: 토큰 갱신 후 성공적으로 파일 목록 반환

📋 사전 조건:
  GmTripGoogleDriveConfig.accessTokenExpiresAt: now - 1분
  refreshToken: 유효함

🔧 테스트:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/123',
    { headers: { 'Authorization': 'Bearer ' + ownerToken } }
  );
  // 내부에서 토큰 갱신 발생

✅ 예상 결과:
  Status: 200
  자동으로 accessToken 갱신됨
  DB에 새 토큰 저장됨

🔍 검증:
  // DB 확인
  const config = await prisma.gmTripGoogleDriveConfig.findUnique({
    where: { tripId: 123 }
  });
  assert(config.accessTokenExpiresAt > new Date());
```

### 시나리오 1-9~1-12: 추가 시나리오

```
1-9: 파일명 정렬 확인 (createdTime 역순)
1-10: 파일 크기 검증 (size > 0)
1-11: MIME 타입 검증 (application/json, image/webp)
1-12: 대량 파일 (1000+) 성능 테스트 (< 500ms)
```

---

## 2️⃣ M3-2: Google Drive 통합 시나리오 (13개)

### 시나리오 4-1: 유효한 토큰 (갱신 불필요)

```
📌 ID: 4-1
📝 제목: 토큰이 유효할 때 (갱신 불필요)

🎯 검증: DB 업데이트 없이 기존 토큰 사용

📋 사전 조건:
  accessTokenExpiresAt: now + 10분 (5분 이상 남음)

🔧 테스트:
  const token = await getOrRefreshTripAccessToken(123);

✅ 예상 결과:
  - 토큰 반환됨
  - DB UPDATE 발생 안 함
  - Google Drive API 호출 성공

🔍 검증:
  assert.strictEqual(typeof token, 'string');
  assert(token.length > 0);
  // DB 업데이트 로그 없음 확인
```

### 시나리오 4-2: 토큰 거의 만료 (5분 전)

```
📌 ID: 4-2
📝 제목: 토큰이 5분 이내로 만료될 예정

🎯 검증: 자동 갱신 실행

📋 사전 조건:
  accessTokenExpiresAt: now + 3분 (5분 미만)
  refreshToken: 유효함

🔧 테스트:
  const token = await getOrRefreshTripAccessToken(123);

✅ 예상 결과:
  - 새로운 accessToken 반환
  - refreshToken으로 갱신 실행
  - DB에 새 토큰 저장
  - accessTokenExpiresAt 업데이트됨

🔍 검증:
  const config = await prisma.gmTripGoogleDriveConfig.findUnique({
    where: { tripId: 123 }
  });
  assert(config.accessTokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000));
```

### 시나리오 4-3: 토큰 만료 (API 호출 중)

```
📌 ID: 4-3
📝 제목: API 호출 중 토큰이 만료되는 경우 (401 응답)

🎯 검증: 자동 재시도 후 성공

🔧 테스트 흐름:
  Step 1: listBackupFilesInTrip() 호출
  Step 2: Google Drive API가 401 응답
  Step 3: 토큰 갱신 (refreshToken 사용)
  Step 4: 자동 재시도

✅ 예상 결과:
  - 최종 응답: 200 + 파일 목록
  - 1회 재시도만 실행 (무한 루프 방지)
  - DB에 새 토큰 저장됨
```

### 시나리오 4-4: 갱신 실패 (RefreshToken 무효)

```
📌 ID: 4-4
📝 제목: refreshToken이 유효하지 않은 경우

🎯 검증: 500 에러 + Slack 알림

📋 사전 조건:
  refreshToken: 유효하지 않음 (만료 또는 취소됨)

🔧 테스트:
  const token = await getOrRefreshTripAccessToken(123);
  // Google OAuth 401 응답

✅ 예상 결과:
  - 예외 발생: "Token 갱신 실패"
  - Slack 알림 전송
  - 수동 개입 필요
```

### 시나리오 5-1~5-6: 다운로드 시나리오

```
5-1: 정상 다운로드 (첫 시도) → 200
5-2: 네트워크 오류 (첫 시도) → 재시도 후 성공
5-3: 3회 모두 실패 → 500 에러
5-4: 타임아웃 (55초 이상) → 408 Timeout
5-5: 100MB 파일 다운로드 → 스트리밍 확인
5-6: 청크 다운로드 → 최종 해시 검증
```

### 시나리오 6-1~6-5: Google Drive API 에러 처리

```
6-1: 401 Unauthorized → 토큰 갱신 재시도
6-2: 403 Forbidden → 권한 검증 실패
6-3: 404 Not Found → 파일 없음 에러
6-4: 429 Rate Limited → 지수 백오프 재시도
6-5: 500 Server Error → 재시도 (3회)
```

---

## 3️⃣ M3-3: 권한 검증 시나리오 (14개)

### 시나리오 7-1: 같은 조직의 Trip (소유권 확인)

```
📌 ID: 7-1
📝 제목: 같은 조직의 Trip - 소유권 있음

🎯 검증: verifyTripOwnership() = true

📋 사전 조건:
  Trip ID: 123, Organization: test-org-1
  User: test-org-1에 속한 사용자

🔧 테스트:
  const ok = await verifyTripOwnership(123, 'test-org-1');

✅ 예상 결과:
  - ok: true
  - DB 조회 성공
  - organizationId 일치
```

### 시나리오 7-2: 다른 조직의 Trip (소유권 없음)

```
📌 ID: 7-2
📝 제목: 다른 조직의 Trip - 소유권 없음

🔧 테스트:
  const ok = await verifyTripOwnership(123, 'test-org-2');

✅ 예상 결과:
  - ok: false
  - organizationId 불일치
```

### 시나리오 8-1~8-13: 역할 기반 권한

```
8-1 ~ 8-3: OWNER role
  ├─ list: ✅ 허용
  ├─ download: ✅ 허용
  └─ restore: ✅ 허용

8-4 ~ 8-6: ADMIN role
  ├─ list: ✅ 허용
  ├─ download: ✅ 허용
  └─ restore: ✅ 허용

8-7 ~ 8-9: MANAGER role
  ├─ list: ✅ 허용
  ├─ download: ✅ 허용
  └─ restore: ❌ 거부 (403)

8-10 ~ 8-13: VIEWER role
  ├─ list: ❌ 거부 (403)
  ├─ download: ❌ 거부 (403)
  └─ restore: ❌ 거부 (403)
```

### 시나리오 9-1~9-4: 파일 접근 권한

```
9-1: 같은 Trip의 파일 → ✅ 허용
9-2: 다른 Trip의 파일 → ❌ 거부 (403)
9-3: Google Drive 설정 없음 → ❌ 거부
9-4: 삭제된 파일 → ❌ 404
```

### 시나리오 10-1~10-6: 감사 로깅

```
📌 ID: 10-1
📝 제목: LIST 액션 로깅

🎯 검증: PassportBackupRestoreLog 테이블에 기록됨

🔧 테스트:
  await fetch(
    'http://localhost:3000/api/backup/passport/123',
    { headers: { 'Authorization': 'Bearer ' + ownerToken } }
  );

✅ 예상 결과:
  PassportBackupRestoreLog 생성:
  {
    organizationId: 'test-org-1',
    tripId: 123,
    userId: 'user-1',
    userName: 'John Doe',
    action: 'LIST',
    status: 'SUCCESS',
    ipAddress: '127.0.0.1',
    timestamp: now()
  }

🔍 검증:
  const log = await prisma.passportBackupRestoreLog.findFirst({
    where: { tripId: 123, action: 'LIST' },
    orderBy: { timestamp: 'desc' }
  });
  assert.strictEqual(log.status, 'SUCCESS');
  assert(log.ipAddress);

추가:
10-2: DOWNLOAD 액션 로깅 (fileId 저장)
10-3: RESTORE 액션 로깅 (restoredCount 저장)
10-4: 실패 액션 로깅 (status=FAILED, errorMessage)
10-5: IP 주소 로깅
10-6: 타임스탬프 로깅
```

---

## 4️⃣ M3-4: 데이터베이스 복구 시나리오 (11개)

### 시나리오 11-1: JSON 파일 파싱

```
📌 ID: 11-1
📝 제목: 유효한 JSON 파일 파싱

🎯 검증: guests[] 배열 추출

📋 파일 내용:
{
  "format": "json",
  "guests": [
    {
      "guestId": "g1",
      "passportNumber": "A1234567",
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1990-01-01",
      "nationality": "US",
      ...
    }
  ],
  "metadata": {
    "backupAt": "2026-06-22T10:00:00Z",
    "version": "1.0"
  }
}

🔧 테스트:
  const buffer = await downloadFile();
  const data = await extractBackupData(buffer, 'application/json');

✅ 예상 결과:
  data.format: 'json'
  data.guests: Array(length > 0)
  data.metadata.backupAt: valid ISO 8601
```

### 시나리오 12-1: 새 게스트 추가

```
📌 ID: 12-1
📝 제목: 백업에는 있지만 DB에는 없는 게스트 추가

🎯 검증: INSERT 1행

📋 사전 조건:
  DB: 게스트 없음
  Backup: guest-1, guest-2, guest-3

🔧 테스트:
  const result = await restoreGuestsFromBackup(
    123, 'test-org-1',
    backupData,
    { action: 'restore_all', overwrite: false }
  );

✅ 예상 결과:
  result.restoredCount: 3
  result.errorCount: 0
  DB에 3명의 게스트 생성됨

🔍 검증:
  const guests = await prisma.gmPassportSubmissionGuest.findMany({
    where: { submission: { tripId: 123 } }
  });
  assert.strictEqual(guests.length, 3);
```

### 시나리오 12-2: 기존 게스트 보존

```
📌 ID: 12-2
📝 제목: overwrite=false일 때 기존 데이터 보존

🎯 검증: 기존 게스트는 업데이트 안 됨

📋 사전 조건:
  DB: guest-1 (firstName='Jane')
  Backup: guest-1 (firstName='John')

🔧 테스트:
  await restoreGuestsFromBackup(..., { overwrite: false });

✅ 예상 결과:
  DB의 guest-1.firstName: 'Jane' (변경 안 됨)
  result.restoredCount: 0
```

### 시나리오 12-3: 기존 게스트 덮어쓰기

```
📌 ID: 12-3
📝 제목: overwrite=true일 때 기존 데이터 갱신

📋 사전 조건:
  DB: guest-1 (firstName='Jane')
  Backup: guest-1 (firstName='John')

🔧 테스트:
  await restoreGuestsFromBackup(..., { overwrite: true });

✅ 예상 결과:
  DB의 guest-1.firstName: 'John' (변경됨)
  result.restoredCount: 1
```

### 시나리오 12-4: 선택 필드 복구

```
📌 ID: 12-4
📝 제목: 특정 필드만 복구

📋 사전 조건:
  DB: guest-1 (firstName='Jane', lastName='Smith')
  Backup: guest-1 (firstName='John', lastName='Doe')

🔧 테스트:
  await restoreGuestsFromBackup(
    123, 'test-org-1',
    backupData,
    { 
      action: 'restore_fields',
      fields: ['firstName']
    }
  );

✅ 예상 결과:
  DB: guest-1 (firstName='John', lastName='Smith')
  firstName만 업데이트됨
```

### 시나리오 12-5~12-11: 추가 시나리오

```
12-5: 100명 복구 (일반적인 크기)
12-6: 1000명 복구 (대규모, 성능 확인)
12-7: 부분 실패 (50/100 유효)
12-8: 중복 여권번호 처리
12-9: 필수 필드 누락 (passportNumber=null)
12-10: 날짜 형식 검증 (ISO 8601)
12-11: 트랜잭션 롤백 (DB 오류 시)
```

---

## 5️⃣ M3-5: 통합 E2E 시나리오 (10개)

### 시나리오 14-1: 정상 E2E 흐름

```
📌 ID: 14-1
📝 제목: 전체 흐름 (LIST → DOWNLOAD → RESTORE)

🎯 검증: 모든 단계 성공

📋 사전 조건:
  Trip: ID=123
  Files: 20개
  User: OWNER role
  Permissions: 모두 유효함

🔧 테스트:
  // Step 1: LIST
  const listRes = await fetch(
    'http://localhost:3000/api/backup/passport/123',
    { headers: { 'Authorization': 'Bearer ' + token } }
  );
  assert.strictEqual(listRes.status, 200);
  const { files } = await listRes.json();

  // Step 2: DOWNLOAD
  const downloadRes = await fetch(
    `http://localhost:3000/api/backup/passport/123/download/${files[0].id}`,
    { headers: { 'Authorization': 'Bearer ' + token } }
  );
  assert.strictEqual(downloadRes.status, 200);

  // Step 3: RESTORE
  const restoreRes = await fetch(
    `http://localhost:3000/api/backup/passport/123/restore/${files[0].id}`,
    {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ action: 'restore_all' })
    }
  );
  assert.strictEqual(restoreRes.status, 200);

✅ 예상 결과:
  All steps: 200
  Data restored successfully
  Audit log created
```

### 시나리오 14-2: 권한 체크 E2E

```
📌 ID: 14-2
📝 제목: 권한 없는 사용자의 E2E

🎯 검증: 첫 번째 단계에서 403으로 조기 종료

📋 사전 조건:
  User: VIEWER role
  Trip: test-org-1 의 Trip 123

🔧 테스트:
  const response = await fetch(
    'http://localhost:3000/api/backup/passport/123',
    { headers: { 'Authorization': 'Bearer ' + viewerToken } }
  );

✅ 예상 결과:
  Status: 403
  Subsequent steps: 실행 안 됨
```

### 시나리오 14-3: 토큰 갱신 E2E

```
📌 ID: 14-3
📝 제목: Google Drive 토큰 갱신이 필요한 E2E

📋 사전 조건:
  accessTokenExpiresAt: now + 2분
  refreshToken: 유효함

🔧 테스트:
  // LIST 호출 중 토큰 갱신 자동 실행

✅ 예상 결과:
  Status: 200
  Token automatically refreshed
  DB: new token saved
```

### 시나리오 14-4: 네트워크 재시도 E2E

```
📌 ID: 14-4
📝 제목: 네트워크 오류 후 자동 복구

🎯 검증: 3회 재시도 후 성공

📋 사전 조건:
  Network: 500ms 타임아웃 → 복구 → 성공

✅ 예상 결과:
  Final Status: 200
  Internal Retries: 3회
```

### 시나리오 14-5~14-10: 추가 E2E 시나리오

```
14-5: 대량 파일 E2E (페이징)
14-6: 부분 실패 복구 E2E
14-7: 동시 요청 E2E (Race condition 없음)
14-8: 시간 초과 E2E (55초 이상)
14-9: 장기 실행 E2E (1시간 연속)
14-10: 롤백 E2E (트랜잭션 실패)
```

---

## 🚀 성능 테스트 실행

### 시나리오 15-1: LIST API 응답시간

```bash
# k6 스크립트 (성능 테스트)
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m30s', target: 20 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<600'],
    'http_req_failed': ['rate<0.1'],
  }
};

export default function() {
  let response = http.get(
    'http://localhost:3000/api/backup/passport/123',
    { headers: { Authorization: 'Bearer ' + token } }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### 시나리오 15-2~15-7: 다른 성능 테스트

```
15-2: DOWNLOAD (1MB) < 1초
15-3: DOWNLOAD (50MB) < 3초
15-4: RESTORE (100명) < 5초
15-5: RESTORE (1000명) < 10초
15-6: 토큰 갱신 < 2초
15-7: SHA256 검증 < 1초
```

---

## 🔐 보안 테스트 실행

### 시나리오 18-1: 토큰 없이 접근

```
🔧 요청:
GET /api/backup/passport/123
(Authorization 헤더 없음)

✅ 예상:
Status: 401
Body: { error: '인증이 필요합니다' }
```

### 시나리오 18-2: 유효하지 않은 토큰

```
🔧 요청:
Authorization: Bearer invalid_token_12345

✅ 예상:
Status: 401
Body: { error: 'Invalid token' }
```

### 시나리오 18-3: 권한 부족

```
🔧 요청:
Authorization: Bearer viewer_token
Endpoint: POST /api/backup/passport/123/restore/file-1

✅ 예상:
Status: 403
Body: { error: '복구 권한이 없습니다' }
```

### 시나리오 18-4~18-5: 추가 보안 테스트

```
18-4: 다른 조직 사용자 (403)
18-5: 토큰 위조 (401)
```

---

## ✅ 최종 체크인

모든 시나리오 실행 후:

```
✅ 테스트 결과
  - [ ] 모든 시나리오 통과 (50+)
  - [ ] 성능 SLA 달성
  - [ ] 보안 검증 완료

✅ 코드 품질
  - [ ] npx tsc --noEmit 0 에러
  - [ ] ESLint 0 경고
  - [ ] 커버리지 90%+

✅ 배포 준비
  - [ ] 릴리스 노트 작성
  - [ ] 롤백 계획 수립
  - [ ] 모니터링 설정

✅ 최종 승인
  - [ ] QA 승인
  - [ ] 보안 승인
  - [ ] 배포 승인
```

---

**Version**: M3-5 Test Scenarios v1.0  
**Created**: 2026-06-22  
**Owner**: Agent-Test (Team 5)  
**Status**: Ready for Execution
