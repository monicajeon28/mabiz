# 작업지시서: 페이앱 B2B 결제 시스템 완성

> 작성일: 2026-05-11
> 근거: 페이앱 연동 API 문서(oapi-0043) + 코드 분석 + 사용자 설계 결정
> 상태: **승인 완료**

---

## 확정 설계

| 항목 | 결정 |
|------|------|
| 기능 범위 | 일반결제 + 취소/환불 + FeedbackURL + 정기결제(월) + 현금영수증 자동 |
| DB | PayAppPayment 9필드+metadata 추가 + PayAppSubscription 신규 |
| FeedbackURL | `/api/webhooks/payapp` 하나로 통합 |
| 현금영수증 | 결제 완료 시 자동 (카드 결제 제외) |
| 정기결제 | 월 결제, 별도 테이블 |
| 랜딩페이지 | 결제 설정에서 일반/정기 선택 가능 |

---

## Phase A — DB 스키마 + 라이브러리

### A-1. PayAppPayment 스키마 확장
```prisma
model PayAppPayment {
  // 기존 필드 유지
  id            String    @id @default(cuid())
  orderId       String    @unique
  amount        Int
  customerName  String
  customerPhone String
  status        String    @default("pending")
  landingPageId String?
  paidAt        DateTime?
  createdAt     DateTime  @default(now())

  // 신규 필드 9개 + metadata
  productName   String?
  customerEmail String?
  mulNo         String?   // PayApp 결제요청번호
  payType       String?   // 결제수단 (1=카드,2=휴대폰,7=가상계좌 등)
  cardName      String?   // 카드명
  cstUrl        String?   // 매출전표 URL
  refundedAt    DateTime?
  refundAmount  Int       @default(0)
  refundReason  String?
  metadata      Json?     // 부분환불 이력, 커스텀 데이터

  // 정기결제 연결
  subscriptionId String?
  subscription   PayAppSubscription? @relation(fields: [subscriptionId], references: [id])
}
```

### A-2. PayAppSubscription 신규 테이블
```prisma
model PayAppSubscription {
  id              String    @id @default(cuid())
  organizationId  String
  rebillNo        String    @unique   // PayApp 정기결제 등록번호
  goodname        String              // 상품명
  goodprice       Int                 // 정기결제 금액
  customerName    String
  customerPhone   String
  customerEmail   String?
  cycleDay        Int       @default(1)  // 매월 결제일 (1~31, 90=말일)
  expireDate      DateTime             // 만료일
  status          String    @default("pending") // pending/active/paused/cancelled
  payUrl          String?              // 최초 결제 URL
  landingPageId   String?
  feedbackUrl     String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  payments        PayAppPayment[]
}
```

### A-3. lib/payapp.ts 라이브러리
- payappApiPost() — REST API 호출
- requestPayment() — 일반 결제 요청
- cancelPayment() — 결제 취소 (전체/부분)
- requestCancelAfterSettlement() — D+5 이후 취소 요청
- validateFeedback() — linkval 검증
- requestSubscription() — 정기결제 등록
- cancelSubscription() — 정기결제 해지
- pauseSubscription() — 정기결제 일시정지
- resumeSubscription() — 정기결제 승인(재시작)
- issueCashReceipt() — 현금영수증 발행
- cancelCashReceipt() — 현금영수증 취소

---

## Phase B — API 엔드포인트

### B-1. 결제 요청 API
`POST /api/payapp/request`
- 일반결제 + 정기결제 분기
- PayAppPayment 또는 PayAppSubscription 생성
- PayApp API 호출 → payurl 반환

### B-2. FeedbackURL 통합 웹훅
`POST /api/webhooks/payapp` (기존 파일 리팩토링)
- pay_state별 분기:
  - 4: 결제완료 → PayAppPayment 업데이트 + Contact 생성 + 현금영수증 자동
  - 8/16/32: 요청취소
  - 9/64: 승인취소
  - 10: 결제대기(가상계좌)
  - 70/71: 부분취소
- linkval 검증 필수
- mul_no + var1 중복 방지
- SUCCESS 응답

### B-3. 환불 API
`POST /api/payapp/refund`
- 전체/부분 환불 지원
- PayApp paycancel API 호출
- PayAppPayment 상태 업데이트
- 부분환불 이력 metadata에 기록

### B-4. 정기결제 관리 API
`POST /api/payapp/subscription` — 등록
`DELETE /api/payapp/subscription/[id]` — 해지
`PATCH /api/payapp/subscription/[id]` — 일시정지/재시작

### B-5. 현금영수증 API
`POST /api/payapp/cash-receipt` — 수동 발행 (자동 외 추가 필요시)

---

## Phase C — 랜딩페이지 결제 설정 연동
- 랜딩페이지 생성/편집에서 결제 유형 선택: 일반/정기
- 정기결제 선택 시 주기일/만료일/금액 설정 UI
- LandingPaymentButton에서 결제 유형에 따라 다른 API 호출

---

## 절대 금지
- 크루즈닷몰 공유 테이블(AffiliateSale, Payment 등) 수정 금지
- PayApp linkkey/linkval 코드/응답에 노출 금지
- push/deploy 금지 — 커밋까지만
