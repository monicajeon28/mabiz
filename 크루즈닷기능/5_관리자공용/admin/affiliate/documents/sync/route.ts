export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/documents/sync/route.ts
// 관리자용: 프로필 문서를 구글 드라이브에 동기화하는 API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { syncAllDocumentsToDrive } from '@/lib/affiliate/document-drive-sync';

export async function POST(req: NextRequest) {
  try {
    // 1. 관리자 확인
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, message: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });

    if (admin?.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 2. 요청 본문 파싱
    const body = await req.json();
    const { profileId } = body; // 특정 프로필 ID (선택 사항)

    if (profileId) {
      // 특정 프로필의 문서만 동기화
      const profileIdNum = parseInt(profileId);
      if (isNaN(profileIdNum)) {
        return NextResponse.json(
          { ok: false, message: '올바른 프로필 ID가 아닙니다' },
          { status: 400 }
        );
      }

      const profile = await prisma.affiliateProfile.findUnique({
        where: { id: profileIdNum },
        select: { id: true, displayName: true, affiliateCode: true },
      });

      if (!profile) {
        return NextResponse.json(
          { ok: false, message: '프로필을 찾을 수 없습니다' },
          { status: 404 }
        );
      }

      logger.log('[Document Sync] 프로필 문서 동기화 시작:', profile.displayName);
      const syncResult = await syncAllDocumentsToDrive(profileIdNum);

      if (syncResult.ok) {
        return NextResponse.json({
          ok: true,
          message: `${profile.displayName}의 문서 동기화가 완료되었습니다.`,
          results: syncResult.results,
        });
      } else {
        return NextResponse.json(
          { ok: false, message: syncResult.error || '문서 동기화 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    } else {
      // 모든 활성 프로필의 문서 동기화
      const profiles = await prisma.affiliateProfile.findMany({
        where: {
          status: 'ACTIVE',
          type: { in: ['BRANCH_MANAGER', 'SALES_AGENT'] },
        },
        select: { id: true, displayName: true, affiliateCode: true },
      });

      logger.log(`[Document Sync] 전체 프로필 문서 동기화 시작: ${profiles.length}개`);

      const allResults = {
        total: profiles.length,
        success: 0,
        failed: 0,
        details: [] as any[],
      };

      for (const profile of profiles) {
        const syncResult = await syncAllDocumentsToDrive(profile.id);
        if (syncResult.ok) {
          allResults.success++;
          allResults.details.push({
            profileId: profile.id,
            profileName: profile.displayName,
            status: 'SUCCESS',
            ...syncResult.results,
          });
        } else {
          allResults.failed++;
          allResults.details.push({
            profileId: profile.id,
            profileName: profile.displayName,
            status: 'FAILED',
            error: syncResult.error,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        message: `전체 문서 동기화가 완료되었습니다. (성공: ${allResults.success}, 실패: ${allResults.failed})`,
        results: allResults,
      });
    }
  } catch (error: any) {
    console.error('[Document Sync API] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '문서 동기화 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
