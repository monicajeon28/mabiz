# 계약서 Phase 6: 입력필드 렌더링 (2026-06-15)

## 개요

Phase 6은 계약서 서명 페이지에서 **동적 입력 필드(inputFields)**를 렌더링하고 수집하는 기능입니다.

- **목표**: 계약서 템플릿에 정의된 입력 필드(text/checkbox/date/dropdown 등)를 서명 페이지에서 보여주고, 사용자 입력을 수집해 저장
- **배경**: 구매계약서 동행자 정보(이름, 생년월일, 관계, 연락처) 외에도 상품별 맞춤 입력 필드 필요 (예: 객실 등급 선택, 식사 선호도 체크박스 등)
- **적용 범위**: 공개 서명 페이지 (`/contract/sign/instance/[id]`)

---

## 아키텍처

### 1. 데이터 모델 (Prisma)

#### ContractTemplate
```prisma
model ContractTemplate {
  // ...
  inputFields Json @default("[]")  // Array<InputFieldDef>
}
```

**InputFieldDef 구조** (TypeScript):
```typescript
interface InputFieldDef {
  key: string;                    // 필드 고유 키 (예: "roomGrade", "dietaryPreference")
  type: InputFieldType;           // "text" | "checkbox" | "date" | "dropdown" | "phone" | "email" | "number"
  label: string;                  // 필드 라벨 (예: "객실 등급")
  required?: boolean;             // 필수 여부 (기본값: false)
  placeholder?: string;           // 입력 힌트
  pattern?: string;               // 정규식 검증 패턴 (선택사항)
  options?: InputFieldOption[];   // dropdown/radio 옵션
  defaultValue?: string;          // 기본값
  helpText?: string;              // 하단 설명 텍스트
}

interface InputFieldOption {
  label: string;    // 표시할 텍스트 (예: "프리미엄 스위트")
  value: string;    // 저장될 값
}
```

#### ContractInstance
```prisma
model ContractInstance {
  // ...
  inputFields Json @default("[]")  // Array<InputFieldValue> - 서명 시 수집된 데이터
}
```

**InputFieldValue 구조**:
```typescript
interface InputFieldValue {
  key: string;
  value: string | boolean;
}
```

### 2. 컴포넌트 구조

#### ContractInputField.tsx
단일 입력 필드 렌더링 컴포넌트

**기능**:
- 필드 타입별 HTML input 분기 (text, email, phone, date, dropdown, checkbox, number)
- Phone 자동 포매팅 (010-0000-0000)
- Email, phone, date 형식 검증
- 실시간 에러 표시 (touched 상태)
- contactAutoFill 지원 (Contact에서 자동 채우기)

**Props**:
```typescript
interface ContractInputFieldProps {
  field: InputFieldDef;
  value: string | boolean;
  onChange: (fieldKey: string, value: string | boolean) => void;
  error?: string;
  disabled?: boolean;
}
```

**검증 함수**:
```typescript
function validateInputField(field: InputFieldDef, value: string | boolean): string | null
```

#### ContractSignForm.tsx
다중 입력 필드를 포함한 폼 컴포넌트

**기능**:
- 여러 필드의 상태 관리
- 필드별 에러 상태 추적
- 전체 유효성 검사 (`validateAll()`)
- 컴팩트 미리보기 (처음 3개 필드만 표시)
- 에러 요약 표시

**Props**:
```typescript
interface ContractSignFormProps {
  inputFields?: InputFieldDef[];
  onFieldsChange: (fields: InputFieldValue[]) => void;
  contactAutoFill?: Record<string, string | boolean>;
  showCompactPreview?: boolean;
}
```

**Hook: useContractSignForm**
```typescript
const {
  formData,         // InputFieldValue[]
  isValid,          // boolean
  handleFieldsChange,
  validate,         // (inputFields: InputFieldDef[]) => boolean
} = useContractSignForm();
```

---

## 사용 흐름

### 1. 계약서 템플릿 정의 (관리자)

ContractTemplate 생성 시 inputFields 정의:

```json
{
  "name": "크루즈 구매계약서 v2",
  "htmlContent": "...",
  "fieldMapping": {...},
  "inputFields": [
    {
      "key": "roomGrade",
      "type": "dropdown",
      "label": "객실 등급",
      "required": true,
      "options": [
        { "label": "내실", "value": "inside" },
        { "label": "대양창", "value": "ocean" },
        { "label": "발코니", "value": "balcony" }
      ]
    },
    {
      "key": "dietaryRestriction",
      "type": "checkbox",
      "label": "식이 제한이 있습니다",
      "required": false
    },
    {
      "key": "specialRequests",
      "type": "text",
      "label": "특별 요청사항",
      "placeholder": "예: 높은 층 배정 희망",
      "helpText": "최대 200자까지 입력 가능합니다"
    }
  ]
}
```

### 2. 서명 페이지 렌더링

**클라이언트 흐름** (`/contract/sign/instance/[id]`):

```
1. GET /api/public/contract-instances/{id}
   ↓
2. Response: {
     renderedHtml: "...",
     inputFields: [...],  ← ContractTemplate.inputFields 포함
     boundData: {...}     ← Contact 자동 채우기 데이터
   }
   ↓
3. ContractSignForm 렌더링
   - inputFields 수신
   - contactAutoFill로 Contact 데이터 자동 입력
   ↓
4. 사용자 입력
   ↓
5. validateAll() → 서명 전 검증
```

**Step 2 (Sign) UI**:
```
┌─────────────────────────────────────┐
│ Step 2. 정보 입력 & 서명             │
└─────────────────────────────────────┘

┌─ 계약서 정보 입력 ──────────────────┐
│                                     │
│ [객실 등급]     ▼ 선택하세요       │
│                                     │
│ ☐ 식이 제한이 있습니다             │
│                                     │
│ [특별 요청사항] [_________]        │
│                                     │
│ [✓ 입력 내용 검증]                 │
└─────────────────────────────────────┘

┌─ ✓ 입력 내용 미리보기 (3/3개) ▼ ───┐
│ 객실 등급: 발코니                   │
│ 특별 요청사항: 높은 층 배정 희망    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📌 서명 방식 선택                    │
│ ○ 직접 그리기                       │
│ ○ 자동생성                          │
│ ○ 이미지업로드                      │
└─────────────────────────────────────┘

[Canvas Drawing Area]

[다시 선택] [서명 완료]
```

### 3. 서명 제출

**클라이언트 코드**:
```typescript
const handleSubmitSignature = async () => {
  // 입력 필드 유효성 검사
  if (contract?.inputFields && contract.inputFields.length > 0) {
    if (!validate(contract.inputFields)) {
      showError('모든 필수 입력 필드를 올바르게 채워주세요');
      return;
    }
  }

  const res = await fetch(`/api/public/contract-instances/${contractId}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signerName,
      signatureImage,
      inputFields: formData,  // ← 입력 필드 데이터 전송
    }),
  });
};
```

**API 요청**:
```json
POST /api/public/contract-instances/{id}/sign
{
  "signerName": "김철수",
  "signatureImage": "data:image/png;base64,...",
  "inputFields": [
    { "key": "roomGrade", "value": "balcony" },
    { "key": "dietaryRestriction", "value": true },
    { "key": "specialRequests", "value": "높은 층 배정 희망" }
  ]
}
```

### 4. 데이터 저장

**API 핸들러** (`/api/public/contract-instances/[id]/sign`):

```typescript
await prisma.contractInstance.updateMany({
  where: { id, status: { in: ['DRAFT', 'SENT'] } },
  data: {
    status: 'SIGNED',
    signedAt,
    signatureImage,
    inputFields,  // ← 저장
    boundData: {
      ...boundData,
      signerName,
      inputFields,  // boundData에도 저장
      signedAt,
    },
  },
});
```

**저장 결과**:
```
ContractInstance.inputFields = [
  { "key": "roomGrade", "value": "balcony" },
  { "key": "dietaryRestriction", "value": true },
  { "key": "specialRequests", "value": "높은 층 배정 희망" }
]

ContractInstance.boundData = {
  "signerName": "김철수",
  "roomGrade": "balcony",
  "dietaryRestriction": true,
  "specialRequests": "높은 층 배정 희망",
  "inputFields": [...],
  "signedAt": "2026-06-15T10:30:00Z"
}
```

---

## 검증 규칙

### 필드 타입별 검증

| 타입 | 검증 규칙 | 예시 |
|------|---------|------|
| `text` | 최대 100자, 필수 시 비어있지 않음 | "김철수" |
| `email` | 정규식: `^[^\s@]+@[^\s@]+\.[^\s@]+$` | "user@example.com" |
| `phone` | 정규식: `^01[0-9]-?\d{3,4}-?\d{4}$` | "010-1234-5678" |
| `number` | 정수, 필수 시 0 이상 | "3" |
| `date` | ISO 8601 형식: `YYYY-MM-DD` | "2026-06-15" |
| `checkbox` | boolean (true/false) | true |
| `dropdown` | options 내 값만 허용 | "balcony" |

### 커스텀 패턴

```typescript
{
  "key": "birthYear",
  "type": "text",
  "label": "출생년도",
  "pattern": "^(19|20)\\d{2}$",  // 1900~2099
  "required": true
}
```

---

## Contact 자동 채우기

서명 페이지에서 Contact 데이터를 자동으로 입력 필드에 채우기:

**API 응답**:
```json
{
  "boundData": {
    "buyerName": "김철수",
    "buyerTel": "010-1234-5678",
    "buyerEmail": "kim@example.com"
  },
  "inputFields": [
    { "key": "name", ... },
    { "key": "phone", ... },
    { "key": "email", ... }
  ]
}
```

**컴포넌트 코드**:
```typescript
<ContractSignForm
  inputFields={contract.inputFields}
  onFieldsChange={handleFieldsChange}
  contactAutoFill={{
    name: contract.boundData.buyerName,
    phone: contract.boundData.buyerTel,
    email: contract.boundData.buyerEmail,
  }}
/>
```

---

## 마이그레이션 & 배포

### 1. 데이터베이스 마이그레이션

```bash
npx prisma migrate deploy
```

**마이그레이션 파일**: `20260615130000_add_contract_input_fields/migration.sql`

```sql
ALTER TABLE "ContractTemplate" ADD COLUMN "inputFields" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ContractInstance" ADD COLUMN "inputFields" JSONB NOT NULL DEFAULT '[]';
CREATE INDEX idx_contract_template_has_input_fields ON "ContractTemplate"(...);
CREATE INDEX idx_contract_instance_has_input_fields ON "ContractInstance"(...);
```

### 2. TypeScript 컴파일

```bash
npx tsc --noEmit
```

✅ 에러 0개 확인

### 3. 배포 체크리스트

- [ ] DB 마이그레이션 실행 (`npx prisma migrate deploy`)
- [ ] Prisma 클라이언트 재생성 (`npx prisma generate`)
- [ ] TypeScript 컴파일 확인 (`npx tsc --noEmit`)
- [ ] 서명 페이지 테스트
  - [ ] 입력 필드 없는 계약서 (기존)
  - [ ] 입력 필드 있는 계약서 (신규)
  - [ ] 필드 유효성 검사 (빈 필드, 형식 오류)
  - [ ] 서명 제출 (입력 필드 데이터 저장)
- [ ] Contact 자동 채우기 테스트

---

## API 명세

### GET /api/public/contract-instances/{id}

**응답**:
```json
{
  "ok": true,
  "status": "DRAFT",
  "templateName": "크루즈 구매계약서",
  "renderedHtml": "...",
  "boundData": { ... },
  "inputFields": [
    {
      "key": "roomGrade",
      "type": "dropdown",
      "label": "객실 등급",
      "required": true,
      "options": [...]
    }
  ],
  "expiresAt": "2026-06-16T...",
  "alreadySigned": false,
  "signedAt": null
}
```

### POST /api/public/contract-instances/{id}/sign

**요청**:
```json
{
  "signerName": "김철수",
  "signatureImage": "data:image/png;base64,...",
  "inputFields": [
    { "key": "roomGrade", "value": "balcony" },
    { "key": "dietaryRestriction", "value": true }
  ]
}
```

**응답**:
```json
{
  "ok": true,
  "signedAt": "2026-06-15T10:30:00Z",
  "message": "서명이 완료되었습니다"
}
```

---

## 파일 목록

| 파일 | 설명 |
|------|------|
| `src/components/contract/ContractInputField.tsx` | 단일 입력 필드 컴포넌트 |
| `src/components/contract/ContractSignForm.tsx` | 다중 입력 필드 폼 + Hook |
| `src/app/contract/sign/instance/[id]/page.tsx` | 서명 페이지 (inputFields 통합) |
| `src/app/api/public/contract-instances/[id]/route.ts` | GET: inputFields 포함 응답 |
| `src/app/api/public/contract-instances/[id]/sign/route.ts` | POST: inputFields 저장 |
| `prisma/schema.prisma` | ContractTemplate, ContractInstance 업데이트 |
| `prisma/migrations/20260615130000_add_contract_input_fields/migration.sql` | DB 마이그레이션 |

---

## 구현 세부사항

### Phone 자동 포매팅

```typescript
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

// 예: "01012345678" → "010-1234-5678"
```

### Dropdown 렌더링

```typescript
<select value={value} onChange={(e) => handleChange(e.target.value)}>
  <option value="">{field.placeholder || '선택하세요'}</option>
  {field.options?.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))}
</select>
```

### 에러 상태 표시

- `touched` 상태가 true일 때만 에러 표시 (불필요한 노출 방지)
- 각 필드별 `onChange` + 실시간 `validate()`
- 전체 폼은 `validateAll()` 호출 (서명 전)

---

## 향후 확장 (Phase 7+)

1. **섹션 그룹핑**: 필드를 여러 섹션으로 나누기 (예: "승객 정보", "특별 요청")
2. **조건부 필드**: 다른 필드 값에 따라 필드 표시/숨김
3. **파일 업로드**: `type: "file"` 지원 (신분증, 보험료 증명 등)
4. **서명 필드 동적 위치**: HTML의 특정 위치에 서명 삽입
5. **필드 테이블**: 동행자 정보처럼 반복 가능한 필드 행
6. **관리자 대시보드**: 수집된 inputFields 데이터 조회/내보내기

---

## 테스트 시나리오

### 1. 기본 흐름 (모든 필드 채우기)

```
1. 계약서 열기 → inputFields 로드
2. 모든 필드 입력
3. "입력 내용 검증" 클릭 → 성공
4. 서명 그리기
5. "서명 완료" 클릭 → 성공
6. DB 확인: ContractInstance.inputFields 저장됨
```

### 2. 유효성 검사 실패

```
1. 필수 필드 비워두기
2. "입력 내용 검증" 클릭
3. 에러 메시지 표시 → 필드명 + 오류 내용
4. 필드 수정 후 재검증 → 성공
5. 서명 → 성공
```

### 3. Contact 자동 채우기

```
1. 계약서 열기
2. boundData에 buyerName, buyerTel 있음
3. name, phone 필드가 자동으로 채워짐
4. 사용자가 추가 필드만 입력
5. 서명 → 완료
```

---

## 문제 해결

### Q: inputFields가 빈 배열로 저장된다
A: ContractTemplate에서 inputFields를 정의해야 합니다. 관리자 UI에서 템플릿 생성 시 inputFields를 설정해주세요.

### Q: Phone 형식이 010-1234-5678인데 검증 실패한다
A: `phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/`에서 `-`는 선택사항입니다. "01012345678"도 허용됩니다.

### Q: Dropdown 필드에서 옵션이 안 보인다
A: ContractTemplate.inputFields에서 `options` 배열을 확인하세요. 빈 배열이면 옵션이 표시되지 않습니다.

### Q: 필드 값이 서명 후 손실된다
A: inputFields와 boundData 두 곳에 저장됩니다. boundData에서 확인하세요.

---

**작성일**: 2026-06-15  
**상태**: ✅ 완료 (TypeScript 0 에러)  
**커밋**: [pending - 아래 배포 시 생성]
