export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateContractStatus } from '@/lib/affiliate/contract';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const resolvedParams = await params;
  const { contractId: contractIdStr } = resolvedParams;
  try {
    const contractId = Number(contractIdStr);
    if (!contractId || Number.isNaN(contractId)) {
      return NextResponse.json({ ok: false, message: 'Invalid contract ID' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const contract = await prisma.affiliateContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      return NextResponse.json({ ok: false, message: 'Contract not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const reasonInput = typeof body?.reason === 'string' ? body.reason : '';
    const reason = reasonInput.trim().slice(0, 500);

    const existingMetadata = (contract.metadata ?? {}) as Record<string, unknown>;
    const rejectionHistory = Array.isArray((existingMetadata as Record<string, unknown>)?.rejections)
      ? ([...(existingMetadata as Record<string, unknown>).rejections as Array<Record<string, unknown>>] as Array<Record<
          string,
          unknown
        >>)
      : [];

    rejectionHistory.push({
      reason: reason || null,
      rejectedAt: new Date().toISOString(),
      rejectedBy: sessionUser.id,
    });

    await updateContractStatus(contractId, 'rejected', sessionUser.id, {
      notes: reason || null,
      metadata: {
        ...existingMetadata,
        rejections: rejectionHistory,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`POST /api/admin/affiliate/contracts/${resolvedParams.contractId}/reject error:`, error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
