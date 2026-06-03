# 크루즈닷 보안 구현 가이드 (P0 우선순위)

**목표**: 3개 P0 취약점 수정 (완료 시간: ~8시간)  
**완료 후 예상 효과**: GDPR/한국법 준수 + XSS/CSRF 방지

---

## 📦 필요 패키지 설치

```bash
# 1. XSS 방지 라이브러리
npm install xss
npm install --save-dev @types/xss

# 2. 폼 유효성 검사 (선택, 더 강력한 검증 원할 경우)
npm install zod

# 3. Rate Limiting 강화 (이미 설치되어 있음)
# (rate-limit 라이브러리 확인)
```

---

## 🔴 P0-1: GDPR 동의 UI 구현

### 파일 1: `src/app/(dashboard)/landing/cruisedot/components/ConsentCheckbox.tsx`

```tsx
'use client';

import { useState } from 'react';

interface ConsentCheckboxProps {
  onConsentChange?: (consents: {
    privacyPolicy: boolean;
    marketing: boolean;
  }) => void;
  disabled?: boolean;
}

/**
 * GDPR 동의 UI 컴포넌트
 * - 필수: 개인정보 처리 동의
 * - 선택: 마케팅 정보 수신 동의
 * - 각 항목별 정책 링크 포함
 */
export default function ConsentCheckbox({
  onConsentChange,
  disabled = false
}: ConsentCheckboxProps) {
  const [consents, setConsents] = useState({
    privacyPolicy: false,
    marketing: false
  });

  const handleChange = (field: keyof typeof consents) => {
    const updated = { ...consents, [field]: !consents[field] };
    setConsents(updated);
    onConsentChange?.(updated);
  };

  return (
    <div className="space-y-4 mb-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
      <div className="text-sm font-bold text-gray-800 mb-4">
        🔐 개인정보 동의 (GDPR Article 6)
      </div>

      {/* 필수 동의: 개인정보 처리 */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={consents.privacyPolicy}
          onChange={() => handleChange('privacyPolicy')}
          disabled={disabled}
          required
          className="mt-1 w-5 h-5 accent-blue-600 cursor-pointer"
          aria-label="개인정보 수집·이용 동의"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            개인정보 수집·이용 동의{' '}
            <span className="text-red-600 font-bold">*</span>
          </p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            성함, 이메일, 휴대폰 번호는 크루즈닷 상담을 위해서만 수집·이용됩니다.
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 ml-1 inline-block"
            >
              개인정보처리방침
            </a>
          </p>
          <p className="text-xs text-gray-500 mt-1.5 bg-gray-100 p-2 rounded">
            🔒 법적 근거: GDPR Article 6(1)(a) / 개인정보보호법 제15조 제1항
          </p>
        </div>
      </label>

      {/* 선택 동의: 마케팅 SMS */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={consents.marketing}
          onChange={() => handleChange('marketing')}
          disabled={disabled}
          className="mt-1 w-5 h-5 accent-green-600 cursor-pointer"
          aria-label="마케팅 정보 수신 동의"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            마케팅 정보 수신 동의{' '}
            <span className="text-gray-400 font-normal">(선택)</span>
          </p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Day 0-3 크루즈 프로모션 SMS, 세미패키지 할인 정보, 특가 상품 안내를
            수신할 수 있습니다.
          </p>
          <p className="text-xs text-gray-500 mt-1.5">
            📱 동의 철회: SMS 회신 {'{'}
            <a href="/unsubscribe" className="text-blue-600 underline hover:text-blue-800">
              수신거부
            </a>
            {'}'}' 또는{' '}
            <a href="tel:010-XXXX-XXXX" className="text-blue-600 underline hover:text-blue-800">
              고객센터
            </a>
            {' '}
            문의
          </p>
        </div>
      </label>

      {/* 필수 동의 미충족 경고 */}
      {!consents.privacyPolicy && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mt-4">
          <p className="text-red-700 text-xs font-semibold">
            ⚠️ 개인정보 처리 동의는 필수입니다
          </p>
          <p className="text-red-600 text-xs mt-1">
            신청을 완료하려면 개인정보 처리에 동의해야 합니다.
          </p>
        </div>
      )}

      {/* 동의 요약 */}
      <div className="bg-gray-50 p-3 rounded text-xs text-gray-600 border border-gray-200 mt-4">
        <span className="font-semibold">선택 내역:</span> 필수
        {consents.privacyPolicy ? '✅' : '❌'} / 마케팅
        {consents.marketing ? '✅' : '❌'}
      </div>
    </div>
  );
}
```

### 파일 2: 수정된 `SignupForm.tsx`

**주요 변경 사항** (기존 파일의 핵심 부분만 표시):

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import ConsentCheckbox from './ConsentCheckbox'; // ✅ 추가
import { sanitizeInput, sanitizeEmail, sanitizePhone, sanitizeName } from '@/lib/input-validation'; // ✅ 추가

export default function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    problem: '',
    travelType: '',
    budget: ''
  });

  // ✅ GDPR 동의 상태 추가
  const [consents, setConsents] = useState({
    privacyPolicy: false,
    marketing: false
  });

  const [csrfToken, setCsrfToken] = useState(''); // ✅ CSRF 토큰 추가
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // ✅ CSRF 토큰 가져오기
  React.useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        setCsrfToken(data.csrfToken);
      } catch (error) {
        logger.error('csrf-token-fetch', error);
        setStatus('error');
        setErrorMessage('보안 설정 실패. 페이지를 새로고침해주세요.');
      }
    };

    fetchCsrfToken();
  }, []);

  // ✅ 입력값 살균 (XSS 방지)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    let sanitized = value;

    if (name === 'name') {
      sanitized = sanitizeName(value);
    } else if (name === 'email') {
      sanitized = sanitizeEmail(value);
    } else if (name === 'phone') {
      sanitized = sanitizePhone(value);
    } else if (name === 'problem') {
      sanitized = sanitizeInput(value, { maxLength: 300, allowNewlines: true });
    } else if (name === 'travelType' || name === 'budget') {
      sanitized = sanitizeInput(value, { maxLength: 50 });
    }

    setFormData(prev => ({
      ...prev,
      [name]: sanitized
    }));
  };

  // ✅ 동의 변경 핸들러
  const handleConsentChange = (newConsents: typeof consents) => {
    setConsents(newConsents);
  };

  // ✅ 폼 제출 (GDPR + CSRF 검증 포함)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    // ✅ GDPR 필수 동의 검증
    if (!consents.privacyPolicy) {
      setStatus('error');
      setErrorMessage('❌ 개인정보 처리 동의는 필수입니다');
      setLoading(false);
      return;
    }

    // ✅ CSRF 토큰 검증
    if (!csrfToken) {
      setStatus('error');
      setErrorMessage('❌ 보안 검증 실패. 페이지를 새로고침해주세요.');
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

      // ✅ API 요청 (CSRF 토큰 + 동의 정보 포함)
      const response = await fetch('/api/landing/contact-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken // ✅ CSRF 토큰 헤더
        },
        body: JSON.stringify({
          ...formData,
          phone: phoneFormatted,
          consents, // ✅ 동의 정보
          consentedAt: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error || '신청 중 오류가 발생했습니다');
        return;
      }

      setStatus('success');
      setFormData({ name: '', email: '', phone: '', problem: '', travelType: '', budget: '' });
      setConsents({ privacyPolicy: false, marketing: false });

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
      {/* 이름 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          성함 <span className="text-red-300">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="예) 김민지"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
        />
      </div>

      {/* 이메일 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          이메일 <span className="text-red-300">*</span>
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="예) kim@email.com"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
        />
      </div>

      {/* 폰번호 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          휴대폰 번호 <span className="text-red-300">*</span>
        </label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="예) 010-1234-5678"
          pattern="01[0-9]-?\d{3,4}-?\d{4}"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800"
        />
      </div>

      {/* 여행 유형 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          어떤 크루즈를 원하시나요?
        </label>
        <select
          name="travelType"
          value={formData.travelType}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 bg-white"
        >
          <option value="">선택하세요</option>
          <option value="국내">국내 크루즈 (부산)</option>
          <option value="해외">해외 크루즈 (일본/동남아)</option>
          <option value="프리미엄">프리미엄</option>
          <option value="경제형">경제형</option>
          <option value="gold-member">골드 회원 프로그램</option>
        </select>
      </div>

      {/* 예산 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          예산 범위
        </label>
        <select
          name="budget"
          value={formData.budget}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 bg-white"
        >
          <option value="">선택하세요</option>
          <option value="20-30만원">20-30만원 (국내)</option>
          <option value="130만원">130만원 (경제형)</option>
          <option value="159만원">159만원 (프리미엄)</option>
          <option value="그 이상">그 이상</option>
        </select>
      </div>

      {/* 신청 사유 */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">
          신청 사유 (선택)
        </label>
        <textarea
          name="problem"
          value={formData.problem}
          onChange={handleChange}
          placeholder="예) 혼자 여행이라 불안해요 / 여행 준비가 복잡해서요"
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-800 resize-none"
        />
      </div>

      {/* ✅ GDPR 동의 UI */}
      <ConsentCheckbox
        onConsentChange={handleConsentChange}
        disabled={loading}
      />

      {/* 에러 메시지 */}
      {status === 'error' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {errorMessage}
        </div>
      )}

      {/* 성공 메시지 */}
      {status === 'success' && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          ✅ 신청이 완료되었습니다! 매니저가 2시간 내 연락 드릴 예정입니다.
        </div>
      )}

      {/* 제출 버튼 (필수 동의 필요) */}
      <button
        type="submit"
        disabled={loading || !consents.privacyPolicy || !csrfToken}
        className={`w-full py-4 rounded-lg font-bold text-lg text-white transition-colors ${
          loading || !consents.privacyPolicy || !csrfToken
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700'
        }`}
      >
        {loading ? '신청 중...' : '🚀 지금 신청하기 (무료)'}
      </button>

      {/* GDPR 관련 안내 */}
      <p className="text-xs text-blue-100 text-center">
        🔒 입력하신 정보는 암호화되어 보관되며, 동의 없이 절대 외부로 공개되지 않습니다.<br/>
        <a href="/privacy-policy" className="text-blue-300 underline hover:text-white">
          개인정보처리방침
        </a>
        {' '}· {' '}
        <a href="/unsubscribe" className="text-blue-300 underline hover:text-white">
          수신거부
        </a>
      </p>
    </form>
  );
}
```

---

## 🔴 P0-2: XSS 방지 (Input Sanitization)

### 파일 3: `src/lib/input-validation.ts` (신규 생성)

```typescript
/**
 * XSS 방지 입력 검증 및 살균 라이브러리
 * 
 * 모든 사용자 입력값을 이 함수로 처리하여 XSS 공격 방지
 */

import xss from 'xss';

/**
 * 일반 텍스트 입력 살균 (XSS 방지)
 * - HTML 태그 제거
 * - 특수 문자 인코딩
 * - 길이 제한
 * 
 * @param input 사용자 입력값
 * @param maxLength 최대 길이
 * @param allowNewlines 개행 허용 여부
 * @returns 살균된 텍스트
 */
export function sanitizeInput(
  input: string,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
  } = {}
): string {
  if (!input || typeof input !== 'string') return '';

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
    sanitized = sanitized.replace(/[\r\n\t]/g, '');
  } else {
    // 개행 정규화 (\r\n → \n)
    sanitized = sanitized.replace(/\r\n/g, '\n');
  }

  // 4. 공백 정규화
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * 폰번호 입력 살균
 * 숫자와 하이픈만 허용, 최대 13자
 */
export function sanitizePhone(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // 숫자와 하이픈만 허용
  const cleaned = input.replace(/[^0-9\-]/g, '');

  // 최대 길이 제한
  return cleaned.slice(0, 13); // 01012345678 형식
}

/**
 * 이메일 입력 살균
 * 소문자 정규화, RFC 5321 길이 제한
 */
export function sanitizeEmail(input: string): string {
  if (!input || typeof input !== 'string') return '';

  const email = input.toLowerCase().trim();

  // XSS 문자 제거
  const sanitized = xss(email, {
    whiteList: {},
    stripIgnoredTag: true
  });

  // RFC 5321: 이메일 최대 길이 254자
  return sanitized.slice(0, 254);
}

/**
 * 이름 입력 살균
 * 한글, 영문, 공백, 하이픈만 허용
 */
export function sanitizeName(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // 한글, 영문, 공백, 하이픈만 허용
  const cleaned = input.replace(/[^가-힣a-zA-Z\s\-]/g, '');

  // 공백 정규화 (연속 공백 제거)
  const normalized = cleaned.replace(/\s+/g, ' ').trim();

  // 최대 50자
  return normalized.slice(0, 50);
}

/**
 * 선택 필드 (select option) 살균
 * 사전 정의된 옵션 값만 허용
 */
export function sanitizeSelectValue(
  input: string,
  allowedValues: string[]
): string | null {
  if (!input || typeof input !== 'string') return null;

  const cleaned = input.trim();

  // 허용된 값에 포함되는지 확인
  if (allowedValues.includes(cleaned)) {
    return cleaned;
  }

  return null; // 허용되지 않는 값
}

/**
 * URL 입력 살균 (외부 링크)
 * 기본 XSS 방지 + 프로토콜 검증
 */
export function sanitizeUrl(input: string): string {
  if (!input || typeof input !== 'string') return '';

  try {
    const url = new URL(input);
    
    // 프로토콜 검증 (http, https만 허용)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }

    return url.toString();
  } catch {
    // 잘못된 URL
    return '';
  }
}

/**
 * HTML 콘텐츠 안전하게 렌더링
 * (관리자가 작성한 콘텐츠 등에만 사용)
 */
export function sanitizeHtml(
  input: string,
  allowedTags: string[] = ['b', 'i', 'em', 'strong', 'br', 'p']
): string {
  if (!input || typeof input !== 'string') return '';

  const whiteList: Record<string, string[]> = {};
  allowedTags.forEach(tag => {
    whiteList[tag] = [];
  });

  return xss(input, {
    whiteList,
    stripIgnoredTag: true,
    stripComments: true
  });
}

/**
 * 입력값 검증 유틸
 * 유효한 형식인지 확인
 */
export const validateInput = {
  email: (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },

  phone: (phone: string): boolean => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    const regex = /^01[0-9]\d{7,8}$/;
    return regex.test(cleaned);
  },

  name: (name: string): boolean => {
    return name.length >= 2 && name.length <= 50;
  },

  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};
```

### API 수정: `src/app/api/landing/contact-signup/route.ts`

**핵심 변경 사항** (라인 28-100):

```typescript
import { sanitizeInput, sanitizeEmail, sanitizePhone, sanitizeName } from '@/lib/input-validation';

export async function POST(request: Request) {
  try {
    // 0. IP 기반 Rate Limiting
    const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const rl = await checkRateLimitAsync(`landing_signup:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return Response.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 });
    }

    // 1. 조직 인증
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 요청 본문 파싱 + ✅ CSRF 토큰 검증
    const csrfToken = request.headers.get('X-CSRF-Token');
    if (!csrfToken) {
      return Response.json({ error: 'CSRF token missing' }, { status: 403 });
    }

    // CSRF 토큰 검증 (생략, CSRF API 구현 필요)
    // const isValidCsrf = await validateCsrfToken(csrfToken);
    // if (!isValidCsrf) {
    //   return Response.json({ error: 'CSRF token invalid' }, { status: 403 });
    // }

    const body = await request.json();
    let { name, email, phone, problem, travelType, budget, consents, consentedAt } = body;

    // ✅ 입력값 살균 (XSS 방지)
    name = sanitizeName(name);
    email = sanitizeEmail(email);
    phone = sanitizePhone(phone);
    problem = sanitizeInput(problem || '', { maxLength: 300, allowNewlines: true });
    travelType = sanitizeInput(travelType || '', { maxLength: 50 });
    budget = sanitizeInput(budget || '', { maxLength: 50 });

    // 3. 필수 필드 검증
    if (!name || !email || !phone) {
      return Response.json(
        {
          error: '이름, 이메일, 폰번호는 필수입니다',
          fields: { name: !!name, email: !!email, phone: !!phone }
        },
        { status: 400 }
      );
    }

    // 이름 길이 검증
    if (name.length < 2 || name.length > 50) {
      return Response.json(
        { error: '이름은 2-50자 사이여야 합니다' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: '올바른 이메일 형식이 아닙니다' },
        { status: 400 }
      );
    }

    // 폰번호 형식 검증
    const phoneClean = phone.replace(/-/g, '');
    const phoneRegex = /^01[0-9]\d{7,8}$/;
    if (!phoneRegex.test(phoneClean)) {
      return Response.json(
        { error: '올바른 폰번호 형식이 아닙니다 (010-1234-5678 형식)' },
        { status: 400 }
      );
    }

    // ✅ GDPR 필수 동의 검증
    if (!consents?.privacyPolicy) {
      return Response.json(
        { error: '개인정보 처리 동의는 필수입니다 (GDPR Article 7)' },
        { status: 400 }
      );
    }

    // 4. 중복 가입 확인 (이메일 + 폰번호)
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
      const isDuplicateEmail = existingContact.email === email.toLowerCase();
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

    // ... 나머지 로직은 동일 ...
  } catch (error) {
    // ... 에러 처리 ...
  }
}
```

---

## 🔴 P0-3: CSRF 토큰 구현

### 파일 4: `src/app/api/csrf-token/route.ts` (신규 생성)

```typescript
/**
 * CSRF 토큰 생성 API
 * 
 * GET /api/csrf-token
 * Response: { csrfToken: string, expiresIn: number }
 */

import { getMabizSession } from '@/lib/auth';
import crypto from 'crypto';

// 메모리 기반 CSRF 토큰 저장소
// 실무에서는 Redis 사용 권장
const CSRF_TOKENS = new Map<string, {
  token: string;
  expiresAt: number;
  userId?: string;
}>();

// 만료된 토큰 정리 (주기적)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of CSRF_TOKENS.entries()) {
    if (value.expiresAt < now) {
      CSRF_TOKENS.delete(key);
    }
  }
}, 5 * 60 * 1000); // 5분마다 정리

/**
 * CSRF 토큰 생성
 */
export async function GET(request: Request) {
  try {
    // 사용자 세션 확인 (선택사항, 공개 폼인 경우 생략 가능)
    const session = await getMabizSession();
    const userId = session?.user?.id;

    // ✅ CSRF 토큰 생성 (32바이트 = 256비트)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenId = crypto.randomUUID();

    // 메모리에 저장 (1시간 유효)
    CSRF_TOKENS.set(tokenId, {
      token,
      expiresAt: Date.now() + 3600000, // 1시간
      userId
    });

    return Response.json(
      {
        csrfToken: token,
        tokenId,
        expiresIn: 3600 // 초 단위
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );
  } catch (error) {
    console.error('[csrf-token-error]', error);
    return Response.json(
      { error: 'CSRF token generation failed' },
      { status: 500 }
    );
  }
}

/**
 * CSRF 토큰 검증 함수 (내부 사용)
 * 
 * @param token 클라이언트에서 받은 토큰
 * @returns 유효 여부
 */
export function verifyCsrfToken(token: string): boolean {
  const now = Date.now();

  for (const [_, tokenData] of CSRF_TOKENS.entries()) {
    if (
      tokenData.token === token &&
      tokenData.expiresAt > now
    ) {
      // 검증 후 토큰 제거 (1회용)
      CSRF_TOKENS.delete(_);
      return true;
    }
  }

  return false;
}
```

---

## 📋 체크리스트

### P0-1: GDPR 동의
- [ ] `ConsentCheckbox.tsx` 생성
- [ ] `SignupForm.tsx` 수정 (consent state + handler)
- [ ] API 수정 (consents 검증 + 저장)
- [ ] Prisma schema 수정 (consentedPrivacyAt, consentedMarketingAt 필드 추가)

### P0-2: XSS 방지
- [ ] `input-validation.ts` 생성
- [ ] `npm install xss` 설치
- [ ] API에 sanitization 적용
- [ ] 모든 사용자 입력 필드에 handleChange 개선

### P0-3: CSRF 토큰
- [ ] `csrf-token/route.ts` 생성
- [ ] SignupForm에서 token 가져오기 (useEffect)
- [ ] API 헤더에 X-CSRF-Token 전송
- [ ] API에서 토큰 검증

---

## ✅ 테스트 항목

```bash
# 1. XSS 테스트
# 신청 폼에 <script>alert('xss')</script> 입력 → 저장되지 않음

# 2. CSRF 테스트
# X-CSRF-Token 헤더 없이 API 호출 → 403 Forbidden

# 3. GDPR 동의 테스트
# consent 없이 제출 → "동의 필수" 에러

# 4. 이메일/폰번호 중복 테스트
# 같은 이메일/폰번호로 재신청 → 중복 메시지 표시
```

---

**총 예상 구현 시간**: 6-8시간  
**난이도**: 중간 (기술적 복잡성 낮음, 주의 깊은 적용 필요)

