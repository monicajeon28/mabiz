# Phase 6 빠른 시작 가이드

## 1️⃣ 계약서 템플릿 생성 (관리자)

### 관리자 UI 또는 API로 inputFields 정의

```json
POST /api/contract-templates
{
  "name": "크루즈 구매계약서",
  "category": "CRUISE",
  "htmlContent": "...",
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
      "label": "식이 제한이 있습니다"
    },
    {
      "key": "specialRequests",
      "type": "text",
      "label": "특별 요청사항",
      "placeholder": "최대 200자"
    }
  ]
}
```

## 2️⃣ 서명 페이지 자동 작동

### 고객이 링크를 클릭하면 자동으로:

```
1. GET /api/public/contract-instances/{id}
   → inputFields 로드
   
2. ContractSignForm 렌더링
   ├── 필드 표시
   ├── Contact 자동 채우기
   └── 실시간 검증
   
3. 사용자 입력 (필드별)
   
4. 유효성 검사
   ├── 필수 필드 체크
   ├── 형식 검증 (email, phone, date)
   └── 커스텀 패턴 검증
   
5. 서명 생성
   
6. POST /api/public/contract-instances/{id}/sign
   Body: { inputFields: [...], signerName, signatureImage }
   
7. 저장 완료
   → ContractInstance.inputFields
   → ContractInstance.boundData
```

## 3️⃣ 필드 타입 빠른 레퍼런스

| 타입 | 입력 예시 | 저장 값 | 특징 |
|------|---------|--------|------|
| `text` | "김철수" | string | 최대 100자 |
| `email` | "kim@ex.com" | string | 형식 검증 |
| `phone` | "010-1234-5678" | string | 자동 포매팅 |
| `number` | "3" | string | 정수만 |
| `date` | "2026-06-15" | string | YYYY-MM-DD |
| `checkbox` | ☑ | boolean | true/false |
| `dropdown` | ▼ 발코니 | string | options 내 값 |

## 4️⃣ 검증 규칙 (자동 적용)

```typescript
// 필드별 자동 검증
{
  "type": "email",
  // 검증: ^[^\s@]+@[^\s@]+\.[^\s@]+$
  
  "type": "phone",
  // 검증: ^01[0-9]-?\d{3,4}-?\d{4}$
  
  "type": "date",
  // 검증: YYYY-MM-DD 형식
  
  "required": true,
  // 검증: 비어있지 않음
  
  "pattern": "^(19|20)\\d{2}$",
  // 검증: 커스텀 정규식 (예: 1900~2099)
}
```

## 5️⃣ Contact 자동 채우기

### API 응답 (자동)
```json
GET /api/public/contract-instances/{id}
{
  "boundData": {
    "buyerName": "김철수",      // → name 필드
    "buyerTel": "010-1234-5678", // → phone 필드
    "buyerEmail": "kim@ex.com"   // → email 필드
  }
}
```

### 컴포넌트 (자동)
```typescript
<ContractSignForm
  inputFields={contract.inputFields}
  contactAutoFill={{
    name: "김철수",
    phone: "010-1234-5678",
    email: "kim@ex.com"
  }}
/>
```

## 6️⃣ 에러 메시지 예시

```
❌ 필수 입력입니다
❌ 올바른 이메일 형식이 아닙니다
❌ 올바른 전화번호 형식이 아닙니다 (010-0000-0000)
❌ 올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)
❌ 형식이 올바르지 않습니다
```

## 7️⃣ 저장된 데이터 조회

### ContractInstance.inputFields
```json
[
  { "key": "roomGrade", "value": "balcony" },
  { "key": "dietaryRestriction", "value": true },
  { "key": "specialRequests", "value": "높은 층 배정 희망" }
]
```

### ContractInstance.boundData
```json
{
  "signerName": "김철수",
  "roomGrade": "balcony",
  "dietaryRestriction": true,
  "specialRequests": "높은 층 배정 희망",
  "signedAt": "2026-06-15T10:30:00Z"
}
```

## 8️⃣ 배포 전 체크리스트

```bash
# 1. TypeScript 검증
npx tsc --noEmit  # 에러 0개 확인

# 2. Prisma 재생성
npx prisma generate

# 3. 로컬 테스트
npm run dev
# → 기존 계약서 (inputFields 없음) 테스트
# → 신규 계약서 (inputFields 있음) 테스트

# 4. DB 마이그레이션 (프로덕션)
npx prisma migrate deploy

# 5. 배포
# GitHub → Vercel 자동 배포
```

## 9️⃣ 자주 묻는 질문 (FAQ)

### Q: inputFields가 표시되지 않습니다
**A**: ContractTemplate에서 inputFields를 정의해야 합니다. 빈 배열이면 렌더링되지 않습니다.

### Q: Contact 정보가 자동으로 채워지지 않습니다
**A**: boundData에 필드명이 있는지 확인하세요. 
- `boundData.buyerName` → `inputFields[].key: "name"`
- `boundData.buyerTel` → `inputFields[].key: "phone"`

### Q: Phone 형식이 여전히 오류입니다
**A**: 하이픈은 선택사항입니다.
- ✅ "010-1234-5678"
- ✅ "01012345678"
- ❌ "010-1234567" (너무 짧음)

### Q: Dropdown에 옵션을 추가하려면?
**A**: ContractTemplate.inputFields 수정:
```json
{
  "key": "roomGrade",
  "type": "dropdown",
  "options": [
    { "label": "새로운 옵션", "value": "new_value" }
  ]
}
```

### Q: 필드를 조건부로 표시할 수 있나요?
**A**: Phase 7에서 구현 예정입니다. 현재는 모든 필드를 항상 표시합니다.

---

## 🎯 핵심 포인트

1. **자동 포매팅**: Phone 필드는 자동으로 010-XXXX-XXXX 형식 적용
2. **실시간 검증**: 각 필드 입력 시 즉시 검증
3. **Contact 통합**: 기존 고객 정보 자동 입력
4. **이중 저장**: inputFields + boundData 두 곳 저장
5. **하위 호환성**: inputFields 없는 계약서도 정상 작동

---

**참고**: 상세 문서는 `CONTRACT_PHASE6_INPUT_FIELDS.md` 참조
