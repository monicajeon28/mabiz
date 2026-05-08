export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
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
    console.error('[Marketing Customer] Auth check error:', error);
    return false;
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    const customer = await prisma.marketingCustomer.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!customer) {
      return NextResponse.json({
        ok: false,
        error: '고객을 찾을 수 없습니다.',
      }, { status: 404 });
    }

    // 계정의 고객 수 감소
    await prisma.marketingAccount.update({
      where: { id: customer.accountId },
      data: {
        currentCustomerCount: {
          decrement: 1,
        },
      },
    });

    // 고객 삭제
    await prisma.marketingCustomer.delete({
      where: { id: parseInt(params.id) },
    });

    return NextResponse.json({
      ok: true,
      message: '고객이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('[Marketing Customer] Delete error:', error);
    return NextResponse.json({
      ok: false,
      error: '고객 삭제에 실패했습니다.',
    }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    const { name, email, phone, source, status } = body;

    const customer = await prisma.marketingCustomer.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(source !== undefined && { source }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({
      ok: true,
      data: customer,
    });
  } catch (error) {
    console.error('[Marketing Customer] Update error:', error);
    return NextResponse.json({
      ok: false,
      error: '고객 수정에 실패했습니다.',
    }, { status: 500 });
  }
}
