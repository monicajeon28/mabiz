export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';

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
    console.error('[Phone Upload] Auth check error:', error);
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

    const body = await req.json();
    const { groupId, phones } = body;

    if (!groupId) {
      return NextResponse.json({
        ok: false,
        error: '그룹을 선택해주세요.',
      }, { status: 400 });
    }

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({
        ok: false,
        error: '휴대폰 번호를 입력해주세요.',
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

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const phone of phones) {
      try {
        if (!phone || typeof phone !== 'string') {
          skipped++;
          continue;
        }

        // 전화번호 정규화 (하이픈 제거)
        const normalizedPhone = phone.trim().replace(/[-\s]/g, '');

        if (normalizedPhone.length < 10) {
          skipped++;
          continue;
        }

        // 이미 존재하는 고객 확인
        let existingCustomer = await prisma.marketingCustomer.findFirst({
          where: { phone: normalizedPhone },
        });

        // 고객이 없으면 생성
        if (!existingCustomer) {
          existingCustomer = await prisma.marketingCustomer.create({
            data: {
              accountId: account.id,
              name: null,
              phone: normalizedPhone,
              email: null,
              source: null,
              notes: null,
              status: 'NEW',
              leadScore: 0,
            },
          });

          // 계정의 고객 수 업데이트
          await prisma.marketingAccount.update({
            where: { id: account.id },
            data: {
              currentCustomerCount: {
                increment: 1,
              },
            },
          });
        }

        // User 찾기 또는 생성
        let user = await prisma.user.findFirst({
          where: { phone: normalizedPhone },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              name: null,
              phone: normalizedPhone,
              email: null,
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
          added++;
        } catch (error) {
          // 이미 그룹에 속해있으면 건너뜀
          skipped++;
        }
      } catch (error) {
        errors.push(`${phone}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    return NextResponse.json({
      ok: true,
      added,
      skipped,
      errors: errors.slice(0, 10), // 최대 10개만 반환
    });
  } catch (error) {
    console.error('[Phone Upload] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : '휴대폰 번호 등록에 실패했습니다.',
    }, { status: 500 });
  }
}
