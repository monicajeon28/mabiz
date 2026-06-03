# ToolClickTracker API - Task 5 구현 보고서

**작성일**: 2026-06-03  
**도메인**: Agent-Auto-Track  
**상태**: ✅ 구현 완료  
**검증**: `npx tsc --noEmit`

---

## 📋 요구사항 체크리스트

### 1. POST /api/tools/click-tracker (스크립트 클릭 기록)

- [x] **Body 파라미터**
  - `scriptId: string` (필수)
  - `event: "click" | "use" | "success"` (선택, 기본값: "click")
  - `situation?: CallSituation` (선택)
    - PRICE_OBJECTION, HEALTH_CONCERN, REFUND_REQUEST, COMPLAINT,
    - FOOD_CONSULTATION, UPSELL, REBOOKING, CONTRACT_RENEWAL
  - `durationMs?: number` (선택, 통화 시간 밀리초)

- [x] **저장 정보 (AuditLog 테이블)**
  ```
  {
    organizationId: string
    userId: string (현재 사용자)
    action: "TOOL_CLICK"
    resourceType: "PlaybookScript"
    resourceId: string (scriptId)
    purpose: string | undefined (situation)
    reasonDescription: string (event)
    durationMs: number | undefined
    piiFieldsAccessed: [] (PII 제로)
  }
  ```

- [x] **응답**
  ```json
  {
    "success": true,
    "trackId": "12345"
  }
  ```

- [x] **PII 정책**
  - ❌ contactId, phone, email, name 저장 금지
  - ❌ piiFieldsAccessed는 항상 `[]`
  - ✅ userId는 허용 (익명화 가능)

---

### 2. GET /api/tools/click-tracker/stats (성공률 + 순위)

- [x] **쿼리 파라미터**
  - `scriptId?: string` (특정 스크립트, 생략 시 전체 TOP 순위)
  - `days?: number` (기본 7, 범위 1-365)
  - `limit?: number` (기본 10, 최대 50)

- [x] **단일 스크립트 조회 (scriptId 지정)**
  ```json
  {
    "success": true,
    "scriptId": "script-001",
    "title": "가격이의 응대법",
    "type": "CORE",
    "usageCount": 10,
    "successCount": 8,
    "successRate": 80,
    "ranking": 2,
    "scope": "self" | "organization",
    "period": {
      "days": 7,
      "since": "2026-05-27T15:30:00Z"
    }
  }
  ```

- [x] **전체 TOP 순위 조회 (scriptId 생략)**
  ```json
  {
    "success": true,
    "scope": "self" | "organization",
    "summary": {
      "totalUsage": 45,
      "totalSuccess": 32,
      "overallSuccessRate": 71,
      "uniqueScripts": 5
    },
    "topScripts": [
      {
        "scriptId": "script-001",
        "title": "가격이의 응대법",
        "type": "CORE",
        "usageCount": 10,
        "successCount": 8,
        "successRate": 80
      }
    ],
    "period": {
      "days": 7,
      "since": "2026-05-27T15:30:00Z"
    }
  }
  ```

---

### 3. 권한 제어 (RBAC)

| 역할 | 조회 범위 | 설명 |
|------|---------|------|
| **AGENT** | 본인 userId만 | `scope: "self"` |
| **FREE_SALES** | ❌ 차단 | 403 Forbidden |
| **MANAGER** | 팀 userId (TODO) | `scope: "team"` |
| **ADMIN** | 조직 전체 | `scope: "organization"` |
| **OWNER** | 조직 전체 | `scope: "organization"` |

---

### 4. 에러 처리

| 상황 | HTTP 상태 | 응답 |
|------|----------|------|
| 인증 실패 | 401 | `{ success: false, error: "인증이 필요합니다." }` |
| 권한 부족 (FREE_SALES) | 403 | `{ success: false, error: "권한이 없습니다." }` |
| 검증 실패 (scriptId 없음) | 400 | `{ success: false, error: "scriptId는 필수입니다." }` |
| 서버 에러 | 500 | `{ success: false, error: "서버 오류가 발생했습니다." }` |

---

### 5. 감사 로그

- [x] POST 성공 → AuditLog 기록
  - `action: "TOOL_CLICK"`
  - `status: "SUCCESS"`
  - Logger 정보 기록 (userId, scriptId, event)

- [x] GET 조회 → 접근 로그 (INFO 레벨)
  - scope 기록 (self vs organization)
  - days, topCount 기록

---

## 🔒 보안 검증

### PII 제로 정책 확인

```typescript
// ✅ 저장되는 필드들
- organizationId: "org-456"      // 테넌트 격리용
- userId: "user-123"              // 익명화 가능, 통계용
- action: "TOOL_CLICK"
- resourceType: "PlaybookScript"
- resourceId: "script-001"        // scriptId만
- purpose: "PRICE_OBJECTION"      // 상황 코드
- reasonDescription: "success"    // 이벤트 타입
- durationMs: 480000              // 통화 시간
- piiFieldsAccessed: []           // 항상 비어있음

// ❌ 절대 저장되지 않는 필드들
- contactId
- contactPhone
- contactEmail
- contactName
- companyName
- etc.
```

### 조직 격리 (P0)

```typescript
// AGENT: 본인 userId만 조회
const where = ctx.role === "AGENT" 
  ? { userId: ctx.userId, organizationId: ctx.organizationId }
  : { organizationId: ctx.organizationId };

// 크로스 오거니제이션 접근 불가
if (organizationId !== ctx.organizationId && role !== 'GLOBAL_ADMIN') {
  return 403 Forbidden;
}
```

---

## 📊 구현 상세

### 파일 구조

```
src/app/api/tools/click-tracker/
├── route.ts                    (350줄 - POST + GET 엔드포인트)
├── IMPLEMENTATION.md           (이 파일)
└── __tests__/
    └── route.test.ts           (500줄 - 유닛 테스트)
```

### 핵심 로직

#### POST 요청 흐름

```
1. getAuthContext() → userId, organizationId, role 획득
2. FREE_SALES 체크 → 403 반환
3. Body 검증 (scriptId 필수, event 타입 검증)
4. AuditLog.create() 호출
   - organizationId, userId 기록
   - PII 필드: 비어있음
   - durationMs 저장 (선택)
5. 응답: { success: true, trackId }
6. Logger.info() 기록
```

#### GET 요청 흐름 (scriptId 있음)

```
1. getAuthContext() → 권한 확인
2. since 계산 (days 파라미터)
3. scopeWhere 구성 (AGENT는 userId 필터)
4. auditLog.groupBy() 실행 (click vs success 통계)
5. successRate 계산 (success / total * 100)
6. ranking 계산 (전체 스크립트 중 순위)
7. 응답: { scriptId, usageCount, successCount, successRate, ranking }
```

#### GET 요청 흐름 (scriptId 없음)

```
1. auditLog.groupBy() → 전체 스크립트별 사용량
2. 성공 통계 수집 (successMap)
3. salesPlaybook.findMany() → 메타데이터 조회
4. 순위 계산:
   - successRate 정렬 (내림차순)
   - 동률 시 usageCount 정렬
5. top N 반환 (limit)
6. 응답: { summary, topScripts, period }
```

---

## 📈 성능 최적화

### 데이터베이스 인덱스 (기존 AuditLog)

```sql
-- src/lib/prisma/schema.prisma에 이미 정의됨
@@index([organizationId, createdAt])
@@index([userId, createdAt])
@@index([action, createdAt])
@@index([resourceType, resourceId])
```

### 쿼리 최적화

```typescript
// 병렬 실행 (Promise.all)
const [useGroups, successGroups] = await Promise.all([
  prisma.auditLog.groupBy(...),
  prisma.auditLog.groupBy(...)
]);

// 효율적 groupBy (resourceId별 집계)
const useGroups = await prisma.auditLog.groupBy({
  by: ["resourceId"],
  where: { ... },
  _count: { id: true }
});

// 결과 크기 제한
.slice(0, limit)  // 최대 50개
Math.min(365, Math.max(1, days))  // 범위 검증
```

---

## 🧪 테스트 케이스

### 단위 테스트 (vitest)

```bash
npm run test src/app/api/tools/click-tracker/__tests__/route.test.ts
```

**커버리지**:
- [x] POST: 정상 click/use/success 기록
- [x] POST: situation + durationMs 저장
- [x] POST: scriptId 미입력 → 400
- [x] POST: 잘못된 event → 400
- [x] POST: 인증 실패 → 401
- [x] POST: FREE_SALES → 403
- [x] GET: TOP 스크립트 순위
- [x] GET: 특정 scriptId 상세 조회
- [x] GET: AGENT 권한 (self only)
- [x] GET: FREE_SALES → 403
- [x] GET: 성공률 계산 (예: 10 uses, 8 success → 80%)
- [x] 보안: PII 필드 미저장 확인

---

## 🚀 배포 체크리스트

- [x] 코드 작성 완료 (route.ts - 350줄)
- [x] 타입 안전성 검증 (`npx tsc --noEmit`)
- [x] 테스트 작성 완료 (__tests__/route.test.ts)
- [x] PII 정책 준수 확인
- [x] 권한 제어 구현
- [x] 에러 처리 완료
- [x] 감사 로그 기록
- [x] 문서화 완료 (이 파일)

### 다음 단계

1. **Vercel 배포 전 검증**
   ```bash
   npm run build
   npm run test
   ```

2. **CRM 팀 연동** (필요 시)
   - Playbook 스크립트 ID 확인
   - CallSituation enum 동기화

3. **모니터링**
   - Sentry/LogRocket 추적
   - Dashboard 대시보드 추가 (향후)

---

## 📞 FAQ

### Q: PII가 저장되지 않는다는 것을 어떻게 확인하나?
**A**: AuditLog 생성 시 `piiFieldsAccessed: []`로 고정하고, createData 객체에 contactId/phone/email/name이 없음을 코드 리뷰로 확인합니다.

### Q: MANAGER 권한은 언제 구현되나?
**A**: Task 5 현재 단계에서는 "팀 userId" 정보가 필요하므로 TODO로 남겨두었습니다. 향후 Team 모델 추가 시 구현할 수 있습니다.

### Q: 통화 시간(durationMs)은 왜 선택 사항인가?
**A**: 클릭만 기록하는 경우도 있으므로 선택 사항으로 설계했습니다.

### Q: 성공률은 어떻게 계산되나?
**A**: `successCount / usageCount * 100` (소수점 정수 반올림)

### Q: 왜 CallSituation 문자열만 저장하고 enum을 저장하지 않나?
**A**: `purpose` 필드는 `VarChar(255)` 문자열이며, CallSituation enum 정의는 application layer에만 있으므로 문자열로 저장합니다.

---

## 🔗 관련 파일

- **Prisma Schema**: `prisma/schema.prisma` → AuditLog 모델
- **RBAC**: `src/lib/rbac.ts` → getAuthContext()
- **Logger**: `src/lib/logger.ts` → logger.info/warn/error
- **CallSituation**: `src/lib/playbook/call-situations.ts` → enum 정의
- **Type**: `src/lib/types/lens.ts` → LensType

---

**마지막 업데이트**: 2026-06-03 15:45 KST  
**버전**: 1.0.0 (Task 5 완료)
