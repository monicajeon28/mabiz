export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET: List all approval requests (admin only)
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'PENDING';

        const where: any = {};
        if (status && status !== 'all') {
            where.status = status;
        }

        const approvals = await prisma.documentApproval.findMany({
            where,
            include: {
                requester: {
                    select: {
                        id: true,
                        name: true,
                        mallUserId: true,
                    },
                },
                sale: {
                    include: {
                        lead: {
                            select: {
                                id: true,
                                customerName: true,
                                customerPhone: true,
                            },
                        },
                        product: {
                            select: {
                                productName: true,
                            },
                        },
                        manager: {
                            select: {
                                id: true,
                                displayName: true,
                            },
                        },
                        agent: {
                            select: {
                                id: true,
                                displayName: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json({
            ok: true,
            approvals,
        });
    } catch (error: any) {
        console.error('[Admin Approvals GET] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || '승인 요청 목록을 불러오는 중 오류가 발생했습니다' },
            { status: 500 }
        );
    }
}

// POST: Approve or reject a request
export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다' }, { status: 403 });
        }

        const body = await req.json();
        const { approvalId, action, adminNotes } = body;

        if (!approvalId || !action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { ok: false, error: '올바른 요청 정보가 필요합니다 (approvalId, action=approve|reject)' },
                { status: 400 }
            );
        }

        const approval = await prisma.documentApproval.findUnique({
            where: { id: approvalId },
            include: {
                sale: {
                    include: {
                        lead: true,
                        product: true,
                    },
                },
            },
        });

        if (!approval) {
            return NextResponse.json(
                { ok: false, error: '승인 요청을 찾을 수 없습니다' },
                { status: 404 }
            );
        }

        if (approval.status !== 'PENDING') {
            return NextResponse.json(
                { ok: false, error: '이미 처리된 요청입니다' },
                { status: 400 }
            );
        }

        if (action === 'approve') {
            // Update approval status
            await prisma.documentApproval.update({
                where: { id: approvalId },
                data: {
                    status: 'APPROVED',
                    approvedBy: user.id,
                    processedAt: new Date(),
                    adminNotes: adminNotes || null,
                },
            });

            // TODO: Here you could trigger actual document generation using existing functions
            // For now, we just mark it as approved

            return NextResponse.json({
                ok: true,
                message: '승인되었습니다.',
            });
        } else {
            // Reject
            await prisma.documentApproval.update({
                where: { id: approvalId },
                data: {
                    status: 'REJECTED',
                    approvedBy: user.id,
                    processedAt: new Date(),
                    adminNotes: adminNotes || '관리자에 의해 거부됨',
                },
            });

            return NextResponse.json({
                ok: true,
                message: '거부되었습니다.',
            });
        }
    } catch (error: any) {
        console.error('[Admin Approvals POST] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || '승인 처리 중 오류가 발생했습니다' },
            { status: 500 }
        );
    }
}
