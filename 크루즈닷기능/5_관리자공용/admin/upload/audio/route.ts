export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { getGoogleAccessToken } from '@/lib/google-auth-jwt';

// B2B 오디오 폴더 ID (환경변수에서 가져옴)
const B2B_AUDIO_FOLDER_ID = process.env.GOOGLE_DRIVE_B2B_AUDIO_FOLDER_ID || '15h6_By31Y4Xy1MwIIWwkSc-uI-YI3A_S';

// 파일 크기 제한 (4MB)
const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// GET 핸들러 - API 라우트 존재 확인용
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Admin Audio Upload API is available',
    method: 'POST',
    maxFileSize: `${MAX_FILE_SIZE_MB}MB`,
    supportedFormats: ['mp3', 'wav', 'm4a', 'ogg', 'webm'],
  });
}

// OPTIONS 핸들러 (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  console.log('[Admin Audio Upload] POST request received');
  try {
    const auth = await checkAdminAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const customerId = formData.get('customerId') as string;
    const prospectType = formData.get('prospectType') as string;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 없습니다.' }, { status: 400 });
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({
        ok: false,
        error: `파일 크기가 ${MAX_FILE_SIZE_MB}MB를 초과합니다.`,
      }, { status: 413 });
    }

    // 파일 확장자 확인
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      return NextResponse.json({ ok: false, error: '지원하지 않는 오디오 형식입니다.' }, { status: 400 });
    }

    // 파일명 생성
    const originalFileName = file.name;
    const ext = file.name.split('.').pop() || 'mp3';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const typePrefix = prospectType === 'lead' ? 'B2B유입' : '시스템상담';
    const baseNameWithoutExt = originalFileName.replace(/\.[^/.]+$/, '');
    const fileName = `${typePrefix}_${baseNameWithoutExt}_${customerId || 'unknown'}_${timestamp}.${ext}`;

    // Google Drive REST API로 직접 업로드
    const accessToken = await getGoogleAccessToken();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. 파일 메타데이터와 함께 업로드 (multipart upload)
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      parents: [B2B_AUDIO_FOLDER_ID],
      mimeType: file.type || 'audio/mpeg',
    };

    const multipartBody = Buffer.concat([
      Buffer.from(
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${file.type || 'audio/mpeg'}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n'
      ),
      Buffer.from(buffer.toString('base64')),
      Buffer.from(closeDelimiter),
    ]);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Admin Audio Upload] Google Drive upload failed:', errorText);
      throw new Error(`Google Drive 업로드 실패: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;

    if (!fileId) {
      throw new Error('Google Drive 업로드 실패: 파일 ID 없음');
    }

    // 2. 파일 공개 설정
    const permissionResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );

    if (!permissionResponse.ok) {
      const permError = await permissionResponse.text();
      console.warn('[Admin Audio Upload] Permission setting failed:', permError);
    } else {
      console.log('[Admin Audio Upload] File permission set to public');
    }

    // 프록시 다운로드 URL 사용 (403 권한 문제 해결)
    const driveViewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const driveDownloadUrl = `/api/drive/download/${fileId}`;

    console.log(`[Admin Audio Upload] Success: ${fileName} -> ${driveViewUrl}`);

    return NextResponse.json({
      ok: true,
      url: driveViewUrl,
      downloadUrl: driveDownloadUrl,
      fileId: fileId,
      fileName: fileName,
      originalFileName: originalFileName,
      message: '녹음 파일이 업로드되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Audio Upload Error]', error);
    return NextResponse.json({
      ok: false,
      error: error.message || '파일 업로드에 실패했습니다.',
    }, { status: 500 });
  }
}
