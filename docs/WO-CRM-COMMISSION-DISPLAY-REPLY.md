# CRM 팀 답변: 수당 웹훅 연동 확인

**답변일:** 2026-05-14
**발신:** mabiz CRM 개발팀
**수신:** 크루즈닷몰 개발팀

---

## 구현 완료 사항

크루즈닷몰 작업지시서(WO-CRM-COMMISSION-DISPLAY) 기준으로 **모든 항목 구현 완료**했습니다.

### 체크리스트 답변

- [x] **orderId 기준 upsert 시 commissionRate/commissionAmount 갱신 되는가?** → **됩니다.** 2단계 웹훅에서 같은 orderId로 호출하면 commissionRate, commissionAmount, saleAmount, productName 등 모든 필드가 최신값으로 갱신됩니다.

- [x] **commissionRate: null 수신 시 에러 없이 처리되는가?** → **됩니다.** null이면 DB에 null로 저장되고, 파트너 대시보드에 "확인 중"으로 표시됩니다.

- [x] **파트너 대시보드 수당 표시 기능이 있는가?** → **구현 완료했습니다.**
  - commissionRate = null → "확인 중" (노란색 뱃지)
  - commissionRate = 5.0 → "₩250,000 (5%)" 표시

---

## 1. DEFAULT_ORGANIZATION_ID 값

이 값은 CRM 데이터베이스에 있는 **기본 조직(본사)의 ID**입니다.

확인 방법:
```sql
SELECT id, name, slug FROM "Organization" WHERE slug = 'mabiz' LIMIT 1;
```

이 쿼리 결과의 `id` 값을 Vercel 환경변수 `DEFAULT_ORGANIZATION_ID`에 등록하면 됩니다. affiliateCode 매칭 실패 시(예: 직접 구매 고객) 이 조직으로 귀속됩니다.

**→ 값 확인 후 별도 전달드리겠습니다.**

---

## 2. 2단계 웹훅 eventId 처리 — 정상 동작합니다

CRM 처리 순서:

```
1단계: eventId="uuid-aaa", orderId="ORD-001"
  → eventId "uuid-aaa" 멱등성 체크 → 신규 → 통과
  → orderId "ORD-001" 기준 upsert → 신규 생성
  → eventId "uuid-aaa" 처리 완료 기록

2단계: eventId="uuid-bbb", orderId="ORD-001"
  → eventId "uuid-bbb" 멱등성 체크 → 신규 → 통과
  → orderId "ORD-001" 기준 upsert → 기존 레코드 업데이트
    (commissionRate, commissionAmount 갱신)
  → eventId "uuid-bbb" 처리 완료 기록
```

**결론:** eventId가 매번 새 UUID여도 정상 동작합니다. orderId 기준으로 upsert하기 때문에 같은 orderId면 기존 판매 레코드를 갱신합니다.

**주의:** 같은 eventId로 2번 보내면 2번째는 무시됩니다(중복 방지). 재전송 시 반드시 새 UUID를 사용해주세요.

---

## 추가 구현된 필드

크루즈닷몰에서 보내는 아래 필드도 저장하도록 구현했습니다:

| 필드 | CRM 저장 컬럼 | 비고 |
|------|--------------|------|
| saleId | cruiseSaleId | 크루즈닷몰 내부 판매 ID (향후 환불 연동용) |
| cabinType | cabinType | 객실 타입 |
| headcount | headcount | 탑승 인원 |

---

## 2단계 웹훅 추가 안내

2단계 웹훅(관리자 승인 후)에서 affiliateCode가 누락되어도 **orderId만으로 기존 판매를 찾아서 업데이트**합니다. 단, 최소한 아래 필드는 포함해주세요:

```json
{
  "phone": "필수",
  "name": "필수",
  "orderId": "필수 (기존 판매 식별용)",
  "saleAmount": "필수",
  "commissionRate": "확정값",
  "commissionAmount": "확정값",
  "eventId": "새 UUID (중복 방지)"
}
```

---

감사합니다.
mabiz CRM 개발팀
