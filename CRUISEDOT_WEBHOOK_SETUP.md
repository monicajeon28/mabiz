# cruisedot 웹훅 활성화 설정 가이드

**상태**: READY FOR CRUISEDOT ADMIN ⏳

---

## 필수 설정 2개

### 1️⃣ Inventory Sync 웹훅 활성화

**Webhook 설정**:
```
이름: Inventory Sync
URL: https://mabiz.vercel.app/api/webhooks/cruisedot-inventory
메서드: POST
인증: Bearer Token
Secret: [CRUISEDOT_INVENTORY_WEBHOOK_SECRET 값]
```

**Trigger 이벤트**:
- [ ] 예약 생성 (sale.created)
- [ ] 예약 수정 (sale.updated)
- [ ] 예약 환불 (sale.refunded)

**실행 시점**: 예약/환불 발생 즉시

**검증**:
```bash
# mabiz CRM에서 재고 감소 확인
SELECT id, currentStock, lastInventorySyncAt 
FROM crmProduct 
WHERE organizationId = 'org_id'
ORDER BY lastInventorySyncAt DESC
LIMIT 5;
```

---

### 2️⃣ Payment 웹훅 확인 (기존)

**현황**: 이미 구현됨 - 이미지 확인만 필요

```
Webhook: cruisedot-payment
URL: https://mabiz.vercel.app/api/webhooks/cruisedot-payment
Status: ✓ 활성화 확인
```

**변경사항** (P0 ISS-01/04 적용):
- Contact 자동생성 로직 추가
- Refund 시 SMS flag 초기화

---

## 테스트 시나리오

### 시나리오 1: 예약 생성 → Contact 자동생성
```
1. cruisedot: 고객 A 예약 생성
2. mabiz: Payment 웹훅 → Contact 자동생성
3. 확인: mabiz CRM에서 Contact ID 조회
   SELECT id, bookingRef, name FROM Contact 
   WHERE bookingRef = '[예약번호]'
```

### 시나리오 2: 판매 → 재고 감소
```
1. mabiz: Contact에서 상품 판매
2. cruisedot inventory 웹훅 발동
3. 확인: cruisedot 재고 감소
   SELECT id, name, stock FROM Product
   WHERE productCode = '[상품코드]'
```

### 시나리오 3: 환불 → SMS flag 초기화
```
1. cruisedot: 예약 환불 처리
2. mabiz: Payment 웹훅 REFUNDED
3. 확인: Contact SMS flag 초기화
   SELECT id, smsDay0Sent, smsDay1Sent, smsDay2Sent, smsDay3Sent
   FROM Contact
   WHERE id = '[contact_id]'
   (모두 false여야 함)
```

---

## cruisedot Admin 체크리스트

- [ ] Webhook 관리자 계정으로 로그인
- [ ] 설정 → Webhooks 메뉴 이동
- [ ] "Inventory Sync" 웹훅 추가
  - URL: https://mabiz.vercel.app/api/webhooks/cruisedot-inventory
  - Secret: [발급된 Secret]
  - Events: sale.created, sale.updated, sale.refunded
- [ ] 웹훅 활성화 (Enable)
- [ ] 테스트 전송 (Test Send)
- [ ] Response 200 OK 확인
- [ ] Production 환경에서 재확인

---

## 트러블슈팅

**웹훅 실패 (500 Error)**
- Vercel 배포 완료 확인
- SECRET 값이 정확한지 확인
- Sentry 에러 로그 확인: https://sentry.io

**재고 미동기화**
- mabiz Contact.lastInventorySyncAt 확인
- cruisedot webhook 실행 로그 확인
- 웹훅 재전송 (Retry) 시도

**Contact 미생성**
- Payment 웹훅 실행 여부 확인
- Contact.bookingRef 조회
- mabiz 로그: `[CruisedotWebhook] Contact upsert`

---

**작성**: 2026-05-27 | **상태**: AWAITING CRUISEDOT ADMIN INPUT
