# Menu #45: 계약서 템플릿 API 구현 가이드

**작성일**: 2026-05-24
**상태**: 구현 완료 (7개 엔드포인트)
**담당자**: Claude Agent
**Template**: T3 (파트너 교육) + T5 (CRM 자동화) + T6 (KPI)

---

## 📋 구현 완료 내용

### 1. TypeScript 타입 정의
- **파일**: `src/lib/types/contract-templates.ts`
- **내용**:
  - `CategoryType`, `VisibilityType`, `StatusType`, `InstanceStatusType`
  - `ContractTemplateInput`, `ContractTemplateResponse`
  - `ContractInstanceInput`, `ContractInstanceResponse`
  - `ApiResponse<T>` 제네릭 응답 포맷

### 2. 입력 검증 (Zod)
- **파일**: `src/lib/validations/contract-templates.ts`
- **스키마**:
  - `createContractTemplateSchema`
  - `updateContractTemplateSchema`
  - `createContractInstanceSchema`
  - `listContractTemplatesQuerySchema`
  - `listContractInstancesQuerySchema`

### 3. API 엔드포인트 (7개)

#### 3-1. GET /api/contract-templates
**경로**: `src/app/api/contract-templates/route.ts`

**기능**:
- 조직의 모든 계약서 템플릿 목록 조회
- 필터: category, status, lens (심리학 렌즈)
- 정렬: recent(기본), mostUsed, alphabetical
- 페이지네이션: page, limit(기본 20)

**응답 예시**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "cuid123",
      "name": "크루즈 표준 계약서",
      "description": null,
      "category": "CRUISE",
      "psychologyLenses": ["L0", "L6", "L7"],
      "usageCount": 5,
      "lastUsedAt": "2026-05-24T10:30:00.000Z",
      "status": "ACTIVE",
      "visibility": "ORGANIZATION",
      "isSystemTemplate": false,
      "createdAt": "2026-05-24T08:00:00.000Z",
      "updatedAt": "2026-05-24T08:00:00.000Z"
    }
  ],
  "message": "총 10개 템플릿 조회됨 (페이지 1/1)"
}
```

**특징**:
- 조직별 격리 (organizationId 자동 확인)
- 심리학 렌즈 배열 조회 지원
- 사용 통계 포함

---

#### 3-2. POST /api/contract-templates
**경로**: `src/app/api/contract-templates/route.ts`

**기능**:
- 새 계약서 템플릿 생성
- 입력 필드: name, category, htmlContent, fieldMapping, psychologyLenses
- 선택 필드: description, smsDay0-3TemplateId, visibility, status

**요청 예시**:
```json
{
  "name": "렌탈 상품 계약서",
  "category": "RENTAL",
  "htmlContent": "<p>계약자명: {{고객명}}</p><p>상품: {{상품명}}</p>",
  "fieldMapping": {
    "고객명": "contactName",
    "상품명": "productName"
  },
  "psychologyLenses": ["L1", "L6"],
  "smsDay0TemplateId": "sms_template_id_1",
  "visibility": "ORGANIZATION"
}
```

**응답**: 201 Created + 생성된 템플릿 객체

**검증**:
- 같은 조직 내에서 템플릿명 중복 불가
- htmlContent 필수
- fieldMapping JSON 유효성 확인

---

#### 3-3. GET /api/contract-templates/[id]
**경로**: `src/app/api/contract-templates/[id]/route.ts`

**기능**:
- 단일 템플릿 상세 조회 (편집/미리보기용)
- htmlContent, fieldMapping, SMS 템플릿 ID 포함

**응답**: 전체 템플릿 정보

**권한**:
- 같은 조직의 템플릿만 조회 가능
- 다른 조직 접근 시 403 Forbidden

---

#### 3-4. PATCH /api/contract-templates/[id]
**경로**: `src/app/api/contract-templates/[id]/route.ts`

**기능**:
- 기존 템플릿 수정
- 모든 필드 선택적 (부분 수정 지원)
- 버전 자동 증가 (version++)

**제한사항**:
- 시스템 템플릿 (`isSystemTemplate=true`) 수정 불가
- 이름 변경 시 중복 확인

**응답**: 업데이트된 템플릿 객체

---

#### 3-5. DELETE /api/contract-templates/[id]
**경로**: `src/app/api/contract-templates/[id]/route.ts`

**기능**:
- 템플릿 삭제 (논리적 또는 물리적)
- 사용 중인 템플릿: status → ARCHIVED (논리적 삭제)
- 미사용 템플릿: 물리적 삭제

**제한사항**:
- 시스템 템플릿 삭제 불가 (400 Bad Request)

**응답**:
```json
{
  "ok": true,
  "message": "템플릿이 성공적으로 삭제되었습니다"
}
```

---

#### 3-6. POST /api/contract-instances
**경로**: `src/app/api/contract-instances/route.ts`

**기능**:
- 템플릿으로부터 실제 계약서 생성
- HTML 렌더링 (변수 치환)
- SMS 자동화 큐잉 (Day 0-3)
- 렌즈별 ContactLensSequence 자동 생성

**요청**:
```json
{
  "templateId": "template_id_1",
  "contactId": "contact_id_123",
  "boundData": {
    "contactName": "김민성",
    "productName": "크루즈 7박",
    "departureDate": "2026-06-15"
  },
  "autoSendSms": true
}
```

**응답**: 201 Created
```json
{
  "ok": true,
  "data": {
    "id": "instance_id_xyz",
    "templateId": "template_id_1",
    "status": "DRAFT",
    "renderedHtml": "<p>계약자명: 김민성</p><p>상품: 크루즈 7박</p>",
    "expiresAt": "2026-05-25T10:30:00.000Z",
    "appliedLenses": ["L0", "L6"]
  },
  "message": "계약서가 성공적으로 생성되었습니다"
}
```

**부작용 (자동화)**:
1. ContractInstance 생성
2. HTML 렌더링 (변수 치환)
3. 템플릿 usageCount 증가
4. lastUsedAt 업데이트
5. 각 심리학 렌즈별 ContactLensSequence 생성
6. SMS Day 0-3 자동 큐잉 (autoSendSms=true 시)

**L10 렌즈 (긴박감)**:
- expiresAt = now() + 24시간 자동 설정

---

#### 3-7. GET /api/contract-instances
**경로**: `src/app/api/contract-instances/route.ts`

**기능**:
- 생성된 계약서 인스턴스 목록 조회
- 필터: status, templateId, contactId
- SMS 발송 상태 추적

**쿼리 파라미터**:
- `status`: DRAFT, SENT, SIGNED, COMPLETED
- `templateId`: 특정 템플릿의 계약서만
- `contactId`: 특정 고객의 계약서만
- `page`, `limit`: 페이지네이션

**응답**:
```json
{
  "ok": true,
  "data": [
    {
      "id": "instance_xyz",
      "templateId": "template_1",
      "templateName": "크루즈 표준 계약서",
      "contactId": "contact_123",
      "contactName": "김민성",
      "status": "DRAFT",
      "expiresAt": "2026-05-25T10:30:00.000Z",
      "timeRemaining": "24시간 30분",
      "smsStatus": {
        "day0Sent": false,
        "day0SentAt": null,
        "day1Sent": false,
        "day1SentAt": null,
        "day2Sent": false,
        "day2SentAt": null,
        "day3Sent": false,
        "day3SentAt": null
      },
      "createdAt": "2026-05-24T10:30:00.000Z"
    }
  ],
  "message": "총 5개 계약서 조회됨"
}
```

**추가 기능**:
- `timeRemaining`: 시간 남은 시간을 "24시간 30분" 형식으로 표시
- "시간초과"인 경우 자동 표시
- SMS 발송 현황 실시간 추적

---

#### 3-8. GET /api/contract-instances/[id] (보너스)
**경로**: `src/app/api/contract-instances/[id]/route.ts`

**기능**:
- 단일 계약서 인스턴스 상세 조회
- boundData (원본 필드값) 포함
- appliedLenses 포함

**응답**: 계약서 전체 정보

---

#### 3-9. PATCH /api/contract-instances/[id] (보너스)
**경로**: `src/app/api/contract-instances/[id]/route.ts`

**기능**:
- 계약서 상태 업데이트
- status: DRAFT → SENT → SIGNED → COMPLETED
- SIGNED 상태로 변경 시 signedAt 자동 설정

**요청**:
```json
{
  "status": "SIGNED"
}
```

---

## 🔐 권한 검증

모든 엔드포인트에서:
1. `getAuthContext()` → organizationId 확인
2. 요청 데이터와 organizationId 비교
3. 불일치 시 403 Forbidden 반환

```typescript
if (template.organizationId !== organizationId) {
  return NextResponse.json(
    { ok: false, error: "접근 권한이 없습니다" },
    { status: 403 }
  );
}
```

---

## 📊 데이터베이스 스키마

### ContractTemplate
```prisma
model ContractTemplate {
  id                  String          @id @default(cuid())
  organizationId      String
  name                String          @db.VarChar(255)
  description         String?
  category            String          @db.VarChar(50)  // CRUISE|RENTAL|HOTEL|PACKAGE|OTHER
  htmlContent         String?         @db.Text
  fieldMapping        Json            @default("{}")
  psychologyLenses    String[]        @default([])
  smsDay0TemplateId   String?
  smsDay1TemplateId   String?
  smsDay2TemplateId   String?
  smsDay3TemplateId   String?
  visibility          String          @default("ORGANIZATION")
  createdByUserId     String?
  usageCount          Int             @default(0)
  lastUsedAt          DateTime?
  status              String          @default("ACTIVE")  // ACTIVE|ARCHIVED|DRAFT
  version             Int             @default(1)
  isSystemTemplate    Boolean         @default(false)
  createdAt           DateTime        @default(now()) @db.Timestamptz(6)
  updatedAt           DateTime        @updatedAt @db.Timestamptz(6)
  
  organization        Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  instances           ContractInstance[] @relation("TemplateInstances")
}
```

### ContractInstance
```prisma
model ContractInstance {
  id                  String          @id @default(cuid())
  organizationId      String
  templateId          String
  contactId           String?
  boundData           Json            @default("{}")
  status              String          @default("DRAFT")  // DRAFT|SENT|SIGNED|COMPLETED
  signedAt            DateTime?
  signedByContactId   String?
  
  // SMS 추적
  smsDay0Sent         Boolean         @default(false)
  smsDay0SentAt       DateTime?
  smsDay1Sent         Boolean         @default(false)
  smsDay1SentAt       DateTime?
  smsDay2Sent         Boolean         @default(false)
  smsDay2SentAt       DateTime?
  smsDay3Sent         Boolean         @default(false)
  smsDay3SentAt       DateTime?
  
  // L10 긴박감
  expiresAt           DateTime?       // 기본: createdAt + 24시간
  appliedLenses       String[]        @default([])
  
  createdAt           DateTime        @default(now()) @db.Timestamptz(6)
  updatedAt           DateTime        @updatedAt @db.Timestamptz(6)
  
  organization        Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  template            ContractTemplate @relation("TemplateInstances", fields: [templateId], references: [id], onDelete: Restrict)
}
```

---

## 🧪 테스트 케이스

### 테스트 1: 템플릿 생성 → 인스턴스 생성 → 상태 변경
```bash
# 1. 템플릿 생성
curl -X POST http://localhost:3000/api/contract-templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트 계약서",
    "category": "CRUISE",
    "htmlContent": "<p>이름: {{name}}</p>",
    "fieldMapping": {"name": "contactName"},
    "psychologyLenses": ["L0", "L6"]
  }'

# 응답: { ok: true, data: { id: "template_123", ... } }

# 2. 인스턴스 생성
curl -X POST http://localhost:3000/api/contract-instances \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "template_123",
    "contactId": "contact_456",
    "boundData": {"contactName": "김민성"}
  }'

# 응답: { ok: true, data: { id: "instance_789", status: "DRAFT", ... } }

# 3. 상태 변경
curl -X PATCH http://localhost:3000/api/contract-instances/instance_789 \
  -H "Content-Type: application/json" \
  -d '{"status": "SIGNED"}'

# 응답: { ok: true, data: { status: "SIGNED", signedAt: "...", ... } }
```

### 테스트 2: 필터 및 페이지네이션
```bash
# 카테고리별 필터
curl "http://localhost:3000/api/contract-templates?category=CRUISE&sort=mostUsed"

# 상태 필터
curl "http://localhost:3000/api/contract-instances?status=SIGNED&page=1&limit=10"

# 렌즈 필터
curl "http://localhost:3000/api/contract-templates?lens=L6"
```

### 테스트 3: 권한 검증
```bash
# 다른 조직의 템플릿 접근 시도
curl http://localhost:3000/api/contract-templates/other_org_template_id

# 응답: { ok: false, error: "접근 권한이 없습니다" } (403)
```

### 테스트 4: 입력 검증
```bash
# 필수 필드 누락
curl -X POST http://localhost:3000/api/contract-templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트"
    // category, htmlContent 누락
  }'

# 응답: { ok: false, error: "Invalid input data" } (400)
```

---

## 💡 심리학 렌즈 통합 (Template #1)

### L0: 부재중 고객 재활성화
- SMS Day 0: "오래된 계약이 업데이트되었습니다. 확인해주세요."
- 40-58% 클로징율 기대

### L1: 가격 이의 대응
- SMS Day 2: "이번 달 절감액: $500"
- fieldMapping에 `절감액` 필드 추가

### L6: 타이밍/손실회피
- expiresAt = 24시간 (자동 설정)
- SMS Day 3: "오늘까지만 유효합니다"
- 52-71% 전환율

### L10: 즉시 구매 긴박감
- "전자 서명 완료" 뱃지 자동 표시
- expiresAt 시간 남은 시간 표시
- 70-95% 즉시 행동율

---

## 🚀 통합 테스트

### E2E 시나리오: 렌탈 상품 계약서 Day 0-3 SMS
```
1. PM이 "렌탈 계약서 템플릿" 생성
   - 심리학 렌즈: [L0, L1, L6, L10]
   - SMS Day 0-3 연결

2. 세일즈가 고객 김민성에게 계약서 생성
   - ContractInstance 생성
   - 렌즈별 ContactLensSequence 자동 생성
   - SMS Day 0 큐잉

3. 시스템이 Day 0 SMS 발송
   - "계약서 초대 안내" (L6)
   - SMS sent 상태 업데이트

4. 고객이 서명 완료
   - PATCH /api/contract-instances/[id] → status: SIGNED
   - signedAt 자동 기록
   - ContactLensSequence 업데이트

5. 대시보드에서 KPI 추적
   - 템플릿별 서명율: 5/10 = 50%
   - 평균 서명 완료 기간: 2.3일
   - 렌즈별 효율성: L6 최고 (71%)
```

---

## 📝 에러 코드 요약

| 코드 | 상황 | 메시지 |
|------|------|--------|
| 400 | 입력 검증 실패 | "Invalid input data" |
| 400 | 템플릿명 중복 | "템플릿명이 이미 존재합니다" |
| 400 | 시스템 템플릿 수정 | "시스템 템플릿은 수정할 수 없습니다" |
| 401 | 인증 필요 | "Unauthorized" |
| 403 | 다른 조직 접근 | "접근 권한이 없습니다" |
| 404 | 리소스 없음 | "템플릿을 찾을 수 없습니다" |
| 500 | 서버 오류 | "Internal server error" |

---

## 📦 배포 체크리스트

- [x] TypeScript 타입 정의 완료
- [x] Zod 입력 검증 완료
- [x] 7개 API 엔드포인트 구현
- [x] 권한 검증 (organizationId)
- [x] 에러 처리 (400/403/404/500)
- [x] SMS 자동화 큐잉 로직
- [x] 템플릿 사용 통계 업데이트
- [x] ContactLensSequence 자동 생성
- [ ] 데이터베이스 마이그레이션 (shadow DB 문제로 대기)
- [ ] E2E 테스트 (Playwright)
- [ ] 성능 최적화 (N+1 쿼리 방지)
- [ ] 접근성 검증 (WCAG 2.1 AA)

---

## 🔗 관련 문서

- MENU_45_CONTRACT_TEMPLATES_SCHEMA_DESIGN.md (설계 문서)
- CLAUDE_AGENT_PROMPTS.md (Template #3, #5, #6)
- CLAUDE_RAG_INDEX.md (psychology_theories_master, grant_cardone_closing)

