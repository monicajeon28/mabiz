import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * M4-2: 복구 시 OCR 자동 채우기
 *
 * POST /api/backup/passport-ocr/[backupId]/restore
 *
 * 요청 본문:
 * {
 *   "contactId": "c_xxx",  // 어느 Contact에 복구할지
 *   "restoreOcrFields": ["name", "passportNumber", "expiryDate"] // 어떤 필드를
 * }
 *
 * 처리 흐름:
 * 1. PassportOCRBackupLog 조회 (backupId)
 * 2. 권한 검증 (organizationId)
 * 3. Contact 조회 (contactId)
 * 4. OCR 데이터에서 필요한 필드만 추출
 * 5. Contact의 passportInfo JSON에 병합
 * 6. PassportOCRBackupLog.status = RESTORED, restoredAt/restoredBy/restoredContactId 기록
 * 7. Ebbinghaus 알림 Cron 등록 (M4-3으로 넘어감)
 */

interface RouteParams {
  backupId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    // 1. 세션 검증
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId, restoreOcrFields = ['name', 'passportNumber', 'expiryDate'] } =
      (await req.json()) as {
        contactId?: string;
        restoreOcrFields?: string[];
      };

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    // 2. BackupLog 조회
    const backupLog = await prisma.passportOCRBackupLog.findUnique({
      where: { id: params.backupId },
    });

    if (!backupLog) {
      return NextResponse.json(
        { error: 'Backup not found' },
        { status: 404 }
      );
    }

    // 3. 권한 검증 (organizationId)
    if (session.organizationId !== backupLog.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 4. Contact 조회 및 권한 검증
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        organizationId: true,
        adminMemo: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    if (contact.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 5. OCR 데이터 추출 및 필드 필터링
    const ocrData = backupLog.ocrData as Record<string, unknown>;
    const filteredOcrData: Record<string, unknown> = {};

    for (const field of restoreOcrFields) {
      if (field in ocrData) {
        filteredOcrData[field] = ocrData[field];
      }
    }

    // 6. 메모장에 OCR 데이터 추가 (임시 해법)
    const adminMemoEntry = `[OCR 복구 ${params.backupId}] ${JSON.stringify(filteredOcrData)}`;
    const currentMemo = contact.adminMemo || '';
    const updatedMemo = currentMemo
      ? `${currentMemo}\n${adminMemoEntry}`
      : adminMemoEntry;

    // 7. Contact 업데이트
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        adminMemo: updatedMemo.substring(0, 2000), // 길이 제한
      },
      select: {
        id: true,
        adminMemo: true,
      },
    });

    // 8. BackupLog 상태 업데이트 (RESTORED)
    await prisma.passportOCRBackupLog.update({
      where: { id: params.backupId },
      data: {
        status: 'RESTORED',
        restoredAt: new Date(),
        restoredBy: session.userId,
        restoredContactId: contactId,
      },
    });

    // 9. PassportBackupReminderLog 업데이트 (contactId 설정)
    await prisma.passportBackupReminderLog.updateMany({
      where: { passportOCRBackupLogId: params.backupId },
      data: {
        contactId,
      },
    });

    logger.info(
      `[restore-passport-ocr] 복구 성공: backupId=${params.backupId}, contactId=${contactId}`,
      {
        restoredFields: restoreOcrFields,
      }
    );

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      backupLog: {
        id: params.backupId,
        status: 'RESTORED',
        restoredAt: new Date(),
      },
    });
  } catch (err) {
    logger.error('[restore-passport-ocr] 복구 실패', err);
    return NextResponse.json(
      { error: 'Restore failed', details: String(err) },
      { status: 500 }
    );
  }
}
