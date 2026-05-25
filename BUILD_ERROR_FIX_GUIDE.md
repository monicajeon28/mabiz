# Vercel 빌드 실패 수정 가이드 (한번에 적용)

**난이도**: 🟢 매우 쉬움  
**소요 시간**: 10분  
**필수 작업**: Yes  
**배포 차단**: Yes

---

## 🎯 핵심 문제: JSON Import 경로 3곳 수정

### 파일 1: `src/lib/objections/validation.ts`

**위치**: 줄 1  
**문제**: `@/../../TRACK_A_OBJECTIONS.json` (잘못된 경로)

```typescript
// ❌ 수정 전 (줄 1)
import objectionsData from '@/../../TRACK_A_OBJECTIONS.json';

// ✅ 수정 후 (줄 1)
import objectionsData from '@/../TRACK_A_OBJECTIONS.json';
```

**이유**: 
- `@/` = `src/` 디렉토리
- `@/../../` = `src/../../` (프로젝트 루트 위로 나감) ❌
- `@/../` = `src/../` = 프로젝트 루트 ✅
- 파일 위치: `TRACK_A_OBJECTIONS.json` (루트)

---

### 파일 2: `src/app/(dashboard)/contacts/[id]/ContactCallTab.tsx`

**위치**: import 섹션 (대략 처음 20줄)  
**현재 코드 찾기**:
```typescript
import objectionsData from "@/../../TRACK_A_OBJECTIONS.json";
```

**수정**:
```typescript
import objectionsData from "@/../TRACK_A_OBJECTIONS.json";
```

---

### 파일 3: `src/app/(dashboard)/contacts/[id]/page.tsx`

**위치**: import 섹션 (대략 처음 50줄)  
**현재 코드 찾기**:
```typescript
import objectionsData from "@/../../TRACK_A_OBJECTIONS.json";
```

**수정**:
```typescript
import objectionsData from "@/../TRACK_A_OBJECTIONS.json";
```

---

## 🤖 자동 수정 명령어

### Option A: Bash/PowerShell 한 줄 수정

```bash
# 모든 잘못된 경로를 한번에 수정
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|@/../../TRACK_A_OBJECTIONS\.json|@/../TRACK_A_OBJECTIONS.json|g" {} \;
```

### Option B: PowerShell (Windows)

```powershell
# Windows에서 3개 파일 직접 수정
$files = @(
    "src\lib\objections\validation.ts",
    "src\app\(dashboard)\contacts\[id]\ContactCallTab.tsx",
    "src\app\(dashboard)\contacts\[id]\page.tsx"
)

foreach ($file in $files) {
    (Get-Content $file) -replace '@/../../TRACK_A_OBJECTIONS\.json', '@/../TRACK_A_OBJECTIONS.json' | Set-Content $file
}
```

---

## ✅ 검증 단계

### 1단계: 수정 확인

```bash
# 수정이 올바르게 적용되었는지 확인
grep -r "@/../TRACK_A_OBJECTIONS.json" src

# 잘못된 경로가 남아있지 않은지 확인 (아무것도 출력되면 안 됨)
grep -r "@/../../TRACK_A_OBJECTIONS.json" src
```

### 2단계: 의존성 재설치

```bash
# 완전 청소 설치 (권장)
rm -rf node_modules package-lock.json
npm install

# 또는 빠른 재설치
npm ci
```

### 3단계: Prisma 재생성

```bash
npx prisma generate
```

### 4단계: 빌드 테스트

```bash
npm run build
```

**기대 결과**:
```
> mabiz@0.1.0 build
> prisma generate && next build

✅ Prisma schema loaded
✅ Generated Prisma Client
✅ Creating an optimized production build
...
✅ Build successful
```

---

## 🔍 상세 확인 가이드

### 파일 1 수정 확인

```bash
head -5 src/lib/objections/validation.ts
```

**기대 출력**:
```
import objectionsData from '@/../TRACK_A_OBJECTIONS.json';

export interface ObjectionData {
  id: string;
  categoryId: string;
```

### 파일 2 수정 확인

```bash
grep -n "TRACK_A_OBJECTIONS" src/app/\(dashboard\)/contacts/\[id\]/ContactCallTab.tsx
```

**기대 출력**:
```
15:import objectionsData from "@/../TRACK_A_OBJECTIONS.json";
```

### 파일 3 수정 확인

```bash
grep -n "TRACK_A_OBJECTIONS" src/app/\(dashboard\)/contacts/\[id\]/page.tsx
```

**기대 출력**:
```
45:import objectionsData from "@/../TRACK_A_OBJECTIONS.json";
```

---

## 📊 수정 전후 비교

| 항목 | 수정 전 | 수정 후 |
|------|--------|--------|
| **Import 경로** | `@/../../TRACK_A_OBJECTIONS.json` | `@/../TRACK_A_OBJECTIONS.json` |
| **실제 경로 해석** | `src/../../TRACK_A_OBJECTIONS.json` ❌ | `src/../TRACK_A_OBJECTIONS.json` ✅ |
| **파일 찾음** | ❌ 실패 | ✅ 성공 |
| **빌드 상태** | 차단 | 통과 |
| **Vercel 배포** | 실패 | 성공 |

---

## 🚀 최종 배포 명령어

```bash
# 1. 수정 적용 (위의 자동 수정 명령어 사용)

# 2. 빌드 검증
npm run build

# 3. 성공 확인 후 커밋
git add -A
git commit -m "fix: JSON import 경로 수정 (@/../../ → @/../)"
git push origin main

# 4. Vercel 자동 배포 (webhooks 설정시)
```

---

## ❓ 자주 묻는 질문

### Q1: 왜 `@/../`를 사용하나요?

```
tsconfig.json 설정:
"paths": { "@/*": ["./src/*"] }

따라서:
@/file.ts → src/file.ts
@/../file.json → src/../file.json → ./file.json ✅
@/../../file.json → src/../../file.json (프로젝트 루트 위) ❌
```

### Q2: 파일을 `src/` 안으로 옮길 수 없나요?

가능합니다! 더 나은 방법:

```bash
# 1. 파일 이동
mkdir -p src/data
mv TRACK_A_OBJECTIONS.json src/data/

# 2. Import 수정 (3개 파일)
# @/../TRACK_A_OBJECTIONS.json → @/data/TRACK_A_OBJECTIONS.json

# 3. tsconfig.json 확인
# "resolveJsonModule": true 필요 (이미 있음)
```

### Q3: 수정 후에도 에러가 나면?

```bash
# 전체 청소 + 재설치
rm -rf node_modules .next dist
npm install
npx prisma generate
npm run build

# 그래도 안 되면
npm cache clean --force
npm install --legacy-peer-deps
```

### Q4: Vercel에서만 실패하는 이유?

로컬에서는 Node.js 경로 해석이 관대하지만, Vercel 빌드 환경은 엄격합니다:
- 상대 경로 해석이 정확함
- `@/` alias 처리가 Next.js 표준 따름
- 경로 캐싱으로 인한 모듈 찾기 실패 가능

---

## 📝 Git 커밋 메시지

```bash
git commit -m "fix: JSON import 경로 수정 (@/../../ → @/../) - Vercel 빌드 실패 해결"

# 또는 더 자세히:
git commit -m "fix: TRACK_A_OBJECTIONS.json import 경로 정정

- src/lib/objections/validation.ts: @/../../ → @/../
- src/app/(dashboard)/contacts/[id]/ContactCallTab.tsx: @/../../ → @/../
- src/app/(dashboard)/contacts/[id]/page.tsx: @/../../ → @/../

Resolves: Vercel 빌드 차단 에러"
```

---

## ✨ 완료 체크리스트

- [ ] 3개 파일의 import 경로 수정
- [ ] `npm install` 재실행
- [ ] `npx prisma generate` 실행
- [ ] `npm run build` 성공
- [ ] 로컬 테스트 통과
- [ ] Git commit + push
- [ ] Vercel 자동 배포 성공 확인

---

**다음 단계**: [FULL_BUILD_ERROR_AUDIT.md](./FULL_BUILD_ERROR_AUDIT.md)에서 P1, P2 항목 검토

**예상 배포 시간**: 5분 (수정 후)
