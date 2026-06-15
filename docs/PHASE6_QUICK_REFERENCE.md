# Phase 6: 입력필드 지원 - 빠른 참고서

## 핵심 3단계

### 1️⃣ 템플릿 정의 (서버)

```typescript
// ContractInputField 배열 생성
const inputFields: ContractInputField[] = [
  {
    id: "customerName",
    type: "text",
    label: "승객명",
    required: true,
    contactFieldName: "name",      // ← Contact 자동 매핑
    order: 1,
  },
  {
    id: "birthDate",
    type: "date",
    label: "생년월일",
    required: true,
    contactFieldName: "birthDate",  // ← Contact 날짜 자동 변환
    order: 2,
  },
];

// 템플릿 저장
POST /api/contract-templates
{
  name: "계약서",
  category: "CRUISE",
  htmlContent: "...",
  inputFields: inputFields,  // ✨ inputFields 추가
}
```

### 2️⃣ 계약서 발급 (서버)

```typescript
import {
  extractAllContactFieldValues,
  bindFieldValuesToHtml,
} from "@/lib/utils/contract-field-mapper";

// Contact 데이터에서 자동 추출
const contact = await getContact(contactId);
const autoValues = extractAllContactFieldValues(inputFields, contact);

// HTML 바인딩
const html = bindFieldValuesToHtml(template.htmlContent, autoValues);

// 계약서 인스턴스 생성
const instance = await createContractInstance({
  templateId,
  contactId,
  inputValues: autoValues,  // ✨ Contact 자동값 저장
});
```

### 3️⃣ 서명 페이지 (클라이언트)

```tsx
import { ContractSignForm } from "@/components/contract/ContractSignForm";
import { validateAllFieldValues } from "@/lib/utils/contract-field-mapper";

function SigningPage({ contractId }: { contractId: string }) {
  // 1. 계약서 로드
  const data = await fetch(
    `/api/public/contract-instances/${contractId}`
  ).then((r) => r.json());

  // 2. 입력필드 + 자동값으로 폼 렌더링
  return (
    <ContractSignForm
      inputFields={data.inputFields}        // ✨ 필드 정의
      initialValues={data.inputValues}      // ✨ Contact 자동값
      onSubmit={async (values) => {
        // 3. 서명 제출
        await fetch(`/api/contracts/instances/${contractId}/sign`, {
          method: "POST",
          body: JSON.stringify({
            signature: signatureImage,
            inputValues: values,  // ✨ 사용자 입력값
          }),
        });
      }}
    />
  );
}
```

---

## 20개 Contact 자동 매핑 필드

### 기본 정보
| contactFieldName | Contact 필드 | 타입 | 설명 |
|---|---|---|---|
| name | name | text | 연락처 이름 |
| email | email | text | 이메일 |
| phone | phone | text | 전화번호 |

### 개인정보
| contactFieldName | Contact 필드 | 타입 | 설명 |
|---|---|---|---|
| birthDate | birthDate | date | 생년월일 (YYYY-MM-DD 변환) |
| age | ageInYears | text | 나이 |
| gender | gender | dropdown | 성별 |
| maritalStatus | maritalStatus | dropdown | 혼인상태 |
| childrenCount | childrenCount | text | 자녀수 |

### 여행 정보
| contactFieldName | Contact 필드 | 타입 | 설명 |
|---|---|---|---|
| passportNumber | passportNumber | text | 여권번호 |
| passportDaysLeft | passportDaysLeft | text | 여권 유효기간(일) |
| cruiseInterest | cruiseInterest | dropdown | 크루즈 관심도 |
| cruiseCount | cruiseCount | text | 탑승 횟수 |
| lastCruiseDate | lastCruiseDate | date | 마지막 탑승일 |
| departureDate | departureDate | date | 출발일 |

### 예약 정보
| contactFieldName | Contact 필드 | 타입 | 설명 |
|---|---|---|---|
| bookingRef | bookingRef | text | 예약 참조번호 |
| productName | productName | text | 상품명 |
| budgetRange | budgetRange | dropdown | 예산 범위 |

---

## 필드 타입별 속성

### text
```typescript
{
  type: "text",
  minLength?: number,
  maxLength?: number,
  pattern?: string,            // 정규식
  patternError?: string,       // 패턴 실패 메시지
  placeholder?: string,
}
```

**예시: 이메일**
```typescript
{
  type: "text",
  pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
  patternError: "유효한 이메일이 아닙니다",
}
```

### date
```typescript
{
  type: "date",
  // HTML <input type="date"> 형식: YYYY-MM-DD
}
```

### dropdown
```typescript
{
  type: "dropdown",
  options: [
    { value: "standard", label: "스탠다드" },
    { value: "deluxe", label: "디럭스" },
  ],
}
```

### checkbox
```typescript
{
  type: "checkbox",
  // boolean 값 (true/false)
}
```

---

## 조건부 표시

특정 필드값에 따라 다른 필드 표시/숨김:

```typescript
const fields: ContractInputField[] = [
  {
    id: "hasVisa",
    type: "checkbox",
    label: "비자 필요함",
    order: 1,
  },
  {
    id: "visaCountry",
    type: "text",
    label: "비자 국가",
    order: 2,
    visibilityCondition: {
      fieldId: "hasVisa",
      value: true,  // hasVisa가 true일 때만 표시
    },
  },
];
```

---

## 필드 검증

### 자동 검증 규칙
- **required=true**: 필수 입력
- **minLength/maxLength**: 길이 범위 (text)
- **pattern**: 정규식 매칭 (text)
- **date**: YYYY-MM-DD 형식 + 유효한 날짜
- **dropdown**: options에 포함된 값만 허용

### 수동 검증
```typescript
import { validateAllFieldValues } from "@/lib/utils/contract-field-mapper";

const result = validateAllFieldValues(inputFields, userValues);

if (!result.valid) {
  console.log(result.errors);  // { fieldId: "에러메시지", ... }
}
```

---

## API 응답 예시

### GET /api/public/contract-instances/[id]
```json
{
  "ok": true,
  "status": "DRAFT",
  "renderedHtml": "<h1>계약서</h1>...",
  "inputFields": [
    {
      "id": "customerName",
      "type": "text",
      "label": "승객명",
      "required": true,
      "contactFieldName": "name",
      "order": 1
    },
    // ... 더 많은 필드
  ],
  "inputValues": {
    "customerName": "김철수",
    "birthDate": "1990-05-15"
  },
  "expiresAt": "2026-06-16T12:00:00Z",
  "alreadySigned": false
}
```

---

## 파일 위치

| 파일 | 설명 |
|---|---|
| `src/lib/types/contract-templates.ts` | ContractInputField 타입 정의 + CONTACT_INPUT_FIELD_MAPPINGS |
| `src/lib/utils/contract-field-mapper.ts` | 10개 유틸리티 함수 |
| `src/lib/validations/contract-templates.ts` | Zod 검증 스키마 (inputFields, inputValues) |
| `prisma/schema.prisma` | ContractTemplate.inputFields, ContractInstance.inputFields |
| `src/components/contract/ContractInputField.tsx` | 입력필드 UI 컴포넌트 (4가지 타입) |
| `src/app/api/public/contract-instances/[id]/route.ts` | API 라우트 (inputFields 포함) |
| `docs/PHASE6_INPUT_FIELDS.md` | 상세 구현 가이드 |

---

## 트러블슈팅

### Contact 필드가 매핑되지 않음
```typescript
// ❌ 잘못된 필드명
contactFieldName: "firstName"  // Contact 모델에 없음

// ✅ 올바른 필드명
contactFieldName: "name"  // CONTACT_INPUT_FIELD_MAPPINGS에 정의됨
```

### 날짜가 HTML에 잘못 표시됨
```typescript
// ✅ Contact 필드는 transformer로 자동 변환
const dateField = CONTACT_INPUT_FIELD_MAPPINGS["birthDate"];
// transformer(contact.birthDate) → "1990-05-15"
```

### {{fieldId}} 플레이스홀더가 치환되지 않음
```typescript
// ❌ 필드명 불일치
HTML: "{{customer_name}}"
Field: { id: "customerName" }  // 불일치

// ✅ 정확한 일치
HTML: "{{customerName}}"
Field: { id: "customerName" }
```

---

## 다음 단계 (Phase 6.5+)

1. **필드 빌더 UI** - 관리자가 inputFields 드래그앤드롭으로 생성
2. **필드 그룹화** - 섹션별로 입력필드 구분
3. **자동 계산** - 한 필드값으로 다른 필드 자동 계산
4. **Contact 엔리치먼트** - 입력값 → Contact 필드 자동 업데이트

---

**Last Updated**: 2026-06-15 | **Tested**: ✅ TSC 0 errors
