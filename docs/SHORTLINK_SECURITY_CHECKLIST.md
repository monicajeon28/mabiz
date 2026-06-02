# ShortLink 보안 강화 체크리스트 (빠른 참조)

**우선순위**: P1-SEC | **예상 시간**: 4-6시간 | **담당**: 풀스택 엔지니어

---

## 🎯 핵심 3가지

| # | 작업 | 파일 | 상태 |
|---|------|------|------|
| 1️⃣ | **Schema에 `isPublic` 필드 추가** | `prisma/schema.prisma` (Line 1630) | ⏳ |
| 2️⃣ | **Route 권한 검증 추가** | `src/app/l/[code]/route.ts` | ⏳ |
| 3️⃣ | **UI에서 공개/비공개 토글** | `src/app/(dashboard)/...` | ⏳ |

---

## 📋 Phase별 체크리스트

### Phase 1: Schema & 마이그레이션 (30분)

```bash
# 1. schema.prisma 수정 (Line 1640 뒤에 추가)
isPublic       Boolean          @default(true)

# 2. 마이그레이션 생성
npx prisma migrate dev --name add_shortlink_is_public

# 3. 마이그레이션 확인
cat prisma/migrations/20260602xxxxxx_add_shortlink_is_public/migration.sql

# 4. 데이터베이스 적용
npx prisma migrate deploy

# 5. 타입스크립트 검증
npx tsc --noEmit
```

**체크**:
- [ ] `isPublic Boolean @default(true)` 추가됨
- [ ] `npx prisma validate` 성공
- [ ] 마이그레이션 파일 생성됨
- [ ] `SELECT isPublic FROM shortlink LIMIT 1` 컬럼 존재 확인

---

### Phase 2: API 엔드포인트 (1시간)

#### 2-1: GET /l/[code] Route

**파일**: `src/app/l/[code]/route.ts`

```typescript
// 추가할 코드
if (!link.isPublic) {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx || ctx.organizationId !== link.organizationId) {
    console.warn(`[ShortLink Access Denied] code=${code}`);
    return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 301 });
  }
}
```

**체크**:
- [ ] `isPublic` 필드 조회 추가
- [ ] 비공개 링크 권한 검증 로직 추가
- [ ] `npx tsc --noEmit` 성공

#### 2-2: POST /api/links (생성)

**파일**: `src/app/api/links/route.ts`

```typescript
// 추가할 코드
const link = await prisma.shortLink.create({
  data: {
    // ... 기타 필드
    isPublic: body.isPublic ?? true,  // ← 추가
  },
});
```

**체크**:
- [ ] `isPublic: body.isPublic ?? true` 추가
- [ ] API 테스트: `POST /api/links` (isPublic=false)

#### 2-3: PATCH /api/links/{id} (수정 - 신규)

**파일**: `src/app/api/links/{id}/route.ts` (신규)

```typescript
// PATCH 엔드포인트 새로 생성
export async function PATCH(req, { params }) {
  // 권한 검증 → organizationId 일치 확인
  // isPublic 필드 업데이트
}
```

**체크**:
- [ ] 권한 검증 (organizationId 일치)
- [ ] `isPublic` 필드 업데이트
- [ ] API 테스트: `PATCH /api/links/{id}` (isPublic=false)

#### 2-4: GET /api/links (목록)

**파일**: `src/app/api/links/route.ts`

```typescript
// 수정: isPublic 필드 반환 추가
select: {
  // ... 기타 필드
  isPublic: true,  // ← 추가
}
```

**체크**:
- [ ] `organizationId` 필터링 확인
- [ ] `isPublic` 필드 반환
- [ ] API 테스트: `GET /api/links`

---

### Phase 3: UI 개선 (1시간)

#### 3-1: ShortLink 생성 모달

**파일**: `src/app/(dashboard)/landing-pages/components/CreateShortLinkModal.tsx`

```tsx
// 추가할 필드
const [isPublic, setIsPublic] = useState(true);

// 체크박스 추가
<Checkbox
  id="isPublic"
  checked={isPublic}
  onCheckedChange={(checked) => setIsPublic(!!checked)}
/>
<Label htmlFor="isPublic">공개 (모든 사용자가 접근 가능)</Label>

// API 호출에 포함
body: JSON.stringify({ targetUrl, title, isPublic })
```

**체크**:
- [ ] Checkbox 컴포넌트 추가
- [ ] `isPublic` 상태 관리
- [ ] API 호출에 `isPublic` 포함

#### 3-2: ShortLink 목록

**파일**: `src/app/(dashboard)/landing-pages/components/ShortLinksList.tsx`

```tsx
// 공개/비공개 토글 버튼 추가
<button
  onClick={() => togglePublic(link.id, !link.isPublic)}
  className={link.isPublic ? 'bg-green-100' : 'bg-red-100'}
>
  {link.isPublic ? '공개' : '비공개'}
</button>

// 토글 함수
const togglePublic = async (linkId, newValue) => {
  await fetch(`/api/links/${linkId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublic: newValue })
  });
}
```

**체크**:
- [ ] `isPublic` 필드 표시
- [ ] 토글 버튼 구현
- [ ] PATCH API 호출

---

### Phase 4: 테스트 (1시간)

#### 4-1: 단위 테스트

```bash
# 테스트 파일 생성
src/app/l/[code]/route.test.ts

# 테스트 케이스 4개
✅ 공개 링크 접근 성공
✅ 비공개 링크 + 권한 접근 성공
❌ 비공개 링크 + 권한 없음 거부
❌ 비활성 링크 거부
```

**체크**:
- [ ] 테스트 파일 생성
- [ ] `npm test -- src/app/l/[code]/route.test.ts` 패스
- [ ] 커버리지 > 90%

#### 4-2: 통합 테스트

```bash
# 개발 서버 시작
npm run dev

# 공개 링크 (누구나)
curl -L http://localhost:3000/l/{code}
# 예상: 301 리다이렉트

# 비공개 링크 + 권한
curl -L -H "Authorization: Bearer <token>" http://localhost:3000/l/{code}
# 예상: 301 리다이렉트

# 비공개 링크 + 권한 없음
curl -L -H "Authorization: Bearer <other-token>" http://localhost:3000/l/{code}
# 예상: https://www.cruisedot.co.kr로 리다이렉트
```

**체크**:
- [ ] 공개 링크: 성공 (301)
- [ ] 비공개 링크 + 권한: 성공 (301)
- [ ] 비공개 링크 + 권한 없음: 거부 (301 → Cruisedot)

---

### Phase 5: 배포 (30분)

```bash
# 1. 변경사항 커밋
git add prisma/ src/
git commit -m "feat(security): add isPublic field to ShortLink + RBAC (P1-SEC)"

# 2. 마이그레이션 상태 확인
npx prisma migrate status

# 3. 푸시
git push origin main

# 4. Vercel 배포 자동 실행 (대기)

# 5. 배포 후 DB 마이그레이션
npx prisma migrate deploy --skip-generate

# 6. 프로덕션 테스트
curl https://yourdomain.com/l/{code}
```

**체크**:
- [ ] 커밋 완료
- [ ] Vercel 배포 성공 (배포 상태 확인)
- [ ] 데이터베이스 마이그레이션 적용됨
- [ ] 프로덕션에서 링크 접근 테스트

---

## 🚨 주의사항

### 1. 마이그레이션 롤백

```bash
# 롤백 필요 시
npx prisma migrate resolve --rolled-back 20260602xxxxxx_add_shortlink_is_public
```

### 2. 기존 데이터

- 모든 기존 ShortLink는 자동으로 `isPublic=true` (공개)로 설정됨
- 수동으로 비공개로 변경 필요

### 3. API 응답

```json
// 변경 전
{ "id": "1", "code": "abc123", "isActive": true }

// 변경 후
{ "id": "1", "code": "abc123", "isActive": true, "isPublic": true }
```

---

## ✅ 완료 확인

### 모두 완료 시 확인 사항

- [ ] `npx tsc --noEmit` → 에러 0개
- [ ] `npm test` → 모든 테스트 패스
- [ ] 프로덕션 배포 완료
- [ ] ShortLink 공개/비공개 토글 테스트 완료
- [ ] 권한 없는 비공개 링크 접근 거부 확인

---

## 📞 troubleshoot

### TypeScript 에러: "isPublic does not exist on type 'ShortLink'"

```bash
# Prisma 클라이언트 재생성
npx prisma generate

# tsconfig 업데이트
npx tsc --noEmit
```

### 마이그레이션 충돌

```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 강제 적용 (주의)
npx prisma migrate deploy --skip-generate
```

### 프로덕션 배포 실패

```bash
# 1. 로컬에서 마이그레이션 테스트
npx prisma migrate deploy --preview-feature

# 2. 데이터베이스 백업 후 재시도
npx prisma migrate deploy
```

---

**작성일**: 2026-06-02  
**우선순위**: P1-SEC  
**예상 완료**: 2026-06-03  
**담당자**: 풀스택 엔지니어 / 보안 팀
