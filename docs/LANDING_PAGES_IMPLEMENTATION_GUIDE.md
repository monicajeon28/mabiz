# Landing Pages 블록 시스템 - 구현 가이드

**버전**: 1.0  
**작성일**: 2026-06-15  
**상태**: 구현 준비

---

## 📋 목차

1. [빠른 시작](#빠른-시작)
2. [Block 생성 예시](#block-생성-예시)
3. [FormField 생성 예시](#formfield-생성-예시)
4. [API 구현 가이드](#api-구현-가이드)
5. [React 컴포넌트 구현](#react-컴포넌트-구현)
6. [테스트 전략](#테스트-전략)

---

## 빠른 시작

### 1. 타입 임포트

```typescript
import {
  Block,
  FormField,
  LandingPageFormConfig,
  HeroBlockConfig,
  CtaBlockConfig,
  FormBlockConfig,
  BlockSchema,
  LandingPageFormConfigSchema
} from '@/types/landing-page-blocks'
```

### 2. Block 검증

```typescript
// 안전한 검증
const validated = BlockSchema.safeParse(block)
if (!validated.success) {
  console.error(validated.error.flatten().fieldErrors)
}

// 예외 발생 검증
const block = BlockSchema.parse(blockData) // throws if invalid
```

### 3. 페이지 저장

```typescript
const response = await fetch(`/api/landing-pages/${pageId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    formConfig: {
      version: '1.0',
      blocks: [
        // ...
      ]
    }
  })
})
```

---

## Block 생성 예시

### 예시 1: Hero Block (L10 렌즈 - 감정적 연결)

```typescript
import { Block } from '@/types/landing-page-blocks'

const heroBlock: Block = {
  id: 'hero-1',
  type: 'hero',
  order: 0,
  enabled: true,
  config: {
    title: '꿈의 크루즈 여행, 이제 시작하세요',
    subtitle: '가족과 함께 만드는 추억의 시간',
    description: '세계 최고 수준의 크루즈 서비스로\n당신의 인생을 바꾸세요',
    backgroundImage: {
      url: 'https://cdn.example.com/cruise-hero.jpg',
      altText: '럭셔리 크루즈 이미지',
      position: 'cover'
    },
    cta: {
      text: '지금 신청하기',
      color: '#FF6B6B',
      scrollTo: 'form-1'
    },
    textColor: '#FFFFFF',
    minHeight: 500
  }
}
```

---

## FormField 생성 예시

### 기본 필드들

```typescript
import { FormField } from '@/types/landing-page-blocks'

// 이름 필드
const nameField: FormField = {
  id: 'field-name-001',
  name: 'customer_name',
  label: '고객 이름',
  type: 'text',
  required: true,
  placeholder: '홍길동',
  validation: {
    minLength: 2,
    maxLength: 50,
    pattern: '^[가-힣a-zA-Z\s]+$',
    customMessage: '올바른 이름을 입력하세요'
  },
  width: 'half'
}
```

---

## API 구현 가이드

### 1. 페이지 저장 - PATCH /api/landing-pages/[id]

```typescript
// formConfig 필드를 저장할 때 Zod로 검증
import { LandingPageFormConfigSchema } from '@/types/landing-page-blocks'

const validation = LandingPageFormConfigSchema.safeParse(formConfig)
if (!validation.success) {
  // 블록 검증 실패 처리
}
```

### 2. 응답 저장 - POST /api/landing-pages/[id]/register

blockResponses 배열에 폼 필드값 저장:

```typescript
{
  blockResponses: [
    {
      blockId: 'form-1',
      blockType: 'form',
      responses: {
        customer_name: '홍길동',
        phone: '010-1234-5678',
        email: 'hong@example.com'
      },
      submittedAt: '2026-06-15T10:30:00Z'
    }
  ]
}
```

---

## 마이그레이션 체크리스트

- [ ] src/types/landing-page-blocks.ts 생성 ✅
- [ ] Prisma 마이그레이션 파일 생성
- [ ] API 라우트 검증 로직 추가
- [ ] React 컴포넌트 구현 (BlockRenderer)
- [ ] 단위/통합 테스트 작성
- [ ] 스테이징 환경 검증
- [ ] 운영 환경 배포

---

**다음 단계**: Phase 1-2 구현 시작
