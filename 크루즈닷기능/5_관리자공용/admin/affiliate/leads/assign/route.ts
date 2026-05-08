import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/affiliate/leads/assign
 * 관리자가 고객을 대리점장에게 할당 (DB 보내기)
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { leadIds, managerId, type = 'lead' } = body;

        if (!managerId) {
            return NextResponse.json({ ok: false, error: 'Manager ID is required' }, { status: 400 });
        }

        // 대리점장 확인
        const manager = await prisma.affiliateProfile.findFirst({
            where: {
                id: parseInt(managerId),
                type: 'BRANCH_MANAGER',
            },
        });

        if (!manager) {
            return NextResponse.json({ ok: false, error: 'Branch Manager not found' }, { status: 404 });
        }

        const results = {
            assigned: [] as number[],
            errors: [] as string[],
        };

        if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
            for (const id of leadIds) {
                try {
                    if (type === 'consultation') {
                        const consultation = await prisma.systemConsultation.findUnique({
                            where: { id: parseInt(id) },
                        });

                        if (!consultation) {
                            results.errors.push(`Consultation ${id} not found`);
                            continue;
                        }

                        await prisma.systemConsultation.update({
                            where: { id: consultation.id },
                            data: {
                                managerId: manager.id,
                                agentId: null, // 매니저가 바뀌면 판매원 할당은 초기화
                            },
                        });
                        results.assigned.push(consultation.id);

                    } else {
                        const lead = await prisma.affiliateLead.findUnique({
                            where: { id: parseInt(id) },
                        });

                        if (!lead) {
                            results.errors.push(`Lead ${id} not found`);
                            continue;
                        }

                        // metadata에 본사 제공 출처 정보 기록
                        const currentMetadata = (lead.metadata as Record<string, any>) || {};
                        const transferHistory = currentMetadata.transferHistory || [];
                        transferHistory.push({
                            date: new Date().toISOString(),
                            fromProfileId: null,
                            fromProfileName: '본사',
                            toProfileId: manager.id,
                            toProfileName: manager.displayName || manager.affiliateCode,
                        });

                        await prisma.affiliateLead.update({
                            where: { id: lead.id },
                            data: {
                                managerId: manager.id,
                                agentId: null, // 매니저가 바뀌면 판매원 할당은 초기화
                                metadata: {
                                    ...currentMetadata,
                                    transferHistory,
                                    lastTransferFrom: '본사',
                                    lastTransferFromId: null,
                                    receivedFromHQ: true,
                                    receivedAt: new Date().toISOString(),
                                },
                            },
                        });

                        // 전송 이력 기록
                        await prisma.affiliateInteraction.create({
                            data: {
                                leadId: lead.id,
                                profileId: null,
                                createdById: user.id,
                                interactionType: 'DB_TRANSFER',
                                occurredAt: new Date(),
                                note: `본사에서 ${manager.displayName || manager.affiliateCode}에게 DB 전송`,
                                metadata: {
                                    action: 'hq_assign',
                                    fromHQ: true,
                                    toProfileId: manager.id,
                                    toProfileName: manager.displayName || manager.affiliateCode,
                                },
                            },
                        });

                        results.assigned.push(lead.id);
                    }
                } catch (error: any) {
                    results.errors.push(`Failed to assign ${type} ${id}: ${error.message}`);
                }
            }
        }

        return NextResponse.json({
            ok: true,
            message: 'Customers assigned successfully',
            results,
        });
    } catch (error: any) {
        console.error('[Admin Customer Assign] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to assign customers' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/admin/affiliate/leads/assign
 * 고객 할당 회수 (관리자가 대리점장에게서 고객을 회수)
 */
export async function PUT(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
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
                    const consultation = await prisma.systemConsultation.findUnique({
                        where: { id: parseInt(id) },
                    });

                    if (!consultation) {
                        results.errors.push(`Consultation ${id} not found`);
                        continue;
                    }

                    await prisma.systemConsultation.update({
                        where: { id: consultation.id },
                        data: {
                            managerId: null,
                            agentId: null,
                        },
                    });
                    results.recalled.push(consultation.id);

                } else {
                    const lead = await prisma.affiliateLead.findUnique({
                        where: { id: parseInt(id) },
                    });

                    if (!lead) {
                        results.errors.push(`Lead ${id} not found`);
                        continue;
                    }

                    await prisma.affiliateLead.update({
                        where: { id: lead.id },
                        data: {
                            managerId: null,
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
        console.error('[Admin Customer Recall] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to recall customers' },
            { status: 500 }
        );
    }
}
