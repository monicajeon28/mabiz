export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: {
        expiresAt: true,
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    // 🔒 세션 만료 검증
    if (session.expiresAt && session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Customer Groups Customers] Auth check error:', error);
    return null;
  }
}

// GET: 그룹별 고객 리스트 조회 (유입날짜, 일차 포함)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const resolvedParams = await params;
    const groupId = parseInt(resolvedParams.id);
    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 그룹 ID입니다.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source'); // 'admin' 또는 'partner'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // 일차 계산 헬퍼 함수
    const calculateDays = (addedAt: Date): number => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const joinDate = new Date(addedAt);
      joinDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - joinDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays + 1; // 1일차부터 시작
    };

    // 파트너 그룹인 경우
    if (source === 'partner') {
      const partnerGroup = await prisma.partnerCustomerGroup.findUnique({
        where: { id: groupId },
        select: { id: true, name: true },
      });

      if (!partnerGroup) {
        return NextResponse.json(
          { ok: false, error: '파트너 그룹을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 파트너 그룹의 고객(AffiliateLead) 조회
      const leadWhere: any = { groupId };
      if (search) {
        leadWhere.OR = [
          { customerName: { contains: search } },
          { customerPhone: { contains: search } },
        ];
      }

      const [leads, total] = await Promise.all([
        prisma.affiliateLead.findMany({
          where: leadWhere,
          select: {
            id: true,
            customerName: true,
            customerPhone: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.affiliateLead.count({ where: leadWhere }),
      ]);

      const customers = leads.map(lead => ({
        id: lead.id,
        leadId: lead.id,
        userId: null,
        customerName: lead.customerName,
        phone: lead.customerPhone,
        email: null,
        groupInflowDate: lead.createdAt.toISOString().split('T')[0],
        daysSinceInflow: calculateDays(lead.createdAt),
        messageSentCount: 0, // 파트너 그룹은 별도 로그 시스템 사용
        addedAt: lead.createdAt.toISOString(),
        notes: lead.notes,
      }));

      return NextResponse.json({
        ok: true,
        source: 'partner',
        group: {
          id: partnerGroup.id,
          name: partnerGroup.name,
        },
        customers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // 관리자 그룹 소유권 확인 (본인 그룹 + affiliateProfileId가 있는 그룹)
    const group = await prisma.customerGroup.findFirst({
      where: {
        id: groupId,
        OR: [
          { adminId: admin.id },
          { affiliateProfileId: { not: null } },
        ],
      },
      select: { id: true, name: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, error: '그룹을 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 필터 조건 구성
    const where: any = {
      groupId,
      releasedAt: null, // 해제되지 않은 멤버만
    };

    // 검색 필터 (고객명, 전화번호로 검색)
    if (search) {
      where.User_CustomerGroupMember_userIdToUser = {
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ],
      };
    }

    // 그룹 멤버 조회 (유입날짜, 해제날짜 포함)
    const [members, total] = await Promise.all([
      prisma.customerGroupMember.findMany({
        where,
        include: {
          User_CustomerGroupMember_userIdToUser: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
        orderBy: { addedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customerGroupMember.count({ where }),
    ]);

    // 각 멤버별 문자 발송 횟수 계산 (ScheduledMessageLog 사용)
    const customers = await Promise.all(
      members.map(async (member) => {
        // 해당 그룹에 연결된 예약 메시지 발송 로그 조회
        const sentLogsCount = await prisma.scheduledMessageLog.count({
          where: {
            userId: member.userId,
            status: 'sent',
            ScheduledMessage: {
              targetGroupId: groupId,
            },
          },
        });

        return {
          id: member.id,
          userId: member.userId,
          customerName: member.User_CustomerGroupMember_userIdToUser?.name || null,
          phone: member.User_CustomerGroupMember_userIdToUser?.phone || null,
          email: member.User_CustomerGroupMember_userIdToUser?.email || null,
          groupInflowDate: member.addedAt.toISOString().split('T')[0], // YYYY-MM-DD 형식
          daysSinceInflow: calculateDays(member.addedAt), // 일차
          messageSentCount: sentLogsCount, // 예약 메시지 발송 횟수
          addedAt: member.addedAt.toISOString(),
          addedBy: member.addedBy,
          releasedAt: member.releasedAt?.toISOString() || null,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      source: 'admin',
      group: {
        id: group.id,
        name: group.name,
      },
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Customer Groups Customers GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '고객 리스트 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
