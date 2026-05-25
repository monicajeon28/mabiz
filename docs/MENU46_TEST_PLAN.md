# Menu #46: Organization Settings API - 테스트 계획

## 테스트 개요

**API 경로**: `/api/settings/organization`  
**메서드**: GET, PATCH  
**총 테스트 케이스**: 20개  
**테스트 도구**: Playwright / curl / Postman

---

## 1. GET /api/settings/organization - 조직 정보 조회

### T-1.1: OWNER 역할 - 자신의 조직 정보 조회 ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1
- Authorization 토큰: 유효함

실행:
GET /api/settings/organization

예상 결과:
- Status: 200 OK
- Body: {
    "ok": true,
    "org": {
      "id": "org-test-1",
      "name": "테스트 조직",
      "slug": "test-org",
      "plan": "PREMIUM",
      "externalAffiliateProfileId": 100,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }

로그:
[INFO] [GET /api/settings/organization] Success { orgId: 'org-test-1' }
```

### T-1.2: GLOBAL_ADMIN 역할 - 본사 조직 정보 조회 ✅
```
전제조건:
- Role: GLOBAL_ADMIN
- organizationId: null (자동으로 BONSA_ORG_ID 사용)
- Authorization 토큰: 유효함

실행:
GET /api/settings/organization

예상 결과:
- Status: 200 OK
- org.id === BONSA_ORG_ID

로그:
[INFO] [GET /api/settings/organization] Success { orgId: 'org-cruisedot-main' }
```

### T-1.3: AGENT 역할 - 자신의 조직 정보 조회 ✅
```
전제조건:
- Role: AGENT
- organizationId: org-test-1
- Authorization 토큰: 유효함

실행:
GET /api/settings/organization

예상 결과:
- Status: 200 OK
- org.id === org-test-1
```

### T-1.4: FREE_SALES 역할 - 자신의 조직 정보 조회 ✅
```
전제조건:
- Role: FREE_SALES
- organizationId: org-test-1
- Authorization 토큰: 유효함

실행:
GET /api/settings/organization

예상 결과:
- Status: 200 OK (인증만 필요)
- org.id === org-test-1
```

### T-1.5: 비인증 사용자 - 401 UNAUTHORIZED ❌
```
전제조건:
- Authorization 토큰: 없음 또는 유효하지 않음

실행:
GET /api/settings/organization

예상 결과:
- Status: 401 Unauthorized
- Body: {
    "ok": false,
    "error": "UNAUTHORIZED",
    "message": "인증이 필요합니다"
  }

로그:
[ERROR] [GET /api/settings/organization] Error { err: { message: 'UNAUTHORIZED' } }
```

### T-1.6: 존재하지 않는 조직 - 404 NOT_FOUND ❌
```
전제조건:
- Role: OWNER
- organizationId: org-nonexistent
- 조직이 데이터베이스에 없음

실행:
GET /api/settings/organization

예상 결과:
- Status: 404 Not Found
- Body: {
    "ok": false,
    "error": "NOT_FOUND",
    "message": "조직을 찾을 수 없습니다."
  }

로그:
[WARN] [GET /api/settings/organization] Organization not found { orgId: 'org-nonexistent' }
```

### T-1.7: 서버 오류 시 처리 ⚠️
```
전제조건:
- Role: OWNER
- organizationId: org-test-1
- Prisma 연결 끊김 (시뮬레이션)

실행:
GET /api/settings/organization

예상 결과:
- Status: 500 Internal Server Error
- Body: {
    "ok": false,
    "error": "INTERNAL_ERROR",
    "message": "서버 오류가 발생했습니다"
  }

로그:
[ERROR] [GET /api/settings/organization] Error { err: PrismaClientInitializationError }
```

---

## 2. PATCH /api/settings/organization - 조직명 수정

### T-2.1: OWNER 역할 - 조직명 수정 ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1
- 조직이 데이터베이스에 존재함

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명"
}

예상 결과:
- Status: 200 OK
- Body: {
    "ok": true,
    "org": {
      "id": "org-test-1",
      "name": "새로운 조직명",
      "slug": "test-org",
      "plan": "PREMIUM",
      "externalAffiliateProfileId": 100,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
- 데이터베이스의 name 필드가 "새로운 조직명"으로 변경됨
- slug, plan은 변경 안 됨

로그:
[WARN] [PATCH /api/settings/organization] Insufficient permission { role: 'OWNER' } (안 나타남)
[INFO] [PATCH /api/settings/organization] Updated { orgId: 'org-test-1', name: '새로운 조직명', userId: 'user-123' }
```

### T-2.2: GLOBAL_ADMIN 역할 - 본사 조직명 수정 ✅
```
전제조건:
- Role: GLOBAL_ADMIN
- organizationId: null (자동으로 BONSA_ORG_ID 사용)
- 본사 조직이 데이터베이스에 존재함

실행:
PATCH /api/settings/organization
{
  "name": "새로운 본사명"
}

예상 결과:
- Status: 200 OK
- org.name === "새로운 본사명"
- org.id === BONSA_ORG_ID

로그:
[INFO] [PATCH /api/settings/organization] Updated { orgId: 'org-cruisedot-main', name: '새로운 본사명', userId: 'admin-001' }
```

### T-2.3: AGENT 역할 - 권한 부족 (403 FORBIDDEN) ❌
```
전제조건:
- Role: AGENT
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명"
}

예상 결과:
- Status: 403 Forbidden
- Body: {
    "ok": false,
    "error": "FORBIDDEN",
    "message": "대리점장 또는 관리자만 수정할 수 있습니다."
  }
- 데이터베이스 변경 없음

로그:
[WARN] [PATCH /api/settings/organization] Insufficient permission { userId: 'agent-001', role: 'AGENT' }
```

### T-2.4: FREE_SALES 역할 - 권한 부족 (403 FORBIDDEN) ❌
```
전제조건:
- Role: FREE_SALES
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명"
}

예상 결과:
- Status: 403 Forbidden
- 데이터베이스 변경 없음

로그:
[WARN] [PATCH /api/settings/organization] Insufficient permission { userId: 'sales-001', role: 'FREE_SALES' }
```

### T-2.5: 빈 name - 400 INVALID_INPUT ❌
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": ""
}

예상 결과:
- Status: 400 Bad Request
- Body: {
    "ok": false,
    "error": "INVALID_INPUT",
    "message": "조직명은 1~255자여야 합니다."
  }
- 데이터베이스 변경 없음
```

### T-2.6: 공백만 포함된 name - 400 INVALID_INPUT ❌
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "   "
}

예상 결과:
- Status: 400 Bad Request
- 메시지: "조직명을 입력해주세요."
- 데이터베이스 변경 없음 (trim() 후 길이 0)
```

### T-2.7: name이 너무 길 경우 - 400 INVALID_INPUT ❌
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "a".repeat(256)
}

예상 결과:
- Status: 400 Bad Request
- Body: {
    "ok": false,
    "error": "INVALID_INPUT",
    "message": "조직명은 1~255자여야 합니다."
  }
- 데이터베이스 변경 없음
```

### T-2.8: name이 null - 400 INVALID_INPUT ❌
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": null
}

예상 결과:
- Status: 400 Bad Request
- 메시지: "조직명을 입력해주세요."
- 데이터베이스 변경 없음
```

### T-2.9: name이 숫자 - 400 INVALID_INPUT ❌
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": 12345
}

예상 결과:
- Status: 400 Bad Request
- 메시지: "조직명을 입력해주세요."
- 데이터베이스 변경 없음
```

### T-2.10: name이 undefined - 400 INVALID_INPUT ❌
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
}

예상 결과:
- Status: 400 Bad Request
- 메시지: "조직명을 입력해주세요."
- 데이터베이스 변경 없음
```

### T-2.11: slug 수정 시도 (무시됨) ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1
- 기존 slug: "test-org"

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명",
  "slug": "new-slug"
}

예상 결과:
- Status: 200 OK
- org.name === "새로운 조직명"
- org.slug === "test-org" (변경 안 됨)
- 데이터베이스에서도 slug는 "test-org"로 유지
```

### T-2.12: plan 수정 시도 (무시됨) ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1
- 기존 plan: "PREMIUM"

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명",
  "plan": "FREE"
}

예상 결과:
- Status: 200 OK
- org.plan === "PREMIUM" (변경 안 됨)
- 데이터베이스에서도 plan은 "PREMIUM"으로 유지
```

### T-2.13: externalAffiliateProfileId 수정 시도 (무시됨) ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1
- 기존 externalAffiliateProfileId: 100

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명",
  "externalAffiliateProfileId": 999
}

예상 결과:
- Status: 200 OK
- org.externalAffiliateProfileId === 100 (변경 안 됨)
```

### T-2.14: 존재하지 않는 조직 수정 - 404 NOT_FOUND ❌
```
전제조건:
- Role: OWNER
- organizationId: org-nonexistent
- 조직이 데이터베이스에 없음

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명"
}

예상 결과:
- Status: 404 Not Found
- Body: {
    "ok": false,
    "error": "NOT_FOUND",
    "message": "조직을 찾을 수 없습니다."
  }

로그:
[WARN] [PATCH /api/settings/organization] Organization not found { orgId: 'org-nonexistent' }
```

### T-2.15: 비인증 사용자 - 401 UNAUTHORIZED ❌
```
전제조건:
- Authorization 토큰: 없음 또는 유효하지 않음

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명"
}

예상 결과:
- Status: 401 Unauthorized
- 권한 체크 전에 인증 실패
```

### T-2.16: name에 특수문자 포함 ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "새로운 조직명 (주식회사) @2026"
}

예상 결과:
- Status: 200 OK
- org.name === "새로운 조직명 (주식회사) @2026"
- 데이터베이스에 정상 저장
```

### T-2.17: name에 이모지 포함 ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "🎉 새로운 조직명"
}

예상 결과:
- Status: 200 OK (이모지는 한글 처리)
- org.name === "🎉 새로운 조직명"
```

### T-2.18: 1자 이름 (최소값) ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "가"
}

예상 결과:
- Status: 200 OK
- org.name === "가"
```

### T-2.19: 255자 이름 (최대값) ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "a".repeat(255)
}

예상 결과:
- Status: 200 OK
- org.name.length === 255
```

### T-2.20: 앞뒤 공백 제거 (trim) ✅
```
전제조건:
- Role: OWNER
- organizationId: org-test-1

실행:
PATCH /api/settings/organization
{
  "name": "  새로운 조직명  "
}

예상 결과:
- Status: 200 OK
- org.name === "새로운 조직명" (공백 제거됨)
```

---

## 3. 통합 테스트 (Integration Tests)

### I-3.1: 연속 수정 - 마지막 값이 반영되어야 함
```
1단계:
PATCH /api/settings/organization { "name": "조직명1" }
→ 200 OK, org.name === "조직명1"

2단계:
PATCH /api/settings/organization { "name": "조직명2" }
→ 200 OK, org.name === "조직명2"

3단계:
GET /api/settings/organization
→ org.name === "조직명2"
```

### I-3.2: 동시 요청 - race condition 없어야 함
```
요청 1: PATCH { "name": "조직명1" }
요청 2: PATCH { "name": "조직명2" } (동시)

예상:
- 둘 다 200 OK
- 최종 org.name은 둘 중 하나 (데이터 손상 없음)
```

---

## 4. 성능 테스트 (Performance Tests)

### P-4.1: 응답 시간 - 100ms 이하
```
GET /api/settings/organization
→ 응답 시간 < 100ms (평균)
```

### P-4.2: PATCH 응답 시간 - 150ms 이하
```
PATCH /api/settings/organization
→ 응답 시간 < 150ms (평균, DB 업데이트 포함)
```

---

## 5. 보안 테스트 (Security Tests)

### S-5.1: SQL Injection 시도 - 방어되어야 함
```
PATCH /api/settings/organization
{
  "name": "'; DROP TABLE organization; --"
}

예상:
- Status: 200 OK (문자열로 저장됨, SQL 실행 안 됨)
- 테이블 손상 없음 (Prisma ORM이 방어)
```

### S-5.2: XSS 시도 - 저장되어야 함 (클라이언트에서 이스케이프)
```
PATCH /api/settings/organization
{
  "name": "<script>alert('xss')</script>"
}

예상:
- Status: 200 OK (문자열로 저장됨)
- org.name === "<script>alert('xss')</script>" (그대로 저장)
- 주의: 클라이언트에서 렌더링 시 이스케이프 필수
```

### S-5.3: 다른 조직 접근 시도 - 차단되어야 함
```
전제조건:
- User A: OWNER of org-1
- User B: OWNER of org-2

실행 (User A):
GET /api/settings/organization
→ org.id === org-1 (org-2 접근 불가)

실행 (User A):
PATCH /api/settings/organization { "name": "..." }
→ org-1 수정, org-2는 수정 불가
```

---

## 6. 테스트 실행 방법

### 준비 단계
```bash
# 1. 테스트 환경 설정
cd /mabiz-crm
npm install

# 2. .env 설정 (테스트 DB)
cp .env.example .env.local

# 3. 테스트 토큰 생성 (별도 스크립트)
node scripts/generate-test-tokens.js
```

### Playwright 테스트 실행
```bash
# 모든 테스트
npm run test:e2e

# 특정 테스트만
npm run test:e2e -- --grep "T-1.1"

# UI 모드
npx playwright test --ui
```

### curl 테스트 (수동)
```bash
# GET 요청
curl -X GET http://localhost:3000/api/settings/organization \
  -H "Authorization: Bearer <token>"

# PATCH 요청
curl -X PATCH http://localhost:3000/api/settings/organization \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "새로운 조직명"}'
```

---

## 7. 체크리스트

### 기능 테스트
- [ ] T-1.1 ~ T-1.7 (GET 요청)
- [ ] T-2.1 ~ T-2.20 (PATCH 요청)

### 통합 테스트
- [ ] I-3.1 (연속 수정)
- [ ] I-3.2 (동시 요청)

### 성능 테스트
- [ ] P-4.1 (GET 응답 시간)
- [ ] P-4.2 (PATCH 응답 시간)

### 보안 테스트
- [ ] S-5.1 (SQL Injection)
- [ ] S-5.2 (XSS)
- [ ] S-5.3 (조직 격리)

### 배포 전 확인
- [ ] 모든 테스트 통과
- [ ] 성능 기준 충족
- [ ] 보안 검증 완료
- [ ] 로그 확인
- [ ] 에러 처리 확인

---

**작성일**: 2026-05-25  
**테스트 총 개수**: 20개 기능 + 3개 통합 + 2개 성능 + 3개 보안 = 28개 total
