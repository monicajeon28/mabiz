# Campaign Variants API

Variant는 A/B 테스트를 위한 마케팅 캠페인의 변형입니다. SMS와 이메일 내용을 다르게 설정하고, 트래픽 분배(trafficSplit) 비율을 조정할 수 있습니다.

## 핵심 규칙

- **Variant 유형**: A 또는 B만 가능 (2개 변형)
- **생성/수정 조건**: DRAFT 상태의 캠페인만 가능
- **trafficSplit**: A가 받을 트래픽 비율 (0.0~1.0)
  - 0.5 = 50% A, 50% B
  - 0.3 = 30% A, 70% B
  - 1.0 = 100% A, 0% B

## Endpoints

### 1. GET /api/campaigns/[id]/variants

캠페인의 모든 Variant 조회

#### 요청

```bash
curl -X GET http://localhost:3000/api/campaigns/cmp_123/variants \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 응답 (200)

```json
{
  "ok": true,
  "variants": [
    {
      "id": "var_abc123",
      "variantKey": "A",
      "smsBody": "반가워요! 지금 예약하면 20% 할인",
      "emailSubject": "특별한 크루즈 여행 기회",
      "emailBody": "안녕하세요!\n\n지금 예약하면 20% 할인을 드립니다...",
      "trafficSplit": 0.5,
      "isActive": true,
      "createdAt": "2026-05-20T10:00:00Z"
    },
    {
      "id": "var_def456",
      "variantKey": "B",
      "smsBody": "지금 신청하면 20% 환급!",
      "emailSubject": "크루즈 여행 20% 캐시백",
      "emailBody": "안녕하세요!\n\n지금 신청하면 20% 캐시백을 드립니다...",
      "trafficSplit": 0.5,
      "isActive": true,
      "createdAt": "2026-05-20T10:05:00Z"
    }
  ],
  "total": 2
}
```

#### 에러

- **404**: Campaign not found (캠페인 없음)
- **403**: Unauthorized (다른 조직의 캠페인)
- **500**: Internal server error

---

### 2. POST /api/campaigns/[id]/variants

Variant 생성 (A 또는 B)

#### 요청

```bash
curl -X POST http://localhost:3000/api/campaigns/cmp_123/variants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variantKey": "A",
    "smsBody": "반가워요! 지금 예약하면 20% 할인",
    "emailSubject": "특별한 크루즈 여행 기회",
    "emailBody": "안녕하세요!\n\n지금 예약하면 20% 할인을 드립니다...",
    "trafficSplit": 0.5
  }'
```

#### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| variantKey | string (A\|B) | ✓ | Variant 식별자 |
| smsBody | string \| null | | SMS 본문 (최대 90자) |
| emailSubject | string \| null | | 이메일 제목 (최대 200자) |
| emailBody | string \| null | | 이메일 본문 (최대 5000자) |
| trafficSplit | number | | A가 받을 트래픽 비율 (0.0~1.0, 기본: 0.5) |

#### 응답 (201 Created)

```json
{
  "ok": true,
  "variant": {
    "id": "var_abc123",
    "campaignId": "cmp_123",
    "variantKey": "A",
    "smsBody": "반가워요! 지금 예약하면 20% 할인",
    "emailSubject": "특별한 크루즈 여행 기회",
    "emailBody": "안녕하세요!\n\n지금 예약하면 20% 할인을 드립니다...",
    "trafficSplit": 0.5,
    "isActive": true,
    "createdAt": "2026-05-20T10:00:00Z",
    "updatedAt": "2026-05-20T10:00:00Z"
  }
}
```

#### 에러

- **400**: Invalid input (필드 검증 실패)
  ```json
  {
    "error": "Invalid input",
    "details": [
      {
        "path": "smsBody",
        "message": "SMS는 90자 이하여야 합니다"
      }
    ]
  }
  ```

- **400**: Campaign status is not DRAFT
  ```json
  {
    "error": "DRAFT 상태의 캠페인만 Variant를 생성할 수 있습니다 (현재: SENT)"
  }
  ```

- **404**: Campaign not found
- **409**: Variant already exists
  ```json
  {
    "error": "Variant A는 이미 존재합니다"
  }
  ```
- **403**: Unauthorized
- **500**: Internal server error

---

### 3. PATCH /api/campaigns/[id]/variants/[key]

Variant 수정 (부분 업데이트)

#### 요청

```bash
curl -X PATCH http://localhost:3000/api/campaigns/cmp_123/variants/A \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "smsBody": "반가워요! 이번주 예약 시 30% 할인",
    "trafficSplit": 0.3
  }'
```

#### 설명

- 모든 필드가 선택사항 (업데이트할 필드만 전송)
- 전송하지 않은 필드는 기존값 유지
- `smsBody`, `emailSubject`, `emailBody`는 `null` 값 지정 가능 (내용 제거)

#### 응답 (200)

```json
{
  "ok": true,
  "variant": {
    "id": "var_abc123",
    "campaignId": "cmp_123",
    "variantKey": "A",
    "smsBody": "반가워요! 이번주 예약 시 30% 할인",
    "emailSubject": "특별한 크루즈 여행 기회",
    "emailBody": "안녕하세요!...",
    "trafficSplit": 0.3,
    "isActive": true,
    "createdAt": "2026-05-20T10:00:00Z",
    "updatedAt": "2026-05-20T10:15:00Z"
  }
}
```

#### 에러

- **400**: Invalid input
- **400**: Campaign status is not DRAFT
- **404**: Campaign not found
- **404**: Variant not found
- **403**: Unauthorized
- **500**: Internal server error

---

### 4. DELETE /api/campaigns/[id]/variants/[key]

Variant 삭제

#### 요청

```bash
curl -X DELETE http://localhost:3000/api/campaigns/cmp_123/variants/A \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 응답 (200)

```json
{
  "ok": true,
  "message": "Variant A deleted"
}
```

#### 에러

- **400**: Campaign status is not DRAFT
- **404**: Campaign not found
- **404**: Variant not found
- **403**: Unauthorized
- **500**: Internal server error

---

## 사용 사례

### A/B 테스트 설정

1. DRAFT 캠페인 생성 (메인 API로)
2. Variant A 생성 (제목/내용 버전 1)
3. Variant B 생성 (제목/내용 버전 2)
4. trafficSplit으로 비율 조정 (예: 0.5 = 50/50 분할)
5. 캠페인 발송 (메인 API)
6. 통계에서 A/B 성과 비교

### 예시 흐름

```
1. POST /api/campaigns
   → campaignId: "cmp_123", status: "DRAFT"

2. POST /api/campaigns/cmp_123/variants
   Body: { variantKey: "A", smsBody: "할인 20%", trafficSplit: 0.5 }
   → variantId: "var_a123"

3. POST /api/campaigns/cmp_123/variants
   Body: { variantKey: "B", smsBody: "캐시백 20%", trafficSplit: 0.5 }
   → variantId: "var_b123"

4. GET /api/campaigns/cmp_123/variants
   → 2개 Variant 조회

5. PATCH /api/campaigns/cmp_123/variants/A
   Body: { trafficSplit: 0.3 }
   → A 30%, B 70%로 변경

6. PATCH /api/campaigns/cmp_123 (메인 API)
   Body: { status: "SCHEDULED", sendAt: "..." }
   → 발송 예약

7. GET /api/campaigns/cmp_123/sending-history/stats
   → A/B 발송 결과 비교
```

---

## 보안

### IDOR (Insecure Direct Object Reference) 방지

- 모든 엔드포인트에서 Campaign의 `organizationId` 확인
- 다른 조직의 캠페인에 접근 시 403 반환

### 상태 검증

- DRAFT 상태가 아닌 캠페인은 Variant 생성/수정/삭제 불가
- 발송 중인 캠페인은 수정 불가

---

## 에러 응답 형식

모든 에러는 다음 형식으로 반환됩니다:

```json
{
  "error": "에러 메시지",
  "details": [
    {
      "path": "필드명",
      "message": "상세 메시지"
    }
  ]
}
```

자세한 정보는 HTTP 상태 코드를 참고하세요.

---

## 테스트

### 통합 테스트 실행

```bash
npm test -- variants.test.ts
```

### cURL 테스트 예제

```bash
# 1. Variant A 생성
curl -X POST http://localhost:3000/api/campaigns/cmp_123/variants \
  -H "Content-Type: application/json" \
  -d '{
    "variantKey": "A",
    "smsBody": "Hello A",
    "trafficSplit": 0.5
  }'

# 2. Variant B 생성
curl -X POST http://localhost:3000/api/campaigns/cmp_123/variants \
  -H "Content-Type: application/json" \
  -d '{
    "variantKey": "B",
    "smsBody": "Hello B",
    "trafficSplit": 0.5
  }'

# 3. 모든 Variant 조회
curl http://localhost:3000/api/campaigns/cmp_123/variants

# 4. Variant A 수정
curl -X PATCH http://localhost:3000/api/campaigns/cmp_123/variants/A \
  -H "Content-Type: application/json" \
  -d '{"smsBody": "Updated A", "trafficSplit": 0.3}'

# 5. Variant B 삭제
curl -X DELETE http://localhost:3000/api/campaigns/cmp_123/variants/B
```

---

## TypeScript 타입

```typescript
import {
  CreateVariantInput,
  UpdateVariantInput,
} from '@/schemas/campaign-variant';

// Variant 생성
const payload: CreateVariantInput = {
  variantKey: 'A',
  smsBody: 'Hello A',
  trafficSplit: 0.5,
};

// Variant 수정
const update: UpdateVariantInput = {
  smsBody: 'Updated SMS',
  trafficSplit: 0.3,
};
```
