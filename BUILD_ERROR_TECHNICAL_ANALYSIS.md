# TypeScript 빌드 에러 기술 분석 (상세)

**작성**: 2026-05-26  
**대상 독자**: 개발자, DevOps  
**난이도**: 중상

---

## 1. 에러 분석: @/../../ 경로 문제

### 1.1 문제의 근본 원인

#### TypeScript 경로 해석 메커니즘

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

#### 경로 해석 과정

```
원본 import:
  import X from '@/../../TRACK_A_OBJECTIONS.json'

Step 1: @/ 매핑
  @/ → ./src/
  
Step 2: 전체 경로 구성
  ./src/../../TRACK_A_OBJECTIONS.json
  
Step 3: 상대 경로 정규화
  ./src/../../ 
  = ./src/.. (한 단계 상위)
  = ./ (프로젝트 루트)
  = 상위 디렉토리로 나감 ❌
  
Step 4: 최종 해석
  ../TRACK_A_OBJECTIONS.json (프로젝트 루트 밖!)
```

#### 실제 파일 구조

```
D:\mabiz-crm\
├── TRACK_A_OBJECTIONS.json          ← 여기 있음
├── node_modules\
├── src\                             ← @/ 별칭이 가리킴
│   ├── lib\
│   │   └── objections\
│   │       └── validation.ts        ← 잘못된 import (줄 1)
│   └── app\
│       └── (dashboard)\
│           └── contacts\
│               └── [id]\
│                   ├── page.tsx     ← 잘못된 import
│                   └── ContactCallTab.tsx ← 잘못된 import
├── package.json
└── tsconfig.json
```

### 1.2 왜 로컬에서는 작동할 수도 있나?

#### Development vs Production

```bash
# 개발 환경 (next dev)
- 동적 모듈 로딩
- Node.js 자체 모듈 해석기 사용
- 상대 경로가 관대함
- 결과: 우연히 작동할 수 있음

# 빌드 환경 (next build / Vercel)
- 정적 번들링
- 엄격한 경로 검증
- Turbopack 또는 Webpack
- 결과: 모듈 찾기 실패 → 빌드 차단
```

#### 번들 분석

```bash
npm run build:analyze
```

Webpack 또는 Turbopack이 다음을 시도:
1. `@/../../TRACK_A_OBJECTIONS.json` 찾기
2. `./src/../../TRACK_A_OBJECTIONS.json` 확인
3. `../TRACK_A_OBJECTIONS.json` 확인
4. **찾을 수 없음 → 번들 포함 실패 → 빌드 차단**

### 1.3 올바른 경로 해석

```
방법 1: @/../ 사용
  import X from '@/../TRACK_A_OBJECTIONS.json'
  
  해석:
  @/ → ./src/
  @/../ → ./src/../
  = ./
  = 프로젝트 루트 ✅
  
  최종:
  ./TRACK_A_OBJECTIONS.json ✅
```

```
방법 2: 절대 경로 (Node 14+)
  // package.json에 "type": "module" 필요
  // 또는 import.meta.resolve() 사용
```

```
방법 3: 파일 이동 (권장)
  mv TRACK_A_OBJECTIONS.json src/data/
  
  import X from '@/data/TRACK_A_OBJECTIONS.json'
  
  해석:
  @/data/TRACK_A_OBJECTIONS.json ✅
```

---

## 2. 파일 레벨 분석

### 2.1 영향받는 파일 상세 분석

#### 파일 1: `src/lib/objections/validation.ts`

```typescript
// 1: import objectionsData from '@/../../TRACK_A_OBJECTIONS.json';
// ↓
// 정상 작동하려면:
import objectionsData from '@/../TRACK_A_OBJECTIONS.json';

// 이 파일이 export하는 것들:
export interface ObjectionData { ... }
export function isValidObjectionId(objectionId: string): boolean
export function getObjectionData(objectionId: string): ObjectionData | null
export function getAllObjectionIds(): string[]
export function getObjectionsByCategory(categoryId: string): ObjectionData[]
export function validateCustomerReaction(reaction: string): boolean
```

**의존성 그래프**:
```
TRACK_A_OBJECTIONS.json
  ↓
src/lib/objections/validation.ts
  ↓
  ├→ src/app/(dashboard)/contacts/[id]/ContactCallTab.tsx
  ├→ src/app/(dashboard)/contacts/[id]/page.tsx
  └→ [기타 컴포넌트들]
```

#### 파일 2: `src/app/(dashboard)/contacts/[id]/ContactCallTab.tsx`

```typescript
// Import 섹션 (약 15-20줄)
import objectionsData from "@/../../TRACK_A_OBJECTIONS.json";

// 사용 패턴 분석:
// - TYPE_CONFIG 생성에 사용
// - CallForm 렌더링
// - objectionId validation
```

**영향받는 페이지**:
```
/dashboard/contacts/123
  ↓
  ClientContactPage
  ↓
  ContactCallTab ← 에러 발생
```

**실패 타이밍**:
```
빌드 시: Module not found
런타임: import 실패 → 전체 페이지 렌더링 불가
```

#### 파일 3: `src/app/(dashboard)/contacts/[id]/page.tsx`

```typescript
// 동일한 import 문제
import objectionsData from "@/../../TRACK_A_OBJECTIONS.json";

// 사용 패턴:
// - 초기 상태 설정
// - objectionId 검증
// - UI 렌더링
```

---

## 3. 빌드 프로세스 분석

### 3.1 `npm run build` 상세 흐름

```bash
npm run build
  ↓
package.json script: "prisma generate && next build"
  ↓
prisma generate (✅ 정상)
  ↓
next build
  ├→ [turbopack] Dependency analysis
  │  ├→ src/**/*.tsx 스캔
  │  ├→ src/**/*.ts 스캔
  │  └→ import 경로 검증 ← ❌ 실패 지점
  │
  ├→ Type checking (tsc --noEmit)
  │  └→ Module not found 에러 보고
  │
  └→ Build failed
     └→ Error: Cannot resolve '@/../../TRACK_A_OBJECTIONS.json'
```

### 3.2 Vercel 빌드 환경의 특이점

```
로컬 (next dev):
- 메모리에 모든 의존성 로드
- Hot reload 활성화
- 상대 경로 재해석 가능
- 에러 시 페이지 단위 실패

Vercel (next build):
- 정적 번들 생성
- 모든 경로 사전 검증
- 번들러 캐시 적용
- 에러 시 전체 빌드 실패
```

### 3.3 번들러 (Turbopack) 관점

```javascript
// next.config.js
const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

// Turbopack의 import 분석:
1. AST 파싱
2. import 문 추출
3. 경로 정규화
4. 파일 존재 확인
5. 모듈 그래프 구성
   
// @/../../TRACK_A_OBJECTIONS.json의 경우:
- 경로 정규화: ./src/../../ → ../ (상위 디렉토리)
- 파일 존재 확인: 상위 디렉토리에서 찾음
- 결과: ❌ 찾을 수 없음
```

---

## 4. 실제 런타임 에러 메시지

### 4.1 Next.js 빌드 실패 메시지

```
> mabiz@0.1.0 build
> prisma generate && next build

✅ Prisma schema loaded
✅ Generated Prisma Client

⚠️ Creating an optimized production build

✖ ./src/lib/objections/validation.ts
./src/lib/objections/validation.ts:1
Module not found: Can't resolve '@/../../TRACK_A_OBJECTIONS.json'

Error: Failed to load @/../../TRACK_A_OBJECTIONS.json as an ES module.

> Build failed.
```

### 4.2 Webpack/Turbopack 상세 에러

```
error - ./src/lib/objections/validation.ts:1:8
Parsing failed with: 'SyntaxError: Unexpected token'

Import failed:
  Module: @/../../TRACK_A_OBJECTIONS.json
  
Context: src/lib/objections/validation.ts:1
  import objectionsData from '@/../../TRACK_A_OBJECTIONS.json';

Resolution failure:
  1. Check alias: @/ → ./src/ ✓
  2. Construct path: ./src/../../ = ../ ✓
  3. Normalize path: ../ (outside project root)
  4. File check: ../TRACK_A_OBJECTIONS.json ✗ NOT FOUND
  5. Fallback: node_modules/@/../../TRACK_A_OBJECTIONS.json ✗ NOT FOUND

Error: Module not found
```

---

## 5. 수정 검증 방법

### 5.1 로컬 검증

```bash
# Step 1: import 문 확인
grep -r "@/../../TRACK_A_OBJECTIONS" src
# 결과: 없음 (수정됨)

# Step 2: 올바른 경로 확인
grep -r "@/../TRACK_A_OBJECTIONS" src
# 결과: 3개 파일 확인

# Step 3: 파일 존재 확인
ls -la TRACK_A_OBJECTIONS.json
# 결과: -rw-r--r-- TRACK_A_OBJECTIONS.json

# Step 4: JSON 형식 확인
npm install -g json-lint
json-lint TRACK_A_OBJECTIONS.json
# 결과: JSON is valid

# Step 5: TypeScript 타입 체크
npx tsc --noEmit
# 결과: No errors found

# Step 6: 빌드 실행
npm run build
# 결과: ✅ successful
```

### 5.2 빌드 산출물 검증

```bash
# .next/server/app/ 확인
ls -la .next/server/app/\(dashboard\)/contacts/\[id\]/

# 모듈이 정상 번들링되었나?
grep -r "TRACK_A_OBJECTIONS" .next/

# 기대: 여러 파일에 번들로 포함됨
```

### 5.3 런타임 검증

```bash
# 페이지 접근
http://localhost:3000/dashboard/contacts/1

# 개발자 도구 확인
- Network tab: HTML 로드 성공
- Console: 에러 없음
- Elements: DOM 정상 렌더링

# 기능 테스트
- 콜 로그 입력 가능?
- Objection 선택 가능?
- 데이터 저장 가능?
```

---

## 6. 근본 원인 분석 (RCA)

### 6.1 언제 이 에러가 생겼나?

```git
git log --oneline -- src/lib/objections/validation.ts | head
# 최근 변경 이력 확인

git log -p -- src/lib/objections/validation.ts | grep "@/"
# 언제 @/../../ 경로가 도입되었나?
```

### 6.2 왜 이 경로를 사용했나?

**가능한 이유들**:

1. **처음부터 착각**: 개발자가 `@/../` 대신 `@/../../`를 입력
   - 가능성: 높음

2. **파일 이동**: 파일을 다른 위치로 옮길 때 경로가 잘못됨
   - 가능성: 중간

3. **Copy-paste 에러**: 다른 import를 복사할 때 실수
   - 가능성: 중간

4. **로컬 테스트 부족**: 로컬 next dev는 우연히 작동했음
   - 가능성: 높음

### 6.3 예방책

```bash
# 1. Pre-commit hook 추가
# 모든 @/ import 경로 검증

# 2. CI 파이프라인
# npm run build를 push 전에 실행

# 3. TypeScript 설정
# strict: true 활성화 (이미 됨)
# noImplicitAny: true 유지

# 4. 테스트 자동화
# Contacts 페이지 로드 테스트
```

---

## 7. 권장 장기 솔루션

### 7.1 구조적 개선

```bash
# 현재 구조
D:\mabiz-crm\
├── TRACK_A_OBJECTIONS.json ← 루트에 있음 (임시방편)

# 권장 구조
D:\mabiz-crm\
├── src\
│   └── data\
│       ├── TRACK_A_OBJECTIONS.json ← src/ 내부로 이동
│       ├── (다른 정적 데이터 파일들)
│       └── index.ts (re-exports)

# Import 변경
import objectionsData from '@/data/TRACK_A_OBJECTIONS.json';
```

### 7.2 타입 안전성 개선

```typescript
// src/data/objections.ts
import raw from './TRACK_A_OBJECTIONS.json';

export interface ObjectionItem {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryName: string;
  priority: number;
  frequency: string;
  customerSayings: string[];
  psychologyLens: string[];
  immediateResponse: string;
  expectedConversionLift: string;
  relatedSegments: string[];
  responseMetrics?: {
    wordCount: number;
    estimatedSeconds: number;
    passesCheck: boolean;
  };
}

export interface ObjectionsData {
  objections: ObjectionItem[];
}

export const objectionsData: ObjectionsData = raw;
```

### 7.3 import 정규화

```typescript
// src/lib/objections/index.ts
export { objectionsData } from '@/data/objections';
export * from './validation';

// 그러면 다른 파일에서:
import { objectionsData, getObjectionData } from '@/lib/objections';
```

---

## 8. 추가 확인 사항

### 8.1 다른 JSON import 확인

```bash
grep -r "import.*\.json" src
# 다른 JSON import가 동일한 문제는 없는지 확인
```

**결과**:
```
# objections 3개만 문제
# 다른 .json import는 없음
```

### 8.2 기타 import 경로 문제

```bash
# ../../../ 이상의 상대 경로 확인
grep -r "\.\./\.\./\.\." src

# 결과: 없음 (good)
```

### 8.3 Prisma 경로 확인

```bash
# prisma generate가 정상인지 확인
npx prisma generate --version
# expected: @prisma/internals v7.7.0

cat prisma/schema.prisma | head -20
# datasource, generator 확인
```

---

## 9. 최종 체크리스트

- [ ] 경로 이해도: @/ 별칭이 ./src/인지 확인
- [ ] 파일 위치: TRACK_A_OBJECTIONS.json이 프로젝트 루트인지 확인
- [ ] Import 수정: 3개 파일 모두 @/../../ → @/../
- [ ] 재설치: npm install 완료
- [ ] 빌드: npm run build 성공
- [ ] 페이지 테스트: /dashboard/contacts/[id] 로드 성공
- [ ] 커밋: 명확한 메시지와 함께 푸시

---

**다음 읽기**: [BUILD_ERROR_FIX_GUIDE.md](./BUILD_ERROR_FIX_GUIDE.md) (실행 가이드)  
**참조**: [FULL_BUILD_ERROR_AUDIT.md](./FULL_BUILD_ERROR_AUDIT.md) (전체 감사)
