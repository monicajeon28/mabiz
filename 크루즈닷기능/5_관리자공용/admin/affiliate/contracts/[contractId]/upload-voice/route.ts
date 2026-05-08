export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/contracts/[contractId]/upload-voice/route.ts
// 어필리에이트 계약서 음성 파일 업로드 API (보안 강화)

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { uploadAffiliateInfoFile } from '@/lib/google-drive-affiliate-info';

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
    console.error('[Upload Voice] Session error:', error);
    return null;
  }
}

// ========== 보안 상수 ==========
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
];

const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg', 'webm'];

// 파일명 sanitize (경로 조작 방지)
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    .replace(/\.{2,}/g, '.') // 연속된 점 제거
    .replace(/^\./, '') // 시작 점 제거
    .substring(0, 255); // 파일명 길이 제한
}

// 매직 바이트를 사용한 실제 파일 형식 검증
function validateAudioFile(uint8Array: Uint8Array, mimeType: string): boolean {
  if (uint8Array.length < 12) {
    return false; // 최소 12바이트 필요 (M4A ftyp 확인용)
  }

  // MP3: ID3v2 태그 (49 44 33 = "ID3")
  const isMP3_ID3 =
    uint8Array[0] === 0x49 &&
    uint8Array[1] === 0x44 &&
    uint8Array[2] === 0x33;

  // MP3: 프레임 동기화 바이트 (FF FB, FF F3, FF F2)
  const isMP3_Frame =
    uint8Array[0] === 0xff &&
    (uint8Array[1] === 0xfb || uint8Array[1] === 0xf3 || uint8Array[1] === 0xf2);

  const isMP3 = isMP3_ID3 || isMP3_Frame;

  // WAV: RIFF 헤더 (52 49 46 46 = "RIFF") + WAVE (offset 8-11)
  const isWAV =
    uint8Array[0] === 0x52 &&
    uint8Array[1] === 0x49 &&
    uint8Array[2] === 0x46 &&
    uint8Array[3] === 0x46 &&
    uint8Array[8] === 0x57 && // 'W'
    uint8Array[9] === 0x41 && // 'A'
    uint8Array[10] === 0x56 && // 'V'
    uint8Array[11] === 0x45; // 'E'

  // M4A: ftyp box (offset 4-7: 66 74 79 70 = "ftyp")
  const isM4A_ftyp =
    uint8Array[4] === 0x66 &&
    uint8Array[5] === 0x74 &&
    uint8Array[6] === 0x79 &&
    uint8Array[7] === 0x70;

  // M4A brand 확인 (offset 8-11)
  const m4aBrand = isM4A_ftyp
    ? String.fromCharCode(uint8Array[8], uint8Array[9], uint8Array[10], uint8Array[11])
    : '';
  const isM4A = isM4A_ftyp && (m4aBrand === 'M4A ' || m4aBrand === 'M4B ' || m4aBrand === 'mp42');

  // WebM: EBML 헤더 (1A 45 DF A3)
  const isWebM =
    uint8Array[0] === 0x1a &&
    uint8Array[1] === 0x45 &&
    uint8Array[2] === 0xdf &&
    uint8Array[3] === 0xa3;

  // OGG: OggS 헤더 (4F 67 67 53 = "OggS")
  const isOgg =
    uint8Array[0] === 0x4f &&
    uint8Array[1] === 0x67 &&
    uint8Array[2] === 0x67 &&
    uint8Array[3] === 0x53;

  // MIME 타입과 매직 바이트 매칭 확인
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
    return isMP3;
  }
  if (mimeType.includes('wav')) {
    return isWAV;
  }
  if (mimeType.includes('m4a') || mimeType.includes('x-m4a')) {
    return isM4A;
  }
  if (mimeType.includes('webm')) {
    return isWebM;
  }
  if (mimeType.includes('ogg')) {
    return isOgg;
  }

  // MIME 타입이 명확하지 않은 경우, 매직 바이트 중 하나라도 일치하면 허용
  return isMP3 || isWAV || isM4A || isWebM || isOgg;
}

/**
 * POST: 음성 파일 업로드
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { contractId: string } }
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

    const { contractId } = params;

    // 2. 계약서 존재 확인
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        metadata: true,
        invitedByProfileId: true,
        User_AffiliateContract_invitedByProfileIdToUser: {
          select: { name: true }
        }
      }
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, error: '계약서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 3. FormData에서 파일 추출
    const formData = await req.formData();
    const file = formData.get('file');

    // 타입 가드: File 객체인지 확인
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: '파일을 업로드해주세요' },
        { status: 400 }
      );
    }

    // ========== 보안 검증 시작 ==========

    // 4. MIME 타입 검증 (오디오 파일만 허용)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: '지원하는 파일 형식: MP3, WAV, M4A, OGG, WebM',
          received: file.type,
        },
        { status: 400 }
      );
    }

    // 5. 파일 크기 제한 (50MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: '파일 크기는 50MB를 초과할 수 없습니다',
          size: (file.size / 1024 / 1024).toFixed(2) + 'MB',
        },
        { status: 400 }
      );
    }

    // 6. 파일 확장자 화이트리스트 검증
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          ok: false,
          error: '허용되지 않는 파일 확장자입니다',
          allowed: ALLOWED_EXTENSIONS.join(', '),
        },
        { status: 400 }
      );
    }

    // 7. 매직 바이트 검증 (파일 실제 내용 검증)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uint8Array = new Uint8Array(arrayBuffer);

    if (!validateAudioFile(uint8Array, file.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: '유효하지 않은 음성 파일입니다. 파일이 손상되었거나 형식이 올바르지 않습니다.',
        },
        { status: 400 }
      );
    }

    // 8. 파일명 sanitize (경로 조작 방지)
    const sanitizedFileName = sanitizeFileName(file.name);
    const finalFileName = sanitizedFileName || 'voice_' + Date.now() + '.' + ext;

    // ========== 보안 검증 종료 ==========

    // 9. 파일 저장 디렉토리 설정
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'affiliate',
      'contracts',
      contractId
    );

    // 디렉토리 생성 (존재하지 않으면)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 10. 파일 저장 경로
    const timestamp = Date.now();
    const uniqueFileName = timestamp + '_' + finalFileName;
    const filePath = path.join(uploadDir, uniqueFileName);

    // 11. 파일 저장 및 DB 업데이트 (트랜잭션으로 원자성 보장)
    let tempFilePath = '';
    let driveUrl: string | null = null;
    let driveFileId: string | null = null;

    try {
      // 11-1. 파일 먼저 저장
      fs.writeFileSync(filePath, buffer);
      tempFilePath = filePath;

      // 11-2. Google Drive에 백업 (선택적, 실패해도 계속 진행)
      if (contract.invitedByProfileId) {
        try {
          const driveResult = await uploadAffiliateInfoFile(
            contract.invitedByProfileId,
            buffer,
            uniqueFileName,
            file.type,
            'audio'
          );

          if (driveResult.ok && driveResult.url) {
            driveUrl = driveResult.url;
            driveFileId = driveResult.fileId || null;
            logger.log('[Voice Upload] Google Drive 백업 성공:', driveUrl);
          } else {
            console.warn('[Voice Upload] Google Drive 백업 실패:', driveResult.error);
          }
        } catch (driveError) {
          console.error('[Voice Upload] Google Drive 백업 에러:', driveError);
          // Drive 백업 실패는 전체 업로드를 막지 않음
        }
      }

      // 11-3. DB 업데이트 (트랜잭션)
      const fileUrl = '/uploads/affiliate/contracts/' + contractId + '/' + uniqueFileName;

      const updatedContract = await prisma.$transaction(async (tx) => {
        // 계약서 재확인 (트랜잭션 내에서)
        const verifyContract = await tx.affiliateContract.findUnique({
          where: { id: contractId },
          select: { id: true, metadata: true },
        });

        if (!verifyContract) {
          throw new Error('Contract not found');
        }

        const metadata = (verifyContract.metadata || {}) as any;
        const voiceRecordings = metadata.voiceRecordings || [];

        const newRecording = {
          id: driveFileId || uniqueFileName,
          url: fileUrl,
          driveUrl: driveUrl || null,
          name: file.name,
          uploadedBy: admin.name || '관리자',
          uploadedByRole: 'ADMIN',
          uploadedAt: new Date().toISOString(),
        };

        voiceRecordings.push(newRecording);

        return await tx.affiliateContract.update({
          where: { id: contractId },
          data: {
            metadata: {
              ...metadata,
              voiceRecordings,
            },
            updatedAt: new Date(),
          },
        });
      });

      // 11-4. 업로드 로그 기록
      logger.log('[Voice Upload Success]', {
        contractId,
        fileName: uniqueFileName,
        size: file.size,
        type: file.type,
        uploadedBy: admin.id,
        adminName: admin.name,
        driveUrl,
      });

      return NextResponse.json({
        ok: true,
        data: {
          url: fileUrl,
          driveUrl,
          fileName: uniqueFileName,
          size: file.size,
          type: file.type,
          contract: {
            id: updatedContract.id,
            voiceRecordings: (updatedContract.metadata as any)?.voiceRecordings || [],
          },
        },
      });

    } catch (uploadError: any) {
      // DB 업데이트 실패 시 파일 정리 (orphan 파일 방지)
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.log('[Voice Upload] 파일 정리 완료:', tempFilePath);
        } catch (cleanupError) {
          console.error('[Voice Upload] 파일 정리 실패:', cleanupError);
        }
      }

      // 에러 재발생
      throw uploadError;
    }
  } catch (error: any) {
    console.error('[Voice Upload Error]:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || '파일 업로드 중 오류가 발생했습니다',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 음성 파일 삭제
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { contractId: string } }
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

    const { contractId } = params;

    // 2. 계약서 조회
    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, error: '계약서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (!contract.voiceRecordingUrl) {
      return NextResponse.json(
        { ok: false, error: '삭제할 음성 파일이 없습니다' },
        { status: 400 }
      );
    }

    // 3. 파일 시스템에서 삭제
    const filePath = path.join(process.cwd(), 'public', contract.voiceRecordingUrl);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('[File Delete Warning]:', error);
      // 파일이 이미 없어도 계속 진행
    }

    // 4. DB에서 URL 제거
    await prisma.affiliateContract.update({
      where: { id: contractId },
      data: {
        voiceRecordingUrl: null,
        updatedAt: new Date(),
      },
    });

    logger.log('[Voice Delete Success]', {
      contractId,
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
