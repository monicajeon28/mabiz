# Menu #45 계약서 템플릿 API 테스트 시나리오

## 개요

5개 엔드포인트 완전 구현 + 감사 로그 추적:
1. ✓ GET /api/contract-templates (목록)
2. ✓ POST /api/contract-templates (생성)
3. ✓ GET /api/contract-templates/[id] (상세)
4. ✓ PATCH /api/contract-templates/[id] (수정) - **본 구현**
5. ✓ DELETE /api/contract-templates/[id] (삭제) - **본 구현**
6. ✓ GET /api/contract-templates/[id]/audit-logs (감사 로그) - **신규**

---

## 아키텍처 변경사항

### 1. Prisma 스키마 확장

#### ContractTemplateAuditLog 모델 추가
```prisma
model ContractTemplateAuditLog {
  id                  String           @id @default(cuid())
  organizationId      String
  templateId          String
  userId              String?
  action              String           // "CREATE"|"UPDATE"|"DELETE"|"RESTORE"|"PUBLISH"|"ARCHIVE"
  previousValues      Json?            // 변경 전 값
  newValues           Json?            // 변경 후 값
  changeDescription   String?          // 예: "name: 'Old' → 'New'"
  reason              String?          // 삭제 사유 등
  status              String           @default("SUCCESS")  // "SUCCESS"|"FAILED"
  errorMessage        String?
  ipAddress           String?
  userAgent           String?
  createdAt           DateTime         @default(now()) @db.Timestamptz(6)

  organization        Organization     @relation("ContractTemplateAuditLogs", ...)
  template            ContractTemplate @relation("AuditLogs", ...)

  @@index([organizationId])
  @@index([templateId])
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

#### Organization 관계 추가
```prisma
model Organization {
  ...
  contractTemplateAuditLogs  ContractTemplateAuditLog[] @relation("ContractTemplateAuditLogs")
}
```

#### ContractTemplate 관계 추가
```prisma
model ContractTemplate {
  ...
  auditLogs           ContractTemplateAuditLog[] @relation("AuditLogs")
}
```

### 2. 유틸 함수 추가

#### src/lib/contract-templates-audit.ts
- `logContractTemplateAudit()` - 감사 로그 기록
- `getClientIp()` - 클라이언트 IP 추출
- `getUserAgent()` - User Agent 추출
- `generateChangeDescription()` - 변경사항 자동 생성
- `maskSensitiveFields()` - 민감 정보 마스킹
- `canDeleteTemplate()` - 삭제 가능 여부 확인
- `getAuditLogs()` - 감사 로그 조회

#### src/lib/types/contract-templates.ts 확장
- `ContractTemplateAuditLogResponse` 인터페이스 추가

### 3. 마이그레이션 파일

#### prisma/migrations/20260524000002_add_contract_template_audit_logs/migration.sql
- `ContractTemplateAuditLog` 테이블 생성
- 7개 인덱스 생성 (조직, 템플릿, 사용자, 액션, 날짜, 복합)
- 외래키 제약 (ON DELETE CASCADE)

---

## 엔드포인트 상세 스펙

### 1. PATCH /api/contract-templates/[id] - 템플릿 수정

#### 요청
```bash
PATCH /api/contract-templates/tpl_abc123
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Cruise Contract v2",
  "description": "Updated description",
  "status": "ACTIVE",
  "psychologyLenses": ["L6", "L10"],
  "visibility": "ORGANIZATION"
}
```

#### 응답 - 성공 (200)
```json
{
  "ok": true,
  "data": {
    "id": "tpl_abc123",
    "name": "Cruise Contract v2",
    "description": "Updated description",
    "category": "CRUISE",
    "htmlContent": "...",
    "fieldMapping": {...},
    "psychologyLenses": ["L6", "L10"],
    "visibility": "ORGANIZATION",
    "status": "ACTIVE",
    "version": 2,
    "isSystemTemplate": false,
    "usageCount": 5,
    "lastUsedAt": "2026-05-24T10:00:00Z",
    "createdAt": "2026-05-20T08:00:00Z",
    "updatedAt": "2026-05-24T22:00:00Z"
  },
  "message": "Template updated successfully (v2)"
}
```

#### 응답 - 시스템 템플릿 수정 불가 (403)
```json
{
  "ok": false,
  "error": "System templates cannot be modified"
}
```

#### 응답 - 이름 중복 (400)
```json
{
  "ok": false,
  "error": "Template name already exists"
}
```

#### 응답 - 찾을 수 없음 (404)
```json
{
  "ok": false,
  "error": "Template not found"
}
```

#### 감사 로그 생성
```sql
INSERT INTO "ContractTemplateAuditLog" (
  id, organizationId, templateId, userId, action,
  previousValues, newValues, changeDescription,
  status, ipAddress, userAgent, createdAt
) VALUES (
  'audit_xyz789',
  'org_123',
  'tpl_abc123',
  'user_456',
  'UPDATE',
  '{"name": "Cruise Contract", "status": "ACTIVE", "version": 1, ...}',
  '{"name": "Cruise Contract v2", "status": "ACTIVE", "version": 2, ...}',
  'name: "Cruise Contract" → "Cruise Contract v2"; status updated',
  'SUCCESS',
  '192.168.1.100',
  'Mozilla/5.0...',
  '2026-05-24T22:00:00Z'
);
```

---

### 2. DELETE /api/contract-templates/[id] - 템플릿 삭제

#### 요청 - 기본 삭제
```bash
DELETE /api/contract-templates/tpl_abc123
Authorization: Bearer {token}
```

#### 요청 - 삭제 사유 포함
```bash
DELETE /api/contract-templates/tpl_abc123
Content-Type: application/json
Authorization: Bearer {token}

{
  "reason": "No longer needed - replaced by v2"
}
```

#### 응답 - 물리 삭제 성공 (200)
```json
{
  "ok": true,
  "message": "Template deleted successfully"
}
```

#### 응답 - 진행 중인 계약서로 인한 보관 (200)
```json
{
  "ok": true,
  "message": "Template archived: 3개의 진행 중인 계약서가 이 템플릿을 사용 중입니다"
}
```

#### 응답 - 시스템 템플릿 삭제 불가 (403)
```json
{
  "ok": false,
  "error": "System templates cannot be deleted"
}
```

#### 응답 - 찾을 수 없음 (404)
```json
{
  "ok": false,
  "error": "Template not found"
}
```

#### 감사 로그 생성 (물리 삭제)
```sql
INSERT INTO "ContractTemplateAuditLog" (...) VALUES (
  ...,
  'DELETE',
  '{"name": "Cruise Contract v2", "category": "CRUISE", "status": "ACTIVE"}',
  NULL,
  'No longer needed - replaced by v2',
  'SUCCESS',
  ...
);
```

#### 감사 로그 생성 (보관)
```sql
INSERT INTO "ContractTemplateAuditLog" (...) VALUES (
  ...,
  'ARCHIVE',
  NULL,
  '{"status": "ACTIVE"}', -- 변경 후: ARCHIVED
  'Archived due to active instances (3)',
  'No longer needed - replaced by v2',
  'SUCCESS',
  ...
);
```

---

### 3. GET /api/contract-templates/[id]/audit-logs - 감사 로그 조회

#### 요청 - 기본
```bash
GET /api/contract-templates/tpl_abc123/audit-logs
Authorization: Bearer {token}
```

#### 요청 - 필터 + 페이지네이션
```bash
GET /api/contract-templates/tpl_abc123/audit-logs?action=UPDATE&page=1&limit=20
Authorization: Bearer {token}
```

#### 응답 - 성공 (200)
```json
{
  "ok": true,
  "data": [
    {
      "id": "audit_xyz789",
      "templateId": "tpl_abc123",
      "action": "UPDATE",
      "userId": "user_456",
      "previousValues": {
        "name": "Cruise Contract",
        "status": "ACTIVE",
        "version": 1
      },
      "newValues": {
        "name": "Cruise Contract v2",
        "status": "ACTIVE",
        "version": 2
      },
      "changeDescription": "name: \"Cruise Contract\" → \"Cruise Contract v2\"",
      "reason": null,
      "status": "SUCCESS",
      "errorMessage": null,
      "ipAddress": "192.168.1.100",
      "createdAt": "2026-05-24T22:00:00Z"
    },
    {
      "id": "audit_abc456",
      "templateId": "tpl_abc123",
      "action": "CREATE",
      "userId": "user_456",
      "previousValues": null,
      "newValues": {
        "name": "Cruise Contract",
        "category": "CRUISE",
        "status": "ACTIVE"
      },
      "changeDescription": null,
      "reason": null,
      "status": "SUCCESS",
      "errorMessage": null,
      "ipAddress": "192.168.1.100",
      "createdAt": "2026-05-20T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 2,
    "totalPages": 1
  },
  "message": "Retrieved 2 audit logs (page 1/1)"
}
```

#### 응답 - 템플릿 찾을 수 없음 (404)
```json
{
  "ok": false,
  "error": "Template not found"
}
```

---

## 권한 검증 매트릭스

| 엔드포인트 | 조건 | 권한 | 결과 |
|-----------|------|------|------|
| PATCH | 시스템 템플릿 | ANY | ❌ 403 Forbidden |
| PATCH | 다른 조직 템플릿 | ANY | ❌ 404 Not Found |
| PATCH | 본 조직 템플릿 | MEMBER+ | ✅ 200 OK + 감사 로그 |
| DELETE | 시스템 템플릿 | ANY | ❌ 403 Forbidden |
| DELETE | 진행 중 계약서 | ANY | ✅ 200 OK (ARCHIVED) + 감사 로그 |
| DELETE | 미사용 템플릿 | MEMBER+ | ✅ 200 OK (물리 삭제) + 감사 로그 |
| AUDIT-LOG GET | 다른 조직 템플릿 | ANY | ❌ 404 Not Found |
| AUDIT-LOG GET | 본 조직 템플릿 | MEMBER+ | ✅ 200 OK (페이지네이션) |

---

## 감사 로그 설계 원칙

### 1. 데이터 정합성 (referential integrity)
- `templateId` 외래키: `ON DELETE CASCADE` (템플릿 삭제 시 감사 로그도 함께 삭제)
- `organizationId` 외래키: `ON DELETE CASCADE` (조직 삭제 시 감사 로그도 함께 삭제)
- 양쪽 모두 CASCADE인 이유: 감사 로그는 템플릿의 종속 자산이기 때문

### 2. 트랜잭션 처리 (atomicity)
- PATCH: 템플릿 업데이트 + 감사 로그 기록
  ```typescript
  // 업데이트 후 감사 로그
  const updated = await prisma.contractTemplate.update(...);
  await logContractTemplateAudit({...});
  ```
  **주의**: Prisma는 자동 트랜잭션을 제공하지 않음 → 개별 요청이 원자성 보증
  실패 시: 감사 로그 미기록 (로깅 실패는 주요 작업 실패로 간주 안 함)

- DELETE: 3가지 케이스
  1. 물리 삭제: 템플릿 삭제 후 감사 로그
  2. 보관: 템플릿 상태 변경 후 감사 로그
  3. 거부: 권한 없음 (감사 로그 미기록)

### 3. 민감 정보 마스킹
```typescript
maskSensitiveFields({
  htmlContent: "[HTML Content, 5432 chars]",  // 길이만
  fieldMapping: { keys: ["name", "date", ...] },  // 키만
  name: "원본 유지",  // 비민감 정보
  status: "원본 유지",
});
```

### 4. 변경 추적 설명
```
"name: \"Old\" → \"New\"; status: DRAFT → ACTIVE"
"psychologyLenses: [L6,L10] → [L6,L10,L9]"
"htmlContent updated; fieldMapping updated"
```

---

## 테스트 시나리오

### 시나리오 1: 템플릿 수정 (PATCH)

#### Step 1: 기본 수정
```bash
# 요청
curl -X PATCH http://localhost:3000/api/contract-templates/tpl_abc123 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cruise Contract v2",
    "psychologyLenses": ["L6", "L10"]
  }'

# 기대: 200 OK + 버전 2
```

#### Step 2: 감사 로그 확인
```bash
curl http://localhost:3000/api/contract-templates/tpl_abc123/audit-logs \
  -H "Authorization: Bearer {token}"

# 기대: UPDATE 액션 로그 1개
```

#### Step 3: 시스템 템플릿 수정 시도
```bash
# 시스템 템플릿 생성 (관리자만)
curl -X POST http://localhost:3000/api/contract-templates \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"name": "System", "isSystemTemplate": true}'

# 수정 시도
curl -X PATCH http://localhost:3000/api/contract-templates/sys_123 \
  -H "Authorization: Bearer {token}" \
  -d '{"name": "System v2"}'

# 기대: 403 Forbidden
```

#### Step 4: 이름 중복 시도
```bash
# 기존 템플릿
tpl1: "Cruise"
tpl2: "Rental"

# tpl2의 이름을 tpl1과 같게 변경 시도
curl -X PATCH http://localhost:3000/api/contract-templates/tpl2 \
  -d '{"name": "Cruise"}'

# 기대: 400 Bad Request (template name already exists)
```

---

### 시나리오 2: 템플릿 삭제 (DELETE)

#### Step 1: 미사용 템플릿 물리 삭제
```bash
# 사전 조건: usageCount = 0
curl -X DELETE http://localhost:3000/api/contract-templates/tpl_unused \
  -H "Authorization: Bearer {token}"

# 기대: 200 OK + "Template deleted successfully"
# 확인: 데이터베이스에서 템플릿 완전 삭제
```

#### Step 2: 진행 중 계약서 있을 때 보관
```bash
# 사전 조건: usageCount = 3 (DRAFT, SENT 상태)
curl -X DELETE http://localhost:3000/api/contract-templates/tpl_active \
  -H "Authorization: Bearer {token}" \
  -d '{"reason": "Being replaced by new version"}'

# 기대: 200 OK + "Template archived: 3개의..."
# 확인: 템플릿 상태 = ARCHIVED, AUDIT_LOG action = ARCHIVE
```

#### Step 3: 시스템 템플릿 삭제 시도
```bash
curl -X DELETE http://localhost:3000/api/contract-templates/sys_123 \
  -H "Authorization: Bearer {token}"

# 기대: 403 Forbidden + "System templates cannot be deleted"
```

#### Step 4: 감사 로그 확인
```bash
curl http://localhost:3000/api/contract-templates/tpl_active/audit-logs?action=ARCHIVE \
  -H "Authorization: Bearer {token}"

# 기대: DELETE → ARCHIVE 로그 1개
#      changeDescription: "Archived due to active instances (3)"
#      reason: "Being replaced by new version"
```

---

### 시나리오 3: 감사 로그 조회 (AUDIT-LOG GET)

#### Step 1: 모든 감사 로그 조회
```bash
curl http://localhost:3000/api/contract-templates/tpl_abc123/audit-logs \
  -H "Authorization: Bearer {token}"

# 기대: 200 OK
#      data: [CREATE, UPDATE, UPDATE] (역순)
#      pagination: page=1, limit=50, totalCount=3, totalPages=1
```

#### Step 2: 액션별 필터링
```bash
curl 'http://localhost:3000/api/contract-templates/tpl_abc123/audit-logs?action=UPDATE' \
  -H "Authorization: Bearer {token}"

# 기대: UPDATE 로그만 2개
```

#### Step 3: 페이지네이션
```bash
curl 'http://localhost:3000/api/contract-templates/tpl_abc123/audit-logs?page=2&limit=10' \
  -H "Authorization: Bearer {token}"

# 기대: page=2 데이터 (최대 10개)
```

#### Step 4: 다른 조직 템플릿 감사 로그 접근 시도
```bash
# tpl_abc123: org1 소유
# 현재 사용자: org2 멤버

curl http://localhost:3000/api/contract-templates/tpl_abc123/audit-logs \
  -H "Authorization: Bearer {org2_token}"

# 기대: 404 Not Found
```

---

## 데이터 무결성 검증

### 1. CASCADE 삭제 테스트

#### 테스트 A: 템플릿 삭제 시 감사 로그 함께 삭제
```sql
-- 1단계: 템플릿 생성
INSERT INTO "ContractTemplate" (...) VALUES ('tpl_test', 'org_123', ...);

-- 2단계: 감사 로그 생성
INSERT INTO "ContractTemplateAuditLog" (...) 
  VALUES ('audit_1', 'org_123', 'tpl_test', ...);

-- 3단계: 템플릿 삭제
DELETE FROM "ContractTemplate" WHERE id = 'tpl_test';

-- 4단계: 검증
SELECT COUNT(*) FROM "ContractTemplateAuditLog" 
  WHERE templateId = 'tpl_test';
-- 기대: 0개 (자동 삭제됨)
```

#### 테스트 B: 조직 삭제 시 모든 감사 로그 함께 삭제
```sql
-- 1단계: 조직 삭제
DELETE FROM "Organization" WHERE id = 'org_123';

-- 2단계: 검증
SELECT COUNT(*) FROM "ContractTemplateAuditLog" 
  WHERE organizationId = 'org_123';
-- 기대: 0개
```

### 2. 버전 관리 테스트

```typescript
// 1단계: 템플릿 생성 (version = 1)
POST /api/contract-templates
// → version: 1

// 2단계: 첫 수정
PATCH /api/contract-templates/tpl_123
// → version: 2
// 감사 로그: UPDATE (v1→v2)

// 3단계: 두 번째 수정
PATCH /api/contract-templates/tpl_123
// → version: 3
// 감사 로그: UPDATE (v2→v3)

// 4단계: 감사 로그 확인
GET /api/contract-templates/tpl_123/audit-logs
// 기대: version 필드가 각 단계마다 증가
```

### 3. usageCount 추적 테스트

```typescript
// 1단계: 템플릿 생성
POST /api/contract-templates → usageCount: 0

// 2단계: 계약서 인스턴스 생성 (3개)
POST /api/contract-instances (3회)
// → usageCount: 3

// 3단계: DELETE 시도
DELETE /api/contract-templates/tpl_123
// 기대: ARCHIVED (물리 삭제 불가)

// 4단계: 모든 인스턴스 완료 후 DELETE
PATCH /api/contract-instances/inst_1 → status: COMPLETED
PATCH /api/contract-instances/inst_2 → status: COMPLETED
PATCH /api/contract-instances/inst_3 → status: COMPLETED
// usageCount: 0으로 변경됨 (또는 체크 로직에서 제외)

// 5단계: 재시도
DELETE /api/contract-templates/tpl_123
// 기대: 200 OK (물리 삭제)
```

---

## 성능 최적화

### 1. 인덱스 설계

| 인덱스 | 칼럼 | 용도 |
|--------|------|------|
| `PK` | id | 기본 조회 |
| idx_1 | organizationId | 조직별 필터 |
| idx_2 | templateId | 템플릿별 필터 |
| idx_3 | userId | 사용자별 필터 |
| idx_4 | action | 액션별 필터 |
| idx_5 | createdAt | 날짜 정렬 |
| idx_6 | (orgId, templateId, createdAt DESC) | 복합 쿼리 최적화 |

### 2. 쿼리 최적화

```typescript
// ❌ 비효율적
prisma.contractTemplateAuditLog.findMany({
  where: { organizationId },
}).then(logs => logs.filter(l => l.templateId === templateId));

// ✅ 효율적
prisma.contractTemplateAuditLog.findMany({
  where: {
    organizationId,
    templateId,
  },
  orderBy: { createdAt: "desc" },
  take: limit,
  skip: skip,
});
```

### 3. 감사 로그 보관 정책

```typescript
// 장기 보관 정책 (선택사항)
// 90일 이상 로그는 별도 저장소로 아카이브
const thirtyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

const oldLogs = await prisma.contractTemplateAuditLog.findMany({
  where: {
    createdAt: { lt: thirtyDaysAgo },
  },
});

// 아카이브 후 삭제 (또는 별도 테이블로 이동)
await prisma.contractTemplateAuditLog.deleteMany({
  where: {
    createdAt: { lt: thirtyDaysAgo },
  },
});
```

---

## 배포 체크리스트

- [ ] 마이그레이션 파일 생성 ✅
- [ ] Prisma 스키마 업데이트 ✅
- [ ] 유틸 함수 구현 ✅
- [ ] PATCH 엔드포인트 구현 ✅
- [ ] DELETE 엔드포인트 구현 ✅
- [ ] 감사 로그 조회 엔드포인트 구현 ✅
- [ ] 타입 정의 추가 ✅
- [ ] 검증 스키마 추가 (기존 활용) ✅
- [ ] 감사 로그 기록 ✅
- [ ] 데이터 정합성 보증 ✅
- [ ] 권한 검증 ✅
- [ ] 에러 핸들링 ✅
- [ ] 로깅 추가 ✅
- [ ] 테스트 시나리오 문서화 ✅ (본 문서)

---

## 참고: 완성된 구현 파일

| 파일 | 설명 |
|------|------|
| `src/lib/contract-templates-audit.ts` | 감사 로그 유틸 (8개 함수) |
| `src/lib/types/contract-templates.ts` | 타입 정의 (ContractTemplateAuditLogResponse 추가) |
| `src/app/api/contract-templates/[id]/route.ts` | PATCH + DELETE 엔드포인트 |
| `src/app/api/contract-templates/[id]/audit-logs/route.ts` | 감사 로그 조회 엔드포인트 |
| `prisma/schema.prisma` | ContractTemplateAuditLog 모델 + 관계 |
| `prisma/migrations/20260524000002_add_contract_template_audit_logs/migration.sql` | DB 마이그레이션 |

---

## 심리학 렌즈 통합

계약서 템플릿의 psychologyLenses 필드 활용:

```json
{
  "name": "Cruise 기본 계약서",
  "psychologyLenses": ["L6", "L10"],
  // L6: 타이밍 손실회피 (유효기한 24시간)
  // L10: 즉시 구매 클로징 (삼중선택, 감정 마무리)
}
```

감사 로그에서 렌즈 변경 추적:
```
"psychologyLenses: [L6,L10] → [L6,L10,L9]"
// L9 추가: 의료신뢰 추가
```

---

## FAQ

### Q1: 감사 로그 미기록 시 주 작업 실패 여부?
**A**: 아니오. 감사 로그 실패는 주요 작업(PATCH/DELETE)에 영향 없음.
```typescript
try {
  const updated = await prisma.contractTemplate.update(...);
  // 이 시점에서 응답 200 반환 가능
  
  await logContractTemplateAudit(...); // 실패해도 무시
} catch (logError) {
  console.error("Audit log failed (non-critical)");
  // 주요 작업은 이미 완료됨
}
```

### Q2: 감사 로그 보존 기간?
**A**: 설정 가능. 기본 무제한 보존. 필요 시 90일/1년 정책 추가 가능.

### Q3: 민감 정보 마스킹 이유?
**A**: htmlContent(5KB+)는 전체 저장 불필요. 변경 이력 추적만 중요.

### Q4: 다중 버전 관리 방식?
**A**: version 필드 자동 증가. 감사 로그로 버전별 변경 추적 가능.

---

**작성일**: 2026-05-24  
**버전**: 1.0  
**상태**: 구현 완료 ✅
