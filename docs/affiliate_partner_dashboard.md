# Affiliate Partner Dashboard (파트너 수익 조회 시스템)

**작성일**: 2026-05-26  
**버전**: 1.0  
**대상**: 마비즈 CRM Affiliate Marketing 시스템

---

## 📊 1. 대시보드 개요

### 1.1 파트너 대시보드 목적

```
파트너의 영업 성과를 실시간으로 추적하고,
수익 예상액을 명확하게 제시하여,
영업 동기부여 및 성과 관리를 자동화합니다.
```

### 1.2 핵심 역할

| 역할 | 설명 |
|------|------|
| **실시간 성과 추적** | 일 단위로 매출, 수당, 전환율 조회 |
| **수익 예측** | 현재 페이스 기반 월말 예상액 계산 |
| **지급 관리** | 정산 내역, 미정산액, 다음 지급일 명시 |
| **성과 분석** | 채널별, 상품별, 시간대별 성과 분석 |
| **동기부여** | 랭킹, 목표 진행률, 성과 배지 |

---

## 🎯 2. 대시보드 UI 구조

### 2.1 메인 화면 (At-a-glance)

```
┌─────────────────────────────────────────────────────────────────┐
│ 파트너 대시보드 | [월간] [주간] [일일] [기간]                   │
├─────────────────────────────────────────────────────────────────┤
│ 안녕하세요, [파트너명]님! 👋                                     │
│ 이번 달 목표 달성률: ████████░░ 80% (₩1.6M / ₩2M)              │
├─────────────────────────────────────────────────────────────────┤
│
│ 📈 핵심 지표 (KPI Cards)
│
│ ┌─────────────────┬─────────────────┬─────────────────┐
│ │ 이번달 매출     │ 이번달 수당     │ 예상 월말 수당  │
│ │ ₩50,000,000     │ ₩1,250,000      │ ₩1,550,000      │
│ │ ▲ ₩10M (+25%)   │ ▲ ₩300K (+31%)  │ 목표 ₩2M (77%) │
│ └─────────────────┴─────────────────┴─────────────────┘
│
│ ┌─────────────────┬─────────────────┬─────────────────┐
│ │ 이번주 클릭     │ 예약 건수       │ 성약율          │
│ │ 1,234           │ 45건            │ 18% (↑3%p)      │
│ └─────────────────┴─────────────────┴─────────────────┘
│
├─────────────────────────────────────────────────────────────────┤
│
│ 📊 실시간 거래 현황
│
│ [필터: 전체 상품] [최근순] [금액순]
│
│ 시간  │ 고객명      │ 상품       │ 금액        │ 수당    │ 상태
│ 10:45 │ 김○○      │ 스위트룸   │ ₩10,000,000 │ ₩250K  │ 예약확정
│ 10:30 │ 이○○      │ 발코니     │ ₩5,000,000  │ ₩100K  │ 문의접수
│ 09:15 │ 박○○      │ 인테리어   │ ₩3,000,000  │ ₩60K   │ 예약확정
│
├─────────────────────────────────────────────────────────────────┤
│
│ 💰 지급 관리
│
│ 다음 정산일: 2026-05-31 (금) | 정산 예상액: ₩1,200,000
│ [최근 지급 내역 조회] [정산 요청] [지급 계좌 변경]
│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 세부 조회 탭

```
1️⃣ 거래 현황 탭
   ├─ 일일 거래액 그래프
   ├─ 거래 상세 리스트
   ├─ 필터: 상품별, 채널별, 상태별
   └─ 내보내기: CSV, Excel

2️⃣ 수당 관리 탭
   ├─ 월별 수당액
   ├─ 수당 계산 상세 (공식 표시)
   ├─ 원천징수, 순 지급액 명시
   └─ 지급 이력

3️⃣ 성과 분석 탭
   ├─ 채널별 성과 (SNS, 이메일, 직접 등)
   ├─ 상품별 성과 (항공권, 숙소, 패키지)
   ├─ 시간대별 성과 (시간, 요일, 주간)
   ├─ 지역별 성과 (고객 위치 기반)
   └─ 매출 누적 그래프

4️⃣ 비교 분석 탭
   ├─ 목표 vs 실적 (달성률 표시)
   ├─ 전월 대비 (증감율)
   ├─ 상위 파트너 vs 나 (상위 10% 기준)
   └─ 성장 추세 (3개월, 6개월)

5️⃣ 지급 관리 탭
   ├─ 정산 일정 캘린더
   ├─ 미정산액 명시
   ├─ 정산 요청 양식
   ├─ 계좌 관리
   └─ 영수증 다운로드
```

---

## 💻 3. Backend API 설계

### 3.1 GET /api/partner/dashboard/summary

**목표**: 메인 대시보드 요약 정보 반환

```typescript
GET /api/partner/dashboard/summary?period=month&month=2026-05

Response: {
  "success": true,
  "data": {
    // 매출 지표
    "sales": {
      "amount": 50000000,           // 금월 매출액
      "previousAmount": 40000000,   // 전월 매출액
      "percentChange": 25,          // 증감율 (%)
      "dailyAverage": 1724137,      // 일평균
      "remaining": 10000000,        // 월말까지 필요액
    },
    
    // 수당 지표
    "commission": {
      "amount": 1250000,            // 금월 수당
      "projected": 1550000,         // 월말 예상
      "goal": 2000000,              // 목표액
      "goalProgress": 0.77,         // 진행률 (77%)
      "withholdingTax": 41250,      // 원천징수
      "netPayout": 1208750,         // 순 지급액
    },
    
    // 지급 정보
    "payout": {
      "status": "PENDING",          // "PENDING" | "PROCESSING" | "PAID"
      "nextDate": "2026-05-31",
      "estimatedAmount": 1200000,
      "bankName": "국민은행",
      "accountLast4": "1234",
    },
    
    // 거래 통계
    "transactions": {
      "totalCount": 15,             // 금월 거래 건수
      "completedCount": 12,
      "pendingCount": 3,
      "avgAmount": 3333333,         // 평균 거래액
    },
    
    // 성과 지표
    "performance": {
      "clickCount": 5432,           // 금월 링크 클릭
      "conversionRate": 0.18,       // 18%
      "cpa": 35000,                 // 고객획득비용 (수당기준)
      "roi": 3.57,                  // 투자수익률
    },
    
    // 순위 정보
    "ranking": {
      "position": 5,
      "totalPartners": 125,
      "percentile": 96,             // 상위 4%
      "achievementBadges": ["TOP_10", "HIGH_GROWTH"],
    }
  }
}
```

### 3.2 GET /api/partner/dashboard/transactions

**목표**: 거래 목록 (페이지네이션, 필터)

```typescript
GET /api/partner/dashboard/transactions?period=month&page=1&limit=20&status=all&product=all&sort=-createdAt

Response: {
  "success": true,
  "data": {
    "items": [
      {
        "id": "tx_123456",
        "date": "2026-05-26T10:45:00Z",
        "customerName": "김○○",
        "productName": "크루즈 스위트룸",
        "saleAmount": 10000000,
        "commissionRate": 2.5,
        "commissionAmount": 250000,
        "source": "facebook",          // 출처 채널
        "status": "CONFIRMED",
        "travelDate": "2026-07-01",
        "link": "https://mabiz.com/short/abc123",  // 사용한 링크
      },
      // ... 더 많은 거래
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
    },
    "summary": {
      "periodTotal": 50000000,
      "periodCommission": 1250000,
    }
  }
}
```

### 3.3 GET /api/partner/dashboard/commission-breakdown

**목표**: 수당 계산 상세 분석

```typescript
GET /api/partner/dashboard/commission-breakdown?month=2026-05

Response: {
  "success": true,
  "data": {
    "month": "2026-05",
    "details": [
      {
        "date": "2026-05-26",
        "transactions": [
          {
            "orderId": "ORD_123",
            "saleAmount": 10000000,
            "productType": "CRUISE_SUITE",
            "tier": "TIER_3",
            "rate": 0.025,
            "baseCommission": 250000,
            "adjustments": {
              "volumeBonus": 10000,     // 대량 판매 보너스
              "qualityBonus": 5000,     // 품질 보너스
            },
            "grossCommission": 265000,
            "cardFee": 230000,          // 카드 수수료
            "withholdingTax": 8745,     // 원천징수
            "netPayout": 256255,
          }
        ],
        "dayTotal": {
          "grossCommission": 265000,
          "withholdingTax": 8745,
          "netPayout": 256255,
        }
      }
    ],
    "monthSummary": {
      "totalSales": 50000000,
      "totalCommission": 1250000,
      "totalWithholding": 41250,
      "totalNetPayout": 1208750,
      "commissionRate": {
        "min": 2.0,
        "max": 3.0,
        "avg": 2.5,
      }
    }
  }
}
```

### 3.4 GET /api/partner/dashboard/performance

**목표**: 성과 분석 (채널별, 상품별, 시간대별)

```typescript
GET /api/partner/dashboard/performance?period=month&metric=channel

Response: {
  "success": true,
  "data": {
    // 1. 채널별 성과
    "byChannel": {
      "facebook": {
        "clicks": 2000,
        "transactions": 8,
        "saleAmount": 20000000,
        "commission": 500000,
        "conversionRate": 0.40,
        "roa": 2.5,               // 광고비 대비 매출
      },
      "instagram": {
        "clicks": 1500,
        "transactions": 5,
        "saleAmount": 15000000,
        "commission": 375000,
        "conversionRate": 0.33,
        "roa": 3.0,
      },
      "email": {
        "clicks": 932,
        "transactions": 2,
        "saleAmount": 8000000,
        "commission": 200000,
        "conversionRate": 0.21,
        "roa": 4.2,
      },
      "organic": {
        "clicks": 1000,
        "transactions": 0,
        "saleAmount": 7000000,
        "commission": 175000,
        "conversionRate": 0.0,
        "roa": 0.0,
      }
    },
    
    // 2. 상품별 성과
    "byProduct": {
      "CRUISE_SUITE": {
        "count": 5,
        "amount": 50000000,
        "commission": 1250000,
        "avgPrice": 10000000,
        "conversionRate": 0.5,
      },
      "CRUISE_BALCONY": {
        "count": 7,
        "amount": 35000000,
        "commission": 700000,
        "avgPrice": 5000000,
        "conversionRate": 0.4,
      },
      // ...
    },
    
    // 3. 시간대별 성과
    "byTimeOfDay": {
      "morning": { "transactions": 3, "amount": 10000000 },
      "afternoon": { "transactions": 6, "amount": 25000000 },
      "evening": { "transactions": 5, "amount": 15000000 },
      "night": { "transactions": 1, "amount": 5000000 },
    },
    
    // 4. 요일별 성과
    "byDayOfWeek": {
      "monday": { "transactions": 2, "amount": 8000000 },
      "tuesday": { "transactions": 3, "amount": 12000000 },
      // ...
      "sunday": { "transactions": 2, "amount": 7000000 },
    }
  }
}
```

### 3.5 GET /api/partner/dashboard/payout-history

**목표**: 지급 이력 조회

```typescript
GET /api/partner/dashboard/payout-history?limit=12

Response: {
  "success": true,
  "data": {
    "items": [
      {
        "id": "payout_202405_001",
        "month": "2026-05",
        "amount": 1200000,
        "status": "COMPLETED",
        "paidAt": "2026-06-01T14:30:00Z",
        "bankName": "국민은행",
        "accountLast4": "1234",
        "description": "May 2026 Commission",
        "breakdown": {
          "grossAmount": 1250000,
          "withholdingTax": 41250,
          "netAmount": 1208750,
          "adjustments": [
            { "type": "CHARGEBACK", "amount": -8750 }
          ]
        }
      },
      {
        "id": "payout_202404_001",
        "month": "2026-04",
        "amount": 1050000,
        "status": "COMPLETED",
        "paidAt": "2026-05-01T14:30:00Z",
        // ...
      }
    ],
    "summary": {
      "totalPaid": 6250000,         // 누적 지급액
      "averageMonthly": 1041667,
      "nextPayoutDate": "2026-06-01",
    }
  }
}
```

### 3.6 POST /api/partner/dashboard/payout-request

**목표**: 정산 요청 생성

```typescript
POST /api/partner/dashboard/payout-request
{
  "month": "2026-05",
  "amount": 1200000,
  "paymentMethod": "BANK_TRANSFER" | "VIRTUAL_ACCOUNT",
  "bankName": "국민은행",
  "accountNumber": "123-456-789012",
  "accountHolder": "김○○",
  "note": "월별 정산"
}

Response: {
  "success": true,
  "data": {
    "requestId": "payreq_20260526_001",
    "status": "PENDING_APPROVAL",
    "amount": 1200000,
    "createdAt": "2026-05-26T15:00:00Z",
    "estimatedPayoutDate": "2026-05-31",
    "approvalStep": 1,  // 1: 파트너 제출, 2: 관리자 승인, 3: 회계 처리
  }
}
```

---

## 📈 4. 대시보드 위젯 상세

### 4.1 Goal Progress Widget (목표 진행률)

```
┌─────────────────────────────────────────┐
│ 2026년 5월 목표: ₩2,000,000             │
├─────────────────────────────────────────┤
│ ████████░░░░░░░░░░░░ 62.5%             │
│ 현재: ₩1,250,000 / 목표: ₩2,000,000    │
├─────────────────────────────────────────┤
│ 남은기간: 5일                            │
│ 필요액: ₩750,000                        │
│ 일평균: ₩150,000                        │
└─────────────────────────────────────────┘
```

**mabiz 구현**:
```typescript
export async function getGoalProgress(partnerId: string, month: number, year: number) {
  const goal = await getMonthlyGoal(partnerId, month, year);
  const achieved = await getMonthlyCommission(partnerId, month, year);
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysPassed = new Date().getDate();
  const daysRemaining = daysInMonth - daysPassed;
  
  const required = Math.max(0, goal - achieved);
  const dailyRequired = required / Math.max(1, daysRemaining);
  
  return {
    goal,
    achieved,
    progress: (achieved / goal) * 100,
    remaining: {
      amount: required,
      days: daysRemaining,
      dailyRequired,
    }
  };
}
```

### 4.2 Real-time Transaction Feed (거래 피드)

```
[10:45] 김○○ 스위트룸 ₩10M 예약확정 ✅
[10:30] 이○○ 발코니 ₩5M 문의접수 ⏳
[09:15] 박○○ 인테리어 ₩3M 예약확정 ✅
[09:00] 최○○ 스위트룸 ₩7M 환불 ❌
```

**WebSocket 구현**:
```typescript
// Server
io.on('connection', (socket) => {
  const partnerId = socket.handshake.query.partnerId;
  
  socket.join(`partner:${partnerId}`);
  
  // 거래 발생시 실시간 전송
  prisma.$subscribe.on('AffiliateSale', (event) => {
    if (event.affiliateCode === partnerId) {
      io.to(`partner:${partnerId}`).emit('transaction', {
        type: 'NEW_TRANSACTION',
        data: event,
        timestamp: new Date(),
      });
    }
  });
});

// Client (React)
useEffect(() => {
  const socket = io('https://api.mabiz.com');
  socket.emit('join', { partnerId });
  
  socket.on('transaction', (data) => {
    setTransactions(prev => [data.data, ...prev]);
    toast.success(`새로운 거래: ${data.data.customerName}`);
  });
  
  return () => socket.disconnect();
}, []);
```

### 4.3 Ranking Badge (순위 배지)

```
┌─────────────────────────────────────────┐
│ 🏆 상위 5% (전체 125명 중 5위)         │
├─────────────────────────────────────────┤
│ 당신:    ₩1,250,000 (금월)              │
│ 1위:     ₩2,100,000                     │
│ 평균:    ₩840,000                       │
│ 차이:    +₩410,000 (중상위 성과)        │
└─────────────────────────────────────────┘

배지:
⭐ HIGH_PERFORMER   - 상위 10% 달성
🚀 FAST_GROWTH      - 전월 대비 50% 이상 증가
🎯 GOAL_ACHIEVER    - 월 목표 달성
```

---

## 🔔 5. 자동 알림 시스템

### 5.1 알림 트리거

| 트리거 | 조건 | 메시지 |
|--------|------|--------|
| Goal Alert | 월 목표의 80% 달성 | "축하합니다! 목표의 80%에 도달했습니다 🎉" |
| Payout Alert | 정산일 1일 전 | "내일 정산이 예정되어있습니다. 계좌를 확인해주세요." |
| Performance Alert | 전주 대비 50% 이상 하락 | "최근 거래가 감소했습니다. 캠페인을 검토해주세요." |
| Fraud Alert | 비정상 거래 감지 | "의심 거래가 감지되었습니다. 확인이 필요합니다." |
| Milestone Alert | 누적 ₩10M 달성 | "축하합니다! 누적 매출 ₩10M을 돌파했습니다! 🎊" |

### 5.2 알림 채널

```typescript
export async function sendDashboardNotification(
  partnerId: string,
  notification: {
    type: 'GOAL' | 'PAYOUT' | 'PERFORMANCE' | 'FRAUD' | 'MILESTONE';
    title: string;
    message: string;
    actionUrl?: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }
) {
  const partner = await getPartner(partnerId);
  
  // 1. In-app 알림
  await createNotification({
    partnerId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: false,
  });
  
  // 2. Push Notification
  if (partner.pushToken) {
    await sendPushNotification(partner.pushToken, {
      title: notification.title,
      body: notification.message,
      data: { actionUrl: notification.actionUrl },
    });
  }
  
  // 3. Email (HIGH 우선순위만)
  if (notification.priority === 'HIGH' && partner.emailNotificationOpt) {
    await sendEmail({
      to: partner.email,
      template: 'partner_notification',
      data: notification,
    });
  }
  
  // 4. SMS (긴급)
  if (notification.type === 'FRAUD' && partner.smsOptIn) {
    await sendSMS({
      to: partner.phone,
      message: `⚠️ ${notification.title}: ${notification.message}`,
    });
  }
}
```

---

## 🎨 6. UX/UI 고려사항

### 6.1 반응형 디자인

```
Desktop:   3열 레이아웃 (큰 차트)
Tablet:    2열 레이아웃 (중간 차트)
Mobile:    1열 레이아웃 (세로 스크롤)
```

### 6.2 접근성 (Accessibility)

```
✅ 색상만으로 정보 전달 X (숫자, 아이콘 병행)
✅ ARIA 라벨 (스크린 리더 지원)
✅ 키보드 네비게이션
✅ 1.5배 폰트 최소 크기
✅ 90도 회전 지원
```

### 6.3 성능 최적화

```
✅ 가상 스크롤 (거래 리스트 1000+ 항목)
✅ 이미지 최적화 (WebP, 레이지 로딩)
✅ 차트 라이브러리 (Recharts, Chart.js)
✅ Redis 캐싱 (자주 조회되는 메트릭)
```

---

## ✅ 7. 구현 체크리스트

- [ ] API 6개 엔드포인트 구현
- [ ] React 대시보드 UI 컴포넌트
- [ ] WebSocket 실시간 업데이트
- [ ] 대시보드 필터 및 정렬
- [ ] CSV 내보내기 기능
- [ ] 모바일 반응형 디자인
- [ ] 자동 알림 시스템
- [ ] 성과 배지 및 순위 표시
- [ ] 접근성 검증 (WCAG 2.1 AA)
- [ ] 성능 테스트 (Lighthouse 90+)
- [ ] E2E 테스트 (Cypress)
- [ ] 파트너 사용성 테스트

---

## 📚 Reference

- [[affiliate_commission_models.md]] - 수당 계산
- [[affiliate_tracking_system.md]] - 거래 추적
- [[affiliate_fraud_detection.md]] - 사기 탐지
- [[affiliate_integration_architecture.md]] - API 아키텍처
