export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/leads/[leadId]/route.ts
// 어필리에이트 Lead 상세 조회/수정 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET: Lead 상세 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { leadId: leadIdStr } = await params;
    const leadId = Number(leadIdStr);
    if (isNaN(leadId)) {
      return NextResponse.json({ ok: false, message: 'Invalid lead ID' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        role: true,
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });
    }

    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      include: {
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            branchLabel: true,
          },
        },
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
          },
        },
        AffiliateLink: {
          select: {
            id: true,
            code: true,
            title: true,
            productCode: true,
          },
        },
        AffiliateInteraction: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            AffiliateMedia: {
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                mimeType: true,
                storagePath: true,
                createdAt: true,
              },
            },
          },
          orderBy: { occurredAt: 'desc' },
        },
        AffiliateSale: {
          include: {
            AffiliateProduct: {
              select: {
                title: true,
                productCode: true,
              },
            },
            AffiliateProfile_managerIdToAffiliateProfile: {
              select: {
                id: true,
                displayName: true,
                affiliateCode: true,
              },
            },
            AffiliateProfile_agentIdToAffiliateProfile: {
              select: {
                id: true,
                displayName: true,
                affiliateCode: true,
              },
            },
          },
          orderBy: { saleDate: 'desc' },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, message: 'Lead not found' }, { status: 404 });
    }

    // 권한 체크
    if (user.role === 'admin') {
      // 관리자: 모든 Lead 조회 가능
    } else if (user.AffiliateProfile?.type === 'BRANCH_MANAGER') {
      // 대리점장: 본인 및 본인 판매원 Lead만 조회 가능
      const profileId = user.AffiliateProfile.id;
      if (lead.managerId !== profileId && lead.agentId !== profileId) {
        // 판매원이 본인 팀에 속해있는지 확인
        if (lead.agentId) {
          const relation = await prisma.affiliateRelation.findFirst({
            where: {
              managerId: profileId,
              agentId: lead.agentId,
              status: 'ACTIVE',
            },
          });
          if (!relation) {
            return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
          }
        } else {
          return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
        }
      }
    } else if (user.AffiliateProfile?.type === 'SALES_AGENT') {
      // 판매원: 본인 Lead만 조회 가능
      if (lead.agentId !== user.AffiliateProfile.id) {
        return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
    }

    // 병렬 쿼리: 여권 제출 정보 + User ID 동시 조회 (성능 최적화)
    const [passportSubmissions, matchedUser] = await Promise.all([
      // 여권 제출 정보 조회
      lead.customerPhone
        ? prisma.passportSubmission.findMany({
            where: {
              User: { phone: lead.customerPhone },
              isSubmitted: true,
            },
            select: {
              id: true,
              submittedAt: true,
              PassportSubmissionGuest: {
                select: {
                  id: true,
                  name: true,
                  passportNumber: true,
                  passportExpiryDate: true,
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
            take: 1,
          }).catch(() => [] as any[])
        : Promise.resolve([] as any[]),
      // User ID 조회
      lead.customerPhone
        ? prisma.user.findFirst({
            where: { phone: lead.customerPhone },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    const userId = matchedUser?.id || null;

    // 응답 데이터 형식화 (Prisma 필드명을 프론트엔드 호환 형식으로 변환)
    const formattedLead = {
      ...lead,
      manager: lead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile,
      agent: lead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile,
      link: lead.AffiliateLink,
      interactions: lead.AffiliateInteraction?.map((interaction: any) => ({
        ...interaction,
        createdBy: interaction.User,
        media: interaction.AffiliateMedia,
      })) || [],
      sales: (lead.AffiliateSale || []).map((sale: any) => ({
        ...sale,
        product: sale.AffiliateProduct ? {
          ...sale.AffiliateProduct,
          productName: sale.AffiliateProduct.title, // title을 productName으로 매핑
        } : null,
        manager: sale.AffiliateProfile_managerIdToAffiliateProfile,
        agent: sale.AffiliateProfile_agentIdToAffiliateProfile,
      })),
      passportSubmissions: passportSubmissions.map((submission: any) => ({
        ...submission,
        guests: submission.PassportSubmissionGuest || [],
      })),
    };

    // Prisma 필드명 제거
    delete (formattedLead as any).AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile;
    delete (formattedLead as any).AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile;
    delete (formattedLead as any).AffiliateLink;
    delete (formattedLead as any).AffiliateInteraction;
    delete (formattedLead as any).AffiliateSale;

    return NextResponse.json({
      ok: true,
      lead: { ...formattedLead, userId },
    });
  } catch (error: any) {
    console.error('GET /api/admin/affiliate/leads/[leadId] error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json({
      ok: false,
      message: '고객 정보를 불러오지 못했습니다.',
      error: error?.message || String(error),
      ...(process.env.NODE_ENV === 'development' ? { details: error } : {}),
    }, { status: 500 });
  }
}

/**
 * PUT: Lead 수정 (이름, 전화번호 등)
 * - 관리자: 모든 Lead 수정 가능
 * - 대리점장: 본인 및 본인 판매원 Lead 수정 가능
 * - 판매원: 본인 Lead 수정 가능
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { leadId: leadIdStr } = await params;
    const leadId = Number(leadIdStr);
    if (isNaN(leadId)) {
      return NextResponse.json({ ok: false, message: 'Invalid lead ID' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        role: true,
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });
    }

    // 기존 Lead 조회 (이력 기록을 위해 상세 정보 포함)
    const existingLead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      include: {
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
          },
        },
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
          },
        },
      },
    });

    if (!existingLead) {
      return NextResponse.json({ ok: false, message: 'Lead not found' }, { status: 404 });
    }

    // 권한 체크
    if (user.role === 'admin') {
      // 관리자: 모든 Lead 수정 가능
    } else if (user.AffiliateProfile?.type === 'BRANCH_MANAGER') {
      // 대리점장: 본인 및 본인 판매원 Lead만 수정 가능
      const profileId = user.AffiliateProfile.id;
      if (existingLead.managerId !== profileId && existingLead.agentId !== profileId) {
        // 판매원이 본인 팀에 속해있는지 확인
        if (existingLead.agentId) {
          const relation = await prisma.affiliateRelation.findFirst({
            where: {
              managerId: profileId,
              agentId: existingLead.agentId,
              status: 'ACTIVE',
            },
          });
          if (!relation) {
            return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
          }
        } else {
          return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
        }
      }
    } else if (user.AffiliateProfile?.type === 'SALES_AGENT') {
      // 판매원: 본인 Lead만 수정 가능
      if (existingLead.agentId !== user.AffiliateProfile.id) {
        return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const {
      customerName,
      customerPhone,
      status,
      notes,
      lastContactedAt,
      nextActionAt,
      metadata,
      managerId, // 담당 대리점장 변경 (관리자만)
      agentId,   // 담당 판매원 변경 (관리자만)
    } = body;

    // 업데이트 데이터 준비
    const updateData: any = {};
    if (customerName !== undefined) updateData.customerName = customerName || null;
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone || null;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;
    if (lastContactedAt !== undefined) {
      updateData.lastContactedAt = lastContactedAt ? new Date(lastContactedAt) : null;
    }
    if (nextActionAt !== undefined) {
      updateData.nextActionAt = nextActionAt ? new Date(nextActionAt) : null;
    }
    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }

    // 관리자만 담당자 변경 가능
    if (user.role === 'admin') {
      if (managerId !== undefined) {
        if (managerId === null || managerId === '') {
          updateData.managerId = null;
        } else {
          const managerIdNum = parseInt(String(managerId));
          if (!isNaN(managerIdNum)) {
            // 대리점장 프로필 확인
            const managerProfile = await prisma.affiliateProfile.findFirst({
              where: {
                id: managerIdNum,
                type: 'BRANCH_MANAGER',
                status: 'ACTIVE',
              },
            });
            if (managerProfile) {
              updateData.managerId = managerIdNum;
            } else {
              return NextResponse.json({ ok: false, message: 'Invalid manager ID' }, { status: 400 });
            }
          }
        }
      }

      if (agentId !== undefined) {
        if (agentId === null || agentId === '') {
          updateData.agentId = null;
        } else {
          const agentIdNum = parseInt(String(agentId));
          if (!isNaN(agentIdNum)) {
            // 판매원 프로필 확인
            const agentProfile = await prisma.affiliateProfile.findFirst({
              where: {
                id: agentIdNum,
                type: 'SALES_AGENT',
                status: 'ACTIVE',
              },
            });
            if (agentProfile) {
              updateData.agentId = agentIdNum;
              // 판매원이 변경되면 해당 판매원의 대리점장도 자동 설정
              if (!updateData.managerId) {
                const relation = await prisma.affiliateRelation.findFirst({
                  where: {
                    agentId: agentIdNum,
                    status: 'ACTIVE',
                  },
                  select: { managerId: true },
                });
                if (relation) {
                  updateData.managerId = relation.managerId;
                }
              }
            } else {
              return NextResponse.json({ ok: false, message: 'Invalid agent ID' }, { status: 400 });
            }
          }
        }
      }
    }

    // Lead 수정
    const updatedLead = await prisma.affiliateLead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            branchLabel: true,
          },
        },
        AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
          },
        },
        AffiliateLink: {
          select: {
            id: true,
            code: true,
            title: true,
            productCode: true,
          },
        },
      },
    });

    // 응답 데이터 형식화
    const formattedUpdatedLead = {
      ...updatedLead,
      manager: updatedLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile,
      agent: updatedLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile,
      link: updatedLead.AffiliateLink,
    };

    delete (formattedUpdatedLead as any).AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile;
    delete (formattedUpdatedLead as any).AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile;
    delete (formattedUpdatedLead as any).AffiliateLink;

    // 상호작용 기록 생성 (변경 사항이 있는 경우)
    if (Object.keys(updateData).length > 0) {
      // 소속 변경 이력 상세 기록
      const changeDetails: string[] = [];
      const changeMetadata: any = {
        changes: updateData,
        updatedAt: new Date().toISOString(),
        changedBy: user.name || `Admin (${user.id})`,
      };

      // 대리점장 변경 이력
      if (updateData.managerId !== undefined) {
        const oldManager = existingLead.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile;
        const newManagerId = updateData.managerId;

        let newManager = null;
        if (newManagerId) {
          newManager = await prisma.affiliateProfile.findUnique({
            where: { id: newManagerId },
            select: { displayName: true, nickname: true, affiliateCode: true },
          });
        }

        const oldManagerName = oldManager
          ? (oldManager.nickname || oldManager.displayName || '이름 없음') + (oldManager.affiliateCode ? ` (${oldManager.affiliateCode})` : '')
          : '본사 직속';
        const newManagerName = newManager
          ? (newManager.nickname || newManager.displayName || '이름 없음') + (newManager.affiliateCode ? ` (${newManager.affiliateCode})` : '')
          : '본사 직속';

        if (existingLead.managerId !== newManagerId) {
          changeDetails.push(`담당 대리점장: ${oldManagerName} → ${newManagerName}`);
          changeMetadata.managerChange = {
            from: {
              id: existingLead.managerId,
              name: oldManagerName,
            },
            to: {
              id: newManagerId,
              name: newManagerName,
            },
          };
        }
      }

      // 판매원 변경 이력
      if (updateData.agentId !== undefined) {
        const oldAgent = existingLead.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile;
        const newAgentId = updateData.agentId;

        let newAgent = null;
        if (newAgentId) {
          newAgent = await prisma.affiliateProfile.findUnique({
            where: { id: newAgentId },
            select: { displayName: true, nickname: true, affiliateCode: true },
          });
        }

        const oldAgentName = oldAgent
          ? (oldAgent.nickname || oldAgent.displayName || '이름 없음') + (oldAgent.affiliateCode ? ` (${oldAgent.affiliateCode})` : '')
          : '없음';
        const newAgentName = newAgent
          ? (newAgent.nickname || newAgent.displayName || '이름 없음') + (newAgent.affiliateCode ? ` (${newAgent.affiliateCode})` : '')
          : '없음';

        if (existingLead.agentId !== newAgentId) {
          changeDetails.push(`담당 판매원: ${oldAgentName} → ${newAgentName}`);
          changeMetadata.agentChange = {
            from: {
              id: existingLead.agentId,
              name: oldAgentName,
            },
            to: {
              id: newAgentId,
              name: newAgentName,
            },
          };
        }
      }

      // 기타 변경 사항
      const otherChanges = Object.keys(updateData).filter(
        key => key !== 'managerId' && key !== 'agentId'
      );
      if (otherChanges.length > 0) {
        changeDetails.push(`기타 변경: ${otherChanges.join(', ')}`);
      }

      const note = changeDetails.length > 0
        ? changeDetails.join(' | ')
        : `고객 정보가 수정되었습니다: ${Object.keys(updateData).join(', ')}`;

      await prisma.affiliateInteraction.create({
        data: {
          leadId: leadId,
          profileId: user.AffiliateProfile?.id || null,
          createdById: user.id,
          interactionType: 'UPDATED',
          note: note,
          metadata: changeMetadata,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      lead: formattedUpdatedLead,
      message: '고객 정보가 수정되었습니다.',
    });
  } catch (error) {
    console.error('PUT /api/admin/affiliate/leads/[leadId] error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH: Lead 부분 수정 (노트 등)
 * - PUT과 동일한 권한 체크 적용
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  // PATCH는 PUT과 동일하게 동작
  return PUT(req, { params });
}

/**
 * DELETE: Lead 삭제
 * - 관리자만 가능
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const { leadId: leadIdStr } = await params;
    const leadId = Number(leadIdStr);
    if (isNaN(leadId)) {
      return NextResponse.json({ ok: false, message: 'Invalid lead ID' }, { status: 400 });
    }

    // Lead 삭제
    await prisma.affiliateLead.delete({
      where: { id: leadId },
    });

    return NextResponse.json({
      ok: true,
      message: '고객 정보가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('DELETE /api/admin/affiliate/leads/[leadId] error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
