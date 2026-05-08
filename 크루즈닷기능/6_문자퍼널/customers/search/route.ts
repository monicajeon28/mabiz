import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // 파트너 프로필 확인
        const profile = await prisma.affiliateProfile.findFirst({
            where: { userId: user.id },
            select: { id: true, type: true },
        });

        if (!profile) {
            return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q') || '';
        const limit = parseInt(searchParams.get('limit') || '10');
        const hasPurchase = searchParams.get('hasPurchase') === 'true';
        const certificateType = searchParams.get('certificateType'); // 'purchase' or 'refund'

        if (!query || query.trim().length < 1) {
            return NextResponse.json({ ok: true, customers: [] });
        }

        // 인증서 유형이 지정된 경우: User 테이블에서 직접 검색 (customerStatus 기반)
        // purchase: 구매완료(purchase_confirmed) 고객만
        // refund: 환불완료(refunded) 고객만
        if (certificateType === 'purchase' || certificateType === 'refund') {
            const customerStatusFilter = certificateType === 'purchase' ? 'purchase_confirmed' : 'refunded';

            // 파트너의 리드 중 해당 상태의 고객 전화번호 조회
            let leadWhereClause: any = {};

            if (profile.type === 'BRANCH_MANAGER') {
                // 대리점장: 본인 또는 팀원의 리드
                const teamRelations = await prisma.affiliateRelation.findMany({
                    where: { managerId: profile.id, status: 'ACTIVE' },
                    select: { agentId: true },
                });
                const agentIds = teamRelations.map(r => r.agentId);

                leadWhereClause = {
                    OR: [
                        { managerId: profile.id },
                        { agentId: profile.id },
                        { agentId: { in: agentIds } },
                    ]
                };
            } else {
                // 판매원: 본인의 리드만
                leadWhereClause = { agentId: profile.id };
            }

            // 파트너의 리드 전화번호 목록 가져오기
            const partnerLeads = await prisma.affiliateLead.findMany({
                where: leadWhereClause,
                select: { customerPhone: true },
            });
            const partnerPhones = partnerLeads
                .map(l => l.customerPhone)
                .filter((phone): phone is string => !!phone);

            // 해당 전화번호 중 customerStatus가 맞는 고객 검색
            const users = await prisma.user.findMany({
                where: {
                    role: { not: 'admin' },
                    customerStatus: customerStatusFilter,
                    phone: { in: partnerPhones },
                    OR: [
                        { name: { contains: query } },
                        { phone: { contains: query } },
                        { email: { contains: query } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true,
                    customerStatus: true,
                },
                take: limit,
                orderBy: { updatedAt: 'desc' },
            });

            return NextResponse.json({
                ok: true,
                customers: users.map(u => ({
                    id: u.id,
                    name: u.name || '',
                    phone: u.phone || '',
                    email: u.email || '',
                    customerStatus: u.customerStatus,
                    displayName: `${u.name || '이름 없음'}${u.phone ? ` (${u.phone})` : ''}`,
                })),
            });
        }

        // 기존 로직: 파트너의 리드(AffiliateLead) 중에서 검색
        let whereClause: any = {
            OR: [
                { customerName: { contains: query } },
                { customerPhone: { contains: query } },
            ],
        };

        // 구매 이력 필터
        if (hasPurchase) {
            whereClause.AffiliateSale = {
                some: {
                    status: { in: ['CONFIRMED', 'PAID'] }
                }
            };
        }

        if (profile.type === 'BRANCH_MANAGER') {
            // 대리점장: 본인 또는 팀원의 리드
            const teamRelations = await prisma.affiliateRelation.findMany({
                where: { managerId: profile.id, status: 'ACTIVE' },
                select: { agentId: true },
            });
            const agentIds = teamRelations.map(r => r.agentId);

            whereClause.OR.push(
                { managerId: profile.id },
                { agentId: profile.id },
                { agentId: { in: agentIds } }
            );
        } else {
            // 판매원: 본인의 리드만
            whereClause.agentId = profile.id;
        }

        const leads = await prisma.affiliateLead.findMany({
            where: whereClause,
            select: {
                id: true,
                customerName: true,
                customerPhone: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            ok: true,
            customers: leads.map(lead => ({
                id: lead.id,
                name: lead.customerName || '',
                phone: lead.customerPhone || '',
                email: '',
                displayName: `${lead.customerName || '이름 없음'}${lead.customerPhone ? ` (${lead.customerPhone})` : ''}`,
            })),
        });

    } catch (error) {
        console.error('[Partner Customer Search] Error:', error);
        return NextResponse.json(
            { ok: false, error: 'Failed to search customers' },
            { status: 500 }
        );
    }
}
