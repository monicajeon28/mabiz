export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requirePartnerContext } from '@/app/api/partner/_utils';

/**
 * POST /api/partner/customers/assign
 * 대리점장이 고객을 판매원에게 할당 (DB 보내기)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();

    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: 'Only branch managers can assign customers' }, { status: 403 });
    }

    const body = await req.json();
    const { leadIds, agentId, customerData, type = 'lead' } = body;

    if (!agentId) {
      return NextResponse.json({ ok: false, error: 'Agent ID is required' }, { status: 400 });
    }

    // 판매원 확인
    const agent = await prisma.affiliateProfile.findFirst({
      where: {
        id: parseInt(agentId),
        type: 'SALES_AGENT',
      },
      include: {
        AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile: {
          where: {
            managerId: profile.id,
            status: 'ACTIVE',
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ ok: false, error: 'Agent not found' }, { status: 404 });
    }

    if (agent.AffiliateRelation_AffiliateRelation_agentIdToAffiliateProfile.length === 0) {
      return NextResponse.json({ ok: false, error: 'Agent is not under your management' }, { status: 403 });
    }

    const results = {
      assigned: [] as number[],
      created: [] as number[],
      errors: [] as string[],
    };

    // 기존 고객 할당
    if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      for (const id of leadIds) {
        try {
          if (type === 'consultation') {
            const consultation = await prisma.systemConsultation.findFirst({
              where: {
                id: parseInt(id),
                managerId: profile.id,
              },
            });

            if (!consultation) {
              results.errors.push(`Consultation ${id} not found or not owned by you`);
              continue;
            }

            await prisma.systemConsultation.update({
              where: { id: consultation.id },
              data: {
                agentId: agent.id,
              },
            });
            results.assigned.push(consultation.id);

          } else {
            const lead = await prisma.affiliateLead.findFirst({
              where: {
                id: parseInt(id),
                managerId: profile.id,
              },
            });

            if (!lead) {
              results.errors.push(`Lead ${id} not found or not owned by you`);
              continue;
            }

            await prisma.affiliateLead.update({
              where: { id: lead.id },
              data: {
                agentId: agent.id,
                // 기존 managerId는 유지 (회수를 위해)
              },
            });
            results.assigned.push(lead.id);
          }
        } catch (error: any) {
          results.errors.push(`Failed to assign ${type} ${id}: ${error.message}`);
        }
      }
    }

    // 새 고객 생성 및 할당 (SystemConsultation은 생성 로직 없음, Lead만 해당)
    if (type === 'lead' && customerData && Array.isArray(customerData) && customerData.length > 0) {
      for (const data of customerData) {
        try {
          const { name, phone, email, notes } = data;

          if (!name || !phone) {
            results.errors.push('Name and phone are required for new customers');
            continue;
          }

          // 전화번호 정규화
          const normalizedPhone = phone.replace(/\D/g, '');

          // 기존 고객 확인
          const existingLead = await prisma.affiliateLead.findFirst({
            where: {
              customerPhone: normalizedPhone,
              OR: [
                { managerId: profile.id },
                { agentId: profile.id },
              ],
            },
          });

          if (existingLead) {
            // 기존 고객이면 할당만 업데이트
            await prisma.affiliateLead.update({
              where: { id: existingLead.id },
              data: {
                agentId: agent.id,
                managerId: profile.id,
              },
            });
            results.assigned.push(existingLead.id);
          } else {
            // 새 고객 생성
            const newLead = await prisma.affiliateLead.create({
              data: {
                managerId: profile.id,
                agentId: agent.id,
                customerName: name.trim(),
                customerPhone: normalizedPhone,
                notes: notes?.trim() || null,
                status: 'NEW',
                source: 'manual-assignment',
                metadata: email ? { email: email.trim() } : null,
              },
            });
            results.created.push(newLead.id);
          }
        } catch (error: any) {
          results.errors.push(`Failed to create customer: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Customers assigned successfully',
      results,
    });
  } catch (error: any) {
    console.error('[Partner Customer Assign] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to assign customers' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/partner/customers/assign
 * 고객 할당 회수 (대리점장이 판매원에게서 고객을 회수)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { profile } = await requirePartnerContext();

    // 대리점장만 가능
    if (profile.type !== 'BRANCH_MANAGER') {
      return NextResponse.json({ ok: false, error: 'Only branch managers can recall customers' }, { status: 403 });
    }

    const body = await req.json();
    const { leadIds, type = 'lead' } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Lead IDs are required' }, { status: 400 });
    }

    const results = {
      recalled: [] as number[],
      errors: [] as string[],
    };

    for (const id of leadIds) {
      try {
        if (type === 'consultation') {
          const consultation = await prisma.systemConsultation.findFirst({
            where: {
              id: parseInt(id),
              managerId: profile.id,
            },
          });

          if (!consultation) {
            results.errors.push(`Consultation ${id} not found or not owned by you`);
            continue;
          }

          await prisma.systemConsultation.update({
            where: { id: consultation.id },
            data: {
              agentId: null,
            },
          });
          results.recalled.push(consultation.id);
        } else {
          const lead = await prisma.affiliateLead.findFirst({
            where: {
              id: parseInt(id),
              managerId: profile.id,
            },
          });

          if (!lead) {
            results.errors.push(`Lead ${id} not found or not owned by you`);
            continue;
          }

          // agentId를 null로 설정하여 회수
          await prisma.affiliateLead.update({
            where: { id: lead.id },
            data: {
              agentId: null,
            },
          });
          results.recalled.push(lead.id);
        }
      } catch (error: any) {
        results.errors.push(`Failed to recall ${type} ${id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Customers recalled successfully',
      results,
    });
  } catch (error: any) {
    console.error('[Partner Customer Recall] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to recall customers' },
      { status: 500 }
    );
  }
}
