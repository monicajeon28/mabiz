import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { docId: string } }
) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const { docId } = params;

    // SalesDocument 조회 (generatedData.driveUrl 확인)
    const doc = await prisma.salesDocument.findUnique({
      where: { id: docId },
      select: {
        generatedData: true,
        organizationId: true
      },
    });

    if (!doc) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // 권한 검증: 같은 조직이어야 함
    if (doc.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // driveUrl 확인
    const data = doc.generatedData as Record<string, any>;
    const driveUrl = data?.driveUrl;

    return NextResponse.json({
      ok: true,
      status: driveUrl ? 'COMPLETE' : 'PENDING',
      driveUrl: driveUrl || null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
