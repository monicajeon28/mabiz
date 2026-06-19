# Passport 암호화 빠른 참조 (Quick Reference)

**작성일**: 2026-06-19
**목적**: 복사-붙여넣기 가능한 코드 샘플

---

## 🔐 암호화 함수 (src/lib/passport-encryption.ts)

### Import
```typescript
import {
  encryptPassport,      // 암호화
  decryptPassport,      // 복호화
  maskPassport,         // 마스킹
  generateEncryptionKey, // 키 생성 (개발용)
  validateEncryptionKey  // 키 검증
} from '@/lib/passport-encryption';
```

### 사용법

#### 1️⃣ 암호화 (저장 전)
```typescript
const plaintext = 'M12345678';
const { encryptedData, iv } = encryptPassport(plaintext);
// 결과:
// {
//   encryptedData: "BjKL9mNpQr2s...", (base64)
//   iv: "xYzAB1cDeFg..."          (base64)
// }

// DB에 저장
await prisma.gmPassportSubmissionGuest.update({
  where: { id: 1 },
  data: {
    passportNumber: encryptedData,
    passportIV: iv,
  },
});
```

#### 2️⃣ 복호화 (조회 후)
```typescript
const decrypted = decryptPassport(encryptedData, iv);
console.log(decrypted); // "M12345678"
```

#### 3️⃣ 마스킹 (UI용)
```typescript
const masked = maskPassport('M12345678');
console.log(masked); // "****5678"
```

#### 4️⃣ 키 검증
```typescript
const isValid = validateEncryptionKey();
if (!isValid) {
  throw new Error('PASSPORT_ENCRYPTION_KEY 환경변수 확인 필요');
}
```

---

## 🗄️ DB 헬퍼 함수 (src/lib/passport-db-helpers.ts)

### Import
```typescript
import {
  preparePassportForDb,    // 저장 전 암호화
  decryptPassportFromDb,   // DB에서 조회 후 복호화
  maskPassportFromDb,      // DB에서 조회 후 마스킹
  passportSelectFields,    // SELECT 필드 힌트
  migrateToEncryptedPassport // 대량 암호화 (마이그레이션)
} from '@/lib/passport-db-helpers';
```

### 사용법

#### 1️⃣ 저장 (preparePassportForDb)
```typescript
// 가장 간단한 방법
const plainPassport = req.body.passportNumber;
const { passportNumber, passportIV } = preparePassportForDb(plainPassport);

await prisma.gmPassportSubmissionGuest.update({
  where: { id: guestId },
  data: {
    passportNumber,  // 자동 암호화됨
    passportIV,
  },
});
```

#### 2️⃣ 조회 후 복호화 (decryptPassportFromDb)
```typescript
const guest = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: 1 },
});

const plainPassport = decryptPassportFromDb(
  guest.passportNumber,
  guest.passportIV
);
console.log(plainPassport); // "M12345678"
```

#### 3️⃣ 조회 후 마스킹 (maskPassportFromDb)
```typescript
const guest = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: 1 },
});

const maskedPassport = maskPassportFromDb(
  guest.passportNumber,
  guest.passportIV
);
console.log(maskedPassport); // "****5678"
```

#### 4️⃣ SELECT 필드 (passportSelectFields)
```typescript
const guest = await prisma.gmPassportSubmissionGuest.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    name: true,
    ...passportSelectFields,  // { passportNumber: true, passportIV: true }
    dateOfBirth: true,
  },
});
```

#### 5️⃣ 대량 암호화 (마이그레이션)
```typescript
const plainGuests = await prisma.gmPassportSubmissionGuest.findMany({
  where: {
    passportNumber: { not: null },
  },
});

const updates = plainGuests.map(guest => {
  const { passportNumber, passportIV } = 
    migrateToEncryptedPassport(guest.passportNumber);

  return prisma.gmPassportSubmissionGuest.update({
    where: { id: guest.id },
    data: { passportNumber, passportIV },
  });
});

await Promise.all(updates);
```

---

## 🚀 API 라우트 템플릿

### 저장 (POST)
```typescript
// src/app/api/passport/admin/manual-register/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

export async function POST(req: NextRequest) {
  try {
    const { guestId, passportNumber } = await req.json();

    const { passportNumber: encrypted, passportIV } = 
      preparePassportForDb(passportNumber);

    const guest = await prisma.gmPassportSubmissionGuest.update({
      where: { id: guestId },
      data: {
        passportNumber: encrypted,
        passportIV,
      },
    });

    return NextResponse.json({
      success: true,
      guest: {
        id: guest.id,
        name: guest.name,
      },
    });
  } catch (error) {
    console.error('여권 저장 실패:', error);
    return NextResponse.json(
      { error: '여권번호 저장 실패' },
      { status: 500 }
    );
  }
}
```

### 조회 - 복호화 (GET, 관리자용)
```typescript
// src/app/api/passport/customers/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

export async function GET(req: NextRequest) {
  try {
    const guestId = parseInt(req.nextUrl.searchParams.get('id') || '0');

    const guest = await prisma.gmPassportSubmissionGuest.findUnique({
      where: { id: guestId },
    });

    if (!guest) {
      return NextResponse.json(
        { error: '게스트 정보 없음' },
        { status: 404 }
      );
    }

    const plainPassport = decryptPassportFromDb(
      guest.passportNumber,
      guest.passportIV
    );

    return NextResponse.json({
      id: guest.id,
      name: guest.name,
      passportNumber: plainPassport, // 복호화됨
      dateOfBirth: guest.dateOfBirth,
    });
  } catch (error) {
    console.error('여권 조회 실패:', error);
    return NextResponse.json(
      { error: '여권번호 조회 실패' },
      { status: 500 }
    );
  }
}
```

### 조회 - 마스킹 (GET, 일반용)
```typescript
// src/app/api/passport/guests/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { maskPassportFromDb } from '@/lib/passport-db-helpers';

export async function GET(req: NextRequest, { params }) {
  try {
    const guestId = parseInt(params.id || '0');

    const guest = await prisma.gmPassportSubmissionGuest.findUnique({
      where: { id: guestId },
    });

    if (!guest) {
      return NextResponse.json(
        { error: '게스트 정보 없음' },
        { status: 404 }
      );
    }

    const maskedPassport = maskPassportFromDb(
      guest.passportNumber,
      guest.passportIV
    );

    return NextResponse.json({
      id: guest.id,
      name: guest.name,
      passportNumber: maskedPassport, // 마스킹됨
      dateOfBirth: guest.dateOfBirth,
    });
  } catch (error) {
    console.error('여권 조회 실패:', error);
    return NextResponse.json(
      { error: '여권번호 조회 실패' },
      { status: 500 }
    );
  }
}
```

### 검색 (GET, 복호화 매칭)
```typescript
// src/app/api/passport/admin/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

export async function GET(req: NextRequest) {
  try {
    const searchPassport = req.nextUrl.searchParams.get('passport');
    const searchName = req.nextUrl.searchParams.get('name');

    // 1️⃣ 이름으로 먼저 필터링
    const candidates = await prisma.gmPassportSubmissionGuest.findMany({
      where: {
        ...(searchName && { name: { contains: searchName, mode: 'insensitive' } }),
      },
      select: {
        id: true,
        name: true,
        passportNumber: true,
        passportIV: true,
        dateOfBirth: true,
      },
    });

    // 2️⃣ 여권번호로 복호화 매칭
    const matched = searchPassport
      ? candidates.filter(guest => {
          try {
            const decrypted = decryptPassportFromDb(
              guest.passportNumber,
              guest.passportIV
            );
            return decrypted === searchPassport;
          } catch {
            return false;
          }
        })
      : candidates;

    return NextResponse.json(matched);
  } catch (error) {
    console.error('여권 검색 실패:', error);
    return NextResponse.json(
      { error: '검색 실패' },
      { status: 500 }
    );
  }
}
```

---

## 🎨 UI 컴포넌트 템플릿

### 목록 표시 (마스킹)
```typescript
// src/app/(dashboard)/passport/guests/page.tsx

import { maskPassportFromDb } from '@/lib/passport-db-helpers';

export default async function GuestListPage() {
  const guests = await prisma.gmPassportSubmissionGuest.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">게스트 목록</h1>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 border">이름</th>
            <th className="p-3 border">여권번호</th>
            <th className="p-3 border">생년월일</th>
            <th className="p-3 border">등록일</th>
          </tr>
        </thead>
        <tbody>
          {guests.map(guest => (
            <tr key={guest.id}>
              <td className="p-3 border">{guest.name}</td>
              <td className="p-3 border">
                {maskPassportFromDb(guest.passportNumber, guest.passportIV)}
              </td>
              <td className="p-3 border">{guest.dateOfBirth?.toLocaleDateString()}</td>
              <td className="p-3 border">{guest.createdAt.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 상세 조회 (복호화, 관리자만)
```typescript
// src/app/(dashboard)/passport/guests/[id]/page.tsx

import { decryptPassportFromDb } from '@/lib/passport-db-helpers';
import { redirect } from 'next/navigation';

export default async function GuestDetailPage({ params }) {
  // TODO: 관리자 권한 검사
  // if (!session?.user?.isAdmin) redirect('/');

  const guest = await prisma.gmPassportSubmissionGuest.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!guest) {
    redirect('/passport/guests');
  }

  const plainPassport = decryptPassportFromDb(
    guest.passportNumber,
    guest.passportIV
  );

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{guest.name} - 상세정보</h1>
      
      <div className="border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700">
            여권번호
          </label>
          <p className="text-lg font-mono bg-gray-50 p-3 rounded mt-1">
            {plainPassport}
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">
            국적
          </label>
          <p className="text-lg p-3">{guest.nationality}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">
            생년월일
          </label>
          <p className="text-lg p-3">{guest.dateOfBirth?.toLocaleDateString()}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700">
            여권 만료일
          </label>
          <p className="text-lg p-3">{guest.passportExpiryDate?.toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
```

### 폼 입력 (암호화 저장)
```typescript
// src/app/(dashboard)/passport/guests/edit/[id]/page.tsx

'use client';

import { useState } from 'react';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

export default function EditGuestPage({ params }) {
  const [passportNumber, setPassportNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/passport/admin/manual-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: parseInt(params.id),
          passportNumber, // 평문 (API에서 암호화)
        }),
      });

      if (res.ok) {
        alert('저장되었습니다');
        setPassportNumber('');
      } else {
        alert('저장 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">여권번호 입력</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">
            여권번호 (예: M12345678)
          </label>
          <input
            type="text"
            placeholder="여권번호"
            value={passportNumber}
            onChange={e => setPassportNumber(e.target.value.toUpperCase())}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !passportNumber}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
```

---

## ⚙️ 환경변수 설정

### .env.local (로컬 개발)

```bash
# 키 생성:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

PASSPORT_ENCRYPTION_KEY="d4f85c2e1b9a7f3c6e8d1a4b9c2e5f8a1d4c7b0a3e6f9c2b5e8a1d4c7b0a3"
```

### Vercel 환경변수

```bash
# Settings → Environment Variables → Add
# 이름: PASSPORT_ENCRYPTION_KEY
# 값: d4f85c2e1b9a7f3c6e8d1a4b9c2e5f8a1d4c7b0a3e6f9c2b5e8a1d4c7b0a3
# 환경: Production, Preview, Development (모두 선택)
```

---

## 🧪 테스트 코드

### 단위 테스트
```typescript
// src/lib/__tests__/passport-encryption.test.ts

import { encryptPassport, decryptPassport, maskPassport } from '@/lib/passport-encryption';

describe('Passport Encryption', () => {
  it('암호화 후 복호화', () => {
    const original = 'M12345678';
    const { encryptedData, iv } = encryptPassport(original);
    const decrypted = decryptPassport(encryptedData, iv);
    expect(decrypted).toBe(original);
  });

  it('마스킹', () => {
    expect(maskPassport('M12345678')).toBe('****5678');
    expect(maskPassport('ABC')).toBe('****');
    expect(maskPassport('')).toBe('****');
  });

  it('매번 다른 암호화 (IV 다름)', () => {
    const plain = 'M12345678';
    const enc1 = encryptPassport(plain);
    const enc2 = encryptPassport(plain);
    expect(enc1.encryptedData).not.toBe(enc2.encryptedData);
    expect(enc1.iv).not.toBe(enc2.iv);
  });
});
```

### 통합 테스트
```typescript
// src/lib/__tests__/passport-db-helpers.test.ts

import { preparePassportForDb, decryptPassportFromDb } from '@/lib/passport-db-helpers';

describe('Passport DB Helpers', () => {
  it('preparePassportForDb + decryptPassportFromDb', () => {
    const original = 'M12345678';
    const { passportNumber, passportIV } = preparePassportForDb(original);
    const decrypted = decryptPassportFromDb(passportNumber, passportIV);
    expect(decrypted).toBe(original);
  });

  it('null 처리', () => {
    const { passportNumber, passportIV } = preparePassportForDb(null);
    expect(passportNumber).toBeNull();
    expect(passportIV).toBeNull();
  });
});
```

---

## 🔍 디버깅 팁

### 환경변수 확인
```bash
# 환경변수 설정 확인
node -e "console.log('KEY:', process.env.PASSPORT_ENCRYPTION_KEY ? 'SET' : 'NOT SET')"
```

### 암호화 검증
```typescript
import { validateEncryptionKey } from '@/lib/passport-encryption';

if (!validateEncryptionKey()) {
  throw new Error('PASSPORT_ENCRYPTION_KEY 환경변수 확인 필요');
}
```

### 로그 추가
```typescript
const { encryptedData, iv } = encryptPassport(plaintext);
console.log('[DEBUG] Encrypted:', {
  length: encryptedData.length,
  ivLength: iv.length,
  // plaintext는 절대 로그 안 함!
});
```

### DB 직접 확인
```sql
-- PostgreSQL
SELECT id, name, passportNumber, passportIV
FROM "PassportSubmissionGuest"
LIMIT 1;

-- passportNumber는 base64 (예: BjKL9mNpQr2s...)
-- 평문이 아님 ✓
```

---

## 📋 체크리스트

```
✅ Phase 1: 인프라 완료
- [x] encryptPassport() 함수
- [x] decryptPassport() 함수
- [x] maskPassport() 함수
- [x] DB 헬퍼 함수
- [x] Prisma 스키마

⏳ Phase 2: API 통합 진행 중
- [ ] .env.local 설정
- [ ] Vercel 환경변수 등록
- [ ] manual-register API 수정
- [ ] customers API 수정
- [ ] search API 수정
- [ ] ocr-to-apis API 수정
- [ ] UI 컴포넌트 수정
- [ ] TSC 0 errors
- [ ] 로컬 테스트
- [ ] Vercel 배포
```

---

**마지막 업데이트**: 2026-06-19
**버전**: 1.0
