export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Email Address Book Download] Auth check error:', error);
    return null;
  }
}

// GET: 이메일 주소록 엑셀 다운로드
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const isSample = searchParams.get('sample') === 'true';

    if (isSample) {
      // 샘플 엑셀 파일 생성 (A열: 이름, B열: 연락처, C열: 이메일)
      const sampleData = [
        {
          이름: '홍길동',
          연락처: '010-1234-5678',
          이메일: 'hong@example.com',
        },
        {
          이름: '김철수',
          연락처: '010-9876-5432',
          이메일: 'kim@example.com',
        },
        {
          이름: '이영희',
          연락처: '010-5555-6666',
          이메일: 'lee@example.com',
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '이메일 주소록');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="이메일_주소록_샘플.xlsx"',
        },
      });
    }

    // 실제 이메일 주소록 다운로드
    const items = await prisma.emailAddressBook.findMany({
      where: { adminId: admin.id },
      orderBy: { createdAt: 'desc' },
    });

    const data = items.map((item) => ({
      이름: item.name || '',
      이메일: item.email,
      전화번호: item.phone || '',
      메모: item.memo || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '이메일 주소록');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="이메일_주소록.xlsx"',
      },
    });
  } catch (error) {
    console.error('[Email Address Book Download] GET error:', error);
    return NextResponse.json(
      { ok: false, error: '엑셀 파일을 다운로드하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
