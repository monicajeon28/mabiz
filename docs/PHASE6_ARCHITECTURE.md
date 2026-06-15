# Phase 6: 입력필드 아키텍처 다이어그램

## 시스템 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                    마비즈 CRM 계약서 시스템                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Phase 1: 템플릿 정의 (관리자)                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  관리자 → POST /api/contract-templates                           │
│              ↓                                                    │
│         inputFields: ContractInputField[]                        │
│         ├─ id: "customerName"                                   │
│         ├─ type: "text"                                         │
│         ├─ label: "승객명"                                      │
│         ├─ required: true                                       │
│         ├─ contactFieldName: "name"  ← Contact 자동 매핑        │
│         └─ order: 1                                             │
│              ↓                                                    │
│         ContractTemplate 저장                                    │
│         ├─ htmlContent: "{{customerName}}"                      │
│         ├─ inputFields: [...] (JSON)                            │
│         └─ fieldMapping: {...} (레거시)                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Phase 2: 계약서 발급 (CRM)                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CRM 담당자 선택 → POST /api/contracts/instances                │
│                     contactId: "...",                            │
│                     templateId: "..."                            │
│                          ↓                                        │
│         1️⃣ Contact 데이터 로드                                   │
│            contact = {                                           │
│              name: "김철수",                                    │
│              email: "kim@example.com",                          │
│              birthDate: "1990-05-15",                           │
│              ...                                                 │
│            }                                                      │
│                          ↓                                        │
│         2️⃣ 자동 필드 추출                                        │
│            extractAllContactFieldValues(inputFields, contact)   │
│            ↓                                                     │
│            autoValues = {                                        │
│              customerName: "김철수",                            │
│              birthDate: "1990-05-15",                           │
│              ...                                                 │
│            }                                                      │
│                          ↓                                        │
│         3️⃣ HTML 바인딩                                           │
│            bindFieldValuesToHtml(htmlContent, autoValues)       │
│            "{{customerName}}" → "김철수"                       │
│                          ↓                                        │
│         ContractInstance 생성                                    │
│         ├─ boundData: {...} (레거시)                            │
│         ├─ inputValues: {...} (자동값)  ← ✨ NEW                │
│         ├─ status: "DRAFT"                                      │
│         └─ renderedHtml: "..." (바인딩된)                       │
│                                                                  │
│  응답: {                                                         │
│    ok: true,                                                    │
│    contractId: "...",                                           │
│    email: "kim@example.com"                                     │
│  }                                                               │
│                                                                  │
│  SMS 발송 (Day 0)                                                │
│  "계약서 서명 대기: https://link.mabiz.com/sign/..."            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Phase 3: 서명 페이지 (고객)                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  고객 → 링크 클릭                                               │
│          ↓                                                        │
│         GET /api/public/contract-instances/[id]                 │
│          ↓                                                        │
│         응답:                                                    │
│         {                                                        │
│           inputFields: [                    ← 필드 정의          │
│             {                                                    │
│               id: "customerName",                               │
│               type: "text",                                     │
│               label: "승객명",                                 │
│               required: true,                                   │
│               ...                                               │
│             }                                                    │
│           ],                                                     │
│           inputValues: {                    ← 자동값             │
│             customerName: "김철수",                            │
│             birthDate: "1990-05-15"                            │
│           },                                                     │
│           renderedHtml: "...",               ← 바인딩된         │
│         }                                                        │
│          ↓                                                        │
│         ContractSignForm 렌더링                                  │
│         ├─ inputFields 표시                                     │
│         │  └─ customerName (읽기전용, Contact 값)              │
│         │  └─ cabin (드롭다운)                                  │
│         │  └─ hasVisa (체크박스)                                │
│         │  └─ visaCountry (숨김, hasVisa=true일 때만 표시)      │
│         │                                                        │
│         ├─ 실시간 검증                                          │
│         │  └─ validateFieldValue(field, value)                 │
│         │                                                        │
│         └─ "계약서 서명" 버튼                                   │
│          ↓                                                        │
│         고객 입력                                                │
│         inputValues = {                                         │
│           customerName: "김철수",                              │
│           birthDate: "1990-05-15",                             │
│           cabin: "deluxe",                                      │
│           hasVisa: true,                                        │
│           visaCountry: "USA"                                    │
│         }                                                        │
│          ↓                                                        │
│         서명 그리기                                              │
│         signature = "data:image/png;base64,..."                │
│          ↓                                                        │
│         POST /api/contracts/instances/[id]/sign                 │
│         {                                                        │
│           signature: "...",                                     │
│           inputValues: {...}  ← ✨ 사용자 입력값               │
│         }                                                        │
│          ↓                                                        │
│         ContractInstance 업데이트                                │
│         ├─ status: "SIGNED"                                     │
│         ├─ signedAt: Date.now()                                 │
│         ├─ signatureImage: "..."                                │
│         ├─ inputValues: {...}  ← 저장됨                        │
│         └─ inputFields: [...] (서명 시점 필드 정의)             │
│          ↓                                                        │
│         SMS 발송 (Day 1)                                         │
│         "계약서가 서명되었습니다."                              │
│                                                                  │
│         Event 발송                                               │
│         → contract.signed 이벤트                                 │
│         → Contact CRM 데이터 업데이트                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 데이터 구조 (TypeScript)

### 계약서 템플릿 데이터베이스 저장 구조

```
ContractTemplate {
  id: "tpl_12345",
  name: "크루즈 여행 계약서",
  category: "CRUISE",
  htmlContent: `
    <h1>{{productName}} 예약 약관</h1>
    <p>고객명: {{customerName}}</p>
    <p>생년월일: {{birthDate}}</p>
    <p>객실등급: {{cabin}}</p>
  `,
  inputFields: [  // ✨ Phase 6: JSON 배열
    {
      id: "productName",
      type: "text",
      label: "상품명",
      required: true,
      contactFieldName: "productName",
      order: 1
    },
    {
      id: "customerName",
      type: "text",
      label: "고객명",
      required: true,
      contactFieldName: "name",
      minLength: 2,
      maxLength: 50,
      order: 2
    },
    {
      id: "birthDate",
      type: "date",
      label: "생년월일",
      required: true,
      contactFieldName: "birthDate",
      order: 3
    },
    {
      id: "cabin",
      type: "dropdown",
      label: "객실등급",
      required: false,
      options: [
        { value: "standard", label: "스탠다드" },
        { value: "deluxe", label: "디럭스" },
        { value: "suite", label: "스위트" }
      ],
      order: 4
    },
    {
      id: "hasVisa",
      type: "checkbox",
      label: "비자 필요함",
      order: 5
    },
    {
      id: "visaCountry",
      type: "text",
      label: "비자 국가",
      order: 6,
      visibilityCondition: { fieldId: "hasVisa", value: true }
    }
  ],
  fieldMapping: {},  // 레거시 (하위호환)
  psychologyLenses: ["L6_TIMING_LOSS_AVERSION"],
  status: "ACTIVE"
}
```

### 계약서 인스턴스 데이터베이스 저장 구조

```
ContractInstance {
  id: "inst_67890",
  templateId: "tpl_12345",
  contactId: "contact_99",
  status: "DRAFT",  // → SIGNED → COMPLETED
  
  // 렌더링된 HTML (자동 생성)
  renderedHtml: `
    <h1>크루즈 여행 계약서</h1>
    <p>고객명: 김철수</p>
    <p>생년월일: 1990-05-15</p>
  `,
  
  // Contact 자동값 (Phase 6)
  inputValues: {
    customerName: "김철수",
    birthDate: "1990-05-15",
    productName: "로얄캐리비안"
  },
  
  // 서명 후 추가 입력값
  // 서명 시점에 업데이트됨
  // {
  //   cabin: "deluxe",
  //   hasVisa: true,
  //   visaCountry: "USA"
  // }
  
  // 기존 필드 (레거시)
  boundData: {},
  
  // 서명 정보
  signedAt: null,
  signatureImage: null,
  
  // 타임스탬프
  createdAt: "2026-06-15T12:00:00Z",
  expiresAt: "2026-06-16T12:00:00Z"
}
```

---

## Contact 필드 매핑 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ Contact 모델 필드                   → 입력필드 변환               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ name (String)                       → text                       │
│ email (String)                      → text                       │
│ phone (String)                      → text                       │
│                                                                  │
│ birthDate (DateTime)                → date (transformer)        │
│   transformer: Date → "YYYY-MM-DD"                              │
│                                                                  │
│ ageInYears (Int)                    → text (String 변환)        │
│                                                                  │
│ gender (String)                     → dropdown                   │
│   options: ["MALE", "FEMALE", "OTHER"]                          │
│                                                                  │
│ maritalStatus (String)              → dropdown                   │
│   options: ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]         │
│                                                                  │
│ childrenCount (Int)                 → text (String 변환)        │
│                                                                  │
│ passportNumber (String)             → text                       │
│                                                                  │
│ passportDaysLeft (Int)              → text (String 변환)        │
│                                                                  │
│ cruiseInterest (String)             → dropdown                   │
│   options: ["HIGH", "MEDIUM", "LOW"]                            │
│                                                                  │
│ cruiseCount (Int)                   → text (String 변환)        │
│                                                                  │
│ lastCruiseDate (DateTime)           → date (transformer)        │
│   transformer: Date → "YYYY-MM-DD"                              │
│                                                                  │
│ departureDate (DateTime)            → date (transformer)        │
│   transformer: Date → "YYYY-MM-DD"                              │
│                                                                  │
│ bookingRef (String)                 → text                       │
│                                                                  │
│ productName (String)                → text                       │
│                                                                  │
│ budgetRange (String)                → dropdown                   │
│   options: ["BUDGET", "STANDARD", "PREMIUM", "LUXURY"]          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 검증 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│ ContractInputField 검증 로직                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  사용자 입력값 → validateFieldValue(field, value)              │
│                                                                  │
│  Step 1: 필수 체크                                               │
│  ├─ field.required && !value.trim() → 오류                     │
│  └─ 통과 → Step 2                                              │
│                                                                  │
│  Step 2: 타입별 검증                                             │
│  │                                                               │
│  ├─ type = "text"                                              │
│  │   ├─ minLength 체크                                         │
│  │   ├─ maxLength 체크                                         │
│  │   ├─ pattern (정규식) 체크                                  │
│  │   └─ patternError 표시                                      │
│  │                                                               │
│  ├─ type = "date"                                              │
│  │   ├─ YYYY-MM-DD 형식 체크                                   │
│  │   ├─ 유효한 날짜인지 확인 (Date 생성자)                    │
│  │   └─ 오류: "올바른 날짜 형식이 아닙니다"                  │
│  │                                                               │
│  ├─ type = "dropdown"                                          │
│  │   ├─ field.options에 값 포함 여부                          │
│  │   └─ 없으면 오류: "선택값이 유효하지 않습니다"           │
│  │                                                               │
│  └─ type = "checkbox"                                          │
│      ├─ boolean 타입 확인                                      │
│      └─ "true", "false" 문자열 허용                           │
│                                                                  │
│  Step 3: 반환                                                    │
│  ├─ { valid: true }                                            │
│  └─ { valid: false, error: "에러 메시지" }                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 조건부 표시 로직                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  모든 필드 → filterVisibleFields(fields, values)              │
│                                                                  │
│  for each field:                                                │
│  ├─ !field.visibilityCondition → 항상 표시                     │
│  └─ field.visibilityCondition:                                 │
│      ├─ conditionFieldId = "hasVisa"                          │
│      ├─ conditionValue = true                                  │
│      ├─ actualValue = values["hasVisa"]                       │
│      ├─ actualValue === conditionValue → 표시                 │
│      └─ 아니면 숨김                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 레거시 호환성 (Backward Compatibility)

### Phase 5 이전 (boundData 기반)
```typescript
// 레거시: 단순 키-값 매핑
const instance = {
  boundData: {
    "고객명": "김철수",
    "생년월일": "1990-05-15"
  }
};

const html = "고객명: {{고객명}}, 생년월일: {{생년월일}}";
// 결과: "고객명: 김철수, 생년월일: 1990-05-15"
```

### Phase 6 (inputFields + inputValues 기반)
```typescript
// 신규: 타입 안전 + Contact 자동 매핑
const instance = {
  inputFields: [  // 템플릿의 필드 정의
    { id: "customerName", type: "text", contactFieldName: "name" },
    { id: "birthDate", type: "date", contactFieldName: "birthDate" }
  ],
  inputValues: {  // 실제 데이터 (서명 시 수집)
    customerName: "김철수",
    birthDate: "1990-05-15"
  }
};

const html = "고객명: {{customerName}}, 생년월일: {{birthDate}}";
// 결과: "고객명: 김철수, 생년월일: 1990-05-15"
```

### 혼용 가능 (Phase 6에서)
```typescript
// boundData + inputFields 동시 지원
const instance = {
  boundData: { ... },        // 레거시 필드
  inputValues: { ... },      // ✨ 신규 필드
};
```

---

**Last Updated**: 2026-06-15 | **Version**: 1.0
