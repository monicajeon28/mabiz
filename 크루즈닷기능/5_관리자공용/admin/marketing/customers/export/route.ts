export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
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
    console.error('[Marketing Customers Export] Auth check error:', error);
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

    // 필터 파라미터 파싱
    const { searchParams } = new URL(req.url);
    const includeGroups = searchParams.get('includeGroups')?.split(',').filter(Boolean).map(Number) || [];
    const includeGroupsOperator = searchParams.get('includeGroupsOperator') || 'OR';
    const excludeGroups = searchParams.get('excludeGroups')?.split(',').filter(Boolean).map(Number) || [];
    const inflowDateStart = searchParams.get('inflowDateStart');
    const inflowDateEnd = searchParams.get('inflowDateEnd');
    const daySearch = searchParams.get('daySearch');

    // 필터 조건 구성
    const where: any = {};
    
    if (includeGroups.length > 0) {
      where.CustomerGroupMembers = {
        some: {
          groupId: { in: includeGroups },
        },
      };
      if (includeGroupsOperator === 'AND') {
        where.AND = includeGroups.map((groupId) => ({
          CustomerGroupMembers: {
            some: { groupId },
          },
        }));
      }
    }

    if (excludeGroups.length > 0) {
      where.NOT = {
        CustomerGroupMembers: {
          some: {
            groupId: { in: excludeGroups },
          },
        },
      };
    }

    if (inflowDateStart || inflowDateEnd) {
      where.createdAt = {};
      if (inflowDateStart) {
        where.createdAt.gte = new Date(inflowDateStart);
      }
      if (inflowDateEnd) {
        where.createdAt.lte = new Date(inflowDateEnd + 'T23:59:59');
      }
    }

    if (daySearch) {
      const days = parseInt(daySearch);
      if (!isNaN(days)) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - days);
        where.createdAt = {
          ...where.createdAt,
          gte: targetDate,
        };
      }
    }

    let customers: any[] = [];
    try {
      customers = await prisma.marketingCustomer.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: {
          MarketingAccount: {
            select: {
              accountName: true,
            },
          },
          CustomerGroupMembers: {
            include: {
              CustomerGroup: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (dbError: any) {
      // 테이블이 없는 경우 처리
      if (dbError?.message?.includes('does not exist') || dbError?.code === 'P2021') {
        console.error('[Marketing Customers Export] Table does not exist.');
        return NextResponse.json({
          ok: false,
          error: '데이터베이스 테이블이 없습니다. 마이그레이션을 실행해주세요.',
        }, { status: 500 });
      }
      throw dbError;
    }

    // 엑셀 데이터 준비
    const excelData = customers.map((customer) => ({
      ID: customer.id,
      관리계정: customer.MarketingAccount?.accountName || '',
      이름: customer.name || '',
      이메일: customer.email || '',
      전화번호: customer.phone || '',
      출처: customer.source || '',
      상태: customer.status,
      리드스코어: customer.leadScore || 0,
      그룹: customer.CustomerGroupMembers?.map((m: any) => m.CustomerGroup?.name).filter(Boolean).join(', ') || '',
      마지막연락: customer.lastContactedAt ? new Date(customer.lastContactedAt).toLocaleDateString('ko-KR') : '',
      전환일: customer.convertedAt ? new Date(customer.convertedAt).toLocaleDateString('ko-KR') : '',
      생성일: new Date(customer.createdAt).toLocaleDateString('ko-KR'),
      메모: customer.notes || '',
    }));

    // 엑셀 워크북 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(workbook, worksheet, '고객목록');

    // 버퍼로 변환
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="고객목록_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[Marketing Customers Export] Error:', error);
    return NextResponse.json({
      ok: false,
      error: '엑셀 다운로드에 실패했습니다.',
    }, { status: 500 });
  }
}
