# 마비즈 CRM 검증 라이브러리 가이드

**마지막 업데이트**: 2026-06-09  
**버전**: 1.0 (Level 2: Zod + React Hook Form)

## 📊 현황 분석

### 설치된 라이브러리
| 라이브러리 | 버전 | 상태 |
|-----------|------|------|
| **zod** | 4.4.3 | ✅ 3개 파일에서 사용 중 |
| **react-hook-form** | 7.76.1 | ✅ 설치됨 (미사용) |
| **@hookform/resolvers** | 5.4.0 | ✅ 설치됨 (선택적) |

---

## 🎯 권장 아키텍처: Level 2

### 3가지 검증 레벨 비교

| 레벨 | 이름 | 사용 시점 | 장점 | 단점 |
|-----|------|---------|------|------|
| **Level 1** | Zod만 사용 | 백엔드 API 검증, 서버액션 | 간단, 추가설치 불필요 | 폼 에러 UI 수동 처리 |
| **Level 2** | Zod + React Hook Form | 중소 폼 (5-15개 입력) | ✅ 권장 | 한글 에러, 타입 안전, 설치된 라이브러리 활용 |
| **Level 3** | Level 2 + @hookform/resolvers | 대형 폼 (15+개 입력) | 보일러플레이트 감소 | 불필요한 오버헤드 |

**현 프로젝트 최적화 레벨**: **Level 2**

---

## 📁 파일 구조

```
src/
├── lib/
│   ├── schemas/
│   │   ├── sms-settings.ts       ✨ 새로 추가
│   │   ├── contact.ts             ✨ 새로 추가
│   │   ├── group-assignment.ts    ✨ 새로 추가
│   │   ├── sms-send.ts            ✨ 새로 추가
│   │   ├── campaign.ts            ✨ 새로 추가
│   │   ├── funnel-sms.ts          (기존)
│   │   ├── pnr.zod.ts            (기존)
│   │   └── partner-api.ts        (기존)
│   ├── validate.ts                ✨ 새로 추가 (헬퍼 함수)
│   └── form-helpers.ts            ✨ 새로 추가 (React Hook Form 통합)
├── components/
│   └── forms/
│       ├── ContactFormExample.tsx          ✨ 새로 추가
│       └── SmsSettingsFormExample.tsx      ✨ 새로 추가
└── ...
```

---

## 🔧 사용 패턴

### 패턴 1: Level 1 (Zod만 - 백엔드)

```typescript
// src/app/api/contacts/route.ts
import { validateFormData } from '@/lib/validate';
import { CreateContactSchema } from '@/lib/schemas/contact';

export async function POST(req: Request) {
  const data = await req.json();
  
  // 서버에서 한 번 더 검증
  const result = validateFormData(CreateContactSchema, data);
  
  if (!result.success) {
    return Response.json({ errors: result.errors }, { status: 400 });
  }
  
  // result.data는 완벽히 검증된 데이터
  const contact = await db.contact.create({ data: result.data });
  return Response.json(contact);
}
```

### 패턴 2: Level 2 (권장 - 클라이언트)

```typescript
// src/components/forms/ContactForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateContactSchema, CreateContactInput } from '@/lib/schemas/contact';
import { getFieldConfig } from '@/lib/form-helpers';

export function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
  } = useForm<CreateContactInput>({
    resolver: zodResolver(CreateContactSchema),
    mode: 'onBlur', // Blur 시점에 검증
  });

  const onSubmit = async (data: CreateContactInput) => {
    // 이미 검증된 데이터
    await fetch('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {(() => {
        const field = getFieldConfig(register, 'name', errors, f => dirtyFields[f]);
        return (
          <>
            <input {...field.register} className={field.className} />
            {field.error && <p className="text-red-500">{field.error}</p>}
          </>
        );
      })()}
      
      <button type="submit">저장</button>
    </form>
  );
}
```

### 패턴 3: 수동 검증 (폼 없이)

```typescript
// 폼을 사용하지 않는 경우
import { validateFormData } from '@/lib/validate';
import { CreateContactSchema } from '@/lib/schemas/contact';

const result = validateFormData(CreateContactSchema, {
  name: '김철수',
  phone: '010-1234-5678',
  contactType: 'CUSTOMER',
});

if (result.success) {
  console.log('검증 성공:', result.data);
} else {
  console.log('검증 실패:', result.errors);
  // { name: "...", phone: "전화번호 형식이 잘못되었습니다." }
}
```

---

## 📋 5개 스키마 정의서

### 1️⃣ SMS 설정 (`sms-settings.ts`)

**용도**: 조직/사용자 수준의 알리고 SMS 설정  
**필드**: 11개 (aligoUserId, senderPhone, aligoKey, reEngageMsg1-2, testPhone)

```typescript
// 타입 정의
type OrgSmsConfig = {
  aligoUserId: string;        // 필수, 이메일 형식
  senderPhone: string;        // 필수, 전화번호
  aligoKey?: string;          // 선택, 32자 이상
};

// 사용 예
const result = validateFormData(OrgSmsConfigSchema, {
  aligoUserId: 'admin@aligo.co.kr',
  senderPhone: '031-1234-5678',
  aligoKey: 'a1b2c3d4e5f6...',
});
```

### 2️⃣ Contact (`contact.ts`)

**용도**: 고객 생성/수정  
**필드**: 8개 (name, phone, email, residentNum, contactType, status, notes, tags)

```typescript
// 타입 정의
type CreateContactInput = {
  name: string;               // 필수, 1-50자
  phone?: string;             // 선택, 전화번호 형식
  email?: string;             // 선택, 이메일 형식
  contactType: 'CUSTOMER' | 'PROSPECT' | 'INQUIRY' | 'PARTNER';
  status?: 'ACTIVE' | 'INACTIVE' | 'LOST';
  tags?: string[];            // 최대 10개
};

// 사용 예
const result = validateFormData(CreateContactSchema, {
  name: '김철수',
  phone: '010-1234-5678',
  email: 'kim@example.com',
  contactType: 'CUSTOMER',
});
```

### 3️⃣ Group Assignment (`group-assignment.ts`)

**용도**: 고객을 그룹에 배정  
**필드**: 10개 (contactIds, groupId, assignmentReason, notes 등)

```typescript
// 타입 정의
type GroupAssignmentInput = {
  contactIds: string[];       // 최소 1명, 최대 1000명
  groupId: string;            // CUID 형식
  assignmentReason?: 'MANUAL' | 'AUTO_MATCHING' | 'IMPORT';
  notes?: string;             // 최대 200자
};

// 일괄 배정
type BulkGroupAssignmentInput = {
  assignments: GroupAssignmentInput[];  // 최대 100개
};
```

### 4️⃣ SMS 발송 (`sms-send.ts`)

**용도**: SMS/LMS 발송 (일반, 퍼널, 그룹 기반)  
**필드**: 10개 (recipients, content, msgType, reserveAt, priority 등)

```typescript
// 타입 정의
type SmsSendInput = {
  recipients: { phone: string; name?: string }[];  // 최대 10,000명
  content: string;            // 필수, 1-100자
  msgType: 'SMS' | 'LMS';    // 기본값: SMS
  reserveAt?: string;         // ISO 8601 datetime
  priority: 'LOW' | 'NORMAL' | 'HIGH';  // 기본값: NORMAL
};

// 퍼널 기반 발송
type SmsFunnelSendInput = Omit<SmsSendInput, 'content' | 'msgType'> & {
  funnelId: string;           // CUID
  startOrder?: number;        // 기본값: 1
};

// 그룹 기반 발송
type SmsGroupSendInput = Omit<SmsSendInput, 'recipients'> & {
  groupId: string;            // CUID
};
```

### 5️⃣ Campaign (`campaign.ts`)

**용도**: 마케팅 캠페인 생성/수정  
**필드**: 11개 (name, description, channel, targetGroupId, startDate, endDate, status, budget 등)

```typescript
// 타입 정의
type CreateCampaignInput = {
  name: string;               // 필수, 1-100자
  description?: string;       // 선택, 최대 500자
  channel: 'SMS' | 'EMAIL' | 'PUSH' | 'KAKAO' | 'PHONE';
  targetGroupId: string;      // CUID
  startDate: string;          // ISO 8601 datetime
  endDate?: string;           // endDate > startDate 필수
  status?: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'PAUSED';
  budget?: number;            // 0~999,999,999
};
```

---

## 🛠️ 헬퍼 함수 레퍼런스

### `src/lib/validate.ts`

```typescript
// 1️⃣ 단일 데이터 검증
validateFormData<T>(schema, data)
// → { success: boolean, data?: T, errors?: Record<string, string> }

// 2️⃣ 배열 데이터 검증
validateFormDataArray<T>(itemSchema, items)
// → { success: boolean, data?: T[], errors?: Record<number, Record<string, string>> }

// 3️⃣ 에러 메시지 포맷팅
formatErrorMessage(errors)
// → "필드1: 에러메시지\n필드2: 에러메시지"

// 4️⃣ 특정 필드 에러 조회
getFieldError(errors, path)
// → "에러메시지" | undefined

// 5️⃣ 필드 에러 확인
hasFieldError(errors, path)
// → boolean

// 6️⃣ 빠른 유효성 검사
quickValidate(schema, data)
// → { isValid: boolean, firstError?: string }
```

### `src/lib/form-helpers.ts`

```typescript
// 1️⃣ Form Config 생성
createFormConfig(schema, options)
// → useForm 설정 객체

// 2️⃣ 필드 클래스 생성
getInputFieldClass(isError, isDirty, baseClass)
// → CSS 클래스 문자열

// 3️⃣ 필드 전체 설정
getFieldConfig(register, fieldName, errors, isDirtyCheck)
// → { register, error, className }

// 4️⃣ 제출 핸들러 생성
createSubmitHandler(onValidSubmit, onError)
// → async (data) => void

// 5️⃣ 에러 확인
hasAnyError(errors, fields)
// → boolean

// 6️⃣ 에러 포맷팅
formatFormErrors(errors)
// → "필드1: 에러메시지\n필드2: 에러메시지"
```

---

## 💻 실제 사용 예제

### 예제 1: 간단한 폼 (3개 필드)

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateContactSchema, CreateContactInput } from '@/lib/schemas/contact';

export function SimpleContactForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateContactInput>({
    resolver: zodResolver(CreateContactSchema),
  });

  return (
    <form onSubmit={handleSubmit(async data => {
      await fetch('/api/contacts', { method: 'POST', body: JSON.stringify(data) });
    })}>
      <div>
        <input {...register('name')} placeholder="이름" />
        {errors.name && <p>{errors.name.message}</p>}
      </div>
      
      <div>
        <input {...register('phone')} placeholder="전화번호" />
        {errors.phone && <p>{errors.phone.message}</p>}
      </div>
      
      <button type="submit">저장</button>
    </form>
  );
}
```

### 예제 2: SMS 설정 폼 (선택 필드 포함)

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSmsConfigSchema, UserSmsConfigInput } from '@/lib/schemas/sms-settings';

export function UserSmsSettingsForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<UserSmsConfigInput>({
    resolver: zodResolver(UserSmsConfigSchema),
    mode: 'onBlur',
  });

  return (
    <form onSubmit={handleSubmit(async data => {
      await fetch('/api/settings/sms/user', { method: 'POST', body: JSON.stringify(data) });
    })}>
      <input {...register('aligoUserId')} placeholder="aligo@example.com" />
      {errors.aligoUserId && <p>{errors.aligoUserId.message}</p>}
      
      <input {...register('senderPhone')} placeholder="010-1234-5678" />
      {errors.senderPhone && <p>{errors.senderPhone.message}</p>}
      
      <input {...register('aligoKey')} type="password" placeholder="API KEY" />
      {errors.aligoKey && <p>{errors.aligoKey.message}</p>}
      
      <button type="submit">저장</button>
    </form>
  );
}
```

### 예제 3: 배열 데이터 검증

```typescript
import { validateFormDataArray } from '@/lib/validate';
import { SmsRecipientSchema } from '@/lib/schemas/sms-send';

const recipients = [
  { phone: '010-1234-5678', name: '김철수' },
  { phone: '010-9999-9999', name: '이영희' },
];

const result = validateFormDataArray(SmsRecipientSchema, recipients);

if (result.success) {
  // 모든 수신자 유효
  await sendSms(result.data);
} else {
  // result.errors[0] = { phone: "...", name: "..." }
  result.errors[0] && console.log('수신자 0 에러:', result.errors[0]);
}
```

### 예제 4: 수동 검증 + 폼 상태 업데이트

```typescript
'use client';

import { useState } from 'react';
import { validateFormData } from '@/lib/validate';
import { CreateCampaignSchema } from '@/lib/schemas/campaign';

export function CampaignForm() {
  const [formData, setFormData] = useState({ name: '', channel: 'SMS' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = validateFormData(CreateCampaignSchema, formData);
    
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    
    // 검증 성공
    await fetch('/api/campaigns', { method: 'POST', body: JSON.stringify(result.data) });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.name}
        onChange={e => setFormData({ ...formData, name: e.target.value })}
        placeholder="캠페인명"
      />
      {errors.name && <p className="text-red-500">{errors.name}</p>}
      
      <button type="submit">생성</button>
    </form>
  );
}
```

---

## ✅ 마이그레이션 로드맵

### Phase 1: 신규 폼부터 적용 (이번)
- ✅ 5개 스키마 정의 (`sms-settings.ts`, `contact.ts`, `group-assignment.ts`, `sms-send.ts`, `campaign.ts`)
- ✅ 헬퍼 함수 작성 (`validate.ts`, `form-helpers.ts`)
- ✅ 예제 컴포넌트 작성 (`ContactFormExample.tsx`, `SmsSettingsFormExample.tsx`)

### Phase 2: 기존 폼 점진적 마이그레이션
- [ ] `settings/sms/page.tsx` → React Hook Form 전환
- [ ] `contacts/*` → Level 2로 통일
- [ ] `campaigns/*` → Level 2로 통일

### Phase 3: Level 3 고려 (필요시)
- [ ] 폼 크기 15+ 필드
- [ ] `@hookform/resolvers` 도입

---

## 🔐 한글 에러 메시지 자동 생성

모든 스키마는 **한글 에러 메시지**를 자동으로 생성합니다.

```typescript
const result = validateFormData(CreateContactSchema, {
  name: '', // 비어있음
  phone: '12345', // 형식 오류
  contactType: 'INVALID', // 잘못된 enum
});

// result.errors = {
//   name: "이름은 필수입니다.",
//   phone: "올바른 전화번호 형식입니다 (예: 010-1234-5678)",
//   contactType: "유효한 고객 유형을 선택하세요."
// }
```

---

## 📚 참고 문서

- [Zod 공식 문서](https://zod.dev)
- [React Hook Form 공식 문서](https://react-hook-form.com)
- [@hookform/resolvers](https://github.com/react-hook-form/resolvers)

---

## ❓ FAQ

**Q: Level 1, 2, 3의 차이가 뭔가요?**
- Level 1: Zod만 (백엔드 검증용)
- Level 2: Zod + useForm (폼 자동 검증, 권장)
- Level 3: Level 2 + @hookform/resolvers (보일러플레이트 감소)

**Q: 설치 필요한 패키지가 있나요?**
- 아니오. 이미 모두 설치되어 있습니다.
- Zod, react-hook-form, @hookform/resolvers 모두 package.json에 있습니다.

**Q: 백엔드에서도 검증해야 하나요?**
- 네. 클라이언트 검증은 UX용이고, 백엔드 검증은 보안용입니다.
- 항상 **이중 검증**을 하세요.

**Q: 기존 폼을 마이그레이션하려면?**
- 1. 스키마 정의 (`CreateContactSchema` 사용)
- 2. `useForm` + `zodResolver` 추가
- 3. `getFieldConfig` 헬퍼로 에러 표시
- 4. 완료!

**Q: 커스텀 검증 규칙을 추가할 수 있나요?**
- 네. Zod의 `.refine()` 또는 `.superRefine()` 메서드를 사용하세요.
```typescript
const CustomSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
}).refine(
  data => new Date(data.endDate) > new Date(data.startDate),
  { message: '종료 날짜는 시작 날짜 이후여야 합니다.', path: ['endDate'] }
);
```

---

## 📞 지원

질문이나 버그 리포트는 이 문서의 상단 버전을 확인한 후 업데이트하세요.
