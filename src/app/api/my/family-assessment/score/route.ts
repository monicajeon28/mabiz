import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

interface FamilyScoreInput {
  contactId: string;
  spouseName?: string;
  spousePhone?: string;
  spouseEngagement?: string;
  parentName?: string;
  parentPhone?: string;
  parentEngagement?: string;
  friendName?: string;
  friendPhone?: string;
  friendEngagement?: string;
  familyObjections?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);
    const body: FamilyScoreInput = await req.json();

    const {
      contactId,
      spouseName,
      spousePhone,
      spouseEngagement,
      parentName,
      parentPhone,
      parentEngagement,
      friendName,
      friendPhone,
      friendEngagement,
      familyObjections = [],
    } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
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

    // Calculate family influence score (0-100)
    let familyInfluenceScore = 0;
    const engagementScores: Record<string, number> = {
      'not_contacted': 0,
      'aware': 25,
      'interested': 50,
      'convinced': 100,
    };

    if (spouseEngagement) {
      familyInfluenceScore += engagementScores[spouseEngagement] || 0;
    }
    if (parentEngagement) {
      familyInfluenceScore += engagementScores[parentEngagement] || 0;
    }
    if (friendEngagement) {
      familyInfluenceScore += engagementScores[friendEngagement] || 0;
    }

    // Average the scores
    const companions = [
      spouseEngagement,
      parentEngagement,
      friendEngagement,
    ].filter(Boolean).length;

    const finalScore = companions > 0 ? Math.round(familyInfluenceScore / companions) : 0;

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        spouseName: spouseName || undefined,
        spousePhone: spousePhone || undefined,
        spouseEngagement: spouseEngagement || undefined,
        parentName: parentName || undefined,
        parentPhone: parentPhone || undefined,
        parentEngagement: parentEngagement || undefined,
        friendName: friendName || undefined,
        friendPhone: friendPhone || undefined,
        friendEngagement: friendEngagement || undefined,
        familyInfluenceScore: finalScore,
        familyObjections,
        companionPersuasionStage: finalScore >= 75 ? 'convinced' : finalScore >= 50 ? 'interested' : 'hesitant',
      },
      select: {
        id: true,
        name: true,
        familyComposition: true,
        decisionMaker: true,
        spouseName: true,
        spouseEngagement: true,
        parentName: true,
        parentEngagement: true,
        friendName: true,
        friendEngagement: true,
        familyInfluenceScore: true,
        companionPersuasionStage: true,
        familyObjections: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact,
      score: finalScore,
      stage: contact.companionPersuasionStage,
      message: `가족 영향력 점수: ${finalScore}점 (${contact.companionPersuasionStage})`,
    });
  } catch (error) {
    logger.error('[POST /api/my/family-assessment/score]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to calculate family influence score' },
      { status: 500 }
    );
  }
}
