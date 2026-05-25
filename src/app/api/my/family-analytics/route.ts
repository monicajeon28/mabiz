import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrganizationRequest } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await validateOrganizationRequest(req);
    const { searchParams } = new URL(req.url);
    const periodDays = parseInt(searchParams.get('period') || '30');

    // Calculate family persuasion metrics
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        companionPersuasionStartedAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        familyComposition: true,
        decisionMaker: true,
        familyInfluenceScore: true,
        companionPersuasionStage: true,
        spouseEngagement: true,
        parentEngagement: true,
        friendEngagement: true,
        familyObjections: true,
        companionSmsDay0Sent: true,
        companionSmsDay0SentAt: true,
        companionSmsDay1Sent: true,
        companionSmsDay1SentAt: true,
        companionSmsDay2Sent: true,
        companionSmsDay2SentAt: true,
        companionSmsDay3Sent: true,
        companionSmsDay3SentAt: true,
        companionPersuasionStartedAt: true,
        purchasedAt: true,
      },
    });

    // Analytics calculations
    const totalContacts = contacts.length;
    const bookedCount = contacts.filter((c) => c.companionPersuasionStage === 'booked' || c.purchasedAt).length;
    const convincedCount = contacts.filter((c) => c.companionPersuasionStage === 'convinced').length;
    const interestedCount = contacts.filter((c) => c.companionPersuasionStage === 'interested').length;

    // SMS sequence completion rates
    const day0SentCount = contacts.filter((c) => c.companionSmsDay0Sent).length;
    const day1SentCount = contacts.filter((c) => c.companionSmsDay1Sent).length;
    const day2SentCount = contacts.filter((c) => c.companionSmsDay2Sent).length;
    const day3SentCount = contacts.filter((c) => c.companionSmsDay3Sent).length;

    // Family composition breakdown
    const compositionBreakdown = {
      spouse: contacts.filter((c) => c.familyComposition === 'spouse').length,
      parents: contacts.filter((c) => c.familyComposition === 'parents').length,
      friends: contacts.filter((c) => c.familyComposition === 'friends').length,
      mixed: contacts.filter((c) => c.familyComposition === 'mixed').length,
      single: contacts.filter((c) => c.familyComposition === 'single').length,
    };

    // Engagement breakdown
    const spouseEngagementBreakdown = {
      not_contacted: contacts.filter((c) => c.spouseEngagement === 'not_contacted').length,
      aware: contacts.filter((c) => c.spouseEngagement === 'aware').length,
      interested: contacts.filter((c) => c.spouseEngagement === 'interested').length,
      convinced: contacts.filter((c) => c.spouseEngagement === 'convinced').length,
    };

    // Average family influence score
    const avgFamilyInfluenceScore =
      totalContacts > 0
        ? Math.round(
            contacts.reduce((sum, c) => sum + c.familyInfluenceScore, 0) /
              totalContacts
          )
        : 0;

    // Most common objections
    const objectionCounts: Record<string, number> = {};
    contacts.forEach((c) => {
      c.familyObjections?.forEach((objection) => {
        objectionCounts[objection] = (objectionCounts[objection] || 0) + 1;
      });
    });

    const topObjections = Object.entries(objectionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([objection, count]) => ({
        objection,
        count,
        percentage: Math.round((count / totalContacts) * 100),
      }));

    // Conversion rate
    const conversionRate =
      totalContacts > 0
        ? Math.round((bookedCount / totalContacts) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      period: {
        startDate,
        endDate: new Date(),
        days: periodDays,
      },
      summary: {
        totalContacts,
        bookedCount,
        bookedPercentage: conversionRate,
        convincedCount,
        interestedCount,
        avgFamilyInfluenceScore,
      },
      smsSequence: {
        day0Sent: day0SentCount,
        day0SentRate: totalContacts > 0 ? Math.round((day0SentCount / totalContacts) * 100) : 0,
        day1Sent: day1SentCount,
        day1SentRate: totalContacts > 0 ? Math.round((day1SentCount / totalContacts) * 100) : 0,
        day2Sent: day2SentCount,
        day2SentRate: totalContacts > 0 ? Math.round((day2SentCount / totalContacts) * 100) : 0,
        day3Sent: day3SentCount,
        day3SentRate: totalContacts > 0 ? Math.round((day3SentCount / totalContacts) * 100) : 0,
      },
      familyComposition: compositionBreakdown,
      spouseEngagement: spouseEngagementBreakdown,
      topObjections,
      expectedRevenue: `$${Math.round(bookedCount * 2500)}-${Math.round(bookedCount * 3500)}`, // $2.5K-3.5K per booking
    });
  } catch (error) {
    logger.error('[GET /api/my/family-analytics]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch family analytics' },
      { status: 500 }
    );
  }
}
