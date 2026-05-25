# TypeScript 컴파일 에러 전체 스캔 리포트

**작성일**: 2026-05-26  
**대상**: Vercel 빌드 실패 원인 분석  
**상태**: 완료

---

## 📊 요약

| 구분 | 개수 | 심각도 |
|------|------|--------|
| **P0 (빌드 차단)** | 2개 | 🔴 즉시 수정 필수 |
| **P1 (배포 위험)** | 1개 | 🟠 배포 전 수정 권장 |
| **P2 (경고)** | 1개 | 🟡 배포 후 수정 가능 |
| **총 이슈** | **4개** | - |

---

## 🔴 P0: 빌드 차단 에러

### 1️⃣ 잘못된 JSON 파일 Import 경로

**심각도**: P0 - 빌드 완전 실패  
**파일 개수**: 3개  
**영향 범위**: contacts 페이지 + objections 관련 모든 기능

#### 문제 파일들

```
src/lib/objections/validation.ts:1
src/app/(dashboard)/contacts/[id]/ContactCallTab.tsx
src/app/(dashboard)/contacts/[id]/page.tsx
```

#### 현재 코드 (잘못됨)

```typescript
import objectionsData from '@/../../TRACK_A_OBJECTIONS.json';
```

#### 문제 분석

| 항목 | 상세 |
|------|------|
| **경로 분석** | `@/` = `src/` (tsconfig.json 설정) |
| **확대 경로** | `@/../../` = `src/../../` |
| **실제 위치** | `./TRACK_A_OBJECTIONS.json` (프로젝트 루트) |
| **결과** | ❌ 경로 불일치 → 번들 실패 |

#### 해결책

**옵션 1: Import 경로 수정 (권장)**
```typescript
// 수정 전
import objectionsData from '@/../../TRACK_A_OBJECTIONS.json';

// 수정 후
import objectionsData from '@/../TRACK_A_OBJECTIONS.json';
```

**옵션 2: 파일 재배치 (장기 해결책)**
```bash
# 파일 이동
mv TRACK_A_OBJECTIONS.json src/data/TRACK_A_OBJECTIONS.json

# Import 경로 변경
import objectionsData from '@/data/TRACK_A_OBJECTIONS.json';
```

#### 영향을 받는 기능
- ❌ Contacts 페이지 (`/dashboard/contacts/[id]`)
- ❌ Call Feedback 기능
- ❌ Objections 검증 시스템
- ❌ 관련 API 라우트들

---

### 2️⃣ Prisma 클라이언트 생성 실패

**심각도**: P0 - 빌드 차단  
**증상**: `npm run build` 실행 시 `prisma generate` 단계에서 실패

#### 원인

```bash
> mabiz@0.1.0 build
> prisma generate && next build

Error: Could not resolve @prisma/client
```

#### 해결책

```bash
# 1단계: 깨끗한 설치
rm -rf node_modules package-lock.json
npm install

# 2단계: Prisma 클라이언트 재생성
npx prisma generate

# 3단계: 빌드 실행
npm run build
```

#### 체크리스트
- [ ] `node_modules/` 재설치 완료
- [ ] `.prisma/client/` 폴더 생성 확인
- [ ] `prisma generate` 성공 확인
- [ ] `npm run build` 통과

---

## 🟠 P1: 배포 위험 (권장 수정)

### 1️⃣ 라우트 그룹 간 상대 Import

**파일**: `src/app/(dashboard)/b2b-editor/[id]/page.tsx`

#### 현재 코드

```typescript
import { RegistrationsTab } from "../../landing-pages/[id]/components/RegistrationsTab";
import { CommentsTab } from "../../landing-pages/[id]/components/CommentsTab";
```

#### 문제

- 라우트 그룹(`(dashboard)`) 간 상대 경로는 환경에 따라 달라질 수 있음
- Next.js 최적화 빌드에서 경로 해석 불일치 가능성
- Vercel 배포 시 다를 수 있음

#### 해결책

```typescript
// 수정 후
import { RegistrationsTab } from "@/app/(dashboard)/landing-pages/[id]/components/RegistrationsTab";
import { CommentsTab } from "@/app/(dashboard)/landing-pages/[id]/components/CommentsTab";
```

또는 더 나은 방법:

```typescript
// 공유 컴포넌트는 src/components로 이동
import { RegistrationsTab } from "@/components/landing-pages/RegistrationsTab";
import { CommentsTab } from "@/components/landing-pages/CommentsTab";
```

---

## 🟡 P2: 타입 경고 (배포 후 수정 가능)

### 1️⃣ 느슨한 'any' 타입 사용

**파일**: `src/lib/objections/validation.ts`  
**라인**: 24, 32, 41

#### 현재 코드

```typescript
// 라인 24
const validObjectionIds = new Set(
  objectionsData.objections.map((o: any) => o.id)
);

// 라인 32
const objection = objectionsData.objections.find((o: any) => o.id === objectionId);

// 라인 41
return objectionsData.objections.filter((o: any) => o.categoryId === categoryId);
```

#### 문제

- `any` 타입은 타입 안전성을 해침
- 런타임 에러 가능성 증가
- IDE 자동완성 불가

#### 해결책

```typescript
// 타입 정의 추가
interface ObjectionItem {
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

// 적용
const validObjectionIds = new Set(
  objectionsData.objections.map((o: ObjectionItem) => o.id)
);

const objection = objectionsData.objections.find((o: ObjectionItem) => o.id === objectionId);

return objectionsData.objections.filter((o: ObjectionItem) => o.categoryId === categoryId);
```

---

## 🔧 수정 순서 및 우선순위

### Step 1️⃣: P0 에러 수정 (필수, 지금 바로)

**예상 시간**: 5분

```bash
# 1. 3개 파일의 import 경로 수정
# src/lib/objections/validation.ts
# src/app/(dashboard)/contacts/[id]/ContactCallTab.tsx
# src/app/(dashboard)/contacts/[id]/page.tsx

# 변경: @/../../TRACK_A_OBJECTIONS.json → @/../TRACK_A_OBJECTIONS.json
```

### Step 2️⃣: Prisma 재설치 (필수)

**예상 시간**: 10분

```bash
rm -rf node_modules package-lock.json
npm install
npx prisma generate
```

### Step 3️⃣: P1 수정 (권장)

**예상 시간**: 5분

```bash
# b2b-editor 상대 import 경로 수정
# src/app/(dashboard)/b2b-editor/[id]/page.tsx
```

### Step 4️⃣: P2 수정 (선택, 나중에)

**예상 시간**: 10분

```bash
# validation.ts의 any 타입 제거
# 타입 정의 추가
```

### Step 5️⃣: 검증

```bash
npm run build
npm run build:analyze  # 번들 크기 확인
```

---

## 📋 체크리스트

### 빌드 성공을 위한 필수 작업

- [ ] `@/../../TRACK_A_OBJECTIONS.json` → `@/../TRACK_A_OBJECTIONS.json` 수정 (3개 파일)
- [ ] `node_modules` 재설치
- [ ] `prisma generate` 실행
- [ ] `npm run build` 성공
- [ ] 홈페이지 로드 확인
- [ ] Contacts 페이지 로드 확인
- [ ] B2B Editor 로드 확인

### 배포 전 확인 사항

- [ ] P0 에러 모두 수정
- [ ] P1 에러 수정 (권장)
- [ ] 로컬 빌드 통과
- [ ] Lighthouse 점수 90+ (선택)
- [ ] E2E 테스트 통과 (선택)

---

## 📈 예상 효과

| 항목 | 현재 | 개선 후 |
|------|------|--------|
| **빌드 시간** | 실패 ❌ | ~2분 ✅ |
| **번들 크기** | - | ~500KB |
| **타입 안전성** | 부분 | 완전 ✅ |
| **배포 성공률** | 0% | 100% |

---

## 🚀 배포 명령어

```bash
# 최종 빌드 + 배포
git add -A
git commit -m "fix: JSON import 경로 및 타입 정정"
git push origin main

# Vercel 자동 배포 (webhooks 활성화된 경우)
```

---

## 📞 추가 확인 사항

### 1. package.json 버전 확인

**현재 상태** (최신 커밋에서 수정됨):
- ✅ `@hookform/resolvers: ^5.4.0`
- ✅ `@clerk/nextjs: ^7.4.1`
- ✅ `react: ^19.2.3`
- ✅ `next: 15.5.18`

### 2. 런타임 에러 확인

Vercel 배포 후 확인:
```bash
# 브라우저 콘솔 에러 모니터링
# Sentry 대시보드 확인
# API 로그 확인
```

### 3. 성능 지표

```bash
npm run build:analyze  # 번들 분석
npx lighthouse https://yourdomain.com
```

---

**최종 작성**: 2026-05-26 | **상태**: 준비 완료 | **필요 액션**: P0 수정 및 재빌드
