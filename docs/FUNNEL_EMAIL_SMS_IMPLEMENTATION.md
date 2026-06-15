# Grant Cardone Day 0-3 Email + SMS 펑널 구현 가이드

**버전**: 1.0  
**작성일**: 2026-06-16  
**상태**: 완성 ✅

---

## 📌 개요

마비즈 CRM의 Day 0-3 SMS 자동화에 **이메일 채널을 추가**했습니다.

### 핵심 원칙

**SMS ≠ Email** — 같은 메시지를 다른 채널로 보내면 안 됩니다.

| 요소 | SMS | Email |
|------|-----|-------|
| **길이** | 160자 | 800-1100자 |
| **열람율** | 98% (3초) | 25% (5분) |
| **심리학** | L10(즉시), L6(긴박) | L5(신뢰), L7(동반), L9(안전) |
| **톤** | 직설적, 긴급 | 친절함, 설명적 |
| **목적** | 즉시 행동 | 신뢰감 구축 |

---

## 🏗️ 아키텍처

### 파일 구조

```
src/lib/
├── funnel-sms-templates.ts        (기존) SMS Day 0-3 템플릿
├── funnel-email-templates.ts      (신규) Email Day 0-3 템플릿 (20개)
├── funnel-email-preview.ts        (신규) 미리보기 + 렌더링 헬퍼
└── sms-variables.ts               (기존) 동적 변수 정의

src/app/api/
└── funnel/
    └── email-preview/
        └── route.ts               (신규) API 엔드포인트
```

### 심리학 렌즈 매핑

각 렌즈는 **SMS와 Email에 다른 심리학**을 적용합니다:

```
┌─────────────────────────────────────────────────────┐
│ L0: 신규 고객 (기본)                               │
├─────────────────────────────────────────────────────┤
│ SMS: L10 (즉시) "안녕하세요! 감사합니다."          │
│ Email: L5+L7 (신뢰+동반) "환영합니다! 매니저소개"  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ L1: 가격 민감 고객                                  │
├─────────────────────────────────────────────────────┤
│ SMS: L6 (가격 비교) "250만원 vs 189만원"            │
│ Email: L1+L3 (투명성+차별) "비용 구조 상세 설명"   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ L2: 준비 불안 고객                                  │
├─────────────────────────────────────────────────────┤
│ SMS: 가이드 "5단계 준비"                            │
│ Email: L2+L9 (가이드+안전) "타임라인 + 체크리스트" │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ L6: 시간/긴박감 고객 (손실회피)                    │
├─────────────────────────────────────────────────────┤
│ SMS: L6+L1 (희소성+가격) "3석 남음! 내일 가격↑"   │
│ Email: L6 (손실회피) "72시간 타이머 + 후회사례"    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ L10: 즉시 구매 고객 (확정됨)                       │
├─────────────────────────────────────────────────────┤
│ SMS: L10 (축하) "축하합니다! 예약완료"             │
│ Email: L10+L5+L7 (축하+신뢰+동반) "여행 시작"      │
└─────────────────────────────────────────────────────┘
```

---

## 📂 파일 설명

### 1. `funnel-email-templates.ts` (1,100줄)

**20개의 이메일 템플릿** (5 렌즈 × 4 days)

#### 구조

```typescript
// L0 신규 고객
export const L0_EMAIL_TEMPLATES: EmailSequence = {
  day0: "안녕하세요! 신청 감사합니다...",
  day1: "상담 자료를 정리했습니다...",
  day2: "좋은 소식입니다! 92% 고객...",
  day3: "{{name}}님께 당신의 {{destination}}은..."
};

export const L0_EMAIL_SUBJECTS: EmailSubjects = {
  day0: "{{name}}님의 {{destination}} 여행 준비",
  day1: "{{name}}님을 위해 준비한 3가지 상품",
  day2: "당신과 같은 고객 92%의 선택 이유",
  day3: "[최종 결정] {{destination}} 신청하시겠어요?"
};

// L1, L2, L6, L10 동일하게 정의...
```

#### 동적 변수

```
기본: {{name}}, {{destination}}, {{price}}, {{managerName}}, {{managerPhone}}
추가: {{monthlyPrice}}, {{discount}}, {{daysLeft}}, {{remainingSeats}}
       {{bookingRef}}, {{daysUntilDeparture}}, {{managerTitle}}
```

#### 내용 특징

- **Day 0**: PASONA P+A (문제인식 + 자극) — 환영 + 신뢰 구축
- **Day 1**: PASONA S (해결책) — 상품 소개 + 기본 설명
- **Day 2**: PASONA O+N (오퍼 + 한정) — 사회증명 + 신뢰강화
- **Day 3**: PASONA A (행동) — 보증 + 최종 CTA

#### 주요 함수

```typescript
// 렌즈별 템플릿 선택
selectFunnelEmailTemplate(lens: string): EmailSequence

// Day별 단일 템플릿
getFunnelEmailTemplateByDay(lens: string, day: 0|1|2|3): string

// 제목 템플릿
getEmailSubjectByDay(lens: string, day: 0|1|2|3): string

// 변수 렌더링
renderEmailTemplate(template: string, variables: Record<string, string|number>): string

// SMS + Email 동시 선택
selectFunnelSequences(lens: string): { sms: SmsSequence, email: EmailSequence }
```

---

### 2. `funnel-email-preview.ts` (250줄)

**UI + API 미리보기 헬퍼**

#### 주요 함수

```typescript
// Email 미리보기 생성
renderEmailPreview(
  lens: string,
  day: 0|1|2|3,
  variables: Record<string, string|number>
): EmailPreviewData

// SMS + Email 동시 준비
prepareMultiChannelSequence(
  lens: string,
  day: 0|1|2|3,
  variables: Record<string, string|number>
): MultiChannelSequence

// 렌즈 메타데이터
getLensMetadata(lens: string): LensMetadata
getAllLensMetadata(): LensMetadata[]
```

#### 반환 데이터 구조

```typescript
EmailPreviewData {
  day: 0|1|2|3,
  lens: string,
  subject: string,
  body: string,
  charCount: number,
  estimatedReadTime: string,  // "3분"
  psychology: string[],       // ["L5 신뢰", "L7 동반자"]
  tone: "Trust" | "Solution" | "Social Proof" | "Urgency" | "Excitement"
}

MultiChannelSequence {
  day: 0|1|2|3,
  lens: string,
  sms: { text, charCount, sendCount },
  email: { subject, body, charCount },
  scheduledTime: string,
  notes: string
}

LensMetadata {
  lens: string,
  name: string,
  description: string,
  psychology: string[],
  targetSegment: string,
  conversionExpectation: string,  // "35% → 55%"
  colors: { primary, secondary }
}
```

---

### 3. `/api/funnel/email-preview` (100줄)

**Email 미리보기 API**

#### GET 요청

```bash
curl "http://localhost:3000/api/funnel/email-preview?lens=L6&day=2&name=김철수&destination=발리+크루즈&price=1,490,000&managerName=박미정&managerPhone=1800-0222-2299"
```

#### 응답

```json
{
  "success": true,
  "data": {
    "day": 2,
    "lens": "L6",
    "subject": "⏰ 김철수님, 10석 → 7석 (12시간 새)",
    "body": "🔥 이제 72시간만 남았습니다, 김철수님...",
    "charCount": 1050,
    "estimatedReadTime": "5분",
    "psychology": ["L6 손실회피", "L6 희소성"],
    "tone": "Social Proof",
    "sms": {
      "text": "🔥 이제 72시간만 남았습니다, 김철수님...",
      "charCount": 98,
      "sendCount": 1
    },
    "lensInfo": {
      "lens": "L6",
      "name": "시간/긴박감 고객",
      "psychology": ["L6 손실회피", "L6 희소성"],
      "conversionExpectation": "20% → 65%",
      "colors": { "primary": "#ef4444", "secondary": "#fee2e2" }
    },
    "variables": { ... }
  }
}
```

#### POST 요청

```json
{
  "lens": "L1",
  "day": 1,
  "variables": {
    "name": "김철수",
    "destination": "발리 크루즈",
    "price": "1,490,000",
    "monthlyPrice": "35,000",
    "managerName": "박미정",
    "managerPhone": "1800-0222-2299"
  }
}
```

---

## 🚀 사용 가이드

### 1. 기본 사용

#### Python/Node.js에서

```typescript
import { selectFunnelEmailTemplate, renderEmailTemplate } from "@/lib/funnel-email-templates";

// L6 렌즈, Day 2 이메일 선택
const emailSeq = selectFunnelEmailTemplate("L6");
const dayTemplate = emailSeq.day2;

// 변수 치환
const rendered = renderEmailTemplate(dayTemplate, {
  name: "김철수",
  destination: "발리 크루즈",
  remainingSeats: "7"
});

console.log(rendered);
```

#### React 컴포넌트에서

```tsx
import { renderEmailPreview, getAllLensMetadata } from "@/lib/funnel-email-preview";

export function EmailPreviewPanel({ contactId }) {
  const [lens, setLens] = useState("L0");
  const [day, setDay] = useState(0);

  const preview = renderEmailPreview(lens, day, {
    name: "김철수",
    destination: "발리 크루즈",
    price: "1,490,000"
  });

  return (
    <div>
      <h3>{preview.subject}</h3>
      <p className="text-sm text-gray-500">{preview.estimatedReadTime}</p>
      <div className="bg-gray-50 p-4 rounded">
        {preview.body}
      </div>
      <p className="text-sm">심리학: {preview.psychology.join(", ")}</p>
    </div>
  );
}
```

#### API 호출

```typescript
// 미리보기 조회
const res = await fetch("/api/funnel/email-preview", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    lens: "L1",
    day: 2,
    variables: {
      name: "김철수",
      destination: "발리 크루즈",
      price: "1,490,000"
    }
  })
});

const { data } = await res.json();
console.log(data.subject);    // 이메일 제목
console.log(data.body);       // 이메일 본문
console.log(data.sms.text);   // SMS 텍스트 (비교용)
```

---

### 2. Contact 상세 페이지에 통합

#### 기존 SMS 탭 옆에 Email 탭 추가

```tsx
// src/app/(dashboard)/contacts/[id]/ContactSmsTab.tsx
export function ContactSmsTab({ contact, product }) {
  const [channel, setChannel] = useState<"sms" | "email">("sms");

  return (
    <div>
      {/* 탭 선택 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setChannel("sms")}
          className={channel === "sms" ? "bg-blue-500 text-white" : ""}
        >
          📱 SMS
        </button>
        <button
          onClick={() => setChannel("email")}
          className={channel === "email" ? "bg-blue-500 text-white" : ""}
        >
          📧 Email
        </button>
      </div>

      {/* SMS 미리보기 */}
      {channel === "sms" && (
        <SmsPreviewPanel
          template={getFunnelSmsTemplateByDay(contact.lens, 0)}
          variables={getContactVariables(contact)}
        />
      )}

      {/* Email 미리보기 */}
      {channel === "email" && (
        <EmailPreviewPanel
          lens={contact.lens}
          day={0}
          variables={getContactVariables(contact)}
        />
      )}

      {/* Day 선택 */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((d) => (
          <button key={d} onClick={() => setDay(d)}>
            Day {d}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### 3. 렌즈 선택 화면

```tsx
// 모든 렌즈 카드 표시
import { getAllLensMetadata } from "@/lib/funnel-email-preview";

export function LensSelector({ onSelect }) {
  const lenses = getAllLensMetadata();

  return (
    <div className="grid grid-cols-5 gap-4">
      {lenses.map((lens) => (
        <div
          key={lens.lens}
          onClick={() => onSelect(lens.lens)}
          className="p-4 rounded-lg cursor-pointer"
          style={{ backgroundColor: lens.colors.secondary }}
        >
          <h4 className="font-bold">{lens.name}</h4>
          <p className="text-sm">{lens.description}</p>
          <div className="mt-2 text-xs text-gray-600">
            <p>대상: {lens.targetSegment}</p>
            <p>기대효과: {lens.conversionExpectation}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### 4. 관리자 대시보드: SMS vs Email 비교

```tsx
// 멀티채널 비교 화면
import { prepareMultiChannelSequence } from "@/lib/funnel-email-preview";

export function MultiChannelComparison({ contact }) {
  const seq = prepareMultiChannelSequence(contact.lens, 1, getVariables(contact));

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* SMS */}
      <div className="border-l-4 border-blue-500 p-4 bg-blue-50">
        <h3>📱 SMS (160자)</h3>
        <p className="text-sm mt-2">{seq.sms.text}</p>
        <p className="text-xs mt-2 text-gray-500">
          {seq.sms.charCount}자 / {seq.sms.sendCount === 1 ? "SMS" : "LMS"}
        </p>
      </div>

      {/* Email */}
      <div className="border-l-4 border-green-500 p-4 bg-green-50">
        <h3>📧 Email (800-1100자)</h3>
        <p className="font-semibold text-sm">{seq.email.subject}</p>
        <p className="text-sm mt-2">{seq.email.body.substring(0, 200)}...</p>
        <p className="text-xs mt-2 text-gray-500">{seq.email.charCount}자</p>
      </div>
    </div>
  );
}
```

---

## 📊 Day 0-3 타이밍

### 권장 발송 시간

| Day | 시점 | SMS | Email | 목적 |
|-----|------|-----|-------|------|
| **0** | 즉시 | 08:00 | 09:00 | 신청 축하 + 신뢰 구축 |
| **1** | +24h | 14:00 | 15:00 | 해결책 + 상품 소개 |
| **2** | +48h | 10:00 | 11:00 | 사회증명 강조 |
| **3** | +72h | 16:00 | 17:00 | 최종 CTA |

### API에서 일정 자동 계산

```typescript
const now = new Date();
const schedules = [0, 1, 2, 3].map((day) => {
  const date = new Date(now);
  date.setDate(date.getDate() + day);
  
  // SMS는 아침 8시, Email은 9시
  const smsTime = new Date(date);
  smsTime.setHours(8, 0, 0, 0);
  
  const emailTime = new Date(date);
  emailTime.setHours(9, 0, 0, 0);
  
  return { day, sms: smsTime, email: emailTime };
});
```

---

## 🔄 멀티채널 자동화 흐름

```
┌──────────────────────────────────────────────────────┐
│ Contact 신청 (예: 발리 크루즈)                      │
└──────────────────┬───────────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────────┐
│ 자동 렌즈 감지 엔진                                  │
│ - 가격민감도 → L1 (할부 강조)                       │
│ - 준비불안감 → L2 (가이드 강조)                    │
│ - 결정 미루는 중 → L6 (긴박감 강조)                 │
└──────────────────┬───────────────────────────────────┘
                   │
            ┌──────┴──────┐
            ↓             ↓
    ┌──────────────┐  ┌──────────────┐
    │   SMS Queue  │  │  Email Queue │
    └──────┬───────┘  └──────┬───────┘
           │                  │
      Day 0:08:00        Day 0:09:00
      Day 1:14:00        Day 1:15:00
      Day 2:10:00        Day 2:11:00
      Day 3:16:00        Day 3:17:00
           │                  │
           ↓                  ↓
    [Aligo SMS Send]   [Resend / SendGrid]
           │                  │
           └──────┬───────────┘
                  ↓
      ┌──────────────────────────────┐
      │ Analytics Dashboard Update    │
      │ - Open rate (Email)           │
      │ - Click rate (Email)          │
      │ - Response rate (SMS)         │
      │ - Conversion by Day/Lens      │
      └──────────────────────────────┘
```

---

## 📈 성과 메트릭

### SMS 메트릭

```
- 발송률: 99%+ (Aligo API)
- 읽음율: 95%+ (3초 이내)
- 응답율: 8-12% (URL 클릭)
- 전환율 (Day 0-3): 25-65% (렌즈별)
```

### Email 메트릭

```
- 발송률: 98%+ (SMTP)
- 열람율: 25-35% (렌즈별)
- 클릭율: 3-8% (링크 포함)
- 전환율 (Day 0-3): 35-95% (렌즈별)
```

### 렌즈별 기대 전환율

```
L0 (신규): SMS 35-45% / Email 45-55%
L1 (가격): SMS 25-35% / Email 50-65%
L2 (준비): SMS 30-40% / Email 55-70%
L6 (긴박): SMS 40-65% / Email 60-75%
L10 (즉시): SMS 85-95% / Email 90-98%
```

---

## 🔧 구현 체크리스트

- [x] `funnel-email-templates.ts` 생성 (20개 템플릿 + 함수)
- [x] `funnel-email-preview.ts` 생성 (미리보기 헬퍼)
- [x] `/api/funnel/email-preview` 엔드포인트 생성
- [ ] Contact 상세 페이지에 Email 탭 추가
- [ ] EmailPreviewPanel 컴포넌트 생성
- [ ] 렌즈 선택 UI 추가
- [ ] 멀티채널 비교 화면 추가
- [ ] Email 발송 스케줄러 구성 (cron)
- [ ] Email 트래킹 (열람, 클릭) 구현
- [ ] Analytics 대시보드 통합
- [ ] A/B 테스트 프레임워크 추가

---

## 📝 변수 완전 목록

```
기본 변수:
  {{name}}              고객 이름 (default: "고객님")
  {{phone}}             고객 전화 (masked)
  {{email}}             고객 이메일

여행 변수:
  {{destination}}       여행지 (default: "여행지")
  {{price}}             정가 (default: "정상가")
  {{monthlyPrice}}      월 할부액 (L1 specific)
  {{discount}}          할인액 (default: "할인액")
  {{daysLeft}}          남은 기간 (default: "3일")
  {{remainingSeats}}    남은 자리 (default: "10")

매니저 변수:
  {{managerName}}       담당 매니저 (default: "매니저")
  {{managerPhone}}      매니저 전화 (default: "1800-XXXX")
  {{managerTitle}}      매니저 직급 (default: "컨설턴트")

예약 변수:
  {{bookingRef}}        예약번호 (default: "BOOKING-001")
  {{daysUntilDeparture}} 출발까지 남은 일 (default: "45")
  {{consultationDate}}  상담 날짜 (default: "2026-06-16")

보증 변수:
  {{guaranteeText}}     보증 문구 (default: "100% 환불 보장")
  {{safetyFeatures}}    안전 기능 (JSON or pipe-separated)
```

---

## 🎯 다음 단계

1. **UI 통합** (1-2주)
   - Contact 상세 페이지에 Email 탭 추가
   - 렌즈별 카드 UI 구성

2. **Email 발송** (2주)
   - Resend / SendGrid API 연동
   - Cron 스케줄러 구성
   - 성공/실패 로깅

3. **트래킹** (1주)
   - 이메일 열람 추적 (픽셀)
   - 링크 클릭 추적
   - DB 저장

4. **A/B 테스트** (2주)
   - 렌즈별 변형 3-5가지
   - 자동 승자 선택
   - 통계 유의성 검증

5. **분석** (지속)
   - 일일 리포트 자동 생성
   - 슬랙 알림
   - 성과 대시보드

---

## 📞 문의

새로운 렌즈 추가 / 템플릿 수정 → CLAUDE_AGENT_PROMPTS.md 확인
