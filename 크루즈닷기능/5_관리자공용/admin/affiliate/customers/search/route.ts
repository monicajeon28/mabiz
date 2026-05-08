import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'cg.sid.v2';

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
        console.error('[Admin Affiliate Customers Search] Auth check error:', error);
        return false;
    }
}

export async function GET(req: NextRequest) {
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
        const query = searchParams.get('q') || '';
        const limit = parseInt(searchParams.get('limit') || '10');
        const hasPurchase = searchParams.get('hasPurchase') === 'true';

        if (!query || query.trim().length < 1) {
            return NextResponse.json({ ok: true, customers: [] });
        }

        // 검색 조건
        const whereCondition: any = {
            OR: [
                { customerName: { contains: query } },
                { customerPhone: { contains: query } },
                { customerEmail: { contains: query } },
            ],
        };

        // 구매 이력 필터 (CONFIRMED 또는 PAID 상태의 판매 내역이 있는 경우)
        if (hasPurchase) {
            whereCondition.AffiliateSale = {
                some: {
                    status: { in: ['CONFIRMED', 'PAID'] }
                }
            };
        }

        const leads = await prisma.affiliateLead.findMany({
            where: whereCondition,
            select: {
                id: true,
                customerName: true,
                customerPhone: true,
                customerEmail: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        // 고객 정보 추출 (중복 제거)
        const customerMap = new Map<number, {
            id: number;
            name: string;
            phone: string;
            email: string;
        }>();

        leads.forEach(lead => {
            // Lead 정보 사용 (고객 ID는 임시로 음수 사용 - AffiliateLead ID)
            // 기존 로직과 맞추기 위해 음수로 처리하거나, 그냥 ID 사용.
            // AffiliateCertificate에서는 ID를 사용하여 purchase-info를 조회함.
            // purchase-info API가 Lead ID를 받는지 확인 필요.
            // 보통 Lead ID를 사용함.
            const leadId = lead.id;
            if (!customerMap.has(leadId)) {
                customerMap.set(leadId, {
                    id: leadId,
                    name: lead.customerName || '',
                    phone: lead.customerPhone || '',
                    email: lead.customerEmail || '',
                });
            }
        });

        const customers = Array.from(customerMap.values());

        return NextResponse.json({
            ok: true,
            customers: customers.map(c => ({
                id: c.id,
                name: c.name || '',
                phone: c.phone || '',
                email: c.email || '',
                displayName: `${c.name || '이름 없음'}${c.phone ? ` (${c.phone})` : ''}`,
            }))
        });
    } catch (error) {
        console.error('[Admin Affiliate Customers Search] Error:', error);
        return NextResponse.json(
            { ok: false, error: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
