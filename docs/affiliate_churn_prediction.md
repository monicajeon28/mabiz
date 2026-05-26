# Affiliate Partner Churn Prediction & Retention (2026-05-26)

## 1. 개요: Churn Risk Score

파트너의 이탈 위험도를 0-100 점수로 정량화하고, 위험 신호를 조기에 감지하여 자동 개입 절차를 실행합니다.

### 1.1 Churn 정의

```
Churn = Partner가 6개월 이상 활동하지 않거나
        계약을 명시적으로 종료하는 상황

Churn 비용:
  - Lost Commission: 월 $20K × 6개월 = $120K
  - Onboarding 새 Partner: $5K
  - 고객 손실: $50K-500K (제휴 고객 중단)
  
합계: 1 Partner Churn = $175K-625K 손실
```

### 1.2 목표

```
현재 Churn Rate: 40% (매년)
목표 Churn Rate: 15% (매년) ← 62% 개선

경제 효과:
  현재: 100 Partners × 40% × $200K = $8M 손실
  목표: 100 Partners × 15% × $200K = $3M 손실
  절감: $5M/년
```

---

## 2. Churn Risk Score 4가지 신호

### 2.1 신호 1: 활동 급감 (Activity Decline) - 가중치 35%

**지표**:
```
recentActivityScore = (
  (contactsReached_last30days / contactsReached_avg60days) * 40% +
  (smssSent_last30days / smssSent_avg60days) * 30% +
  (callsMade_last30days / callsMade_avg60days) * 30%
) * 100

activityDeclineScore = 100 - recentActivityScore

기준:
  > 80: 심각한 감소 (위험)
  50-80: 중간 정도 감소
  < 50: 정상 범위
```

**예시**:
```
Partner A:
  지난 60일 평균: 월 100명 접촉
  지난 30일: 월 30명 접촉
  Activity Decline = 100 - (30/100 * 100) = 70점 (높은 위험)
```

### 2.2 신호 2: 성과 저하 (Performance Decline) - 가중치 35%

**지표**:
```
recentPerformance = (
  (conversionRate_last60days - conversionRate_avg180days) / conversionRate_avg180days
)

performanceDeclinesScore = MAX(0, -recentPerformance * 100)

기준:
  > 50: 전환율 50% 이상 하락 (심각)
  30-50: 30-50% 하락 (중간)
  < 30: 정상 범위
```

**예시**:
```
Partner B:
  6개월 평균 전환율: 20%
  지난 2개월 전환율: 8%
  Decline = (8-20) / 20 * 100 = -60%
  performanceDeclineScore = 60점 (높은 위험)
```

### 2.3 신호 3: 커뮤니티 고립 (Disengagement) - 가중치 20%

**지표**:
```
disengagementScore = (
  (daysSinceLastMeeting / 30) * 30% +    // 마지막 면담 이후 일수
  (daysSinceLastTraining / 45) * 30% +   // 마지막 교육 이후 일수
  (communityPostCount_last30days == 0 ? 40 : 0) // 커뮤니티 침묵
) * 100

기준:
  > 60: 고립 상태 (심각)
  30-60: 부분 고립
  < 30: 정상 참여
```

**예시**:
```
Partner C:
  마지막 면담: 60일 전 → 60/30 * 30% = 60점
  마지막 교육: 90일 전 → 90/45 * 30% = 60점
  커뮤니티 참여: 0건 → 40점
  disengagementScore = (60+60+40) = 160점 → 100 (정규화)
  → 심각한 고립 상태
```

### 2.4 신호 4: 인프라 문제 (Technical/Financial Issues) - 가중치 10%

**지표**:
```
infrastructureRiskScore = (
  (failedPayments_last30days > 2 ? 60 : 0) +  // 지급 실패
  (contractDisputes > 0 ? 30 : 0) +           // 계약 분쟁
  (accountSuspensions > 0 ? 50 : 0) +         // 계정 중지
  (supportTickets_unresolved > 2 ? 20 : 0)    // 미해결 지원 요청
) / 160 * 100

기준:
  > 50: 심각한 시스템 문제
  20-50: 중간 정도 문제
  < 20: 정상
```

**예시**:
```
Partner D:
  지난 30일 지급 실패: 2회 → 60점
  미해결 지원 요청: 1개 → 0점
  infrastructureRiskScore = 60/160 * 100 = 37.5점
  → 중간 정도 위험
```

---

## 3. 통합 Churn Risk Score 계산

### 3.1 공식

```
churnRiskScore = (
  activityDeclineScore * 0.35 +
  performanceDeclineScore * 0.35 +
  disengagementScore * 0.20 +
  infrastructureRiskScore * 0.10
)

범위: 0-100 (점수가 높을수록 이탈 가능성 높음)

위험도 단계:
  0-20: LOW (녹색) ✅ 정상
  21-40: MEDIUM (노란색) ⚠️ 주의
  41-60: HIGH (주황색) ⚠️⚠️ 경고
  61-100: CRITICAL (빨간색) 🚨 긴급
```

### 3.2 구현

```typescript
async function calculateChurnRiskScore(partnerId: string): Promise<{
  overallScore: number;
  activityScore: number;
  performanceScore: number;
  disengagementScore: number;
  infrastructureScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  topRisks: string[]; // 상위 3개 위험 요인
  recommendedAction: string;
}> {
  const partner = await Partner.findOne({ id: partnerId });
  
  // 1. Activity Decline Score
  const last30days = await getPartnerMetrics(partnerId, 30);
  const last60days = await getPartnerMetrics(partnerId, 60);
  const activityScore = calculateActivityDecline(last30days, last60days);
  
  // 2. Performance Decline Score
  const last60daysPerf = await getConversionRate(partnerId, 60);
  const last180daysPerf = await getConversionRate(partnerId, 180);
  const performanceScore = calculatePerformanceDecline(last60daysPerf, last180daysPerf);
  
  // 3. Disengagement Score
  const lastMeetingDays = await daysSinceLastMeeting(partnerId);
  const lastTrainingDays = await daysSinceLastTraining(partnerId);
  const communityPosts = await communityPostCount(partnerId, 30);
  const disengagementScore = calculateDisengagement(
    lastMeetingDays,
    lastTrainingDays,
    communityPosts
  );
  
  // 4. Infrastructure Risk Score
  const failedPayments = await failedPaymentsCount(partnerId, 30);
  const disputes = await contractDisputesCount(partnerId);
  const suspensions = await accountSuspensionsCount(partnerId);
  const unresolved = await unresolvedTicketsCount(partnerId);
  const infrastructureScore = calculateInfrastructureRisk(
    failedPayments,
    disputes,
    suspensions,
    unresolved
  );
  
  // 5. 통합 점수
  const overallScore =
    activityScore * 0.35 +
    performanceScore * 0.35 +
    disengagementScore * 0.20 +
    infrastructureScore * 0.10;
  
  // 6. 위험도 판정
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (overallScore <= 20) riskLevel = "LOW";
  else if (overallScore <= 40) riskLevel = "MEDIUM";
  else if (overallScore <= 60) riskLevel = "HIGH";
  else riskLevel = "CRITICAL";
  
  // 7. 상위 위험 요인
  const topRisks = [
    activityScore > 40 ? `Activity Decline (${activityScore.toFixed(0)}점)` : null,
    performanceScore > 40 ? `Performance Drop (${performanceScore.toFixed(0)}점)` : null,
    disengagementScore > 40 ? `Community Disengagement (${disengagementScore.toFixed(0)}점)` : null,
    infrastructureScore > 40 ? `Technical Issues (${infrastructureScore.toFixed(0)}점)` : null,
  ].filter(r => r !== null) as string[];
  
  // 8. 권장 조치
  const recommendedAction = getRecommendedAction(riskLevel, topRisks);
  
  return {
    overallScore: parseFloat(overallScore.toFixed(1)),
    activityScore: parseFloat(activityScore.toFixed(1)),
    performanceScore: parseFloat(performanceScore.toFixed(1)),
    disengagementScore: parseFloat(disengagementScore.toFixed(1)),
    infrastructureScore: parseFloat(infrastructureScore.toFixed(1)),
    riskLevel,
    topRisks: topRisks.slice(0, 3),
    recommendedAction,
  };
}
```

---

## 4. Early Warning System (조기 경고)

### 4.1 자동 감지 트리거

```typescript
// 매일 오전 10시 실행
async function runDailyChurnRiskCheck() {
  const partners = await Partner.find({ status: "ACTIVE" });
  
  for (const partner of partners) {
    const { overallScore, riskLevel, topRisks } = await calculateChurnRiskScore(partner.id);
    
    // 1. CRITICAL (점수 61+): 즉시 알림 + 개입
    if (riskLevel === "CRITICAL") {
      await escalateToManager(partner, overallScore, topRisks);
      await createManualReviewTask(partner);
    }
    
    // 2. HIGH (점수 41-60): 24시간 내 자동 개입
    if (riskLevel === "HIGH" && !hasRecentIntervention(partner, 7)) {
      await scheduleAutomaticIntervention(partner, topRisks);
    }
    
    // 3. MEDIUM (점수 21-40): 주간 리뷰 대기열
    if (riskLevel === "MEDIUM" && partner.lastReviewAt < now() - 7 * 24 * 3600) {
      await addToWeeklyReviewQueue(partner);
    }
  }
}

// 실시간 트리거: 주요 이벤트 감지
async function triggerChurnRiskCheck(partnerId: string, event: string) {
  const { riskLevel } = await calculateChurnRiskScore(partnerId);
  
  const triggers = {
    "activity_zero_7days": riskLevel => riskLevel === "CRITICAL",
    "conversion_drop_50percent": riskLevel => riskLevel === "HIGH",
    "failed_payment": riskLevel => riskLevel === "HIGH",
    "support_ticket_escalation": riskLevel => riskLevel === "CRITICAL",
  };
  
  if (triggers[event]?.(riskLevel)) {
    await executeEmergencyIntervention(partnerId);
  }
}
```

### 4.2 Intervention Workflow

```
Risk Level: CRITICAL (점수 61+)
│
├─ 즉시 (30분 이내)
│  ├─ 매니저에게 Slack 알림 (심급함)
│  ├─ Partner에게 긴급 전화 시도
│  └─ CEO에게 보고 (점수 > 80인 경우)
│
├─ 1시간 이내
│  ├─ 1:1 전화 상담 (매니저)
│  │  └─ "최근 활동 감소를 알아차렸습니다. 어려움이 있으신가요?"
│  ├─ 장애물 파악
│  │  ├─ 기술적: API 문제? → 즉시 기술 지원
│  │  ├─ 금융: 지급 문제? → 계약 재협의
│  │  ├─ 교육: 능력 부족? → 무료 부스트 교육
│  │  └─ 동기: 성과 저조? → 인센티브 재계약
│  └─ 구체적 개선안 제시
│
├─ 24시간 이내
│  ├─ 서면 follow-up (이메일)
│  │  └─ 회의 내용 정리 + 구체적 지원 일정
│  ├─ 개선 계획 수립
│  │  └─ 30일 목표 설정 (예: 주 50명 접촉 → 주 100명)
│  └─ 전담 멘토 배정 (필요 시)
│
└─ 30일 모니터링
   ├─ 주 2회 체크인
   ├─ 진행 상황 추적
   └─ 목표 달성 시 보상 ($500-1K)

Risk Level: HIGH (점수 41-60)
│
├─ 3시간 이내
│  ├─ Partner에게 자동 이메일 발송
│  │  └─ "최근 성과 향상을 위해 지원하고 싶습니다"
│  └─ Slack으로 매니저 알림
│
├─ 24시간 이내
│  ├─ 선택적 전화 상담 (Partner가 응할 경우)
│  └─ 보상 프로그램 제안
│     ├─ 무료 교육 (1회)
│     ├─ 추가 1% commission (90일)
│     └─ VIP 마케팅 자료 액세스
│
└─ 7일 모니터링
   ├─ 점수 개선 → 리스트에서 제거
   └─ 점수 악화 → HIGH에서 CRITICAL로 상향

Risk Level: MEDIUM (점수 21-40)
│
└─ 주 1회 자동 리뷰
   └─ 필요 시에만 이메일 격려
```

---

## 5. Retention Strategy (유지 전략)

### 5.1 Proactive Engagement (사전 개입)

```typescript
// 월 1회: 높은 위험 파트너에게 개인 맞춤형 지원 제시
async function proactiveRetentionCampaign() {
  const mediumRiskPartners = await Partner.find({
    churnRiskScore: { $gte: 21, $lte: 40 }
  });
  
  for (const partner of mediumRiskPartners) {
    const personalizedOffer = generatePersonalizedRetentionOffer(partner);
    
    await sendEmail({
      to: partner.email,
      subject: `${partner.name}님께 특별한 제안입니다`,
      content: `
        안녕하세요, ${partner.displayName}님!
        
        최근 성과 데이터를 분석한 결과, 다음 부분에서 지원해드릴 수 있을 것 같습니다:
        
        ${personalizedOffer.recommendations.map(r => `• ${r}`).join('\n')}
        
        이번 달 특별하게 아래 혜택을 드립니다:
        • ${personalizedOffer.bonus}
        • ${personalizedOffer.incentive}
        
        관심 있으시면 [여기](link)를 클릭하거나 저에게 직접 연락주세요!
        
        응원합니다!
        Team Mabiz
      `,
      cta: "특별 제안 확인하기"
    });
  }
}

function generatePersonalizedRetentionOffer(partner: Partner) {
  const risks = await calculateChurnRiskScore(partner.id);
  
  if (risks.topRisks.includes("Activity Decline")) {
    return {
      recommendations: [
        "주간 3회 콜 스케줄링 (월요, 수요, 금요)",
        "AI 기반 자동 연락 도구 (시간 절약)",
        "주간 팀 회의 (동기부여)"
      ],
      bonus: "다음 3개월 commission +1%",
      incentive: "월 100명 접촉 달성 시 $500 보너스"
    };
  }
  
  if (risks.topRisks.includes("Performance Drop")) {
    return {
      recommendations: [
        "전환 전략 재교육 (1:1, 2시간)",
        "경쟁사 분석 자료 제공",
        "고객 이의 대응 워크샵"
      ],
      bonus: "이번 달 commission 2% UP",
      incentive: "전환율 20% 달성 시 $1K 보너스"
    };
  }
  
  // ... 기타 위험 요인별 커스텀 제안
}
```

### 5.2 Success Stories & Community (성공 사례 공유)

```typescript
// 월 2회: 높은 성과 파트너의 성공 스토리 공유
async function shareSuccessStories() {
  const topPerformers = await Partner.find({
    churnRiskScore: { $lt: 20 },
    monthlyRevenue: { $gte: 30000 }
  }).sort({ monthlyRevenue: -1 }).limit(5);
  
  for (const partner of topPerformers) {
    const story = generateSuccessStory(partner);
    
    await broadcastToGroup({
      channel: "partner_success",
      content: `
        🌟 이번주 성공 파트너: ${partner.displayName}님
        
        ${story.title}
        
        주요 성과:
        • 월 수익: $${partner.monthlyRevenue.toLocaleString()}
        • 전환율: ${(partner.conversionRate * 100).toFixed(1)}%
        • 접촉 고객: ${partner.contactsReachedLastMonth}명
        
        ${story.keyTactic}
        
        💬 ${partner.displayName}님의 팁:
        "${story.quote}"
        
        → 자세한 인터뷰는 [여기](link)를 클릭하세요!
      `
    });
  }
}
```

### 5.3 Community Events (정기 행사)

```
월별 이벤트:
┌──────────────────┬──────────────────────────────────┐
│ 행사 유형        │ 효과                              │
├──────────────────┼──────────────────────────────────┤
│ 월 1회 온라인    │ 동기부여 + 네트워킹               │
│ 웨비나           │ → Disengagement Score ↓           │
│ (수요일 10am)    │                                  │
├──────────────────┼──────────────────────────────────┤
│ 분기 1회 지역    │ 심화 교육 + 멘토링                │
│ 오프라인 워크숍  │ → Performance Score ↑             │
│ (토요일)         │                                  │
├──────────────────┼──────────────────────────────────┤
│ 반기 1회 전국    │ 상위 파트너 축하 + 신제품 런칭    │
│ 컨퍼런스         │ → 전사 동기부여                    │
│ (금토일 2박3일)  │                                  │
└──────────────────┴──────────────────────────────────┘

참가 인센티브:
• 전체: 행사 비용 전액 회사 부담 + 식사 제공
• Top 3 파트너: 추가 $500 참가비
• 신입: 멘토 매칭 + 1:1 코칭 (주 1회, 4주)
```

---

## 6. Retention Metrics 추적

### 6.1 대시보드

```
주간 리포팅 (매주 월요일):
┌──────────────────────────────┬────────┬─────────┐
│ 지표                         │ 현재   │ 목표    │
├──────────────────────────────┼────────┼─────────┤
│ Critical 파트너 수           │ 3명    │ <1명    │
│ High Risk 파트너 수          │ 8명    │ <5명    │
│ 주간 Churn                   │ 1명    │ <0.5명  │
│ 개입 성공률                  │ 65%    │ >80%    │
│ Tier Up (승격) 파트너        │ 2명    │ >3명    │
│ 평균 Risk Score              │ 35점   │ <25점   │
└──────────────────────────────┴────────┴─────────┘

월간 리포팅 (월초):
┌──────────────────────────────┬────────────┬─────────────┐
│ 지표                         │ 지난달     │ 누적 (YTD)  │
├──────────────────────────────┼────────────┼─────────────┤
│ Churn Rate                   │ 3.2%       │ 2.8%        │
│ Retention Rate               │ 96.8%      │ 97.2%       │
│ 개입 건수                    │ 45건       │ 210건       │
│ 개입 성공 건수               │ 29건       │ 140건       │
│ 회수된 Churn 위험 파트너      │ 14명       │ 68명        │
│ 절감 효과                    │ $560K      │ $2.7M       │
└──────────────────────────────┴────────────┴─────────────┘
```

### 6.2 ROI 계산

```
개입 비용:
• 월 1명 매니저 시간: $3K (0.5 FTE)
• 월 리테인션 프로그램: $2K (이벤트, 선물 등)
• 월 자동화 시스템 운영: $1K
= 월 총 $6K

개입 효과:
• Churn 50% 감소 (월 5명 → 2명)
• 절감 효과: 2명 × $200K = $400K/월
• ROI: $400K / $6K = 66.7배
```

---

## 7. 기대 효과

| 메트릭 | 현재 | 목표 (6개월) | 목표 (12개월) | 증가율 |
|--------|------|-------------|--------------|--------|
| **Churn Rate** | 40% | 25% | 15% | -62.5% |
| **Retention Rate** | 60% | 75% | 85% | +41.7% |
| **Critical Risk 파트너** | 12명 | 3명 | <1명 | -92% |
| **High Risk 파트너** | 25명 | 10명 | 5명 | -80% |
| **개입 성공률** | 45% | 70% | 85% | +89% |
| **절감 효과 (월)** | - | $800K | $1.2M | - |
| **장기 수익 영향** | - | +$4.8M | +$14.4M | - |

---

## 8. 구현 로드맵

### Phase 1 (2주): 기초 구축
- [ ] Churn Risk Score 계산 엔진 구현
- [ ] PartnerRiskFlags 데이터 수집
- [ ] 매일 아침 자동 계산 (Cron Job)

### Phase 2 (1개월): 조기 경고
- [ ] Early Warning System 구현
- [ ] Slack/이메일 알림 자동화
- [ ] 기본 개입 워크플로우

### Phase 3 (2개월): 자동화 개입
- [ ] Personalized Retention Offer 자동 생성
- [ ] Community Event 자동 스케줄링
- [ ] Success Stories 자동 생성 & 공유

### Phase 4 (3개월): 최적화
- [ ] A/B 테스트: 개입 전략 효과 측정
- [ ] 알고리즘 미세 조정 (Risk Score 기준)
- [ ] 월 ROI 리포팅 자동화

---

**다음 파일**: affiliate_partner_automation.md → Commission 자동 계산 & 지급
