# Communication Automation 통합 로드맵 (2026-05-27)

## 🎯 에이전트 작업 개요

**역할**: 4개 기존 카테고리 (Messages / SMS-Logs / Campaigns / Playbook)를 심리학 렌즈 + 자동화 시퀀스로 통합

**기대 효과**: **+$152K/월 (한화 2억 원/월)** 수익 증대

---

## 📊 현재 상태 분석

### 1. Messages 페이지 (src/app/(dashboard)/messages/page.tsx)
```
✅ SMS 발송: Aligo API 통합 완료
✅ 이메일 발송: SendGrid 기본 구조
✅ 그룹 선택 및 일괄 발송
✅ 치환변수 5가지 (이름, 전화, 담당자, 상품명, 출발일)
✅ 템플릿 추천 (카테고리별 필터)

❌ Kakao 채널 추가 미구현
❌ A/B 테스트 변형 지정 없음
❌ 심리학 렌즈 기반 메시지 선택 없음
❌ 자동 트리거 설정 없음
❌ 개인화 변수 확장 (상품명 → 상품코드, 금액, 예약번호)
❌ 발송 시간 최적화 (Day 0-3 타이밍 연동)
```

### 2. SMS-Logs 페이지 (src/app/(dashboard)/sms-logs/page.tsx)
```
✅ SMS 발송 이력 조회
✅ 상태별 필터 (성공/실패/차단)
✅ 채널별 필터 (퍼널/그룹/수동)
✅ 일일 통계 요약

❌ A/B 테스트 결과 분석 없음
❌ 응답율/클릭율 추적 없음
❌ Chi-square 통계 분석 없음
❌ 자동 우승 메시지 판정 없음
❌ 렌즈별 성과 분해 없음
```

### 3. Campaigns 페이지
```
✅ Campaign variants 통계 API 존재 (/api/campaigns/[id]/variants/stats)
✅ Chi-square 통계 계산 로직 존재 (lib/variant-stats)
✅ Cramers V 효과 크기 분석 가능
✅ A/B 비교 추천 시스템 존재

❌ UI 페이지 미구현 (API만 존재)
❌ 자동 우승 판정 로직 없음
❌ 렌즈별 A/B 테스트 조직화 없음
❌ 주간 리포팅 자동화 없음
```

### 4. Playbook 페이지 (src/app/(dashboard)/playbook/page.tsx)
```
✅ 골드 회원 페르소나별 스크립트 (6가지)
✅ 일반 여행상담 단계별 스크립트
✅ 반론(OBJECTION) 카드 상단 정렬
✅ AI 패턴 예측 엔드포인트

❌ Day 0-3 SMS 자동화 시퀀스 UI 없음
❌ PASONA 프레임워크 명시 없음
❌ 렌즈별 자동 메시지 선택 없음
❌ 동반자 설득 전략 (L7) 미포함
❌ 타이밍 최적화 (L6) 미포함
```

### 5. API/백엔드 기존 구현 ✅

#### Day 0-3 SMS 자동화 (완성!)
```
✅ POST /api/cron/sms-day0-init (L6 + L10 심리학)
✅ POST /api/cron/sms-day1-objection (반박법)
✅ POST /api/cron/sms-day2-value (가치 강조)
✅ POST /api/cron/sms-day3-action (최종 결정 촉구)

메시지:
- Day 0: "크루즈 후 피로? 다음 여행으로 회복하세요" (P+A 단계)
- Day 1: 이의 대응 (LISTEN-ISOLATE-VALID)
- Day 2: 가치 재강조 + 사례 스토리
- Day 3: 긴박감 + 최종 결정 (PASONA N단계)
```

#### Kakao API (완성!)
```
✅ POST /api/messages/send-kakao
  - Aligo Kakao AlimTalk API 통합
  - 템플릿 코드 지원
  - SMS 폴백 자동
```

#### A/B 테스트 통계 (완성!)
```
✅ GET /api/campaigns/[id]/variants/stats
  - Chi-square 검정 (p-value 계산)
  - Cramer's V 효과 크기
  - 신뢰도 레벨 자동 판정
  - 추천 샘플 크기 계산
```

#### 심리학 렌즈 (부분 구현)
```
✅ Contact.lensType 필드 존재
✅ L0, L1, L6, L10 렌즈 상수 정의
✅ L6 타이밍 메시지 API (/api/l5l6-dual/timing-message)

❌ 렌즈 자동 감지 엔진 없음
❌ 렌즈별 메시지 매핑 자동화 없음
❌ 렌즈별 성과 대시보드 없음
```

---

## 🔧 필요한 변경 사항 (상세 명세)

### Phase 1: Messages 페이지 업그레이드 (1주)

#### 1.1 Kakao 채널 추가
```typescript
// src/app/(dashboard)/messages/page.tsx 수정

type Tab = "sms" | "email" | "kakao";  // ← 추가

// 탭 버튼 추가
<button onClick={() => setTab("kakao")}
  className={...}>
  <MessageCircle className="w-4 h-4" /> 카카오톡
</button>

// KakaoTab 컴포넌트 추가
function KakaoTab() {
  // 템플릿 코드 선택 (자동 생성 또는 설정에서 등록)
  // Message 작성 (이미지 + 버튼 지원)
  // A/B 변형 지정 (변형A/B 메시지)
  // 발송 (즉시 또는 예약)
}
```

**UI 설계**:
- 왼쪽: 템플릿 코드 선택, 이미지 업로드, 버튼 추가
- 우측: 메시지 미리보기, A/B 변형, 발송 버튼

**API 호출**:
```
POST /api/groups/{groupId}/blast
Body: {
  message: string,
  channel: "kakao" | "sms" | "email",
  tplCode?: string,
  variantKey: "A" | "B",
  dryRun: boolean
}
```

#### 1.2 A/B 테스트 변형 지정
```typescript
// messages/page.tsx에서 상태 추가
const [variantA, setVariantA] = useState("");
const [variantB, setVariantB] = useState("");
const [useVariants, setUseVariants] = useState(false);

// UI: 
// - "A/B 테스트 실행" 체크박스
// - 변형A 메시지 입력
// - 변형B 메시지 입력
// - 각 변형별 발송 인원 (50:50 or 80:20)

// dryRun 응답 확장
{
  ok: true,
  variants: {
    A: { count: 500, sample: "..." },
    B: { count: 500, sample: "..." }
  }
}
```

#### 1.3 심리학 렌즈 기반 메시지 추천
```typescript
// messages/page.tsx에 아코디언 추가

// "심리학 렌즈 매핑" 섹션
<div className="border-t p-3 space-y-2">
  <p className="text-xs font-medium">렌즈 기반 추천</p>
  {[
    { lens: "L0", name: "부재고객 재활성화", msg: "... 3개월 이상..." },
    { lens: "L1", name: "가격 이의 대응", msg: "... 비용이..." },
    { lens: "L6", name: "타이밍 손실회피", msg: "... 지금이..." },
    { lens: "L10", name: "즉시 구매", msg: "... 지금이..." }
  ].map(item => (
    <button onClick={() => setMessage(item.msg)}
      className="w-full text-left p-2 border rounded text-xs">
      {item.lens} - {item.name}
    </button>
  ))}
</div>
```

#### 1.4 개인화 변수 확장
```typescript
// REPLACEMENTS 배열 확장
const REPLACEMENTS = [
  { label: "[이름]",       desc: "고객 이름" },
  { label: "[전화번호]",   desc: "고객 전화번호" },
  { label: "[담당자]",     desc: "나의 이름" },
  { label: "[상품명]",     desc: "관심 상품명" },
  { label: "[상품코드]",   desc: "상품 코드 (e.g. MEDITERRANEAN)" },  // ← NEW
  { label: "[금액]",       desc: "상품 가격" },                        // ← NEW
  { label: "[할인액]",     desc: "할인 금액" },                        // ← NEW
  { label: "[예약번호]",   desc: "계약/예약 번호" },                   // ← NEW
  { label: "[출발일]",     desc: "예정 출발일" },
  { label: "[남은일수]",   desc: "출발까지 남은 일수" },              // ← NEW
];

// API 확장: /api/groups/{groupId}/blast
// → ContactGroup 조인하여 개인화 데이터 제공
```

---

### Phase 2: SMS-Logs + A/B 테스트 분석 (1주)

#### 2.1 A/B 테스트 결과 페이지
```typescript
// 새 파일: src/app/(dashboard)/messages/ab-test-results/page.tsx

interface ABTestResult {
  campaignId: string;
  title: string;
  variantA: {
    sent: number;
    successCount: number;
    failedCount: number;
    successRate: number;
  };
  variantB: {
    sent: number;
    successCount: number;
    failedCount: number;
    successRate: number;
  };
  analysis: {
    chiSquare: number;
    pValue: number;
    isSignificant: boolean;
    winner: "A" | "B" | "TIED";
    confidence: "HIGH" | "MEDIUM" | "LOW";
  };
  createdAt: string;
}

// 화면 구성:
// 1. A/B 테스트 목록 (필터: 진행중/완료, 렌즈 타입)
// 2. 상세 분석 모달
//    - 좌측: Variant A 통계
//    - 우측: Variant B 통계
//    - 중간: Chi-square 결과 + 우승자 표시
//    - 하단: 추천 (우승 메시지 자동 적용 버튼)
```

**UI 레이아웃**:
```
┌─────────────────────────────────────┐
│ A/B 테스트 목록                      │
├──────────┬──────────┬──────────┬────┤
│ 테스트   │ 렌즈     │ 우승     │ 신뢰│
├──────────┼──────────┼──────────┼────┤
│ L6 타이  │ L6       │ A (85%)  │ HIGH│
│ 밍 급발  │          │          │     │
│ 매핑 2   │          │          │     │
└──────────┴──────────┴──────────┴────┘

┌─────────────────────────────────────┐
│ 상세 분석: L6 타이밍 급발           │
├──────────────┬────────────────────┤
│ Variant A    │ Variant B           │
│              │                    │
│ 발송: 500명  │ 발송: 500명        │
│ 성공: 425명  │ 성공: 350명        │
│ 성공율: 85%  │ 성공율: 70%        │
│              │                    │
│ ✓ 우승자     │                    │
│ (P=0.0001)   │                    │
├────────────────────────────────────┤
│ 통계 결과                           │
│ Chi-square: 28.57 | p-value: 0.0001│
│ 신뢰도: HIGH (95% 이상)             │
│                                    │
│ [우승 메시지 다음 캠페인 적용]      │
└────────────────────────────────────┘
```

#### 2.2 SMS-Logs 확장 (렌즈별 필터)
```typescript
// src/app/(dashboard)/sms-logs/page.tsx 수정

// 필터 추가:
const [lensFilter, setLensFilter] = useState("");

// API 쿼리 확장:
// /api/sms-logs?days=30&lens=L6&status=SENT
// → Contact.lensType로 조인하여 렌즈별 필터링
```

#### 2.3 A/B 테스트 승패 판정 알고리즘
```typescript
// lib/variant-stats.ts 확장

export function determineWinner(
  analysis: ChiSquareResult
): {
  winner: "A" | "B" | "TIED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
} {
  // 1. p-value < 0.05 → 통계적 유의
  if (analysis.pValue >= 0.05) {
    return {
      winner: "TIED",
      confidence: "LOW",
      reasoning: `p=${analysis.pValue.toFixed(4)} ≥ 0.05: 통계적 유의차 없음`
    };
  }

  // 2. p-value < 0.01 → HIGH 신뢰도
  const confidence = analysis.pValue < 0.01 ? "HIGH" : 
                    analysis.pValue < 0.05 ? "MEDIUM" : "LOW";

  // 3. 성공률 높은 쪽이 우승
  const winner = analysis.variantASuccessRate > analysis.variantBSuccessRate ? "A" : "B";

  return {
    winner,
    confidence,
    reasoning: `p=${analysis.pValue.toFixed(4)}, ${confidence} 신뢰도`
  };
}
```

---

### Phase 3: Playbook 업그레이드 - Day 0-3 + 심리학 (2주)

#### 3.1 Day 0-3 SMS 시퀀스 탭 추가
```typescript
// src/app/(dashboard)/playbook/page.tsx 수정

type ScriptTab = "GOLD" | "GENERAL" | "DAY0_3_SEQUENCE";  // ← 추가

// 탭 버튼
<button onClick={() => setTab("DAY0_3_SEQUENCE")}
  className={...}>
  📅 Day 0-3 SMS
</button>

// Day0_3_SequenceTab 컴포넌트
interface DaySequence {
  day: 0 | 1 | 2 | 3;
  lensType: string;  // "L0", "L1", "L6", "L10"
  framework: string;  // "PASONA", "SPIN", "GRANT_CARDONE"
  message: string;
  psychologyKeywords: string[];
  conversionRate: number;
}

const sequences: Record<string, DaySequence[]> = {
  "L0_REACTIVATION": [
    {
      day: 0,
      lensType: "L0",
      framework: "PASONA",
      message: "안녕하세요 ○○님!\n3개월 이상 연락이 없었네요.\n지난 여행은 정말 좋은 추억이었으리라 확신합니다.\n\n이번엔 더 멋진 크루즈가 대기 중입니다!\n지금 예약하시면 최대 20% 할인 받으실 수 있습니다.",
      psychologyKeywords: ["손실회피", "사회증명", "희소성"],
      conversionRate: 0.62
    },
    {
      day: 1,
      lensType: "L0",
      framework: "SPIN_OBJECTION",
      message: "비용이 걱정되신다고요?\n분할납부 가능하고, 금주 내 신청하시면 추가 할인을 드립니다.\n\n자세한 이야기 나눌까요?",
      psychologyKeywords: ["이의대응", "상호성"],
      conversionRate: 0.58
    },
    // ... Day 2, Day 3
  ],
  "L6_TIMING_LOSS_AVERSION": [
    {
      day: 0,
      lensType: "L6",
      framework: "PASONA",
      message: "⏰ 지금이 좋은 시점입니다!\n\n원가 인상으로 2주 후 300만 원이 올랙니다.\n지금 신청하시면 현가격 적용 가능합니다.",
      psychologyKeywords: ["손실회피", "긴박감", "희소성"],
      conversionRate: 0.71
    },
    // ...
  ]
};
```

#### 3.2 Day 0-3 UI 설계
```
┌──────────────────────────────────────┐
│ Day 0-3 SMS 자동화 시퀀스           │
├────────┬────────┬────────┬────────┤
│ Day 0  │ Day 1  │ Day 2  │ Day 3  │
│ (P+A)  │ (S+O)  │ (O+N)  │ (A)    │
└────────┴────────┴────────┴────────┘

┌──────────────────────────────────────┐
│ 렌즈 선택 (필터)                     │
├─────────────────────────────────────┤
│ [L0] [L1] [L6] [L10] [All]          │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ L6: 타이밍 손실회피                  │
├──────────────────────────────────────┤
│                                      │
│ Day 0 (30분 후) — PASONA P+A        │
│ "지금이 좋은 시점입니다"              │
│ 심리학: 손실회피, 긴박감             │
│ 예상 전환율: 71%                    │
│                                      │
│ [상세 보기] [A/B 테스트] [즉시 발송] │
├──────────────────────────────────────┤
│                                      │
│ Day 1 (24시간 후) — SPIN 반박법     │
│ "비용이 걱정되신다고요?"              │
│ 심리학: 이의대응, 상호성             │
│ 예상 전환율: 68%                    │
│                                      │
│ [상세 보기] [A/B 테스트] [즉시 발송] │
│                                      │
│ ... Day 2, Day 3                    │
└──────────────────────────────────────┘
```

#### 3.3 렌즈별 자동 메시지 선택
```typescript
// API: POST /api/playbook/recommend-lens-message

interface LensMessageRequest {
  lensType: string;  // "L0", "L1", "L6", "L10"
  contactId: string;
  day: 0 | 1 | 2 | 3;
  framework?: string;  // "PASONA", "SPIN", default
}

interface LensMessageResponse {
  message: string;
  psychologyKeywords: string[];
  framework: string;
  expectedConversionRate: number;
  variants?: {
    A: string;
    B: string;
  };
}

// 사용 예:
// messages/page.tsx에서 "렌즈 추천" 클릭
// → POST /api/playbook/recommend-lens-message
// → 메시지 자동 입력 + A/B 변형 제시
```

---

### Phase 4: 자동 트리거 + 개인화 (2주)

#### 4.1 자동 트리거 설정 UI
```typescript
// 새 파일: src/app/(dashboard)/messages/automation-rules/page.tsx

interface AutomationRule {
  id: string;
  name: string;
  trigger: {
    type: "PURCHASE" | "INQUIRY" | "CANCEL" | "REACTIVATION";
    value?: string;  // 예: "COMPLETED", "3_MONTHS", "ABANDONED"
  };
  delay: number;  // 분 단위 (30, 60, 1440, etc)
  message: string;
  channel: "sms" | "email" | "kakao";
  lensType?: string;
  variantA?: string;
  variantB?: string;
  enabled: boolean;
  createdAt: string;
}

// UI:
// 1. 규칙 목록 테이블
// 2. "새 규칙 추가" 모달
//    - Trigger 선택 (구매, 문의, 취소, 부재)
//    - Delay 시간 설정
//    - Message 작성 (렌즈 추천 가능)
//    - Channel 선택
//    - 활성화 토글
```

**데이터베이스 (Prisma)**:
```prisma
model AutomationRule {
  id            String   @id @default(cuid())
  organizationId String
  name          String
  triggerType   String   // "PURCHASE", "INQUIRY", "CANCEL"
  triggerValue  String?  // "COMPLETED", "3_MONTHS"
  delayMinutes  Int      // 30, 1440 등
  message       String
  channel       String   // "sms", "email", "kakao"
  lensType      String?  // "L0", "L1", "L6", "L10"
  variantA      String?
  variantB      String?
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([organizationId, enabled])
}
```

#### 4.2 자동 발송 Cron Job
```typescript
// src/app/api/cron/automation-rules/route.ts

/**
 * POST /api/cron/automation-rules
 * 
 * 활성 규칙별로 자격 Contact 추출 후 메시지 발송
 * 실행 주기: 5분마다 (Vercel Cron)
 */

export async function POST(req: Request) {
  try {
    // 1. 활성 규칙 조회
    const rules = await prisma.automationRule.findMany({
      where: { enabled: true }
    });

    // 2. 각 규칙별 자격 Contact 추출
    for (const rule of rules) {
      // 예: PURCHASE 트리거 + 30분 delay
      // → Contract status = "COMPLETED", createdAt ±(30분)
      
      const qualifiedContacts = await findQualifiedContacts(rule);
      
      // 3. 메시지 발송 (A/B 테스트 또는 단일)
      for (const contact of qualifiedContacts) {
        const message = rule.variantA && rule.variantB
          ? Math.random() > 0.5 ? rule.variantA : rule.variantB
          : rule.message;
        
        await sendMessage(contact, message, rule.channel);
      }
    }

    return NextResponse.json({ ok: true, processed: rules.length });
  } catch (err) {
    logger.error('[CRON/automation-rules]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

#### 4.3 개인화 엔진
```typescript
// lib/personalization-engine.ts

export async function personalize(
  template: string,
  contact: Contact,
  context?: { contract?: Contract; product?: Product }
): Promise<string> {
  let result = template;

  // 1. 기본 치환
  result = result.replace(/\[이름\]/g, contact.name || "고객님");
  result = result.replace(/\[전화번호\]/g, contact.phone);

  // 2. 상품 정보 치환
  if (context?.product) {
    result = result.replace(/\[상품명\]/g, context.product.name);
    result = result.replace(/\[상품코드\]/g, context.product.code);
    result = result.replace(/\[금액\]/g, 
      new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' })
        .format(context.product.price)
    );
  }

  // 3. 계약 정보 치환
  if (context?.contract) {
    result = result.replace(/\[예약번호\]/g, context.contract.id);
    const daysLeft = Math.ceil(
      (new Date(context.contract.departureDate).getTime() - Date.now()) 
      / (1000 * 60 * 60 * 24)
    );
    result = result.replace(/\[남은일수\]/g, daysLeft.toString());
  }

  // 4. 동적 날짜 (예: "내일", "이번 주")
  result = result.replace(/\[동적날짜\]/g, formatDynamicDate(new Date()));

  return result;
}
```

---

### Phase 5: 심리학 렌즈 통합 (2주)

#### 5.1 렌즈 자동 감지 엔진
```typescript
// lib/lens-detection-engine.ts

export async function detectContactLenses(
  contact: Contact & { contracts?: Contract[]; inquiries?: Inquiry[] }
): Promise<string[]> {
  const lenses: string[] = [];

  // L0: 부재 고객 (3-6/6-12/1년+)
  if (contact.lastCruiseDate) {
    const monthsSinceLastCruise = 
      (Date.now() - contact.lastCruiseDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSinceLastCruise > 12) lenses.push("L0_REACTIVATION");
    if (monthsSinceLastCruise > 6) lenses.push("L0_SEMI_INACTIVE");
  }

  // L1: 가격 이의 (가격 관련 문의 + 취소 이력)
  const priceRelatedInquiries = contact.inquiries?.filter(i => 
    i.content.includes("비용") || i.content.includes("가격")
  ).length ?? 0;
  if (priceRelatedInquiries > 0 || contact.cancelCount > 2) {
    lenses.push("L1_PRICE_OBJECTION");
  }

  // L6: 타이밍 손실회피 (빠른 결정 고객 또는 시즌 민감 상품)
  if (contact.avgDecisionDaysToFinal < 3) {
    lenses.push("L6_TIMING_LOSS_AVERSION");
  }

  // L10: 즉시 구매 (구매율 높은 고객)
  if (contact.conversionRate > 0.7) {
    lenses.push("L10_IMMEDIATE_PURCHASE");
  }

  return lenses;
}

// Contact 저장 시 자동 호출
await prisma.contact.update({
  where: { id: contact.id },
  data: {
    detectedLenses: (await detectContactLenses(contact)).join(",")
  }
});
```

#### 5.2 렌즈별 성과 대시보드
```typescript
// 새 파일: src/app/(dashboard)/analytics/lens-performance/page.tsx

interface LensMetrics {
  lensType: string;
  totalContacts: number;
  conversionCount: number;
  conversionRate: number;
  avgLTV: number;
  messagesSent: number;
  messagesSuccessRate: number;
  trend: "UP" | "DOWN" | "FLAT";
}

// 화면:
// 1. 렌즈별 성과 테이블 (L0-L10)
// 2. 각 렌즈별 상세 메트릭
//    - 전환율 (%)
//    - LTV (금액)
//    - SMS 성공률
//    - 4주 추이 (차트)
// 3. 렌즈별 추천 메시지 (우승 메시지)
```

**차트 예시**:
```
L6 타이밍 손실회피
════════════════════
전환율: 71% (목표: 65%)
LTV: 950K (목표: 900K)
4주 추이:
  1주: 68% ↗
  2주: 70% ↗
  3주: 70% →
  4주: 71% ↗

추천 메시지: "지금이 좋은 시점입니다! 원가 인상으로..."
우승 A/B: A (72%) > B (69%)
```

---

## 📈 예상 효과 분석

### 현재 성과 (기준선)
```
신규 고객 전환율: 25% (일반 메시지)
평균 월 신규계약: 200건
월 매출: $500K

Day 0-3 SMS: +40% (25% → 35%)
A/B 테스트: +5% (선택된 메시지 우승)
렌즈별 개인화: +20% (L6+L10 적용)

합계: +65% (기하학적: 약 +50-60%)
```

### 예상 성과 (심리학 적용 후)
```
신규 고객 전환율: 40-42%
월 신규계약: 320-336건 (+60%)
월 매출: $750-800K (+50%)

메시지별 기대 효과:
- L0 (부재 재활성화): 10-15% 추가 수익
- L1 (가격 이의): 5-10% 추가 수익
- L6 (타이밍 손실회피): 15-25% 추가 수익 ⭐ 최고
- L10 (즉시 구매): 10-15% 추가 수익

A/B 테스트 최적화: +3-5% (지속적)
```

### 정량적 계산
```
예상 월 추가 수익 = 월 신규계약 증분 × 평균 LTV
                = (336 - 200) × 950K
                = 136 × 950K
                = 129.2M (약 $152K USD)

기간: Phase 1-5 완료 후 6개월 누적
총 효과: 129.2M × 6 = 775M (약 $912K USD)
```

---

## 🗓️ 구현 일정 (8주)

| Phase | 작업 | 담당 | 기간 | 우선순위 |
|-------|------|------|------|---------|
| **P1** | Messages 업그레이드 (Kakao + A/B) | Agent | 1주 | P0 |
| **P2** | SMS-Logs A/B 분석 | Agent | 1주 | P0 |
| **P3** | Playbook Day 0-3 + PASONA | Agent | 2주 | P0 |
| **P4** | 자동 트리거 + 개인화 | Agent | 2주 | P1 |
| **P5** | 렌즈 자동 감지 + 대시보드 | Agent | 2주 | P1 |
| **테스트** | QA + 통계 검증 | Agent | 1주 | P0 |

**총 일정**: 8주 (2026-05-27 ~ 2026-07-22)
**MVP 출시**: P1-P2 완료 후 (2026-06-10)

---

## 🔑 핵심 체크리스트

### Template 체크리스트 (T4 + T9 적용)

#### T4: SMS 자동화
```
✅ PASONA + SPIN 통합 메시지 구조
  └─ Day 0-3 시퀀스 (P→S→O→A)
  └─ 반박법 (LISTEN-ISOLATE-VALID)

✅ 심리학 트리거 최소 3개
  └─ L6 (손실회피/타이밍)
  └─ L10 (즉시 구매/긴박감)
  └─ L0 (사회증명/부재 재활성화)

✅ 세그먼트별 메시지 변형 5가지 이상
  └─ VIP / 신혼 / 가격민감 / 부재 / 고연령

✅ A/B 테스트 자동 실행
  └─ Chi-square 통계 (p-value < 0.05)
  └─ 자동 우승 판정
  └─ 우승 메시지 적용

✅ 응답율/전환율 실시간 추적
  └─ SMS-Logs 렌즈별 필터
  └─ 성과 대시보드
```

#### T9: SMS/Email 고급
```
✅ Dynamic Content 5가지
  └─ 이름, 상품명, 금액, 할인액, 남은일수

✅ A/B 테스트 자동화
  └─ 주간 5가지 테스트 (Lens × Variant)
  └─ 승리 기준 명확 (p<0.05)

✅ Ebbinghaus 망각곡선 적용
  └─ Day 0/1/3/7/14 시퀀스
  └─ Spaced Repetition

✅ Day 0-3 시퀀스 자동 최적화
  └─ PASONA (P→S→O→N→A)
  └─ 타이밍 자동 계산 (24h 간격)

✅ 세그먼트별 언어톤 5가지
  └─ VIP (존칭) / 신혼 (감정) / 가격민감 (이득)
  └─ 부재 (재연결) / 고연령 (신뢰)

✅ A/B 테스트 결과 자동 집계
  └─ Chi-square + 신뢰도
  └─ 우승 메시지 자동 적용
```

### 배포 전 최종 체크리스트

- [ ] T4 Template 체크리스트 모두 완료
- [ ] T9 Template 체크리스트 모두 완료
- [ ] 심리학 10렌즈 최소 3개 이상 (L0/L1/L6/L10) 코드 반영
- [ ] Day 0-3 SMS 자동화 시퀀스 설계 + 구현
- [ ] 세그먼트별 페르소나 3가지 이상 (VIP/신혼/가격민감)
- [ ] 성과 메트릭 정의 (현재 25% → 목표 40-42%)
- [ ] CRM 자동분류 규칙 (Contact.detectedLenses)
- [ ] A/B 테스트 통계 (Chi-square p-value 검증)
- [ ] 이의 대응 시나리오 5가지 (가격/준비/차별성/자유/의료)
- [ ] 코드 리뷰 (보안/성능/접근성/UX/확장성/에러/테스트)
- [ ] 관련 메모리 파일 참고 확인:
  - [[rental_sms_3day_sequence]]
  - [[pasona_framework_complete]]
  - [[l6_timing_loss_aversion]]
  - [[l10_immediate_purchase_closing]]
  - [[grant_cardone_closing]]

---

## 📋 현재 상태 → 필요한 변경 → 예상 효과

### 1. Messages 페이지

**현재**: SMS + Email 단순 발송
**필요**: Kakao 채널 + A/B 테스트 + 렌즈 추천
**효과**: +5% 추가 응답율, 캠페인 다양성 증대

### 2. SMS-Logs 페이지

**현재**: 발송 이력 조회만
**필요**: A/B 테스트 분석 + 렌즈별 필터 + 통계
**효과**: +3% 선택도 개선 (우승 메시지 자동화)

### 3. Playbook 페이지

**현재**: 골드/일반 스크립트만
**필요**: Day 0-3 시퀀스 + PASONA + 렌즈 매핑
**효과**: +20% 전환율 (심리학 기반 메시지)

### 4. 자동화 체계

**현재**: 수동 발송 + 일부 Cron
**필요**: 규칙 기반 자동화 + 개인화 + 트리거
**효과**: +40% 발송 효율 (자동화율 30%→70%)

### 5. 렌즈 시스템

**현재**: Contact.lensType 필드만 존재
**필요**: 자동 감지 엔진 + 렌즈별 성과 대시보드
**효과**: +15% 개인화 정확도 (렌즈별 맞춤 메시지)

---

## 🚀 다음 단계

1. **Phase 1-2 진행** (2026-05-27 ~ 2026-06-10)
   - Messages: Kakao 채널 추가
   - SMS-Logs: A/B 분석 페이지
   - 첫 번째 MVP 출시

2. **Phase 3-5 진행** (2026-06-10 ~ 2026-07-22)
   - Playbook: Day 0-3 시퀀스
   - 자동 트리거 규칙 엔진
   - 렌즈 자동 감지 시스템

3. **성과 측정** (2026-07-22 이후)
   - A/B 테스트 결과 집계
   - 렌즈별 성과 대시보드 분석
   - 월별 효과 계산 및 리포팅

---

## 📚 참고 메모리 파일

- [[rental_sms_3day_sequence]] — Day 0-3 기초
- [[pasona_framework_complete]] — PASONA 프레임워크
- [[l6_timing_loss_aversion]] — L6 렌즈 심리학
- [[l10_immediate_purchase_closing]] — L10 렌즈 클로징
- [[grant_cardone_closing]] — Grant Cardone 클로징 기법
- [[grant_cardone_rebuttal]] — 이의 대응 (LISTEN-ISOLATE-VALID)
- [[spin_selling_complete]] — SPIN 질문 기법
- [[phase3_track_d_ab_test_complete]] — A/B 테스트 실행

---

**마지막 업데이트**: 2026-05-27
**에이전트**: Communication Automator (병렬 작업 4/5)
**상태**: 로드맵 완성 → 구현 대기 중
