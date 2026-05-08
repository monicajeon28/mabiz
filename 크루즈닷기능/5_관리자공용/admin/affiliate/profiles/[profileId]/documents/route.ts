export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/profiles/[profileId]/documents/route.ts
// 관리자용 어필리에이트 프로필 문서 조회 및 승인 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET: 특정 프로필의 문서 목록 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    // 1. 관리자 확인
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (admin?.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 2. 프로필 ID 확인
    const { profileId: profileIdStr } = await params;
    const profileId = parseInt(profileIdStr);
    if (isNaN(profileId)) {
      return NextResponse.json(
        { ok: false, error: '올바른 프로필 ID가 아닙니다' },
        { status: 400 }
      );
    }

    // 3. 프로필 존재 확인
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: profileId },
      select: { id: true, displayName: true, type: true },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: '프로필을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 4. 문서 목록 조회
    const documents = await prisma.affiliateDocument.findMany({
      where: {
        profileId: profileId,
        documentType: { in: ['ID_CARD', 'BANKBOOK'] },
      },
      include: {
        User_AffiliateDocument_uploadedByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        User_AffiliateDocument_approvedByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return NextResponse.json({
      ok: true,
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        type: profile.type,
      },
      documents: documents.map(doc => {
        const metadata = doc.metadata as any;
        return {
          id: doc.id,
          documentType: doc.documentType,
          filePath: doc.filePath,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          status: doc.status,
          uploadedAt: doc.uploadedAt,
          reviewedAt: doc.reviewedAt,
          metadata: metadata || null,
          backupUrl: metadata?.backupUrl || null, // 구글 드라이브 백업 URL
          uploadedBy: doc.User_AffiliateDocument_uploadedByIdToUser ? {
            id: doc.User_AffiliateDocument_uploadedByIdToUser.id,
            name: doc.User_AffiliateDocument_uploadedByIdToUser.name,
            email: doc.User_AffiliateDocument_uploadedByIdToUser.email,
          } : null,
          approvedBy: doc.User_AffiliateDocument_approvedByIdToUser ? {
            id: doc.User_AffiliateDocument_approvedByIdToUser.id,
            name: doc.User_AffiliateDocument_approvedByIdToUser.name,
            email: doc.User_AffiliateDocument_approvedByIdToUser.email,
          } : null,
          isApproved: doc.approvedById !== null,
        };
      }),
    });
  } catch (error: any) {
    console.error('[Admin Get Documents] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '문서 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST: 문서 승인/거부
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    // 1. 관리자 확인
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (admin?.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 2. 요청 본문 파싱
    const body = await req.json();
    const { documentId, action } = body; // action: 'approve' 또는 'reject'

    if (!documentId || !action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { ok: false, error: '문서 ID와 액션(approve/reject)을 올바르게 지정해주세요' },
        { status: 400 }
      );
    }

    // 3. 문서 확인
    const document = await prisma.affiliateDocument.findUnique({
      where: { id: parseInt(documentId) },
      select: { id: true, profileId: true, documentType: true },
    });

    if (!document) {
      return NextResponse.json(
        { ok: false, error: '문서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 프로필 ID 일치 확인
    const { profileId: profileIdStr } = await params;
    const profileId = parseInt(profileIdStr);
    if (document.profileId !== profileId) {
      return NextResponse.json(
        { ok: false, error: '프로필과 문서가 일치하지 않습니다' },
        { status: 400 }
      );
    }

    // 4. 문서 상태 업데이트
    const updatedDocument = await prisma.affiliateDocument.update({
      where: { id: document.id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        approvedById: action === 'approve' ? sessionUser.id : null,
        reviewedAt: new Date(),
      },
      include: {
        User_AffiliateDocument_approvedByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: action === 'approve' ? '문서가 승인되었습니다' : '문서가 거부되었습니다',
      document: {
        id: updatedDocument.id,
        documentType: updatedDocument.documentType,
        status: updatedDocument.status,
        reviewedAt: updatedDocument.reviewedAt,
        approvedBy: updatedDocument.User_AffiliateDocument_approvedByIdToUser ? {
          id: updatedDocument.User_AffiliateDocument_approvedByIdToUser.id,
          name: updatedDocument.User_AffiliateDocument_approvedByIdToUser.name,
          email: updatedDocument.User_AffiliateDocument_approvedByIdToUser.email,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('[Admin Approve Document] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '문서 승인/거부 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
