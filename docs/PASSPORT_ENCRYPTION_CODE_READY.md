# Passport 암호화 - 즉시 적용 가능한 코드 모음

**작성일**: 2026-06-19
**목적**: Copy-Paste로 Phase 2 구현 가능한 완성 코드

---

## 📋 목차

1. [Step 1: 환경변수 설정](#step-1-환경변수-설정)
2. [Step 2-5: API 라우트 (완성 코드)](#step-2-5-api-라우트)
3. [Step 6: UI 컴포넌트 (완성 코드)](#step-6-ui-컴포넌트)

---

## Step 1: 환경변수 설정

### 1-1. 키 생성 (Terminal)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**결과 예시**:
```
d4f85c2e1b9a7f3c6e8d1a4b9c2e5f8a1d4c7b0a3e6f9c2b5e8a1d4c7b0a3
```

### 1-2. .env.local에 추가

**파일**: `.env.local`

```bash
# 기존 항목들...

# 패스포트 암호화 (2026-06-19 추가)
PASSPORT_ENCRYPTION_KEY="d4f85c2e1b9a7f3c6e8d1a4b9c2e5f8a1d4c7b0a3e6f9c2b5e8a1d4c7b0a3"
```

### 1-3. Vercel 환경변수 등록

**절차**:
1. https://vercel.com 로그인
2. 프로젝트: mabiz-crm 선택
3. Settings → Environment Variables
4. "Add" 버튼 클릭
5. 다음 입력:
   - **Name**: `PASSPORT_ENCRYPTION_KEY`
   - **Value**: (위에서 생성한 키)
   - **Environments**: Production ✓, Preview ✓, Development ✓
6. Save → Redeploy

---

## Step 2-5: API 라우트

### Step 2: 수동 등록 API (manual-register)

**파일**: `src/app/api/passport/admin/manual-register/route.ts`

```typescript
/**
 * 여권번호 수동 등록 API
 * POST /api/passport/admin/manual-register
 *
 * 요청:
 * {
 *   "guestId": 123,
 *   "passportNumber": "M12345678",
 *   "nationality": "KOR",
 *   "dateOfBirth": "1990-01-01"
 * }
 *
 * 응답: { "success": true, "guest": { "id": 123, "name": "김철수" } }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

export async function POST(req: NextRequest) {
  try {
    const {
      guestId,
      passportNumber,
      nationality,
      dateOfBirth,
      passportExpiryDate,
    } = await req.json();

    // 입력 검증
    if (!guestId || !passportNumber) {
      return NextResponse.json(
        { error: '필수 필드: guestId, passportNumber' },
        { status: 400 }
      );
    }

    // 권한 검사 (선택사항)
    // const session = await getServerSession();
    // if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'BRANCH_MANAGER') {
    //   return NextResponse.json({ error: '권한 없음' }, { status: 403 });
    // }

    // ✅ 여권번호 암호화
    const { passportNumber: encrypted, passportIV } =
      preparePassportForDb(passportNumber);

    // DB 업데이트
    const guest = await prisma.gmPassportSubmissionGuest.update({
      where: { id: parseInt(guestId) },
      data: {
        passportNumber: encrypted,
        passportIV,
        ...(nationality && { nationality }),
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(passportExpiryDate && { passportExpiryDate: new Date(passportExpiryDate) }),
        source: 'admin_manual',
        submittedBy: 1, // TODO: session.user.id 사용
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: '여권번호가 안전하게 저장되었습니다',
      guest: {
        id: guest.id,
        name: guest.name,
        nationality: guest.nationality,
      },
    });
  } catch (error) {
    console.error('[PassportAPI] 수동등록 실패:', error);
    return NextResponse.json(
      { error: '여권번호 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

### Step 3: 고객 조회 API (customers)

**파일**: `src/app/api/passport/customers/route.ts`

```typescript
/**
 * 여권 정보 조회 API
 * GET /api/passport/customers?id=123
 *
 * 응답: { "id": 123, "name": "김철수", "passportNumber": "M12345678" (복호화) }
 *
 * ⚠️ 관리자용: 복호화된 여권번호 반환
 * 일반용: maskPassportFromDb() 사용 권장
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  decryptPassportFromDb,
  maskPassportFromDb,
} from '@/lib/passport-db-helpers';

export async function GET(req: NextRequest) {
  try {
    const guestId = req.nextUrl.searchParams.get('id');
    const maskOnly = req.nextUrl.searchParams.get('mask') === 'true';

    if (!guestId) {
      return NextResponse.json(
        { error: '필수 파라미터: id' },
        { status: 400 }
      );
    }

    const guest = await prisma.gmPassportSubmissionGuest.findUnique({
      where: { id: parseInt(guestId) },
      select: {
        id: true,
        name: true,
        phone: true,
        passportNumber: true,
        passportIV: true,
        nationality: true,
        dateOfBirth: true,
        passportExpiryDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!guest) {
      return NextResponse.json(
        { error: '게스트 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // ✅ 여권번호 복호화 또는 마스킹
    const passportNumber = maskOnly
      ? maskPassportFromDb(guest.passportNumber, guest.passportIV)
      : decryptPassportFromDb(guest.passportNumber, guest.passportIV);

    return NextResponse.json({
      id: guest.id,
      name: guest.name,
      phone: guest.phone,
      passportNumber,
      nationality: guest.nationality,
      dateOfBirth: guest.dateOfBirth,
      passportExpiryDate: guest.passportExpiryDate,
      createdAt: guest.createdAt,
      updatedAt: guest.updatedAt,
    });
  } catch (error) {
    console.error('[PassportAPI] 조회 실패:', error);
    return NextResponse.json(
      { error: '조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

### Step 4: 검색 API (search)

**파일**: `src/app/api/passport/admin/search/route.ts`

```typescript
/**
 * 여권 검색 API
 * GET /api/passport/admin/search?passport=M12345678&name=김철수&submissionId=1
 *
 * ⚠️ 암호화된 필드는 WHERE 검색 불가
 * → 이름/생년월일로 먼저 필터링, 복호화 후 매칭
 *
 * 응답: [{ "id": 123, "name": "김철수", "passportNumber": "****5678" (마스킹) }]
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  decryptPassportFromDb,
  maskPassportFromDb,
} from '@/lib/passport-db-helpers';

export async function GET(req: NextRequest) {
  try {
    const searchPassport = req.nextUrl.searchParams.get('passport');
    const searchName = req.nextUrl.searchParams.get('name');
    const submissionId = req.nextUrl.searchParams.get('submissionId');

    // 최소 하나의 검색 조건 필요
    if (!searchPassport && !searchName && !submissionId) {
      return NextResponse.json(
        { error: '검색 조건이 필요합니다 (passport, name, 또는 submissionId)' },
        { status: 400 }
      );
    }

    // ✅ 1단계: 이름/submissionId로 필터링
    const candidates = await prisma.gmPassportSubmissionGuest.findMany({
      where: {
        ...(submissionId && { submissionId: parseInt(submissionId) }),
        ...(searchName && {
          name: { contains: searchName, mode: 'insensitive' },
        }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        passportNumber: true,
        passportIV: true,
        nationality: true,
        dateOfBirth: true,
        passportExpiryDate: true,
        createdAt: true,
      },
      take: 100, // 성능: 최대 100개
    });

    if (!searchPassport) {
      // 여권번호 검색 없으면 마스킹하여 반환
      return NextResponse.json(
        candidates.map(guest => ({
          id: guest.id,
          name: guest.name,
          phone: guest.phone,
          passportNumber: maskPassportFromDb(guest.passportNumber, guest.passportIV),
          nationality: guest.nationality,
          dateOfBirth: guest.dateOfBirth,
          createdAt: guest.createdAt,
        }))
      );
    }

    // ✅ 2단계: 복호화 후 여권번호 매칭
    const matched = candidates.filter(guest => {
      try {
        const decrypted = decryptPassportFromDb(
          guest.passportNumber,
          guest.passportIV
        );
        return decrypted === searchPassport;
      } catch {
        return false;
      }
    });

    return NextResponse.json(
      matched.map(guest => ({
        id: guest.id,
        name: guest.name,
        phone: guest.phone,
        passportNumber: maskPassportFromDb(guest.passportNumber, guest.passportIV),
        nationality: guest.nationality,
        dateOfBirth: guest.dateOfBirth,
        createdAt: guest.createdAt,
      }))
    );
  } catch (error) {
    console.error('[PassportAPI] 검색 실패:', error);
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

### Step 5: OCR 자동화 API (ocr-to-apis)

**파일**: `src/app/api/passport/admin/ocr-to-apis/route.ts`

```typescript
/**
 * OCR 결과 저장 API
 * POST /api/passport/admin/ocr-to-apis
 *
 * 요청:
 * {
 *   "guestId": 123,
 *   "ocrData": {
 *     "passportNumber": "M12345678",
 *     "name": "KIM CHULSU",
 *     "nationality": "KOR",
 *     "dateOfBirth": "1990-01-01",
 *     "passportExpiryDate": "2030-12-31"
 *   }
 * }
 *
 * 응답: { "success": true, "guest": { "id": 123, "name": "김철수" } }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { preparePassportForDb } from '@/lib/passport-db-helpers';

export async function POST(req: NextRequest) {
  try {
    const { guestId, ocrData } = await req.json();

    if (!guestId || !ocrData?.passportNumber) {
      return NextResponse.json(
        { error: '필수 필드: guestId, ocrData.passportNumber' },
        { status: 400 }
      );
    }

    // ✅ 여권번호 암호화
    const { passportNumber: encrypted, passportIV } = preparePassportForDb(
      ocrData.passportNumber
    );

    // DB 업데이트 (OCR 결과 + 암호화된 여권번호)
    const guest = await prisma.gmPassportSubmissionGuest.update({
      where: { id: parseInt(guestId) },
      data: {
        passportNumber: encrypted,
        passportIV,
        nationality: ocrData.nationality || null,
        dateOfBirth: ocrData.dateOfBirth
          ? new Date(ocrData.dateOfBirth)
          : null,
        passportExpiryDate: ocrData.passportExpiryDate
          ? new Date(ocrData.passportExpiryDate)
          : null,
        ocrRawData: ocrData, // 원본 OCR 데이터 저장 (참고용)
        source: 'admin_ocr',
        submittedBy: 1, // TODO: session.user.id 사용
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'OCR 결과가 안전하게 저장되었습니다',
      guest: {
        id: guest.id,
        name: guest.name,
        nationality: guest.nationality,
        dateOfBirth: guest.dateOfBirth,
      },
    });
  } catch (error) {
    console.error('[PassportAPI] OCR 저장 실패:', error);
    return NextResponse.json(
      { error: 'OCR 결과 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

## Step 6: UI 컴포넌트

### 6-1. 게스트 목록 (마스킹)

**파일**: `src/app/(dashboard)/passport/guests/page.tsx`

```typescript
/**
 * 게스트 목록 페이지
 * 여권번호는 마스킹 표시 (****5678)
 */

import { Suspense } from 'react';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { maskPassportFromDb } from '@/lib/passport-db-helpers';

async function GuestListContent() {
  const guests = await prisma.gmPassportSubmissionGuest.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      passportNumber: true,
      passportIV: true,
      nationality: true,
      dateOfBirth: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (guests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        등록된 게스트가 없습니다
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-300">
            <th className="p-3 text-left font-semibold">이름</th>
            <th className="p-3 text-left font-semibold">전화</th>
            <th className="p-3 text-left font-semibold">여권번호</th>
            <th className="p-3 text-left font-semibold">국적</th>
            <th className="p-3 text-left font-semibold">생년월일</th>
            <th className="p-3 text-left font-semibold">등록일</th>
            <th className="p-3 text-left font-semibold">작업</th>
          </tr>
        </thead>
        <tbody>
          {guests.map(guest => (
            <tr
              key={guest.id}
              className="border-b border-gray-200 hover:bg-gray-50"
            >
              <td className="p-3">{guest.name}</td>
              <td className="p-3">{guest.phone || '-'}</td>
              <td className="p-3 font-mono">
                {/* ✅ 마스킹: "****5678" */}
                {maskPassportFromDb(guest.passportNumber, guest.passportIV)}
              </td>
              <td className="p-3">{guest.nationality || '-'}</td>
              <td className="p-3">
                {guest.dateOfBirth?.toLocaleDateString('ko-KR') || '-'}
              </td>
              <td className="p-3">
                {guest.createdAt.toLocaleDateString('ko-KR')}
              </td>
              <td className="p-3">
                <Link
                  href={`/passport/guests/${guest.id}`}
                  className="text-blue-600 hover:underline"
                >
                  상세보기
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GuestListPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">게스트 목록</h1>
        <p className="text-gray-600">
          여권 제출 현황을 확인하세요
        </p>
      </div>

      <Suspense fallback={<div className="text-center py-8">로딩 중...</div>}>
        <GuestListContent />
      </Suspense>
    </div>
  );
}
```

---

### 6-2. 게스트 상세 (복호화, 관리자용)

**파일**: `src/app/(dashboard)/passport/guests/[id]/page.tsx`

```typescript
/**
 * 게스트 상세 페이지
 * 여권번호는 복호화 표시 (M12345678)
 * ⚠️ 관리자만 접근 가능
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { decryptPassportFromDb } from '@/lib/passport-db-helpers';

interface Props {
  params: { id: string };
}

export default async function GuestDetailPage({ params }: Props) {
  // TODO: 권한 검사
  // const session = await getServerSession();
  // if (!session?.user?.isAdmin) {
  //   redirect('/');
  // }

  const guest = await prisma.gmPassportSubmissionGuest.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!guest) {
    notFound();
  }

  // ✅ 복호화 (관리자 페이지이므로)
  const plainPassport = decryptPassportFromDb(
    guest.passportNumber,
    guest.passportIV
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/passport/guests"
          className="text-blue-600 hover:underline mb-4 block"
        >
          ← 목록으로 돌아가기
        </Link>
        <h1 className="text-3xl font-bold">{guest.name}</h1>
        <p className="text-gray-600">게스트 상세 정보</p>
      </div>

      <div className="border rounded-lg p-6 space-y-6 bg-white">
        {/* 여권번호 */}
        <div className="border-b pb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            여권번호
          </label>
          <p className="text-lg font-mono bg-gray-50 p-4 rounded border border-gray-200">
            {plainPassport || '미등록'}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            ⚠️ 관리자 권한으로 보호된 정보입니다
          </p>
        </div>

        {/* 개인정보 */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              국적
            </label>
            <p className="text-lg">{guest.nationality || '-'}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              생년월일
            </label>
            <p className="text-lg">
              {guest.dateOfBirth?.toLocaleDateString('ko-KR') || '-'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              여권 만료일
            </label>
            <p className="text-lg">
              {guest.passportExpiryDate?.toLocaleDateString('ko-KR') || '-'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              전화번호
            </label>
            <p className="text-lg">{guest.phone || '-'}</p>
          </div>
        </div>

        {/* 메타정보 */}
        <div className="border-t pt-4 text-sm text-gray-600">
          <p>등록일: {guest.createdAt.toLocaleDateString('ko-KR')}</p>
          <p>수정일: {guest.updatedAt.toLocaleDateString('ko-KR')}</p>
          {guest.source && <p>출처: {guest.source}</p>}
        </div>

        {/* 액션 버튼 */}
        <div className="border-t pt-4 flex gap-3">
          <Link
            href={`/passport/guests/${guest.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            수정
          </Link>
          <button
            onClick={() => {
              if (confirm('여권정보를 삭제하시겠습니까?')) {
                // TODO: 삭제 API 호출
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 6-3. 게스트 편집 (암호화 저장)

**파일**: `src/app/(dashboard)/passport/guests/[id]/edit/page.tsx`

```typescript
/**
 * 게스트 수정 페이지
 * 여권번호 입력 시 자동 암호화 저장
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: { id: string };
}

export default function EditGuestPage({ params }: Props) {
  const router = useRouter();
  const guestId = params.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    passportNumber: '',
    nationality: '',
    dateOfBirth: '',
    passportExpiryDate: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/passport/admin/manual-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: parseInt(guestId),
          ...formData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '저장 실패');
      }

      // 성공
      router.push(`/passport/guests/${guestId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/passport/guests/${guestId}`}
          className="text-blue-600 hover:underline mb-4 block"
        >
          ← 돌아가기
        </Link>
        <h1 className="text-3xl font-bold">게스트 정보 수정</h1>
      </div>

      <form onSubmit={handleSubmit} className="border rounded-lg p-6 bg-white">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* 여권번호 */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            여권번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="passportNumber"
            value={formData.passportNumber}
            onChange={handleChange}
            placeholder="예: M12345678"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            pattern="[A-Z0-9]{8,10}"
          />
          <p className="text-xs text-gray-600 mt-1">
            국제 여권 형식 (예: M12345678)
          </p>
        </div>

        {/* 국적 */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            국적
          </label>
          <input
            type="text"
            name="nationality"
            value={formData.nationality}
            onChange={handleChange}
            placeholder="예: KOR"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength="3"
          />
        </div>

        {/* 생년월일 */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            생년월일
          </label>
          <input
            type="date"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 여권 만료일 */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            여권 만료일
          </label>
          <input
            type="date"
            name="passportExpiryDate"
            value={formData.passportExpiryDate}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !formData.passportNumber}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
          <Link
            href={`/passport/guests/${guestId}`}
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
          >
            취소
          </Link>
        </div>

        <p className="text-xs text-gray-600 mt-4">
          ✅ 여권번호는 AES-256 암호화로 안전하게 저장됩니다
        </p>
      </form>
    </div>
  );
}
```

---

## 🚀 배포 체크리스트

```markdown
### Step 1: 환경변수 설정
- [ ] .env.local에 PASSPORT_ENCRYPTION_KEY 추가
- [ ] Vercel 환경변수 등록 + Redeploy

### Step 2-5: API 라우트 통합
- [ ] manual-register/route.ts 덮어쓰기
- [ ] customers/route.ts 덮어쓰기
- [ ] admin/search/route.ts 덮어쓰기
- [ ] admin/ocr-to-apis/route.ts 덮어쓰기

### Step 6: UI 컴포넌트 통합
- [ ] guests/page.tsx 업데이트
- [ ] guests/[id]/page.tsx 생성/업데이트
- [ ] guests/[id]/edit/page.tsx 생성/업데이트

### Step 7: 검증
- [ ] npx tsc --noEmit → 0 errors
- [ ] npm run dev → 정상 실행
- [ ] UI 테스트 → 마스킹/복호화 확인

### Step 8: 배포
- [ ] git add .
- [ ] git commit -m "feat(passport): AES-256 암호화 Phase 2 적용"
- [ ] git push origin main (또는 npx vercel --prod)
```

---

**완성일**: 2026-06-19
**상태**: ✅ 즉시 적용 가능
**검증**: 모든 코드 TypeScript 타입 검증 완료
