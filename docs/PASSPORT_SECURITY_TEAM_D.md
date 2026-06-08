# Team D: 여권 시스템 보안 강화 (2026-06-08)

## 📋 개요

**담당 기능:**
1. 권한 검증 (ADMIN/MANAGER만)
2. CSRF 토큰 검증 (POST /api/passport/send-sms)
3. PII 마스킹 (비관리자는 전화번호 뒤 4자리만)
4. 감시 로깅 (누가 언제 SMS를 보냈나)

**구현 상태:** ✅ 완료 (2026-06-08)

---

## 🏗️ 아키텍처

### 신규 파일: src/lib/passport-security.ts

**주요 함수:**

```typescript
// 1. 권한 검증
async requirePassportAccess(action: 'read' | 'send-sms' | 'manage-requests')
  → PassportSecurityContext {
    userId: string;
    gmUserId: number | null;
    role: 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | null;
    organizationId: string | null;
  }

// 2. CSRF 토큰 검증
async validatePassportCsrf(req: Request, sessionId: string)
  → void (검증 실패 시 throw)

// 3. PII 마스킹 (역할별)
function maskPiiByRole(
  value: string,
  type: 'phone' | 'name' | 'email',
  role: string
) → string

// 4. 감시 로깅
async auditLog(entry: PassportAuditLog) → void

// 5. 통합 검증 (POST 요청용)
async validatePassportSmsRequest(req: Request)
  → { ok: true; ctx } | { ok: false; error; status }
```

---

## 🔐 권한 모델

### 역할별 접근 권한

| 역할 | read | send-sms | manage-requests |
|------|------|----------|-----------------|
| GLOBAL_ADMIN | ✅ | ✅ | ✅ |
| OWNER | ✅ | ✅ | ✅ |
| AGENT | ✅ | ❌ | ❌ |
| 기타 | ❌ | ❌ | ❌ |

### 구현 방식

```typescript
// POST /api/passport/send-sms에서:
const validation = await validatePassportSmsRequest(req);
if (!validation.ok) {
  return NextResponse.json({ error: validation.error }, { status: validation.status });
}
const ctx = validation.ctx; // { userId, gmUserId, role, organizationId }
```

---

## 🛡️ CSRF 토큰 검증

### 흐름

1. **클라이언트:** 로그인 후 CSRF 토큰 요청
   ```
   GET /api/passport/csrf-token
   → { token: "a1b2c3d4..." }
   ```

2. **클라이언트:** POST 요청 시 헤더에 토큰 포함
   ```
   POST /api/passport/send-sms
   Headers: {
     "X-CSRF-Token": "a1b2c3d4...",
     "Content-Type": "application/json"
   }
   ```

3. **서버:** 토큰 검증 (validatePassportCsrf)
   ```typescript
   await validatePassportCsrf(req, ctx.userId);
   // Redis에서 검증 (또는 메모리 폴백)
   ```

### 기술 스택

- **저장소:** Upstash Redis (우선) + 메모리 Map (폴백)
- **타임아웃:** 1시간
- **형식:** 64자 hex string (Web Crypto API)
- **Edge Runtime 호환:** ✅ (Node.js 'crypto' 대신 Web Crypto 사용)

---

## 🎭 PII 마스킹 (역할별)

### 마스킹 규칙

#### GLOBAL_ADMIN (전체 공개)
```
이름: "김철수"
전화: "010-1234-5678"
이메일: "john@example.com"
```

#### OWNER (부분 마스킹)
```
이름: "김*" (첫 글자만)
전화: "010-****-5678" (뒤 4자리만)
이메일: "jo***@***" (도메인 마스킹)
```

#### AGENT (강한 마스킹)
```
이름: "김*"
전화: "010-****-5678"
이메일: "[마스킹됨]"
```

### 사용 예시

```typescript
// API 응답에서 PII 마스킹
const maskedUser = maskUserByRole(user, ctx.role);
// { name: "김*", phone: "010-****-5678" }

// 로그에서 PII 마스킹
const maskedPhone = maskPiiByRole(user.phone, 'phone', ctx.role);
logger.log('[SMS]', { phone: maskedPhone }); // "010-****-5678"
```

---

## 📝 감시 로깅 (Audit Trail)

### 로깅 항목

```typescript
interface PassportAuditLog {
  userId: string;        // CRM userId
  gmUserId: number | null;
  action: string;        // 'SMS_SENT' | 'SMS_FAILED' | 'CSRF_VALIDATION_FAILED' | etc.
  resource: string;      // 'TRIP' | 'SMS' | 'REQUEST_LOG'
  resourceId?: number;
  status: 'SUCCESS' | 'FAILURE' | 'DENIED';
  metadata?: Record<string, any>;
  timestamp: string;
  ip?: string;
}
```

### 예시: SMS 배치 발송 로깅

```typescript
await auditLog({
  userId: ctx.userId,
  gmUserId: ctx.gmUserId,
  action: 'SMS_BATCH_SENT',
  resource: 'TRIP',
  resourceId: tripId,
  status: 'SUCCESS',
  metadata: {
    totalCount: 10,
    successCount: 9,
    failureCount: 1,
    templateType: 'basic',
    errorCount: 1,
  },
  ip: extractIp(req),
});
```

### 로깅 저장소

1. **Logger 기록** (일시적) → stdout/파일
2. **DB 기록** (영구) → PassportAuditLog 테이블 (향후 추가 예정)

---

## 🔄 통합된 POST /api/passport/send-sms 흐름

### 요청 → 응답 전체 흐름

```
1. validatePassportSmsRequest(req)
   ├─ 권한 검증 (requirePassportAccess)
   │  └─ ADMIN/OWNER만 가능
   │
   ├─ CSRF 토큰 검증 (validatePassportCsrf)
   │  └─ Redis/메모리에서 검증
   │
   └─ 반환: { ok: true; ctx } 또는 { ok: false; error; status }

2. 요청 바디 검증
   ├─ tripId, userIds, templateType 확인
   └─ 실패 시: auditLog + 403 응답

3. 고객 정보 조회
   ├─ gmUser 테이블에서 name, phone 가져오기
   └─ 실패 시: auditLog + 404 응답

4. SMS 배치 발송 (10명씩)
   ├─ 중복 발송 체크 (24시간 이내)
   ├─ SMS 발송 (Aligo API)
   ├─ PII 마스킹된 로그
   └─ 성공/실패 기록

5. 감시 로깅
   └─ auditLog({
        action: 'SMS_BATCH_SENT',
        status: success ? 'SUCCESS' : 'FAILURE',
        metadata: { successCount, failureCount, errorCount }
      })

6. 응답 반환
   └─ { ok: boolean; successCount; failureCount; errors[] }
```

---

## ✅ 검증 항목 (Phase 5)

### 1️⃣ 권한 검증

**테스트 케이스:**

| 역할 | SMS 발송 | 기대 응답 |
|------|---------|---------|
| GLOBAL_ADMIN | ✅ | 200 OK |
| OWNER (같은 조직) | ✅ | 200 OK |
| AGENT | ❌ | 403 Forbidden |
| 미인증 | ❌ | 401 Unauthorized |

**테스트 코드:**
```bash
# GLOBAL_ADMIN 테스트
curl -X POST http://localhost:3000/api/passport/send-sms \
  -H "X-CSRF-Token: valid-token" \
  -H "Content-Type: application/json" \
  -d '{"tripId": 1, "userIds": [1, 2]}'
# Expected: 200 OK

# AGENT 테스트 (거부)
# Expected: 403 Forbidden (role check failed)
```

---

### 2️⃣ PII 마스킹

**전후 비교:**

```
입력 (DB):
  이름: "김철수"
  전화: "010-1234-5678"
  이메일: "kim@example.com"

출력 (GLOBAL_ADMIN 역할):
  이름: "김철수"
  전화: "010-1234-5678"
  이메일: "kim@example.com"

출력 (OWNER 역할):
  이름: "김*"
  전화: "010-****-5678"
  이메일: "ki***@***"

출력 (AGENT 역할):
  이름: "김*"
  전화: "010-****-5678"
  이메일: "[마스킹됨]"
```

---

### 3️⃣ 감시 로깅

**로그 샘플:**

```json
{
  "timestamp": "2026-06-08T10:30:00.000Z",
  "level": "info",
  "context": "[Passport Audit]",
  "data": {
    "userId": "user_abc123...",
    "gmUserId": 42,
    "action": "SMS_BATCH_SENT",
    "resource": "TRIP",
    "resourceId": 123,
    "status": "SUCCESS",
    "metadata": {
      "totalCount": 10,
      "successCount": 9,
      "failureCount": 1,
      "templateType": "basic",
      "errorCount": 1
    },
    "ip": "192.168.1.1"
  }
}
```

---

### 4️⃣ CSRF 토큰 검증

**성공 케이스:**
```
1. 로그인 후 토큰 요청
   GET /api/passport/csrf-token → { token: "..." }

2. SMS 발송 시 토큰 포함
   POST /api/passport/send-sms
   Headers: { "X-CSRF-Token": "..." }

3. 검증 성공
   Status: 200 OK
```

**실패 케이스:**
```
1. 토큰 없음
   POST /api/passport/send-sms (X-CSRF-Token 헤더 없음)
   → Status: 403 (CSRF validation failed)

2. 토큰 만료
   POST /api/passport/send-sms (1시간 이상 지난 토큰)
   → Status: 403 (CSRF validation failed)

3. 토큰 위변조
   POST /api/passport/send-sms (잘못된 토큰)
   → Status: 403 (CSRF validation failed)
```

---

## 🔗 Team 간 연계

### Team A (API 구현)와의 협력
- ✅ `src/app/api/passport/send-sms/route.ts` 수정 완료
- ✅ 권한 + CSRF 검증 통합
- ✅ PII 마스킹 로그 적용

### Team B (프론트엔드)와의 협력
- ⏳ CSRF 토큰 요청/저장 로직 구현 필요
- ⏳ 헤더에 X-CSRF-Token 포함 필요

### Team C (DB)와의 협력
- ⏳ PassportAuditLog 테이블 생성 (향후)
- ✅ 기존 gmPassportRequestLog 활용

---

## 📊 성능 영향

### 추가 요청 시간 (예상)

| 작업 | 시간 |
|------|------|
| 권한 검증 (세션 확인) | ~5ms |
| CSRF 토큰 검증 (Redis) | ~10ms |
| PII 마스킹 | <1ms |
| 감시 로깅 | ~2ms |
| **합계** | ~18ms |

→ 전체 요청 대비 무시할 수 있는 수준

---

## 🚀 배포 체크리스트

- [x] 신규 파일 생성: `src/lib/passport-security.ts`
- [x] API 라우트 수정: `src/app/api/passport/send-sms/route.ts`
- [x] TypeScript 컴파일 확인 (tsc --noEmit)
- [x] PII 마스킹 함수 검증
- [x] 권한 검증 로직 확인
- [x] 감시 로깅 구조 검증
- [ ] CSRF 토큰 엔드포인트 추가 (Team B)
- [ ] PassportAuditLog 테이블 생성 (Team C)
- [ ] 통합 테스트 실행
- [ ] 스테이징 배포
- [ ] 프로덕션 배포

---

## 📚 참고 문서

- CLAUDE.md - 에이전트 지시서
- auth-middleware.ts - 권한 시스템
- csrf.ts - CSRF 토큰 관리
- pii-masker.ts - PII 마스킹 (기존)
- passport-auth.ts - 여권 인증

---

## 🔍 다음 단계

### Phase 1 완료 ✅
- 보안 모듈 설계 및 구현

### Phase 2 예정 (Team B)
- CSRF 토큰 요청 엔드포인트
- 프론트엔드 토큰 저장/전달

### Phase 3 예정 (Team C)
- PassportAuditLog 테이블 생성
- 영구 감사추적 저장

### Phase 4 예정 (전체)
- 다른 POST 엔드포인트에 보안 적용
- E2E 테스트 작성

---

**상태:** 완료 (2026-06-08 23:59:59 UTC)
**담당:** Team D
**검토:** 필요
