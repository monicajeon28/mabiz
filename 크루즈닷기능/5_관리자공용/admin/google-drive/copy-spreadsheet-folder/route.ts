export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getDriveClient } from '@/lib/google-drive';
import { google } from 'googleapis';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return {
      id: session.User.id,
      name: session.User.name,
      role: session.User.role,
    };
  } catch (error) {
    console.error('[Copy Spreadsheet Folder] Auth check error:', error);
    return null;
  }
}

// POST: 스프레드시트 ID로 폴더 복사
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { spreadsheetId, targetFolderId, folderName } = body as {
      spreadsheetId: string;
      targetFolderId: string;
      folderName?: string;
    };

    if (!spreadsheetId || !targetFolderId) {
      return NextResponse.json(
        { ok: false, error: '스프레드시트 ID와 대상 폴더 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const drive = getDriveClient();
    const sheets = google.sheets({ version: 'v4', auth: drive as any });

    // 1. 스프레드시트 정보 가져오기
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const spreadsheetTitle = spreadsheetInfo.data.properties?.title || folderName || `복사본_${Date.now()}`;

    // 2. 스프레드시트를 Drive 파일로 복사
    const copiedFile = await drive.files.copy({
      fileId: spreadsheetId,
      requestBody: {
        name: spreadsheetTitle,
      },
    });

    if (!copiedFile.data.id) {
      throw new Error('파일 복사 실패');
    }

    const newSpreadsheetId = copiedFile.data.id;

    // 3. 복사된 파일을 대상 폴더로 이동
    await drive.files.update({
      fileId: newSpreadsheetId,
      addParents: targetFolderId,
      removeParents: 'root',
      fields: 'id, parents',
    });

    return NextResponse.json({
      ok: true,
      message: '스프레드시트가 성공적으로 복사되었습니다.',
      spreadsheetId: newSpreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}`,
      folderId: targetFolderId,
    });
  } catch (error) {
    console.error('[Copy Spreadsheet Folder] Error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : '스프레드시트 복사 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}


