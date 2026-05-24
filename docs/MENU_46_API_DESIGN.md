# Menu #46 (설정) - API 설계 명세 (2026-05-24)

## 📋 개요

**API 기본 경로**: `/api/settings`  
**인증**: JWT Bearer Token (모든 요청 필수)  
**컨텐츠 타입**: `application/json`  
**응답 형식**: JSON (공통 응답 래퍼)

---

## 🔒 공통 응답 형식

### 성공 응답
```json
{
  "ok": true,
  "data": {
    // 응답 데이터
  },
  "message": "작업 완료"
}
```

### 에러 응답
```json
{
  "ok": false,
  "error": "INVALID_REQUEST",
  "message": "필드 값이 유효하지 않습니다",
  "details": {
    "field": "email",
    "issue": "이미 사용 중인 이메일입니다"
  }
}
```

### HTTP 상태 코드
- `200 OK`: 성공
- `201 Created`: 생성 성공
- `400 Bad Request`: 유효성 검사 실패
- `401 Unauthorized`: 인증 실패
- `403 Forbidden`: 권한 부족
- `404 Not Found`: 리소스 없음
- `409 Conflict`: 중복 데이터
- `429 Too Many Requests`: Rate Limit 초과
- `500 Internal Server Error`: 서버 오류

---

## 📑 API 엔드포인트 상세

### 1️⃣ 프로필 관련 API

#### 1.1 GET `/api/settings/profile`
**설명**: 현재 사용자 프로필 조회

**인증**: 필수  
**권한**: 모든 역할 (조회만 가능)

**응답 예시**:
```json
{
  "ok": true,
  "data": {
    "id": "user_123",
    "name": "성민형",
    "email": "min@cruisedot.com",
    "phone": "010-1234-5678",
    "title": "OWNER",
    "bio": "크루즈 전문가",
    "profileImageUrl": "https://storage.googleapis.com/...",
    "signatureImageUrl": "https://storage.googleapis.com/...",
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

---

#### 1.2 PATCH `/api/settings/profile`
**설명**: 프로필 정보 수정

**인증**: 필수  
**권한**: AGENT/OWNER (자신의 프로필만)

**요청 바디**:
```json
{
  "name": "성민형",
  "phone": "010-1234-5678",
  "title": "OWNER",
  "bio": "크루즈 전문가"
}
```

**유효성 검사**:
- `name`: 1-50자, 필수
- `phone`: 010-XXXX-XXXX 형식, 선택
- `title`: OWNER/AGENT/FREE_SALES, 선택
- `bio`: 0-200자, 선택

**응답**:
```json
{
  "ok": true,
  "data": { /* 수정된 프로필 */ },
  "message": "프로필이 저장되었습니다"
}
```

**에러 케이스**:
- 400: 유효하지 않은 전화번호 형식
- 400: bio가 200자 초과
- 403: 다른 사용자의 프로필 수정 시도

---

#### 1.3 POST `/api/upload/avatar`
**설명**: 프로필 사진 업로드

**인증**: 필수  
**권한**: AGENT/OWNER (자신의 사진만)

**요청 타입**: `multipart/form-data`  
**필드**:
- `file`: Image (JPG/PNG), max 5MB, min 200x200px

**응답**:
```json
{
  "ok": true,
  "data": {
    "url": "https://storage.googleapis.com/...",
    "size": 2048576,
    "uploadedAt": "2026-05-24T14:30:00Z"
  },
  "message": "이미지가 업로드되었습니다"
}
```

**에러 케이스**:
- 400: 파일 크기 초과 (5MB)
- 400: 이미지 해상도 부족 (< 200x200)
- 415: 지원하지 않는 파일 형식

---

#### 1.4 POST `/api/upload/signature`
**설명**: 서명 이미지 업로드

**인증**: 필수  
**권한**: OWNER (조직의 공식 서명)

**요청**: 1.3과 동일  
**응답**: 1.3과 동일

---

#### 1.5 POST `/api/auth/change-password`
**설명**: 비밀번호 변경

**인증**: 필수  
**권한**: 모든 역할 (자신의 비밀번호만)

**요청 바디**:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!",
  "confirmPassword": "NewPassword456!"
}
```

**유효성 검사**:
- `currentPassword`: 현재 비밀번호 맞는지 확인
- `newPassword`: 8자 이상, 대문자/소문자/숫자/특수문자 포함
- `confirmPassword`: newPassword와 일치

**응답**:
```json
{
  "ok": true,
  "message": "비밀번호가 변경되었습니다"
}
```

**사이드 이펙트**:
- 모든 활성 세션 로그아웃
- 로그인 페이지로 리다이렉트

**에러 케이스**:
- 400: 현재 비밀번호 불일치
- 400: 새 비밀번호 요구사항 미충족
- 400: 새 비밀번호와 확인 비밀번호 불일치

---

### 2️⃣ 조직/팀 관련 API

#### 2.1 GET `/api/org/info`
**설명**: 조직 정보 조회

**인증**: 필수  
**권한**: 모든 역할 (조회만 가능)

**응답**:
```json
{
  "ok": true,
  "data": {
    "org": {
      "id": "org_abc123",
      "name": "크루즈닷 서울지점",
      "slug": "cruisedot-seoul",
      "plan": "PRO",
      "externalAffiliateProfileId": 12345,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  }
}
```

---

#### 2.2 PATCH `/api/org/info`
**설명**: 조직 정보 수정 (조직명)

**인증**: 필수  
**권한**: OWNER만

**요청 바디**:
```json
{
  "name": "크루즈닷 부산지점"
}
```

**유효성 검사**:
- `name`: 1-100자, 필수, 영문/한글/숫자

**응답**:
```json
{
  "ok": true,
  "data": { /* 수정된 조직 정보 */ },
  "message": "조직명이 저장되었습니다"
}
```

**에러 케이스**:
- 403: OWNER 권한 부족
- 400: 조직명 1자 미만

---

#### 2.3 DELETE `/api/org/delete`
**설명**: 조직 삭제 (영구 삭제)

**인증**: 필수  
**권한**: OWNER만

**요청 바디**:
```json
{
  "organizationName": "크루즈닷 서울지점",
  "confirmText": "조직과 모든 데이터를 삭제합니다"
}
```

**유효성 검사**:
- `organizationName`: 실제 조직명과 일치 확인
- `confirmText`: "조직과 모든 데이터를 삭제합니다" 정확히 입력

**응답**:
```json
{
  "ok": true,
  "message": "조직이 삭제되었습니다"
}
```

**사이드 이펙트**:
- Organization 레코드 삭제 (cascade delete)
- 관련 모든 데이터 삭제 (Contact, Contract, Document 등)
- 모든 멤버 세션 로그아웃

**에러 케이스**:
- 403: OWNER 권한 부족
- 409: 조직명 불일치
- 409: 확인 메시지 불일치

---

### 3️⃣ 팀 멤버 관련 API

#### 3.1 GET `/api/settings/team/members`
**설명**: 팀 멤버 목록 조회

**인증**: 필수  
**권한**: 모든 역할 (조회만 가능)

**쿼리 파라미터**:
- `skip`: 페이징 오프셋 (기본: 0)
- `take`: 페이징 크기 (기본: 50, 최대: 100)
- `role`: 역할 필터 (OWNER/AGENT/FREE_SALES, 선택)
- `isActive`: 활성 여부 필터 (true/false, 선택)

**응답**:
```json
{
  "ok": true,
  "data": {
    "members": [
      {
        "userId": "user_123",
        "displayName": "성민형",
        "email": "min@cruisedot.com",
        "role": "OWNER",
        "isActive": true,
        "isGoldMember": false,
        "goldMemberSince": null,
        "joinedAt": "2026-01-15T10:00:00Z"
      },
      {
        "userId": "user_456",
        "displayName": "모니카",
        "email": "monica@cruisedot.com",
        "role": "AGENT",
        "isActive": true,
        "isGoldMember": true,
        "goldMemberSince": "2026-02-01T00:00:00Z",
        "joinedAt": "2026-02-01T14:20:00Z"
      }
    ],
    "total": 2
  }
}
```

---

#### 3.2 PATCH `/api/settings/team/members/{userId}/role`
**설명**: 멤버 역할 변경

**인증**: 필수  
**권한**: OWNER만

**경로 파라미터**:
- `userId`: 변경할 멤버의 사용자 ID

**요청 바디**:
```json
{
  "role": "AGENT"
}
```

**유효성 검사**:
- `role`: OWNER/AGENT/FREE_SALES 중 하나
- 마지막 OWNER 변경 불가 (최소 1명 OWNER 유지)
- 자신의 역할 변경 불가

**응답**:
```json
{
  "ok": true,
  "data": { /* 수정된 멤버 정보 */ },
  "message": "멤버 역할이 변경되었습니다"
}
```

**감시 로그**: AuditLog 기록 (userId, action=UPDATE, resource=MEMBER)

**에러 케이스**:
- 403: OWNER 권한 부족
- 404: 사용자 ID 없음
- 409: 마지막 OWNER 변경 시도
- 409: 자신의 역할 변경 시도

---

#### 3.3 DELETE `/api/settings/team/members/{userId}`
**설명**: 멤버 제거

**인증**: 필수  
**권한**: OWNER만

**경로 파라미터**:
- `userId`: 제거할 멤버의 사용자 ID

**응답**:
```json
{
  "ok": true,
  "message": "멤버가 제거되었습니다"
}
```

**사이드 이펙트**:
- OrganizationMember 레코드 삭제
- 해당 멤버의 활성 세션 로그아웃
- 해당 멤버의 데이터는 유지 (다른 팀원이 접근 가능)

**에러 케이스**:
- 403: OWNER 권한 부족
- 404: 사용자 ID 없음
- 409: 마지막 OWNER 제거 시도

---

#### 3.4 POST `/api/settings/team/invite`
**설명**: 팀 멤버 초대 링크 생성

**인증**: 필수  
**권한**: OWNER만

**요청 바디**:
```json
{
  "email": "newmember@example.com",
  "role": "AGENT",
  "note": "판매팀 신입입니다"
}
```

**유효성 검사**:
- `email`: 유효한 이메일 형식, 기존 멤버 아님
- `role`: AGENT/FREE_SALES (OWNER는 불가)
- `note`: 0-200자, 선택

**응답**:
```json
{
  "ok": true,
  "data": {
    "inviteToken": {
      "id": "token_xyz789",
      "token": "inv_abc123def456...",
      "url": "https://app.cruisedot.com/invite/inv_abc123def456...",
      "qrCode": "data:image/png;base64,...",
      "expiresAt": "2026-05-31T14:30:00Z",
      "createdAt": "2026-05-24T14:30:00Z"
    }
  },
  "message": "초대 링크가 생성되었습니다"
}
```

**초대 토큰 특성**:
- 유효 기간: 7일
- 일회용 (사용된 후 만료)
- QR 코드 자동 생성 (invite URL로)

**에러 케이스**:
- 403: OWNER 권한 부족
- 400: 유효하지 않은 이메일 형식
- 409: 이미 존재하는 멤버
- 409: 무효한 역할 선택

---

#### 3.5 GET `/api/settings/team/invite-tokens`
**설명**: 초대 토큰 이력 조회

**인증**: 필수  
**권한**: OWNER/AGENT (자신의 초대만 조회 가능)

**쿼리 파라미터**:
- `skip`: 페이징 (기본: 0)
- `take`: 페이징 크기 (기본: 50)
- `status`: 필터 (PENDING/USED/EXPIRED, 선택)

**응답**:
```json
{
  "ok": true,
  "data": {
    "tokens": [
      {
        "id": "token_xyz789",
        "email": "newmember@example.com",
        "role": "AGENT",
        "status": "PENDING",
        "expiresAt": "2026-05-31T14:30:00Z",
        "createdAt": "2026-05-24T14:30:00Z",
        "usedAt": null
      },
      {
        "id": "token_old123",
        "email": "john@example.com",
        "role": "AGENT",
        "status": "USED",
        "expiresAt": "2026-05-17T00:00:00Z",
        "createdAt": "2026-05-10T10:00:00Z",
        "usedAt": "2026-05-12T15:20:00Z"
      }
    ],
    "total": 2
  }
}
```

---

### 4️⃣ 알림 설정 API

#### 4.1 GET `/api/settings/notifications`
**설명**: 알림 설정 조회

**인증**: 필수  
**권한**: AGENT/OWNER (자신의 설정만)

**응답**:
```json
{
  "ok": true,
  "data": {
    "smsNotifications": true,
    "emailNotifications": true,
    "pushNotifications": true,
    "smsPhone": "010-1234-5678",
    "emailAddress": "min@cruisedot.com",
    "categories": {
      "commissionDeadline": {
        "enabled": true,
        "daysBefore": [3, 7, 14],
        "channels": ["SMS", "EMAIL"]
      },
      "abTestResults": {
        "enabled": true,
        "channels": ["EMAIL", "PUSH"]
      },
      "saleComplete": {
        "enabled": true,
        "channels": ["SMS", "EMAIL"]
      },
      "systemAlerts": {
        "enabled": true,
        "channels": ["EMAIL", "PUSH"]
      }
    }
  }
}
```

---

#### 4.2 PATCH `/api/settings/notifications`
**설명**: 알림 설정 수정

**인증**: 필수  
**권한**: AGENT/OWNER (자신의 설정만)

**요청 바디**:
```json
{
  "smsNotifications": true,
  "emailNotifications": false,
  "pushNotifications": true,
  "smsPhone": "010-1234-5678",
  "categories": {
    "commissionDeadline": {
      "enabled": true,
      "daysBefore": [3, 7],
      "channels": ["SMS"]
    },
    "abTestResults": {
      "enabled": false
    }
  }
}
```

**응답**:
```json
{
  "ok": true,
  "data": { /* 수정된 알림 설정 */ },
  "message": "알림 설정이 저장되었습니다"
}
```

---

#### 4.3 GET `/api/settings/notifications/sms-sequence`
**설명**: SMS 시퀀스 커스터마이징 조회

**인증**: 필수

**쿼리 파라미터**:
- `productId`: 상품 ID (선택, 전체 조회 시 생략)

**응답**:
```json
{
  "ok": true,
  "data": {
    "sequences": [
      {
        "day": 0,
        "message": "고객님, 크루즈 예약 감사합니다...",
        "stage": "PROBLEM_AGITATE",
        "variables": ["고객명", "상품명", "가격"]
      },
      {
        "day": 1,
        "message": "고객님, 이제 크루즈를 즐기기 위해...",
        "stage": "SOLUTION",
        "variables": ["일정", "할인율"]
      },
      {
        "day": 2,
        "message": "한정: 이 주 예약자만...",
        "stage": "OFFER_NARROW",
        "variables": ["마감일"]
      },
      {
        "day": 3,
        "message": "최종 확인: 클릭해주세요...",
        "stage": "ACTION",
        "variables": ["확인링크"]
      }
    ]
  }
}
```

---

#### 4.4 PATCH `/api/settings/notifications/sms-sequence`
**설명**: SMS 시퀀스 메시지 커스터마이징

**인증**: 필수  
**권한**: OWNER

**요청 바디**:
```json
{
  "productId": null,
  "day0Message": "고객님, 크루즈 예약 감사합니다. {고객명}님께 드리는 특별 혜택을 놓치지 마세요!",
  "day1Message": "이제 최고의 경험을 준비하세요. {일정}일 출항 예정입니다.",
  "day2Message": "한정: {마감일}까지 예약 고객만 20% 할인 혜택!",
  "day3Message": "마지막 기회! 여기를 클릭해 최종 확인해주세요: {확인링크}"
}
```

**유효성 검사**:
- 각 메시지 1-500자
- 변수는 {변수명} 형식

**응답**:
```json
{
  "ok": true,
  "data": { /* 수정된 시퀀스 */ },
  "message": "SMS 시퀀스가 저장되었습니다"
}
```

---

### 5️⃣ 통합 API

#### 5.1 POST `/api/settings/integrations/api-key`
**설명**: API 키 저장 (암호화)

**인증**: 필수  
**권한**: OWNER

**요청 바디**:
```json
{
  "provider": "CRUISEDOT_MALL",
  "apiKey": "ck_live_abc123...",
  "apiSecret": "cs_live_xyz789..."
}
```

**지원 provider**:
- `CRUISEDOT_MALL`: 크루즈닷몰 API
- `PAYAPP`: 페이앱 API
- `SLACK`: Slack 웹훅
- `GMAIL`: Gmail OAuth
- `OUTLOOK`: Outlook OAuth

**응답**:
```json
{
  "ok": true,
  "data": {
    "provider": "CRUISEDOT_MALL",
    "isActive": true,
    "lastTestedAt": null,
    "testStatus": null
  },
  "message": "API 키가 저장되었습니다"
}
```

**보안 처리**:
- AES-256-GCM 암호화로 저장
- 응답에 원본 키 미포함 (마스킹만 반환)
- 모든 접근 AuditLog 기록

**에러 케이스**:
- 400: API 키 형식 오류
- 403: OWNER 권한 부족
- 409: 중복된 provider

---

#### 5.2 PATCH `/api/settings/integrations/api-key/{provider}`
**설명**: API 키 수정

**인증**: 필수  
**권한**: OWNER

**경로 파라미터**:
- `provider`: CRUISEDOT_MALL, PAYAPP, SLACK 등

**요청 바디**:
```json
{
  "apiKey": "ck_live_new123...",
  "apiSecret": "cs_live_new456..."
}
```

**응답**: 5.1과 동일

---

#### 5.3 DELETE `/api/settings/integrations/api-key/{provider}`
**설명**: API 키 삭제

**인증**: 필수  
**권한**: OWNER

**경로 파라미터**:
- `provider`: 삭제할 provider

**응답**:
```json
{
  "ok": true,
  "message": "API 키가 삭제되었습니다"
}
```

**주의**:
- 해당 서비스 사용 불가 (SMS 발송 등 중단)

---

#### 5.4 POST `/api/settings/integrations/{provider}/test`
**설명**: API 연결 테스트

**인증**: 필수  
**권한**: OWNER

**경로 파라미터**:
- `provider`: CRUISEDOT_MALL, PAYAPP, SLACK, GMAIL, OUTLOOK, SMTP

**응답 - 성공**:
```json
{
  "ok": true,
  "data": {
    "provider": "CRUISEDOT_MALL",
    "status": "SUCCESS",
    "testedAt": "2026-05-24T14:30:00Z",
    "details": {
      "apiVersion": "v2.1",
      "accountStatus": "ACTIVE"
    }
  },
  "message": "연결 테스트 성공"
}
```

**응답 - 실패**:
```json
{
  "ok": false,
  "error": "INTEGRATION_ERROR",
  "message": "API 연결 실패",
  "details": {
    "statusCode": 401,
    "errorMessage": "Invalid API credentials"
  }
}
```

---

#### 5.5 POST `/api/settings/integrations/email/test`
**설명**: 이메일 연결 테스트 (SMTP)

**인증**: 필수  
**권한**: OWNER

**요청 바디** (선택):
```json
{
  "smtpHost": "smtp.naver.com",
  "smtpPort": 587,
  "senderEmail": "test@naver.com",
  "senderPassword": "password123"
}
```

**응답**: 5.4와 동일

**테스트 방식**:
- SMTP 서버에 연결 시도
- TLS/SSL 검증
- 인증 정보 확인
- (선택사항) 테스트 이메일 발송

---

#### 5.6 GET `/api/settings/integrations/gmail/auth-url`
**설명**: Gmail OAuth 인증 URL 생성

**인증**: 필수

**쿼리 파라미터**:
- `redirectUri`: 콜백 URL (기본: `{baseUrl}/settings/integrations/callback`)

**응답**:
```json
{
  "ok": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
    "state": "state_xyz789..."
  }
}
```

**플로우**:
1. 클라이언트: authUrl로 리다이렉트
2. 사용자: Google 로그인 및 권한 승인
3. Google: redirectUri로 콜백 (code + state 포함)
4. 클라이언트: `/api/settings/integrations/gmail/callback` 호출

---

#### 5.7 POST `/api/settings/integrations/gmail/callback`
**설명**: Gmail OAuth 토큰 저장

**인증**: 필수

**요청 바디**:
```json
{
  "code": "4/0AX4XfWh...",
  "state": "state_xyz789..."
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "email": "user@gmail.com",
    "displayName": "성민형",
    "isActive": true,
    "connectedAt": "2026-05-24T14:30:00Z"
  },
  "message": "Gmail이 연동되었습니다"
}
```

**저장 항목**:
- RefreshToken (암호화)
- AccessToken (암호화, 만료 시간 기록)
- 사용자 이메일

---

#### 5.8 GET `/api/settings/integrations/webhooks`
**설명**: 웹훅 목록 조회

**인증**: 필수

**응답**:
```json
{
  "ok": true,
  "data": {
    "webhooks": [
      {
        "id": "wh_123",
        "provider": "CRUISEDOT_MALL",
        "event": "order.created",
        "url": "https://app.cruisedot.com/webhooks/wh_123",
        "isActive": true,
        "lastFiredAt": "2026-05-24T14:25:00Z",
        "failureCount": 0,
        "nextRetryAt": null
      },
      {
        "id": "wh_456",
        "provider": "PAYAPP",
        "event": "payment.completed",
        "url": "https://app.cruisedot.com/webhooks/wh_456",
        "isActive": true,
        "lastFiredAt": "2026-05-24T14:28:00Z",
        "failureCount": 0,
        "nextRetryAt": null
      }
    ]
  }
}
```

---

#### 5.9 POST `/api/settings/integrations/webhooks/{id}/retry`
**설명**: 실패한 웹훅 재시도

**인증**: 필수  
**권한**: OWNER

**경로 파라미터**:
- `id`: 웹훅 ID

**응답**:
```json
{
  "ok": true,
  "message": "웹훅을 다시 시도하고 있습니다"
}
```

---

### 6️⃣ 데이터 관리 API

#### 6.1 POST `/api/settings/backup/create`
**설명**: 데이터 백업 시작

**인증**: 필수  
**권한**: OWNER

**요청 바디**:
```json
{
  "type": "FULL",
  "includeContacts": true,
  "includeDeals": true,
  "includeDocuments": true,
  "sendToEmail": true
}
```

**백업 타입**:
- `FULL`: 모든 데이터
- `CONTACTS_ONLY`: 연락처만
- `DEALS_ONLY`: 거래만
- `DOCUMENTS_ONLY`: 문서만

**응답**:
```json
{
  "ok": true,
  "data": {
    "backupId": "backup_xyz789",
    "status": "PENDING",
    "type": "FULL",
    "startedAt": "2026-05-24T14:30:00Z",
    "estimatedTime": "5 minutes"
  },
  "message": "백업이 시작되었습니다"
}
```

**비동기 처리**:
- 백업은 백그라운드 작업으로 실행
- 완료 시 이메일 알림 (선택 시)
- 진행 상황은 WebSocket 또는 폴링으로 조회

---

#### 6.2 GET `/api/settings/backup/logs`
**설명**: 백업 이력 조회

**인증**: 필수

**쿼리 파라미터**:
- `skip`: 페이징 (기본: 0)
- `take`: 페이징 크기 (기본: 50)
- `status`: 필터 (PENDING/COMPLETED/FAILED)

**응답**:
```json
{
  "ok": true,
  "data": {
    "logs": [
      {
        "id": "backup_xyz789",
        "type": "FULL",
        "status": "COMPLETED",
        "fileSize": 52428800,
        "downloadUrl": "https://storage.googleapis.com/...",
        "startedAt": "2026-05-24T14:30:00Z",
        "completedAt": "2026-05-24T14:35:00Z"
      },
      {
        "id": "backup_old123",
        "type": "CONTACTS_ONLY",
        "status": "FAILED",
        "errorMessage": "저장소 접근 실패",
        "startedAt": "2026-05-23T10:00:00Z",
        "completedAt": "2026-05-23T10:05:00Z"
      }
    ],
    "total": 2
  }
}
```

---

#### 6.3 POST `/api/settings/export`
**설명**: 데이터 내보내기

**인증**: 필수  
**권한**: OWNER

**요청 바디**:
```json
{
  "format": "CSV",
  "dataTypes": ["CONTACTS", "DEALS", "SMS_LOGS"],
  "dateFrom": "2026-01-01",
  "dateTo": "2026-05-24",
  "sendToEmail": true
}
```

**포맷**:
- `CSV`: 스프레드시트
- `JSON`: API 호환
- `PDF`: 보고서 (이미지 포함)

**데이터 타입**:
- CONTACTS
- DEALS
- SMS_LOGS
- DOCUMENTS
- LENS_ANALYSIS
- REVENUE_REPORT

**응답**:
```json
{
  "ok": true,
  "data": {
    "exportId": "export_abc123",
    "status": "PROCESSING",
    "format": "CSV",
    "estimatedSize": "15 MB"
  },
  "message": "내보내기가 시작되었습니다"
}
```

---

#### 6.4 GET `/api/settings/recovery/deleted-items`
**설명**: 삭제된 항목 목록 (복구 가능)

**인증**: 필수

**쿼리 파라미터**:
- `type`: 항목 타입 (CONTACT/DEAL/DOCUMENT, 선택)
- `skip`: 페이징

**응답**:
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "contact_123",
        "type": "CONTACT",
        "name": "홍길동",
        "deletedAt": "2026-05-20T10:00:00Z",
        "expiresAt": "2026-06-19T10:00:00Z"
      },
      {
        "id": "deal_456",
        "type": "DEAL",
        "name": "크루즈 예약 - $5,000",
        "deletedAt": "2026-05-21T14:30:00Z",
        "expiresAt": "2026-06-20T14:30:00Z"
      }
    ],
    "total": 2
  }
}
```

---

#### 6.5 POST `/api/settings/recovery/restore/{id}`
**설명**: 삭제된 항목 복구

**인증**: 필수  
**권한**: OWNER

**경로 파라미터**:
- `id`: 복구할 항목 ID

**응답**:
```json
{
  "ok": true,
  "data": {
    "id": "contact_123",
    "type": "CONTACT",
    "name": "홍길동",
    "restoredAt": "2026-05-24T14:30:00Z"
  },
  "message": "항목이 복구되었습니다"
}
```

---

#### 6.6 DELETE `/api/settings/recovery/permanently-delete/{id}`
**설명**: 삭제된 항목 영구 삭제

**인증**: 필수  
**권한**: OWNER

**경로 파라미터**:
- `id`: 영구 삭제할 항목 ID

**응답**:
```json
{
  "ok": true,
  "message": "항목이 영구 삭제되었습니다"
}
```

---

### 7️⃣ 심리학 설정 API

#### 7.1 GET `/api/settings/psychology/lenses`
**설명**: 렌즈 목록 및 활성화 상태 조회

**인증**: 필수

**응답**:
```json
{
  "ok": true,
  "data": {
    "lenses": [
      {
        "id": "L0",
        "name": "부재중 고객 재활성화",
        "description": "감정적 재연결을 통해 부재중 고객 재활성화",
        "isEnabled": true,
        "psychologyPrinciples": ["Loss Aversion", "Social Proof"],
        "expectedConversionLift": "62-97%",
        "activeRuleCount": 5
      },
      {
        "id": "L1",
        "name": "가격 이의 대응",
        "description": "가치 재정의로 가격 저항 극복",
        "isEnabled": true,
        "psychologyPrinciples": ["Reciprocity", "Value Reframing"],
        "expectedConversionLift": "42-48%",
        "activeRuleCount": 3
      },
      {
        "id": "L2",
        "name": "준비 복잡 불안",
        "description": "5단계 중재 질문으로 불안 해소",
        "isEnabled": false,
        "psychologyPrinciples": ["Authority", "Expertise"],
        "expectedConversionLift": "38-45%",
        "activeRuleCount": 0
      }
      // ... L3-L10 생략
    ]
  }
}
```

---

#### 7.2 PATCH `/api/settings/psychology/lenses`
**설명**: 렌즈 활성화/비활성화 토글

**인증**: 필수  
**권한**: OWNER

**요청 바디**:
```json
{
  "lensId": "L2",
  "isEnabled": true
}
```

**응답**:
```json
{
  "ok": true,
  "data": {
    "lensId": "L2",
    "isEnabled": true,
    "activatedAt": "2026-05-24T14:30:00Z"
  },
  "message": "L2 렌즈가 활성화되었습니다"
}
```

**사이드 이펙트**:
- 해당 렌즈의 자동화 규칙 활성화/비활성화
- CRM Workflow 자동 업데이트
- AuditLog 기록

---

#### 7.3 GET `/api/settings/psychology/ab-tests`
**설명**: A/B 테스트 목록 조회

**인증**: 필수

**쿼리 파라미터**:
- `status`: 필터 (RUNNING/COMPLETED)
- `skip`: 페이징

**응답**:
```json
{
  "ok": true,
  "data": {
    "tests": [
      {
        "id": "test_xyz789",
        "name": "Day0 L6 긴박감 vs 기본",
        "lensId": "L6",
        "status": "RUNNING",
        "startedAt": "2026-05-20T10:00:00Z",
        "endsAt": "2026-05-30T10:00:00Z",
        "daysRemaining": 6,
        "segmentA": {
          "message": "고객님, 한정 시간 제공입니다!",
          "sampleSize": 150,
          "conversionRate": 12.5
        },
        "segmentB": {
          "message": "고객님, 이 기회를 놓치지 마세요!",
          "sampleSize": 150,
          "conversionRate": 14.8
        },
        "winningSegment": null,
        "winningStat": "B 선두 (2.3%p)"
      },
      {
        "id": "test_old123",
        "name": "Day1 L3 차별성 vs 기본",
        "lensId": "L3",
        "status": "COMPLETED",
        "startedAt": "2026-05-15T10:00:00Z",
        "endedAt": "2026-05-20T10:00:00Z",
        "segmentA": { /* ... */ },
        "segmentB": { /* ... */ },
        "winningSegment": "B",
        "winningStat": "B 승리 (1.7%p)"
      }
    ]
  }
}
```

---

#### 7.4 PATCH `/api/settings/psychology/ab-test`
**설명**: A/B 테스트 설정

**인증**: 필수  
**권한**: OWNER

**요청 바디**:
```json
{
  "isEnabled": true,
  "period": "THIS_WEEK",
  "customDateFrom": null,
  "customDateTo": null,
  "winCriteria": "CONVERSION_RATE"
}
```

**옵션**:
- `period`: THIS_WEEK/THIS_MONTH/CUSTOM
- `winCriteria`: CONVERSION_RATE/RESPONSE_RATE/CLICK_RATE

**응답**:
```json
{
  "ok": true,
  "data": {
    "isEnabled": true,
    "period": "THIS_WEEK",
    "nextTestStartsAt": "2026-05-27T10:00:00Z"
  },
  "message": "A/B 테스트가 설정되었습니다"
}
```

---

#### 7.5 GET `/api/settings/psychology/goals`
**설명**: 목표 조회

**인증**: 필수

**응답**:
```json
{
  "ok": true,
  "data": {
    "month": "2026-05",
    "goals": {
      "monthlyRevenue": 50000000,
      "conversionRate": 15,
      "settlementRate": 95,
      "customerCount": 100
    },
    "progress": {
      "monthlyRevenue": {
        "actual": 35200000,
        "percentage": 70
      },
      "conversionRate": {
        "actual": 12.5,
        "percentage": 83
      },
      "settlementRate": {
        "actual": 92,
        "percentage": 96
      },
      "customerCount": {
        "actual": 68,
        "percentage": 68
      }
    }
  }
}
```

---

#### 7.6 PATCH `/api/settings/psychology/goals`
**설명**: 목표 설정

**인증**: 필수  
**권한**: OWNER

**요청 바디**:
```json
{
  "month": "2026-06",
  "monthlyRevenue": 55000000,
  "conversionRate": 16,
  "settlementRate": 96,
  "customerCount": 110
}
```

**응답**:
```json
{
  "ok": true,
  "data": { /* 설정된 목표 */ },
  "message": "목표가 저장되었습니다"
}
```

---

## 🔐 공통 보안 요구사항

### 인증
- 모든 엔드포인트: JWT Bearer Token 필수
- 토큰 만료: 24시간
- Refresh Token: 7일

### 권한 검증
```typescript
// 예시
async function requireOwner(req, res) {
  const user = await getAuthUser(req);
  const member = await OrganizationMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } }
  });
  if (member?.role !== "OWNER") {
    return res.status(403).json({ error: "FORBIDDEN" });
  }
}
```

### 민감한 정보 마스킹
```typescript
// API 키 응답 시
{
  provider: "CRUISEDOT_MALL",
  keyPreview: "ck_live_****...abc123" // 앞 2글자 + *** + 뒤 6글자
}
```

### Rate Limiting
```
GET /api/settings/*: 60 req/min per user
PATCH /api/settings/*: 30 req/min per user
POST /api/*/delete: 5 req/min per user
```

### CSRF 보호
```
모든 상태 변경 (PATCH/DELETE/POST) 요청:
X-CSRF-Token: [헤더 필수]
```

---

## 📊 에러 코드

| 코드 | 설명 | HTTP |
|------|------|------|
| INVALID_REQUEST | 요청 형식 오류 | 400 |
| VALIDATION_ERROR | 필드 검증 실패 | 400 |
| UNAUTHORIZED | 인증 실패 | 401 |
| FORBIDDEN | 권한 부족 | 403 |
| NOT_FOUND | 리소스 없음 | 404 |
| CONFLICT | 중복 또는 상태 충돌 | 409 |
| INTEGRATION_ERROR | 외부 서비스 연동 실패 | 500 |
| STORAGE_ERROR | 저장소 접근 실패 | 500 |

---

**버전**: 1.0  
**작성일**: 2026-05-24  
**상태**: API 설계 완료
