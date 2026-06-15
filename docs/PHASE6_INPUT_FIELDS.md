# Phase 6: 계약서 입력필드 지원 구현 가이드 (2026-06-15)

## 개요

Phase 6는 계약서 템플릿에서 **4가지 입력필드 타입** (text/checkbox/date/dropdown)을 지원하고, Contact 필드와 자동 매핑하는 기능을 구현합니다.

### 핵심 기능
- ✅ **4가지 입력필드 타입**: text, checkbox, date, dropdown
- ✅ **Contact 자동 매핑**: 20개 필드 (이름, 이메일, 전화, 생일, 여권, 예약정보 등)
- ✅ **조건부 표시**: 특정 필드값에 따라 입력필드 표시/숨김
- ✅ **필드 검증**: 최소/최대 길이, 정규식 패턴, 필수 여부
- ✅ **HTML 바인딩**: {{fieldId}} 플레이스홀더로 자동 치환

---

## 타입 정의 (src/lib/types/contract-templates.ts)

### 1. ContractInputField 인터페이스

```typescript
interface ContractInputField {
  id: string;                              // 고유 필드 ID (HTML {{fieldId}})
  type: ContractInputFieldType;            // "text" | "checkbox" | "date" | "dropdown"
  label: string;                           // UI 라벨 (필수)
  required: boolean;                       // 입력 필수 여부
  placeholder?: string;                    // 입력 필드 내 힌트 텍스트
  options?: Array<{value: string; label: string}>; // dropdown 옵션
  contactFieldName?: string | null;        // Contact 필드명 (null = 수동 입력)
  maxLength?: number;                      // 최대 길이 (text/date)
  minLength?: number;                      // 최소 길이 (text)
  pattern?: string;                        // 정규식 패턴 (text)
  patternError?: string;                   // 패턴 실패 에러 메시지
  order: number;                           // 렌더링 순서
  helpText?: string;                       // 도움말 텍스트
  visibilityCondition?: {                  // 조건부 표시
    fieldId: string;
    value: string | boolean;
  };
}
```

### 2. Contact-to-Input 필드 매핑

**CONTACT_INPUT_FIELD_MAPPINGS** 객체에 20개 필드 자동 매핑 정의:

```typescript
// 기본 정보
"name" → Contact.name (text)
"email" → Contact.email (text)
"phone" → Contact.phone (text)

// 개인정보
"birthDate" → Contact.birthDate (date, ISO 변환)
"age" → Contact.ageInYears (text)
"gender" → Contact.gender (dropdown)
"maritalStatus" → Contact.maritalStatus (dropdown)
"childrenCount" → Contact.childrenCount (text)

// 여행 관련
"passportNumber" → Contact.passportNumber (text)
"passportDaysLeft" → Contact.passportDaysLeft (text)
"cruiseInterest" → Contact.cruiseInterest (dropdown)
"cruiseCount" → Contact.cruiseCount (text)
"lastCruiseDate" → Contact.lastCruiseDate (date)
"departureDate" → Contact.departureDate (date)

// 예약 정보
"bookingRef" → Contact.bookingRef (text)
"productName" → Contact.productName (text)
"budgetRange" → Contact.budgetRange (dropdown)
```

### 3. ContractTemplateInput (Phase 6 추가)

```typescript
interface ContractTemplateInput {
  name: string;
  description?: string;
  category: CategoryType;
  htmlContent: string;
  fieldMapping: Record<string, string>;        // 레거시 (단순값 매핑)
  inputFields?: ContractInputField[];          // ✨ NEW: 입력필드 정의
  psychologyLenses: string[];
  // ... SMS, visibility, status
}
```

### 4. ContractInstanceInput (Phase 6 추가)

```typescript
interface ContractInstanceInput {
  templateId: string;
  contactId?: string;
  boundData: Record<string, string>;           // 레거시
  inputValues?: Record<string, any>;           // ✨ NEW: 서명 시 입력값
  autoSendSms?: boolean;
}
```

---

## 데이터베이스 스키마 (prisma/schema.prisma)

### ContractTemplate 모델
```prisma
model ContractTemplate {
  // ... 기존 필드
  
  // Phase 6: 입력필드 정의 (JSON 배열)
  inputFields Json @default("[]")  // Array<ContractInputField>
}
```

### ContractInstance 모델
```prisma
model ContractInstance {
  // ... 기존 필드
  
  // Phase 6: 입력값 수집 (서명 시)
  inputFields Json @default("[]")  // Array<{key, value}> or Record<fieldId, value>
}
```

---

## 유틸리티 함수 (src/lib/utils/contract-field-mapper.ts)

### 1. Contact 필드 추출

```typescript
// Contact로부터 단일 필드값 추출
extractContactFieldValue(field: ContractInputField, contact: Record<string, any>): any

// Contact로부터 모든 필드값 추출
extractAllContactFieldValues(
  inputFields: ContractInputField[],
  contact: Record<string, any>
): Record<string, any>
```

**예시**:
```typescript
const fields: ContractInputField[] = [
  { id: "customerName", type: "text", label: "이름", contactFieldName: "name", order: 1 },
  { id: "email", type: "text", label: "이메일", contactFieldName: "email", order: 2 },
];

const contact = { name: "김철수", email: "kim@example.com", phone: "010-1234-5678" };

const values = extractAllContactFieldValues(fields, contact);
// Result: { customerName: "김철수", email: "kim@example.com" }
```

### 2. HTML 바인딩

```typescript
// {{fieldId}} 플레이스홀더를 실제값으로 치환
bindFieldValuesToHtml(
  htmlContent: string,
  fieldValues: Record<string, any>
): string
```

**예시**:
```typescript
const html = "<p>고객명: {{customerName}}</p><p>이메일: {{email}}</p>";
const values = { customerName: "김철수", email: "kim@example.com" };

const result = bindFieldValuesToHtml(html, values);
// Result: "<p>고객명: 김철수</p><p>이메일: kim@example.com</p>"
```

### 3. 필드 검증

```typescript
// 단일 필드 검증
validateFieldValue(
  field: ContractInputField,
  value: any
): { valid: boolean; error?: string }

// 모든 필드 검증
validateAllFieldValues(
  inputFields: ContractInputField[],
  fieldValues: Record<string, any>
): { valid: boolean; errors: Record<string, string> }
```

**검증 규칙**:
- **text**: minLength, maxLength, pattern (정규식)
- **date**: YYYY-MM-DD 형식, 유효한 날짜 확인
- **dropdown**: options 배열에 포함된 값만 허용
- **checkbox**: boolean 타입 확인
- **required**: 모든 타입에서 필수 여부 체크

**예시**:
```typescript
const field: ContractInputField = {
  id: "email",
  type: "text",
  label: "이메일",
  required: true,
  pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
  patternError: "유효한 이메일 형식이 아닙니다",
  order: 1,
};

const result = validateFieldValue(field, "invalid-email");
// Result: { valid: false, error: "유효한 이메일 형식이 아닙니다" }
```

### 4. 조건부 표시

```typescript
// 특정 필드 표시 여부 판단
shouldShowField(
  field: ContractInputField,
  fieldValues: Record<string, any>
): boolean

// 표시할 필드만 필터링
filterVisibleFields(
  inputFields: ContractInputField[],
  fieldValues: Record<string, any>
): ContractInputField[]
```

**예시**:
```typescript
const fields: ContractInputField[] = [
  { id: "memberType", type: "dropdown", label: "회원유형", options: [...], order: 1 },
  {
    id: "familySize",
    type: "text",
    label: "가족원수",
    order: 2,
    visibilityCondition: { fieldId: "memberType", value: "FAMILY" },
  },
];

const values = { memberType: "SINGLE" };
const visible = filterVisibleFields(fields, values);
// Result: [{ id: "memberType", ... }] (familySize 제외)
```

### 5. 필드 정렬 및 조회

```typescript
// order 순서대로 정렬
sortFieldsByOrder(inputFields: ContractInputField[]): ContractInputField[]

// 사용 가능한 Contact 필드 목록
getAvailableContactFields(): Array<{fieldName, label, type}>

// Contact 필드 매핑 가능 여부
isContactFieldMappable(contactFieldName: string | null | undefined): boolean
```

---

## API 통합 예시

### 1. 계약서 템플릿 생성 (inputFields 포함)

```typescript
// POST /api/contract-templates
const payload = {
  name: "크루즈 여행 계약서",
  category: "CRUISE",
  htmlContent: "<h1>{{cruiseName}}</h1><p>고객: {{customerName}}</p>...",
  inputFields: [
    {
      id: "cruiseName",
      type: "text",
      label: "크루즈명",
      required: true,
      contactFieldName: "productName",  // Contact.productName 자동 매핑
      order: 1,
    },
    {
      id: "customerName",
      type: "text",
      label: "승객명",
      required: true,
      contactFieldName: "name",
      minLength: 2,
      maxLength: 50,
      order: 2,
    },
    {
      id: "birthDate",
      type: "date",
      label: "생년월일",
      required: true,
      contactFieldName: "birthDate",
      order: 3,
    },
    {
      id: "cabin",
      type: "dropdown",
      label: "객실등급",
      required: false,
      options: [
        { value: "standard", label: "스탠다드" },
        { value: "deluxe", label: "디럭스" },
        { value: "suite", label: "스위트" },
      ],
      order: 4,
    },
    {
      id: "hasVisa",
      type: "checkbox",
      label: "비자 필요함",
      order: 5,
    },
    {
      id: "numberOfFamily",
      type: "text",
      label: "동반 가족원수",
      order: 6,
      visibilityCondition: { fieldId: "hasVisa", value: true },
    },
  ],
  psychologyLenses: ["L6_TIMING_LOSS_AVERSION"],
};
```

### 2. 계약서 인스턴스 생성 (Contact 자동 매핑)

```typescript
// POST /api/contracts/instances
// Step 1: Contact 데이터 자동 추출
const contact = await prisma.contact.findUnique({ where: { id: contactId } });
const template = await prisma.contractTemplate.findUnique({ where: { id: templateId } });

const inputFields = JSON.parse(template.inputFields || '[]');
const autoFilledValues = extractAllContactFieldValues(inputFields, contact);

// Step 2: 계약서 인스턴스 생성
const payload = {
  templateId,
  contactId,
  inputValues: autoFilledValues, // Contact 자동 매핑값
};

const instance = await prisma.contractInstance.create({
  data: {
    organizationId,
    templateId,
    contactId,
    inputFields: JSON.stringify(autoFilledValues), // DB 저장
    boundData: {},
    status: "DRAFT",
  },
});

// Step 3: 자동 매핑값 + HTML 바인딩
const html = bindFieldValuesToHtml(template.htmlContent, autoFilledValues);
```

### 3. 서명 페이지 (입력값 수집)

```typescript
// 1. 계약서 로드 및 입력필드 표시
GET /api/public/contract-instances/[id]

// Response
{
  ok: true,
  status: "DRAFT",
  renderedHtml: "<h1>크루즈 여행 계약서</h1>...",
  inputFields: [
    { id: "customerName", type: "text", label: "승객명", ... },
    { id: "birthDate", type: "date", label: "생년월일", ... },
    // ...
  ],
  inputValues: { customerName: "김철수", birthDate: "1990-05-15" }, // 자동 채워진 값
}

// 2. 사용자 입력 수집
const userInputs = {
  customerName: "김철수",
  birthDate: "1990-05-15",
  cabin: "deluxe",
  hasVisa: true,
  numberOfFamily: "2",
};

// 3. 검증
const validation = validateAllFieldValues(inputFields, userInputs);
if (!validation.valid) {
  // 에러 표시
  errors: {
    cabin: "객실등급을 선택해주세요",
    numberOfFamily: "동반 가족원수를 입력해주세요",
  }
}

// 4. 서명 제출
POST /api/contracts/instances/[id]/sign
{
  signature: "data:image/png;base64,...",
  inputValues: userInputs,
}
```

---

## 프론트엔드 구현 (React 컴포넌트)

### 계약서 입력필드 렌더링

```tsx
import { ContractInputField } from '@/lib/types/contract-templates';
import { ContractInputField as InputFieldComponent } from '@/components/contract/ContractInputField';
import {
  validateFieldValue,
  filterVisibleFields,
  sortFieldsByOrder,
} from '@/lib/utils/contract-field-mapper';

export function ContractSignForm({
  inputFields,
  initialValues,
  onSubmit,
}: {
  inputFields: ContractInputField[];
  initialValues: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 조건부 표시 적용
  const visibleFields = filterVisibleFields(inputFields, values);
  const sortedFields = sortFieldsByOrder(visibleFields);

  const handleFieldChange = (fieldId: string, value: any) => {
    const newValues = { ...values, [fieldId]: value };
    setValues(newValues);

    // 실시간 검증
    const field = inputFields.find((f) => f.id === fieldId);
    if (field) {
      const validation = validateFieldValue(field, value);
      if (validation.valid) {
        setErrors((prev) => {
          const updated = { ...prev };
          delete updated[fieldId];
          return updated;
        });
      } else {
        setErrors((prev) => ({
          ...prev,
          [fieldId]: validation.error,
        }));
      }
    }
  };

  const handleSubmit = () => {
    // 모든 필드 최종 검증
    const newErrors: Record<string, string> = {};
    for (const field of inputFields) {
      const validation = validateFieldValue(field, values[field.id]);
      if (!validation.valid) {
        newErrors[field.id] = validation.error || "검증 실패";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(values);
  };

  return (
    <div className="space-y-6">
      {sortedFields.map((field) => (
        <InputFieldComponent
          key={field.id}
          field={{
            key: field.id,
            type: field.type as any,
            label: field.label,
            required: field.required,
            placeholder: field.placeholder,
            pattern: field.pattern,
            options: field.options?.map((o) => ({
              value: o.value,
              label: o.label,
            })),
            defaultValue: String(values[field.id] ?? ""),
            helpText: field.helpText,
          }}
          value={values[field.id] ?? ""}
          onChange={handleFieldChange}
          error={errors[field.id]}
        />
      ))}

      <button
        onClick={handleSubmit}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        계약서 서명
      </button>
    </div>
  );
}
```

---

## Phase 6 체크리스트

### 타입 정의
- [x] ContractInputField 인터페이스 정의
- [x] ContactFieldMapping 매핑 규칙 정의
- [x] CONTACT_INPUT_FIELD_MAPPINGS 객체 (20개 필드)
- [x] ContractInputFieldType 타입 정의
- [x] ContractTemplateInput.inputFields 추가
- [x] ContractInstanceInput.inputValues 추가

### 데이터베이스
- [x] ContractTemplate.inputFields Json 필드
- [x] ContractInstance.inputFields Json 필드 (주: 이름을 inputValues로 변경 권장)

### 유틸리티
- [x] extractContactFieldValue() 함수
- [x] extractAllContactFieldValues() 함수
- [x] bindFieldValuesToHtml() 함수
- [x] validateFieldValue() 함수
- [x] validateAllFieldValues() 함수
- [x] shouldShowField() 함수
- [x] filterVisibleFields() 함수
- [x] sortFieldsByOrder() 함수
- [x] isContactFieldMappable() 함수
- [x] getAvailableContactFields() 함수

### 검증
- [x] TypeScript 컴파일 에러 0개
- [x] Zod 스키마 추가 (inputFields, inputValues)
- [x] API 라우트 수정 (inputFields 포함)

### 문서
- [x] Phase 6 구현 가이드 작성 (이 문서)

---

## 추가 개선 사항 (Phase 7+)

### Phase 6.5: UI 컴포넌트
- [ ] ContractInputFieldForm 컴포넌트
- [ ] 필드 빌더 UI (드래그 앤 드롭 필드 추가/정렬)
- [ ] 미리보기 UI (입력값 실시간 HTML 바인딩)

### Phase 7: 고급 기능
- [ ] 조건부 숨김 (visibilityCondition 확장)
- [ ] 필드 그룹화 (섹션별 정렬)
- [ ] 커스텀 검증 함수
- [ ] 필드 의존성 (한 필드값이 다른 필드 검증 영향)
- [ ] 필드 자동 계산 (예: 예약금 = 전체금액 × 20%)

### Phase 8: Contact 엔리치먼트
- [ ] 입력값 → Contact 필드 자동 업데이트
- [ ] 서명 시 Contact 태그 자동 생성
- [ ] 서명 데이터 → CRM 이력 저장

---

## 참고 자료

- **타입 정의**: `src/lib/types/contract-templates.ts`
- **유틸리티**: `src/lib/utils/contract-field-mapper.ts`
- **검증 스키마**: `src/lib/validations/contract-templates.ts`
- **DB 스키마**: `prisma/schema.prisma` (5968-6081 라인)
- **API 라우트**: `src/app/api/public/contract-instances/[id]/route.ts`
- **컴포넌트**: `src/components/contract/ContractInputField.tsx`

---

**Last Updated**: 2026-06-15 | **Version**: 1.0 (Phase 6 Initial Implementation)
