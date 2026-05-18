# Menu #38 Phase 1 — Campaign API CRUD 구현

## 개요
Campaign 마케팅 캠페인의 생성/조회/수정/삭제 API 4개 구현 완료

**구현 날짜**: 2026-05-18  
**구현자**: Claude Haiku  
**상태**: ✅ 완료

---

## 1. 생성된 파일

### 1.1 Schema 정의
**파일**: `src/schemas/campaign.ts`
- `CampaignCreateSchema` — 캠페인 생성 스키마
- `CampaignUpdateSchema` — 캠페인 수정 스키마
- `CampaignListQuerySchema` — 목록 조회 쿼리 스키마

### 1.2 API 엔드포인트
**파일**: `src/app/api/campaigns/route.ts`
```
GET    /api/campaigns (목록 조회)
POST   /api/campaigns (생성)
```

**파일**: `src/app/api/campaigns/[id]/route.ts`
```
PATCH  /api/campaigns/[id] (수정)
DELETE /api/campaigns/[id] (삭제)
```

---

## 2. API 명세서

### 2.1 GET /api/campaigns — 캠페인 목록 조회

**쿼리 파라미터**:
```
status:      'DRAFT' | 'SCHEDULED' | 'SENT' | 'FAILED' (선택)
createdByMe: true (선택, 내가 만든 것만)
limit:       1-100 (기본값: 20)
offset:      0 이상 (기본값: 0)
```

**요청 예시**:
```bash
GET /api/campaigns?status=DRAFT&limit=20&offset=0
```

**응답 (200 OK)**:
```json
{
  "ok": true,
  "campaigns": [
    {
      "id": "uuid",
      "title": "5월 프로모션",
      "status": "DRAFT",
      "sendSms": true,
      "sendEmail": true,
      "sendAt": "2026-05-25T14:00:00Z",
      "repeatRule": "WEEKLY_MON",
      "sentCount": 0,
      "totalCount": 150,
      "createdAt": "2026-05-18T10:00:00Z",
      "updatedAt": "2026-05-18T10:00:00Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

**오류 응답 (400)**:
```json
{
  "ok": false,
  "error": "INVALID_QUERY",
  "message": "쿼리 파라미터 검증에 실패했습니다.",
  "errors": {
    "limit": "1 이상 100 이하여야 합니다."
  }
}
```

---

### 2.2 POST /api/campaigns — 캠페인 생성

**요청 본문**:
```json
{
  "groupId": "uuid",
  "title": "5월 프로모션",
  "sendSms": true,
  "smsBody": "안녕하세요! 5월 특가 안내입니다.",
  "sendEmail": true,
  "emailSubject": "5월 프로모션",
  "emailBody": "<h1>5월 특가 안내</h1><p>...</p>",
  "includeLanding": false,
  "landingUrl": null,
  "landingLinkText": null,
  "sendAt": "2026-05-25T14:00:00Z",
  "repeatRule": "ONCE"
}
```

**응답 (201 Created)**:
```json
{
  "ok": true,
  "campaign": {
    "id": "cluwxyz123",
    "title": "5월 프로모션",
    "status": "DRAFT",
    "sendSms": true,
    "sendEmail": true,
    "sendAt": "2026-05-25T14:00:00Z",
    "repeatRule": "ONCE",
    "sentCount": 0,
    "totalCount": 0,
    "createdAt": "2026-05-18T10:00:00Z",
    "updatedAt": "2026-05-18T10:00:00Z"
  }
}
```

**검증 규칙**:
- ✅ `groupId` 필수, 존재하는 그룹이어야 함
- ✅ `title` 필수, 1-100자
- ✅ `sendSms` 또는 `sendEmail` 중 최소 하나는 true
- ✅ `smsBody` SMS 활성화 시, 최대 1000자
- ✅ `emailSubject`, `emailBody` 이메일 활성화 시
- ✅ `sendAt` 미래 시간이어야 함
- ✅ `landingUrl` 포함 시 유효한 URL 형식

**오류 응답 (400)**:
```json
{
  "ok": false,
  "error": "INVALID_INPUT",
  "message": "최소한 SMS 또는 이메일 중 하나를 활성화해야 합니다.",
  "errors": {}
}
```

**오류 응답 (404)**:
```json
{
  "ok": false,
  "error": "NOT_FOUND",
  "message": "그룹을 찾을 수 없습니다."
}
```

---

### 2.3 PATCH /api/campaigns/[id] — 캠페인 수정

**URL 파라미터**:
```
id: 캠페인 ID (uuid)
```

**요청 본문** (모두 선택):
```json
{
  "title": "6월 프로모션",
  "sendSms": false,
  "smsBody": null,
  "sendEmail": true,
  "emailSubject": "6월 특가",
  "emailBody": "<h1>6월</h1>",
  "includeLanding": true,
  "landingUrl": "https://example.com/landing",
  "landingLinkText": "자세히보기",
  "sendAt": "2026-06-01T14:00:00Z",
  "repeatRule": "MONTHLY_1"
}
```

**응답 (200 OK)**:
```json
{
  "ok": true,
  "campaign": {
    "id": "cluwxyz123",
    "title": "6월 프로모션",
    "status": "DRAFT",
    "sendSms": false,
    "sendEmail": true,
    "sendAt": "2026-06-01T14:00:00Z",
    "repeatRule": "MONTHLY_1",
    "sentCount": 0,
    "totalCount": 0,
    "createdAt": "2026-05-18T10:00:00Z",
    "updatedAt": "2026-05-18T11:00:00Z"
  }
}
```

**제약사항**:
- ✅ DRAFT 상태인 캠페인만 수정 가능
- ✅ groupId는 수정 불가
- ✅ organizationId 필터링 (IDOR 보안)

**오류 응답 (400)**:
```json
{
  "ok": false,
  "error": "INVALID_STATE",
  "message": "발송 준비 중 이상의 캠페인은 수정할 수 없습니다."
}
```

---

### 2.4 DELETE /api/campaigns/[id] — 캠페인 삭제

**URL 파라미터**:
```
id: 캠페인 ID (uuid)
```

**요청**: 본문 없음

**응답 (200 OK)**:
```json
{
  "ok": true,
  "message": "캠페인이 삭제되었습니다."
}
```

**제약사항**:
- ✅ DRAFT 상태인 캠페인만 삭제 가능
- ✅ organizationId 필터링 (IDOR 보안)

**오류 응답 (404)**:
```json
{
  "ok": false,
  "error": "NOT_FOUND",
  "message": "캠페인을 찾을 수 없습니다."
}
```

---

## 3. 보안 및 검증

### 3.1 IDOR (Insecure Direct Object Reference) 방지
- 모든 API에서 `organizationId` 필터링 적용
- 캠페인 조회/수정/삭제 전 organizationId 검증

### 3.2 입력값 검증 (Zod)
- 모든 필드에 타입 및 길이 검증
- 이메일 URL 검증
- DateTime 형식 검증

### 3.3 비즈니스 로직 검증
- `sendSms` 또는 `sendEmail` 중 최소 하나는 활성화
- `sendAt`은 현재 시간보다 미래여야 함
- `includeLanding=true`인 경우 `landingUrl` 필수
- DRAFT 상태에서만 수정/삭제 가능

### 3.4 필드 화이트리스트 (SEC-004)
```typescript
allowedFields = [
  'title', 'sendSms', 'smsBody', 'sendEmail',
  'emailSubject', 'emailBody', 'includeLanding',
  'landingUrl', 'landingLinkText', 'sendAt', 'repeatRule'
]
```

---

## 4. 데이터베이스 매핑

**Prisma 모델**: `CrmMarketingCampaign`
**테이블명**: `CrmMarketingCampaign`

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| id | String | cuid() | 고유 ID |
| organizationId | String | - | 조직 ID |
| groupId | String | - | 그룹 ID (FK) |
| title | String | - | 캠페인명 |
| sendSms | Boolean | false | SMS 발송 여부 |
| smsBody | String? | null | SMS 본문 |
| sendEmail | Boolean | false | 이메일 발송 여부 |
| emailSubject | String? | null | 이메일 제목 |
| emailBody | String? | null | 이메일 본문 |
| includeLanding | Boolean | false | 랜딩 포함 여부 |
| landingUrl | String? | null | 랜딩 URL |
| landingLinkText | String? | null | 랜딩 링크 텍스트 |
| sendAt | DateTime | - | 발송 일시 |
| repeatRule | String? | null | 반복 규칙 |
| status | String | "DRAFT" | 상태 (DRAFT/SCHEDULED/SENT/FAILED) |
| totalCount | Int | 0 | 그룹 멤버 총 수 |
| sentCount | Int | 0 | 발송 완료 수 |
| createdAt | DateTime | now() | 생성 일시 |
| updatedAt | DateTime | - | 수정 일시 |

---

## 5. 테스트 시나리오

### 5.1 POST /api/campaigns 테스트

**시나리오 1**: 정상 생성
```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "group-uuid-123",
    "title": "5월 프로모션",
    "sendSms": true,
    "smsBody": "5월 특가 소식입니다!",
    "sendEmail": false,
    "sendAt": "2026-05-25T14:00:00Z",
    "repeatRule": "ONCE"
  }'
```

**시나리오 2**: SMS와 Email 둘 다 비활성화 (실패)
```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "group-uuid-123",
    "title": "5월 프로모션",
    "sendSms": false,
    "sendEmail": false,
    "sendAt": "2026-05-25T14:00:00Z"
  }'
# 응답: 400 Bad Request - "최소한 SMS 또는 이메일 중 하나를 활성화해야 합니다."
```

**시나리오 3**: 과거 시간 지정 (실패)
```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "group-uuid-123",
    "title": "5월 프로모션",
    "sendSms": true,
    "smsBody": "과거",
    "sendAt": "2020-05-25T14:00:00Z"
  }'
# 응답: 400 Bad Request - "발송 시간은 현재 시간보다 이후여야 합니다."
```

### 5.2 GET /api/campaigns 테스트

**시나리오 1**: 전체 목록 조회
```bash
curl http://localhost:3000/api/campaigns
```

**시나리오 2**: DRAFT 상태만 필터링
```bash
curl "http://localhost:3000/api/campaigns?status=DRAFT&limit=10"
```

**시나리오 3**: 페이지네이션
```bash
curl "http://localhost:3000/api/campaigns?limit=20&offset=40"
```

### 5.3 PATCH /api/campaigns/[id] 테스트

**시나리오 1**: 제목 수정
```bash
curl -X PATCH http://localhost:3000/api/campaigns/cluwxyz123 \
  -H "Content-Type: application/json" \
  -d '{"title": "6월 프로모션"}'
```

**시나리오 2**: DRAFT 아닌 상태에서 수정 시도 (실패)
```bash
curl -X PATCH http://localhost:3000/api/campaigns/cluwxyz123 \
  -H "Content-Type: application/json" \
  -d '{"title": "새제목"}'
# 응답: 400 Bad Request - "발송 준비 중 이상의 캠페인은 수정할 수 없습니다."
```

### 5.4 DELETE /api/campaigns/[id] 테스트

**시나리오 1**: 정상 삭제
```bash
curl -X DELETE http://localhost:3000/api/campaigns/cluwxyz123
```

**시나리오 2**: 존재하지 않는 ID (실패)
```bash
curl -X DELETE http://localhost:3000/api/campaigns/invalid-id
# 응답: 404 Not Found - "캠페인을 찾을 수 없습니다."
```

---

## 6. 구현 체크리스트

- [x] 4개 API 엔드포인트 생성
  - [x] POST /api/campaigns
  - [x] GET /api/campaigns
  - [x] PATCH /api/campaigns/[id]
  - [x] DELETE /api/campaigns/[id]

- [x] Zod 스키마 작성
  - [x] CampaignCreateSchema
  - [x] CampaignUpdateSchema
  - [x] CampaignListQuerySchema

- [x] 보안 구현
  - [x] IDOR 방지 (organizationId 필터링)
  - [x] 입력값 검증 (Zod)
  - [x] 필드 화이트리스트 (SEC-004)
  - [x] 비즈니스 로직 검증

- [x] 에러 처리
  - [x] 400 Bad Request (입력값 오류)
  - [x] 403 Forbidden (권한 없음)
  - [x] 404 Not Found (리소스 없음)
  - [x] 500 Internal Server Error

- [x] 코드 품질
  - [x] 타입 안정성 (TypeScript)
  - [x] 주석 및 문서화
  - [x] 로깅 구현
  - [x] 오류 메시지 국문화

---

## 7. 컴파일 상태

**Status**: ✅ OK

생성된 모든 파일:
- `src/schemas/campaign.ts` — ✅ 문법 확인 완료
- `src/app/api/campaigns/route.ts` — ✅ 문법 확인 완료
- `src/app/api/campaigns/[id]/route.ts` — ✅ 문법 확인 완료

의존성:
- `@/lib/rbac` — 인증 컨텍스트
- `@/lib/prisma` — 데이터베이스
- `@/lib/logger` — 로깅
- `zod` — 검증

---

## 8. 다음 단계

**Phase 2**: Campaign UI 마법사
- 캠페인 생성 폼 (Wizard)
- 캠페인 목록 페이지
- 캠페인 상세/수정 페이지
- 캠페인 상태 전환 (DRAFT → SCHEDULED → SENT)
- 발송 이력 조회

**Phase 3**: 캠페인 실행 엔진
- 스케줄 기반 발송 서비스
- SMS/Email 통합 발송
- 재시도 로직
- 발송 결과 추적

---

## 9. 관련 문서

- [CrmMarketingCampaign 모델 정의](../prisma/schema.prisma#L4445)
- [RBAC 인증 가이드](../lib/rbac.ts)
- [Logger 사용법](../lib/logger.ts)

---

**작성일**: 2026-05-18  
**최종 검토**: Claude Haiku 4.5  
**상태**: ✅ Phase 1 완료
