import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);
    const { contactId, familyComposition, decisionMaker } = await req.json();

    if (!contactId || !familyComposition) {
      return NextResponse.json(
        { error: 'contactId and familyComposition are required' },
        { status: 400 }
      );
    }

    // P0: organizationId 격리 — 다른 조직의 contact 수정 방지
    const existingContact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: { id: true },
    });
    if (!existingContact) {
      return NextResponse.json(
        { error: 'Contact not found or access denied' },
        { status: 404 }
      );
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        familyComposition: familyComposition, // "spouse", "parents", "friends", "mixed", "single"
        decisionMaker: decisionMaker || 'self',
        companionPersuasionStartedAt: new Date(),
        familyAssessmentCompletedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        familyComposition: true,
        decisionMaker: true,
        familyInfluenceScore: true,
        companionPersuasionStage: true,
        familyAssessmentCompletedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact,
      message: '가족 구성 및 의사결정자 평가 완료',
    });
  } catch (error) {
    logger.error('[POST /api/my/family-assessment]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to complete family assessment' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    // P0: organizationId 격리 — 다른 조직의 contact 조회 방지
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: {
        id: true,
        name: true,
        phone: true,
        familyComposition: true,
        decisionMaker: true,
        spouseName: true,
        spousePhone: true,
        spouseEngagement: true,
        parentName: true,
        parentPhone: true,
        parentEngagement: true,
        friendName: true,
        friendPhone: true,
        friendEngagement: true,
        familyInfluenceScore: true,
        companionPersuasionStage: true,
        familyObjections: true,
        familyAssessmentCompletedAt: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    logger.error('[GET /api/my/family-assessment]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch family assessment' },
      { status: 500 }
    );
  }
}
