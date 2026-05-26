/**
 * POST /api/tools/day0-3-sequences/[id]/test - Send test SMS sequence
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { TestResponse } from '@/lib/types/sequence';
import { z } from 'zod';

const TestSequenceSchema = z.object({
  contactPhone: z.string().regex(/^\+?[\d\s-]+$/, 'Invalid phone format'),
  startDay: z.number().min(0).max(3).optional().default(0),
  delaySeconds: z.number().min(1).max(3600).optional().default(5)
});

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = (session as any).user.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Organization not found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = TestSequenceSchema.parse(body);

    // Verify sequence exists
    const sequence = await prisma.smsSequenceTemplate.findUnique({
      where: { id: params.id },
      include: { variants: true }
    });

    if (!sequence || sequence.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Sequence not found' },
        { status: 404 }
      );
    }

    // Get winner variants for each day
    const schedule = [];
    const now = new Date();

    for (let day = validatedData.startDay; day <= 3; day++) {
      const dayVariant = sequence.variants.find(
        v => v.day === day && v.isWinner
      ) || sequence.variants.find(v => v.day === day);

      if (!dayVariant) {
        continue;
      }

      const sendTime = new Date(
        now.getTime() + (day - validatedData.startDay) * validatedData.delaySeconds * 1000
      );

      schedule.push({
        day,
        sendAt: sendTime.toISOString(),
        message: dayVariant.messageContent.substring(0, 50) + '...'
      });

      // Create scheduled SMS entry (Phase 2: actual sending)
      await prisma.scheduledSms.create({
        data: {
          organizationId,
          message: dayVariant.messageContent,
          scheduledAt: sendTime,
          status: 'PENDING',
          channel: 'TEST_SEQUENCE'
        }
      });
    }

    const response: TestResponse = {
      ok: true,
      message: `Test SMS scheduled for ${schedule.length} days to ${validatedData.contactPhone}`,
      schedule: schedule.map(s => ({
        day: s.day,
        sendAt: s.sendAt
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      );
    }

    console.error('[day0-3-sequences/:id/test] POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to schedule test SMS' },
      { status: 500 }
    );
  }
}
