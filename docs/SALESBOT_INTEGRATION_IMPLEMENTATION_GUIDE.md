# 세일즈봇 QnA PASONA 통합 구현 가이드

**작성**: 2026-05-19  
**대상**: 개발팀 + 담당자  
**목표**: 세일즈봇을 콜 스크립트와 실시간 통합하여 전환율 +7-10% 달성

---

## 📋 Contents

1. [개발팀용 - 기술 구현](#개발팀용-기술-구현)
2. [담당자용 - 사용 매뉴얼](#담당자용-사용-매뉴얼)
3. [자동 이메일 발송 설정](#자동-이메일-발송-설정)
4. [모니터링 & 최적화](#모니터링--최적화)

---

## 개발팀용 - 기술 구현

### Step 1: 데이터 구조 설계

#### 1.1 데이터베이스 스키마 (Prisma)

```prisma
// prisma/schema.prisma

model SalesbotQnACategory {
  id                  String    @id @default(cuid())
  categoryId          String    @unique  // "appetite_discovery", "product_story", etc.
  name                String             // "욕구 발굴"
  solutions           String[]           // ["Solution 1", "Solution 5"]
  useCase             String             // "고객이 여행을 망설일 때"
  triggerKeywords     String[]           // ["이유", "지금", "왜", "언제"]
  expectedImpact      String             // "+8% 전환율"
  qnaCount            Int                
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  qnas                SalesbotQnA[]

  @@map("salesbot_qna_categories")
}

model SalesbotQnA {
  id                  String    @id @default(cuid())
  qnaId               String    @unique  // "Q1", "Q2", etc.
  categoryId          String             // FK to category
  category            SalesbotQnACategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  question            String             // "지금 예약해야 하는 이유가 뭐에요?"
  answer              String    @db.Text // Long text answer
  solutions           String[]           // ["Solution 1 (손실회피)", "Solution 5 (기대감)"]
  psychology          String[]           // ["Scarcity", "Narrative Transportation"]
  
  targetStep          String[]           // ["STEP 2"], ["STEP 3", "STEP 4"]
  priority            String             // "P0", "P1", "P2"
  useContext          String[]           // ["초반 거부감", "가격 민감성"]
  similarTriggers     String[]           // ["지금", "왜 지금", "서두르는 이유"]
  
  conversionImpact    String             // "high", "very_high", "medium", "low"
  autoSendTrigger     String[]           // ["thinking", "hesitation"], ["product_inquiry"]
  
  usageCount          Int      @default(0)
  conversionCount     Int      @default(0)
  conversionRate      Float    @default(0.0)
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  @@map("salesbot_qnas")
  @@index([categoryId])
  @@index([priority])
  @@index([conversionImpact])
}

model SalesbotQnALog {
  id                  String    @id @default(cuid())
  qnaId               String
  qna                 SalesbotQnA @relation(fields: [qnaId], references: [id], onDelete: Cascade)
  
  contactId           String             // CRM Contact
  orgId               String
  
  useMode             String             // "realtime_reference", "auto_email", "chatbot_response"
  context             String    @db.Text // 콜 단계, 고객 상황 등
  
  userAction          String?            // "clicked", "sent", "opened", "converted"
  conversionResult    String?            // "yes", "no", "pending"
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  @@map("salesbot_qna_logs")
  @@index([contactId])
  @@index([qnaId])
  @@index([useMode])
  @@index([userAction])
}
```

#### 1.2 마이그레이션 SQL

```bash
npx prisma migrate dev --name add_salesbot_qna_pasona
```

### Step 2: API 엔드포인트

#### 2.1 QnA 카테고리별 조회 API

**엔드포인트**: `GET /api/salesbot/qna/categories`

```typescript
// src/app/api/salesbot/qna/categories/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth';

export const GET = withAuth(async (req, user) => {
  try {
    const categories = await prisma.salesbotQnACategory.findMany({
      include: {
        qnas: {
          select: {
            qnaId: true,
            question: true,
            answer: true,
            solutions: true,
            priority: true,
            usageCount: true,
            conversionRate: true,
          },
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 담당자 실시간 참고용이므로 캐시 짧음 (1분)
    return NextResponse.json(
      { success: true, categories },
      {
        headers: {
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
});
```

#### 2.2 특정 카테고리 QnA 조회

**엔드포인트**: `GET /api/salesbot/qna/category/[categoryId]`

```typescript
// src/app/api/salesbot/qna/category/[categoryId]/route.ts

export const GET = withAuth(async (req, user, { categoryId }) => {
  const { searchParams } = new URL(req.url);
  const step = searchParams.get('step'); // "STEP 2", "STEP 3" 필터링

  try {
    const qnas = await prisma.salesbotQnA.findMany({
      where: {
        category: { categoryId },
        ...(step && { targetStep: { hasSome: [step] } }),
      },
      select: {
        qnaId: true,
        question: true,
        answer: true,
        solutions: true,
        targetStep: true,
        priority: true,
        conversionRate: true,
      },
      orderBy: [
        { priority: 'asc' },
        { conversionRate: 'desc' },
      ],
    });

    return NextResponse.json({ success: true, qnas });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch QnA' },
      { status: 500 }
    );
  }
});
```

#### 2.3 QnA 사용 로그

**엔드포인트**: `POST /api/salesbot/qna/log`

```typescript
// src/app/api/salesbot/qna/log/route.ts

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const { qnaId, contactId, useMode, context, userAction, conversionResult } = body;

  try {
    // 로그 기록
    const log = await prisma.salesbotQnALog.create({
      data: {
        qnaId,
        contactId,
        orgId: user.organizationId,
        useMode,
        context,
        userAction,
        conversionResult,
      },
    });

    // 통계 업데이트
    if (userAction === 'viewed' || userAction === 'sent') {
      await prisma.salesbotQnA.update({
        where: { qnaId },
        data: { usageCount: { increment: 1 } },
      });
    }

    if (conversionResult === 'yes') {
      await prisma.salesbotQnA.update({
        where: { qnaId },
        data: {
          conversionCount: { increment: 1 },
        },
      });
      
      // 전환율 계산 (별도 배치 작업에서 정기적 실행)
    }

    return NextResponse.json({ success: true, log });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create log' },
      { status: 500 }
    );
  }
});
```

### Step 3: NLU 의도 분류 (Intent Classification)

#### 3.1 의도 분류 로직

```typescript
// src/lib/salesbot-intent-classifier.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

interface IntentResult {
  category: 'appetite_discovery' | 'product_story' | 'trust_formation' | 'learning_experience';
  step: 'STEP 1' | 'STEP 2' | 'STEP 3' | 'STEP 4' | 'STEP 5';
  confidence: number;
  triggerKeyword: string;
}

export async function classifyIntent(userInput: string): Promise<IntentResult> {
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `고객 질문을 분석하고 다음 JSON으로 응답해주세요:
{
  "category": "appetite_discovery" | "product_story" | "trust_formation" | "learning_experience",
  "step": "STEP 1" | "STEP 2" | "STEP 3" | "STEP 4" | "STEP 5",
  "confidence": 0.0-1.0,
  "triggerKeyword": "질문에서 추출한 핵심 키워드"
}

고객 질문:
"${userInput}"

카테고리별 특징:
- appetite_discovery: "지금", "왜", "언제", "이유" 등 - 손실회피와 기대감 자극
- product_story: "어떻게", "가격", "포함", "짐" 등 - 상품 구체적 설명
- trust_formation: "왜 저", "누구", "다른 회사" 등 - 신뢰감과 배타성
- learning_experience: "배울", "의미", "가치" 등 - 감정적 연결

Step은 콜 진행 단계를 고려해서 분류해주세요.`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type === 'text') {
      const result = JSON.parse(content.text);
      return result;
    }
  } catch (error) {
    // Fallback to keyword-based classification
    return classifyByKeywords(userInput);
  }

  return classifyByKeywords(userInput);
}

// Fallback: 키워드 기반 분류
function classifyByKeywords(input: string): IntentResult {
  const lower = input.toLowerCase();

  if (['지금', '왜', '언제', '이유', '서두르', '마감'].some(k => lower.includes(k))) {
    return {
      category: 'appetite_discovery',
      step: 'STEP 2',
      confidence: 0.8,
      triggerKeyword: '손실회피 & 기대감',
    };
  }

  if (['어떻게', '가격', '포함', '짐', '일정', '음식'].some(k => lower.includes(k))) {
    return {
      category: 'product_story',
      step: 'STEP 3',
      confidence: 0.8,
      triggerKeyword: '상품 설명',
    };
  }

  if (['왜', '누구', '다른', '회사', '신뢰', '선택'].some(k => lower.includes(k))) {
    return {
      category: 'trust_formation',
      step: 'STEP 1',
      confidence: 0.7,
      triggerKeyword: '신뢰감 형성',
    };
  }

  if (['배우', '의미', '가치', '인생', '최고'].some(k => lower.includes(k))) {
    return {
      category: 'learning_experience',
      step: 'STEP 5',
      confidence: 0.8,
      triggerKeyword: '경험의 가치',
    };
  }

  return {
    category: 'product_story',
    step: 'STEP 3',
    confidence: 0.5,
    triggerKeyword: 'default',
  };
}
```

#### 3.2 세일즈봇 자동 응답

```typescript
// src/app/api/salesbot/chat/route.ts

export const POST = withAuth(async (req, user) => {
  const { message, contactId } = await req.json();

  try {
    // 1. 의도 분류
    const intent = await classifyIntent(message);

    // 2. 해당 카테고리의 QnA 조회
    const qnas = await prisma.salesbotQnA.findMany({
      where: {
        category: { categoryId: intent.category },
        targetStep: { hasSome: [intent.step] },
      },
      orderBy: { priority: 'asc' },
      take: 5, // 상위 5개
    });

    // 3. 가장 관련성 높은 답변 선택
    const selectedQna = qnas[0]; // 또는 semantic similarity로 순위 재정렬

    // 4. 로그 기록
    await prisma.salesbotQnALog.create({
      data: {
        qnaId: selectedQna.qnaId,
        contactId,
        orgId: user.organizationId,
        useMode: 'chatbot_response',
        context: JSON.stringify({ intent, userMessage: message }),
        userAction: 'sent',
      },
    });

    return NextResponse.json({
      success: true,
      response: selectedQna.answer,
      qnaId: selectedQna.qnaId,
      category: intent.category,
      step: intent.step,
      solutions: selectedQna.solutions,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate response' },
      { status: 500 }
    );
  }
});
```

### Step 4: 담당자 실시간 참고 UI (Frontend)

#### 4.1 React 컴포넌트

```typescript
// src/app/components/SalesbotQnAPanel.tsx

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface QnAPanelProps {
  currentStep: 'STEP 1' | 'STEP 2' | 'STEP 3' | 'STEP 4' | 'STEP 5';
  contactId: string;
  onSelectQnA?: (qnaId: string) => void;
}

export function SalesbotQnAPanel({
  currentStep,
  contactId,
  onSelectQnA,
}: QnAPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 카테고리별 QnA 조회
  const { data: categories, isLoading } = useQuery({
    queryKey: ['salesbot-categories'],
    queryFn: async () => {
      const res = await fetch('/api/salesbot/qna/categories');
      return res.json();
    },
    staleTime: 60000, // 1분
  });

  // 현재 Step에 맞는 카테고리 필터링
  const relevantCategories = categories?.categories?.filter((cat: any) =>
    cat.qnas.some((q: any) => q.targetStep.includes(currentStep))
  ) || [];

  return (
    <div className="fixed right-0 top-0 w-80 h-screen bg-white border-l border-gray-200 overflow-y-auto shadow-lg">
      {/* 헤더 */}
      <div className="sticky top-0 bg-blue-50 p-4 border-b border-blue-200">
        <h3 className="font-bold text-sm text-blue-900">
          📌 세일즈봇 QnA 참고
        </h3>
        <p className="text-xs text-blue-600 mt-1">현재 Step: {currentStep}</p>
      </div>

      {/* 로딩 상태 */}
      {isLoading && <div className="p-4 text-center text-gray-500">로딩 중...</div>}

      {/* 카테고리 목록 */}
      <div className="p-4 space-y-3">
        {relevantCategories.map((category: any) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(
              selectedCategory === category.id ? null : category.id
            )}
            className={`w-full text-left p-3 rounded-lg border-2 transition ${
              selectedCategory === category.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-gray-50 hover:border-blue-300'
            }`}
          >
            <div className="font-semibold text-sm">{category.name}</div>
            <div className="text-xs text-gray-600 mt-1">{category.useCase}</div>
            <div className="text-xs text-blue-600 mt-2">
              Solution: {category.solutions.join(', ')}
            </div>
          </button>
        ))}
      </div>

      {/* QnA 상세 */}
      {selectedCategory && (
        <div className="p-4 border-t border-gray-200">
          {categories.categories
            .find((c: any) => c.id === selectedCategory)
            ?.qnas.map((q: any) => (
              <div
                key={q.qnaId}
                onClick={() => {
                  onSelectQnA?.(q.qnaId);
                  // 로그 기록
                  fetch('/api/salesbot/qna/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      qnaId: q.qnaId,
                      contactId,
                      useMode: 'realtime_reference',
                      context: currentStep,
                      userAction: 'clicked',
                    }),
                  });
                }}
                className="mb-4 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:shadow-md transition"
              >
                <div className="text-sm font-semibold text-gray-900">
                  {q.question}
                </div>
                <div className="text-xs text-gray-700 mt-2 leading-relaxed">
                  {q.answer}
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  💡 {q.solutions.join(' + ')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  전환율: {(q.conversionRate * 100).toFixed(1)}% | 사용: {q.usageCount}회
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
```

---

## 담당자용 - 사용 매뉴얼

### 📱 세일즈봇 QnA 앱 사용법

#### Step 1: 콜 시작 (STEP 1 - 오프닝, 0-2분)

```
1. 고객에게 전화
2. 우측 패널 "신뢰감 형성" 카테고리 열기
3. Q16-20 중 상황에 맞는 답변 참고
4. 자연스럽게 대화에 녹이기

예시:
고객: "왜 저한테 전화를 주셨어요?"
→ 세일즈봇 QnA: "모니카님 같은 특별한 고객분들께만..."
담당자: (Q16 답변을 참고하며) "모니카님, 저희가 모든 분께 전화를 드리지 않는데..."
```

#### Step 2: 욕구 발굴 (STEP 2, 2-5분)

```
1. 고객의 현 상황 파악 후, "욕구 발굴" 카테고리로 변경
2. Q1-5 참고 (고객의 거부감 수준에 따라 선택)
3. 특히 Q3 (크루즈 여행이 뭐가 좋아요?)가 감정 자극에 효과적

담당자 팁:
- Q1은 빠른 의사결정이 필요한 고객용
- Q3은 감정적 고객용
- Q5는 나이 많은 고객용
```

#### Step 3: 상품 설명 (STEP 3, 5-10분)

```
1. "상품 스토리" 카테고리로 변경
2. Q6-10 참고 (고객 세그먼트별)
   - 혼자 여행객 → Q9
   - 가족 동반 → Q10
   - 가격 민감 → Q8
   - 실용적 질문 → Q7, Q12-15

담당자 팁:
- Q8 (가격 질문)이 가장 자주 사용됨
- Q6-7의 조합이 설득력 높음
- 고객이 "어떻게" 물으면 Q6, Q12 먼저 보여주기
```

#### Step 4: 가격 & 이견 처리 (STEP 4, 10-13분)

```
1. 필요시 "욕구 발굴" + "신뢰감 형성" 재활용
2. Q2 (언제까지) + Q8 (가격) + Q18 (왜 이 회사)의 조합이 효과적

담당자 팁:
- 가격 이견 → Q8 + Q18 순서로
- 시간 압박이 약함 → Q2 강조
- 경쟁사 비교 → Q19 활용
```

#### Step 5: 클로징 (STEP 5, 13-15분)

```
1. "배움과 경험" 카테고리로 변경
2. Q21-25 참고 (감정적 강화)
3. 특히 Q22 (돈을 쓸 가치), Q24 (경험자) 추천

담당자 팁:
- 나이 많은 고객 → Q22, Q39 강조
- 가족 동반 → Q38 활용
- 마지막 거부감 → Q36 (후회 없음) 강조
- 의사결정 진행 중 → Q37-39 순서로 감정 강화
```

### 📊 실시간 활용 팁

| 상황 | 권장 QnA | 심리학 원리 |
|------|---------|-----------|
| 고객이 침묵 | Q3 (감정적 이미지) | Narrative Transportation |
| 가격 물음 | Q8 (포함 항목 명시) | Value Perception |
| "생각해볼게" | Q5 + Q22 (시간+의미) | Loss Aversion + Meaning |
| 경쟁사 언급 | Q18 + Q19 (차별성) | Brand Differentiation |
| 시간 부족 | Q2 + Q40 (마감 강조) | Scarcity |

---

## 자동 이메일 발송 설정

### 시나리오 1: "생각해볼게요" 응답

```typescript
// src/lib/cron/salesbot-auto-email.ts

export async function sendThinkingEmail(contact: Contact) {
  // 24시간 후 "욕구 발굴" 카테고리 Q1-3 자동 발송
  
  const qnas = await prisma.salesbotQnA.findMany({
    where: {
      category: { categoryId: 'appetite_discovery' },
      qnaId: { in: ['Q1', 'Q2', 'Q3'] },
    },
  });

  const emailBody = `
    <h2>모니카님, 다시 생각해보셨어요?</h2>
    
    <p>저희는 당신의 고민이 무엇인지 알아요.</p>
    
    ${qnas.map(q => `
      <div style="background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px;">
        <h4>${q.question}</h4>
        <p>${q.answer}</p>
      </div>
    `).join('')}
    
    <p>더 궁금한 점이 있으면 언제든지 전화 주세요.</p>
  `;

  await sendEmail({
    to: contact.email,
    subject: '모니카님, 크루즈 예약을 지금 결정하세요',
    body: emailBody,
  });

  // 로그 기록
  await prisma.salesbotQnALog.createMany({
    data: qnas.map(q => ({
      qnaId: q.qnaId,
      contactId: contact.id,
      orgId: contact.organizationId,
      useMode: 'auto_email',
      context: 'thinking',
      userAction: 'sent',
    })),
  });
}
```

### 시나리오 2: 2일 후 감정적 재접촉

```typescript
export async function sendEmotionalReminderEmail(contact: Contact) {
  // 2일 후 "배움과 경험" 카테고리 Q15-16 발송
  
  const qnas = await prisma.salesbotQnA.findMany({
    where: {
      category: { categoryId: 'learning_experience' },
      qnaId: { in: ['Q15', 'Q16', 'Q22'] },
    },
  });

  const emailBody = `
    <h2>모니카님에게</h2>
    
    <p>지금 이 순간을 놓칠까봐 우리가 다시 연락드립니다.</p>
    
    ${qnas.map(q => `...`).join('')}
    
    <a href="...예약링크...">지금 예약하기</a>
  `;

  // 발송...
}
```

### 스케줄 설정 (Cron)

```typescript
// src/app/api/cron/salesbot-email/route.ts

export async function GET() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 어제 "thinking" 상태로 끝난 콜 조회
  const contacts = await prisma.contact.findMany({
    where: {
      status: 'thinking',
      updatedAt: {
        gte: yesterday,
      },
    },
  });

  for (const contact of contacts) {
    await sendThinkingEmail(contact);
  }

  return NextResponse.json({ success: true, sent: contacts.length });
}
```

---

## 모니터링 & 최적화

### 대시보드 쿼리

```typescript
// src/lib/salesbot-metrics.ts

export async function getSalesbotMetrics(orgId: string, period = 'week') {
  const startDate = getPeriodStart(period);

  const logs = await prisma.salesbotQnALog.findMany({
    where: {
      orgId,
      createdAt: { gte: startDate },
    },
  });

  // 카테고리별 사용도
  const categoryUsage = await prisma.salesbotQnALog.groupBy({
    by: ['qnaId'],
    where: { orgId, createdAt: { gte: startDate } },
    _count: { id: true },
    _sum: { conversionResult: true }, // "yes" count
  });

  // Top QnAs (전환율 기준)
  const topQnas = await prisma.salesbotQnA.findMany({
    where: { orgId },
    orderBy: { conversionRate: 'desc' },
    take: 10,
  });

  // Step별 성과
  const stepMetrics = ['STEP 1', 'STEP 2', 'STEP 3', 'STEP 4', 'STEP 5'].map(step => {
    const stepLogs = logs.filter(l => l.context.includes(step));
    const conversions = stepLogs.filter(l => l.conversionResult === 'yes').length;
    
    return {
      step,
      totalUsage: stepLogs.length,
      conversions,
      conversionRate: stepLogs.length > 0 ? conversions / stepLogs.length : 0,
    };
  });

  return {
    categoryUsage,
    topQnas,
    stepMetrics,
    totalUsage: logs.length,
    totalConversions: logs.filter(l => l.conversionResult === 'yes').length,
    overallConversionRate: logs.length > 0 
      ? logs.filter(l => l.conversionResult === 'yes').length / logs.length 
      : 0,
  };
}
```

### 주간 리포트 생성

```typescript
export async function generateWeeklyReport(orgId: string) {
  const metrics = await getSalesbotMetrics(orgId, 'week');

  return {
    title: '세일즈봇 QnA 주간 리포트',
    period: 'This Week',
    summary: `
      총 사용: ${metrics.totalUsage}회
      전환율: ${(metrics.overallConversionRate * 100).toFixed(1)}%
      톱 QnA: ${metrics.topQnas[0].qnaId} (${(metrics.topQnas[0].conversionRate * 100).toFixed(1)}%)
    `,
    stepMetrics: metrics.stepMetrics,
    recommendations: generateRecommendations(metrics),
  };
}
```

---

## 🎯 성공 기준

| 지표 | Week 1 | Week 2 | Week 3 | 최종 목표 |
|------|--------|--------|--------|---------|
| **담당자 사용율** | 40% | 65% | 85% | 90% 이상 |
| **평균 전환율** | - | +3% | +5% | +7-10% |
| **자동 이메일 오픈율** | 25% | 32% | 38% | 35% 이상 |
| **QnA 카테고리 분류 정확도** | 85% | 92% | 95% | 95% 이상 |

---

## 🚀 배포 체크리스트

- [ ] 데이터 마이그레이션 (60개 Q&A)
- [ ] API 엔드포인트 구현 (4개)
- [ ] NLU 의도 분류 테스트
- [ ] UI 컴포넌트 구현
- [ ] 담당자 교육 (2시간)
- [ ] A/B 테스트 그룹 설정
- [ ] 자동 이메일 스케줄 설정
- [ ] 모니터링 대시보드 구현
- [ ] Vercel 배포

**예상 시간**: 3-4주 (개발 1주 + 테스트 1주 + 최적화 1-2주)

---

## 📞 문의 및 피드백

- 기술 문제: dev@mabiz.com
- 운영 문제: ops@mabiz.com
- 담당자 피드백: team@mabiz.com
