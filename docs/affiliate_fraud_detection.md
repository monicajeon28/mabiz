# Affiliate Fraud Detection (어필리에이트 사기 탐지)

**작성일**: 2026-05-26  
**버전**: 1.0  
**대상**: 마비즈 CRM Affiliate Marketing 시스템

---

## 🎯 1. 사기 유형 분류

### 1.1 대표 사기 유형

| 유형 | 정의 | 신호 | 영향 |
|------|------|------|------|
| **Cookie Stuffing** | 사용자 동의 없이 쿠키 강제 삽입 | 클릭 0, 전환 1+ | 낮음 |
| **Click Fraud** | 봇으로 대량 허위 클릭 생성 | 클릭 급증, 전환율 1% 이하 | 중간 |
| **Lead Farming** | 낮은 품질 리드 대량 생성 | 문의→환불율 70%+ | 높음 |
| **Attribution Fraud** | 거래 후 링크 클릭 → 귀속 조작 | 최근 클릭, 빠른 구매 | 높음 |
| **Device Spoofing** | 다른 디바이스로 위장 | Device ID 불일치, IP 위치 오류 | 중간 |
| **Duplicate Transactions** | 동일 거래 중복 기록 | OrderID 중복, 동일 고객 | 높음 |
| **VPN/Proxy Traffic** | 봇넷/프록시로 클릭 위장 | 공용 IP, 알려진 봇넷 IP | 낮음 |
| **Chargebacks** | 결제 후 환불 요청 악용 | 환불율 높음, 분쟁율 증가 | 높음 |

---

## 🚨 2. 실시간 사기 탐지 엔진

### 2.1 Risk Scoring System (위험 점수)

```
위험 점수 = Σ (신호1 × 가중치1) + (신호2 × 가중치2) + ...

위험도 판정:
0-30점:  LOW (허용)
30-60점: MEDIUM (검토)
60-85점: HIGH (보류)
85+점:   CRITICAL (자동 거부)
```

### 2.2 실시간 탐지 로직

**파일**: `src/lib/affiliate-fraud-detection.ts` (신규)

```typescript
interface FraudCheckRequest {
  saleId: string;
  affiliateCode: string;
  customerId: string;
  saleAmount: number;
  orderId: string;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  clickTimestamp?: Date;
  saleTimestamp: Date;
}

interface FraudScore {
  riskScore: number;      // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: {
    name: string;
    weight: number;
    triggered: boolean;
    confidence: number;
  }[];
  recommendation: 'APPROVE' | 'REVIEW' | 'HOLD' | 'REJECT';
  reason?: string;
}

/**
 * 사기 탐지 메인 함수
 */
export async function detectAffiliateFraud(req: FraudCheckRequest): Promise<FraudScore> {
  const signals: Array<{ name: string; weight: number; triggered: boolean; confidence: number }> = [];
  let totalScore = 0;
  
  // Signal 1: 비정상적인 클릭→구매 간격
  {
    const signal = await checkClickToPurchaseGap(req);
    if (signal.triggered) {
      totalScore += signal.weight * signal.confidence;
      signals.push(signal);
    }
  }
  
  // Signal 2: 동일 고객 중복 거래
  {
    const signal = await checkDuplicateCustomer(req);
    if (signal.triggered) {
      totalScore += signal.weight * signal.confidence;
      signals.push(signal);
    }
  }
  
  // Signal 3: IP 평판 점검
  {
    const signal = await checkIPReputation(req.ipAddress);
    if (signal.triggered) {
      totalScore += signal.weight * signal.confidence;
      signals.push(signal);
    }
  }
  
  // Signal 4: 파트너 평판 점검
  {
    const signal = await checkAffiliateReputation(req.affiliateCode);
    if (signal.triggered) {
      totalScore += signal.weight * signal.confidence;
      signals.push(signal);
    }
  }
  
  // Signal 5: User-Agent 검증
  {
    const signal = checkUserAgent(req.userAgent);
    if (signal.triggered) {
      totalScore += signal.weight * signal.confidence;
      signals.push(signal);
    }
  }
  
  // Signal 6: Device Fingerprint
  {
    const signal = await checkDeviceFingerprint(req.deviceId, req.ipAddress);
    if (signal.triggered) {
      totalScore += signal.weight * signal.confidence;
      signals.push(signal);
    }
  }
  
  // Signal 7: 이상적 거래 패턴
  {
    const signal = await checkAnomalousPattern(req.affiliateCode, req.saleAmount);
    if (signal.triggered) {
      totalScore += signal.weight * signal.confidence;
      signals.push(signal);
    }
  }
  
  // Signal 8: Geolocation 검증
  {
    const signal = await checkGeolocation(req.ipAddress, req.deviceId);
    if (signal.triggered) {
      totalScore += signal.weight * signal.confidence;
      signals.push(signal);
    }
  }
  
  // 최종 위험도 판정
  const riskLevel = determineRiskLevel(totalScore);
  const recommendation = determineRecommendation(riskLevel, signals);
  
  return {
    riskScore: Math.min(100, totalScore),
    riskLevel,
    signals,
    recommendation,
  };
}

/**
 * Signal 1: Click-to-Purchase Gap
 * 
 * 정상: 클릭 후 1-30일 이내 구매
 * 의심: 클릭 없이 구매 또는 클릭 후 1시간 내 구매
 */
async function checkClickToPurchaseGap(req: FraudCheckRequest) {
  if (!req.clickTimestamp) {
    return {
      name: 'NO_CLICK_RECORDED',
      weight: 40,
      triggered: true,
      confidence: 1.0,
    };
  }
  
  const gap = (req.saleTimestamp.getTime() - req.clickTimestamp.getTime()) / 1000;
  const gapHours = gap / 3600;
  const gapDays = gap / (3600 * 24);
  
  if (gapHours < 1) {
    // 1시간 이내: 매우 의심
    return {
      name: 'INSTANT_CONVERSION',
      weight: 35,
      triggered: true,
      confidence: 0.9,
    };
  }
  
  if (gapDays > 30) {
    // 30일 초과: 의심
    return {
      name: 'LONG_ATTRIBUTION_WINDOW',
      weight: 20,
      triggered: true,
      confidence: 0.6,
    };
  }
  
  return {
    name: 'NORMAL_CLICK_GAP',
    weight: 0,
    triggered: false,
    confidence: 0.0,
  };
}

/**
 * Signal 2: Duplicate Customer
 * 
 * 24시간 내 동일 고객 중복 거래
 */
async function checkDuplicateCustomer(req: FraudCheckRequest) {
  const recent = await prisma.affiliateSale.findMany({
    where: {
      organizationId: req.organizationId,
      customerId: req.customerId,
      createdAt: {
        gte: new Date(Date.now() - 24 * 3600 * 1000),
      },
    },
    select: { id: true, saleAmount: true },
  });
  
  if (recent.length > 1) {
    return {
      name: 'DUPLICATE_CUSTOMER_24H',
      weight: 45,
      triggered: true,
      confidence: 0.95,
    };
  }
  
  // 동일 고객 1주일 내 3건 이상
  const weekly = await prisma.affiliateSale.count({
    where: {
      customerId: req.customerId,
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      },
    },
  });
  
  if (weekly > 3) {
    return {
      name: 'HIGH_FREQUENCY_CUSTOMER',
      weight: 25,
      triggered: true,
      confidence: 0.7,
    };
  }
  
  return {
    name: 'NORMAL_FREQUENCY',
    weight: 0,
    triggered: false,
    confidence: 0.0,
  };
}

/**
 * Signal 3: IP Reputation
 * 
 * 알려진 봇넷, 프록시, VPN, 데이터센터 IP 점검
 */
async function checkIPReputation(ipAddress: string): Promise<{
  name: string;
  weight: number;
  triggered: boolean;
  confidence: number;
}> {
  // 1. IP 금지 목록 검사
  const isBlocked = await checkIPBlocklist(ipAddress);
  if (isBlocked) {
    return {
      name: 'IP_BLOCKLISTED',
      weight: 50,
      triggered: true,
      confidence: 1.0,
    };
  }
  
  // 2. VPN/Proxy 감지
  const vpnCheck = await detectVPN(ipAddress);
  if (vpnCheck.isVPN) {
    return {
      name: 'VPN_DETECTED',
      weight: 30,
      triggered: true,
      confidence: vpnCheck.confidence,
    };
  }
  
  // 3. 데이터센터 IP 감지
  const dcCheck = await detectDatacenter(ipAddress);
  if (dcCheck.isDatacenter) {
    return {
      name: 'DATACENTER_IP',
      weight: 20,
      triggered: true,
      confidence: dcCheck.confidence,
    };
  }
  
  return {
    name: 'NORMAL_IP',
    weight: 0,
    triggered: false,
    confidence: 0.0,
  };
}

/**
 * Signal 4: Affiliate Reputation
 * 
 * 파트너의 과거 환불율, 분쟁율, 거래 패턴
 */
async function checkAffiliateReputation(affiliateCode: string): Promise<{
  name: string;
  weight: number;
  triggered: boolean;
  confidence: number;
}> {
  const metrics = await prisma.$queryRaw<any[]>(
    Prisma.sql`
      SELECT
        COUNT(*) as total_sales,
        COUNT(CASE WHEN status = 'REFUNDED' THEN 1 END) as refunded_count,
        COUNT(CASE WHEN status = 'CHARGEBACK' THEN 1 END) as chargeback_count,
        AVG(CAST(commission_amount AS FLOAT)) as avg_commission
      FROM "CrmAffiliateSale"
      WHERE "affiliateCode" = ${affiliateCode}
      AND "createdAt" > NOW() - INTERVAL '90 days'
    `
  );
  
  const { total_sales, refunded_count, chargeback_count } = metrics[0];
  
  if (!total_sales) {
    return {
      name: 'NEW_AFFILIATE_NO_HISTORY',
      weight: 15,
      triggered: true,
      confidence: 0.5,
    };
  }
  
  const refundRate = refunded_count / total_sales;
  const chargebackRate = chargeback_count / total_sales;
  
  // 환불율 50% 이상
  if (refundRate > 0.5) {
    return {
      name: 'HIGH_REFUND_RATE',
      weight: 40,
      triggered: true,
      confidence: 0.85,
    };
  }
  
  // 분쟁율 10% 이상
  if (chargebackRate > 0.1) {
    return {
      name: 'HIGH_CHARGEBACK_RATE',
      weight: 45,
      triggered: true,
      confidence: 0.9,
    };
  }
  
  return {
    name: 'NORMAL_AFFILIATE',
    weight: 0,
    triggered: false,
    confidence: 0.0,
  };
}

/**
 * Signal 5: User-Agent Check
 * 
 * Bot User-Agent, 헤더리스 브라우저, 자동화 도구 감지
 */
function checkUserAgent(userAgent: string): {
  name: string;
  weight: number;
  triggered: boolean;
  confidence: number;
} {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /headless/i,
  ];
  
  if (botPatterns.some(p => p.test(userAgent))) {
    return {
      name: 'BOT_USER_AGENT',
      weight: 35,
      triggered: true,
      confidence: 0.95,
    };
  }
  
  // 이상한 User-Agent (너무 짧음)
  if (userAgent.length < 20) {
    return {
      name: 'SUSPICIOUS_USER_AGENT',
      weight: 15,
      triggered: true,
      confidence: 0.6,
    };
  }
  
  return {
    name: 'NORMAL_USER_AGENT',
    weight: 0,
    triggered: false,
    confidence: 0.0,
  };
}

/**
 * Signal 6: Device Fingerprint
 * 
 * 동일 기기에서 다른 계정으로 거래
 */
async function checkDeviceFingerprint(
  deviceId: string,
  ipAddress: string
): Promise<{
  name: string;
  weight: number;
  triggered: boolean;
  confidence: number;
}> {
  const recentTransactions = await prisma.affiliateSale.findMany({
    where: {
      metadata: {
        path: ['deviceId'],
        equals: deviceId,
      },
      createdAt: {
        gte: new Date(Date.now() - 24 * 3600 * 1000),
      },
    },
    select: { affiliateCode: true },
  });
  
  const uniqueAffiliates = new Set(recentTransactions.map(t => t.affiliateCode));
  
  if (uniqueAffiliates.size > 3) {
    return {
      name: 'DEVICE_USED_MULTIPLE_AFFILIATES',
      weight: 38,
      triggered: true,
      confidence: 0.8,
    };
  }
  
  return {
    name: 'NORMAL_DEVICE_PATTERN',
    weight: 0,
    triggered: false,
    confidence: 0.0,
  };
}

/**
 * Signal 7: Anomalous Pattern
 * 
 * 파트너의 일반적 거래 패턴에서 벗어난 거래
 */
async function checkAnomalousPattern(
  affiliateCode: string,
  saleAmount: number
): Promise<{
  name: string;
  weight: number;
  triggered: boolean;
  confidence: number;
}> {
  // 최근 30일 거래액 통계
  const stats = await prisma.affiliateSale.aggregate({
    _avg: { saleAmount: true },
    _stdDevPop: { saleAmount: true },
    where: {
      affiliateCode,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      },
    },
  });
  
  const { _avg, _stdDevPop } = stats;
  const avg = _avg.saleAmount || 0;
  const stdDev = _stdDevPop || 0;
  
  // 평균에서 3σ 이상 벗어남 (99.7% 신뢰도)
  const zscore = stdDev === 0 ? 0 : Math.abs((saleAmount - avg) / stdDev);
  
  if (zscore > 3) {
    return {
      name: 'ANOMALOUS_AMOUNT',
      weight: 25,
      triggered: true,
      confidence: 0.85,
    };
  }
  
  return {
    name: 'NORMAL_AMOUNT',
    weight: 0,
    triggered: false,
    confidence: 0.0,
  };
}

/**
 * Signal 8: Geolocation Check
 * 
 * IP 위치와 디바이스 위치 불일치
 */
async function checkGeolocation(
  ipAddress: string,
  deviceId: string
): Promise<{
  name: string;
  weight: number;
  triggered: boolean;
  confidence: number;
}> {
  const ipGeo = await getIPGeolocation(ipAddress);
  const deviceGeo = await getDeviceGeolocation(deviceId);
  
  if (!ipGeo || !deviceGeo) {
    return {
      name: 'GEOLOCATION_UNAVAILABLE',
      weight: 0,
      triggered: false,
      confidence: 0.0,
    };
  }
  
  // 거리 계산 (km)
  const distance = calculateDistance(ipGeo, deviceGeo);
  
  // 5분 내 500km 이상 이동 (불가능)
  if (distance > 500) {
    return {
      name: 'IMPOSSIBLE_GEOLOCATION',
      weight: 50,
      triggered: true,
      confidence: 0.95,
    };
  }
  
  // 100-500km 이상 (의심)
  if (distance > 100) {
    return {
      name: 'UNUSUAL_GEOLOCATION',
      weight: 20,
      triggered: true,
      confidence: 0.65,
    };
  }
  
  return {
    name: 'NORMAL_GEOLOCATION',
    weight: 0,
    triggered: false,
    confidence: 0.0,
  };
}

/**
 * 위험도 판정
 */
function determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 85) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * 권고사항 결정
 */
function determineRecommendation(
  riskLevel: string,
  signals: any[]
): 'APPROVE' | 'REVIEW' | 'HOLD' | 'REJECT' {
  switch (riskLevel) {
    case 'LOW':
      return 'APPROVE';
    case 'MEDIUM':
      return 'REVIEW';
    case 'HIGH':
      return 'HOLD';
    case 'CRITICAL':
      return 'REJECT';
    default:
      return 'REVIEW';
  }
}
```

---

## 📊 3. 자동 대응 규칙

### 3.1 Risk Level별 자동 조치

```
LOW (0-30점)
  ✅ 자동 승인
  → AffiliateSale.status = CONFIRMED
  → 1시간 내 정산 처리 가능

MEDIUM (30-60점)
  ⏸️ 수동 검토 대기
  → AffiliateSale.status = PENDING_REVIEW
  → 관리자 이메일 알림
  → 24시간 내 승인/거부
  
HIGH (60-85점)
  🛑 보류 및 재조사
  → AffiliateSale.status = ON_HOLD
  → 파트너에게 추가 정보 요청
  → 고객 연락처 확인
  
CRITICAL (85점+)
  ❌ 자동 거부 및 조사
  → AffiliateSale.status = REJECTED
  → 파트너 계정 잠금 (72시간)
  → 법무팀 알림
  → 환불 처리
```

### 3.2 구현 예시

```typescript
export async function applyFraudResponse(
  saleId: string,
  fraudScore: FraudScore
) {
  const { riskLevel, recommendation, signals } = fraudScore;
  
  switch (recommendation) {
    case 'APPROVE':
      await updateSaleStatus(saleId, 'CONFIRMED');
      await createCommissionLedger(saleId);
      break;
      
    case 'REVIEW':
      await updateSaleStatus(saleId, 'PENDING_REVIEW');
      await notifyAdminReview(saleId, fraudScore);
      break;
      
    case 'HOLD':
      await updateSaleStatus(saleId, 'ON_HOLD');
      await requestAdditionalInfo(saleId, signals);
      await notifyPartner(saleId, 'additional_verification_required');
      break;
      
    case 'REJECT':
      await updateSaleStatus(saleId, 'REJECTED');
      await processRefund(saleId);
      await suspendAffiliate(saleId);
      await logSecurityIncident(saleId, fraudScore);
      break;
  }
}
```

---

## 🔐 4. 데이터베이스 설계

### 4.1 FraudLog 테이블

```prisma
model AffiliateAuditLog {
  id                String       @id @default(cuid())
  saleId            String
  affiliateCode     String
  eventType         String       // 'FRAUD_CHECK' | 'FRAUD_DETECTED' | 'MANUAL_REVIEW' | 'APPROVED' | 'REJECTED'
  riskScore         Int
  riskLevel         String       // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  detectedSignals   String[]     // 감지된 사기 신호 배열
  recommendation    String       // 'APPROVE' | 'REVIEW' | 'HOLD' | 'REJECT'
  reviewedBy        String?      // 검토자 ID
  reviewedAt        DateTime?
  notes             String?
  createdAt         DateTime     @default(now())
  
  @@index([affiliateCode, createdAt])
  @@index([riskLevel])
  @@index([eventType])
}
```

---

## 📈 5. 모니터링 대시보드

### 5.1 사기 탐지 메트릭

```
┌───────────────────────────────────────────┐
│ 일일 사기 탐지 현황                        │
├───────────────────────────────────────────┤
│ 검사 건수:    1,234건                     │
│ 의심 건수:    45건 (3.6%)                 │
│  - LOW:       20건 (1.6%)                 │
│  - MEDIUM:    15건 (1.2%)                 │
│  - HIGH:      8건 (0.6%)                  │
│  - CRITICAL:  2건 (0.2%)                  │
│                                           │
│ 자동 승인율:  96.4%                       │
│ 평균 검사 시간: 245ms                     │
│ 거짓 양성율: 0.8% (오탐)                  │
└───────────────────────────────────────────┘
```

### 5.2 파트너별 위험 지표

| 파트너 | 거래수 | 거짓양성 | 환불율 | 분쟁율 | 위험도 | 상태 |
|--------|--------|---------|--------|--------|--------|------|
| P001 | 450 | 1 | 2.2% | 0.2% | LOW | ✅ 정상 |
| P002 | 890 | 3 | 5.6% | 0.5% | MEDIUM | ⚠️ 모니터링 |
| P003 | 45 | 8 | 28% | 4% | CRITICAL | 🔒 정지 |

---

## ✅ 6. 체크리스트

- [ ] 8가지 신호 탐지 엔진 구현
- [ ] Risk Scoring 알고리즘
- [ ] 자동 응답 규칙 엔진
- [ ] 사기 로그 기록 시스템
- [ ] 관리자 검토 대시보드
- [ ] 파트너별 위험 모니터링
- [ ] IP 평판 데이터 (기본 통합)
- [ ] VPN/Proxy 감지 서비스
- [ ] Geolocation 서비스
- [ ] 알림 시스템 (Slack, Email)
- [ ] 월별 사기 탐지 보고서
- [ ] 보안 감시 24/7

---

## 📚 Reference

- [[affiliate_commission_models.md]] - 수당 계산
- [[affiliate_tracking_system.md]] - 거래 추적
- [[affiliate_partner_dashboard.md]] - 파트너 대시보드
- [[affiliate_integration_architecture.md]] - 기술 아키텍처
