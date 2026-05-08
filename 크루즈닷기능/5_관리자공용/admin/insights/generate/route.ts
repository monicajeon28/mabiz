export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generateAllInsights } from '@/lib/insights/generator';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      console.log('[Admin Insights Generate] No session cookie found');
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User) {
      console.log('[Admin Insights Generate] Session not found or user not found');
      return null;
    }

    if (session.User.role !== 'admin') {
      console.log('[Admin Insights Generate] User is not admin:', session.User.role);
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Admin Insights Generate] Auth check error:', error);
    return null;
  }
}

// POST: 인사이트 생성
export async function POST(req: NextRequest) {
  try {
    console.log('[Admin Insights Generate] Request received');

    const admin = await checkAdminAuth();
    if (!admin) {
      console.error('[Admin Insights Generate] Unauthorized');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Admin Insights Generate] Admin authenticated:', admin.id);

    const body = await req.json();
    const { userId, all } = body;
    console.log('[Admin Insights Generate] Request body:', { userId, all });

    if (all) {
      // 모든 활성 사용자에 대해 인사이트 생성
      console.log('[Admin Insights Generate] Generating insights for all users');
      const users = await prisma.user.findMany({
        where: {
          isHibernated: false,
        },
        select: { id: true },
      });

      console.log('[Admin Insights Generate] Found', users.length, 'active users');

      const results = await Promise.allSettled(
        users.map(async (user) => {
          try {
            console.log('[Admin Insights Generate] Generating for user:', user.id);
            const insights = await generateAllInsights(user.id);
            console.log('[Admin Insights Generate] Generated', insights.length, 'insights for user:', user.id, 'Types:', insights.map(i => i.type));

            if (insights.length === 0) {
              console.log(`[Admin Insights Generate] No insights generated for user ${user.id} - likely no data`);
              // 사용자 데이터 확인
              const userCheck = await prisma.user.findUnique({
                where: { id: user.id },
                select: { id: true, name: true, phone: true },
              });
              const tripCount = await prisma.trip.count({ where: { userId: user.id } });
              const expenseCount = await prisma.expense.count({ where: { userId: user.id } });
              const featureUsageCount = await prisma.featureUsage.count({ where: { userId: user.id } });
              console.log(`[Admin Insights Generate] User ${user.id} data:`, {
                userExists: !!userCheck,
                trips: tripCount,
                expenses: expenseCount,
                featureUsages: featureUsageCount,
              });
              return { userId: user.id, count: 0, skipped: true };
            }

            await Promise.all(
              insights.map(async (insight) => {
                try {
                  await prisma.marketingInsight.upsert({
                    where: {
                      userId_insightType: {
                        userId: user.id,
                        insightType: insight.type as string,
                      },
                    },
                    update: {
                      data: insight.data,
                      updatedAt: new Date(),
                    },
                    create: {
                      userId: user.id,
                      insightType: insight.type as string,
                      data: insight.data,
                      updatedAt: new Date(),
                    },
                  });
                  console.log(`[Admin Insights Generate] Saved insight ${insight.type} for user ${user.id}`);
                } catch (error) {
                  console.error(`[Admin Insights Generate] Error upserting insight ${insight.type} for user ${user.id}:`, error);
                  throw error;
                }
              })
            );
            return { userId: user.id, count: insights.length };
          } catch (error) {
            console.error(`[Admin Insights Generate] Error generating insights for user ${user.id}:`, error);
            throw error;
          }
        })
      );

      const success = results.filter((r) => r.status === 'fulfilled' && !r.value.skipped).length;
      const skipped = results.filter((r) => r.status === 'fulfilled' && r.value.skipped).length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

      console.log('[Admin Insights Generate] Completed:', { success, skipped, failed, total: users.length });

      return NextResponse.json({
        ok: true,
        message: `인사이트 생성 완료: ${success}명 성공, ${skipped}명 데이터 없음, ${failed}명 실패`,
        total: users.length,
        success,
        skipped,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else if (userId) {
      // 특정 사용자에 대해 인사이트 생성
      console.log('[Admin Insights Generate] Generating insights for user:', userId);
      const insights = await generateAllInsights(userId);
      console.log('[Admin Insights Generate] Generated', insights.length, 'insights for user', userId);
      console.log('[Admin Insights Generate] Insight types:', insights.map(i => i.type));

      if (insights.length === 0) {
        console.log(`[Admin Insights Generate] No insights generated for user ${userId} - checking data availability`);
        // 사용자 데이터 확인
        const userCheck = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, phone: true },
        });
        const tripCount = await prisma.trip.count({ where: { userId } });
        const expenseCount = await prisma.expense.count({ where: { userId } });
        const featureUsageCount = await prisma.featureUsage.count({ where: { userId } });
        console.log(`[Admin Insights Generate] User ${userId} data:`, {
          userExists: !!userCheck,
          trips: tripCount,
          expenses: expenseCount,
          featureUsages: featureUsageCount,
        });
      }

      await Promise.all(
        insights.map(async (insight) => {
          try {
            await prisma.marketingInsight.upsert({
              where: {
                userId_insightType: {
                  userId,
                  insightType: insight.type as string,
                },
              },
              update: {
                data: insight.data,
                updatedAt: new Date(),
              },
              create: {
                userId,
                insightType: insight.type as string,
                data: insight.data,
                updatedAt: new Date(),
              },
            });
            console.log(`[Admin Insights Generate] Saved insight ${insight.type} for user ${userId}`);
          } catch (error) {
            console.error(`[Admin Insights Generate] Error upserting insight ${insight.type} for user ${userId}:`, error);
            throw error;
          }
        })
      );

      return NextResponse.json({
        ok: true,
        message: `${insights.length}개의 인사이트가 생성되었습니다.`,
        insights: insights.map((i) => i.type),
      });
    } else {
      return NextResponse.json(
        { ok: false, error: 'userId or all parameter required' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Admin Insights Generate] Fatal error:', error);
    console.error('[Admin Insights Generate] Error stack:', error instanceof Error ? error.stack : String(error));
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to generate insights',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
