# 작업지시서: 크루즈닷몰 → CRM 수당 데이터 연동

**발행일:** 2026-05-16
**발행처:** 크루즈닷몰 개발팀
**수신처:** mabiz CRM 개발팀
**우선순위:** High

---

## 배경 및 핵심 전제

크루즈닷몰은 어필리에이트 수당(commissionRate, commissionAmount)을 자체 관리합니다.
**CRM은 수당을 직접 등록·계산하지 않습니다.**
크루즈닷몰이 수당 확정 후 CRM에 전송하면, CRM은 이를 저장하고 파트너 대시보드에 표시하면 됩니다.

---

## 웹훅 전송 방식: 2단계 구조

### 1단계 — 결제 즉시 전송 (commissionRate: null 가능)

고객이 결제 완료하는 순간 즉시 전송됩니다.
이 시점에 수당이 확정되어 있으면 commissionRate도 함께 전송됩니다.
수당 미등록 상품이면 commissionRate: null로 전송됩니다.

```
POST {CRM도메인}/api/webhooks/purchase
Authorization: Bearer {MABIZ_PURCHASE_WEBHOOK_SECRET}
Content-Type: application/json
```

```json
{
  "phone": "01012345678",
  "name": "홍길동",
  "productName": "지중해 7박 MSC 크루즈",
  "saleAmount": 5000000,
  "orderId": "ORD-20260516-001",
  "affiliateCode": "PARTNER001",
  "eventId": "uuid-v4-자동생성",
  "departureDate": "2026-08-15",
  "customerEmail": "hong@email.com",
  "commissionAmount": 250000,
  "commissionRate": 5.0,
  "productCode": "MED7-MSC",
  "headcount": 2,
  "cabinType": "OCEAN_VIEW",
  "saleId": 1234
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| phone | 필수 | 구매자 전화번호 (숫자만) |
| name | 필수 | 구매자 이름 |
| saleAmount | 필수 | 결제금액 (원) |
| orderId | 필수 | 주문번호 — **업데이트 기준 키** |
| affiliateCode | 필수 | 파트너 코드 |
| eventId | 권장 | UUID v4 — 중복 수신 방지용 |
| commissionAmount | 선택 | 수수료 금액 (원, 없으면 null) |
| commissionRate | 선택 | 수수료율 % (예: 5.0 = 5%, **없으면 null**) |
| saleId | 선택 | 크루즈닷몰 내부 판매 ID |

---

### 2단계 — 관리자 승인 후 재전송 (commissionRate 확정값 포함)

수당이 null이었던 판매건은 관리자가 수동으로 수당율을 확인·승인합니다.
**승인 완료 시 같은 orderId로 웹훅을 다시 전송합니다.**

```json
{
  "phone": "01012345678",
  "name": "홍길동",
  "orderId": "ORD-20260516-001",
  "saleAmount": 5000000,
  "affiliateCode": "PARTNER001",
  "commissionAmount": 250000,
  "commissionRate": 5.0,
  "saleId": 1234
}
```

이 2단계 웹훅은 orderId가 동일하므로 **기존 판매 레코드를 업데이트** 처리해야 합니다.

---

## CRM이 구현해야 할 사항

### 필수 1 — orderId 기준 upsert 처리

같은 orderId로 웹훅이 2번 올 수 있습니다 (1단계 + 2단계).

```
orderId 없으면 → 신규 판매 레코드 생성
orderId 있으면 → 기존 레코드 업데이트 (commissionRate, commissionAmount 갱신)
```

> 현재 CRM 스펙 문서에 "orderId 같으면 기존 판매를 업데이트"라고 명시되어 있으나
> commissionRate/commissionAmount 필드도 업데이트 대상에 포함되는지 확인 필요

---

### 필수 2 — commissionRate null 처리

commissionRate: null 또는 필드 누락인 경우 오류 없이 처리해야 합니다.

```
commissionRate: null  → "확인 중" 또는 빈값으로 표시
commissionRate: 5.0   → "5%" 표시
```

---

### 필수 3 — 파트너 대시보드 수당 표시

파트너(대리점장/세일즈/프리세일즈)가 확인하는 대시보드에 아래 정보가 표시되어야 합니다.

| 표시 항목 | 데이터 소스 | 표시 예시 |
|----------|-----------|---------|
| 판매금액 | saleAmount | 5,000,000원 |
| 수수료율 | commissionRate | 5% |
| 수수료금액 | commissionAmount | 250,000원 |
| 수당 상태 | commissionRate 유무 | 확인 중 / 확정 |

**commissionRate=null이면 파트너 대시보드에 수당이 표시되지 않아야 합니다.**
(크루즈닷몰 관리자 승인 전에는 파트너가 수당을 볼 수 없어야 함)

**commissionRate가 채워진 후 → 파트너 대시보드에 자동 반영**

---

### 권장 1 — commissionAmount로 역산 표시

commissionRate가 null이더라도 commissionAmount가 있으면 역산해서 참고 표시 가능합니다.

```
역산 공식: commissionAmount / saleAmount × 100 = commissionRate(%)
예시: 250,000 / 5,000,000 × 100 = 5%
```

단, 이 역산값은 어드민 확인 전이므로 "예상 수수료율"로만 표시 권장합니다.

---

### 권장 2 — saleId 필드 저장

`saleId`는 크루즈닷몰 내부 `AffiliateSale.id`입니다.
향후 환불·취소·수당 조회 연동 시 이 값을 크루스 레퍼런스 키로 사용합니다.
CRM AffiliateSale 레코드에 `cruiseSaleId` 같은 컬럼으로 저장해두시면 좋습니다.

---

## 수당 종류별 설명 (commissionAmount 구성)

크루즈닷몰 어필리에이트는 3가지 역할이 있습니다.

| 역할 | 코드 | commissionAmount 포함 여부 |
|------|------|--------------------------|
| 대리점장 | branch | 포함 |
| 세일즈 | sales | 포함 |
| 프리세일즈 | freeAgent | 포함 (salesShareAmount와 별도 단가) |

commissionAmount는 위 3가지 수당의 합계입니다.
개별 분리는 현재 웹훅에 포함되지 않습니다.
개별 분리가 필요하면 별도 협의 후 필드 추가 가능합니다.

---

## 데이터 흐름 전체 요약

```
[크루즈닷몰]                           [CRM]

고객 결제 완료
    ↓
1단계 웹훅 전송 ─────────────────→ 판매 레코드 생성
(commissionRate: null 가능)          (commissionRate: null이면 수당 미표시)
    ↓
관리자 수당 확인 및 승인
    ↓
2단계 웹훅 전송 ─────────────────→ 기존 레코드 업데이트 (orderId 기준)
(commissionRate: 5.0 확정)           파트너 대시보드에 수당 자동 표시
```

---

## CRM 팀 확인 사항

- [ ] orderId 기준 upsert 시 commissionRate/commissionAmount도 갱신되는가?
- [ ] commissionRate: null 수신 시 오류 없이 처리되는가?
- [ ] `DEFAULT_ORGANIZATION_ID` 값 공유 (affiliateCode 매칭 실패 시 폴백)
- [ ] 파트너 대시보드에 수당 표시 기능이 있는가? 없으면 신규 구현 필요

---

## 인증 방식 (기존과 동일)

```
Authorization: Bearer {MABIZ_PURCHASE_WEBHOOK_SECRET}
```

재전송도 동일한 Secret을 사용합니다.

---

*문의: 크루즈닷몰 개발팀*
