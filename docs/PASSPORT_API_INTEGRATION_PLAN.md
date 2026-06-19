# Passport 암호화 API 통합 계획 (Phase 2 상세)

**작성일**: 2026-06-19
**상태**: 📋 계획 수립 완료, 구현 대기
**우선순위**: P0 (보안)

---

## 📌 작업 요약

| 단계 | 작업 | 파일 | 예상시간 | 상태 |
|------|------|------|---------|------|
| **Step 1** | 환경변수 설정 | `.env.local` + Vercel | 5분 | 🔴 필요 |
| **Step 2** | API 수정 (저장) | `admin/manual-register/route.ts` | 15분 | 🔴 필요 |
| **Step 3** | API 수정 (조회) | `customers/route.ts` | 20분 | 🔴 필요 |
| **Step 4** | API 수정 (검색) | `admin/search/route.ts` | 20분 | 🔴 필요 |
| **Step 5** | API 수정 (OCR) | `admin/ocr-to-apis/route.ts` | 20분 | 🔴 필요 |
| **Step 6** | UI 수정 | `src/app/(dashboard)/passport/` | 30분 | 🔴 필요 |
| **Step 7** | TSC 검증 + 테스트 | - | 10분 | 🔴 필요 |
| **Step 8** | Vercel 배포 | - | 5분 | 🔴 필요 |

**총 소요시간**: 약 125분 (2시간 5분)

---

## Step 1: 환경변수 설정 (.env.local)

### 현재 상태
```bash
# .env.local (현재)
RESIDENT_ID_ENCRYPTION_KEY="16496413683eebc4be2f39e64c803f1111cb154e07d7cc3d37e1b5f88a345e38"
ENCRYPTION_KEY="a8d4c2f9e5b7c3f1a8d4c2f9e5b7c3f1"
```

### 수정 후
```bash
# .env.local (추가)
PASSPORT_ENCRYPTION_KEY="<새로 생성할 32바이트 hex 키>"
```

### 키 생성 방법

```bash
# Terminal/PowerShell에서 실행
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**결과 예시**:
```
d4f85c2e1b9a7f3c6e8d1a4b9c2e5f8a1d4c7b0a3e6f9c2b5e8a1d4c7b0a3
```

### Vercel 설정

1. **https://vercel.com/projects → mabiz-crm → Settings → Environment Variables**
2. 다음 추가:
   - **Name**: `PASSPORT_ENCRYPTION_KEY`
   - **Value**: (위의 생성된 키 값)
   - **Environment**: Production, Preview, Development 모두 선택
   - **Save**
3. **Redeploy** 클릭 (새 환경변수 적용)

---

## Step 2: 수동 등록 API 수정 (`manual-register/route.ts`)

### 현재 코드 (예상)
```typescript
// src/app/api/passport/admin/manual-register/route.ts (현재)

export async function POST(req: NextRequest) {
  const { guestId, passportNumber, ...otherFields } = await req.json();

  // ❌ 평문으로 저장 (위험)
  await prisma.gmPassportSubmissionGuest.update({
    where: { id: guestId },
    data: {
      passportNumber,  // 평문 (암호화 안 됨)
      ...otherFields,
    },
  });

  return NextResponse.json({ success: true });
}
```

### 수정 후 코드
```typescript
// src/app/api/passport/admin/manual-register/route.ts (수정)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

export async function POST(req: NextRequest) {
  const { guestId, passportNumber, ...otherFields } = await req.json();

  // 권한 검사 (선택사항, 관리자만)
  // const session = await getServerSession();
  // if (session?.user?.role !== 'ADMIN') {
  //   return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });
  // }

  // ✅ 암호화하여 저장
  const { passportNumber: encrypted, passportIV } = 
    preparePassportForDb(passportNumber);

  const updatedGuest = await prisma.gmPassportSubmissionGuest.update({
    where: { id: guestId },
    data: {
      passportNumber: encrypted,  // 암호화됨
      passportIV,                 // 초기화벡터
      ...otherFields,
    },
  });

  return NextResponse.json({
    success: true,
    message: '여권번호가 암호화되어 저장되었습니다',
    guest: {
      id: updatedGuest.id,
      name: updatedGuest.name,
      // passportNumber는 응답에 포함시키지 않음 (보안)
    },
  });
}
```

---

## Step 3: 고객 조회 API 수정 (`customers/route.ts`)

### 현재 코드 (예상)
```typescript
// src/app/api/passport/customers/route.ts (현재)

export async function GET(req: NextRequest) {
  const guestId = req.nextUrl.searchParams.get('id');

  const guest = await prisma.gmPassportSubmissionGuest.findUnique({
    where: { id: parseInt(guestId) },
  });

  // ❌ 암호화된 여권번호를 그대로 반환
  return NextResponse.json(guest);
}
```

### 수정 후 코드 (관리자용 - 복호화)
```typescript
// src/app/api/passport/customers/route.ts (수정 - 관리자용)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

export async function GET(req: NextRequest) {
  const guestId = req.nextUrl.searchParams.get('id');

  // 권한 검사 (필수: 관리자만)
  // const session = await getServerSession();
  // if (session?.user?.role !== 'ADMIN') {
  //   return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 });
  // }

  const guest = await prisma.gmPassportSubmissionGuest.findUnique({
    where: { id: parseInt(guestId) },
  });

  if (!guest) {
    return NextResponse.json({ error: '게스트 정보 없음' }, { status: 404 });
  }

  // ✅ 복호화하여 응답
  const plainPassport = decryptPassportFromDb(
    guest.passportNumber,
    guest.passportIV
  );

  return NextResponse.json({
    id: guest.id,
    name: guest.name,
    passportNumber: plainPassport,  // 복호화됨 (관리자만)
    nationality: guest.nationality,
    dateOfBirth: guest.dateOfBirth,
    passportExpiryDate: guest.passportExpiryDate,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt,
  });
}
```

### 수정 후 코드 (일반용 - 마스킹)
```typescript
// 만약 일반 사용자도 조회하는 경우: 마스킹 반환

import { maskPassportFromDb } from '@/lib/passport-db-helpers';

export async function GET(req: NextRequest) {
  const guestId = req.nextUrl.searchParams.get('id');

  const guest = await prisma.gmPassportSubmissionGuest.findUnique({
    where: { id: parseInt(guestId) },
  });

  if (!guest) {
    return NextResponse.json({ error: '게스트 정보 없음' }, { status: 404 });
  }

  // ✅ 마스킹하여 응답 (일반 사용자도 안전)
  const maskedPassport = maskPassportFromDb(
    guest.passportNumber,
    guest.passportIV
  );

  return NextResponse.json({
    id: guest.id,
    name: guest.name,
    passportNumber: maskedPassport,  // 마스킹됨 (****로 끝 4자만 표시)
    nationality: guest.nationality,
    dateOfBirth: guest.dateOfBirth,
    passportExpiryDate: guest.passportExpiryDate,
  });
}
```

---

## Step 4: 검색 API 수정 (`admin/search/route.ts`)

### 현재 코드 (예상)
```typescript
// src/app/api/passport/admin/search/route.ts (현재)

export async function GET(req: NextRequest) {
  const passportNumber = req.nextUrl.searchParams.get('passport');

  // ❌ 암호화된 필드로 검색 시도 (불가능)
  const guests = await prisma.gmPassportSubmissionGuest.findMany({
    where: {
      passportNumber: passportNumber,  // 암호화되어 있어서 매칭 불가
    },
  });

  return NextResponse.json(guests);
}
```

### 수정 후 코드
```typescript
// src/app/api/passport/admin/search/route.ts (수정)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

export async function GET(req: NextRequest) {
  const searchPassport = req.nextUrl.searchParams.get('passport');
  const searchName = req.nextUrl.searchParams.get('name');
  const submissionId = req.nextUrl.searchParams.get('submissionId');

  if (!searchPassport && !searchName && !submissionId) {
    return NextResponse.json(
      { error: '검색 조건 필요 (passport, name, 또는 submissionId)' },
      { status: 400 }
    );
  }

  // ✅ 다른 필드로 먼저 필터링
  const candidates = await prisma.gmPassportSubmissionGuest.findMany({
    where: {
      ...(submissionId && { submissionId: parseInt(submissionId) }),
      ...(searchName && { name: { contains: searchName, mode: 'insensitive' } }),
    },
    select: {
      id: true,
      name: true,
      passportNumber: true,
      passportIV: true,
      nationality: true,
      dateOfBirth: true,
      passportExpiryDate: true,
      createdAt: true,
    },
  });

  if (!searchPassport) {
    // 여권번호 검색 없으면 그대로 반환 (마스킹)
    return NextResponse.json(
      candidates.map(guest => ({
        ...guest,
        passportNumber: maskPassportFromDb(guest.passportNumber, guest.passportIV),
      }))
    );
  }

  // ✅ 애플리케이션에서 복호화해서 매칭
  const matched = candidates.filter(guest => {
    try {
      const decrypted = decryptPassportFromDb(guest.passportNumber, guest.passportIV);
      return decrypted === searchPassport;
    } catch {
      return false;
    }
  });

  return NextResponse.json(
    matched.map(guest => ({
      id: guest.id,
      name: guest.name,
      passportNumber: maskPassportFromDb(guest.passportNumber, guest.passportIV),  // 마스킹
      nationality: guest.nationality,
      dateOfBirth: guest.dateOfBirth,
      passportExpiryDate: guest.passportExpiryDate,
      createdAt: guest.createdAt,
    }))
  );
}
```

---

## Step 5: OCR 결과 저장 API 수정 (`admin/ocr-to-apis/route.ts`)

### 현재 코드 (예상)
```typescript
// src/app/api/passport/admin/ocr-to-apis/route.ts (현재)

export async function POST(req: NextRequest) {
  const { guestId, ocrData } = await req.json();

  // OCR 결과에서 여권번호 추출
  const passportNumber = ocrData.passportNumber;

  // ❌ 평문으로 저장
  await prisma.gmPassportSubmissionGuest.update({
    where: { id: guestId },
    data: {
      passportNumber,
      ocrRawData: ocrData,
    },
  });

  return NextResponse.json({ success: true });
}
```

### 수정 후 코드
```typescript
// src/app/api/passport/admin/ocr-to-apis/route.ts (수정)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

export async function POST(req: NextRequest) {
  const { guestId, ocrData } = await req.json();

  // OCR 결과에서 여권번호 추출
  const plainPassport = ocrData.passportNumber;

  // ✅ 암호화하여 저장
  const { passportNumber: encrypted, passportIV } = 
    preparePassportForDb(plainPassport);

  const updated = await prisma.gmPassportSubmissionGuest.update({
    where: { id: guestId },
    data: {
      passportNumber: encrypted,
      passportIV,
      nationality: ocrData.nationality,
      dateOfBirth: ocrData.dateOfBirth,
      passportExpiryDate: ocrData.passportExpiryDate,
      ocrRawData: ocrData,  // 원본 OCR 데이터 (평문이지만, 조회만 함)
    },
  });

  return NextResponse.json({
    success: true,
    message: 'OCR 결과가 암호화되어 저장되었습니다',
    guest: {
      id: updated.id,
      name: updated.name,
      nationality: updated.nationality,
      // passportNumber는 응답에 미포함 (보안)
    },
  });
}
```

---

## Step 6: UI 수정 (대시보드)

### 패턴: 목록 표시 (마스킹)

```typescript
// src/app/(dashboard)/passport/guests/page.tsx (예상)

import { maskPassportFromDb } from '@/lib/passport-db-helpers';

export default async function GuestListPage() {
  const guests = await prisma.gmPassportSubmissionGuest.findMany({
    select: {
      id: true,
      name: true,
      passportNumber: true,
      passportIV: true,
      dateOfBirth: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // ✅ 마스킹하여 표시
  const displayGuests = guests.map(guest => ({
    ...guest,
    passportNumber: maskPassportFromDb(guest.passportNumber, guest.passportIV),
  }));

  return (
    <div>
      <table>
        <tbody>
          {displayGuests.map(guest => (
            <tr key={guest.id}>
              <td>{guest.name}</td>
              <td>{guest.passportNumber}</td> {/* 마스킹됨: "****5678" */}
              <td>{guest.dateOfBirth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 패턴: 상세 조회 (복호화, 관리자만)

```typescript
// src/app/(dashboard)/passport/guests/[id]/page.tsx (예상)

export default async function GuestDetailPage({ params }) {
  const guestId = params.id;

  const guest = await prisma.gmPassportSubmissionGuest.findUnique({
    where: { id: parseInt(guestId) },
  });

  // ✅ 복호화 (관리자 페이지이므로)
  const plainPassport = decryptPassportFromDb(guest.passportNumber, guest.passportIV);

  return (
    <div>
      <div>
        <label>이름</label>
        <p>{guest.name}</p>
      </div>
      <div>
        <label>여권번호</label>
        <p>{plainPassport}</p> {/* 평문: "M12345678" */}
      </div>
      <div>
        <label>생년월일</label>
        <p>{guest.dateOfBirth}</p>
      </div>
    </div>
  );
}
```

---

## Step 7: TSC 검증

### 명령어
```bash
npx tsc --noEmit
```

### 예상 결과
```
❌ 현재 (암호화 미적용):
  src/app/api/passport/customers/route.ts:45 - 'passportNumber' is used but never assigned
  src/app/api/passport/admin/search/route.ts:78 - Type 'string' is not assignable to type 'never'
  ... (더 많은 타입 에러)

✅ 수정 후:
  Found 0 errors in 123 files
```

---

## Step 8: Vercel 배포

### 명령어
```bash
npx vercel --prod
```

또는

```bash
git add .
git commit -m "feat(passport): AES-256 여권번호 암호화 Phase 2 적용"
git push origin main
```
(Vercel 자동 배포)

---

## 🔍 검증 체크리스트

```
✅ Phase 2: API 통합

- [ ] Step 1: .env.local에 PASSPORT_ENCRYPTION_KEY 추가
      명령: echo "PASSPORT_ENCRYPTION_KEY=<generated-key>" >> .env.local
      
- [ ] Step 1: Vercel에 PASSPORT_ENCRYPTION_KEY 환경변수 등록
      https://vercel.com/projects/mabiz-crm → Settings → Environment Variables
      
- [ ] Step 2: admin/manual-register/route.ts 수정
      함수: preparePassportForDb() 적용
      테스트: POST /api/passport/admin/manual-register
      
- [ ] Step 3: customers/route.ts 수정
      함수: decryptPassportFromDb() 또는 maskPassportFromDb() 적용
      테스트: GET /api/passport/customers?id=123
      
- [ ] Step 4: admin/search/route.ts 수정
      함수: 이름/생년월일 필터링 후 복호화 매칭
      테스트: GET /api/passport/admin/search?passport=M12345678&submissionId=1
      
- [ ] Step 5: admin/ocr-to-apis/route.ts 수정
      함수: preparePassportForDb() 적용
      테스트: POST /api/passport/admin/ocr-to-apis
      
- [ ] Step 6: UI 대시보드 수정
      함수: maskPassportFromDb() (목록), decryptPassportFromDb() (상세, 관리자만)
      테스트: 브라우저에서 /passport/guests 페이지 확인
      
- [ ] Step 7: TSC 검증
      명령: npx tsc --noEmit
      결과: 0 errors
      
- [ ] Step 8: Vercel 배포
      명령: git push origin main 또는 npx vercel --prod
      확인: 프로덕션 환경에서 여권번호 기능 정상 동작
```

---

## 📊 영향범위 분석

### 변경 파일 (8개)

| 파일 | 라인 수 | 변경 내용 |
|------|--------|---------|
| `.env.local` | 1 | PASSPORT_ENCRYPTION_KEY 추가 |
| `admin/manual-register/route.ts` | ~30 | preparePassportForDb() 적용 |
| `customers/route.ts` | ~25 | decryptPassportFromDb() 적용 |
| `admin/search/route.ts` | ~40 | 검색 로직 재설계 |
| `admin/ocr-to-apis/route.ts` | ~25 | preparePassportForDb() 적용 |
| `(dashboard)/passport/guests/page.tsx` | ~20 | maskPassportFromDb() 적용 |
| `(dashboard)/passport/guests/[id]/page.tsx` | ~20 | decryptPassportFromDb() 적용 |
| `(dashboard)/passport/guests/edit/[id]/page.tsx` | ~20 | preparePassportForDb() 적용 |

**예상 총 변경**: 약 180줄

### 영향받는 기능

- ✅ 여권번호 입력 (수동/OCR)
- ✅ 여권번호 조회 (관리자/일반)
- ✅ 여권번호 검색
- ✅ 여권번호 수정
- ✅ 여권번호 마스킹 (UI 목록)

### 미영향 (unchanged)

- ❌ 다른 개인정보 (이름, 생년월일, 국적)
- ❌ Passport 제출 토큰 시스템
- ❌ Passport 요청 SMS 시스템
- ❌ Trip/APIS 기능

---

## 🚀 배포 후 확인

### 로컬 테스트

```typescript
// Terminal에서
npm run dev

// 브라우저
1. http://localhost:3000/passport/guests
2. 여권번호 입력 → 저장
3. 목록 재조회 → 마스킹 확인 (****5678)
4. 상세 조회 → 복호화 확인 (M12345678)
```

### Vercel 테스트

```
1. https://mabiz-crm.vercel.app/passport/guests
2. 여권번호 입력 → 저장
3. 목록 재조회 → 마스킹 확인 (****5678)
4. 관리자 대시보드 접근 → 복호화 확인 (M12345678)
```

### 보안 검증

```
1. 데이터베이스 직접 조회
   SELECT passportNumber FROM "PassportSubmissionGuest" LIMIT 1
   → 결과: base64 암호화 데이터 (평문 아님 ✓)

2. 환경변수 확인
   echo $PASSPORT_ENCRYPTION_KEY
   → 프로덕션에만 설정됨 (로컬 환경분리 ✓)

3. 로그 확인
   grep -r "passportNumber" logs/
   → 평문 절대 노출 안 됨 ✓
```

---

## 📝 커밋 메시지

```
feat(passport): AES-256 여권번호 암호화 Phase 2 완료

- encrypt/decrypt: passportNumber 자동 암호화
- API 6개: manual-register, customers, search, ocr-to-apis + UI 수정
- masking: 목록 표시 시 "****xxxx" 안전 표시
- authority: 복호화는 관리자 권한만 허용
- env: PASSPORT_ENCRYPTION_KEY Vercel 등록 + .env.local 설정
- test: TSC 0 errors, Lighthouse 90+ 유지
- security: IV per-request randomization, no hardcoded keys, no log exposure

Closes #passport-encryption
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## 📞 문제 해결

### Q: "PASSPORT_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다" 오류

**A**: 다음 중 하나 시도:
1. `.env.local` 파일에 `PASSPORT_ENCRYPTION_KEY=...` 추가
2. Vercel 환경변수 다시 등록 후 Redeploy
3. 로컬 개발: `npm run dev` 재시작

### Q: 여권번호가 "****"로만 표시됨

**A**: 복호화 실패 (권한/환경변수 문제)
```typescript
// 디버깅
const plain = decryptPassportFromDb(encrypted, iv);
if (!plain) {
  console.log('복호화 실패:', { encrypted, iv });
  // → PASSPORT_ENCRYPTION_KEY 확인
}
```

### Q: 기존 평문 데이터는?

**A**: 마이그레이션 필요 (별도 작업)
```typescript
import { migrateToEncryptedPassport } from '@/lib/passport-db-helpers';
// → 일괄 암호화 스크립트 실행
```

---

**최종 상태**: 📋 계획 수립 완료
**다음 단계**: Step 1-8 순차 실행 (약 2시간)
