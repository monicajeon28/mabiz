/**
 * GET /api/tools/day0-3-sequences - List all sequences
 * POST /api/tools/day0-3-sequences - Create new sequence
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { listSequences, createSequence } from '@/lib/services/sequence-service';
import { CreateSequenceRequest, ListSequencesResponse, SequenceResponse } from '@/lib/types/sequence';
import { z } from 'zod';

// Validation schemas
const CreateSequenceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  productCode: z.string().optional(),
  psychologyLens: z.string().optional(),
  day0Delay: z.number().optional().default(0),
  day1Delay: z.number().optional().default(1440),
  day2Delay: z.number().optional().default(2880),
  day3Delay: z.number().optional().default(4320),
  days: z.array(
    z.object({
      day: z.number().min(0).max(3),
      delay: z.number().min(0).max(4320),
      message: z.string().min(1),
      psychology: z.string().optional(),
      lensName: z.string().optional(),
      variants: z.array(
        z.object({
          code: z.enum(['A', 'B', 'C', 'D', 'E']),
          message: z.string().min(1)
        })
      )
    })
  ),
  conditions: z.record(z.any()).optional(),
  triggerOn: z.enum(['PURCHASE', 'OBJECTION', 'INQUIRY']).optional()
});

type CreateSequenceInput = z.infer<typeof CreateSequenceSchema>;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get organization from session (assuming it's stored)
    const organizationId = (session as any).user.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Organization not found' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const productCode = url.searchParams.get('productCode') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const psychologyLens = url.searchParams.get('psychologyLens') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const { sequences, total } = await listSequences(organizationId, {
      productCode,
      status,
      psychologyLens,
      limit,
      offset
    });

    const response: ListSequencesResponse = {
      ok: true,
      sequences,
      total,
      page: Math.floor(offset / limit) + 1,
      limit
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[day0-3-sequences] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to list sequences' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = (session as any).user.organizationId;
    const userId = session.user.id || (session as any).user.userId;

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Organization not found' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = CreateSequenceSchema.parse(body);

    // Create sequence
    const sequence = await createSequence(
      organizationId,
      userId,
      validatedData as CreateSequenceRequest
    );

    const response: SequenceResponse = {
      ok: true,
      id: sequence.id,
      message: `Sequence "${sequence.name}" created successfully`
    };

    return NextResponse.json(response, { status: 201 });
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

    console.error('[day0-3-sequences] POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create sequence' },
      { status: 500 }
    );
  }
}
