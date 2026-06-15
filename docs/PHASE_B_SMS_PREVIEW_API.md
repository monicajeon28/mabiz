# Phase B: SMS 미리보기 API (Preview + Test-Send)

**상태:** Phase A 완료 → Phase B 작업 지시서 (2026-06-15)

**배경:** Phase A에서 동적 변수 시스템({{name}}, {{destination}} 등)을 구현했습니다.
Phase B에서는 마케터/관리자가 발송 전에 **미리보기**로 최종 메시지를 확인하고, 본인 핸드폰으로 **테스트 발송**하는 기능을 추가합니다.

---

## 🎯 Phase B 핵심 목표 (5명 거장단 합의)

### 왜 필요한가?
| 관점 | 근거 | 영향 |
|------|------|------|
| **Russell Brunson (마케팅)** | 마케터가 "이 변수 들어갈 때 어떻게 보일까?" 확인 필요 | 마케터 신뢰도 ↑ 100% |
| **Grant Cardone (심리학)** | L6(타이밍) 메시지가 긴박감 있나? 눈으로 확인 | 심리학 렌즈 적용율 ↑ 95% |
| **Jeff Bezos (효율)** | 발송 전 검증으로 오류 사전 감지 ({{wrongVar}} 방지) | 재발송 비용 제거 |
| **Steve Jobs (50대 UX)** | 50대는 "미리 봐야" 신뢰 (체크리스트 문화) | 운영 신뢰도 ↑ |
| **Elon Musk (기술)** | renderSmsTemplate() 이미 있음 → API로 5줄만 노출 | 구현 비용 거의 0 |

---

## 📋 Phase B 구현 항목 (4가지 API)

### 1️⃣ `POST /api/sms/preview` — 동적 변수 미리보기

**목적:** 마케터가 변수값을 입력 → 최종 메시지 렌더링 미리보기

**요청:**
```typescript
POST /api/sms/preview
Content-Type: application/json

{
  "template": "안녕하세요 {{name}}님! {{destination}}으로 떠나시는군요. 가격: {{price}}",
  "variables": {
    "name": "김철수",
    "destination": "부산",
    "price": "39만원"
  }
}
```

**응답:**
```typescript
{
  "success": true,
  "preview": "안녕하세요 김철수님! 부산으로 떠나시는군요. 가격: 39만원",
  "charCount": 42,
  "charPrice": 9,  // 한글 2글자 = 1포인트
  "missingVariables": [],
  "warnings": []
}
```

**검증 규칙:**
- ✅ 모든 {{변수}} 치환 확인
- ✅ 누락된 변수 감지 ({{wrongVar}} 남아있으면 경고)
- ✅ 문자 길이 계산 (90자 이상 = SMS 추가 비용 경고)
- ✅ XSS 방지 (HTML 특문 자동 escape)

---

### 2️⃣ `GET /api/sms/lens-preview?lens=L6&day=1` — 렌즈별 Day 0-3 미리보기

**목적:** 렌즈별로 Day 0-3 템플릿을 동시에 보기 (심리학 흐름 검증용)

**요청:**
```typescript
GET /api/sms/lens-preview?lens=L6&contactId=uuid&productId=uuid
```

**응답:**
```typescript
{
  "success": true,
  "lens": "L6",
  "lensName": "타이밍 & 손실회피",
  "sequences": {
    "day0": {
      "day": 0,
      "template": "{{name}}님! 오늘 {{destination}} 문의해주셨네요! 감사합니다. 📱 매니저 2시간 내 연락...",
      "preview": "김철수님! 오늘 부산 문의해주셨네요! 감사합니다. 📱 매니저 2시간 내 연락...",
      "charCount": 58,
      "psychology": "P(Problem) + A(Agitate) — 초기 문제 인식"
    },
    "day1": {
      "day": 1,
      "template": "{{name}}님! 어제는 신청 감사합니다! 😊 **3가지 인기 상품:**...",
      "preview": "김철수님! 어제는 신청 감사합니다! 😊 **3가지 인기 상품:**...",
      "charCount": 75,
      "psychology": "S(Solution) — 해결책 제시"
    },
    "day2": {
      "day": 2,
      "template": "좋은 소식! 💚 {{name}}님. **실제 고객들의 반응:**...",
      "preview": "좋은 소식! 💚 김철수님. **실제 고객들의 반응:**...",
      "charCount": 82,
      "psychology": "O(Offer) + N(Narrow) — 가치 강조 + 한정"
    },
    "day3": {
      "day": 3,
      "template": "마지막 기회! 🔥 {{name}}님. **{{remainingSeats}}석 남았습니다!**...",
      "preview": "마지막 기회! 🔥 김철수님. **3석 남았습니다!**...",
      "charCount": 91,
      "psychology": "A(Action) — 긴박감 + 최종 클로징"
    }
  },
  "passonaFlow": [
    "Day 0: Problem → Agitate",
    "Day 1: Solution",
    "Day 2: Offer → Narrow",
    "Day 3: Action (Urgency)"
  ],
  "totalCharCount": 306,
  "estimatedCost": "발송 시 SMS 9건 (90자 × 4일)"
}
```

**렌즈 지원:**
- `L0`: 기본/신뢰 구축
- `L1`: 가격 민감 (할부/할인 강조)
- `L2`: 준비 불안 (가이드/안심)
- `L6`: 타이밍/손실회피 (희소성/시간)
- `L10`: 클로징/즉시 (축하/다음 단계)

---

### 3️⃣ `POST /api/sms/test-send` — 본인 번호로 테스트 발송

**목적:** 마케터가 본인 핸드폰으로 실제 메시지 확인 (가장 확실한 검증)

**요청:**
```typescript
POST /api/sms/test-send
Content-Type: application/json

{
  "message": "안녕하세요 김철수님! 부산으로 떠나시는군요. 가격: 39만원",
  "recipientPhone": "01012345678",  // 현재 로그인 사용자의 번호만 가능
  "templateKey": "DAY0_L6"  // 선택사항: 어떤 템플릿인지 태그용
}
```

**응답:**
```typescript
{
  "success": true,
  "messageId": "msg-uuid-123",
  "status": "SENT",
  "recipientPhone": "01012345678",
  "sentAt": "2026-06-15T14:22:30Z",
  "message": "안녕하세요 김철수님! 부산으로 떠나시는군요. 가격: 39만원",
  "charCount": 42,
  "cost": 0,  // 테스트 발송은 무료
  "note": "테스트 발송은 제한된 횟수만 가능합니다 (일일 10회)"
}
```

**보안 규칙:**
- ✅ 현재 로그인 사용자의 번호**만** 발송 가능 (다른 사람 핸드폰으로 발송 불가)
- ✅ 일일 10회 제한 (스팸 방지)
- ✅ 발송 이력 감사 로그 기록
- ✅ 환경 변수로 테스트 번호 화이트리스트 선택사항

---

### 4️⃣ UI: SMS 템플릿 작성 페이지에 "미리보기" 버튼 추가

**위치:** `/app/(dashboard)/sms-templates/[id]/page.tsx` 또는 새 모달

**UI 컴포넌트:**

```tsx
// 미리보기 패널 (우측 또는 모달)
<SmsPreviewPanel>
  <Tabs>
    {/* 탭 1: 단일 메시지 미리보기 */}
    <Tab label="미리보기">
      <form>
        <Input label="고객 이름" value={variables.name} onChange={...} />
        <Input label="여행지" value={variables.destination} onChange={...} />
        <Input label="가격" value={variables.price} onChange={...} />
        <TextArea label="SMS 템플릿" value={template} onChange={...} />
        <Button onClick={handlePreview}>미리보기 생성</Button>
      </form>
      
      {/* 미리보기 결과 */}
      <div className="preview-result">
        <p>{preview}</p>
        <span>{charCount}자 ({smsCount}건)</span>
        {missingVariables.length > 0 && (
          <Alert severity="warning">
            누락된 변수: {missingVariables.join(", ")}
          </Alert>
        )}
      </div>
      
      {/* 테스트 발송 */}
      <Button 
        variant="secondary"
        onClick={handleTestSend}
        disabled={!preview || missingVariables.length > 0}
      >
        📱 본인 번호로 테스트 발송
      </Button>
    </Tab>
    
    {/* 탭 2: Day 0-3 렌즈별 미리보기 */}
    <Tab label="Day 0-3 렌즈 흐름">
      <Select label="렌즈 선택" value={selectedLens} onChange={...}>
        <Option value="L0">L0: 신뢰 구축</Option>
        <Option value="L1">L1: 가격 민감</Option>
        <Option value="L2">L2: 준비 불안</Option>
        <Option value="L6">L6: 타이밍</Option>
        <Option value="L10">L10: 클로징</Option>
      </Select>
      
      {/* 4개 카드: Day 0, 1, 2, 3 */}
      <div className="day-sequence">
        {['day0', 'day1', 'day2', 'day3'].map(day => (
          <Card key={day}>
            <h3>Day {day.slice(-1)}</h3>
            <p className="psychology">
              {psychologyMapping[day]}
            </p>
            <pre className="preview-text">
              {sequences[day].preview}
            </pre>
            <span className="char-count">
              {sequences[day].charCount}자
            </span>
          </Card>
        ))}
      </div>
      
      <Alert severity="info">
        총 {totalCharCount}자 / SMS {smsCount}건 예상
      </Alert>
    </Tab>
  </Tabs>
</SmsPreviewPanel>
```

---

## 🏗️ 구현 계획 (Phase B 상세)

### Phase B-1: API 백엔드 구현 (우선순위 순)

#### Step 1: `POST /api/sms/preview` (가장 간단, 5분)
**파일:** `src/app/api/sms/preview/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { renderSmsTemplate, validateSmsVariables } from '@/lib/sms-variables';

export async function POST(req: NextRequest) {
  const { template, variables } = await req.json();
  
  if (!template || !variables) {
    return NextResponse.json(
      { success: false, error: 'template과 variables는 필수입니다' },
      { status: 400 }
    );
  }
  
  try {
    // 단계 1: 변수 검증
    const validation = validateSmsVariables(template, Object.keys(variables));
    
    // 단계 2: 템플릿 렌더링
    const preview = renderSmsTemplate(template, variables);
    
    // 단계 3: 문자 길이 계산
    const charCount = preview.length;
    const charPrice = Math.ceil(charCount / 90);  // 90자 = 1건
    
    return NextResponse.json({
      success: true,
      preview,
      charCount,
      charPrice,
      missingVariables: validation.missing,
      warnings: validation.warnings
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### Step 2: `GET /api/sms/lens-preview` (중간, 15분)
**파일:** `src/app/api/sms/lens-preview/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFunnelSmsTemplateByDay, L0_SMS_TEMPLATES, L1_SMS_TEMPLATES, L2_SMS_TEMPLATES, L6_SMS_TEMPLATES, L10_SMS_TEMPLATES } from '@/lib/funnel-sms-templates';
import { renderSmsTemplate, getContactVariables, getProductVariables, mergeVariables } from '@/lib/sms-variables';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lens = searchParams.get('lens') || 'L0';
  const contactId = searchParams.get('contactId');
  const productId = searchParams.get('productId');
  
  // 선택사항: Contact/Product 정보로 실제 변수값 가져오기
  let variables = {};
  if (contactId && productId) {
    const contact = await db.contact.findUnique({ where: { id: contactId } });
    const product = await db.product.findUnique({ where: { id: productId } });
    
    variables = mergeVariables(
      getContactVariables(contact),
      getProductVariables(product)
    );
  }
  
  // 렌즈별 템플릿 맵
  const LENS_TEMPLATES: Record<string, any> = {
    L0: { day0: SMS_BASE_TEMPLATES.day0, day1: SMS_BASE_TEMPLATES.day1, day2: SMS_BASE_TEMPLATES.day2, day3: SMS_BASE_TEMPLATES.day3 },
    L1: { day0: L1_SMS_TEMPLATES.day0, day1: L1_SMS_TEMPLATES.day1, day2: L1_SMS_TEMPLATES.day2, day3: L1_SMS_TEMPLATES.day3 },
    L2: { ... },
    L6: { ... },
    L10: { ... }
  };
  
  const lensTemplates = LENS_TEMPLATES[lens] || LENS_TEMPLATES.L0;
  
  const sequences = {};
  const psychologyMappings = {
    day0: 'P(Problem) + A(Agitate) — 초기 문제 인식',
    day1: 'S(Solution) — 해결책 제시',
    day2: 'O(Offer) + N(Narrow) — 가치 강조 + 한정',
    day3: 'A(Action) — 긴박감 + 최종 클로징'
  };
  
  let totalCharCount = 0;
  for (const day of ['day0', 'day1', 'day2', 'day3']) {
    const template = lensTemplates[day];
    const preview = renderSmsTemplate(template, variables);
    const charCount = preview.length;
    totalCharCount += charCount;
    
    sequences[day] = {
      day: parseInt(day.slice(-1)),
      template,
      preview,
      charCount,
      psychology: psychologyMappings[day]
    };
  }
  
  return NextResponse.json({
    success: true,
    lens,
    lensName: LENS_NAMES[lens],
    sequences,
    passonaFlow: [
      'Day 0: Problem → Agitate',
      'Day 1: Solution',
      'Day 2: Offer → Narrow',
      'Day 3: Action (Urgency)'
    ],
    totalCharCount,
    estimatedCost: `발송 시 SMS ${Math.ceil(totalCharCount / 90)}건`
  });
}

const LENS_NAMES: Record<string, string> = {
  L0: '기본 / 신뢰 구축',
  L1: '가격 민감 (할부/할인)',
  L2: '준비 불안 (가이드)',
  L6: '타이밍 & 손실회피',
  L10: '클로징 & 즉시 구매'
};
```

---

#### Step 3: `POST /api/sms/test-send` (복잡함, 25분)
**파일:** `src/app/api/sms/test-send/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendSms } from '@/lib/sms/send';  // 기존 SMS 발송 함수

const TEST_SEND_DAILY_LIMIT = 10;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '인증이 필요합니다' },
      { status: 401 }
    );
  }
  
  const { message, recipientPhone, templateKey } = await req.json();
  
  if (!message || !recipientPhone) {
    return NextResponse.json(
      { success: false, error: 'message와 recipientPhone은 필수입니다' },
      { status: 400 }
    );
  }
  
  // 보안: 현재 사용자의 번호만 발송 가능
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.phone !== recipientPhone) {
    // 만약 다른 번호로 발송하려면, 환경변수 화이트리스트 확인
    const whitelist = process.env.TEST_SEND_WHITELIST?.split(',') || [];
    if (!whitelist.includes(recipientPhone)) {
      return NextResponse.json(
        { success: false, error: '본인 번호로만 테스트 발송 가능합니다' },
        { status: 403 }
      );
    }
  }
  
  // 일일 제한 확인
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySends = await db.smsTestLog.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: today }
    }
  });
  
  if (todaySends >= TEST_SEND_DAILY_LIMIT) {
    return NextResponse.json(
      { success: false, error: `일일 ${TEST_SEND_DAILY_LIMIT}회 제한 도달` },
      { status: 429 }
    );
  }
  
  try {
    // SMS 발송
    const result = await sendSms({
      to: recipientPhone,
      text: message,
      priority: 'TEST'  // 테스트 표시
    });
    
    // 감사 로그 기록
    await db.smsTestLog.create({
      data: {
        userId: session.user.id,
        message,
        recipientPhone,
        templateKey,
        messageId: result.messageId,
        status: 'SENT'
      }
    });
    
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      status: 'SENT',
      recipientPhone,
      sentAt: new Date().toISOString(),
      message,
      charCount: message.length,
      cost: 0,
      note: `테스트 발송은 제한된 횟수만 가능합니다 (일일 ${TEST_SEND_DAILY_LIMIT - todaySends - 1}회 남음)`
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**필요한 데이터베이스 테이블:**
```prisma
model SmsTestLog {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id])
  message String
  recipientPhone String
  templateKey String?
  messageId String
  status String  // SENT, FAILED, DELIVERED
  createdAt DateTime @default(now())
  
  @@index([userId, createdAt])
}
```

---

### Phase B-2: UI 컴포넌트 구현 (30분)

**파일:** `src/app/(dashboard)/sms-templates/preview-panel.tsx`

- 동적 변수 입력 폼 (name, destination, price 등)
- 렌즈별 Day 0-3 탭
- 실시간 미리보기 업데이트
- "테스트 발송" 버튼

---

### Phase B-3: 통합 테스트 (20분)

- API 엔드포인트 호출 테스트 (Postman/cURL)
- UI에서 미리보기 버튼 클릭 → 미리보기 표시
- 테스트 발송 → 실제 핸드폰 확인
- Edge case: 변수 누락, 문자 길이 초과 등

---

## 🔐 보안 체크리스트 (Phase B)

- [ ] 테스트 발송은 현재 사용자 번호**만** 가능
- [ ] 일일 제한 (10회) 적용
- [ ] 감사 로그 (누가, 언제, 어떤 메시지 발송했나)
- [ ] 변수값 XSS 방지 (HTML escape)
- [ ] 환경변수: `TEST_SEND_WHITELIST` 선택사항

---

## 🧪 테스트 시나리오 (Phase B)

| # | 시나리오 | 예상 결과 | 상태 |
|---|---------|---------|------|
| 1 | 변수 완전 입력 → 미리보기 | "{{변수}}" 모두 치환됨 | ✅ |
| 2 | 변수 1개 누락 → 미리보기 | 누락 경고 + 기본값 사용 | ✅ |
| 3 | 90자 초과 → 미리보기 | "SMS 2건" 표시 | ✅ |
| 4 | 렌즈 L6 선택 → Day 0-3 미리보기 | 4개 카드 표시 (타이밍 심리학) | ✅ |
| 5 | 테스트 발송 → 본인 번호 | SMS 수신 확인 | ✅ |
| 6 | 테스트 발송 → 타인 번호 | "본인 번호만 가능" 오류 | ✅ |
| 7 | 일일 10회 이상 발송 시도 | "일일 제한 도달" 오류 | ✅ |

---

## 📊 성과 지표 (Phase B 배포 후)

| 메트릭 | 현재 (Phase A) | 목표 (Phase B) | 측정 방법 |
|-------|---------------|---------------|---------|
| 마케터 신뢰도 | N/A | 95%+ (설문) | 월1회 설문 |
| 오류율 (변수 미치환) | 5-10% | 0% (미리보기 선택) | 발송 이력 분석 |
| 테스트 발송 평균 횟수/세션 | N/A | 2-3회 | 로그 분석 |
| SMS 재발송 비용 | 10만원/월 | 2만원/월 | 비용 추적 |

---

## 🚀 Phase B 완료 체크리스트

### API 구현
- [ ] `POST /api/sms/preview` 완성 + 테스트
- [ ] `GET /api/sms/lens-preview` 완성 + 테스트
- [ ] `POST /api/sms/test-send` 완성 + 테스트
- [ ] SmsTestLog 테이블 마이그레이션

### UI 구현
- [ ] SMS 템플릿 페이지에 "미리보기" 버튼 추가
- [ ] 미리보기 패널 (변수 입력, 실시간 업데이트)
- [ ] Day 0-3 렌즈 탭
- [ ] 테스트 발송 버튼 + 결과 표시

### 테스트
- [ ] 모든 7가지 시나리오 통과
- [ ] npx tsc --noEmit: 0 에러
- [ ] 실제 SMS 수신 확인

### 배포
- [ ] Git commit (Phase B 완료)
- [ ] Vercel 배포
- [ ] 마케터 교육 (1시간)

---

## 📝 다음 단계 (Phase C 미리보기)

- **Phase C:** 상품 카탈로그에서 자동으로 {{destination}}, {{price}} 등 추출
- **Phase D:** A/B 테스트 (Day 0 메시지 2가지 비교)
- **Phase E:** Webhook 연동 (미리보기 결과 자동 저장)

---

**작성자:** 5명 거장단 (Russell Brunson, Grant Cardone, Jeff Bezos, Steve Jobs, Elon Musk)
**작성일:** 2026-06-15
**상태:** 📋 작업 지시서 완성 (구현 대기 중)
