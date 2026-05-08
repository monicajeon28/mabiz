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
      console.log('[Customer Groups] No session cookie found');
      return null;
    }

    let session;
    try {
      session = await prisma.session.findUnique({
        where: { id: sid },
        select: {
          id: true,
          userId: true,
          User: {
            select: {
              id: true,
              role: true,
              name: true,
            },
          },
        },
      });
    } catch (dbError: any) {
      console.error('[Customer Groups] Database error in checkAdminAuth:', dbError);
      console.error('[Customer Groups] Error message:', dbError?.message);
      console.error('[Customer Groups] Error code:', dbError?.code);
      console.error('[Customer Groups] Error meta:', dbError?.meta);
      throw dbError; // 재던지기하여 상위에서 처리
    }

    if (!session) {
      console.log('[Customer Groups] Session not found:', sid);
      return null;
    }

    if (!session.User) {
      console.log('[Customer Groups] User not found in session');
      return null;
    }

    if (session.User.role !== 'admin') {
      console.log('[Customer Groups] User is not admin:', session.User.role);
      return null;
    }

    console.log('[Customer Groups] Admin authenticated:', session.User.id);
    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Customer Groups] Auth check error:', error);
    console.error('[Customer Groups] Error type:', error?.constructor?.name);
    console.error('[Customer Groups] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error; // 재던지기하여 상위에서 처리
  }
}

// GET: 고객 그룹 목록 조회
export async function GET(req: NextRequest) {
  try {
    let admin;
    try {
      admin = await checkAdminAuth();
    } catch (authError: any) {
      console.error('[Customer Groups GET] 인증 체크 중 오류:', authError);
      return NextResponse.json({ 
        ok: false, 
        error: '인증 확인 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? authError?.message : undefined
      }, { status: 500 });
    }
    
    if (!admin) {
      console.log('[Customer Groups GET] 인증 실패 - 403 반환');
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.',
        debug: process.env.NODE_ENV === 'development' ? '세션 쿠키를 확인해주세요.' : undefined
      }, { status: 403 });
    }
    
    console.log('[Customer Groups GET] 인증 성공, 그룹 목록 조회 시작');

    try {
      // 1. 관리자가 생성한 그룹 + 점장들이 생성한 그룹 (CustomerGroup)
      const adminGroups = await prisma.customerGroup.findMany({
        where: {
          OR: [
            { adminId: admin.id }, // 관리자가 생성한 그룹
            { affiliateProfileId: { not: null } }, // 점장들이 생성한 그룹
          ],
        },
        include: {
          AffiliateProfile: {
            select: {
              id: true,
              displayName: true,
              branchLabel: true,
              affiliateCode: true,
            },
          },
          CustomerGroupMember: {
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
          },
          _count: {
            select: {
              CustomerGroupMember: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // 2. 파트너(대리점장/판매원)가 생성한 그룹 (PartnerCustomerGroup) - 모든 파트너 그룹 조회
      const partnerGroups = await prisma.partnerCustomerGroup.findMany({
        include: {
          AffiliateProfile: {
            select: {
              id: true,
              displayName: true,
              branchLabel: true,
              affiliateCode: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // 파트너 그룹의 고객 수 조회
      const partnerGroupIds = partnerGroups.map(g => g.id);
      const partnerLeadCounts = partnerGroupIds.length > 0
        ? await prisma.affiliateLead.groupBy({
            by: ['groupId'],
            where: { groupId: { in: partnerGroupIds } },
            _count: true,
          })
        : [];
      const partnerLeadCountMap = new Map(partnerLeadCounts.map(c => [c.groupId, c._count]));

      // 관리자 그룹 변환
      const adminGroupsWithDetails = adminGroups.map((group) => ({
        id: group.id,
        source: 'admin' as const,
        adminId: group.adminId,
        name: group.name,
        description: group.description,
        color: group.color,
        parentGroupId: group.parentGroupId,
        affiliateProfileId: group.affiliateProfileId,
        affiliateProfile: group.AffiliateProfile ? {
          id: group.AffiliateProfile.id,
          displayName: group.AffiliateProfile.displayName,
          branchLabel: group.AffiliateProfile.branchLabel,
          affiliateCode: group.AffiliateProfile.affiliateCode,
          type: null,
        } : null,
        funnelTalkIds: group.funnelTalkIds
          ? (typeof group.funnelTalkIds === 'string'
              ? JSON.parse(group.funnelTalkIds)
              : Array.isArray(group.funnelTalkIds)
                ? group.funnelTalkIds
                : null)
          : null,
        funnelSmsIds: group.funnelSmsIds
          ? (typeof group.funnelSmsIds === 'string'
              ? JSON.parse(group.funnelSmsIds)
              : Array.isArray(group.funnelSmsIds)
                ? group.funnelSmsIds
                : null)
          : null,
        funnelEmailIds: group.funnelEmailIds
          ? (typeof group.funnelEmailIds === 'string'
              ? JSON.parse(group.funnelEmailIds)
              : Array.isArray(group.funnelEmailIds)
                ? group.funnelEmailIds
                : null)
          : null,
        reEntryHandling: group.reEntryHandling,
        autoMoveEnabled: group.autoMoveEnabled,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        members: group.CustomerGroupMember.map((member: any) => ({
          id: member.id,
          groupId: member.groupId,
          userId: member.userId,
          addedAt: member.addedAt.toISOString(),
          addedBy: member.addedBy,
          user: member.User_CustomerGroupMember_userIdToUser,
        })),
        _count: group._count,
        subGroups: [],
        parentGroup: group.parentGroupId ? { id: group.parentGroupId, name: null } : null,
        scheduledMessages: [],
      }));

      // 파트너 그룹 변환 (통일된 포맷으로)
      const partnerGroupsWithDetails = partnerGroups.map((group) => ({
        id: group.id,
        source: 'partner' as const,
        adminId: null,
        name: group.name,
        description: group.description,
        color: group.color,
        parentGroupId: null,
        affiliateProfileId: group.profileId,
        affiliateProfile: group.AffiliateProfile ? {
          id: group.AffiliateProfile.id,
          displayName: group.AffiliateProfile.displayName,
          branchLabel: group.AffiliateProfile.branchLabel,
          affiliateCode: group.AffiliateProfile.affiliateCode,
          type: group.AffiliateProfile.type,
        } : null,
        funnelTalkIds: group.funnelTalkIds,
        funnelSmsIds: group.funnelSmsIds,
        funnelEmailIds: group.funnelEmailIds,
        reEntryHandling: group.reEntryHandling,
        autoMoveEnabled: false,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        members: [], // 파트너 그룹은 별도 API로 고객 조회
        _count: { CustomerGroupMember: partnerLeadCountMap.get(group.id) || 0 },
        subGroups: [],
        parentGroup: null,
        scheduledMessages: [],
      }));

      // 모든 그룹을 합쳐서 최신순 정렬
      const allGroups = [...adminGroupsWithDetails, ...partnerGroupsWithDetails]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log('[Customer Groups GET] 그룹 목록 조회 성공 - 관리자:', adminGroupsWithDetails.length, '개, 파트너:', partnerGroupsWithDetails.length, '개');
      return NextResponse.json({ ok: true, groups: allGroups });
    } catch (dbError) {
      console.error('[Customer Groups GET] 데이터베이스 쿼리 오류:', dbError);
      console.error('[Customer Groups GET] 에러 타입:', dbError?.constructor?.name);
      console.error('[Customer Groups GET] 에러 메시지:', dbError instanceof Error ? dbError.message : String(dbError));
      console.error('[Customer Groups GET] 에러 스택:', dbError instanceof Error ? dbError.stack : String(dbError));
      throw dbError;
    }
  } catch (error) {
    console.error('[Customer Groups GET] 전체 에러:', error);
    console.error('[Customer Groups GET] 에러 타입:', error?.constructor?.name);
    console.error('[Customer Groups GET] 에러 메시지:', error instanceof Error ? error.message : String(error));
    console.error('[Customer Groups GET] 에러 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch customer groups',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// POST: 고객 그룹 생성
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      console.log('[Customer Groups POST] 인증 실패 - 403 반환');
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    console.log('[Customer Groups POST] 인증 성공, 그룹 생성 시작');
    
    const body = await req.json();
    const { name, description, color, userIds } = body;

    console.log('[Customer Groups POST] 요청 데이터:', { name, description, color, userIdsCount: userIds?.length || 0 });

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: '그룹 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    try {
      // 그룹 생성
      const group = await prisma.customerGroup.create({
        data: {
          adminId: admin.id,
          name: name.trim(),
          description: description?.trim() || null,
          color: color || null,
          CustomerGroupMember: userIds && Array.isArray(userIds) && userIds.length > 0
            ? {
                create: userIds.map((userId: number) => ({
                  userId,
                  addedBy: admin.id,
                })),
              }
            : undefined,
        },
        include: {
          CustomerGroupMember: {
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
          },
          _count: {
            select: {
              CustomerGroupMember: true,
            },
          },
        },
      });

      // 응답 데이터 변환
      const groupResponse = {
        id: group.id,
        adminId: group.adminId,
        name: group.name,
        description: group.description,
        color: group.color,
        parentGroupId: group.parentGroupId,
        affiliateProfileId: group.affiliateProfileId,
        affiliateProfile: group.AffiliateProfile ? {
          id: group.AffiliateProfile.id,
          displayName: group.AffiliateProfile.displayName,
          branchLabel: group.AffiliateProfile.branchLabel,
          affiliateCode: group.AffiliateProfile.affiliateCode,
        } : null,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        members: group.CustomerGroupMember.map((member: any) => ({
          id: member.id,
          groupId: member.groupId,
          userId: member.userId,
          addedAt: member.addedAt.toISOString(),
          addedBy: member.addedBy,
          user: member.User_CustomerGroupMember_userIdToUser,
        })),
        _count: group._count,
      };

      console.log('[Customer Groups POST] 그룹 생성 성공:', group.id);
      return NextResponse.json({ ok: true, group: groupResponse });
    } catch (dbError) {
      console.error('[Customer Groups POST] 데이터베이스 쿼리 오류:', dbError);
      console.error('[Customer Groups POST] 에러 스택:', dbError instanceof Error ? dbError.stack : String(dbError));
      throw dbError;
    }
  } catch (error) {
    console.error('[Customer Groups POST] 전체 에러:', error);
    console.error('[Customer Groups POST] 에러 타입:', error?.constructor?.name);
    console.error('[Customer Groups POST] 에러 메시지:', error instanceof Error ? error.message : String(error));
    console.error('[Customer Groups POST] 에러 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Failed to create customer group',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
