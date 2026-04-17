import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// DELETE /api/org/members/[userId]/documents/[docId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string; docId: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    const { userId, docId } = await params;

    const doc = await prisma.memberDocument.findFirst({
      where: { id: docId, organizationId: orgId, userId },
    });
    if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

    // Supabase Storage 삭제
    const supabase = getSupabaseAdmin();
    await supabase.storage.from('member-documents').remove([doc.storagePath]);

    await prisma.memberDocument.delete({ where: { id: docId } });

    logger.log('[MemberDocs DELETE]', { orgId, userId: userId.substring(0, 8), docId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[MemberDocs DELETE]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
