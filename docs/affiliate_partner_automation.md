# Affiliate Partner Automation Framework (2026-05-26)

## 1. 개요: 완전 자동화 파이프라인

Partner Commission 계산부터 지급, 성과 리포팅까지 전체 과정을 자동화합니다.

### 1.1 자동화 범위

```
Contact 구매 (구매금액 $3,000)
    ↓
1️⃣ Commission 자동 계산
   └─ Partner Tier 조회 (Top: 15%, Std: 12%, Growth: 8%)
   └─ Product Type 확인 (Cruise, Hotel, Tour, Activity)
   └─ Commission 금액: $3,000 × 12% = $360
   └─ CommissionLedger 생성 (Status: PENDING)
    ↓
2️⃣ Commission 검증 (24시간)
   └─ 금액 & 날짜 검증
   └─ Contact-Partner 링크 확인
   └─ 중복 검사
   └─ Status: APPROVED
    ↓
3️⃣ 자동 지급 (매월 15일)
   └─ 누적 Commission 계산
   └─ 은행 계좌 확인
   └─ 세금(원천징수) 계산
   └─ 송금 (Status: PAID)
    ↓
4️⃣ 성과 리포팅 (매월 1일)
   └─ 월간 성과 메일 발송
   └─ PDF 리포팅 자동 생성
   └─ Dashboard 업데이트
    ↓
5️⃣ 인센티브 & 보너스 (분기별 & 특별)
   └─ Tier별 성과급 계산
   └─ 목표 달성 보너스 자동 지급
   └─ Tier Up 축하금
    ↓
6️⃣ 파트너 커뮤니케이션 (자동)
   └─ 매일: SMS로 당일 수익 알림
   └─ 주간: 주간 성과 요약 (Slack/WhatsApp)
   └─ 월간: 성과 리포팅 + 다음 달 목표
   └─ 분기: 인센티브 지급 + CEO 메시지
```

---

## 2. API 4개: 자동화 핵심 엔진

### 2.1 API #1: Commission 자동 계산

**엔드포인트**: `POST /api/affiliates/calculate-commission`

```typescript
interface CalculateCommissionRequest {
  contactId: string;
  saleAmount: number;
  productType: "cruise" | "hotel" | "tour" | "activity";
  saleDate: DateTime;
  paymentMethod?: "card" | "bank_transfer" | "cash";
  
  // Optional: 특별 commission override
  overrideCommissionRate?: number; // %, null이면 기본값 사용
  overrideReason?: string; // "negotiated", "promotion", "special_offer"
}

interface CalculateCommissionResponse {
  id: string; // CommissionLedger ID
  partnerId: string;
  contactId: string;
  saleAmount: number;
  commissionRate: number; // %
  commissionAmount: number;
  
  // 계산 상세
  tier: "TOP" | "STANDARD" | "GROWTH";
  attributionModel: "last_touch" | "time_decay" | "data_driven";
  attributionWeight: number; // 0-1 (multi-touch인 경우)
  
  // 세금 정보
  taxRate: number; // % (국가별로 다름, 한국 3.3%)
  taxAmount: number;
  netAmount: number; // = commissionAmount - taxAmount
  
  status: "PENDING" | "APPROVED" | "PAID" | "REJECTED";
  approvedAt?: DateTime;
  paidAt?: DateTime;
  rejectionReason?: string;
  
  createdAt: DateTime;
}

// 사용 예시
const response = await fetch('/api/affiliates/calculate-commission', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contactId: 'cont_abc123',
    saleAmount: 3000,
    productType: 'cruise',
    saleDate: new Date(),
    paymentMethod: 'card'
  })
});

const { id, commissionAmount, taxAmount, netAmount } = await response.json();
// Response:
// {
//   id: 'comm_xyz789',
//   partnerId: 'partner_001',
//   contactId: 'cont_abc123',
//   saleAmount: 3000,
//   commissionRate: 12,
//   commissionAmount: 360,
//   tier: 'STANDARD',
//   attributionModel: 'last_touch',
//   attributionWeight: 1.0,
//   taxRate: 3.3,
//   taxAmount: 11.88,
//   netAmount: 348.12,
//   status: 'PENDING',
//   createdAt: '2026-05-26T10:30:00Z'
// }
```

**내부 로직**:

```typescript
async function calculateCommission(
  request: CalculateCommissionRequest
): Promise<CalculateCommissionResponse> {
  // 1. Contact & Partner 조회
  const contact = await Contact.findOne({ id: request.contactId });
  const partner = await Partner.findOne({ id: contact.partnerId });
  
  if (!partner) throw new Error("Partner not found");
  
  // 2. Commission Rate 결정
  let commissionRate = getBaseCommissionRate(partner.tier, request.productType);
  if (request.overrideCommissionRate) {
    commissionRate = request.overrideCommissionRate;
  }
  
  // 3. 특수 할인 적용 (분기 프로모션 등)
  const specialOffer = await getSpecialOfferForPartner(partner.id);
  if (specialOffer?.isActive) {
    commissionRate *= (1 + specialOffer.boostPercent / 100);
  }
  
  // 4. Commission 금액 계산
  const commissionAmount = request.saleAmount * commissionRate / 100;
  
  // 5. 세금 계산 (한국: 3.3% 원천징수)
  const taxRate = getTaxRateByCountry(partner.country) || 3.3; // %
  const taxAmount = commissionAmount * taxRate / 100;
  const netAmount = commissionAmount - taxAmount;
  
  // 6. CommissionLedger 생성
  const ledger = await CommissionLedger.create({
    partnerId: partner.id,
    contactId: request.contactId,
    saleAmount: request.saleAmount,
    commissionRate,
    commissionAmount,
    attributionModel: 'last_touch', // or calculated
    attributionWeight: 1.0,
    taxRate,
    taxAmount,
    netAmount,
    status: 'PENDING',
    createdAt: new Date(),
    approvedAt: null,
    paidAt: null
  });
  
  // 7. Partner 통계 업데이트
  const month = request.saleDate.getMonth() + 1;
  const year = request.saleDate.getFullYear();
  await PartnerMetrics.updateOrCreate(
    { partnerId: partner.id, year, month },
    { revenue: { $inc: commissionAmount } }
  );
  
  // 8. 자동 승인 (검증 완료 시)
  setTimeout(() => autoApproveCommission(ledger.id), 24 * 3600 * 1000); // 24시간
  
  return {
    id: ledger.id,
    partnerId: partner.id,
    contactId: request.contactId,
    saleAmount: request.saleAmount,
    commissionRate,
    commissionAmount,
    tier: partner.tier,
    attributionModel: 'last_touch',
    attributionWeight: 1.0,
    taxRate,
    taxAmount,
    netAmount,
    status: 'PENDING',
    createdAt: ledger.createdAt
  };
}
```

---

### 2.2 API #2: Commission 자동 지급

**엔드포인트**: `POST /api/affiliates/pay-commissions`

```typescript
interface PayCommissionsRequest {
  partnerId?: string; // 특정 파트너만 지급, null이면 전체
  paymentMethod: 'bank_transfer' | 'check' | 'paypal' | 'crypto';
  forcePaymentDate?: DateTime; // 기본값: 현재 날짜
}

interface PayCommissionsResponse {
  totalPartners: number;
  totalAmount: number;
  totalTax: number;
  totalNet: number;
  payments: {
    partnerId: string;
    partnerName: string;
    commissionAmount: number;
    taxAmount: number;
    netAmount: number;
    bankAccount: string;
    transactionId: string;
    status: 'SENT' | 'FAILED' | 'PENDING';
    errorMessage?: string;
  }[];
  summary: {
    successCount: number;
    failureCount: number;
    totalDuration: number; // ms
  };
}

// 사용 예시
const response = await fetch('/api/affiliates/pay-commissions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentMethod: 'bank_transfer',
    // partnerId 없으면 모든 활성 파트너
  })
});

const { totalPartners, totalAmount, payments, summary } = await response.json();
// Response:
// {
//   totalPartners: 145,
//   totalAmount: 48200,
//   totalTax: 1590,
//   totalNet: 46610,
//   payments: [
//     {
//       partnerId: 'partner_001',
//       partnerName: 'John Doe',
//       commissionAmount: 360,
//       taxAmount: 11.88,
//       netAmount: 348.12,
//       bankAccount: '****4532',
//       transactionId: 'TXN-2026-05-15-001',
//       status: 'SENT'
//     },
//     ...
//   ],
//   summary: {
//     successCount: 144,
//     failureCount: 1,
//     totalDuration: 3450
//   }
// }
```

**내부 로직**:

```typescript
async function payCommissions(
  request: PayCommissionsRequest
): Promise<PayCommissionsResponse> {
  // 1. 지급 대상 Commission 조회 (APPROVED 상태)
  const conditions = {
    status: 'APPROVED',
    paidAt: null
  };
  
  if (request.partnerId) {
    conditions.partnerId = request.partnerId;
  }
  
  const commissions = await CommissionLedger.find(conditions);
  
  // 2. Partner별로 그룹화
  const byPartner = new Map();
  for (const comm of commissions) {
    if (!byPartner.has(comm.partnerId)) {
      byPartner.set(comm.partnerId, []);
    }
    byPartner.get(comm.partnerId).push(comm);
  }
  
  // 3. 각 Partner에게 지급
  const payments = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (const [partnerId, partnerCommissions] of byPartner) {
    const partner = await Partner.findOne({ id: partnerId });
    
    // 3.1 총액 계산
    const totalNet = partnerCommissions.reduce((sum, c) => sum + c.netAmount, 0);
    
    // 3.2 은행 계좌 확인
    if (!partner.bankAccount) {
      payments.push({
        partnerId,
        partnerName: partner.displayName,
        commissionAmount: 0,
        taxAmount: 0,
        netAmount: 0,
        bankAccount: 'N/A',
        transactionId: null,
        status: 'FAILED',
        errorMessage: 'No bank account on file'
      });
      failureCount++;
      continue;
    }
    
    // 3.3 송금 실행 (banking API 연동)
    let transactionId = null;
    let status = 'SENT';
    let errorMessage = null;
    
    try {
      transactionId = await processBankTransfer({
        toAccount: partner.bankAccount,
        amount: totalNet,
        description: `Mabiz Affiliate Commission - ${partner.displayName}`
      });
      
      // 3.4 CommissionLedger 업데이트
      await CommissionLedger.updateMany(
        { id: { $in: partnerCommissions.map(c => c.id) } },
        {
          status: 'PAID',
          paidAt: request.forcePaymentDate || new Date(),
          transactionId
        }
      );
      
      successCount++;
    } catch (err) {
      status = 'FAILED';
      errorMessage = err.message;
      failureCount++;
    }
    
    payments.push({
      partnerId,
      partnerName: partner.displayName,
      commissionAmount: partnerCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
      taxAmount: partnerCommissions.reduce((sum, c) => sum + c.taxAmount, 0),
      netAmount: totalNet,
      bankAccount: partner.bankAccount.slice(-4).padStart(8, '*'),
      transactionId,
      status,
      errorMessage
    });
  }
  
  // 4. 파트너에게 지급 알림 발송
  for (const payment of payments.filter(p => p.status === 'SENT')) {
    await sendPaymentNotification(payment);
  }
  
  return {
    totalPartners: byPartner.size,
    totalAmount: payments.reduce((sum, p) => sum + p.commissionAmount, 0),
    totalTax: payments.reduce((sum, p) => sum + p.taxAmount, 0),
    totalNet: payments.reduce((sum, p) => sum + p.netAmount, 0),
    payments,
    summary: {
      successCount,
      failureCount,
      totalDuration: Date.now() - startTime
    }
  };
}
```

---

### 2.3 API #3: 자동 성과 리포팅

**엔드포인트**: `POST /api/affiliates/generate-report`

```typescript
interface GenerateReportRequest {
  partnerId?: string; // null이면 모든 파트너
  reportType: 'monthly' | 'quarterly' | 'annual';
  yearMonth: string; // "2026-05"
  sendEmail: boolean; // 자동 발송 여부
}

interface GenerateReportResponse {
  reportId: string;
  partnerId: string;
  reportType: string;
  yearMonth: string;
  
  // KPI 데이터
  metrics: {
    totalContacts: number;
    conversions: number;
    conversionRate: number; // %
    totalRevenue: number;
    totalCommission: number;
    netCommission: number;
    averageTicket: number;
    ltv: number;
  };
  
  // 비교
  previousMonth?: {
    totalRevenue: number;
    conversionRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  
  // 목표 대비
  goalVsActual: {
    revenueGoal: number;
    revenueActual: number;
    revenueAchievementRate: number; // %
    conversionGoal: number;
    conversionActual: number;
  };
  
  // Tier 현황
  tierInfo: {
    currentTier: "TOP" | "STANDARD" | "GROWTH";
    tierScore: number;
    nextTierGap: number;
  };
  
  // 보너스/인센티브
  incentives: {
    baseCommission: number;
    performanceBonus?: number;
    tierBonus?: number;
    specialOffer?: number;
    total: number;
  };
  
  // PDF 레포트
  pdfUrl: string;
  reportGeneratedAt: DateTime;
  emailSentAt?: DateTime;
}

// 사용 예시
const response = await fetch('/api/affiliates/generate-report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reportType: 'monthly',
    yearMonth: '2026-05',
    sendEmail: true
  })
});

const { reportId, metrics, pdfUrl } = await response.json();
// Response:
// {
//   reportId: 'rpt_2026_05_001',
//   partnerId: 'partner_001',
//   reportType: 'monthly',
//   yearMonth: '2026-05',
//   metrics: {
//     totalContacts: 45,
//     conversions: 9,
//     conversionRate: 20,
//     totalRevenue: 27000,
//     totalCommission: 3240,
//     netCommission: 3130.56,
//     averageTicket: 3000,
//     ltv: 12000
//   },
//   previousMonth: {
//     totalRevenue: 24000,
//     conversionRate: 18,
//     trend: 'up'
//   },
//   goalVsActual: {
//     revenueGoal: 25000,
//     revenueActual: 27000,
//     revenueAchievementRate: 108,
//     conversionGoal: 8,
//     conversionActual: 9
//   },
//   tierInfo: {
//     currentTier: 'STANDARD',
//     tierScore: 58,
//     nextTierGap: 22
//   },
//   incentives: {
//     baseCommission: 3240,
//     performanceBonus: 270,
//     tierBonus: 0,
//     specialOffer: 0,
//     total: 3510
//   },
//   pdfUrl: 'https://cdn.mabiz.com/reports/2026-05/partner_001.pdf',
//   reportGeneratedAt: '2026-06-01T02:00:00Z',
//   emailSentAt: '2026-06-01T02:05:00Z'
// }
```

**내부 로직**:

```typescript
async function generateReport(
  request: GenerateReportRequest
): Promise<GenerateReportResponse> {
  // 1. 데이터 수집
  const metrics = await collectPartnerMetrics(
    request.partnerId,
    request.yearMonth
  );
  
  // 2. 비교 데이터 (이전 달)
  const previousMonth = await collectPartnerMetrics(
    request.partnerId,
    getPreviousMonth(request.yearMonth)
  );
  
  // 3. 목표 대비
  const goal = await getPartnerGoal(request.partnerId, request.yearMonth);
  const goalVsActual = {
    revenueGoal: goal.revenue,
    revenueActual: metrics.totalRevenue,
    revenueAchievementRate: (metrics.totalRevenue / goal.revenue) * 100,
    conversionGoal: goal.conversions,
    conversionActual: metrics.conversions
  };
  
  // 4. Tier 정보
  const partner = await Partner.findOne({ id: request.partnerId });
  const tierInfo = await calculatePartnerTierScore(request.partnerId);
  
  // 5. 인센티브 계산
  const incentives = calculateIncentives(
    metrics,
    goalVsActual,
    partner.tier
  );
  
  // 6. PDF 생성
  const pdfUrl = await generatePdfReport({
    partner,
    metrics,
    goalVsActual,
    tierInfo,
    incentives
  });
  
  // 7. 이메일 발송 (옵션)
  let emailSentAt = null;
  if (request.sendEmail) {
    await sendReportEmail({
      to: partner.email,
      reportUrl: pdfUrl,
      metrics,
      goalVsActual,
      incentives
    });
    emailSentAt = new Date();
  }
  
  return {
    reportId: `rpt_${request.yearMonth}_${partner.id}`,
    partnerId: request.partnerId,
    reportType: request.reportType,
    yearMonth: request.yearMonth,
    metrics,
    previousMonth,
    goalVsActual,
    tierInfo,
    incentives,
    pdfUrl,
    reportGeneratedAt: new Date(),
    emailSentAt
  };
}

function calculateIncentives(
  metrics: Metrics,
  goalVsActual: GoalComparison,
  tier: string
): Incentives {
  const baseCommission = metrics.totalCommission;
  let performanceBonus = 0;
  let tierBonus = 0;
  let specialOffer = 0;
  
  // 1. Performance Bonus
  if (goalVsActual.revenueAchievementRate >= 100) {
    const bonusRate = Math.min(
      (goalVsActual.revenueAchievementRate - 100) / 50, // 50%에서 최대
      0.05 // 최대 5%
    );
    performanceBonus = baseCommission * bonusRate;
  }
  
  // 2. Tier Bonus
  if (tier === 'TOP') {
    tierBonus = baseCommission * 0.02; // 2%
  } else if (tier === 'STANDARD' && goalVsActual.revenueAchievementRate >= 110) {
    tierBonus = baseCommission * 0.01; // 1%
  }
  
  // 3. Special Offer (분기별, 프로모션)
  const specialOffer = await checkSpecialOffer(partnerId);
  if (specialOffer?.isActive) {
    specialOffer = baseCommission * (specialOffer.boostPercent / 100);
  }
  
  return {
    baseCommission,
    performanceBonus,
    tierBonus,
    specialOffer,
    total: baseCommission + performanceBonus + tierBonus + specialOffer
  };
}
```

---

### 2.4 API #4: 파트너 자동 알림

**엔드포인트**: `POST /api/affiliates/notify-partner`

```typescript
interface NotifyPartnerRequest {
  partnerId: string;
  notificationType: 'daily_revenue' | 'weekly_summary' | 'monthly_report' 
                  | 'tier_change' | 'bonus_alert' | 'goal_update';
  channel: 'email' | 'sms' | 'slack' | 'whatsapp' | 'all';
  customMessage?: string;
}

interface NotifyPartnerResponse {
  notificationId: string;
  partnerId: string;
  notificationType: string;
  sentAt: DateTime;
  channels: {
    email?: { status: 'sent' | 'failed'; error?: string };
    sms?: { status: 'sent' | 'failed'; error?: string };
    slack?: { status: 'sent' | 'failed'; error?: string };
    whatsapp?: { status: 'sent' | 'failed'; error?: string };
  };
}

// 사용 예시
const response = await fetch('/api/affiliates/notify-partner', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    partnerId: 'partner_001',
    notificationType: 'daily_revenue',
    channel: 'all'
  })
});

const { notificationId, channels } = await response.json();
// Response:
// {
//   notificationId: 'notif_2026_05_26_001',
//   partnerId: 'partner_001',
//   notificationType: 'daily_revenue',
//   sentAt: '2026-05-26T08:00:00Z',
//   channels: {
//     email: { status: 'sent' },
//     sms: { status: 'sent' },
//     slack: { status: 'sent' },
//     whatsapp: { status: 'sent' }
//   }
// }
```

**알림 템플릿**:

```markdown
# 📊 일일 수익 알림 (Daily Revenue)
```
Today's Revenue: $450
Conversions: 3
Contacts Reached: 25
Conversion Rate: 12%

⬆️ 어제 대비: +15% ($60 증가)

🎯 이달 목표: $25,000
📈 현재까지: $12,500 (50%)

[자세히 보기](link)
```

---

## 3. 자동화 스케줄

### 3.1 Cron Jobs

```
┌────────────────────────────┬────────────┬─────────────────┐
│ 작업                       │ 빈도       │ 실행 시간       │
├────────────────────────────┼────────────┼─────────────────┤
│ 1. Commission 자동 계산     │ 실시간     │ Contact 구매 직후│
│    (API #1)                │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 2. Commission 자동 승인     │ 일 1회     │ 매일 오전 6시   │
│    (24시간 검증)           │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 3. Daily Revenue 알림       │ 일 1회     │ 매일 오전 8시   │
│    (API #4)                │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 4. Weekly Summary 알림      │ 주 1회     │ 매주 월요 오전 9│
│    (API #4)                │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 5. Commission 자동 지급     │ 월 1회     │ 매월 15일 오전 2│
│    (API #2)                │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 6. 월간 성과 리포팅 생성    │ 월 1회     │ 매월 1일 오전 2 │
│    (API #3)                │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 7. 월간 성과 리포팅 발송    │ 월 1회     │ 매월 1일 오전 3 │
│    (API #3)                │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 8. Partner Tier 자동 재평가 │ 월 1회     │ 매월 1일 오전 4 │
│    (affiliate_segmentation) │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 9. Churn Risk 자동 계산     │ 일 1회     │ 매일 오전 10시  │
│    (affiliate_churn)       │            │                 │
├────────────────────────────┼────────────┼─────────────────┤
│ 10. Partner 체크인 알림     │ 주 2회     │ 화/목 오전 7시  │
│    (API #4)                │            │                 │
└────────────────────────────┴────────────┴─────────────────┘
```

### 3.2 실시간 트리거

```
이벤트: Contact.purchasedAt 업데이트
  ↓
Trigger: calculateCommission (API #1)
  └─ Commission 생성 (Status: PENDING)
  └─ 24시간 타이머 설정 (자동 승인)

이벤트: Partner.churnRiskScore > 60
  ↓
Trigger: executeEmergencyIntervention
  └─ 매니저 Slack 알림 (긴급)
  └─ Partner 전화 시도

이벤트: Partner.monthlyRevenue > $100K (처음)
  ↓
Trigger: celebrateMilestone
  └─ CEO 축하 메일 발송
  └─ 보너스 $1K 수동 지급
  └─ 커뮤니티에 성공 사례 공유
```

---

## 4. 에러 처리 & 복구

### 4.1 실패 시나리오 & 해결책

```
시나리오 1: Commission 계산 중 Partner 정보 누락
├─ 감지: Commission 생성 실패 (status: FAILED)
├─ 대응:
│  ├─ Partner 정보 업데이트 요청 (이메일)
│  ├─ 관리자 경고 (Slack)
│  └─ 수동 검토 큐에 추가
└─ 재시도: 정보 업데이트 후 자동 재계산

시나리오 2: 은행 송금 실패
├─ 감지: 송금 중 API 에러
├─ 원인:
│  ├─ 계좌 정보 오류
│  ├─ 은행 시스템 장애
│  └─ 한도 초과
├─ 대응:
│  ├─ 최대 3회 자동 재시도 (1시간 간격)
│  ├─ Partner에게 SMS 알림 (송금 지연)
│  ├─ 관리자 수동 검토 대기열 추가
│  └─ 대체 송금 방법 제안 (수표, PayPal)
└─ 로그: 모든 실패 기록 (트러블슈팅용)

시나리오 3: Partner 메일 발송 실패
├─ 감지: 메일 API 반환 에러
├─ 대응:
│  ├─ SMS로 폴백 (메시지 요약)
│  ├─ Dashboard에 수동 다운로드 링크 제공
│  └─ 재발송 스케줄 설정 (6시간 후)
└─ 추적: 발송 실패 히스토리 저장

시나리오 4: 중복 Commission 생성
├─ 감지: 같은 Contact의 중복 구매 기록
├─ 원인: 웹훅 재전송 또는 수동 입력
├─ 대응:
│  ├─ 자동 중복 감지 (Contact ID + saleDate)
│  ├─ 하나만 유지, 나머지 CANCELLED로 마크
│  ├─ 관리자 리뷰 필요 (의도적 중복일 경우)
│  └─ Partner에게 설명 이메일 발송
└─ 복구: CommissionLedger 정리
```

### 4.2 Data Integrity Checks

```typescript
// 일일 감사 (매일 오전 6시)
async function dailyAffiliateIntegrityCheck() {
  // 1. Orphaned Commission: Contact 없는 기록
  const orphaned = await CommissionLedger.find({
    contactId: { $nin: (await Contact.find()).map(c => c.id) }
  });
  if (orphaned.length > 0) {
    await alertAdmin("Orphaned commissions found", orphaned);
  }
  
  // 2. Duplicate Commission: 같은 Contact의 중복
  const duplicates = await CommissionLedger.aggregate([
    { $group: { _id: '$contactId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  if (duplicates.length > 0) {
    await alertAdmin("Duplicate commissions found", duplicates);
  }
  
  // 3. Commission Mismatch: 계산 오류
  for (const comm of await CommissionLedger.find({ status: 'APPROVED' })) {
    const expected = comm.saleAmount * comm.commissionRate / 100;
    if (Math.abs(comm.commissionAmount - expected) > 0.01) {
      await alertAdmin("Commission mismatch", comm);
    }
  }
  
  // 4. Stale Commission: 90일 이상 PENDING 상태
  const stale = await CommissionLedger.find({
    status: 'PENDING',
    createdAt: { $lt: now() - 90 * 24 * 3600 }
  });
  if (stale.length > 0) {
    // 자동 승인 및 지급
    for (const comm of stale) {
      await autoApproveAndPayCommission(comm.id);
    }
  }
}
```

---

## 5. 모니터링 & 대시보드

### 5.1 실시간 메트릭

```
┌────────────────────────────┬─────────┬───────────┐
│ 메트릭                     │ 목표    │ 현재 값   │
├────────────────────────────┼─────────┼───────────┤
│ Commission 생성 (일)       │ > 200건 │ 245건 ✅  │
│ 계산 평균 시간             │ < 100ms │ 48ms ✅   │
│ 자동 승인율 (24시간)       │ > 95%   │ 97% ✅    │
│ 송금 성공율                │ > 99%   │ 98.5% ⚠️  │
│ 파트너 알림 도달율         │ > 90%   │ 89% ❌    │
│ 리포트 생성 시간           │ < 5초   │ 3.2초 ✅  │
│ 전체 자동화율              │ > 95%   │ 94% ⚠️    │
└────────────────────────────┴─────────┴───────────┘
```

### 5.2 주간 리포팅

```
제목: [주간 자동화 리포트] 2026-05-26

✅ 성공 사항:
• Commission 생성: 1,250건 (주간)
• 자동 지급: $45K (144 파트너)
• 알림 발송: 95% 도달율

⚠️ 주의 사항:
• SMS 도달율 2% 하락 (일부 번호 유효하지 않음)
• 1건의 송금 실패 (계좌 정보 오류)

📊 성과:
• 월 Commission: $152K (목표 대비 102%)
• Tier Up: 12명 (새로운 TOP Tier)
• Partner Satisfaction: 4.2/5.0 ⭐
```

---

## 6. 기대 효과

| 메트릭 | 현재 | 목표 | 증가율 | 기간 |
|--------|------|------|--------|------|
| **자동화율** | 20% | 95% | +375% | 3개월 |
| **처리 시간** | 2시간 | 5초 | -99.9% | 3개월 |
| **오류율** | 5% | 0.5% | -90% | 3개월 |
| **파트너 만족도** | 3.2/5.0 | 4.5/5.0 | +41% | 3개월 |
| **수동 개입** | 월 50건 | 월 <5건 | -90% | 3개월 |
| **월 처리 비용** | $5K | $1.5K | -70% | 3개월 |

---

## 7. 구현 로드맵

### Phase 1 (2주): API #1 Commission 계산
- [ ] API 구현 & 테스트
- [ ] Contact → Partner 링크 확인
- [ ] Commission 검증 로직

### Phase 2 (2주): API #2 자동 지급
- [ ] 은행 API 연동 (한국 은행)
- [ ] 세금 계산 자동화
- [ ] 지급 히스토리 추적

### Phase 3 (1주): API #3 성과 리포팅
- [ ] PDF 생성 (라이브러리)
- [ ] 메일 템플릿 디자인
- [ ] 자동 발송 스케줄

### Phase 4 (1주): API #4 파트너 알림
- [ ] 멀티채널 통합 (Email, SMS, Slack, WhatsApp)
- [ ] 메시지 템플릿 (8가지)
- [ ] 선호도 설정 (Partner 커스텀)

### Phase 5 (2주): 모니터링 & 최적화
- [ ] 대시보드 구축
- [ ] 에러 처리 & 복구
- [ ] A/B 테스트 (알림 전략)

---

**최종 체크**: 4개 API + Cron Jobs + Error Handling + Monitoring ✅

**다음 단계**: 실제 구현 및 배포 (2-3주)

---

