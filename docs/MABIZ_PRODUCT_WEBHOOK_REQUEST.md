# mabiz 신규 상품 웹훅 요청

**제목:** [요청] CRM을 위한 상품 마스터 데이터 웹훅 추가

**요청 일자:** 2026-05-16

---

## 📌 요청 사항

CRM에서 크루즈닷몰의 **상품 마스터 데이터**를 실시간으로 동기화하기 위해 신규 웹훅을 요청합니다.

---

## 📋 웹훅 스펙

### 엔드포인트
```
POST https://crm.mabiz.ai/api/webhooks/product
```

### 인증
```
Authorization: Bearer {MABIZ_PRODUCT_WEBHOOK_SECRET}
Content-Type: application/json
```

### 트리거 시점

- ✅ 상품 신규 등록
- ✅ 상품 정보 수정 (가격, 일정, 수당률 등)
- ✅ 상품 활성화 상태 변경

### 페이로드 예시

```json
{
  "eventId": "evt_a1b2c3d4",
  "eventType": "product.created",
  "timestamp": "2026-05-16T10:30:00Z",
  
  "productCode": "CP-2026-05-001",
  "packageName": "7박 8일 카리브해 크루즈",
  "cruiseLine": "Royal Caribbean",
  "shipName": "Harmony of the Seas",
  
  "basePrice": 1250000,
  "nights": 7,
  "days": 8,
  "startDate": "2026-06-15",
  "endDate": "2026-06-22",
  
  "isActive": true,
  "saleStatus": "AVAILABLE",
  
  "itineraryPattern": [
    { "type": "port", "location": "산후안", "country": "푸에르토리코" },
    { "type": "port", "location": "조지아운", "country": "터크스 케이커스" },
    { "type": "sea" }
  ],
  "tourCities": "산후안, 조지아운, 포트 카나베랄",
  
  "commissionRate": 5.0,
  "commissionAmount": 62500,
  
  "refundPolicy": {
    "slots": [
      { "daysBeforeDep": 60, "penaltyRate": 0 },
      { "daysBeforeDep": 30, "penaltyRate": 25 },
      { "daysBeforeDep": 14, "penaltyRate": 50 },
      { "daysBeforeDep": 0, "penaltyRate": 100 }
    ]
  }
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `eventId` | string | ✅ | 웹훅 고유 ID (중복 전송 방지용) |
| `eventType` | string | ✅ | `product.created`, `product.updated` |
| `timestamp` | ISO8601 | ✅ | 이벤트 발생 시간 |
| `productCode` | string | ✅ | 상품 코드 (unique key) |
| `packageName` | string | ✅ | 상품명 |
| `cruiseLine` | string | ✅ | 크루즈사 |
| `shipName` | string | ✅ | 선박명 |
| `basePrice` | integer | ✅ | 기본 가격 (원) |
| `nights` | integer | ✅ | 박수 |
| `days` | integer | ✅ | 일수 |
| `startDate` | ISO8601 | ✅ | 출발일 |
| `endDate` | ISO8601 | ❌ | 귀항일 |
| `isActive` | boolean | ✅ | 활성화 여부 |
| `saleStatus` | string | ❌ | 판매 상태 |
| `itineraryPattern` | array | ❌ | 기항지 정보 |
| `tourCities` | string | ❌ | 관광지 (쉼표 구분) |
| `commissionRate` | float | ❌ | 수수료율 (%, 예: 5.0) |
| `commissionAmount` | integer | ❌ | 수수료액 (원) |
| `refundPolicy` | object | ❌ | 환불정책 |

### 성공 응답

```json
{
  "ok": true
}
```

---

## 🎯 CRM 영향도

### 현재 상황
- ✅ Purchase 웹훅으로 구매 시 상품 정보 수신
- ❌ 상품 자체 등록/수정 이벤트 없음

### 신규 웹훅 이후
- ✅ 상품 마스터 데이터 실시간 동기화
- ✅ 구매 전에도 상품 정보 미리 입력
- ✅ 가격/수당률 변경 즉시 반영

---

## 📅 예상 일정

- **요청:** 2026-05-16
- **개발:** 1-2주 예상
- **테스트:** 1주
- **배포:** 예정

---

## 🔗 참고자료

- **기존 웹훅:** `/api/webhooks/purchase`
- **CRM 상품 테이블:** `CruiseProduct` (Neon 공유 DB)
- **contact:** hyeseon28@gmail.com
