export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/contracts/[contractId]/upload-voice/[fileId]/route.ts
// 어필리에이트 계약서 특정 음성 파일 삭제 API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 인증 확인
async function requireAdmin() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { User: { select: { id: true, role: true, name: true } } },
    });

    if (!session?.User || session.User.role !== 'admin') return null;
    return session.User;
  } catch (error) {
    console.error('[Delete Voice] Session error:', error);
    return null;
  }
}

/**
 * DELETE: 특정 음성 파일 삭제
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { contractId: string; fileId: string } }
) {
  try {
    // 1. 관리자 인증 확인
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    const { contractId, fileId } = params;

    // 2. 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        metadata: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, error: '계약서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const metadata = (contract.metadata || {}) as any;
    const voiceRecordings = metadata.voiceRecordings || [];

    // 3. 삭제할 파일 찾기
    const fileIndex = voiceRecordings.findIndex((r: any) => r.id === fileId);

    if (fileIndex === -1) {
      return NextResponse.json(
        { ok: false, error: '삭제할 음성 파일을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const fileToDelete = voiceRecordings[fileIndex];

    // 4. 파일 시스템에서 삭제 (먼저 실행)
    if (fileToDelete.url) {
      const filePath = path.join(process.cwd(), 'public', fileToDelete.url);

      // 파일이 존재하면 삭제, 없으면 에러는 발생하지만 이미 삭제된 것으로 간주
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logger.log('[File Delete] 파일 삭제 성공:', filePath);
        } catch (error) {
          console.error('[File Delete Error] 파일 시스템 삭제 실패:', error);
          return NextResponse.json(
            {
              ok: false,
              error: '파일 삭제 중 오류가 발생했습니다',
              details: error instanceof Error ? error.message : '알 수 없는 오류'
            },
            { status: 500 }
          );
        }
      } else {
        console.warn('[File Delete Warning] 파일이 이미 삭제되었거나 존재하지 않습니다:', filePath);
        // 파일이 없으면 이미 삭제된 것으로 간주하고 계속 진행
      }
    }

    // 5. 배열에서 제거
    voiceRecordings.splice(fileIndex, 1);

    // 6. DB 업데이트 (파일 삭제 성공 후에만 실행)
    await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        metadata: {
          ...metadata,
          voiceRecordings,
        },
        updatedAt: new Date(),
      },
    });

    logger.log('[Voice Delete Success]', {
      contractId,
      fileId,
      deletedBy: admin.id,
      adminName: admin.name,
    });

    return NextResponse.json({
      ok: true,
      message: '음성 파일이 삭제되었습니다',
    });
  } catch (error: any) {
    console.error('[Voice Delete Error]:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || '파일 삭제 중 오류가 발생했습니다',
      },
      { status: 500 }
    );
  }
}
