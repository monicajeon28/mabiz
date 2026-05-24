# Menu #45: Contract Templates API 문서

## 개요

계약서 템플릿 관리 API입니다. OWNER 이상 권한으로 템플릿을 생성/조회할 수 있으며, SMS Day 0-3 자동화와 심리학 렌즈를 통합합니다.

## 구현된 엔드포인트 (3/5)

### 1. GET /api/contract-templates
조직별 계약 템플릿 목록을 페이지네이션으로 조회합니다.

**요청:**
```
GET /api/contract-templates?page=1&limit=20&status=ACTIVE&category=CRUISE
```

**쿼리 파라미터:**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 한 페이지당 개수 (기본값: 20, 최대: 100)
- `status`: 상태 필터 (ACTIVE|DRAFT|ARCHIVED|ALL, 기본값: ACTIVE)
- `category`: 카테고리 필터 (CRUISE|RENTAL|HOTEL|PACKAGE|OTHER)

**응답 (200 OK):**
```json
{
  "ok": true,
  "data": [
    {
      "id": "ctemplate_123abc",
      "name": "크루즈 표준 계약서",
      "description": "국내 크루즈 상품용 표준 계약서 템플릿",
      "category": "CRUISE",
      "visibility": "ORGANIZATION",
      "status": "ACTIVE",
      "version": 1,
      "usageCount": 12,
      "lastUsedAt": "2026-05-24T10:30:00Z",
      "psychologyLenses": ["L6", "L10"],
      "isSystemTemplate": false,
      "createdAt": "2026-05-20T08:00:00Z",
      "updatedAt": "2026-05-24T09:15:00Z",
      "createdByUserId": "user_456def"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**에러 응답:**
- 401: 인증 필요
- 400: 조직 정보 필수

---

### 2. POST /api/contract-templates
새로운 계약 템플릿을 생성합니다. (OWNER 이상 권한 필수)

**요청:**
```json
POST /api/contract-templates

{
  "name": "렌탈 계약서 - 2026",
  "category": "RENTAL",
  "description": "자동차 렌탈 서비스용 계약서",
  "htmlContent": "<div>...</div>",
  "jsonContent": {
    "sections": [...]
  },
  "visibility": "ORGANIZATION",
  "fieldMapping": {
    "customerName": "Contact.name",
    "customerPhone": "Contact.phone"
  },
  "psychologyLenses": ["L6", "L10"],
  "smsDay0TemplateId": "sms_template_123",
  "smsDay1TemplateId": "sms_template_124",
  "smsDay2TemplateId": "sms_template_125",
  "smsDay3TemplateId": "sms_template_126"
}
```

**필수 필드:**
- `name` (string, 1-255 chars): 템플릿 이름
- `category` (enum): CRUISE|RENTAL|HOTEL|PACKAGE|OTHER

**선택 필드:**
- `description`: 템플릿 설명
- `htmlContent`: Rich Text 본문
- `jsonContent`: 구조화된 콘텐츠 (Json)
- `visibility` (default: ORGANIZATION): ORGANIZATION|MANAGER_ONLY|PERSONAL
- `fieldMapping` (default: {}): Contact 필드 매핑
- `psychologyLenses`: 적용된 심리학 렌즈 배열 (L0-L10)
- `smsDay0/1/2/3TemplateId`: SMS 자동화 템플릿 ID

**응답 (201 Created):**
```json
{
  "ok": true,
  "data": {
    "id": "ctemplate_789ghi",
    "organizationId": "org_xxxxx",
    "name": "렌탈 계약서 - 2026",
    "category": "RENTAL",
    "description": "자동차 렌탈 서비스용 계약서",
    "visibility": "ORGANIZATION",
    "status": "DRAFT",
    "version": 1,
    "usageCount": 0,
    "lastUsedAt": null,
    "psychologyLenses": ["L6", "L10"],
    "isSystemTemplate": false,
    "createdAt": "2026-05-24T14:22:00Z",
    "updatedAt": "2026-05-24T14:22:00Z",
    "createdByUserId": "user_456def"
  }
}
```

**에러 응답:**
- 400: 필드 검증 실패
- 401: 인증 필요
- 403: OWNER 이상 권한 필요

---

### 3. GET /api/contract-templates/[id]
특정 계약 템플릿 상세 정보를 조회합니다.

**요청:**
```
GET /api/contract-templates/ctemplate_123abc
```

**응답 (200 OK):**
```json
{
  "ok": true,
  "data": {
    "id": "ctemplate_123abc",
    "organizationId": "org_xxxxx",
    "name": "크루즈 표준 계약서",
    "description": "국내 크루즈 상품용 표준 계약서 템플릿",
    "category": "CRUISE",
    "htmlContent": "<div>...</div>",
    "jsonContent": null,
    "fieldMapping": {
      "customerName": "Contact.name",
      "customerPhone": "Contact.phone"
    },
    "visibility": "ORGANIZATION",
    "status": "ACTIVE",
    "version": 1,
    "usageCount": 12,
    "lastUsedAt": "2026-05-24T10:30:00Z",
    "psychologyLenses": ["L6", "L10"],
    "isSystemTemplate": false,
    "smsDay0TemplateId": "sms_template_101",
    "smsDay1TemplateId": "sms_template_102",
    "smsDay2TemplateId": null,
    "smsDay3TemplateId": null,
    "createdByUserId": "user_456def",
    "createdAt": "2026-05-20T08:00:00Z",
    "updatedAt": "2026-05-24T09:15:00Z",
    "organization": {
      "id": "org_xxxxx",
      "name": "대리점명"
    },
    "instances": [
      {
        "id": "cinst_001",
        "status": "SENT",
        "createdAt": "2026-05-24T10:00:00Z",
        "updatedAt": "2026-05-24T10:30:00Z"
      }
    ]
  }
}
```

**에러 응답:**
- 400: 유효하지 않은 template ID
- 401: 인증 필요
- 404: 템플릿 찾을 수 없음 (조직 권한 없음 포함)

---

## 심리학 렌즈 통합 (L6, L10)

### L6: 타이밍 손실회피 (Timing Loss Aversion)
```json
{
  "psychologyLenses": ["L6"],
  "description": "24시간 제한된 오퍼 - 즉시 결정 촉구"
}
```

### L10: 즉시 구매 클로징
```json
{
  "psychologyLenses": ["L10"],
  "smsDay3TemplateId": "sms_urgent_final_offer"
}
```

---

## SMS Day 0-3 자동화 연동

템플릿 생성 시 SMS 템플릿 ID를 연결하면 ContractInstance 생성 시 자동으로 Day 0-3 발송이 스케줄됩니다.

**Day 0 (초기 액션):**
- PASONA P단계: 문제 제시
- 수신자: 계약서 수신 안내

**Day 1 (Follow-up):**
- PASONA S단계: 솔루션 강조
- 수신자: 계약 필수 항목 설명

**Day 2 (가치 강조):**
- PASONA O단계: 오퍼 제시
- 수신자: 혜택/특전 강조

**Day 3 (긴박감):**
- PASONA A단계: 즉시 행동 촉구
- L10 적용: 24시간 유효 기한 알림

---

## 권한 체크

| 메서드 | 엔드포인트 | GLOBAL_ADMIN | OWNER | AGENT | FREE_SALES |
|--------|-----------|:----:|:-----:|:-----:|:--------:|
| GET | /contract-templates | ✓ | ✓ | ✓ | ✗ |
| GET | /contract-templates/[id] | ✓ | ✓ | ✓ | ✗ |
| POST | /contract-templates | ✓ | ✓ | ✗ | ✗ |
| PUT | /contract-templates/[id] | ✓ | ✓ | ✗ | ✗ |
| DELETE | /contract-templates/[id] | ✓ | ✗ | ✗ | ✗ |

---

## 다음 구현 예정 (2/5 남음)

### 4. PUT /api/contract-templates/[id]
- 템플릿 업데이트 (name, category, htmlContent 등)
- 버전 관리 (version 증가)
- 심리학 렌즈 추가/제거

### 5. DELETE /api/contract-templates/[id]
- 소프트 삭제 (status → ARCHIVED)
- 하드 삭제 (GLOBAL_ADMIN만)
- ContractInstance 고아화 처리 (onDelete: Restrict)

---

## 에러 핸들링

| 에러 | 상태코드 | 처리 방법 |
|------|:--------:|----------|
| UNAUTHORIZED | 401 | 세션 만료 → 재로그인 |
| ORGANIZATION_REQUIRED | 400 | 조직 정보 필수 |
| Validation Error | 400 | 필드 재확인 후 재송신 |
| Template Not Found | 404 | 템플릿 삭제됨 또는 권한 없음 |
| Internal Error | 500 | 로그 확인 후 지원팀 연락 |

---

## 사용 예시 (cURL)

### 템플릿 목록 조회
```bash
curl -X GET \
  'http://localhost:3000/api/contract-templates?page=1&limit=10&category=CRUISE' \
  -H 'Cookie: session=xxxxx'
```

### 템플릿 생성
```bash
curl -X POST \
  'http://localhost:3000/api/contract-templates' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: session=xxxxx' \
  -d '{
    "name": "크루즈 계약서 2026",
    "category": "CRUISE",
    "psychologyLenses": ["L6", "L10"]
  }'
```

### 템플릿 상세 조회
```bash
curl -X GET \
  'http://localhost:3000/api/contract-templates/ctemplate_123abc' \
  -H 'Cookie: session=xxxxx'
```

---

## 데이터베이스 스키마 참고

**ContractTemplate 모델:**
- `id` (PK): cuid() 자동 생성
- `organizationId` (FK): Organization.id
- `category` enum: CRUISE|RENTAL|HOTEL|PACKAGE|OTHER
- `visibility` enum: ORGANIZATION|MANAGER_ONLY|PERSONAL
- `status` enum: ACTIVE|ARCHIVED|DRAFT
- `psychologyLenses` string[]: ["L0", "L1", ..., "L10"]
- `fieldMapping` Json: Contact 필드 매핑 규칙
- `usageCount`: 생성된 ContractInstance 개수
- `version`: 버전 관리 (PUT 시 증가)

**인덱스:**
- `idx_contract_templates_org_id`
- `idx_contract_templates_org_status`
- `idx_contract_templates_created_by`

---

**최종 업데이트**: 2026-05-24
**다음 단계**: PUT/DELETE 엔드포인트 구현 예정
