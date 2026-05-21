# 결제 취소/환불 알림 채널 설계

**작성일**: 2026-05-20  
**상태**: 설계 완료 (구현 대기)

---

## 1. 알림 대상 및 확인 방법

### 1.1 대상자 식별 로직

#### a) **담당 대리점장 (Partner Manager)**
```
PayAppPayment.orderId 또는 mulNo 기반
→ Contact 조회 → Phone로 Partner 확인
→ Partner.email, Partner.phone

OR

B2B 고객이면:
→ AffiliateSale.managerId (OWNER) 확인
→ AffiliateProfile.userId 확인
→ User.email, AffiliateProfile.displayName
```

**현재 코드 위치**: `src/app/api/webhooks/payapp/route.ts` (221-247)

#### b) **담당 판매원 (Agent)**
```
AffiliateSale.agentId → AffiliateProfile → User
또는 OrganizationMember (role='AGENT', organizationId=orgId)
→ OrganizationMember.phone, OrganizationMember.email
```

#### c) **프리세일즈 팀 (PreSales)**
```
OrganizationMember (role='PRESALES', organizationId=orgId)
→ 전체 이메일 리스트 + 전화번호
```

**현재 데이터 모델**:
- `Partner`: id, organizationId, name, email?, phone?
- `OrganizationMember`: id, organizationId, userId, phone?, email?, role, displayName
- `OrgEmailConfig`: organizationId, senderEmail, senderName, SMTP 설정
- `AdminNotification`: userId, notificationType, title, content (미사용 상태)

---

## 2. 추천 알림 채널 조합

### 2.1 최적화 전략 (속도 + 신뢰도)

| 대상자 | 채널 | 이유 | 우선순위 |
|--------|------|------|---------|
| **대리점장** | SMS + 대시보드 | 빠른 인지 + 동시 기록 | P0 |
| **판매원** | SMS + 대시보드 | 빠른 인지 + 동시 기록 | P0 |
| **프리세일즈** | 이메일 | 공식 기록 + 일괄 처리 | P1 |

### 2.2 채널별 장단점

#### SMS (Aligo) - **권장**
```
장점:
  ✓ 가장 빠름 (즉시 인지)
  ✓ 이미 인프라 구축됨 (src/lib/aligo.ts)
  ✓ 개인 알리고 설정 지원 (resolveUserSmsConfig)
  ✓ 야간 차단, 수신거부 관리 구현 완료
  
단점:
  ✗ 비용 발생 (건당 약 50-100원)
  ✗ 장문 불가 (LMS 사용 시 2배 비용)
  ✗ 전화번호 필수
  
추천:
  - OWNER/AGENT: phone 필드 필수 입력 요구
  - Partner: phone 필드 필수 입력 요구
  - PreSales: 이메일 우선, 전화번호 있으면 추가 SMS
```

#### 이메일 (SMTP) - **공식 기록용**
```
장점:
  ✓ 상세 정보 전달 가능
  ✓ 법적 증거 (기록 유지)
  ✓ 이미 인프라 (src/lib/email.ts + OrgEmailConfig)
  ✓ 장문 HTML 지원
  
단점:
  ✗ 느림 (스팸 필터링 포함)
  ✗ 수신 확인 불가
  
추천:
  - PreSales에만 사용
  - Partner/Agent: 보조 채널
```

#### 대시보드 알림 (AdminNotification) - **보조**
```
장점:
  ✓ 로그인한 사용자만 볼 수 있음
  ✓ 관리자 인터페이스에서 추적 가능
  ✓ 비용 없음
  
단점:
  ✗ 로그인한 사용자만 인지
  ✗ 실시간성 부족
  
추천:
  - SMS/Email와 병행 (중복 기록)
  - 다시 보기 목적
```

---

## 3. 알림 메시지 템플릿

### 3.1 SMS 템플릿 (최대 85자 = LMS 140자)

#### 결제 취소 (Cancelled)
```
[크루즈닷] ⚠️ 결제 취소 안내
고객 ${customerName}의 ${productName} 결제가 취소되었습니다.
금액: ${price.toLocaleString()}원
수당 즉시 취소됨 | 담당자: 크루즈닷CRM
```
**길이**: 약 75자 (SMS) / 85자 이상 (LMS)

#### 환불 완료 (Partial Refunded)
```
[크루즈닷] 💰 부분환불 안내
고객 ${customerName} | 환불액: ${refundAmount.toLocaleString()}원
수당 차감: ${(refundAmount * 0.03).toLocaleString()}원 | 기준률 3%
```
**길이**: 약 70자 (SMS)

### 3.2 이메일 템플릿

#### 제목
```
[중요] ${date} 결제 취소 / 환불 통지 - 금액: ${amount.toLocaleString()}원
```

#### 본문 (HTML)
```html
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #d32f2f;">결제 취소 안내</h2>
  
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background-color: #f5f5f5;">
      <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">고객명</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${customerName}</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">상품명</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${productName}</td>
    </tr>
    <tr style="background-color: #f5f5f5;">
      <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">결제금액</td>
      <td style="padding: 10px; border: 1px solid #ddd; color: #d32f2f; font-size: 16px;">
        ₩${price.toLocaleString()}
      </td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">수당 변동</td>
      <td style="padding: 10px; border: 1px solid #ddd; color: #d32f2f;">
        -₩${commission.toLocaleString()} (즉시 취소)
      </td>
    </tr>
    <tr style="background-color: #f5f5f5;">
      <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">처리 날짜</td>
      <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleString('ko-KR')}</td>
    </tr>
  </table>
  
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    이 메일은 자동 발송되었습니다. 문의사항은 CRM 담당자에게 연락주세요.
  </p>
</div>
```

### 3.3 대시보드 알림 (AdminNotification)
```json
{
  "userId": "OWNER 또는 AGENT의 userId",
  "notificationType": "PAYMENT_CANCELLED|PAYMENT_REFUNDED",
  "title": "결제 취소: [고객명] ${productName}",
  "content": "금액 ₩${price.toLocaleString()} | 수당 ₩${commission.toLocaleString()} 취소 | ${timestamp}"
}
```

---

## 4. 구현 로직 (PayApp 웹훅 기준)

### 4.1 현재 상황
**파일**: `src/app/api/webhooks/payapp/route.ts`

```typescript
// 현재 취소 처리 (221-247줄)
if (status === "cancelled") {
  const canceldate = params.get("canceldate") ?? "";
  const cancelmemo = params.get("cancelmemo") ?? "";

  if (orderId) {
    await prisma.payAppPayment.updateMany({
      where: { orderId, status: { not: "cancelled" } },
      data: {
        status: "cancelled",
        refundedAt: canceldate ? new Date(canceldate) : new Date(),
        refundReason: cancelmemo || "PayApp 취소",
      },
    });
  }
  // ❌ 알림 로직 없음!
}
```

### 4.2 추가할 알림 함수 (신규)

```typescript
// src/lib/refund-notifier.ts (신규 파일)

interface RefundNotificationParams {
  organizationId: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  amount: number;
  commission: number;
  refundReason: string;
  type: 'CANCELLED' | 'PARTIAL_REFUNDED';
}

export async function notifyRefund(params: RefundNotificationParams) {
  const {
    organizationId,
    orderId,
    customerName,
    customerPhone,
    productName,
    amount,
    commission,
    refundReason,
    type,
  } = params;

  // 1️⃣ Contact 기반 Partner 찾기
  const contact = await prisma.contact.findFirst({
    where: { phone: customerPhone, organizationId },
    include: { partner: true },
  });
  
  const partnerManager = contact?.partner;

  // 2️⃣ B2B: AffiliateSale 기반 OWNER/AGENT 찾기
  // (필요시 별도 로직)

  // 3️⃣ PreSales 팀 조회
  const preSalesTeam = await prisma.organizationMember.findMany({
    where: { organizationId, role: 'PRESALES', isActive: true },
  });

  // 4️⃣ SMS 발송 (Partner 매니저)
  if (partnerManager?.phone) {
    await sendPartnerSms({
      phone: partnerManager.phone,
      customerName,
      productName,
      amount,
      commission,
      type,
    });
  }

  // 5️⃣ SMS 발송 (Agent)
  // (추가 로직)

  // 6️⃣ 이메일 발송 (PreSales)
  for (const member of preSalesTeam) {
    if (member.email) {
      await sendPreSalesEmail({
        to: member.email,
        toName: member.displayName,
        customerName,
        productName,
        amount,
        commission,
        type,
        refundReason,
      });
    }
  }

  // 7️⃣ 대시보드 알림
  await createAdminNotifications({
    organizationId,
    partnerManager,
    preSalesTeam,
    customerName,
    productName,
    amount,
    type,
  });
}
```

### 4.3 PayApp 웹훅 수정 (기존 파일)

```typescript
// src/app/api/webhooks/payapp/route.ts (221-247줄 추가)

if (status === "cancelled") {
  const canceldate = params.get("canceldate") ?? "";
  const cancelmemo = params.get("cancelmemo") ?? "";

  let originalPayment = null;
  
  if (orderId) {
    originalPayment = await prisma.payAppPayment.findUnique({
      where: { orderId },
      select: { 
        amount: true, 
        customerName: true, 
        customerPhone: true,
        productName: true,
      },
    });

    await prisma.payAppPayment.updateMany({
      where: { orderId, status: { not: "cancelled" } },
      data: {
        status: "cancelled",
        refundedAt: canceldate ? new Date(canceldate) : new Date(),
        refundReason: cancelmemo || "PayApp 취소",
      },
    });
  } else if (mulNo) {
    originalPayment = await prisma.payAppPayment.findFirst({
      where: { mulNo },
      select: {
        amount: true,
        customerName: true,
        customerPhone: true,
        productName: true,
        organizationId: true,
      },
    });
    // ... updateMany
  }

  // ✅ 알림 발송 (신규 추가)
  if (originalPayment && orgId && originalPayment.customerPhone) {
    const { notifyRefund } = await import("@/lib/refund-notifier");
    
    try {
      await notifyRefund({
        organizationId: orgId,
        orderId: orderId || `mul_${mulNo}`,
        customerName: originalPayment.customerName || "미확인",
        customerPhone: originalPayment.customerPhone,
        productName: originalPayment.productName || "상품",
        amount: originalPayment.amount,
        commission: Math.round(originalPayment.amount * 0.03), // 3% 기본
        refundReason: cancelmemo || "PayApp 취소",
        type: 'CANCELLED',
      });
    } catch (err) {
      logger.error("[PayApp Webhook] 취소 알림 발송 실패", { err });
    }
  }

  logger.log("[PayApp Webhook] 취소 처리", { orderId, mulNo, cancelmemo });
  return new Response("SUCCESS");
}
```

---

## 5. 구현 체크리스트 (우선순위)

### Phase 1 (P0 - 필수)
- [ ] **refund-notifier.ts** 신규 생성
  - [ ] SMS 발송 함수 (Aligo 통합)
  - [ ] Partner/Agent 조회 로직
  - [ ] 메시지 템플릿
  
- [ ] **payapp/route.ts** 수정
  - [ ] cancelled 상태 알림 통합
  - [ ] partial_refunded 상태 알림 통합
  - [ ] 에러 핸들링

### Phase 2 (P1 - 권장)
- [ ] **이메일 알림** 구현
  - [ ] OrgEmailConfig 기반 SMTP 설정
  - [ ] PreSales 팀 이메일 발송
  - [ ] HTML 템플릿

- [ ] **대시보드 알림** 구현
  - [ ] AdminNotification 테이블 활용
  - [ ] CRM 대시보드에서 보기

### Phase 3 (P2 - 선택)
- [ ] **카카오 알림톡** 대체 (알리고 미지원 시)
- [ ] **문자 발송 로그** (SmsLog 테이블에 기록)
- [ ] **재시도 로직** (DLQ 연동)

---

## 6. 데이터 흐름도

```
PayApp Webhook (결제 취소)
    ↓
payapp/route.ts (cancelled 감지)
    ↓
[현재] PayAppPayment 상태 업데이트 (status='cancelled')
    ↓
[신규] notifyRefund() 호출
    ├─→ Contact 조회 → Partner 찾기
    ├─→ SMS (Aligo)
    │   ├─→ Partner 매니저
    │   ├─→ Agent
    │   └─→ PreSales (있으면)
    ├─→ Email (SMTP)
    │   └─→ PreSales 팀 (공식 기록)
    └─→ AdminNotification 생성
        ├─→ Partner Manager
        ├─→ Agent
        └─→ PreSales

결과: SMS(즉시) + Email(기록) + 대시보드(추적)
```

---

## 7. 필수 데이터 필드 검증

### 7.1 현재 부족한 필드

| 모델 | 필드 | 상태 | 해결책 |
|------|------|------|--------|
| `Partner` | phone | ❌ NULL 허용 | 필수 입력 UX 추가 |
| `Partner` | email | ❌ NULL 허용 | 필수 입력 UX 추가 |
| `OrganizationMember` | phone | ❌ NULL 허용 | AGENT/PRESALES 필수 |
| `OrganizationMember` | email | ⚠️ Optional | 모두 필수로 변경 권장 |
| `PayAppPayment` | organizationId | ✅ 있음 | - |
| `Contact` | partnerId | ✅ 있음 | - |

### 7.2 마이그레이션 필요 (선택)

```sql
-- Partner.phone, email 필수화 (향후)
ALTER TABLE "Partner" ALTER COLUMN "phone" SET NOT NULL;
ALTER TABLE "Partner" ALTER COLUMN "email" SET NOT NULL;

-- OrganizationMember.email 필수화 (향후)
UPDATE "OrganizationMember" 
SET email = CONCAT(id, '@placeholder.local') 
WHERE email IS NULL AND role IN ('PRESALES', 'AGENT');

ALTER TABLE "OrganizationMember" 
  ALTER COLUMN "email" SET NOT NULL 
  WHERE role IN ('PRESALES', 'AGENT');
```

---

## 8. 결론 및 최종 권장안

### ✅ 최적 조합: **SMS + 대시보드 + 이메일**

| 단계 | 채널 | 대상 | 우선순위 | 지연 |
|------|------|------|---------|------|
| 1️⃣ | SMS | Partner/Agent | P0 | 즉시 (2초) |
| 2️⃣ | 대시보드 | Partner/Agent/PreSales | P0 | 즉시 |
| 3️⃣ | Email | PreSales (공식 기록) | P1 | 5-30초 |

**장점**:
- SMS: 빠른 인지 + 현장 반응
- 대시보드: 로그인 후 추적 가능
- Email: 법적 증거 + 공식 문서

**비용**:
- SMS: 건당 약 70원 × 대리점 수
- Email: 무료 (이미 설정됨)
- 대시보드: 무료

**구현 기간**:
- Phase 1 (P0): 4-6시간
- Phase 2 (P1): 2-3시간
- 총 6-9시간

---

## 9. 다음 단계

1. **사용자 피드백** (초등학생 수준 질문)
   - Q1: SMS는 모든 Partner/Agent가 전화번호를 입력했나요?
   - Q2: 이메일은 PreSales만 받거나 Partner도 받을까요?
   - Q3: 대시보드 알림은 필수인가요, 아니면 SMS/Email만 충분한가요?

2. **마이그레이션 작업**
   - Partner.phone, email 필수 입력 레이어 추가
   - OrganizationMember.phone 필수 검증

3. **구현 시작**
   - Phase 1: refund-notifier.ts + SMS 로직
   - Phase 2: Email 템플릿 + 대시보드
   - Phase 3: 테스트 + 배포

---

## 참고 자료

- 현재 Aligo SMS 구현: `src/lib/aligo.ts` (sendSms, resolveUserSmsConfig)
- 현재 Email 구현: `src/lib/email.ts` (sendFunnelEmail)
- PayApp 웹훅: `src/app/api/webhooks/payapp/route.ts`
- Prisma 스키마: `prisma/schema.prisma`
- 환불 API: `src/app/api/affiliate-sales/[id]/refund/route.ts` (기존 구조 참고)
