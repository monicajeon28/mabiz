export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

type ViewerType = 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT';

/**
 * GET /api/shared/customers/[leadId]
 * 통합 고객 상세 조회 - 권한에 따라 접근 가능 여부 체크
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { leadId } = await params;
    const leadIdNum = parseInt(leadId);
    if (isNaN(leadIdNum)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 고객 ID입니다.' }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const viewerType = searchParams.get('viewerType') as ViewerType | null;
    const viewerProfileId = searchParams.get('viewerProfileId');

    // 사용자 정보 및 프로필 조회
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        AffiliateProfile: {
          select: { id: true, type: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const profile = user.AffiliateProfile?.[0];

    // 고객 정보 조회 (상담기록 포함)
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadIdNum },
      include: {
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: { id: true, displayName: true, affiliateCode: true },
        },
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: { id: true, displayName: true, affiliateCode: true },
        },
        PartnerCustomerGroup: {
          select: { id: true, name: true },
        },
        AffiliateInteraction: {
          orderBy: { occurredAt: 'desc' },
          include: {
            User: {
              select: { id: true, name: true, phone: true },
            },
            AffiliateProfile: {
              select: { id: true, type: true, displayName: true },
            },
            AffiliateMedia: {
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                mimeType: true,
                storagePath: true,
                googleDriveFileId: true,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 권한 체크
    let hasAccess = false;
    let ownership: 'HQ' | 'BRANCH_MANAGER' | 'SALES_AGENT' = 'HQ';

    if (isAdmin) {
      // 본사(관리자)는 모든 고객 접근 가능
      hasAccess = true;
      ownership = 'HQ';
    } else if (profile) {
      if (profile.type === 'BRANCH_MANAGER') {
        // 대리점장: 자기 고객 + 소속 판매원 고객
        if (lead.managerId === profile.id || lead.agentId) {
          // 판매원이 있는 경우, 해당 판매원이 내 소속인지 확인
          if (lead.agentId) {
            // AffiliateRelation 테이블에서 대리점장-판매원 관계 확인
            const agentRelation = await prisma.affiliateRelation.findFirst({
              where: { agentId: lead.agentId, managerId: profile.id, status: 'ACTIVE' },
            });
            hasAccess = lead.managerId === profile.id || !!agentRelation;
          } else {
            hasAccess = lead.managerId === profile.id;
          }
        }
        ownership = 'BRANCH_MANAGER';
      } else if (profile.type === 'SALES_AGENT') {
        // 판매원: 자기 고객만
        hasAccess = lead.agentId === profile.id;
        ownership = 'SALES_AGENT';
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    // User 연결 정보 조회 (여권/PNR 링크용, 이메일, 몰 ID)
    let userId: number | null = null;
    let customerEmail: string | null = null;
    let mallUserId: string | null = null;
    if (lead.customerPhone) {
      const linkedUser = await prisma.user.findFirst({
        where: { phone: lead.customerPhone },
        select: { id: true, mallUserId: true, email: true },
      });
      if (linkedUser) {
        userId = linkedUser.id;
        customerEmail = linkedUser.email || null;
        mallUserId = linkedUser.mallUserId || null;
      }
    }

    // 응답 데이터 구성
    const customer = {
      id: lead.id,
      customerName: lead.customerName,
      customerPhone: lead.customerPhone,
      customerEmail,
      mallUserId,
      status: lead.status,
      notes: lead.notes,
      nextActionAt: lead.nextActionAt?.toISOString() || null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      passportRequestedAt: lead.passportRequestedAt?.toISOString() || null,
      passportCompletedAt: lead.passportCompletedAt?.toISOString() || null,
      source: lead.source,
      groupId: lead.groupId,
      groupName: lead.PartnerCustomerGroup?.name || null,
      manager: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile
        ? {
            id: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.id,
            displayName: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.displayName,
            affiliateCode: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.affiliateCode,
          }
        : null,
      agent: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile
        ? {
            id: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.id,
            displayName: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.displayName,
            affiliateCode: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.affiliateCode,
          }
        : null,
      ownership,
      interactions: lead.AffiliateInteraction.map((interaction) => ({
        id: interaction.id,
        interactionType: interaction.interactionType,
        occurredAt: interaction.occurredAt.toISOString(),
        note: interaction.note,
        profileId: interaction.profileId,
        createdBy: interaction.User
          ? {
              id: interaction.User.id,
              name: interaction.User.name,
              phone: interaction.User.phone,
            }
          : null,
        createdByType: interaction.AffiliateProfile?.type || null,
        media: interaction.AffiliateMedia.map((m) => ({
          id: m.id,
          fileName: m.fileName,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          url: m.storagePath,
          isBackedUp: !!m.googleDriveFileId,
          googleDriveFileId: m.googleDriveFileId,
        })),
      })),
      transferHistory: (lead.metadata as any)?.transferHistory || [],
      userId,
    };

    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    console.error('[Shared Customers GET] Error:', error);
    return NextResponse.json({ ok: false, message: '고객 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * PATCH /api/shared/customers/[leadId]
 * 고객 정보 수정
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser?.id) {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const { leadId } = await params;
    const leadIdNum = parseInt(leadId);
    if (isNaN(leadIdNum)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 고객 ID입니다.' }, { status: 400 });
    }

    const body = await req.json();
    const { viewerType, viewerProfileId, ...updates } = body;

    // 사용자 정보 및 프로필 조회
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        AffiliateProfile: {
          select: { id: true, type: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const profile = user.AffiliateProfile?.[0];

    // 기존 고객 조회
    const existingLead = await prisma.affiliateLead.findUnique({
      where: { id: leadIdNum },
    });

    if (!existingLead) {
      return NextResponse.json({ ok: false, message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 권한 체크
    let hasAccess = false;
    if (isAdmin) {
      hasAccess = true;
    } else if (profile) {
      if (profile.type === 'BRANCH_MANAGER') {
        if (existingLead.managerId === profile.id) {
          hasAccess = true;
        } else if (existingLead.agentId) {
          // AffiliateRelation 테이블에서 대리점장-판매원 관계 확인
          const agentRelation = await prisma.affiliateRelation.findFirst({
            where: { agentId: existingLead.agentId, managerId: profile.id, status: 'ACTIVE' },
          });
          hasAccess = !!agentRelation;
        }
      } else if (profile.type === 'SALES_AGENT') {
        hasAccess = existingLead.agentId === profile.id;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ ok: false, message: '수정 권한이 없습니다.' }, { status: 403 });
    }

    // 업데이트 데이터 구성
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.customerName !== undefined) updateData.customerName = updates.customerName;
    if (updates.customerPhone !== undefined) updateData.customerPhone = updates.customerPhone;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.nextActionAt !== undefined) {
      updateData.nextActionAt = updates.nextActionAt ? new Date(updates.nextActionAt) : null;
    }
    if (updates.groupId !== undefined) updateData.groupId = updates.groupId;

    // 판매원 할당 (대리점장만 가능)
    if (updates.agentProfileId !== undefined && (isAdmin || profile?.type === 'BRANCH_MANAGER')) {
      updateData.agentId = updates.agentProfileId ? parseInt(updates.agentProfileId) : null;
    }

    // 업데이트 실행
    const updatedLead = await prisma.affiliateLead.update({
      where: { id: leadIdNum },
      include: {
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: { id: true, displayName: true, affiliateCode: true },
        },
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: { id: true, displayName: true, affiliateCode: true },
        },
        PartnerCustomerGroup: {
          select: { id: true, name: true },
        },
      },
      data: updateData,
    });

    // 응답 구성
    const customer = {
      id: updatedLead.id,
      customerName: updatedLead.customerName,
      customerPhone: updatedLead.customerPhone,
      status: updatedLead.status,
      notes: updatedLead.notes,
      nextActionAt: updatedLead.nextActionAt?.toISOString() || null,
      createdAt: updatedLead.createdAt.toISOString(),
      updatedAt: updatedLead.updatedAt.toISOString(),
      passportRequestedAt: updatedLead.passportRequestedAt?.toISOString() || null,
      passportCompletedAt: updatedLead.passportCompletedAt?.toISOString() || null,
      source: updatedLead.source,
      groupId: updatedLead.groupId,
      groupName: updatedLead.PartnerCustomerGroup?.name || null,
      manager: updatedLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile
        ? {
            id: updatedLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.id,
            displayName: updatedLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.displayName,
            affiliateCode: updatedLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile.affiliateCode,
          }
        : null,
      agent: updatedLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile
        ? {
            id: updatedLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.id,
            displayName: updatedLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.displayName,
            affiliateCode: updatedLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile.affiliateCode,
          }
        : null,
    };

    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    console.error('[Shared Customers PATCH] Error:', error);
    return NextResponse.json({ ok: false, message: '고객 정보 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
