import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

const BUCKET = 'member-documents';
const DOC_TYPES = ['ID_CARD', 'BANK_ACCOUNT', 'CONTRACT', 'OTHER'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'heic'];

type Params = { params: Promise<{ userId: string }> };

// GET — 서류 목록
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { userId } = await params;

    // 소유권 검증
    const member = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
    });
    if (!member) return NextResponse.json({ ok: false }, { status: 404 });

    const docs = await prisma.memberDocument.findMany({
      where: { userId, organizationId: orgId },
      orderBy: { uploadedAt: 'desc' },
    });

    // 조회 시점에 signed URL 재생성 (1시간 유효)
    const supabase = getSupabaseAdmin();
    const docsWithUrls = await Promise.all(
      docs.map(async (doc) => {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(doc.storagePath, 60 * 60); // 1시간 유효
        return { ...doc, signedUrl: data?.signedUrl ?? null };
      })
    );

    return NextResponse.json({ ok: true, documents: docsWithUrls });
  } catch (e) {
    logger.error('[MemberDocs GET]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST — 서류 업로드
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
    const { userId } = await params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const docType = formData.get('docType') as string | null;

    if (!file) return NextResponse.json({ ok: false, message: '파일 필수' }, { status: 400 });
    if (!docType || !DOC_TYPES.includes(docType)) {
      return NextResponse.json({ ok: false, message: '서류 종류 필수' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, message: '파일 크기 10MB 초과' }, { status: 400 });
    }

    // 파일 확장자 화이트리스트 검증
    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { ok: false, message: `허용된 파일 형식: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // 파일명 경로 트래버설 방지 — 허용 문자 외 제거 후 확장자만 사용
    const safeName = file.name
      .replace(/[^a-zA-Z0-9가-힣._-]/g, '_') // 허용 문자 외 모두 _ 로
      .replace(/\.\./g, '_')                   // .. 경로 트래버설 방지
      .substring(0, 100);                      // 길이 제한
    const safeExt = safeName.split('.').pop()?.toLowerCase() ?? fileExt;
    const storagePath = `${orgId}/${userId}/${docType}_${Date.now()}.${safeExt}`;

    // Supabase Storage 업로드
    const supabase = getSupabaseAdmin();
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error('[MemberDocs] Supabase 업로드 실패', { error: uploadError.message });
      return NextResponse.json({ ok: false, message: '업로드 실패' }, { status: 500 });
    }

    // DB에는 storagePath만 저장 (fileUrl에 signed URL 저장 금지 — 만료 문제)
    const doc = await prisma.memberDocument.create({
      data: {
        organizationId: orgId,
        userId,
        docType,
        fileName: file.name,
        fileUrl: storagePath, // storagePath 저장 (GET 시 signed URL 재생성)
        storagePath,
        fileSize: file.size,
        status: 'UPLOADED',
      },
    });

    logger.log('[MemberDocs] 서류 업로드 완료', { orgId, userId: userId.substring(0, 8), docType });
    return NextResponse.json({ ok: true, document: doc });
  } catch (e) {
    logger.error('[MemberDocs POST]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
