# Loop 5-C: CTA/폼 최적화 및 A/B 테스트 설계

**목표**: 폼 완성율 30% → 50% 달성, CTA 변형 A/B 테스트 설계

**작성일**: 2026-05-28  
**상태**: 설계 완료 (구현 준비)

---

## 1. 현재 상황 분석

### 현재 폼 문제점
- **필드 과다**: 이름, 이메일, 폰, 선호 시즌 4개 한번에 표시
- **진행도 표시 없음**: 사용자 심리적 부담 증가
- **Segment별 개인화 부족**: 모든 고객에게 동일한 폼 제시
- **모바일 최적화 미흡**: 작은 화면에서 필드 길이로 인한 이탈

### 기존 데이터 (가정 기반)
- 현재 폼 완성율: 30%
- 현재 CTA 클릭율: 15%
- 드롭 오프점: Step 1 (필드 과다) → Step 2 (진행도 불명)

---

## 2. 작업 1: 폼 최적화 전략 (Step 1-3)

### 2.1 단계형 폼 구조

#### Step 1: "당신의 크루즈 찾기 - 1분 퀴즈"
**목표**: 사용자 심리적 진입장벽 최소화 + Segment 자동 분류

```
┌─────────────────────────────────────┐
│  당신의 크루즈 찾기 🚢               │
│  1분 안에 완료됩니다                  │
├─────────────────────────────────────┤
│                                       │
│  당신의 나이 범위를 선택해주세요      │
│                                       │
│  ⭕ 20대      ○ 30대                 │
│  ○ 40대      ○ 50대                 │
│  ○ 60대      ○ 70세+                │
│                                       │
├─────────────────────────────────────┤
│                    [다음] 버튼       │
└─────────────────────────────────────┘

Progress: 1 of 3 (상단 프로그레스 바)
```

**심리학 적용**:
- L6 (타이밍 손실회피): "1분 안에 완료" → 시간 투자 최소화 신호
- L10 (즉시 구매): "크루즈 찾기" → 즉각적 혜택 약속
- **CTA 심리 트리거**: 다음 버튼에 작은 화살표 (→) 추가로 진행 유도

**필드 최소화**:
- 1개 필드만: 나이 범위 (라디오 버튼)
- 엔터키 → 다음 스텝으로 자동 진행
- 자동 포커스: 첫 라디오 버튼에 초점

**Segment 자동 분류 (클라이언트 사이드)**:
```javascript
// Step 1 → Segment Lookup Table
age: "20s" → Segment: A (로맨스/신혼)
age: "30s" → Segment: A (로맨스)
age: "40s" → Segment: B (가족동반)
age: "50s" → Segment: C (안정성)
age: "60s" → Segment: D (경험/문화)
age: "70s+" → Segment: E (편의성/VIP)
```

#### Step 2: "당신은 어떤 경험을 원하시나요?"
**목표**: Segment 확정 + 개인화 신호 강화

```
┌─────────────────────────────────────┐
│  2단계: 선호도 선택                  │
│  당신의 크루즈 스타일을 알려주세요    │
├─────────────────────────────────────┤
│                                       │
│  주로 원하시는 경험은?               │
│  (1개 선택)                          │
│                                       │
│  🎭 ⭕ 로맨스 (커플/신혼)            │
│  👨‍👩‍👧‍👦 ○ 가족 (자녀동반)            │
│  🎨 ○ 문화 (역사/미술/음악)         │
│                                       │
│  Segment A인 경우 추가 체크:         │
│  ☐ 신혼부부입니다 (신혼식 패키지 제안)│
│                                       │
├─────────────────────────────────────┤
│                    [다음] 버튼       │
└─────────────────────────────────────┘

Progress: 2 of 3
```

**심리학 적용**:
- L3 (차별성): "당신의 스타일" → 개인화 신호
- L7 (동반자 설득): "신혼부부" → 배우자와의 대화 유도
- **개인화 감정**: "당신을 위한" 크루즈 추천이 올 것이라는 기대

**필드 재구성 (Segment별 다름)**:
```
Segment A (20-30s, 로맨스):
  - 로맨스/가족/문화 라디오 (이미 A 선택이므로 라디오)
  - "신혼부부입니다" 체크박스

Segment B (40s, 가족):
  - 가족/문화 라디오
  - "자녀 인원" (select: 1명/2명/3명+)

Segment C (50s, 안정성):
  - 문화/여유 라디오
  - 선택사항 없음

Segment D (60s, 경험):
  - 문화/모험 라디오
  - 선택사항 없음

Segment E (70s+, 편의성):
  - 간단한 선택만 (가족/문화)
  - 큰 폰트 (16px 이상)
```

#### Step 3: "연락처를 알려주세요"
**목표**: 전환 + 다음 액션 스케줄

```
┌─────────────────────────────────────┐
│  3단계: 신청 완료                    │
│  1시간 내 당신을 위한 크루즈를      │
│  추천해드리겠습니다                  │
├─────────────────────────────────────┤
│                                       │
│  이름 (필수)                         │
│  [________]                          │
│                                       │
│  휴대폰 (필수)                       │
│  [010-____-____]  ← 자동 마스킹    │
│  * 전화로 추천사항을 드립니다        │
│                                       │
│  이메일 (선택)                       │
│  [________@____.com]                 │
│  ☐ 이메일 뉴스레터 구독             │
│                                       │
├─────────────────────────────────────┤
│  [신청 완료] 또는 [나중에]           │
└─────────────────────────────────────┘

Progress: 3 of 3
```

**심리학 적용**:
- L10 (즉시 구매): "1시간 내" → 긴박감 + FOMO
- L6 (타이밍): "전담 크루즈 어드바이저 배정" → 가치 강조
- L2 (준비 불안): "전화로 추천" → 복잡성 해소 신호

**필드 설계**:
- **이름**: 정규식 (한글/영문만, 2-20자)
- **폰**: 
  - type="tel" (숫자 키보드만)
  - 자동 마스킹: "010" 입력 → "010-" 자동 추가
  - 전체 포맷 검증: 010-XXXX-XXXX
  - 최종 저장: 하이픈 제거 (01012345678)
- **이메일**: 
  - 선택사항 (사용자가 "나중에" 가능)
  - 이메일 정규식 검증

**에러 처리**:
- 인라인 에러 (필드 바로 아래)
- 빨강 색상 (#E53E3E)
- 예시: "010-0000-0000 형식으로 입력해주세요"

**성공 메시지**:
```
✅ 신청이 완료되었습니다!
1시간 내 SMS로 당신을 위한 크루즈를 추천해드립니다.
(010-XXXX-XXXX로 연락드리겠습니다)
```

### 2.2 UX 개선 기법

| 기법 | 효과 | 구현 |
|------|------|------|
| 진행도 바 ("1 of 3") | 심리적 진전감 | `<ProgressBar step={1} total={3} />` |
| 자동 포커스 | 마찰 감소 | Step 이동 시 자동 focus() |
| 엔터키 제출 | 키보드 사용자 UX | onKeyPress="Enter" → next step |
| 자동 마스킹 | 가입 마찰 감소 | "010" 입력 → "010-" 자동 |
| 큰 터치 타깃 | 모바일 전환율 증가 | button min 44x44px |
| 라디오 버튼 | 선택 명확성 | select 대신 라디오 (3개 이상) |

---

## 3. 작업 2: CTA 버튼 변형 3개

### 3.1 Variant A: Control (기존 스타일)

```
[신청하기]

CSS:
- 색상: 파란색 (#3182CE)
- 폰트: 14px, semibold
- 패딩: 12px 16px (vertical × horizontal)
- 라운드: 4px
- 호버: 더 진한 파란색 (#2c5282) + 그림자
- 트랜지션: 150ms ease

HTML:
<button className="btn-primary">신청하기</button>
```

**예상 효과**: 기존 클릭율 기준 (15%)

### 3.2 Variant B: Action-focused (시간 + 사이즈)

```
[내 크루즈 찾기 (2분 소요)]

CSS:
- 색상: 주황색 (#ED8936)
- 폰트: 16px, semibold (더 큼)
- 패딩: 16px 20px (더 큼)
- 라운드: 8px (조금 더 둥글게)
- 호버: 더 진한 주황색 (#C05621) + 우측 화살표 나타남 (→)
- 트랜지션: 150ms ease

특징:
- "내 크루즈" → 소유감/개인화
- "(2분 소요)" → 마찰 감소 신호 (심리학 L6)
- 화살표 → "진행" 시각 신호

HTML:
<button className="btn-action">
  <span>내 크루즈 찾기</span>
  <span className="duration">(2분 소요)</span>
  <span className="arrow" style={{opacity: 0}}>→</span>
</button>

// 호버 시 화살표 나타남 (opacity: 1, transform: translateX(4px))
```

**예상 효과**: 클릭율 +30-50% (20-23%)

### 3.3 Variant C: Emotional + Scarcity (긴박감 + 혜택)

```
[지금 50% 할인 받기 (72시간만)]

CSS:
- 색상: 빨강 (#F56565) 또는 세그먼트 accent
- 폰트: 15px, bold (굵게)
- 패딩: 14px 18px
- 라운드: 20px (원형에 가까움)
- 호버: 더 진한 빨강 (#E53E3E) + 텍스트 굵어짐 + 스케일 1.05
- 에니메이션: 살짝 떨림 (pulse effect, 2초 반복)

특징:
- "지금" → 즉각적 행동 신호 (L10)
- "50% 할인" → 명확한 혜택 (L6)
- "(72시간만)" → 희소성 + 긴박감 (L6, Scarcity)
- 빨강 + 떨림 → 주의 끌기

HTML:
<button className="btn-urgent pulse">
  <span className="discount">지금 50% 할인</span>
  <span className="offer"> 받기</span>
  <span className="scarcity">(72시간만)</span>
</button>

// Pulse 애니메이션
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
```

**예상 효과**: 클릭율 +40-60% (21-24%)

### 3.4 세그먼트별 CTA 표시 (선택사항)

```
Segment A (20-30s, 로맨스):
  → Variant C 사용 (할인 강조)
  → 텍스트: "신혼할인 받기"

Segment B (40s, 가족):
  → Variant B 사용 (가족 개인화)
  → 텍스트: "우리 가족의 크루즈 찾기"

Segment C-E (50s+):
  → Variant A 또는 B (간단함 선호)
  → 텍스트: "신청하기"
```

---

## 4. 작업 3: A/B 테스트 계획서

### 4.1 테스트 설정

| 항목 | 값 | 설명 |
|------|-----|------|
| **테스트 기간** | 2주 (2026-05-29 ~ 2026-06-12) | 7일 이상 (주중/주말 변동성 흡수) |
| **대상 페이지** | cruisedot 상품 상세 페이지 inquiry form | 일반/골드 모두 포함 |
| **트래픽 배분** | 균등 분배 (33.3% each) | URL 쿼리 또는 클라이언트 randomize |
| **최소 샘플 크기** | 각 변형 1000+ 이상 | 통계 유의성 보장 |
| **통계 신뢰도** | 95% (p < 0.05) | 표준 산업 기준 |

### 4.2 성공 지표 (Primary)

#### 지표 1: 폼 완성율 (Form Completion Rate)
```
정의: (Step 1 진입 → Step 3 제출 완료) / (Step 1 진입)

목표:
- Control (A): 30% (기준선)
- Variant B: 45% 이상 (+50%)
- Variant C: 50% 이상 (+67%)

측정:
- gtag event: "form_step_1_view" → "form_step_3_submit"
- 파이프라인: [1000명 진입] → [?명 완료]

승자 판정:
- 95% 신뢰도로 최소 표본 300명 필요
- 기간: 7일 이상 (요일 변동성 흡수)
```

#### 지표 2: CTA 클릭율 (Click-Through Rate)
```
정의: (CTA 버튼 클릭) / (Form 1 Step 진입)

목표:
- Control (A): 15% (기준선)
- Variant B: 25% 이상 (+67%)
- Variant C: 30% 이상 (+100%)

측정:
- gtag event: "button_click" (버튼 variant 태깅)
- 구글 애널리틱스: 클릭 위치별 분석

승자 판정:
- 기간: 5일 이상 (충분한 표본)
- 신뢰도: 95% (p < 0.05)
```

### 4.3 부가 지표 (Secondary)

| 지표 | 측정 | 목표 |
|------|------|------|
| **Step별 드롭오프율** | Step 1 → 2 / Step 2 → 3 | 각 단계 95% 이상 진행 |
| **폼 작성 소요시간** | Step 진입 → 제출 | 2-5분 (Step 1: 30s, 2: 45s, 3: 2m) |
| **필드별 이탈율** | 각 필드의 focus → blur 이탈 | 이름: 3% 이하 / 폰: 5% 이하 |
| **모바일 vs PC** | 완성율 비교 | 모바일 >= PC 80% |
| **재방문율** | 폼 재개 클릭 (새 탭 진입 후) | 10% (재개 기능 추가 시) |
| **오류율** | 필드 유효성 오류 | 폰 5% 이하 / 이메일 2% 이하 |

### 4.4 A/B 테스트 데이터 로깅

```typescript
// 각 이벤트에 variant 태깅
gtag('event', 'form_step_1_view', {
  variant: 'A', // 또는 'B', 'C'
  segment: 'A', // 나이 범위
  userAgent: 'mobile' // 또는 'desktop'
});

gtag('event', 'button_click', {
  variant: 'A',
  buttonText: '신청하기',
  timestamp: Date.now()
});

gtag('event', 'form_step_3_submit', {
  variant: 'A',
  segment: 'A',
  completionTimeMs: 180000, // 180초
  fieldErrorCount: 0 // 오류 발생 횟수
});
```

### 4.5 승자 판정 기준

```
조건 1: 통계적 유의성
- χ² (Chi-Square) test for proportions
- p-value < 0.05 (95% 신뢰도)

조건 2: 표본 크기
- 각 변형 최소 300명 이상
- 최소 기간: 7일

조건 3: 비즈니스 영향도
- 클릭율 + 완성율 가중 평가
- 예: (클릭율 40%) + (완성율 60%)

승자 선정:
- 기준: "완성율 > 40% AND p-value < 0.05"
- 기간: 2주 종료 후 최종 판정
- 집행: 승자를 default로 변경, 패자 제거
```

---

## 5. 작업 4: 최종 산출물

### 5.1 React 컴포넌트: `/src/components/loop5/ContactForm.tsx`

```typescript
/**
 * Loop 5-C: ContactForm
 * 
 * 기능:
 * - Step 1-3 단계형 폼
 * - Segment별 개인화 (나이별 다른 필드)
 * - CTA 변형 3가지 (A/B/C)
 * - 실시간 유효성 검사
 * - gtag 이벤트 로깅
 * 
 * 사용:
 * <ContactForm variant="a" segment="A" onComplete={handleComplete} />
 */

import React, { useState, useEffect } from 'react';
import './ContactForm.css';

interface ContactFormProps {
  variant: 'a' | 'b' | 'c';
  segment?: 'A' | 'B' | 'C' | 'D' | 'E';
  onComplete?: (data: FormData) => void;
}

interface FormData {
  name: string;
  phone: string;
  email: string;
  ageRange: string;
  preferenceType: string;
  variant: string;
  completionTimeMs: number;
}

export const ContactForm: React.FC<ContactFormProps> = ({ variant, segment, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    ageRange: '',
    preferenceType: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [startTime] = useState(Date.now());

  // Step 1: 나이 선택
  const handleStep1Next = (ageRange: string) => {
    setFormData(prev => ({ ...prev, ageRange }));
    logEvent('form_step_1_complete', { variant, ageRange });
    setCurrentStep(2);
  };

  // Step 2: 선호도 선택
  const handleStep2Next = (preferenceType: string) => {
    setFormData(prev => ({ ...prev, preferenceType }));
    logEvent('form_step_2_complete', { variant, preferenceType });
    setCurrentStep(3);
  };

  // Step 3: 연락처 입력
  const handleStep3Submit = async () => {
    const newErrors: Record<string, string> = {};
    
    // 유효성 검사
    if (!formData.name || formData.name.length < 2) {
      newErrors.name = '이름을 2자 이상 입력해주세요';
    }
    if (!formData.phone || !/^010\d{7,8}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = '010-XXXX-XXXX 형식으로 입력해주세요';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '유효한 이메일을 입력해주세요';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      logEvent('form_step_3_error', { 
        variant, 
        errorCount: Object.keys(newErrors).length 
      });
      return;
    }

    const completionTimeMs = Date.now() - startTime;
    logEvent('form_complete', { 
      variant, 
      completionTimeMs,
      segment 
    });

    // CRM 웹훅 호출
    await fetch('/api/webhooks/inquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_INQUIRY_SECRET}`,
      },
      body: JSON.stringify({
        phone: formData.phone.replace(/\D/g, ''),
        name: formData.name,
        email: formData.email || null,
        affiliateCode: new URLSearchParams(window.location.search).get('ref') || null,
        inquiryType: 'cruise_inquiry',
        message: `선호도: ${formData.preferenceType}`,
        variant,
        completionTimeMs,
        segment: determineSegment(formData.ageRange),
      }),
    });

    onComplete?.({
      ...formData,
      variant,
      completionTimeMs,
    });
  };

  const logEvent = (eventName: string, data: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, data);
    }
  };

  const determineSegment = (ageRange: string): 'A' | 'B' | 'C' | 'D' | 'E' => {
    const segmentMap = {
      '20s': 'A', '30s': 'A', '40s': 'B', 
      '50s': 'C', '60s': 'D', '70s+': 'E'
    };
    return (segmentMap[ageRange as keyof typeof segmentMap] || 'A') as any;
  };

  // 렌더링
  return (
    <div className="contact-form" data-variant={variant}>
      {/* 프로그레스 바 */}
      <div className="progress-bar">
        <div className="progress" style={{ width: `${(currentStep / 3) * 100}%` }} />
        <span className="progress-text">{currentStep} of 3</span>
      </div>

      {/* Step 1 */}
      {currentStep === 1 && (
        <Step1Form variant={variant} onNext={handleStep1Next} />
      )}

      {/* Step 2 */}
      {currentStep === 2 && (
        <Step2Form variant={variant} onNext={handleStep2Next} onBack={() => setCurrentStep(1)} />
      )}

      {/* Step 3 */}
      {currentStep === 3 && (
        <Step3Form 
          variant={variant}
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          onSubmit={handleStep3Submit}
          onBack={() => setCurrentStep(2)}
        />
      )}
    </div>
  );
};

// Sub-components: Step1Form, Step2Form, Step3Form (아래에 별도 정의)
```

### 5.2 CTA 버튼 컴포넌트: `/src/components/loop5/CTAButton.tsx`

```typescript
import React from 'react';
import './CTAButton.css';

interface CTAButtonProps {
  variant: 'a' | 'b' | 'c';
  onClick?: () => void;
  disabled?: boolean;
  segment?: 'A' | 'B' | 'C' | 'D' | 'E';
}

export const CTAButton: React.FC<CTAButtonProps> = ({ 
  variant, 
  onClick, 
  disabled,
  segment 
}) => {
  const getButtonText = () => {
    if (variant === 'a') return '신청하기';
    if (variant === 'b') return '내 크루즈 찾기 (2분 소요)';
    if (variant === 'c') return '지금 50% 할인 받기 (72시간만)';
  };

  return (
    <button
      className={`cta-button cta-button-${variant} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{getButtonText()}</span>
      {variant === 'b' && <span className="arrow" style={{ marginLeft: '4px' }}>→</span>}
    </button>
  );
};
```

### 5.3 API 엔드포인트: `/src/app/api/webhook/contact-form-submission/route.ts`

```typescript
/**
 * POST /api/webhook/contact-form-submission
 * 
 * Loop 5-C 폼 제출 로깅
 * CRM inquiry 웹훅 호출 전 메타데이터 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface FormSubmissionPayload {
  name: string;
  phone: string;
  email?: string;
  ageRange: string;
  preferenceType: string;
  variant: 'a' | 'b' | 'c';
  segment: 'A' | 'B' | 'C' | 'D' | 'E';
  completionTimeMs: number;
  timestamp: number;
  userAgent: string;
  affiliateCode?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as FormSubmissionPayload;

    // FormSubmission 레코드 생성 (A/B 테스트 추적용)
    const submission = await prisma.formSubmission.create({
      data: {
        variant: body.variant,
        segment: body.segment,
        completionTimeMs: body.completionTimeMs,
        ageRange: body.ageRange,
        preferenceType: body.preferenceType,
        affiliateCode: body.affiliateCode || null,
        userAgent: body.userAgent,
        createdAt: new Date(body.timestamp),
      },
      select: { id: true },
    });

    logger.log('[FormSubmission]', {
      id: submission.id,
      variant: body.variant,
      segment: body.segment,
      completionTimeMs: body.completionTimeMs,
    });

    return NextResponse.json({ ok: true, submissionId: submission.id });
  } catch (err) {
    logger.error('[FormSubmission]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

### 5.4 A/B 테스트 결과 대시보드: `/src/app/(dashboard)/admin/loop5/ab-test-results/page.tsx`

```typescript
/**
 * Loop 5-C A/B 테스트 결과 대시보드
 * 
 * 실시간 KPI 시각화:
 * - 변형별 완성율 / 클릭율 / 신뢰도
 * - 시간별 성과 추이 (라인 차트)
 * - 승자 자동 판정
 */

import React, { useState, useEffect } from 'react';
import { fetchABTestResults } from '@/lib/loop5-analytics';

export default function ABTestResultsPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await fetchABTestResults();
      setResults(data);
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 60000); // 1분 새로고침
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="ab-test-dashboard">
      <h1>Loop 5-C A/B 테스트 결과</h1>

      {/* 결과 테이블 */}
      <table className="results-table">
        <thead>
          <tr>
            <th>변형</th>
            <th>방문자</th>
            <th>완성</th>
            <th>완성율(%)</th>
            <th>신뢰도</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {results?.variants?.map((v: any) => (
            <tr key={v.variant} className={v.isWinner ? 'winner' : ''}>
              <td>{v.variant.toUpperCase()}</td>
              <td>{v.visitors}</td>
              <td>{v.completions}</td>
              <td>{(v.completionRate * 100).toFixed(1)}%</td>
              <td>{v.confidence}%</td>
              <td>
                {v.isWinner && '✅ 승자'}
                {!v.isWinner && v.confidence >= 95 ? '❌ 패자' : '⏳ 진행중'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 라인 차트: 시간별 추이 */}
      {/* recharts 또는 chart.js 사용 */}

      {/* CSV 다운로드 */}
      <button onClick={() => exportCSV(results)}>
        데이터 내보내기 (CSV)
      </button>
    </div>
  );
}
```

### 5.5 DB 스키마 추가: FormSubmission 테이블

```prisma
// prisma/schema.prisma에 추가

model FormSubmission {
  id String @id @default(cuid())
  variant String // 'a', 'b', 'c'
  segment String // 'A', 'B', 'C', 'D', 'E'
  completionTimeMs Int
  ageRange String
  preferenceType String
  affiliateCode String?
  userAgent String
  createdAt DateTime @default(now())
  
  @@index([createdAt])
  @@index([variant])
  @@index([segment])
}
```

---

## 6. 구현 로드맵

| Phase | 작업 | 기간 | 담당 |
|-------|------|------|------|
| **Phase 0** | Figma 디자인 + 프로토타입 | 1일 | 디자인팀 |
| **Phase 1** | React 컴포넌트 구현 (Step1-3) | 2일 | 프론트엔드 |
| **Phase 2** | CTA 변형 구현 + gtag 연동 | 1일 | 프론트엔드 |
| **Phase 3** | API 엔드포인트 + DB 스키마 | 1일 | 백엔드 |
| **Phase 4** | QA + 성능 테스트 | 1일 | QA |
| **Phase 5** | A/B 테스트 배포 (50% 트래픽) | 0.5일 | DevOps |
| **Phase 6** | 실시간 대시보드 모니터링 | 2주 | Analytics |
| **Phase 7** | 결과 분석 + 승자 배포 | 1일 | Product |

**총 기간**: ~8-9일 (계획) + 2주 (테스트 기간)

---

## 7. 성공 기준

### 최소 달성 목표 (Must Have)
- ✅ 폼 완성율 30% → 40% 이상 (+33%)
- ✅ CTA 클릭율 15% → 20% 이상 (+33%)
- ✅ 통계적 유의성 p < 0.05

### 목표 달성 (Should Have)
- ✅ 폼 완성율 30% → 50% (+67%)
- ✅ CTA 클릭율 15% → 30% 이상 (+100%)
- ✅ 모바일 완성율 >= PC 80%

### 초과 달성 (Nice to Have)
- 📊 A/B 테스트 결과 자동 분석 + 메일 리포트
- 📊 Segment별 성과 분해 (5가지 연령대별)
- 📊 렌즈별 응답 패턴 분석 (심리학 검증)

---

## 8. 위험 요소 및 완화 전략

| 위험 | 영향 | 완화 전략 |
|-----|------|----------|
| 폼 복잡성 증가 (단계형 → 이탈 증가) | 높음 | 각 Step 간결화 + 진행도 표시 |
| CTA 변형 선택 어려움 | 중간 | 사용자 데이터 기반 pre-test (50명) |
| 모바일 최적화 부족 | 높음 | 모바일 우선 설계 + 44px 터치 타깃 |
| 통계 표본 부족 (기간 내 300명 미달) | 중간 | 2주 → 3주로 연장 고려 |
| 폼 제출 오류 증가 | 낮음 | 클라이언트 사이드 유효성 검사 + 에러 UI |

---

## 9. 실제 구현 예시

### HTML 기본 구조
```html
<!-- cruisedot inquiry form -->
<form id="contact-form" class="contact-form">
  <!-- Step 1 -->
  <fieldset class="form-step step-1">
    <legend>당신의 크루즈 찾기 - 1분 퀴즈</legend>
    <label>
      <input type="radio" name="ageRange" value="20s" required />
      <span>20대</span>
    </label>
    <!-- ... 더 많은 라디오 버튼 -->
  </fieldset>

  <!-- Step 2 -->
  <fieldset class="form-step step-2" style="display: none;">
    <legend>당신은 어떤 경험을 원하시나요?</legend>
    <label>
      <input type="radio" name="preferenceType" value="romance" required />
      <span>🎭 로맨스 (커플/신혼)</span>
    </label>
    <!-- ... -->
  </fieldset>

  <!-- Step 3 -->
  <fieldset class="form-step step-3" style="display: none;">
    <legend>연락처를 알려주세요</legend>
    <input type="text" name="name" placeholder="이름" required />
    <input type="tel" name="phone" placeholder="010-XXXX-XXXX" required />
    <input type="email" name="email" placeholder="이메일 (선택)" />
  </fieldset>

  <!-- CTA 버튼 (variant A/B/C) -->
  <button id="cta-button" class="cta-button cta-button-a">신청하기</button>
</form>
```

### CSS 핵심 스타일
```css
.contact-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.progress-bar {
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  margin-bottom: 20px;
  overflow: hidden;
}

.progress-bar .progress {
  height: 100%;
  background: linear-gradient(90deg, #3182CE, #2c5282);
  transition: width 0.3s ease;
}

.form-step {
  display: none;
}

.form-step.active {
  display: block;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* CTA 버튼 변형 */
.cta-button {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 150ms ease;
}

.cta-button-a {
  background: #3182CE;
  color: white;
}

.cta-button-a:hover {
  background: #2c5282;
  box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3);
}

.cta-button-b {
  background: #ED8936;
  color: white;
  font-size: 16px;
  padding: 16px 20px;
  border-radius: 8px;
}

.cta-button-b:hover {
  background: #C05621;
  transform: scale(1.02);
}

.cta-button-b .arrow {
  opacity: 0;
  transition: opacity 150ms ease;
}

.cta-button-b:hover .arrow {
  opacity: 1;
  transform: translateX(4px);
}

.cta-button-c {
  background: #F56565;
  color: white;
  font-weight: 700;
  border-radius: 20px;
  animation: pulse 2s infinite;
}

.cta-button-c:hover {
  background: #E53E3E;
  transform: scale(1.05);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
```

---

## 10. 참고: Grant Cardone 심리학 적용

이 폼 설계는 **Grant Cardone 10렌즈** 중 다음을 적용합니다:

| 렌즈 | 적용 부분 | 효과 |
|------|----------|------|
| **L2 (준비 복잡도)** | Step 1: "1분 퀴즈" / Step 3: "1시간 내 추천" | 의사결정 마찰 감소 |
| **L3 (차별성)** | "당신의 스타일" / 개인화 메시지 | 고객 특별감 강조 |
| **L6 (타이밍/손실회피)** | "지금 50% 할인 (72시간만)" / "1시간 내" | 긴박감 + 희소성 |
| **L7 (동반자 설득)** | "신혼부부입니다" 체크박스 | 배우자와의 결정 유도 |
| **L10 (즉시 구매)** | CTA "내 크루즈 찾기" / 진행 화살표 | 즉각적 행동 신호 |

---

## 11. KPI 계산 수식

```
완성율 = (Step 3 제출 수) / (Step 1 진입 수)
클릭율 = (CTA 클릭 수) / (폼 페이지 방문)

신뢰도 (95% CI):
  표준오차 = sqrt(p * (1-p) / n)
  신뢰도 = 1.96 * SE (약 95%)

승자 판정 (χ² test):
  χ² = Σ((관측값 - 기대값)² / 기대값)
  p-value = P(χ² > 계산값)
  if p-value < 0.05: 통계적으로 유의미함
```

---

**다음 단계**: 설계 승인 후 Phase 1 (React 컴포넌트) 구현 시작
