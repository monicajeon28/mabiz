# FE-02 Phase 2 구현 준비 (2026-06-08)

## 🚀 Phase 2 시작 전 체크리스트

### ✅ Phase 1 완료 (설계)
- [x] 거장단토론 (3가지 해결책 검토 → 하이브리드 선택)
- [x] UI/UX 설계 (4가지 상태 와이어프레임)
- [x] 상태 관리 아키텍처 (상태 전이도)
- [x] 타입 정의 (FormState, FieldErrors 등)
- [x] 에러 메시지 카탈로그 (40+ 메시지)
- [x] 심리학 적용 (Grant Cardone 3렌즈)
- [x] 구현 계획서 (1125줄)
- [x] 테스트 계획 (6가지 시나리오)

### 📋 생성 예정 파일 (Phase 2에서 실행)

#### A. 타입 정의: `src/types/forms.ts`

```typescript
/**
 * 폼 데이터 인터페이스
 */
export interface LandingFormData {
  name: string;
  phone: string;
  email: string;
  interest: string;
  message: string;
}

/**
 * 필드별 에러 맵
 * 예: { name: "이름은 필수입니다", phone: "..." }
 */
export interface FieldErrors {
  [key: string]: string;
}

/**
 * 폼 검증 에러
 */
export interface FormValidationError {
  fieldName: keyof LandingFormData;
  message: string;
  type: 'required' | 'format' | 'length';
}

/**
 * API 응답 타입
 */
export interface LandingContactSignupResponse {
  success: boolean;
  lens?: string;
  message: string;
  nextAction: string;
  smsScheduledFor?: string;
  isDuplicate?: boolean;
  errors?: FieldErrors; // 필드별 검증 에러
  error?: string; // 전역 에러 메시지
  timestamp?: string;
}

/**
 * Toast 설정
 */
export interface ToastConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  duration?: number; // milliseconds
}

/**
 * 폼 상태
 */
export interface FormState {
  formData: LandingFormData;
  submitStatus: 'idle' | 'loading' | 'success' | 'error';
  fieldErrors: FieldErrors;
  globalError: string | null;
  showFieldErrors: boolean;
}
```

#### B. 에러 메시지: `src/lib/form-error-messages.ts`

```typescript
/**
 * 에러 메시지 카탈로그
 * 분류: VALIDATION | SERVER | NETWORK | SYSTEM
 */

export const ERROR_MESSAGES = {
  // ===== 필수 필드 (REQUIRED) =====
  REQUIRED: {
    name: '이름은 필수입니다.',
    phone: '휴대폰 번호는 필수입니다.',
    email: '이메일은 필수입니다.',
    interest: '관심 상품을 선택해주세요.',
  },

  // ===== 형식 오류 (FORMAT) =====
  FORMAT: {
    name: '이름은 1글자 이상 50글자 이하여야 합니다.',
    phone: '유효한 번호를 입력해주세요 (예: 010-1234-5678)',
    email: '유효한 이메일 주소를 입력해주세요.',
  },

  // ===== 길이 오류 (LENGTH) =====
  LENGTH: {
    name: '이름은 2-50자 사이여야 합니다.',
    message: '메시지는 500자 이하여야 합니다.',
  },

  // ===== 서버 에러 (SERVER) =====
  SERVER: {
    DUPLICATE_EMAIL: '이미 신청하신 이메일입니다.',
    DUPLICATE_PHONE: '이미 신청하신 휴대폰 번호입니다.',
    DUPLICATE_CHECK: '이미 가입된 이메일입니다. 매니저가 2시간 내 연락 드릴 예정입니다.',
    INTERNAL_ERROR: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    RATE_LIMIT: '너무 많은 요청을 보내셨습니다. 1분 후 다시 시도해주세요.',
  },

  // ===== 네트워크 에러 (NETWORK) =====
  NETWORK: {
    TIMEOUT: '요청이 시간 초과되었습니다. 다시 시도해주세요.',
    CONNECTION: '인터넷 연결을 확인해주세요.',
    UNKNOWN: '네트워크 오류가 발생했습니다. 다시 시도해주세요.',
  },

  // ===== 전역 에러 메시지 =====
  GLOBAL: {
    VALIDATION_FAILED: '입력값을 확인해주세요.',
    SERVER_ERROR: '서버 오류가 발생했습니다.',
    NETWORK_ERROR: '네트워크 오류. 인터넷 연결을 확인해주세요.',
  },
};

/**
 * Toast 메시지 (사용자 친화적)
 */
export const TOAST_MESSAGES = {
  VALIDATION_ERROR: {
    title: '입력값을 확인해주세요.',
    description: '표시된 필드를 수정하고 다시 시도해주세요.',
  },
  DUPLICATE_EMAIL: {
    title: '이미 신청하신 이메일입니다.',
    description: '다른 이메일로 신청하거나 매니저 연락을 기다려주세요.',
  },
  DUPLICATE_PHONE: {
    title: '이미 신청하신 번호입니다.',
    description: '다른 번호로 신청하거나 매니저 연락을 기다려주세요.',
  },
  SERVER_ERROR: {
    title: '서버 오류',
    description: '잠시 후 다시 시도해주세요.',
  },
  NETWORK_ERROR: {
    title: '네트워크 오류',
    description: '인터넷 연결을 확인해주세요.',
  },
  SUCCESS: {
    title: '신청이 완료되었습니다!',
    description: '24시간 내에 매니저가 연락 드리겠습니다.',
  },
};

/**
 * 심리학 기반 권장 메시지
 */
export const PSYCHOLOGICAL_MESSAGES = {
  // 권위성 (Authority)
  VALIDATION_HINT: '전문가 매니저가 정확한 정보로 맞춤 상담을 드립니다.',
  
  // 손실회피 (Loss Aversion)
  DUPLICATE_OPPORTUNITY: '이미 신청하셨으니 매니저 연락만 기다려주세요. 놓칠 수 있으니 전화 꼭 받아주세요!',
  
  // 사회증명 (Social Proof)
  POST_SUCCESS: '지금까지 5,000+ 고객이 신청했으며, 98% 만족도를 받았습니다.',
};
```

#### C. 검증 로직: `src/lib/form-validation.ts`

```typescript
import { ERROR_MESSAGES } from './form-error-messages';
import type { LandingFormData, FieldErrors } from '@/types/forms';

/**
 * 폰번호 형식 검증
 * 형식: 010-XXXX-XXXX 또는 01000000000
 */
function validatePhoneFormat(phone: string): boolean {
  const phoneClean = phone.replace(/-/g, '');
  const phoneRegex = /^01[0-9]\d{7,8}$/;
  return phoneRegex.test(phoneClean);
}

/**
 * 이메일 형식 검증
 */
function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 이름 길이 검증 (2-50자)
 */
function validateNameLength(name: string): boolean {
  return name.length >= 2 && name.length <= 50;
}

/**
 * 전체 폼 데이터 검증
 * @returns 에러 객체 (에러 없으면 빈 객체 {})
 */
export function validateFormData(formData: LandingFormData): FieldErrors {
  const errors: FieldErrors = {};

  // 이름 검증
  const name = formData.name.trim();
  if (!name) {
    errors.name = ERROR_MESSAGES.REQUIRED.name;
  } else if (!validateNameLength(name)) {
    errors.name = ERROR_MESSAGES.LENGTH.name;
  }

  // 폰번호 검증
  const phone = formData.phone.trim();
  if (!phone) {
    errors.phone = ERROR_MESSAGES.REQUIRED.phone;
  } else if (!validatePhoneFormat(phone)) {
    errors.phone = ERROR_MESSAGES.FORMAT.phone;
  }

  // 이메일 검증 (선택사항)
  const email = formData.email.trim();
  if (email && !validateEmailFormat(email)) {
    errors.email = ERROR_MESSAGES.FORMAT.email;
  }

  // 관심 상품 검증
  if (!formData.interest) {
    errors.interest = ERROR_MESSAGES.REQUIRED.interest;
  }

  // 메시지 길이 검증 (선택사항, 최대 500자)
  if (formData.message && formData.message.length > 500) {
    errors.message = ERROR_MESSAGES.LENGTH.message;
  }

  return errors;
}

/**
 * 개별 필드 검증 (실시간 검증용, Phase 2+)
 */
export function validateField(
  fieldName: keyof LandingFormData,
  value: string
): string | null {
  const trimmed = value.trim();

  switch (fieldName) {
    case 'name':
      if (!trimmed) return ERROR_MESSAGES.REQUIRED.name;
      if (!validateNameLength(trimmed)) return ERROR_MESSAGES.LENGTH.name;
      return null;

    case 'phone':
      if (!trimmed) return ERROR_MESSAGES.REQUIRED.phone;
      if (!validatePhoneFormat(trimmed)) return ERROR_MESSAGES.FORMAT.phone;
      return null;

    case 'email':
      if (trimmed && !validateEmailFormat(trimmed)) return ERROR_MESSAGES.FORMAT.email;
      return null;

    case 'interest':
      if (!value) return ERROR_MESSAGES.REQUIRED.interest;
      return null;

    case 'message':
      if (trimmed.length > 500) return ERROR_MESSAGES.LENGTH.message;
      return null;

    default:
      return null;
  }
}
```

#### D. 폼 필드 컴포넌트: `src/components/landing/FormField.tsx`

```typescript
'use client';

import React from 'react';

interface FormFieldProps {
  id: string;
  name: string;
  type: 'text' | 'tel' | 'email' | 'select' | 'textarea';
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  rows?: number;
}

export default function FormField({
  id,
  name,
  type,
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled,
  hint,
  options,
  rows = 3,
}: FormFieldProps) {
  const hasError = !!error;
  const borderColor = hasError ? 'border-red-500' : 'border-gray-300';
  const bgColor = hasError ? 'bg-red-50' : 'bg-white';
  const focusColor = hasError ? 'focus:ring-red-500' : 'focus:ring-blue-500';

  return (
    <div>
      {/* Label */}
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-gray-900 mb-2"
      >
        {label}
      </label>

      {/* Input Field */}
      {type === 'select' ? (
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full px-4 py-3 border ${borderColor} ${bgColor} rounded-lg ${focusColor} focus:border-transparent outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${
            hasError ? 'text-red-700 placeholder-red-400' : 'text-gray-900'
          }`}
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder}
          className={`w-full px-4 py-3 border ${borderColor} ${bgColor} rounded-lg ${focusColor} focus:border-transparent outline-none transition-all resize-none disabled:bg-gray-100 disabled:cursor-not-allowed ${
            hasError ? 'text-red-700 placeholder-red-400' : 'text-gray-900'
          }`}
        />
      ) : (
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={label.includes('*')}
          placeholder={placeholder}
          className={`w-full px-4 py-3 border ${borderColor} ${bgColor} rounded-lg ${focusColor} focus:border-transparent outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${
            hasError ? 'text-red-700 placeholder-red-400' : 'text-gray-900'
          }`}
        />
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-2 flex items-start gap-2">
          <span className="text-red-600 font-bold text-sm flex-shrink-0 mt-0.5">⚠️</span>
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* 힌트 텍스트 */}
      {hint && !error && (
        <p className="mt-2 text-gray-500 text-xs">{hint}</p>
      )}
    </div>
  );
}
```

#### E. CTA 섹션 수정: `src/components/landing/CTASection.tsx`

**주요 변경사항**:
1. Toast import 추가
2. FormField import 추가
3. 상태 추가 (fieldErrors, globalError, showFieldErrors)
4. handleInputChange 개선
5. handleSubmit 개선 (클라이언트 검증 + Toast)
6. 렌더링 업데이트 (FormField 사용)

→ 상세 코드는 `docs/FE-02-FORM-ERROR-PHASE1-IMPLEMENTATION.md` 참고 (라인 194-536)

#### F. 레이아웃 수정: `src/app/layout.tsx`

**변경사항**:
```typescript
import { Toaster } from 'sonner';

export default function RootLayout({...}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
```

---

## 🔄 Phase 2 실행 순서

### Step 1: 패키지 설치 (5분)
```bash
npm install sonner
```

### Step 2: 파일 생성 (10분)
```bash
# 파일 생성 (복사 붙여넣기)
touch src/types/forms.ts
touch src/lib/form-error-messages.ts
touch src/lib/form-validation.ts
touch src/components/landing/FormField.tsx
```

### Step 3: 파일 수정 (30분)
- `src/components/landing/CTASection.tsx` 수정
- `src/app/layout.tsx` 수정

### Step 4: TypeScript 검증 (5분)
```bash
npx tsc --noEmit
# 예상: 0 errors
```

### Step 5: 로컬 테스트 (30분)
```bash
npm run dev
# http://localhost:3000 에서 테스트
```

테스트 시나리오:
1. 필드 비워두고 제출 → Toast + 필드 강조
2. 폰번호 형식 오류 → Toast + phone 필드 에러
3. 에러 수정 후 재시도 → 에러 자동 제거
4. 유효한 데이터 → 성공 메시지
5. 중복 가입 → 409 에러
6. 네트워크 오류 → Toast

### Step 6: git commit + PR (15분)
```bash
git add -A
git commit -m "docs(FE-02): 폼 에러 UI 개선 Phase 1 설계 완료"
git push origin fe-02-form-error
gh pr create --title "FE-02: 폼 에러 UI 개선 (Toast + 필드 강조)"
```

---

## ⚠️ 주의사항

### 1. Sonner Toast 라이브러리
- CDN 아님, npm 설치 필수
- `<Toaster />` 컴포넌트 필수 (layout.tsx)

### 2. TypeScript 엄격 모드
- any 타입 사용 금지
- PropTypes 필수
- 함수 반환 타입 명시

### 3. 상태 관리 분리
```typescript
// ✅ Good: 분리된 상태
const [submitStatus, setSubmitStatus] = useState('idle');
const [fieldErrors, setFieldErrors] = useState({});

// ❌ Bad: 통합 상태 (관리 어려움)
const [state, setState] = useState({ submitStatus, fieldErrors });
```

### 4. useCallback 메모이제이션
```typescript
// ✅ Good: 불필요한 재렌더링 방지
const handleInputChange = useCallback((...) => {...}, [showFieldErrors, fieldErrors]);

// ❌ Bad: 매 렌더링마다 함수 재생성
const handleInputChange = (...) => {...};
```

---

## 📊 완료 기준

### ✅ Phase 2 통과 조건
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] 6가지 테스트 시나리오 모두 통과
- [ ] 모바일 뷰포트 확인 (320px~414px)
- [ ] WCAG 2.1 AA 접근성 통과
- [ ] git commit + PR 생성

### ✅ 배포 전 최종 확인
- [ ] Code Review 승인
- [ ] GitHub Action CI 통과
- [ ] 스테이징 환경 테스트
- [ ] Vercel 배포

---

## 📞 문의 및 이슈

### 자주 있는 질문 (FAQ)

**Q: Toast 위치를 변경하려면?**
```typescript
<Toaster position="bottom-right" />  // 다른 위치 옵션
```

**Q: Toast 지속시간을 변경하려면?**
```typescript
toast.error('메시지', { duration: 5000 }); // 5초
```

**Q: 실시간 필드 검증을 추가하려면?**
→ Phase 3에서 구현 (현재는 submit 시에만)

**Q: 폰번호 자동 포맷팅을 추가하려면?**
→ Phase 3에서 구현 (현재는 수동 입력)

---

## 🎉 다음 마일스톤

### Phase 2 완료 후
- Phase 3: 고급 기능 (실시간 검증, 자동 포맷팅)
- Phase 4: 분석 추적 (Google Analytics)
- Phase 5: A/B 테스트 (메시지 변형)

---

**상태**: Phase 2 구현 준비 완료  
**예상 소요 시간**: 2시간 (3-5분 간격으로 테스트)  
**위험도**: LOW (기존 코드 영향 최소)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
