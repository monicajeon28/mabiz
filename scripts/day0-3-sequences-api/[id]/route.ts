/**
 * GET /api/tools/day0-3-sequences/[id] - Get sequence details
 * PUT /api/tools/day0-3-sequences/[id] - Update sequence
 * DELETE /api/tools/day0-3-sequences/[id] - Archive sequence
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getSequence, updateSequence, archiveSequence } from '@/lib/services/sequence-service';
import { GetSequenceResponse, SequenceResponse, UpdateSequenceRequest } from '@/lib/types/sequence';
import { z } from 'zod';

const UpdateSequenceSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  productCode: z.string().optional(),
  psychologyLens: z.string().optional(),
  day0Delay: z.number().optional(),
  day1Delay: z.number().optional(),
  day2Delay: z.number().optional(),
  day3Delay: z.number().optional(),
  conditions: z.record(z.any()).optional(),
  triggerOn: z.enum(['PURCHASE', 'OBJECTION', 'INQUIRY']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional()
});

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const sequence = await getSequence(organizationId, params.id);

    if (!sequence) {
      return NextResponse.json(
        { ok: false, error: 'Sequence not found' },
        { status: 404 }
      );
    }

    const response: GetSequenceResponse = {
      ok: true,
      sequence
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[day0-3-sequences/:id] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to get sequence' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const validatedData = UpdateSequenceSchema.parse(body);

    const updated = await updateSequence(
      organizationId,
      params.id,
      validatedData as UpdateSequenceRequest
    );

    const response: SequenceResponse = {
      ok: true,
      id: updated.id,
      message: `Sequence "${updated.name}" updated successfully`
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

    console.error('[day0-3-sequences/:id] PUT error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to update sequence' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    await archiveSequence(organizationId, params.id);

    const response: SequenceResponse = {
      ok: true,
      message: 'Sequence archived successfully'
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { ok: false, error: 'Sequence not found' },
        { status: 404 }
      );
    }

    console.error('[day0-3-sequences/:id] DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to archive sequence' },
      { status: 500 }
    );
  }
}
