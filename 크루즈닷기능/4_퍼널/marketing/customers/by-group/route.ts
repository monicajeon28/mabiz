export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';
import prisma from '@/lib/prisma';

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
    console.error('[Marketing Customers By Group] Auth check error:', error);
    return false;
  }
}

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const customerGroup = searchParams.get('customerGroup'); // 'prospects', 'trial', 'genie', 'mall', 'agent', 'manager'
    const search = searchParams.get('search') || '';
    const hasEmail = searchParams.get('hasEmail') === 'true'; // 이메일이 있는 고객만

    if (!customerGroup) {
      return NextResponse.json({
        ok: false,
        error: '고객 그룹을 지정해주세요.',
      }, { status: 400 });
    }

    let where: any = {
      role: { not: 'admin' },
    };

    // 이메일 필터
    if (hasEmail) {
      where.email = { not: null };
    }

    // 검색 조건
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // 고객 그룹별 필터링
    switch (customerGroup) {
      case 'prospects':
        // 잠재고객: 랜딩페이지로 유입된 고객 또는 그룹이 없는 고객
        where.OR = [
          { customerSource: 'landing-page' },
          {
            AND: [
              { customerSource: { notIn: ['test-guide', 'mall-signup', 'cruise-guide'] } },
              { customerSource: null },
            ],
          },
        ];
        break;
      case 'trial':
        // 크루즈가이드 3일 체험
        where.OR = [
          { customerSource: 'test-guide' },
          { testModeStartedAt: { not: null } },
        ];
        break;
      case 'genie':
        // 크루즈가이드 지니 (구매 고객)
        where.OR = [
          { customerStatus: 'purchase_confirmed' },
          { Reservation: { some: {} } },
          { customerSource: 'cruise-guide' },
        ];
        break;
      case 'mall':
        // 크루즈몰 고객
        where.role = 'community';
        where.customerSource = 'mall-signup';
        break;
      case 'agent':
        // 판매원 고객: AffiliateLead에서 agentId가 있는 고객
        const agentLeads = await prisma.affiliateLead.findMany({
          where: {
            agentId: { not: null },
          },
          select: {
            customerPhone: true,
          },
        });
        const agentPhones = agentLeads
          .map(lead => lead.customerPhone)
          .filter((phone): phone is string => Boolean(phone));
        
        if (agentPhones.length > 0) {
          where.phone = { in: agentPhones };
        } else {
          // 판매원 고객이 없으면 빈 결과 반환
          return NextResponse.json({
            ok: true,
            customers: [],
            total: 0,
          });
        }
        break;
      case 'manager':
        // 대리점장 고객: AffiliateLead에서 managerId가 있는 고객
        const managerLeads = await prisma.affiliateLead.findMany({
          where: {
            managerId: { not: null },
          },
          select: {
            customerPhone: true,
          },
        });
        const managerPhones = managerLeads
          .map(lead => lead.customerPhone)
          .filter((phone): phone is string => Boolean(phone));
        
        if (managerPhones.length > 0) {
          where.phone = { in: managerPhones };
        } else {
          // 대리점장 고객이 없으면 빈 결과 반환
          return NextResponse.json({
            ok: true,
            customers: [],
            total: 0,
          });
        }
        break;
      default:
        return NextResponse.json({
          ok: false,
          error: '유효하지 않은 고객 그룹입니다.',
        }, { status: 400 });
    }

    // 고객 조회
    const customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // 최대 1000명까지
    });

    const total = await prisma.user.count({ where });

    return NextResponse.json({
      ok: true,
      customers: customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
    });
  } catch (error) {
    console.error('[Marketing Customers By Group] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : '고객 목록을 불러오는데 실패했습니다.',
    }, { status: 500 });
  }
}
