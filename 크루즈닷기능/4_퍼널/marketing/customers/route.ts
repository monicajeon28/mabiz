export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
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
    console.error('[Marketing Customers] Auth check error:', error);
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const includeGroups = searchParams.get('includeGroups');
    const includeGroupsOperator = searchParams.get('includeGroupsOperator') || 'OR';
    const excludeGroups = searchParams.get('excludeGroups');
    const inflowDateStart = searchParams.get('inflowDateStart');
    const inflowDateEnd = searchParams.get('inflowDateEnd');
    const daySearch = searchParams.get('daySearch');

    const skip = (page - 1) * limit;

    // 필터 조건 구성
    const where: any = {};
    
    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (accountId) {
      where.accountId = parseInt(accountId);
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // 유입일 필터
    if (inflowDateStart || inflowDateEnd) {
      where.createdAt = {};
      if (inflowDateStart) {
        where.createdAt.gte = new Date(inflowDateStart);
      }
      if (inflowDateEnd) {
        const endDate = new Date(inflowDateEnd);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // 일차검색 (N일 전부터)
    if (daySearch) {
      const days = parseInt(daySearch);
      if (!isNaN(days)) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - days);
        if (!where.createdAt) where.createdAt = {};
        where.createdAt.gte = targetDate;
      }
    }

    // 고객 목록 조회 - MarketingCustomer와 User 테이블 모두 조회
    let marketingCustomers: any[] = [];
    let userCustomers: any[] = [];
    
    try {
      // MarketingCustomer 테이블 조회
      marketingCustomers = await prisma.marketingCustomer.findMany({
        where,
        include: {
          MarketingAccount: {
            select: {
              accountName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });
    } catch (dbError: any) {
      // 테이블이 없는 경우 처리
      if (dbError?.message?.includes('does not exist') || dbError?.code === 'P2021') {
        console.error('[Marketing Customers] MarketingCustomer table does not exist. Using User table only.');
        marketingCustomers = [];
      } else {
        throw dbError;
      }
    }

    // MarketingCustomer가 없거나 적은 경우, User 테이블에서도 조회
    // 랜딩페이지로 유입된 고객 등이 User 테이블에만 있을 수 있음
    if (marketingCustomers.length < limit) {
      try {
        // User 테이블에서 랜딩페이지/마케팅 관련 고객 조회
        const userWhere: any = {
          role: { not: 'admin' },
          OR: [
            { customerSource: 'landing-page' },
            { customerSource: 'affiliate-manual' },
            { customerSource: 'affiliate-lead' },
            { customerSource: null }, // customerSource가 없는 고객도 포함
          ],
        };

        // 검색 조건 적용
        if (search) {
          userWhere.AND = [
            {
              OR: [
                { name: { contains: search } },
                { phone: { contains: search } },
                { email: { contains: search } },
              ],
            },
          ];
        }

        // 유입일 필터 적용
        if (inflowDateStart || inflowDateEnd) {
          if (!userWhere.AND) userWhere.AND = [];
          const dateFilter: any = {};
          if (inflowDateStart) {
            dateFilter.gte = new Date(inflowDateStart);
          }
          if (inflowDateEnd) {
            const endDate = new Date(inflowDateEnd);
            endDate.setHours(23, 59, 59, 999);
            dateFilter.lte = endDate;
          }
          userWhere.AND.push({ createdAt: dateFilter });
        }

        const users = await prisma.user.findMany({
          where: userWhere,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            customerSource: true,
            customerStatus: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: marketingCustomers.length, // MarketingCustomer 이후부터
          take: limit - marketingCustomers.length,
        });

        // User를 MarketingCustomer 형식으로 변환
        userCustomers = users.map(user => ({
          id: user.id + 1000000, // MarketingCustomer ID와 구분하기 위해 큰 수 더함
          name: user.name,
          phone: user.phone,
          email: user.email,
          source: user.customerSource || 'user',
          status: user.customerStatus === 'active' ? 'NEW' : user.customerStatus?.toUpperCase() || 'NEW',
          notes: null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          MarketingAccount: null,
        }));
      } catch (userError) {
        console.error('[Marketing Customers] User query error:', userError);
        userCustomers = [];
      }
    }

    // 두 결과 합치기
    const customers = [...marketingCustomers, ...userCustomers];

    // 고객의 phone과 email 목록 수집
    const phones = customers.map(c => c.phone).filter((p): p is string => Boolean(p) && typeof p === 'string');
    const emails = customers.map(c => c.email).filter((e): e is string => Boolean(e) && typeof e === 'string');

    // User와 그룹 정보 일괄 조회 (phone이나 email이 있을 때만)
    let users: any[] = [];
    if (phones.length > 0 || emails.length > 0) {
      const orConditions: any[] = [];
      if (phones.length > 0) {
        orConditions.push({ phone: { in: phones } });
      }
      if (emails.length > 0) {
        orConditions.push({ email: { in: emails } });
      }

      if (orConditions.length > 0) {
        try {
          users = await prisma.user.findMany({
            where: {
              OR: orConditions,
            },
            include: {
              CustomerGroupMember: {
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
          });
        } catch (userError) {
          console.error('[Marketing Customers] User query error:', userError);
          // User 조회 실패해도 계속 진행 (그룹 정보만 없음)
          users = [];
        }
      }
    }

    // phone/email로 User 매핑
    const userMap = new Map<string, typeof users[0]>();
    users.forEach(user => {
      if (user.phone && typeof user.phone === 'string') {
        userMap.set(user.phone, user);
      }
      if (user.email && typeof user.email === 'string') {
        userMap.set(user.email, user);
      }
    });

    // 그룹 필터링
    const includeGroupIds = includeGroups ? includeGroups.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];
    const excludeGroupIds = excludeGroups ? excludeGroups.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];

    // 고객의 phone 목록으로 AffiliateLead 조회 (대리점장 정보 확인용)
    const customerPhonesForLead = customers
      .map(c => c.phone)
      .filter((p): p is string => Boolean(p) && typeof p === 'string');
    
    const affiliateLeadsMap = new Map<string, {
      managerId: number | null;
      agentId: number | null;
      managerName: string | null;
      agentName: string | null;
      leadId: number;
    }>();

    if (customerPhonesForLead.length > 0) {
      try {
        const leads = await prisma.affiliateLead.findMany({
          where: {
            customerPhone: { in: customerPhonesForLead },
          },
          include: {
            AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
              select: {
                id: true,
                displayName: true,
                branchLabel: true,
              },
            },
            AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        });

        leads.forEach(lead => {
          if (lead.customerPhone) {
            affiliateLeadsMap.set(lead.customerPhone, {
              managerId: lead.managerId,
              agentId: lead.agentId,
              managerName: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile?.displayName || 
                          lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile?.branchLabel || null,
              agentName: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || null,
              leadId: lead.id,
            });
          }
        });
      } catch (leadError) {
        console.error('[Marketing Customers] AffiliateLead query error:', leadError);
      }
    }

    // 고객 데이터 변환 및 필터링
    let filteredCustomers = customers.map((customer) => {
      // User 찾기
      let user = null;
      if (customer.phone && typeof customer.phone === 'string') {
        user = userMap.get(customer.phone);
      }
      if (!user && customer.email && typeof customer.email === 'string') {
        user = userMap.get(customer.email);
      }
      
      const customerGroups = user?.CustomerGroupMember?.map(m => m.CustomerGroup).filter(Boolean) || [];

      // AffiliateLead 정보 확인
      const leadInfo = customer.phone ? affiliateLeadsMap.get(customer.phone) : null;
      const ownerName = leadInfo?.managerName || leadInfo?.agentName || null;

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        source: customer.source,
        status: customer.status,
        notes: customer.notes,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        account: customer.MarketingAccount,
        groups: customerGroups,
        ownerName: ownerName, // 대리점장/판매원 이름
        leadId: leadInfo?.leadId || null, // AffiliateInteraction 조회용
      };
    });

    // 포함 그룹 필터
    if (includeGroupIds.length > 0) {
      filteredCustomers = filteredCustomers.filter(customer => {
        const customerGroupIds = customer.groups
          .filter(g => g && g.id)
          .map(g => g.id);
        if (includeGroupsOperator === 'AND') {
          return includeGroupIds.every(id => customerGroupIds.includes(id));
        } else {
          return includeGroupIds.some(id => customerGroupIds.includes(id));
        }
      });
    }

    // 제외 그룹 필터
    if (excludeGroupIds.length > 0) {
      filteredCustomers = filteredCustomers.filter(customer => {
        const customerGroupIds = customer.groups
          .filter(g => g && g.id)
          .map(g => g.id);
        return !excludeGroupIds.some(id => customerGroupIds.includes(id));
      });
    }

    // 총 개수 계산
    let total = 0;
    try {
      const marketingCount = await prisma.marketingCustomer.count({ where }).catch(() => 0);
      const userCount = await prisma.user.count({
        where: {
          role: { not: 'admin' },
          OR: [
            { customerSource: 'landing-page' },
            { customerSource: 'affiliate-manual' },
            { customerSource: 'affiliate-lead' },
            { customerSource: null },
          ],
        },
      }).catch(() => 0);
      total = marketingCount + userCount;
    } catch (countError) {
      console.error('[Marketing Customers] Count error:', countError);
      total = includeGroups || excludeGroups ? filteredCustomers.length : customers.length;
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      ok: true,
      data: {
        customers: filteredCustomers,
        total,
        totalPages,
        currentPage: page,
      },
    });
  } catch (error) {
    console.error('[Marketing Customers] Error:', error);
    console.error('[Marketing Customers] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
    const { accountId, name, email, phone, source, notes, groupIds } = body;

    // 기본 계정 찾기 (accountId가 없으면 첫 번째 계정 사용)
    let account;
    if (accountId) {
      account = await prisma.marketingAccount.findUnique({
        where: { id: accountId },
      });
    } else {
      // accountId가 없으면 첫 번째 계정 사용
      account = await prisma.marketingAccount.findFirst();
    }

    if (!account) {
      // 계정이 없으면 자동 생성
      account = await prisma.marketingAccount.create({
        data: {
          accountName: '기본 계정',
          maxCustomers: 999999999, // 무제한
          currentCustomerCount: 0,
        },
      });
    }

    // 고객 수 제한 제거 (무제한)

    // 고객 생성
    const customer = await prisma.marketingCustomer.create({
      data: {
        accountId: account.id,
        name,
        email,
        phone,
        source,
        notes,
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

    // 그룹에 추가 (phone 또는 email로 User 찾아서 그룹에 추가)
    if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
      let user = null;
      if (phone) {
        user = await prisma.user.findFirst({
          where: { phone },
        });
      }
      
      if (!user && email) {
        user = await prisma.user.findFirst({
          where: { email },
        });
      }

      // User가 없으면 생성
      if (!user && phone) {
        user = await prisma.user.create({
          data: {
            name: name || null,
            phone,
            email: email || null,
            role: 'user',
          },
        });
      }

      if (user) {
        // 각 그룹에 추가
        for (const groupId of groupIds) {
          try {
            await prisma.customerGroupMember.upsert({
              where: {
                groupId_userId: {
                  groupId,
                  userId: user.id,
                },
              },
              create: {
                groupId,
                userId: user.id,
                addedBy: (await prisma.session.findFirst({
                  where: { id: sid },
                  select: { userId: true },
                }))?.userId || null,
              },
              update: {},
            });
          } catch (error) {
            console.error(`Failed to add user to group ${groupId}:`, error);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      data: customer,
    });
  } catch (error) {
    console.error('[Marketing Customers] Create error:', error);
    return NextResponse.json({
      ok: false,
      error: '고객 생성에 실패했습니다.',
    }, { status: 500 });
  }
}
