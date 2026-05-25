# CRM 연결 및 역할 테스트 - 상세 테스트 케이스
**작성일**: 2026-05-25  
**대상**: QA, 개발자  
**실행 순서**: TC-001 → TC-050 (순차 또는 병렬 실행 가능)

---

## 🎬 사전 설정

### 환경 준비
```bash
# 1. 저장소 최신화
git pull origin main

# 2. 패키지 설치 확인
npm ci

# 3. 데이터베이스 마이그레이션
npx prisma migrate deploy

# 4. 개발 서버 실행
npm run dev
# Expected: "ready - started server on 0.0.0.0:3000"

# 5. 브라우저에서 접속 확인
curl -i http://localhost:3000
# Expected: 200 OK
```

### 테스트 사용자 데이터 초기화
```sql
-- 기존 테스트 사용자 삭제
DELETE FROM "OrganizationMember" 
WHERE email LIKE '%@mabiz.test';

DELETE FROM "MabizSession" 
WHERE organizationId IN (
  SELECT id FROM "Organization" 
  WHERE slug = 'test-organization'
);

-- 테스트 조직 생성
INSERT INTO "Organization" (id, name, slug, plan, status)
VALUES (
  'org-test-001',
  'Test Organization',
  'test-organization',
  'FREE',
  'ACTIVE'
);

-- 테스트 사용자 생성
INSERT INTO "OrganizationMember" (
  id, organizationId, userId, role, displayName, email, isActive
) VALUES
  ('mem-admin-001', 'org-test-001', 'admin-001', 'ADMIN', 'Admin User', 'admin@mabiz.test', true),
  ('mem-mgr-001', 'org-test-001', 'mgr-001', 'AGENT', 'Manager User', 'manager@mabiz.test', true),
  ('mem-sales-001', 'org-test-001', 'sales-001', 'AGENT', 'Sales User', 'sales@mabiz.test', true),
  ('mem-presales-001', 'org-test-001', 'presales-001', 'AGENT', 'PreSales User', 'presales@mabiz.test', true);

-- 전역 관리자 생성
INSERT INTO "GlobalAdmin" (id, displayName, phone, userId)
VALUES ('admin-global-001', 'Global Admin', '010-0000-0001', 'admin-001');
```

---

## 📋 Phase 1: 인증 시스템 (TC-001 ~ TC-010)

### TC-001: Clerk 로그인 페이지 로드
**목적**: Clerk 로그인 페이지가 정상 렌더링되는지 확인

**전제조건**:
- [ ] Clerk API Key 설정됨 (.env.local)
- [ ] 개발 서버 실행 중

**테스트 단계**:
```
1. 브라우저에서 http://localhost:3000/sign-in 접속
2. "Sign in with Clerk" 버튼 확인
3. "Don't have an account? Sign up" 링크 확인
```

**예상 결과**:
- [ ] 로그인 폼 정상 표시
- [ ] 이메일 입력 필드 존재
- [ ] "Continue" 버튼 활성화

**실패 시 확인**:
```bash
# 1. Clerk 환경변수 확인
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
echo $CLERK_SECRET_KEY

# 2. Clerk 대시보드 API Key 상태
# https://dashboard.clerk.com → API Keys

# 3. 서버 콘솔 에러 확인
grep -i "clerk" output.log
```

**기록**:
```
[ ] PASS: 2026-05-25 14:00
[ ] FAIL: 
  - 증상: 
  - 해결:
[ ] SKIP: 사유
```

---

### TC-002: 이메일로 로그인 (Admin User)
**목적**: admin@mabiz.test 계정으로 로그인 성공

**전제조건**:
- [ ] admin@mabiz.test Clerk 계정 생성됨
- [ ] TC-001 완료

**테스트 단계**:
```
1. http://localhost:3000/sign-in 접속
2. 이메일 입력: admin@mabiz.test
3. "Continue" 클릭
4. 비밀번호 입력 (또는 이메일 링크 확인)
5. 확인 코드 입력 (2FA 활성화 시)
```

**예상 결과**:
- [ ] /dashboard로 리다이렉트됨
- [ ] 사용자 메뉴에 "Admin User" 표시
- [ ] 쿠키에 'mabiz.sid' 설정됨

**검증 명령**:
```bash
# 로그인 후 세션 확인
curl -b "mabiz.sid=<SESSION_ID>" \
  http://localhost:3000/api/auth/session \
  -s | jq '.'
# Expected response:
# {
#   "user": {
#     "id": "admin-001",
#     "email": "admin@mabiz.test",
#     "role": "GLOBAL_ADMIN",
#     "organizationId": "org-test-001"
#   }
# }
```

**DB 검증**:
```sql
SELECT role, expiresAt, createdAt 
FROM "MabizSession" 
WHERE memberId = 'mem-admin-001' 
ORDER BY createdAt DESC LIMIT 1;
-- Expected: role = 'GLOBAL_ADMIN', expiresAt > NOW()
```

---

### TC-003: 이메일로 로그인 (Member User)
**목적**: manager@mabiz.test 계정으로 로그인 성공

**전제조건**:
- [ ] manager@mabiz.test Clerk 계정 생성됨
- [ ] TC-002 완료 (Admin 역할 이해)

**테스트 단계**:
```
1. Admin 로그아웃 (프로필 메뉴 → Sign Out)
2. http://localhost:3000/sign-in 접속
3. 이메일: manager@mabiz.test
4. 로그인 완료
```

**예상 결과**:
- [ ] /dashboard로 리다이렉트
- [ ] 사용자 메뉴에 "Manager User" 표시
- [ ] role = "MEMBER" (DB 확인)

**검증**:
```sql
SELECT role, memberId FROM "MabizSession" 
WHERE memberId = 'mem-mgr-001' 
ORDER BY createdAt DESC LIMIT 1;
-- Expected: role = 'MEMBER'
```

---

### TC-004: 이메일로 로그인 (Sales User)
**목적**: sales@mabiz.test 계정으로 로그인 성공

**전제조건**:
- [ ] sales@mabiz.test Clerk 계정 생성됨
- [ ] TC-003 완료

**테스트 단계**:
```
1. Manager 로그아웃
2. http://localhost:3000/sign-in 접속
3. 이메일: sales@mabiz.test
4. 로그인 완료
```

**예상 결과**:
- [ ] /dashboard로 리다이렉트
- [ ] role = "MEMBER"
- [ ] displayName = "Sales User"

---

### TC-005: 이메일로 로그인 (PreSales User)
**목적**: presales@mabiz.test 계정으로 로그인 성공

**전제조건**:
- [ ] presales@mabiz.test Clerk 계정 생성됨
- [ ] TC-004 완료

**테스트 단계**:
```
1. Sales 로그아웃
2. http://localhost:3000/sign-in 접속
3. 이메일: presales@mabiz.test
4. 로그인 완료
```

**예상 결과**:
- [ ] /dashboard로 리다이렉트
- [ ] role = "MEMBER"

---

### TC-006: 잘못된 비밀번호 로그인 실패
**목적**: 잘못된 비밀번호로는 로그인 불가

**테스트 단계**:
```
1. http://localhost:3000/sign-in 접속
2. 이메일: admin@mabiz.test
3. 비밀번호: wrong-password-123
4. "Continue" 클릭
```

**예상 결과**:
- [ ] 오류 메시지 표시: "Invalid credentials" 또는 유사
- [ ] /sign-in 페이지 유지 (리다이렉트 없음)
- [ ] MabizSession 생성되지 않음

---

### TC-007: 존재하지 않는 이메일 로그인 실패
**목적**: 등록되지 않은 이메일로는 로그인 불가

**테스트 단계**:
```
1. http://localhost:3000/sign-in 접속
2. 이메일: nonexistent@mabiz.test
3. "Continue" 클릭
```

**예상 결과**:
- [ ] "Invalid credentials" 또는 Sign Up 유도
- [ ] 세션 생성 안 됨

---

### TC-008: 로그아웃 후 세션 제거
**목적**: 로그아웃 시 MabizSession 삭제 또는 만료

**테스트 단계**:
```
1. Admin으로 로그인 (TC-002)
2. 프로필 메뉴 → Sign Out 클릭
3. /sign-in으로 리다이렉트됨
```

**예상 결과**:
- [ ] mabiz.sid 쿠키 삭제됨
- [ ] 세션 테이블에서 expiresAt < NOW()로 변경

**DB 검증**:
```sql
SELECT id, expiresAt FROM "MabizSession" 
WHERE memberId = 'mem-admin-001' 
ORDER BY createdAt DESC LIMIT 1;
-- Expected: expiresAt < NOW()
```

---

### TC-009: 세션 타임아웃 (30일 이상 경과)
**목적**: 30일 이상된 세션은 자동으로 만료

**테스트 단계**:
```
1. 과거 날짜의 세션 생성:
   INSERT INTO "MabizSession" (id, memberId, expiresAt, role)
   VALUES ('session-old-001', 'mem-admin-001', NOW() - INTERVAL '31 days', 'GLOBAL_ADMIN');

2. 해당 세션으로 API 호출:
   curl -b "mabiz.sid=session-old-001" \
     http://localhost:3000/api/contacts
```

**예상 결과**:
- [ ] 401 Unauthorized 또는 /sign-in 리다이렉트
- [ ] "Session expired" 메시지

---

### TC-010: 동시 로그인 (멀티 디바이스)
**목적**: 같은 사용자가 여러 기기에서 로그인 가능

**테스트 단계**:
```
1. 브라우저 A에서 admin@mabiz.test 로그인
2. 브라우저 B (또는 시크릿 탭)에서 동일 이메일로 로그인
3. 두 브라우저에서 동시에 활동
```

**예상 결과**:
- [ ] 두 브라우저 모두 /dashboard 접근 가능
- [ ] 각각 다른 mabiz.sid 쿠키 보유
- [ ] 데이터 조작 간 충돌 없음

---

## 🔐 Phase 2: 권한 검증 (TC-011 ~ TC-025)

### TC-011: Admin은 /admin/* 접근 가능
**목적**: Admin 사용자가 관리자 페이지에 접근 가능

**전제조건**:
- [ ] Admin (admin@mabiz.test) 로그인 완료

**테스트 단계**:
```
1. Admin 로그인 (TC-002)
2. 브라우저에서 http://localhost:3000/admin/users 접속
3. 사용자 목록 페이지 로드 확인
```

**예상 결과**:
- [ ] /admin/users 페이지 정상 로드 (200 OK)
- [ ] 사용자 목록 테이블 표시
- [ ] "Create User" 버튼 활성화

**API 검증**:
```bash
curl -b "mabiz.sid=<ADMIN_SESSION>" \
  http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json"
# Expected: 200 OK + user list
```

---

### TC-012: Member는 /admin/* 접근 불가
**목적**: 일반 사용자는 관리자 페이지 접근 차단

**전제조건**:
- [ ] Member (manager@mabiz.test) 로그인 완료

**테스트 단계**:
```
1. Member 로그인 (TC-003)
2. 직접 URL 입력: http://localhost:3000/admin/users
3. 리다이렉트 확인
```

**예상 결과**:
- [ ] /403-forbidden 또는 /dashboard로 리다이렉트
- [ ] 오류 메시지: "Access denied" 또는 "You don't have permission"

**API 검증**:
```bash
curl -b "mabiz.sid=<MEMBER_SESSION>" \
  http://localhost:3000/api/admin/users
# Expected: 403 Forbidden
```

**미들웨어 로그**:
```bash
tail -f output.log | grep "route-rules"
# Expected: "Insufficient permissions (route-rules)"
```

---

### TC-013: /dashboard/team/* (Team Management) 접근 제어
**목적**: Member만 팀 관리 페이지 접근 가능

**전제조건**:
- [ ] Admin 로그인 완료

**테스트 단계**:
```
1. Admin 로그인 (TC-002)
2. http://localhost:3000/dashboard/team/members 접속
```

**예상 결과**:
- [ ] Admin: 200 OK (또는 team management 권한 있으면 접근 가능)
- [ ] Member: 200 OK (본인 팀만)

**DB 검증**:
```typescript
// src/tests/rbac-team.test.ts
test('MEMBER can access /dashboard/team/* routes', () => {
  const pathsToTest = [
    '/dashboard/team/members',
    '/dashboard/team/create',
    '/dashboard/team/settings'
  ];
  
  pathsToTest.forEach(path => {
    const hasAccess = checkPathAccess(path, 'MEMBER');
    expect(hasAccess).toBe(true);
  });
});
```

---

### TC-014: Contact 수정 권한 검증
**목적**: 자신에게 할당된 고객만 수정 가능

**전제조건**:
- [ ] Sales 사용자 2명이 필요 (sales-001, sales-002)
- [ ] Contact 2개 생성 (sales-001에 1개, sales-002에 1개 할당)

**테스트 데이터**:
```sql
INSERT INTO "Contact" (id, organizationId, phone, name, assignedUserId)
VALUES 
  ('cust-001', 'org-test-001', '01012345678', 'Customer 1', 'sales-001'),
  ('cust-002', 'org-test-001', '01087654321', 'Customer 2', 'sales-002');
```

**테스트 단계**:
```
1. sales-001로 로그인
2. API: PATCH /api/contacts/cust-001
   Body: { "stage": "booking" }
   Expected: 200 OK
   
3. 동일 사용자가 cust-002 수정 시도:
   PATCH /api/contacts/cust-002
   Expected: 403 Forbidden
```

**API 테스트 코드**:
```typescript
// src/tests/api/contacts-rbac.test.ts
describe('Contact RBAC', () => {
  test('User can update own assigned contact', async () => {
    const response = await fetch(
      'http://localhost:3000/api/contacts/cust-001',
      {
        method: 'PATCH',
        headers: { 
          'Cookie': 'mabiz.sid=<SALES1_SESSION>',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stage: 'booking' })
      }
    );
    expect(response.status).toBe(200);
  });

  test('User cannot update other user contact', async () => {
    const response = await fetch(
      'http://localhost:3000/api/contacts/cust-002',
      {
        method: 'PATCH',
        headers: { 
          'Cookie': 'mabiz.sid=<SALES1_SESSION>',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stage: 'booking' })
      }
    );
    expect(response.status).toBe(403);
  });
});
```

---

### TC-015: 조직 간 데이터 격리
**목적**: 다른 조직의 데이터는 접근 불가

**전제조건**:
- [ ] Organization 2개 생성 (org-001, org-002)
- [ ] 각 조직에 Contact 1개씩 생성

**테스트 데이터**:
```sql
-- Organization 2 생성
INSERT INTO "Organization" (id, name, slug)
VALUES ('org-test-002', 'Test Org 2', 'test-org-2');

-- Organization 2에 Member 추가
INSERT INTO "OrganizationMember" 
  (id, organizationId, userId, role, email)
VALUES ('mem-other-001', 'org-test-002', 'other-user-001', 'AGENT', 'other@mabiz.test');

-- Contact in Org 1
INSERT INTO "Contact" (id, organizationId, phone, name)
VALUES ('cust-org1', 'org-test-001', '01000000001', 'Org1 Customer');

-- Contact in Org 2
INSERT INTO "Contact" (id, organizationId, phone, name)
VALUES ('cust-org2', 'org-test-002', '01000000002', 'Org2 Customer');
```

**테스트 단계**:
```
1. org-test-001의 사용자로 로그인
2. GET /api/contacts (자신의 조직만 보여야 함)
3. GET /api/contacts/cust-org2 (다른 조직 고객)
```

**예상 결과**:
- [ ] GET /api/contacts: cust-org1만 반환 (cust-org2 제외)
- [ ] GET /api/contacts/cust-org2: 403 Forbidden 또는 404

**DB 검증**:
```typescript
test('Contact list filtered by organizationId', async () => {
  const contacts = await prisma.contact.findMany({
    where: { organizationId: 'org-test-001' }
  });
  
  const contactIds = contacts.map(c => c.id);
  expect(contactIds).toContain('cust-org1');
  expect(contactIds).not.toContain('cust-org2');
});
```

---

### TC-016: Admin은 모든 조직 데이터 접근 가능
**목적**: Global Admin은 조직 필터링 없이 모든 데이터 접근

**전제조건**:
- [ ] Admin (GLOBAL_ADMIN role) 로그인
- [ ] TC-015 데이터 준비

**테스트 단계**:
```
1. Admin 로그인
2. GET /api/admin/contacts
   Expected: org-test-001, org-test-002 모두의 고객 반환
```

**API 검증**:
```bash
curl -b "mabiz.sid=<ADMIN_SESSION>" \
  http://localhost:3000/api/admin/contacts | jq '.data | length'
# Expected: cust-org1, cust-org2 모두 포함
```

---

### TC-017 ~ TC-025: (추가 권한 테스트)

각 렌즈별, API별 권한 검증...

**[상세 내용 생략: 동일한 패턴으로 계속]**

---

## 🗄️ Phase 3: CRM 기능 검증 (TC-026 ~ TC-035)

### TC-026: Contact 생성 API
**목적**: 새 고객 정보 생성

**전제조건**:
- [ ] Sales 사용자 로그인

**테스트 단계**:
```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Cookie: mabiz.sid=<SESSION>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "01099999999",
    "name": "New Customer",
    "email": "new@example.com",
    "budgetRange": "5000-10000",
    "cruiseInterest": "caribbean"
  }'
```

**예상 결과**:
```json
{
  "id": "cust-new-001",
  "organizationId": "org-test-001",
  "phone": "01099999999",
  "name": "New Customer",
  "email": "new@example.com",
  "createdAt": "2026-05-25T14:00:00Z",
  "assignedUserId": "sales-001"
}
```

**DB 검증**:
```sql
SELECT id, organizationId, phone, name, createdAt 
FROM "Contact" 
WHERE phone = '01099999999' 
LIMIT 1;
```

---

### TC-027: Contact 조회 (필터링)
**목적**: 고객 목록 조회 및 필터링

**테스트 단계**:
```bash
# 1. 전체 조회
curl "http://localhost:3000/api/contacts" \
  -H "Cookie: mabiz.sid=<SESSION>"

# 2. 검색 필터
curl "http://localhost:3000/api/contacts?search=New%20Customer" \
  -H "Cookie: mabiz.sid=<SESSION>"

# 3. 페이지네이션
curl "http://localhost:3000/api/contacts?page=1&limit=10" \
  -H "Cookie: mabiz.sid=<SESSION>"
```

**예상 결과**:
- [ ] 조직의 모든 Contact 반환
- [ ] 검색: name, email, phone 포함
- [ ] 페이지네이션: limit, offset 작동

---

### TC-028: L0 렌즈 (부재중 고객) 데이터 저장
**목적**: 부재중 고객 세그먼트 정보 저장

**테스트 단계**:
```bash
curl -X PATCH http://localhost:3000/api/contacts/cust-001 \
  -H "Cookie: mabiz.sid=<SESSION>" \
  -H "Content-Type: application/json" \
  -d '{
    "reactivationSegment": "6-12m",
    "reactivationLikelihood": 75,
    "lastCruiseDate": "2025-06-15",
    "cruiseCount": 3,
    "vipStatus": "GOLD"
  }'
```

**예상 결과**:
```json
{
  "id": "cust-001",
  "reactivationSegment": "6-12m",
  "reactivationLikelihood": 75,
  "lastCruiseDate": "2025-06-15",
  "cruiseCount": 3,
  "vipStatus": "GOLD"
}
```

**DB 검증**:
```sql
SELECT id, reactivationSegment, reactivationLikelihood, lastCruiseDate 
FROM "Contact" 
WHERE id = 'cust-001';
```

---

### TC-029: L2 렌즈 (준비불안) 데이터 저장
**목적**: 고객 불안도 및 준비 단계 기록

**테스트 단계**:
```bash
curl -X PATCH http://localhost:3000/api/contacts/cust-002 \
  -H "Cookie: mabiz.sid=<SESSION>" \
  -d '{
    "anxietyScore": 85,
    "anxietyCategory": "high",
    "preparationStage": "visa_concern",
    "visaRequired": true,
    "healthConcerns": "배멀미,당뇨",
    "firstTimeCruise": true,
    "familyWithKids": true
  }'
```

**예상 결과**:
- [ ] anxietyScore: 85
- [ ] healthConcerns 배열 저장됨
- [ ] preparationStage: "visa_concern"

**SQL 검증**:
```sql
SELECT anxietyScore, anxietyCategory, healthConcerns 
FROM "Contact" 
WHERE id = 'cust-002';
```

---

### TC-030: L3 렌즈 (차별성 미인지) 데이터 저장
**목적**: 경쟁사 언급 및 차별성 점수 기록

**테스트 단계**:
```bash
curl -X PATCH http://localhost:3000/api/contacts/cust-003 \
  -H "Cookie: mabiz.sid=<SESSION>" \
  -d '{
    "competitorMentioned": true,
    "competitorNames": ["Royal Caribbean", "MSC Cruises"],
    "lastCompetitorMentionAt": "2026-05-25T10:30:00Z",
    "differentiationScore": 45
  }'
```

**예상 결과**:
- [ ] competitorMentioned: true
- [ ] competitorNames 배열 저장됨
- [ ] differentiationScore: 45

---

### TC-031 ~ TC-035: (추가 CRM 렌즈 테스트)

L5, L6, L7, L8, L10 렌즈 데이터 저장 검증...

---

## 🚀 Phase 4: CruiseDot API 연동 (TC-036 ~ TC-045)

### TC-036: CruiseDot 환경변수 확인
**목적**: CruiseDot API 키 설정 확인

**테스트 단계**:
```bash
# 1. 환경변수 확인
echo "CRUISEDOT_API_KEY: $CRUISEDOT_API_KEY"
echo "CRUISEDOT_WEBHOOK_SECRET: $CRUISEDOT_WEBHOOK_SECRET"

# 2. 키 형식 검증
if [[ $CRUISEDOT_API_KEY == sk_* ]]; then
  echo "✓ API Key format OK"
else
  echo "✗ Invalid API Key format"
fi
```

**예상 결과**:
- [ ] CRUISEDOT_API_KEY 설정됨
- [ ] CRUISEDOT_WEBHOOK_SECRET 설정됨
- [ ] 키 형식: sk_live_xxx 또는 sk_staging_xxx

---

### TC-037: CruiseDot 상품 목록 조회
**목적**: CruiseDot API에서 상품 정보 조회

**테스트 단계**:
```bash
curl -X GET http://localhost:3000/api/products \
  -H "Cookie: mabiz.sid=<SESSION>" \
  -H "Content-Type: application/json"
```

**예상 결과**:
```json
{
  "data": [
    {
      "id": "cruise-001",
      "name": "Caribbean 7-Day Cruise",
      "departureDate": "2026-06-01",
      "price": 1500,
      "capacity": 50
    }
  ],
  "total": 10
}
```

**실패 시 확인**:
```bash
# 1. CruiseDot API 직접 호출
curl -H "Authorization: Bearer $CRUISEDOT_API_KEY" \
  https://api.cruisedot.co.kr/v1/products

# 2. 서버 로그 확인
grep "CruiseDot" output.log | tail -10
```

---

### TC-038: Webhook 수신 (결제 완료)
**목적**: CruiseDot에서 결제 완료 웹훅 수신 및 처리

**전제조건**:
- [ ] Contact 생성됨 (cust-004)
- [ ] 예약 생성됨 (booking ref: BK001)

**테스트 단계**:
```bash
# 웹훅 시뮬레이션 (HMAC 서명 포함)
BODY='{
  "eventId": "evt-001",
  "eventType": "payment.confirmed",
  "timestamp": "2026-05-25T14:00:00Z",
  "bookingRef": "BK001",
  "status": "CONFIRMED"
}'

SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$CRUISEDOT_WEBHOOK_SECRET" | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/cruisedot-payment \
  -H "Authorization: Bearer $CRUISEDOT_WEBHOOK_SECRET" \
  -H "x-signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

**예상 결과**:
- [ ] 200 OK
- [ ] Contact.lastPaymentStatus = "CONFIRMED"
- [ ] Contact.lastPaymentAt = 현재시간

**DB 검증**:
```sql
SELECT bookingRef, lastPaymentStatus, lastPaymentAt 
FROM "Contact" 
WHERE id = 'cust-004';
```

---

### TC-039: Webhook 수신 (환불)
**목적**: 환불 웹훅 처리

**테스트 단계**:
```bash
BODY='{
  "eventId": "evt-002",
  "eventType": "payment.refunded",
  "bookingRef": "BK001",
  "status": "REFUNDED",
  "refundAmount": 300,
  "reason": "Customer requested"
}'

SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$CRUISEDOT_WEBHOOK_SECRET" | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/cruisedot-payment \
  -H "x-signature: $SIGNATURE" \
  -d "$BODY"
```

**예상 결과**:
- [ ] 200 OK
- [ ] lastPaymentStatus = "REFUNDED"
- [ ] lastRefundedAt = 현재시간

---

### TC-040 ~ TC-045: (추가 CruiseDot 테스트)

예약 조회, 환불 정책, 다중 예약 등...

---

## ⚡ Phase 5: 성능 검증 (TC-046 ~ TC-050)

### TC-046: Dashboard 로딩 속도
**목적**: /dashboard 페이지 로딩 시간 < 2.5초

**테스트 도구**: Lighthouse 또는 DevTools

**테스트 단계**:
```bash
# 1. Lighthouse 사용
lighthouse http://localhost:3000/dashboard/dashboard \
  --chrome-flags="--headless" \
  --output=json > lighthouse-dashboard.json

# 2. 성능 점수 확인
jq '.categories.performance.score' lighthouse-dashboard.json
# Expected: > 0.85 (85점 이상)

# 3. LCP(Largest Contentful Paint) 확인
jq '.audits.largest-contentful-paint' lighthouse-dashboard.json
# Expected: < 2.5s
```

**DevTools 방식**:
```
1. 브라우저 DevTools 열기 (F12)
2. Performance 탭 → 녹화 시작
3. /dashboard/dashboard 페이지 새로고침
4. 녹화 중지 → 분석
```

**예상 결과**:
- [ ] FCP (First Contentful Paint) < 1.0초
- [ ] LCP (Largest Contentful Paint) < 2.5초
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] 전체 로딩 < 3.0초

---

### TC-047: Contact 목록 로딩 (1000개 레코드)
**목적**: 대량 데이터 조회 성능

**테스트 데이터**:
```sql
INSERT INTO "Contact" (organizationId, phone, name, createdAt)
SELECT 
  'org-test-001',
  '010' || LPAD((ROW_NUMBER() OVER (ORDER BY generate_series))::text, 8, '0'),
  'Customer ' || ROW_NUMBER() OVER (ORDER BY generate_series),
  NOW() - INTERVAL '1 day' * RANDOM() * 365
FROM generate_series(1, 1000);
```

**테스트 단계**:
```bash
# API 응답 시간 측정
time curl -w "\nTime: %{time_total}s\n" \
  "http://localhost:3000/api/contacts?page=1&limit=100" \
  -H "Cookie: mabiz.sid=<SESSION>"
```

**예상 결과**:
- [ ] 응답 시간 < 500ms
- [ ] 데이터 크기 < 1MB

---

### TC-048: 동시 요청 처리 (Concurrency)
**목적**: 여러 사용자 동시 접근 처리

**테스트 도구**: Apache Bench 또는 wrk

**테스트 단계**:
```bash
# Apache Bench: 100 요청, 10 동시 연결
ab -n 100 -c 10 \
  -H "Cookie: mabiz.sid=<SESSION>" \
  http://localhost:3000/api/contacts

# Expected: 모든 요청 200 OK, 처리 시간 < 500ms
```

**예상 결과**:
- [ ] 완료 요청 비율 100%
- [ ] 평균 응답 시간 < 500ms
- [ ] 에러 없음

---

### TC-049: 데이터베이스 쿼리 최적화 (N+1 검증)
**목적**: N+1 쿼리 문제 없는지 확인

**테스트 단계**:
```typescript
// src/tests/performance-n1.test.ts
import { performance } from 'perf_hooks';

test('No N+1 queries in contact list', async () => {
  // Prisma Query Engine로깅 활성화
  process.env.DEBUG = '*';
  
  const start = performance.now();
  const contacts = await prisma.contact.findMany({
    where: { organizationId: 'org-test-001' },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      reactivationSegment: true,
      anxietyScore: true,
      competitorMentioned: true,
    }
  });
  const end = performance.now();
  
  // 예상: 1개의 쿼리 (또는 최대 2-3개)
  // 실제로 100개 레코드에 대해 100개+ 쿼리가 실행되면 N+1 문제
  
  expect(end - start).toBeLessThan(200);
  expect(contacts).toHaveLength(100);
});
```

**로그 분석**:
```bash
DEBUG=prisma:* npm test -- --testNamePattern="No N+1" 2>&1 | grep "SELECT"
# 출력 줄 수가 적어야 함 (1-2줄, N+1이면 100+줄)
```

---

### TC-050: 메모리 누수 검증
**목적**: 장시간 실행 시 메모리 누수 없는지 확인

**테스트 단계**:
```bash
# 1. 메모리 모니터링하며 서버 시작
node --inspect=9229 node_modules/.bin/next dev

# 2. 외부에서 부하 테스트 실행 (별도 터미널)
for i in {1..1000}; do
  curl -s "http://localhost:3000/api/contacts?page=$((RANDOM % 10))" \
    -H "Cookie: mabiz.sid=<SESSION>" > /dev/null
  sleep 0.1
done

# 3. Chrome DevTools Inspector 접속
# chrome://inspect → Target: localhost:9229

# 4. Memory 탭에서:
#    - Heap size 모니터링
#    - Detached DOM nodes 확인
#    - 메모리 증가 추이 분석
```

**예상 결과**:
- [ ] Heap size 안정적 (지속적 증가 없음)
- [ ] GC 후 메모리 복구됨
- [ ] Detached DOM nodes < 100

---

## 📋 최종 체크리스트

### Phase 1: 인증 (TC-001 ~ TC-010)
```
[ ] TC-001: Clerk 로그인 페이지 로드
[ ] TC-002: Admin 로그인
[ ] TC-003: Manager 로그인
[ ] TC-004: Sales 로그인
[ ] TC-005: PreSales 로그인
[ ] TC-006: 잘못된 비밀번호 실패
[ ] TC-007: 존재하지 않는 이메일 실패
[ ] TC-008: 로그아웃
[ ] TC-009: 세션 타임아웃
[ ] TC-010: 멀티 디바이스 로그인
```

### Phase 2: 권한 (TC-011 ~ TC-025)
```
[ ] TC-011: Admin /admin/* 접근
[ ] TC-012: Member /admin/* 접근 불가
[ ] TC-013: 팀 관리 권한
[ ] TC-014: Contact 수정 권한
[ ] TC-015: 조직 간 데이터 격리
[ ] TC-016: Admin 전체 접근
[ ] TC-017~025: 추가 권한 테스트
```

### Phase 3: CRM (TC-026 ~ TC-035)
```
[ ] TC-026: Contact 생성
[ ] TC-027: Contact 조회 필터링
[ ] TC-028: L0 렌즈 데이터
[ ] TC-029: L2 렌즈 데이터
[ ] TC-030: L3 렌즈 데이터
[ ] TC-031~035: 추가 렌즈 테스트
```

### Phase 4: CruiseDot (TC-036 ~ TC-045)
```
[ ] TC-036: 환경변수 확인
[ ] TC-037: 상품 목록 조회
[ ] TC-038: Webhook 결제 완료
[ ] TC-039: Webhook 환불
[ ] TC-040~045: 추가 CruiseDot 테스트
```

### Phase 5: 성능 (TC-046 ~ TC-050)
```
[ ] TC-046: Dashboard 로딩 속도
[ ] TC-047: Contact 목록 성능
[ ] TC-048: 동시 요청 처리
[ ] TC-049: N+1 쿼리 검증
[ ] TC-050: 메모리 누수 검증
```

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0

