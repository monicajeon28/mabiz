/**
 * POST /api/tools/day0-3-sequences/[id]/deploy - Deploy sequence to contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { deploySequence } from '@/lib/services/sequence-service';
import { DeployResponse } from '@/lib/types/sequence';
import { z } from 'zod';

const DeploySequenceSchema = z.object({
  contactIds: z.array(z.string()).optional(),
  segmentCode: z.string().optional(),
  deployMessage: z.string().optional()
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
    const validatedData = DeploySequenceSchema.parse(body);

    // Validate that either contactIds or segmentCode is provided
    if (!validatedData.contactIds?.length && !validatedData.segmentCode) {
      return NextResponse.json(
        { ok: false, error: 'Must provide either contactIds or segmentCode' },
        { status: 400 }
      );
    }

    const { deployed, scheduled } = await deploySequence(
      organizationId,
      params.id,
      validatedData
    );

    const response: DeployResponse = {
      ok: true,
      deployed,
      scheduled,
      message: `Deployed to ${deployed} contacts. Day 0 SMS will start sending shortly.`
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

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { ok: false, error: 'Sequence not found' },
        { status: 404 }
      );
    }

    console.error('[day0-3-sequences/:id/deploy] POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to deploy sequence' },
      { status: 500 }
    );
  }
}
