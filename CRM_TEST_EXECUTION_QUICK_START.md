# CRM 테스트 실행 빠른 시작 가이드
**마지막 업데이트**: 2026-05-25  
**실행 소요 시간**: 3-4시간 (전체 테스트)

---

## 🚀 10초 안에 시작하기

```bash
# 1. 저장소 클론 (이미 있으면 생략)
cd D:\mabiz-crm

# 2. 패키지 설치
npm ci

# 3. 데이터베이스 마이그레이션
npx prisma migrate deploy

# 4. 개발 서버 시작
npm run dev

# 5. 브라우저 열기
# http://localhost:3000/sign-in
```

---

## 📋 단계별 실행 계획

### Step 1: 환경 준비 (15분)

**체크리스트**:
```bash
# 1. 환경변수 확인
cat .env.local | grep -E "CLERK|DATABASE|CRUISEDOT"

# 2. 데이터베이스 연결 확인
npx prisma db push
# Expected: ✓ Your database is now in sync

# 3. 개발 서버 시작 (별도 터미널)
npm run dev

# 4. 헬스 체크
curl -i http://localhost:3000
# Expected: 200 OK
```

---

### Step 2: 테스트 사용자 생성 (10분)

**Clerk에서 테스트 계정 생성**:
1. Clerk 대시보브 접속: https://dashboard.clerk.com
2. Users → Create user
   - Email: admin@mabiz.test
   - Password: (자동 생성)
3. 반복: manager@mabiz.test, sales@mabiz.test, presales@mabiz.test

**데이터베이스에 테스트 사용자 등록**:
```bash
# SQL 파일 실행
psql $DATABASE_URL < CRM_TEST_DATA_SETUP.sql

# 또는 prisma studio 사용
npx prisma studio
```

---

### Step 3: 자동화 테스트 (30분)

```bash
# Phase 1: 인증 테스트
npm test -- src/tests/auth-roles.test.ts

# Phase 2: 권한 테스트 (RBAC)
npm test -- src/tests/rbac-team.test.ts
npm test -- src/lib/route-rules.test.ts

# Phase 3: CRM API 테스트
npm test -- src/tests/api/contacts.test.ts

# Phase 4: 데이터 무결성 테스트
npm test -- src/tests/data-integrity.test.ts

# 모든 테스트 한 번에 실행
npm test
```

---

### Step 4: 수동 E2E 테스트 (90분)

#### 4.1 Admin 사용자 테스트 (20분)

```bash
# 1. 로그인
curl -i http://localhost:3000/sign-in

# 2. admin@mabiz.test 로그인
# 3. /dashboard 접근 확인
# 4. /admin/users 접근 확인
# 5. 권한 있음을 확인

# API 테스트
curl -H "Cookie: mabiz.sid=<ADMIN_SESSION>" \
  http://localhost:3000/api/admin/users
```

**체크리스트**:
- [ ] 로그인 성공
- [ ] /dashboard 접근 가능
- [ ] /admin/users 접근 가능
- [ ] 사용자 목록 조회 가능
- [ ] 로그아웃 가능

---

#### 4.2 Manager 사용자 테스트 (20분)

```bash
# 1. 로그아웃 (admin에서)
# 2. manager@mabiz.test 로그인
# 3. /dashboard 접근 확인
# 4. /dashboard/team/members 접근 확인
# 5. /admin/users 접근 차단 확인 (403)

curl -H "Cookie: mabiz.sid=<MANAGER_SESSION>" \
  http://localhost:3000/admin/users
# Expected: 403 Forbidden
```

**체크리스트**:
- [ ] 로그인 성공
- [ ] /dashboard 접근 가능
- [ ] /dashboard/team/* 접근 가능
- [ ] /admin/* 접근 불가 (403)
- [ ] 자신의 팀 정보만 조회 가능

---

#### 4.3 Sales 사용자 테스트 (20분)

```bash
# 1. sales@mabiz.test 로그인
# 2. Contact 생성
curl -X POST http://localhost:3000/api/contacts \
  -H "Cookie: mabiz.sid=<SALES_SESSION>" \
  -d '{
    "phone": "01012345678",
    "name": "Test Customer",
    "email": "test@example.com"
  }'

# 3. Contact 조회
curl http://localhost:3000/api/contacts \
  -H "Cookie: mabiz.sid=<SALES_SESSION>"

# 4. Contact 수정 (자신에게 할당된 것만)
curl -X PATCH http://localhost:3000/api/contacts/cust-001 \
  -H "Cookie: mabiz.sid=<SALES_SESSION>" \
  -d '{"stage": "booking"}'
```

**체크리스트**:
- [ ] 고객 생성 가능
- [ ] 자신의 고객 조회 가능
- [ ] 자신의 고객 수정 가능
- [ ] 다른 사용자의 고객 수정 불가 (403)

---

#### 4.4 PreSales 사용자 테스트 (20분)

```bash
# 1. presales@mabiz.test 로그인
# 2. Inbound Lead 조회
# 3. Anxiety Assessment 기록
curl -X PATCH http://localhost:3000/api/contacts/cust-002 \
  -H "Cookie: mabiz.sid=<PRESALES_SESSION>" \
  -d '{
    "anxietyScore": 75,
    "anxietyCategory": "medium",
    "preparationStage": "visa_concern"
  }'

# 4. Follow-up 스케줄 생성
```

**체크리스트**:
- [ ] 초기 상담 기록 가능
- [ ] 렌즈 데이터 기록 가능
- [ ] Follow-up 스케줄링 가능

---

### Step 5: CruiseDot API 테스트 (30분)

```bash
# 1. 환경변수 확인
echo "API Key: $CRUISEDOT_API_KEY"
echo "Webhook Secret: $CRUISEDOT_WEBHOOK_SECRET"

# 2. 상품 목록 조회
curl http://localhost:3000/api/products \
  -H "Cookie: mabiz.sid=<SESSION>"

# 3. Webhook 테스트 (결제 완료)
WEBHOOK_BODY='{
  "eventId": "evt-test-001",
  "eventType": "payment.confirmed",
  "bookingRef": "BK-TEST-001",
  "status": "CONFIRMED"
}'

SIGNATURE=$(echo -n "$WEBHOOK_BODY" | \
  openssl dgst -sha256 -hmac "$CRUISEDOT_WEBHOOK_SECRET" | \
  cut -d' ' -f2)

curl -X POST http://localhost:3000/api/webhooks/cruisedot-payment \
  -H "x-signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_BODY"
```

**체크리스트**:
- [ ] API Key 설정됨
- [ ] Webhook Secret 설정됨
- [ ] 상품 조회 가능
- [ ] Webhook 수신 및 처리 정상

---

### Step 6: 성능 테스트 (30분)

```bash
# 1. Lighthouse 성능 점수
lighthouse http://localhost:3000/dashboard/dashboard \
  --chrome-flags="--headless" \
  --output=json > lighthouse-report.json

jq '.categories.performance.score' lighthouse-report.json
# Expected: > 0.85

# 2. 대량 데이터 조회 성능
npm test -- src/tests/performance.test.ts

# 3. 동시 요청 테스트
ab -n 100 -c 10 \
  -H "Cookie: mabiz.sid=<SESSION>" \
  http://localhost:3000/api/contacts
```

**체크리스트**:
- [ ] Lighthouse 점수 > 85점
- [ ] 대량 조회 < 500ms
- [ ] 동시 요청 100% 성공

---

## 🎯 테스트 결과 정리

### 자동화 테스트 결과 수집

```bash
# 1. Jest 테스트 결과
npm test -- --coverage --json > test-results.json

# 2. 테스트 보고서 생성
npm test -- --reporters=junit \
  --outputFile=test-results.xml

# 3. 커버리지 리포트
open coverage/lcov-report/index.html
```

### 수동 테스트 결과 기록

```bash
# 수동 테스트 결과 파일 생성
cat > MANUAL_TEST_RESULTS.md << 'EOF'
# 수동 테스트 결과

## Phase 1: 인증 (Admin)
- [ ] 로그인 성공: PASS
- [ ] /dashboard 접근: PASS
- [ ] /admin/users 접근: PASS

## Phase 2: 권한 (Manager)
- [ ] 로그인 성공: PASS
- [ ] /admin/* 차단: PASS
- [ ] /dashboard/team/* 접근: PASS

## Phase 3: CRM (Sales)
- [ ] Contact 생성: PASS
- [ ] Contact 수정: PASS
- [ ] 권한 제한: PASS

## Phase 4: CruiseDot
- [ ] API 연동: PASS
- [ ] Webhook 수신: PASS

## Phase 5: 성능
- [ ] Dashboard < 2.5초: PASS
- [ ] API < 500ms: PASS
- [ ] N+1 없음: PASS

EOF
```

---

## 🔧 문제 해결

### 로그인 실패

```bash
# 1. Clerk 환경변수 확인
echo "Clerk Key: $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"

# 2. Clerk 계정 존재 여부
# https://dashboard.clerk.com → Users

# 3. 서버 로그 확인
tail -f output.log | grep -i "clerk\|auth"
```

### 권한 에러 (403 Forbidden)

```bash
# 1. 사용자 역할 확인
psql $DATABASE_URL << EOF
SELECT userId, role, organizationId 
FROM "OrganizationMember" 
WHERE email = 'user@mabiz.test';
EOF

# 2. 세션 역할 확인
psql $DATABASE_URL << EOF
SELECT role, memberId, expiresAt 
FROM "MabizSession" 
WHERE id = '<SESSION_ID>';
EOF

# 3. 역할 업데이트 (필요 시)
psql $DATABASE_URL << EOF
UPDATE "OrganizationMember" 
SET role = 'AGENT' 
WHERE email = 'user@mabiz.test';
EOF
```

### 성능 느림

```bash
# 1. 데이터베이스 쿼리 로그
DATABASE_URL="..." \
DEBUG="prisma:*" \
npm run dev 2>&1 | grep "SELECT\|UPDATE\|INSERT"

# 2. N+1 쿼리 확인
npm test -- --testNamePattern="N\+1" --verbose

# 3. 느린 쿼리 분석
psql $DATABASE_URL << EOF
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT query, calls, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
EOF
```

---

## 📊 최종 체크리스트

```
Authentication (인증)
[ ] Admin 로그인 성공
[ ] Manager 로그인 성공
[ ] Sales 로그인 성공
[ ] PreSales 로그인 성공
[ ] 로그아웃 정상

Authorization (권한)
[ ] Admin /admin/* 접근 가능
[ ] Member /admin/* 접근 불가
[ ] Member /dashboard/team/* 접근 가능
[ ] Contact 소유권 검증 작동
[ ] 조직 간 데이터 격리

CRM Features (기능)
[ ] Contact CRUD 정상
[ ] L0-L3 렌즈 데이터 저장 정상
[ ] SMS 발송 권한 정상
[ ] Follow-up 스케줄링 정상

CruiseDot Integration (통합)
[ ] API Key 설정 확인
[ ] 상품 조회 가능
[ ] Webhook 수신 정상
[ ] 결제 상태 동기화 정상

Performance (성능)
[ ] Dashboard < 2.5초
[ ] API 응답 < 500ms
[ ] 대량 조회 < 500ms
[ ] N+1 쿼리 문제 없음
[ ] 메모리 누수 없음

Database (데이터)
[ ] 테스트 조직 생성됨
[ ] 테스트 사용자 4명 생성됨
[ ] Contact 테스트 데이터 100+ 개
[ ] 데이터 일관성 검증 통과
```

---

## 📞 도움이 필요한가요?

**자동화 테스트 관련**:
```bash
npm test -- --help
npm test -- --testNamePattern="TC-001"
```

**데이터베이스 관련**:
```bash
npx prisma studio
# 또는
npx prisma db push --skip-generate
```

**성능 프로파일링**:
```bash
npm run dev -- --inspect=9229
# chrome://inspect
```

---

**시간 예상**:
- 환경 준비: 15분
- 자동화 테스트: 30분
- 수동 E2E 테스트: 90분
- 성능 테스트: 30분
- 결과 정리: 15분

**총 소요시간**: 180분 (3시간)

---

**성공 기준**:
- ✅ 모든 사용자 역할 로그인 성공
- ✅ 권한 기반 접근 제어 정상
- ✅ CRM Contact API 100% 동작
- ✅ CruiseDot Webhook 정상 처리
- ✅ 페이지 로딩 < 3초
- ✅ API 응답 < 500ms

---

**마지막 업데이트**: 2026-05-25  
**버전**: 1.0 (Quick Start Guide)

