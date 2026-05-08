export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';
import * as XLSX from 'xlsx';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Excel Upload] Auth check error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const groupId = formData.get('groupId');

    if (!file) {
      return NextResponse.json({
        ok: false,
        error: '파일을 선택해주세요.',
      }, { status: 400 });
    }

    if (!groupId) {
      return NextResponse.json({
        ok: false,
        error: '그룹을 선택해주세요.',
      }, { status: 400 });
    }

    const groupIdNum = parseInt(groupId.toString());
    const group = await prisma.customerGroup.findUnique({
      where: { id: groupIdNum },
    });

    if (!group) {
      return NextResponse.json({
        ok: false,
        error: '그룹을 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    let added = 0;
    let skipped = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    // 기본 계정 찾기 또는 생성
    let account = await prisma.marketingAccount.findFirst();
    if (!account) {
      account = await prisma.marketingAccount.create({
        data: {
          accountName: '기본 계정',
          maxCustomers: 999999999, // 무제한
          currentCustomerCount: 0,
        },
      });
    }

    // 세션에서 adminId 가져오기
    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });
    const adminId = session?.userId || null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const name = row['이름'] || row['name'] || null;
        const phone = row['휴대폰번호'] || row['phone'] || row['전화번호'] || null;
        const email = row['이메일'] || row['email'] || null;
        const source = row['유입경로'] || row['source'] || null;
        const notes = row['메모'] || row['notes'] || row['비고'] || null;

        if (!phone) {
          errors++;
          errorMessages.push(`행 ${i + 2}: 휴대폰 번호가 없습니다.`);
          continue;
        }

        // 전화번호 정규화 (하이픈 제거)
        const normalizedPhone = phone.toString().replace(/[-\s]/g, '');

        // 이미 존재하는 고객 확인
        const existingCustomer = await prisma.marketingCustomer.findFirst({
          where: { phone: normalizedPhone },
        });

        if (existingCustomer) {
          skipped++;
          continue;
        }

        // 고객 생성
        const customer = await prisma.marketingCustomer.create({
          data: {
            accountId: account.id,
            name,
            phone: normalizedPhone,
            email,
            source,
            notes,
            status: 'NEW',
            leadScore: 0,
          },
        });

        // User 찾기 또는 생성
        let user = await prisma.user.findFirst({
          where: { phone: normalizedPhone },
        });

        if (!user && email) {
          user = await prisma.user.findFirst({
            where: { email },
          });
        }

        if (!user) {
          user = await prisma.user.create({
            data: {
              name: name || null,
              phone: normalizedPhone,
              email: email || null,
              role: 'user',
            },
          });
        }

        // 그룹에 추가
        try {
          await prisma.customerGroupMember.upsert({
            where: {
              groupId_userId: {
                groupId: groupIdNum,
                userId: user.id,
              },
            },
            create: {
              groupId: groupIdNum,
              userId: user.id,
              addedBy: adminId,
            },
            update: {},
          });
        } catch (error) {
          // 이미 그룹에 속해있으면 무시
          console.log(`User ${user.id} already in group ${groupIdNum}`);
        }

        added++;
      } catch (error) {
        errors++;
        errorMessages.push(`행 ${i + 2}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    // 계정의 고객 수 업데이트
    await prisma.marketingAccount.update({
      where: { id: account.id },
      data: {
        currentCustomerCount: {
          increment: added,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      summary: {
        total: data.length,
        added,
        skipped,
        errors,
      },
      errors: errorMessages.slice(0, 10), // 최대 10개만 반환
    });
  } catch (error) {
    console.error('[Excel Upload] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : '엑셀 업로드에 실패했습니다.',
    }, { status: 500 });
  }
}
