# 결제 취소/환불 알림 채널 최종 설계 - 요약

**작성일**: 2026-05-20  
**상태**: 설계 완료 (검토 + 사용자 질문 대기)

---

## 📊 최종 추천 답변

### 질문 1: 알림 대상과 확인 방법?

| 대상 | 찾는 방법 | 데이터 필드 | 필수도 |
|------|---------|-----------|-------|
| **담당 대리점장** | Contact.phone → Partner | Partner.phone, email | ⭐⭐⭐ |
| **담당 판매원** | AffiliateSale.agentId 또는 OrganizationMember(role=AGENT) | phone, email | ⭐⭐⭐ |
| **프리세일즈** | OrganizationMember(role=PRESALES) | email | ⭐⭐⭐ |

**→ 기본 로직**:
1. PayAppPayment.orderId 수신
2. Contact 찾기 (고객 전화번호)
3. Partner 또는 Agent 찾기
4. 각 채널로 발송

---

### 질문 2: 어떤 채널로 알림할 것?

#### ✅ **권장: SMS + 이메일 + 대시보드** (3채널)

| 채널 | 대상 | 장점 | 단점 | 우선순위 |
|------|------|------|------|---------|
| **SMS** | Partner Manager, Agent | 즉시 인지, 이미 인프라 있음 | 비용 70원/건, 전화번호 필수 | P0 |
| **이메일** | PreSales Team | 공식 기록, 상세 정보 | 느림 (5-30초), 수신 확인 불가 | P1 |
| **대시보드** | 전체 | 로그인 후 추적 | 실시간성 낮음, 비용 없음 | P0 |

#### 비용 추정
- SMS: 월 10-50건 × 70원 = 700-3,500원/월
- Email: 무료 (기존 인프라)
- 대시보드: 무료

#### 속도 비교
- SMS: **2초** (즉시)
- 대시보드: **2초** (즉시, DB 기록)
- Email: **5-30초** (SMTP 처리)

---

### 질문 3: 알림 메시지 예시

#### SMS (최대 90자 = LMS 영역)
```
[크루즈닷] ❌ 취소
고객: 김고객
상품: 크루즈 여행
금액: ₩600,000
수당: -₩18,000
담당: CRM
```
**길이**: 약 75자 (SMS) / 85자 (LMS)

#### 이메일 (HTML)
```
제목: [중요] 2026-05-20 결제 취소 안내 - 김고객 (₩600,000)

본문:
고객명: 김고객
상품명: 크루즈 여행
취소금액: ₩600,000 (빨강, 굵음)
수당 차감: -₩18,000
처리일시: 2026-05-20 10:30:45
```

#### 대시보드 (AdminNotification)
```json
{
  "notificationType": "PAYMENT_CANCELLED",
  "title": "❌ 결제 취소: 김고객 - 크루즈 여행",
  "content": "금액 ₩600,000 | 수당 -₩18,000 | 2026-05-20 10:30:45"
}
```

---

## 🔍 기존 코드 분석 결과

### 이미 있는 인프라 ✅
- **SMS**: `src/lib/aligo.ts` (sendSms, resolveUserSmsConfig)
  - 개인 알리고 설정 지원
  - 야간 차단, 수신거부 관리 완료
  - 이미 여러 곳에서 사용 중

- **Email**: `src/lib/email.ts` (sendFunnelEmail)
  - SMTP 설정 완료 (OrgEmailConfig)
  - HTML 템플릿 지원

- **대시보드 알림**: `prisma/schema.prisma` AdminNotification
  - 모델 정의되었으나 **미사용**

### 부족한 부분 ⚠️
- PayApp 웹훅에 **알림 로직이 없음**
  - `src/app/api/webhooks/payapp/route.ts` (221-247줄)
  - 결제 상태만 업데이트, 알림 없음

- Partner 모델에 **phone, email이 Optional**
  - 필수 입력 필드 변경 권장

---

## 📝 구현 계획 (P0)

### Phase 1: 신규 파일 (4시간)
```
신규: src/lib/refund-notifier.ts (400줄)
├─ notifyRefund() 메인 함수
├─ findPartnerManager() 조회
├─ sendPartnerSms() SMS 발송
├─ sendPreSalesEmail() 이메일 발송
└─ createAdminNotifications() 대시보드 알림
```

### Phase 2: 기존 파일 수정 (1시간)
```
수정: src/app/api/webhooks/payapp/route.ts
├─ 221-247줄: cancelled 상태에 notifyRefund() 호출
├─ 249-278줄: partial_refunded 상태에 notifyRefund() 호출
└─ 에러 핸들링 (non-blocking)
```

### Phase 3: 테스트 (1시간)
```
신규: src/app/api/webhooks/payapp/__tests__/refund-notification.test.ts
├─ Partner Manager 찾기
├─ SMS 발송
├─ Email 발송
└─ AdminNotification 생성
```

**총 예상 시간**: 6-7시간

---

## ❓ 사용자 질문 (최종 확인용)

### Q1: SMS는 모든 Partner/Agent가 전화번호를 입력했나요?
- ✅ 현황 파악 필요
- Partner 테이블에서 phone = NULL 건수 조회 권장
- 현재 비용 추정: 월 10-50건 × 70원

### Q2: 이메일은 PreSales만 받거나 Partner도 받을까요?
- 권장: **PreSales만 (공식 기록용)**
- 선택: Partner도 함께 받기 (비용 증가, 정보 중복)
- 설정: 환경변수 `REFUND_EMAIL_PARTNER=true` 로 제어

### Q3: 대시보드 알림은 필수인가요?
- 권장: **필수** (SMS + Email과 동시 기록)
- 로그인한 사용자만 볼 수 있음 → 보안
- 비용 없음

### Q4: 환불/취소 수당 계산 규칙은?
- 현재: `amount × 3%` (고정)
- 실제: **Commission tier별로 다를까요?**
- Partner별로 다른 rate 지정 필요? (Partner.commissionRate 활용)

---

## 🚀 배포 체크리스트

### 사전 준비 (P0)
- [ ] Partner 테이블 phone/email 필드 현황 파악
  ```sql
  SELECT COUNT(*) as total,
         COUNT(CASE WHEN phone IS NULL THEN 1 END) as no_phone,
         COUNT(CASE WHEN email IS NULL THEN 1 END) as no_email
  FROM "Partner";
  ```

- [ ] OrganizationMember(role=PRESALES) 목록 확인
  ```sql
  SELECT COUNT(*), COUNT(DISTINCT email) 
  FROM "OrganizationMember" 
  WHERE role = 'PRESALES' AND isActive = true;
  ```

### 코드 배포 (P0)
- [ ] refund-notifier.ts 구현 + 테스트
- [ ] payapp/route.ts 수정 + 테스트
- [ ] staging 환경에서 테스트 결제 → 취소
- [ ] SMS/Email 수신 확인

### 운영 관련 (P1)
- [ ] Aligo 비용 모니터링 (대시보드 또는 월별 집계)
- [ ] Partner/PreSales 연락처 정기 확인
- [ ] 알림 실패 로그 모니터링

---

## 📊 향후 개선 사항 (P2/P3)

| 우선순위 | 기능 | 설명 |
|---------|------|------|
| P2 | 환불 계산 자동화 | 3% 고정 → Partner별 tier 적용 |
| P2 | 카카오 알림톡 | SMS 대신 카카오톡으로 발송 |
| P2 | Slack 알림 | 내부 운영팀 알림 |
| P3 | 알림 이력 추적 | RefundNotificationLog 테이블 |
| P3 | 사용자 설정 | Partner가 알림 채널 선택 가능 |

---

## 📚 참고 문서

| 문서 | 내용 |
|------|------|
| **REFUND_NOTIFICATION_DESIGN.md** | 전체 설계 + 데이터 흐름도 |
| **P2_REFUND_NOTIFICATION_IMPLEMENTATION.md** | 코드 예제 + 테스트 케이스 |
| **src/lib/aligo.ts** | 기존 SMS 구현 참고 |
| **src/lib/email.ts** | 기존 Email 구현 참고 |
| **src/app/api/webhooks/payapp/route.ts** | PayApp 웹훅 (221-278줄) |

---

## 최종 결론

### 🎯 한 문장 요약
> **결제 취소/환불 시 Partner Manager + Agent에게 SMS로 즉시 알림, PreSales 팀에게 이메일로 공식 기록, 대시보드에서도 추적 가능하게 3채널 통합 알림 시스템 구축**

### ✅ 실행 가능성
- 기존 인프라(SMS/Email) 100% 활용 가능
- 신규 구현 파일: refund-notifier.ts만 (400줄)
- 기존 파일 수정: payapp/route.ts (약 40줄 추가)
- 예상 시간: 6-7시간 (P0 우선순위)

### 📞 다음 단계
1. 사용자 최종 확인 (Q1-Q4)
2. Partner 연락처 현황 파악
3. 코드 구현 시작

---

**결정 필요**: 위의 Q1-Q4를 초등학생 수준으로 확인 받고 구현 시작!
