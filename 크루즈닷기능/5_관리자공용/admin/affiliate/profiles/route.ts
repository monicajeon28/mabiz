export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { profileInclude, serializeProfile, toNullableString, syncSalesAgentMentor } from './shared';
import { generateAffiliateCode } from '@/lib/affiliate/code-generator';

function requireAdmin(user: { id: number } | null, role: string | undefined) {
  if (!user) {
    console.error('[requireAdmin] No user provided');
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  if (role !== 'admin') {
    console.error('[requireAdmin] Invalid role:', role, 'for user:', user.id);
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

/**
 * 파트너 아이디 생성 (숫자만 증가)
 * - 대리점장: boss1, boss2, boss3...
 * - 판매원: user1, user2, user3...
 * phone 필드에 저장됨
 * - 프리세일즈(독립형): free1, free2, free3...
 */
async function generatePartnerId(type: 'BRANCH_MANAGER' | 'SALES_AGENT', name: string, isFree?: boolean): Promise<string> {
  const prefix = type === 'BRANCH_MANAGER' ? 'boss' : (isFree ? 'free' : 'user');
  
  // phone 필드에서 해당 prefix 형식 찾기 (이름 포함/미포함 모두)
  const existing = await prisma.user.findMany({
    where: {
      phone: {
        startsWith: prefix,
      },
    },
    select: { phone: true },
  });

  const used = new Set<number>();
  existing.forEach((record) => {
    if (!record.phone) return;
    // boss1 또는 boss1-홍길동 형식 모두 체크
    const match = record.phone.match(new RegExp(`^${prefix}(\\d{1,5})(?:-.*)?$`, 'i'));
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num)) {
        used.add(num);
      }
    }
  });

  // 1부터 시작해서 사용 가능한 번호 찾기
  for (let i = 1; i <= 99999; i += 1) {
    if (!used.has(i)) {
      // 숫자만 반환 (이름 제거)
      return `${prefix}${i}`;
    }
  }

  const roleName = type === 'BRANCH_MANAGER' ? '대리점장' : (isFree ? '프리세일즈' : '판매원');
  throw new Error(`사용 가능한 ${roleName} 아이디가 없습니다.`);
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export async function GET(req: NextRequest) {
  try {
    let sessionUser;
    try {
      sessionUser = await getSessionUser();
    } catch (authError) {
      console.error('[admin/affiliate/profiles][GET] getSessionUser error:', authError);
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    let dbUser;
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { role: true },
      });
      logger.log('[admin/affiliate/profiles][GET] User role check:', {
        userId: sessionUser.id,
        role: dbUser?.role,
        sessionUserRole: sessionUser.role,
      });
    } catch (dbError) {
      console.error('[admin/affiliate/profiles][GET] dbUser query error:', dbError);
      return NextResponse.json({ ok: false, message: 'Database error' }, { status: 500 });
    }

    // sessionUser.role도 체크 (getSessionUser가 role을 포함하는 경우)
    const userRole = dbUser?.role || (sessionUser as any).role;
    const adminCheck = requireAdmin(sessionUser, userRole);
    if (adminCheck) return adminCheck;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const typeFilter = searchParams.get('type');
    const statusFilter = searchParams.get('status');
    const publishedFilter = searchParams.get('published');

    const where: any = {};

    if (typeFilter && ['HQ', 'BRANCH_MANAGER', 'SALES_AGENT'].includes(typeFilter)) {
      where.type = typeFilter;
    }

    if (statusFilter && ['DRAFT', 'AWAITING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(statusFilter)) {
      where.status = statusFilter;
    }

    if (publishedFilter === 'true') {
      where.published = true;
    } else if (publishedFilter === 'false') {
      where.published = false;
    }

    if (search) {
      where.OR = [
        { nickname: { contains: search } },
        { displayName: { contains: search } },
        { branchLabel: { contains: search } },
        { affiliateCode: { contains: search } },
        {
          User: {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
            ],
          },
        },
      ];
    }

    let profiles;
    try {
      // Prisma Client는 스키마의 관계 필드명을 그대로 사용하므로 User (PascalCase) 사용
      // User가 null일 수 있으므로 안전하게 처리
      // 성능 최적화: include 대신 select 사용
      profiles = await prisma.affiliateProfile.findMany({
        where,
        select: {
          id: true,
          userId: true,
          affiliateCode: true,
          type: true,
          status: true,
          displayName: true,
          branchLabel: true,
          nickname: true,
          published: true,
          createdAt: true,
          updatedAt: true,
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              onboarded: true,
              mallNickname: true,
              mallUserId: true,
              password: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 250,
      });
      logger.log('[admin/affiliate/profiles][GET] Successfully fetched profiles:', profiles.length);
      logger.log('[admin/affiliate/profiles][GET] Query filters:', { where, typeFilter, statusFilter, publishedFilter, search });
      logger.log('[admin/affiliate/profiles][GET] Profile details:', profiles.map(p => ({ 
        id: p.id, 
        userId: p.userId, 
        type: p.type, 
        status: p.status, 
        displayName: p.displayName,
        affiliateCode: p.affiliateCode,
        hasUser: !!p.User 
      })));
      
      // User가 null인 프로필 필터링 및 로깅
      const profilesWithUser = profiles.filter((p) => p.User !== null);
      const profilesWithoutUser = profiles.filter((p) => p.User === null);
      if (profilesWithoutUser.length > 0) {
        console.warn('[admin/affiliate/profiles][GET] Profiles without User:', profilesWithoutUser.length, 'profiles:', profilesWithoutUser.map(p => ({ id: p.id, userId: p.userId, type: p.type, status: p.status })));
      }
      profiles = profilesWithUser;
      logger.log('[admin/affiliate/profiles][GET] Profiles with valid User:', profiles.length);
    } catch (queryError: any) {
      console.error('[admin/affiliate/profiles][GET] Prisma query error:', queryError);
      console.error('[admin/affiliate/profiles][GET] Query error details:', queryError instanceof Error ? queryError.message : String(queryError));
      console.error('[admin/affiliate/profiles][GET] Prisma error code:', queryError?.code);
      console.error('[admin/affiliate/profiles][GET] Prisma error meta:', queryError?.meta);
      if (queryError?.stack) {
        console.error('[admin/affiliate/profiles][GET] Error stack:', queryError.stack);
      }
      throw queryError;
    }

    let serializedProfiles;
    try {
      serializedProfiles = profiles.map((p) => {
        try {
          return serializeProfile(p, true); // 관리자이므로 비밀번호 포함
        } catch (itemError) {
          console.error(`[admin/affiliate/profiles][GET] Serialization error for profile ${p.id}:`, itemError);
          // 기본 프로필 정보만 반환
          return {
            id: p.id,
            userId: p.userId,
            affiliateCode: p.affiliateCode || null,
            type: p.type,
            status: p.status,
            displayName: p.displayName || null,
            branchLabel: p.branchLabel || null,
            nickname: p.nickname || null,
            published: p.published || false,
            user: (p as any).User
              ? {
                  id: (p as any).User?.id,
                  name: (p as any).User?.name || null,
                  email: (p as any).User?.email || null,
                  phone: (p as any).User?.phone || null,
                  role: (p as any).User?.role || null,
                  onboarded: (p as any).User?.onboarded || false,
                  mallNickname: (p as any).User?.mallNickname || null,
                  mallUserId: (p as any).User?.mallUserId || null,
                  password: (p as any).User?.password || null,
                }
              : null,
            manager: null,
            counts: {
              managedAgents: 0,
              assignedManagers: 0,
              totalLinks: 0,
              totalLeads: 0,
              totalSales: 0,
            },
            createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.createdAt || null),
            updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : (p.updatedAt || null),
          };
        }
      });
    } catch (serializeError) {
      console.error('[admin/affiliate/profiles][GET] Serialize error:', serializeError);
      throw serializeError;
    }

    return NextResponse.json({
      ok: true,
      profiles: serializedProfiles,
    });
  } catch (error: any) {
    console.error('[admin/affiliate/profiles][GET] error:', error);
    console.error('[admin/affiliate/profiles][GET] error details:', error instanceof Error ? error.message : String(error));
    console.error('[admin/affiliate/profiles][GET] error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Prisma 에러 상세 정보
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('[admin/affiliate/profiles][GET] Prisma error code:', error.code);
      console.error('[admin/affiliate/profiles][GET] Prisma error meta:', error.meta);
    }
    
    // 개발 환경에서는 상세 에러 정보 반환
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json({ 
      ok: false, 
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
      ...(isDev && error instanceof Error ? { stack: error.stack } : {}),
      ...(error?.code ? { prismaCode: error.code } : {}),
      ...(error?.meta ? { prismaMeta: error.meta } : {})
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    
    logger.log('[admin/affiliate/profiles][POST] User role check:', {
      userId: sessionUser.id,
      role: dbUser?.role,
      sessionUserRole: sessionUser.role,
    });

    // sessionUser.role도 체크 (getSessionUser가 role을 포함하는 경우)
    const userRole = dbUser?.role || sessionUser.role;
    const adminCheck = requireAdmin(sessionUser, userRole);
    if (adminCheck) return adminCheck;

    const data = await req.json();

    const mallUserIdValue =
      data.mallUserId !== undefined ? toNullableString(data.mallUserId) ?? null : undefined;

    const type = data.type as string | undefined;
    if (!type || !['HQ', 'BRANCH_MANAGER', 'SALES_AGENT'].includes(type)) {
      return NextResponse.json({ ok: false, message: '유효한 어필리에이트 유형이 필요합니다.' }, { status: 400 });
    }

    // 사용자 ID가 없거나 0이면 자동 생성 (계약서 승인과 동일한 방식)
    // 단, HQ 타입은 사용자 계정 자동 생성 불가
    let userId: number;
    let userRecord: { id: number; phone: string | null; mallUserId: string | null; mallNickname: string | null; role: string | null; password: string | null } | null = null;
    const providedUserId = data.userId ? Number(data.userId) : null;

    // HQ 타입은 사용자 계정 자동 생성 불가
    if (type === 'HQ') {
      if (!providedUserId || Number.isNaN(providedUserId) || providedUserId <= 0) {
        return NextResponse.json({ ok: false, message: 'HQ 타입은 기존 사용자 ID가 필요합니다.' }, { status: 400 });
      }
      userId = providedUserId;
      userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
      });
      if (!userRecord) {
        return NextResponse.json({ ok: false, message: '존재하지 않는 사용자입니다.' }, { status: 404 });
      }
    } else if (providedUserId && !Number.isNaN(providedUserId) && providedUserId > 0) {
      // 기존 사용자 ID가 제공된 경우
      userId = providedUserId;
      userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
      });

      if (!userRecord) {
        return NextResponse.json({ ok: false, message: '존재하지 않는 사용자입니다.' }, { status: 404 });
      }
    } else {
      // 사용자 계정 자동 생성 (계약서 승인과 동일한 방식)
      const partnerType = type === 'BRANCH_MANAGER' ? 'BRANCH_MANAGER' : 'SALES_AGENT';
      const isFreeAgent = type === 'SALES_AGENT' && !data.managerProfileId;
      const name = toNullableString(data.displayName) || toNullableString(data.nickname) || '파트너';
      const partnerId = await generatePartnerId(partnerType, name, isFreeAgent);

      // 전화번호로 기존 사용자 확인
      const contactPhone = toNullableString(data.contactPhone);
      let existingUser = null;
      if (contactPhone) {
        const normalizedPhone = normalizePhone(contactPhone);
        const digitsPhone = contactPhone.replace(/[^0-9]/g, '');
        
        existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ phone: normalizedPhone }, { phone: digitsPhone }],
          },
          select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
        });
      }

      if (existingUser) {
        // 기존 사용자가 있으면 그대로 사용
        userId = existingUser.id;
        userRecord = existingUser;
      } else {
        // 신규 사용자 생성: phone 필드에 boss1/user1... 저장, 비밀번호 1101
        const newUser = await prisma.user.create({
          data: {
            name: name,
            phone: partnerId, // phone 필드에 boss1, user1... 저장
            email: toNullableString(data.contactEmail) || undefined,
            password: '1101', // 비밀번호 1101로 고정
            role: 'community',
            customerSource: 'affiliate-manual-creation',
            customerStatus: 'pending',
            adminMemo: `Auto-created from manual affiliate profile creation by admin ${sessionUser.id}`,
            mallUserId: partnerId, // mallUserId에도 동일하게 저장 (호환성)
            mallNickname: name,
          },
          select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
        });
        userId = newUser.id;
        userRecord = newUser;
      }

      // phone 필드가 boss1/user1/free1 형식이 아니면 업데이트
      const partnerIdPattern = partnerType === 'BRANCH_MANAGER' ? /^boss\d+(-.*)?$/i : (isFreeAgent ? /^free\d+(-.*)?$/i : /^user\d+(-.*)?$/i);
      if (userRecord && (!userRecord.phone || !userRecord.phone.match(partnerIdPattern))) {
        const updateData: Record<string, unknown> = {
          phone: partnerId,
          mallUserId: partnerId, // 호환성을 위해 mallUserId도 업데이트
        };
        if (!userRecord.mallNickname) {
          updateData.mallNickname = name;
        }
        if (userRecord.role !== 'community') {
          updateData.role = 'community';
        }
        // 비밀번호가 1101이 아니면 1101로 설정
        if (userRecord.password !== '1101') {
          updateData.password = '1101';
          // 비밀번호 변경 이벤트 기록
          await prisma.passwordEvent.create({
            data: {
              userId: userRecord.id,
              from: userRecord.password || '',
              to: '1101',
              reason: `본사 수동 프로필 생성 시 자동 설정 (관리자 ID: ${sessionUser.id})`,
            },
          });
        }
        
        const updated = await prisma.user.update({
          where: { id: userRecord.id },
          data: updateData,
          select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
        });
        userRecord = { ...userRecord, ...updated };
      }
    }

    // 기존 프로필 확인
    const existingProfile = await prisma.affiliateProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingProfile) {
      return NextResponse.json({ ok: false, message: '이미 해당 사용자에 대한 어필리에이트 프로필이 존재합니다.' }, { status: 409 });
    }

    // 어필리에이트 코드 생성 (이름과 사용자 ID 사용)
    const nameForCode = toNullableString(data.displayName) || toNullableString(data.nickname) || 'partner';
    const affiliateCode = (data.affiliateCode as string | undefined)?.trim() || generateAffiliateCode(nameForCode, userId);

    let managerProfileId: number | null = null;
    if (type === 'SALES_AGENT') {
      if (data.managerProfileId !== undefined && data.managerProfileId !== null && String(data.managerProfileId).toUpperCase() !== 'HQ' && `${data.managerProfileId}`.trim() !== '') {
        const parsedManagerId = Number(data.managerProfileId);
        if (!parsedManagerId || Number.isNaN(parsedManagerId)) {
          return NextResponse.json({ ok: false, message: '유효한 대리점장 ID가 필요합니다.' }, { status: 400 });
        }

        const managerProfile = await prisma.affiliateProfile.findUnique({
          where: { id: parsedManagerId },
          select: { id: true, type: true, status: true },
        });

        if (!managerProfile || managerProfile.type !== 'BRANCH_MANAGER') {
          return NextResponse.json({ ok: false, message: '대리점장 프로필만 지정할 수 있습니다.' }, { status: 400 });
        }

        managerProfileId = managerProfile.id;
      }
    }

    // landingSlug는 자동 생성된 경우 phone 필드의 boss1/user1... 사용
    let landingSlug = toNullableString(data.landingSlug);
    if (!landingSlug && userRecord?.phone) {
      const partnerIdPattern = type === 'BRANCH_MANAGER' ? /^boss\d+(-.*)?$/i : /^user\d+(-.*)?$/i;
      if (userRecord.phone.match(partnerIdPattern)) {
        landingSlug = userRecord.phone;
      }
    }

    const payload: Record<string, unknown> = {
      user: { connect: { id: userId } },
      affiliateCode,
      type: type as any,
      status: (data.status as string | undefined) ?? 'DRAFT',
      displayName: toNullableString(data.displayName) ?? undefined,
      branchLabel: toNullableString(data.branchLabel) ?? undefined,
      nickname: toNullableString(data.nickname) ?? undefined,
      profileTitle: toNullableString(data.profileTitle) ?? undefined,
      bio: toNullableString(data.bio) ?? undefined,
      profileImage: toNullableString(data.profileImage) ?? undefined,
      coverImage: toNullableString(data.coverImage) ?? undefined,
      contactPhone: toNullableString(data.contactPhone) ?? undefined,
      contactEmail: toNullableString(data.contactEmail) ?? undefined,
      kakaoLink: toNullableString(data.kakaoLink) ?? undefined,
      instagramHandle: toNullableString(data.instagramHandle) ?? undefined,
      youtubeChannel: toNullableString(data.youtubeChannel) ?? undefined,
      homepageUrl: toNullableString(data.homepageUrl) ?? undefined,
      landingSlug: landingSlug ?? undefined,
      landingAnnouncement: toNullableString(data.landingAnnouncement) ?? undefined,
      welcomeMessage: toNullableString(data.welcomeMessage) ?? undefined,
      published: data.published !== undefined ? Boolean(data.published) : true,
      bankName: toNullableString(data.bankName) ?? undefined,
      bankAccount: toNullableString(data.bankAccount) ?? undefined,
      bankAccountHolder: toNullableString(data.bankAccountHolder) ?? undefined,
      withholdingRate: data.withholdingRate !== undefined ? Number(data.withholdingRate) : 3.3,
      contractStatus: (data.contractStatus as string | undefined) ?? 'DRAFT',
      metadata: data.metadata ?? undefined,
    };

    if (payload.published) {
      payload.publishedAt = new Date();
    }

    const profile = await prisma.$transaction(async (tx) => {
      const created = await tx.affiliateProfile.create({
        data: payload as any,
        include: profileInclude,
      });
      if (mallUserIdValue !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { mallUserId: mallUserIdValue },
        });
      }
      return created;
    });

    if (type === 'SALES_AGENT') {
      await syncSalesAgentMentor(profile.id, managerProfileId);
    }

    // 자동 설정: 기본 리소스 생성 (링크, 고객 그룹, 랜딩 페이지)
    try {
      const { autoSetupAffiliateProfile } = await import('@/lib/affiliate/auto-setup');
      await autoSetupAffiliateProfile(profile.id);
    } catch (autoSetupError) {
      console.error('[admin/affiliate/profiles][POST] Auto-setup error:', autoSetupError);
      // 자동 설정 실패해도 프로필 생성은 성공으로 처리
    }

    const refreshed = await prisma.affiliateProfile.findUnique({
      where: { id: profile.id },
      include: profileInclude,
    });

    return NextResponse.json({ ok: true, profile: serializeProfile(refreshed!, true) }); // 관리자이므로 비밀번호 포함
  } catch (error: any) {
    console.error('[admin/affiliate/profiles][POST] error:', error);
    console.error('[admin/affiliate/profiles][POST] error details:', error instanceof Error ? error.message : String(error));
    console.error('[admin/affiliate/profiles][POST] error stack:', error instanceof Error ? error.stack : 'No stack trace');

    if (error?.code === 'P2002') {
      return NextResponse.json({ ok: false, message: '이미 사용 중인 고유 값이 있습니다. 랜딩 슬러그나 코드가 중복되지 않도록 확인해주세요.' }, { status: 409 });
    }

    if (error?.code === 'P2003') {
      return NextResponse.json({ ok: false, message: '연결된 사용자 정보를 확인할 수 없습니다.' }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: false, 
      message: 'Server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
