export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
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
    console.error('[Target Counts] Auth check error:', error);
    return null;
  }
}

export async function GET() {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    // 1. 3일 무료체험 고객 수 (AffiliateLead + User에서 trial 관련)
    let trialCount = 0;
    try {
      // AffiliateLead에서 trial 유입
      const trialLeads = await prisma.affiliateLead.count({
        where: {
          customerPhone: { not: null },
          OR: [
            { source: { contains: '1101' } },
            { source: { contains: 'trial', mode: 'insensitive' } },
            { source: { contains: 'genie-trial', mode: 'insensitive' } },
            { source: { contains: 'TRIAL', mode: 'insensitive' } },
          ],
        },
      });

      // User 테이블에서 trial 유입
      const trialUsers = await prisma.user.count({
        where: {
          phone: { not: null },
          OR: [
            { customerSource: { contains: 'trial', mode: 'insensitive' } },
            { customerSource: { contains: '1101' } },
          ],
        },
      });

      trialCount = trialLeads + trialUsers;
    } catch (e) {
      console.error('[Target Counts] Trial count error:', e);
    }

    // 2. 구매고객 수 (AffiliateSale이 있는 고객)
    let purchasedCount = 0;
    try {
      const purchasedLeads = await prisma.affiliateSale.findMany({
        where: {
          status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED', 'SETTLED'] },
        },
        select: { leadId: true },
        distinct: ['leadId'],
      });
      purchasedCount = purchasedLeads.length;
    } catch (e) {
      console.error('[Target Counts] Purchased count error:', e);
    }

    // 3. 크루즈몰 고객 수 (role='community')
    let mallCount = 0;
    try {
      mallCount = await prisma.user.count({
        where: {
          role: 'community',
        },
      });
    } catch (e) {
      console.error('[Target Counts] Mall count error:', e);
    }

    // 4. B2B 유입 고객 수
    let b2bCount = 0;
    try {
      // AffiliateLead에서 B2B 유입
      const b2bLeads = await prisma.affiliateLead.count({
        where: {
          OR: [
            { source: { contains: 'B2B', mode: 'insensitive' } },
            { source: { contains: 'b2b', mode: 'insensitive' } },
          ],
        },
      });

      // B2BProspect 테이블
      let b2bProspects = 0;
      try {
        b2bProspects = await prisma.b2BProspect.count();
      } catch (e) {
        // 테이블이 없을 수 있음
      }

      b2bCount = b2bLeads + b2bProspects;
    } catch (e) {
      console.error('[Target Counts] B2B count error:', e);
    }

    // 5. 랜딩 유입 고객 수 (전체 AffiliateLead)
    let landingCount = 0;
    try {
      landingCount = await prisma.affiliateLead.count({
        where: {
          customerPhone: { not: null },
        },
      });
    } catch (e) {
      console.error('[Target Counts] Landing count error:', e);
    }

    // 6. 전체 고객 수 (User 테이블 전체 + AffiliateLead)
    let totalUsers = 0;
    let totalLeads = 0;
    try {
      totalUsers = await prisma.user.count({
        where: {
          OR: [
            { phone: { not: null } },
            { email: { not: null } },
          ],
        },
      });
      totalLeads = await prisma.affiliateLead.count();
    } catch (e) {
      console.error('[Target Counts] Total count error:', e);
    }

    console.log('[Target Counts] Results:', {
      trialCount,
      purchasedCount,
      mallCount,
      b2bCount,
      landingCount,
      totalUsers,
      totalLeads
    });

    return NextResponse.json({
      ok: true,
      counts: {
        trial: trialCount,
        purchased: purchasedCount,
        mall: mallCount,
        b2b: b2bCount,
        landing: landingCount,
        total: totalUsers + totalLeads,
      },
    });
  } catch (error) {
    console.error('[Target Counts] Error:', error);
    return NextResponse.json(
      { ok: false, error: '대상 인원수 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
