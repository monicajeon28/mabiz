export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return null;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { User: { select: { id: true, role: true } } },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return session.User;
  } catch (error) {
    console.error('[Message Center Customers] Auth check error:', error);
    return null;
  }
}

interface CustomerData {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  createdAt: Date;
  type: 'lead' | 'user' | 'b2b';
  agentName?: string | null;
  agentId?: number | null;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'trial';

    let customers: CustomerData[] = [];

    console.log('[Message Center Customers] Fetching type:', type);

    switch (type) {
      case 'trial':
        // 3일 무료체험 고객 - AffiliateLead + User
        try {
          const trialLeads = await prisma.affiliateLead.findMany({
            where: {
              OR: [
                { source: { contains: '1101' } },
                { source: { contains: 'trial', mode: 'insensitive' } },
                { source: { contains: 'genie-trial', mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              customerName: true,
              customerPhone: true,
              source: true,
              createdAt: true,
              agentId: true,
              AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
          });

          console.log('[Message Center Customers] Trial leads found:', trialLeads.length);

          const trialUsers = await prisma.user.findMany({
            where: {
              OR: [
                { customerSource: { contains: 'trial', mode: 'insensitive' } },
                { customerSource: { contains: '1101' } },
              ],
            },
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              customerSource: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
          });

          console.log('[Message Center Customers] Trial users found:', trialUsers.length);

          customers = [
            ...trialLeads.map(l => ({
              id: l.id,
              name: l.customerName,
              phone: l.customerPhone,
              email: null,
              source: l.source,
              createdAt: l.createdAt,
              type: 'lead' as const,
              agentId: l.agentId,
              agentName: l.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || null,
            })),
            ...trialUsers.map(u => ({
              id: u.id,
              name: u.name,
              phone: u.phone,
              email: u.email,
              source: u.customerSource,
              createdAt: u.createdAt,
              type: 'user' as const,
              agentId: null,
              agentName: null,
            })),
          ];
        } catch (e) {
          console.error('[Customers] Trial error:', e);
        }
        break;

      case 'purchased':
        // 구매 고객
        try {
          const purchasedSales = await prisma.affiliateSale.findMany({
            where: {
              status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED', 'SETTLED'] },
            },
            select: {
              lead: {
                select: {
                  id: true,
                  customerName: true,
                  customerPhone: true,
                  source: true,
                  createdAt: true,
                  agentId: true,
                  AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
                    select: {
                      id: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
          });

          console.log('[Message Center Customers] Purchased sales found:', purchasedSales.length);

          const uniqueLeadIds = new Set<number>();
          customers = purchasedSales
            .filter(sale => {
              if (!sale.lead || uniqueLeadIds.has(sale.lead.id)) return false;
              uniqueLeadIds.add(sale.lead.id);
              return true;
            })
            .map(sale => ({
              id: sale.lead!.id,
              name: sale.lead!.customerName,
              phone: sale.lead!.customerPhone,
              email: null,
              source: sale.lead!.source,
              createdAt: sale.lead!.createdAt,
              type: 'lead' as const,
              agentId: sale.lead!.agentId,
              agentName: sale.lead!.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || null,
            }));
        } catch (e) {
          console.error('[Customers] Purchased error:', e);
        }
        break;

      case 'mall':
        // 크루즈몰 고객
        try {
          const mallUsers = await prisma.user.findMany({
            where: {
              role: 'community',
            },
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              customerSource: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
          });

          console.log('[Message Center Customers] Mall users found:', mallUsers.length);

          customers = mallUsers.map(u => ({
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email,
            source: u.customerSource || 'mall',
            createdAt: u.createdAt,
            type: 'user' as const,
            agentId: null,
            agentName: null,
          }));
        } catch (e) {
          console.error('[Customers] Mall error:', e);
        }
        break;

      case 'b2b':
        // B2B 유입 고객
        try {
          const b2bLeads = await prisma.affiliateLead.findMany({
            where: {
              OR: [
                { source: { contains: 'B2B', mode: 'insensitive' } },
                { source: { contains: 'b2b', mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              customerName: true,
              customerPhone: true,
              source: true,
              createdAt: true,
              agentId: true,
              AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
          });

          console.log('[Message Center Customers] B2B leads found:', b2bLeads.length);

          // B2BProspect도 포함
          let b2bProspects: any[] = [];
          try {
            b2bProspects = await prisma.b2BProspect.findMany({
              select: {
                id: true,
                companyName: true,
                contactName: true,
                phone: true,
                email: true,
                source: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 500,
            });
            console.log('[Message Center Customers] B2B prospects found:', b2bProspects.length);
          } catch (e) {
            // 테이블이 없을 수 있음
            console.log('[Message Center Customers] B2BProspect table not found or error');
          }

          customers = [
            ...b2bLeads.map(l => ({
              id: l.id,
              name: l.customerName,
              phone: l.customerPhone,
              email: null,
              source: l.source,
              createdAt: l.createdAt,
              type: 'lead' as const,
              agentId: l.agentId,
              agentName: l.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || null,
            })),
            ...b2bProspects.map(p => ({
              id: p.id,
              name: p.contactName || p.companyName,
              phone: p.phone,
              email: p.email,
              source: p.source || 'B2B',
              createdAt: p.createdAt,
              type: 'b2b' as const,
              agentId: null,
              agentName: null,
            })),
          ];
        } catch (e) {
          console.error('[Customers] B2B error:', e);
        }
        break;

      case 'landing':
        // 전체 랜딩 유입 고객 (AffiliateLead 전체)
        try {
          const allLeads = await prisma.affiliateLead.findMany({
            select: {
              id: true,
              customerName: true,
              customerPhone: true,
              source: true,
              createdAt: true,
              agentId: true,
              AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
          });

          console.log('[Message Center Customers] Landing leads found:', allLeads.length);

          customers = allLeads.map(l => ({
            id: l.id,
            name: l.customerName,
            phone: l.customerPhone,
            email: null,
            source: l.source,
            createdAt: l.createdAt,
            type: 'lead' as const,
            agentId: l.agentId,
            agentName: l.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || null,
          }));
        } catch (e) {
          console.error('[Customers] Landing error:', e);
        }
        break;

      case 'all':
        // 전체 고객 (User + AffiliateLead)
        try {
          const allUsers = await prisma.user.findMany({
            where: {
              OR: [
                { phone: { not: null } },
                { email: { not: null } },
              ],
            },
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              customerSource: true,
              role: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 300,
          });

          const allLeads = await prisma.affiliateLead.findMany({
            select: {
              id: true,
              customerName: true,
              customerPhone: true,
              source: true,
              createdAt: true,
              agentId: true,
              AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 300,
          });

          console.log('[Message Center Customers] All users:', allUsers.length, ', leads:', allLeads.length);

          customers = [
            ...allUsers.map(u => ({
              id: u.id,
              name: u.name,
              phone: u.phone,
              email: u.email,
              source: u.customerSource || u.role || 'user',
              createdAt: u.createdAt,
              type: 'user' as const,
              agentId: null,
              agentName: null,
            })),
            ...allLeads.map(l => ({
              id: l.id,
              name: l.customerName,
              phone: l.customerPhone,
              email: null,
              source: l.source,
              createdAt: l.createdAt,
              type: 'lead' as const,
              agentId: l.agentId,
              agentName: l.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName || null,
            })),
          ];
        } catch (e) {
          console.error('[Customers] All error:', e);
        }
        break;
    }

    console.log('[Message Center Customers] Total customers:', customers.length);

    return NextResponse.json({
      ok: true,
      customers: customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        source: c.source,
        createdAt: c.createdAt,
        type: c.type,
        agentId: c.agentId || null,
        agentName: c.agentName || null,
      })),
      total: customers.length,
    });
  } catch (error) {
    console.error('[Message Center Customers] Error:', error);
    return NextResponse.json(
      { ok: false, error: '고객 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
