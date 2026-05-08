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
    console.error('[Email Address Book Upload] Auth check error:', error);
    return null;
  }
}

// POST: 엑셀 파일 업로드 및 이메일 주소록 일괄 추가
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 없습니다.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const row of data) {
      try {
        // A열: 이름, B열: 연락처, C열: 이메일 형식으로 읽기
        const name = row['이름'] || row['name'] || row['Name'] || row['NAME'] || null;
        const phone = row['연락처'] || row['전화번호'] || row['phone'] || row['Phone'] || row['PHONE'] || row['전화'] || null;
        const email = row['이메일'] || row['email'] || row['Email'] || row['EMAIL'] || null;
        
        // 이메일 또는 전화번호 중 하나는 필수
        if (!email && !phone) {
          results.failed++;
          results.errors.push(`이메일 또는 전화번호가 없는 행: ${JSON.stringify(row)}`);
          continue;
        }
        
        const memo = row['메모'] || row['memo'] || row['Memo'] || row['MEMO'] || row['비고'] || null;

        // 이메일이 있으면 이메일을 기준으로, 없으면 전화번호를 기준으로 upsert
        if (email) {
          await prisma.emailAddressBook.upsert({
            where: {
              adminId_email: {
                adminId: admin.id,
                email: String(email),
              },
            },
            create: {
              adminId: admin.id,
              name: name ? String(name) : null,
              email: String(email),
              phone: phone ? String(phone) : null,
              memo: memo ? String(memo) : null,
            },
            update: {
              name: name ? String(name) : null,
              phone: phone ? String(phone) : null,
              memo: memo ? String(memo) : null,
            },
          });
        } else if (phone) {
          // 전화번호만 있는 경우, 전화번호로 조회 후 업데이트 또는 생성
          const existing = await prisma.emailAddressBook.findFirst({
            where: {
              adminId: admin.id,
              phone: String(phone),
            },
          });
          
          if (existing) {
            await prisma.emailAddressBook.update({
              where: { id: existing.id },
              data: {
                name: name ? String(name) : null,
                phone: String(phone),
                memo: memo ? String(memo) : null,
              },
            });
          } else {
            await prisma.emailAddressBook.create({
              data: {
                adminId: admin.id,
                name: name ? String(name) : null,
                email: null,
                phone: String(phone),
                memo: memo ? String(memo) : null,
              },
            });
          }
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`행 처리 오류: ${error.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    console.error('[Email Address Book Upload] POST error:', error);
    return NextResponse.json(
      { ok: false, error: '엑셀 파일을 업로드하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
