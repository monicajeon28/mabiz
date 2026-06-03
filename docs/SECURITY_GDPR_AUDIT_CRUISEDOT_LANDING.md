# 크루즈닷 랜딩페이지 보안 + GDPR 감사 보고서

**작성일**: 2026-06-03  
**감사자**: 보안 전문가 (Claude Code)  
**대상**: `src/app/(dashboard)/landing/cruisedot/` + `/api/landing/contact-signup`  
**상태**: ⚠️ **3가지 P0 보안 취약점 + GDPR 5가지 미충족**

---

## 📊 종합 평가

| 항목 | 현재 상태 | 필요도 | 우선순위 |
|------|---------|--------|----------|
| **XSS 방지 (input sanitization)** | ❌ 미흡 | 높음 | **P0** |
| **GDPR 동의 (opt-in consent)** | ❌ 없음 | 높음 | **P0** |
| **CSRF 토큰 (form protection)** | ❌ 없음 | 높음 | **P0** |
| **이메일 중복 로직** | ⚠️ 부분적 | 중간 | **P1** |
| **폰번호 암호화** | ✅ 완료 | 중간 | **P1** |
| **데이터 보유 정책** | ❌ 없음 | 중간 | **P1** |
| **개인정보 접근 제어** | ⚠️ 부분적 | 낮음 | **P2** |
| **HIPAA 준수** | ❌ 없음 | 낮음 | **P2** |

---

## 🔴 P0 취약점 (즉시 수정 필수)

### 1️⃣ GDPR 동의 없음 - "적법한 법적 근거" 부재

#### 현재 문제
```tsx
// SignupForm.tsx 라인 224-232
<p className="text-xs text-blue-100 text-center">
  신청함으로써 개인정보 수집·이용에 동의합니다 (
  <a href="#" className="underline hover:text-white">
    이용약관
  </a>
  · <a href="#" className="underline hover:text-white">
    개인정보처리방침
  </a>
  )
</p>
```

**문제점**:
- ❌ **체크박스 없음**: "동의합니다"는 자동 동의 가정 → GDPR Article 7 위반
  - GDPR: "동의는 명시적이어야 함" (affirmative action required)
  - 한국 개인정보보호법: "선택 동의" 필수
- ❌ **이용약관 링크 깨짐**: `href="#"` → 실제 약관 미존재
- ❌ **마케팅 동의 분리 없음**: SMS 발송 전용 별도 동의 필요
- ❌ **동의 철회 방법 없음**: 언제든 거부 가능해야 함

#### 기대 효과
- GDPR 벌금: €2,000-€20,000,000 (더 큰 값)
- 한국 벌금: 최대 3,000만원 + 영업정지

#### 수정 방법

**Step 1: 동의 UI 추가 (CheckboxConsentForm.tsx)**

```tsx
'use client';

import { useState } from 'react';

interface ConsentCheckboxProps {
  onConsentChange: (consents: {
    privacyPolicy: boolean;
    marketing: boolean;
  }) => void;
}

export default function ConsentCheckbox({ onConsentChange }: ConsentCheckboxProps) {
  const [consents, setConsents] = useState({
    privacyPolicy: false,
    marketing: false
  });

  const handleChange = (field: keyof typeof consents) => {
    const updated = { ...consents, [field]: !consents[field] };
    setConsents(updated);
    onConsentChange(updated);
  };

  return (
    <div className="space-y-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      {/* 필수 동의: 개인정보 처리 */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consents.privacyPolicy}
          onChange={() => handleChange('privacyPolicy')}
          required
          className="mt-1 w-5 h-5 accent-blue-600"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">
            개인정보 수집·이용 동의 <span className="text-red-600">*</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            이름, 이메일, 폰번호는 크루즈닷 상담 목적으로만 사용됩니다.
            <a 
              href="/privacy-policy" 
              target="_blank" 
              className="text-blue-600 underline ml-1"
            >
              개인정보처리방침
            </a>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            🔒 법적 근거: GDPR Article 6(1)(a) / 개인정보보호법 제15조
          </p>
        </div>
      </label>

      {/* 선택 동의: 마케팅 SMS */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consents.marketing}
          onChange={() => handleChange('marketing')}
          className="mt-1 w-5 h-5 accent-green-600"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">
            마케팅 정보 수신 동의 <span className="text-gray-400">(선택)</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Day 0-3 프로모션 SMS, 세미패키지 할인 정보 등을 받으실 수 있습니다.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            📱 동의 철회: SMS 회신 또는 
            <a href="/unsubscribe" className="text-blue-600 underline ml-1">
              수신거부
            </a>
          </p>
        </div>
      </label>

      {/* 필수 동의 확인 메시지 */}
      {!consents.privacyPolicy && (
        <div className="bg-red-50 border border-red-300 rounded p-3 text-red-700 text-xs">
          ⚠️ 개인정보 처리 동의는 필수입니다
        </div>
      )}
    </div>
  );
}
```

**Step 2: SignupForm.tsx 수정**

```tsx
// ... 기존 코드 ...
import ConsentCheckbox from './ConsentCheckbox';

export default function SignupForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    problem: '',
    travelType: '',
    budget: ''
  });

  // ✅ 추가: 동의 상태 추적
  const [consents, setConsents] = useState({
    privacyPolicy: false,
    marketing: false
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleConsentChange = (newConsents: typeof consents) => {
    setConsents(newConsents);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    // ✅ GDPR 검증: 필수 동의 확인
    if (!consents.privacyPolicy) {
      setStatus('error');
      setErrorMessage('개인정보 처리 동의는 필수입니다');
      setLoading(false);
      return;
    }

    try {
      const phoneClean = formData.phone.replace(/[^0-9]/g, '');
      let phoneFormatted = phoneClean;

      if (phoneClean.length === 11) {
        phoneFormatted = `${phoneClean.slice(0, 3)}-${phoneClean.slice(3, 7)}-${phoneClean.slice(7)}`;
      } else if (phoneClean.length === 10) {
        phoneFormatted = `${phoneClean.slice(0, 3)}-${phoneClean.slice(3, 6)}-${phoneClean.slice(6)}`;
      }

      // ✅ API 요청에 동의 정보 포함
      const response = await fetch('/api/landing/contact-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          phone: phoneFormatted,
          consents, // ✅ 추가
          consentedAt: new Date().toISOString() // ✅ 동의 시간 기록
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error || '신청 중 오류가 발생했습니다');
        return;
      }

      setStatus('success');
      setFormData({
        name: '',
        email: '',
        phone: '',
        problem: '',
        travelType: '',
        budget: ''
      });
      setConsents({
        privacyPolicy: false,
        marketing: false
      });

      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (error) {
      setStatus('error');
      setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      logger.error('signup-form:submit', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 기존 폼 필드들... */}
      
      {/* ✅ 동의 체크박스 추가 */}
      <ConsentCheckbox onConsentChange={handleConsentChange} />

      {/* 에러/성공 메시지... */}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={loading || !consents.privacyPolicy} // ✅ 필수 동의 확인 후만 활성
        className={`w-full py-4 rounded-lg font-bold text-lg text-white transition-colors ${
          loading || !consents.privacyPolicy
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700'
        }`}
      >
        {loading ? '신청 중...' : '🚀 지금 신청하기 (무료)'}
      </button>
    </form>
  );
}
```

**Step 3: API 수정 (contact-signup route.ts)**

```typescript
// 라인 54-55 추가
const { name, email, phone, problem, travelType, budget, consents, consentedAt } = body;

// 라인 56-65 수정
if (!name || !email || !phone) {
  return Response.json(
    {
      error: '이름, 이메일, 폰번호는 필수입니다',
      fields: { name: !!name, email: !!email, phone: !!phone }
    },
    { status: 400 }
  );
}

// ✅ GDPR 필수 동의 검증 추가
if (!consents?.privacyPolicy) {
  return Response.json(
    { error: '개인정보 처리 동의는 필수입니다 (GDPR Article 7)' },
    { status: 400 }
  );
}

// 라인 162-165 수정: Contact 생성 시 동의 정보 저장
const contact = await prisma.contact.create({
  data: {
    organizationId: session.organizationId,
    name: name.trim(),
    email: email.toLowerCase(),
    phone: phoneClean,
    type: 'INQUIRY',
    channel: 'landing_page',
    utmSource: 'LANDING_CRUISEDOT',
    cruiseInterest: travelType || undefined,
    budgetRange: budget || undefined,
    adminMemo: encryptedMemo,
    tags: tagsArray,
    assignedUserId: assignedManagerId || undefined,
    // ✅ GDPR 동의 정보 저장
    consentedPrivacyAt: consents?.privacyPolicy ? new Date(consentedAt) : null,
    consentedMarketingAt: consents?.marketing ? new Date(consentedAt) : null
  }
});

// ✅ SMS 발송은 마케팅 동의가 있을 때만
if (consents?.marketing) {
  const smsQueue = await scheduleDay0To3Sms(
    session.organizationId,
    contact.id,
    lens as LandingLensType
  );
  // ...
} else {
  console.log(`[landing-contact-signup] SMS not scheduled - marketing consent declined for contact ${contact.id}`);
}
```

---

### 2️⃣ XSS 취약점 - HTML Injection 가능

#### 현재 문제

**SignupForm.tsx 라인 185-191**:
```tsx
<textarea
  name="problem"
  value={formData.problem}
  onChange={handleChange}
  placeholder="예) 혼자 여행이라 불안해요 / 여행 준비가 복잡해서요 / 예산을 아껴야 해서요"
  rows={3}
  className="w-full px-4 py-3 rounded-lg border border-gray-300 ..."
/>
```

**page.tsx 라인 751-759**:
```tsx
<h2 className="text-4xl font-bold text-white mb-2 text-center">
  지금 바로 신청하세요
</h2>
<p className="text-blue-100 text-center mb-2 text-lg">
  매니저가 {config.contact.managerResponseTime}시간 내 연락을 드립니다
</p>
```

**취약점**:
- ❌ `<textarea>` 입력 값 검증 없음 → 사용자가 `<script>alert('xss')</script>` 입력 가능
- ❌ API에서 HTML 인코딩 없음 → DB에 평문 저장 → 추후 관리자 페이지에서 렌더링 시 XSS 발생

#### 수정 방법

**Step 1: Input Sanitization (lib/input-validation.ts 생성)**

```typescript
/**
 * XSS 방지를 위한 입력 검증 및 살균
 */

import xss from 'xss'; // npm install xss

/**
 * 텍스트 입력 살균 (XSS 방지)
 * - HTML 태그 제거
 * - 특수 문자 인코딩
 * - 길이 제한
 */
export function sanitizeInput(
  input: string,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
  } = {}
): string {
  const { maxLength = 500, allowNewlines = true } = options;

  // 1. 길이 제한
  let sanitized = input.slice(0, maxLength);

  // 2. XSS 방지: HTML 태그 제거
  sanitized = xss(sanitized, {
    whiteList: {}, // 모든 HTML 태그 제거
    stripIgnoredTag: true,
    stripComments: true
  });

  // 3. 개행 처리
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]/g, '');
  }

  // 4. 공백 정규화
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * 폰번호 입력 살균
 */
export function sanitizePhone(input: string): string {
  // 숫자와 하이픈만 허용
  const cleaned = input.replace(/[^0-9-]/g, '');
  return cleaned.slice(0, 13); // 최대 13자 (01012345678)
}

/**
 * 이메일 입력 살균
 */
export function sanitizeEmail(input: string): string {
  const email = input.toLowerCase().trim();
  // 기본 이메일 형식만 허용
  return email.slice(0, 254); // RFC 5321 제한
}

/**
 * 이름 입력 살균
 */
export function sanitizeName(input: string): string {
  // 한글, 영문, 공백, 하이픈만 허용
  const cleaned = input.replace(/[^가-힣a-zA-Z\s\-]/g, '');
  return cleaned.trim().slice(0, 50);
}
```

**Step 2: SignupForm.tsx 수정**

```tsx
import { sanitizeInput, sanitizeEmail, sanitizePhone, sanitizeName } from '@/lib/input-validation';

// handleChange 수정
const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  
  let sanitized = value;
  
  // ✅ 필드별 살균
  if (name === 'name') {
    sanitized = sanitizeName(value);
  } else if (name === 'email') {
    sanitized = sanitizeEmail(value);
  } else if (name === 'phone') {
    sanitized = sanitizePhone(value);
  } else if (name === 'problem') {
    sanitized = sanitizeInput(value, { maxLength: 300, allowNewlines: true });
  }
  
  setFormData(prev => ({
    ...prev,
    [name]: sanitized
  }));
};
```

**Step 3: API 수정 (contact-signup route.ts)**

```typescript
import { sanitizeInput, sanitizeEmail, sanitizePhone, sanitizeName } from '@/lib/input-validation';

// 라인 54-55 수정
const body = await request.json();
let { name, email, phone, problem, travelType, budget } = body;

// ✅ 입력 살균
name = sanitizeName(name);
email = sanitizeEmail(email);
phone = sanitizePhone(phone);
problem = sanitizeInput(problem || '', { maxLength: 300 });
travelType = sanitizeInput(travelType || '', { maxLength: 50 });
budget = sanitizeInput(budget || '', { maxLength: 50 });

// ... 나머지 검증 ...
```

---

### 3️⃣ CSRF 토큰 부재 - 크로스사이트 요청 위조 가능

#### 현재 문제

SignupForm.tsx는 일반 form POST 요청 → CSRF 공격 위험

```tsx
// 취약한 구조
const response = await fetch('/api/landing/contact-signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ... })
});
```

**문제**:
- ❌ CSRF 토큰 없음 → 공격자가 다른 사이트에서 이 API 호출 가능
- ❌ SameSite 쿠키 없음 → 크로스사이트 요청 구분 불가

#### 수정 방법

**Step 1: CSRF 토큰 생성 API (new file)**

```typescript
// src/app/api/csrf-token/route.ts
import { getMabizSession } from '@/lib/auth';
import crypto from 'crypto';

const CSRF_TOKENS = new Map<string, { token: string; expiresAt: number }>();

export async function GET(request: Request) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ CSRF 토큰 생성 (32바이트 random)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenId = crypto.randomUUID();
    
    // 메모리에 저장 (실무에서는 Redis 사용)
    CSRF_TOKENS.set(tokenId, {
      token,
      expiresAt: Date.now() + 3600000 // 1시간 유효
    });

    return Response.json({
      csrfToken: token,
      tokenId,
      expiresIn: 3600
    });
  } catch (error) {
    return Response.json(
      { error: 'CSRF token generation failed' },
      { status: 500 }
    );
  }
}
```

**Step 2: SignupForm.tsx 수정**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function SignupForm() {
  const [formData, setFormData] = useState({ ... });
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ 폼 로드 시 CSRF 토큰 가져오기
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        setCsrfToken(data.csrfToken);
      } catch (error) {
        logger.error('csrf-token-fetch', error);
      }
    };

    fetchCsrfToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // ✅ CSRF 토큰 검증
    if (!csrfToken) {
      setStatus('error');
      setErrorMessage('보안 검증 실패. 페이지를 새로고침해주세요.');
      return;
    }

    // ... 나머지 로직 ...

    const response = await fetch('/api/landing/contact-signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken // ✅ CSRF 토큰 헤더에 포함
      },
      body: JSON.stringify({
        ...formData,
        phone: phoneFormatted,
        consents,
        consentedAt: new Date().toISOString()
      })
    });
  };

  // ... 나머지 JSX ...
}
```

**Step 3: API 수정 (contact-signup route.ts)**

```typescript
export async function POST(request: Request) {
  try {
    // ✅ CSRF 토큰 검증 (가장 먼저 실행)
    const csrfToken = request.headers.get('X-CSRF-Token');
    if (!csrfToken) {
      return Response.json(
        { error: 'CSRF token missing' },
        { status: 403 }
      );
    }

    // CSRF 토큰 검증 (CSRF_TOKENS에 존재하고 유효한지 확인)
    let tokenValid = false;
    for (const [_, tokenData] of CSRF_TOKENS.entries()) {
      if (
        tokenData.token === csrfToken &&
        tokenData.expiresAt > Date.now()
      ) {
        tokenValid = true;
        break;
      }
    }

    if (!tokenValid) {
      return Response.json(
        { error: 'CSRF token invalid or expired' },
        { status: 403 }
      );
    }

    // ... 나머지 로직 ...
  } catch (error) {
    // ...
  }
}

// OPTIONS 메서드도 CSRF 토큰 포함
export async function OPTIONS(_request: Request) {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://mabizcruisedot.com';
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token', // ✅ CSRF 헤더 추가
      'Access-Control-Max-Age': '86400'
    }
  });
}
```

---

## 🟠 P1 문제 (1주일 내 수정)

### 4️⃣ 이메일 중복 검증 로직 개선

#### 현재 상태

라인 95-115에서 이메일 중복 검사:
```typescript
const existingContact = await prisma.contact.findFirst({
  where: {
    organizationId: session.organizationId,
    email: email.toLowerCase(),
    deletedAt: null
  }
});

if (existingContact) {
  return Response.json({
    success: true,
    contactId: existingContact.id,
    isDuplicate: true,
    message: '이미 가입된 이메일입니다.'
  }, { status: 200 });
}
```

**개선점**:
- ✅ 이메일 소문자 변환 (정규화) OK
- ❌ 폰번호 중복 검사 없음 → 같은 번호로 여러 계정 생성 가능
- ❌ 동일 인물 감지 로직 없음 (이름 + 폰번호 조합)

#### 수정 방법

```typescript
// 라인 94-116 수정
const existingContact = await prisma.contact.findFirst({
  where: {
    organizationId: session.organizationId,
    OR: [
      { email: email.toLowerCase() },
      { phone: phoneClean } // ✅ 폰번호 중복도 검사
    ],
    deletedAt: null
  }
});

if (existingContact) {
  // 같은 이메일인지, 같은 폰번호인지 확인
  const isDuplicateEmail = existingContact.email === email.toLowerCase();
  const isDuplicatePhone = existingContact.phone === phoneClean;
  
  return Response.json(
    {
      success: true,
      contactId: existingContact.id,
      isDuplicate: true,
      duplicateType: isDuplicateEmail ? 'email' : 'phone',
      message: isDuplicateEmail
        ? '이미 가입된 이메일입니다. 다른 이메일을 사용해주세요.'
        : '이미 가입된 폰번호입니다. 고객센터에 문의하세요.',
      nextAction: 'DUPLICATE_CONTACT'
    },
    { status: 200 }
  );
}
```

---

### 5️⃣ 데이터 보유 정책 (Data Retention Policy) 부재

#### 현재 문제

연락 없는 고객 데이터가 무한정 저장됨 → GDPR Article 17 (삭제권) 위반

#### 수정 방법

**Step 1: Contact 모델에 필드 추가 (Prisma schema)**

```prisma
model Contact {
  // ... 기존 필드 ...
  
  // ✅ GDPR 데이터 보유 정책
  landingSignupAt     DateTime?     // Landing 신청 시간
  dataRetentionDays   Int @default(180) // 보유 기간 (기본 180일)
  gdprDeleteScheduledAt DateTime?   // 자동 삭제 예정 시간
  gdprDeleteReason    String?       // 삭제 사유 (RETENTION_EXPIRED, USER_REQUEST)
}

model ContactGdprLog {
  id                  String @id @default(cuid())
  organizationId      String
  contactId           String
  action              String        // DELETE_REQUESTED, DELETE_COMPLETED, DATA_EXPORTED
  reason              String?
  deletedDataSnapshot Json?         // 삭제 전 데이터 스냅샷 (감사용)
  deletedAt           DateTime @default(now())
  createdBy           String?       // 삭제 요청자
  
  @@index([organizationId])
  @@index([contactId])
  @@index([deletedAt])
}
```

**Step 2: 자동 삭제 Cron (new file)**

```typescript
// src/app/api/cron/gdpr-cleanup/route.ts
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  // ✅ Cron 토큰 검증 (보안)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 180일 이상 비활동 Contact 찾기
    const cutoffDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    
    const contactsToDelete = await prisma.contact.findMany({
      where: {
        landingSignupAt: {
          lt: cutoffDate
        },
        gdprDeleteScheduledAt: null,
        deletedAt: null
      },
      select: { id: true, organizationId: true }
    });

    // 각 Contact의 데이터 스냅샷 저장 후 삭제
    let deletedCount = 0;
    for (const contact of contactsToDelete) {
      try {
        // 감사 로그 기록
        await prisma.contactGdprLog.create({
          data: {
            organizationId: contact.organizationId,
            contactId: contact.id,
            action: 'DELETE_COMPLETED',
            reason: 'RETENTION_EXPIRED'
          }
        });

        // Contact 삭제 (soft delete)
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            deletedAt: new Date(),
            name: '[DELETED]',
            email: null,
            phone: null,
            adminMemo: null
          }
        });

        deletedCount++;
      } catch (error) {
        console.error(`[gdpr-cleanup] Failed to delete contact ${contact.id}`, error);
      }
    }

    return Response.json({
      success: true,
      message: `Deleted ${deletedCount} contacts`,
      deletedCount
    });
  } catch (error) {
    console.error('[gdpr-cleanup-error]', error);
    return Response.json(
      { error: 'GDPR cleanup failed' },
      { status: 500 }
    );
  }
}
```

---

## 🟡 P2 문제 (한 달 내 수정)

### 6️⃣ 개인정보 접근 제어 강화

#### 현재 상태

Contact 데이터 조회 시 역할 기반 접근 제어 (RBAC) 부분적 적용

#### 수정 방법

```typescript
/**
 * Contact 조회 권한 검증
 * Admin/Owner/Manager: 전체 데이터 조회
 * Agent: 자신이 할당받은 Contact만 조회
 */
export async function getContactWithAuthorization(
  contactId: string,
  session: any
): Promise<Contact | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId }
  });

  if (!contact) return null;

  // ✅ 역할 기반 접근 제어
  const userRole = session.user?.role;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(userRole);
  const isManager = userRole === 'MANAGER';
  const isAssignedAgent = contact.assignedUserId === session.user?.id;

  if (!isAdmin && !isManager && !isAssignedAgent) {
    throw new Error('Contact 조회 권한 없음');
  }

  // ✅ Agent의 경우 민감 정보 마스킹
  if (!isAdmin && !isManager && isAssignedAgent) {
    return maskSensitiveData(contact);
  }

  return contact;
}
```

---

### 7️⃣ 의료 정보 보호 (HIPAA 준수)

#### 현재 상태

건강검진 혜택 언급 → 의료 정보 가능성

#### 수정 방법

```typescript
// Contact 모델에 의료 정보 분리
model ContactHealthInfo {
  id                  String @id @default(cuid())
  contactId           String @unique
  healthCheckupConsent Boolean @default(false)
  // 의료 정보는 별도 암호화 저장
  encryptedHealthData String? // HIPAA-compliant encryption
  
  @@index([contactId])
}
```

---

## ✅ 현재 올바르게 구현된 사항

| 항목 | 현재 상태 | 평가 |
|------|---------|------|
| **폰번호 검증** | ✅ 정규식 `/^01[0-9]\d{7,8}$/` | 우수 |
| **이메일 검증** | ✅ 기본 정규식 | 우수 |
| **암호화** | ✅ AES-256-GCM (adminMemo) | 우수 |
| **Rate Limiting** | ✅ IP 기반 10회/분 | 우수 |
| **로그 마스킹** | ✅ PII 마스킹 (라인 204) | 우수 |
| **매니저 자동 배정** | ✅ WeightedRoundRobin | 우수 |
| **렌즈 감지** | ✅ 자동 L0-L10 분류 | 우수 |
| **Day 0-3 SMS** | ✅ 자동 스케줄링 | 우수 |

---

## 📋 GDPR 체크리스트 (5가지 미충족)

| 항목 | 현재 | 필요 | 우선순위 |
|------|------|------|----------|
| **1. 동의 (Article 6)** | ❌ | ✅ | **P0** |
| **2. 개인정보처리방침** | ⚠️ 링크만 | ✅ | **P0** |
| **3. 동의 철회 기능** | ❌ | ✅ | **P0** |
| **4. 데이터 삭제 (Article 17)** | ❌ | ✅ | **P1** |
| **5. 데이터 이동권 (Article 20)** | ❌ | ✅ | **P1** |
| **6. 데이터 처리 동의서 (DPA)** | ❌ | ✅ | **P2** |
| **7. 개인정보 영향 평가 (DPIA)** | ❌ | ✅ | **P2** |

---

## 🛠️ 구현 로드맵

### Phase 1: P0 (즉시 - 2026-06-10까지)
- [ ] GDPR 동의 UI 추가 (CheckboxConsentForm.tsx)
- [ ] XSS 방지 (input-validation.ts)
- [ ] CSRF 토큰 구현
- [ ] 개인정보처리방침 페이지 작성
- [ ] 동의 철회 기능 (unsubscribe API)

### Phase 2: P1 (1주일 - 2026-06-17까지)
- [ ] 폰번호 중복 검사 개선
- [ ] 데이터 보유 정책 + 자동 삭제 Cron
- [ ] 데이터 삭제 요청 API
- [ ] GDPR 로깅 추가

### Phase 3: P2 (1개월 - 2026-07-03까지)
- [ ] 역할 기반 접근 제어 강화
- [ ] 의료 정보 별도 관리
- [ ] DPA 체크리스트
- [ ] DPIA 문서 작성

---

## 📞 보안 체크리스트 최종 서명

**검토자**: 보안 전문가 (Claude Code)  
**검토 일시**: 2026-06-03 14:30 KST  
**상태**: ⚠️ **3개 P0 취약점 수정 대기 중**

---

## 참고 자료

- [GDPR Official](https://gdpr-info.eu/)
- [개인정보보호법](https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EB%B3%B4%ED%98%B8%EB%B2%95)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
