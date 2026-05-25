import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrganizationRequest } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await validateOrganizationRequest(req);
    const { contactId, familyComposition, decisionMaker } = await req.json();

    if (!contactId || !familyComposition) {
      return NextResponse.json(
        { error: 'contactId and familyComposition are required' },
        { status: 400 }
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
    console.error('Family assessment error:', error);
    return NextResponse.json(
      { error: 'Failed to complete family assessment' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await validateOrganizationRequest(req);
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
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
    console.error('Get family assessment error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family assessment' },
      { status: 500 }
    );
  }
}
