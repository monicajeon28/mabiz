export const dynamic = 'force-dynamic';

// app/api/admin/system/google-drive/route.ts
// Google Drive 설정 API

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return session.User;
  } catch (error) {
    console.error('[GoogleDriveConfig] Auth check error:', error);
    return null;
  }
}

/**
 * GET: Google Drive 설정 조회
 */
export async function GET() {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 설정 조회 또는 생성
    const configs = await prisma.systemConfig.findMany({
      where: {
        category: 'google_drive',
        configKey: {
          in: [
            'google_drive_id_card_folder_id',
            'google_drive_bankbook_folder_id',
            'google_drive_sales_audio_folder_id',
            'google_drive_contracts_folder_id',
            'google_drive_signatures_folder_id',
            'google_drive_passports_folder_id',
            'google_drive_cruise_images_folder_id',
            'google_drive_cruise_materials_folder_id',
            'google_drive_products_folder_id',
          ],
        },
      },
    });

    // 설정값을 객체로 변환
    const configMap: Record<string, string> = {};
    configs.forEach((c) => {
      configMap[c.configKey] = c.configValue || '';
    });

    return NextResponse.json({
      ok: true,
      config: {
        idCardFolderId: configMap['google_drive_id_card_folder_id'] || '',
        bankbookFolderId: configMap['google_drive_bankbook_folder_id'] || '',
        salesAudioFolderId: configMap['google_drive_sales_audio_folder_id'] || '',
        contractsFolderId: configMap['google_drive_contracts_folder_id'] || '',
        signaturesFolderId: configMap['google_drive_signatures_folder_id'] || '',
        passportsFolderId: configMap['google_drive_passports_folder_id'] || '',
        cruiseImagesFolderId: configMap['google_drive_cruise_images_folder_id'] || '',
        cruiseMaterialsFolderId: configMap['google_drive_cruise_materials_folder_id'] || '',
        productsFolderId: configMap['google_drive_products_folder_id'] || '',
      },
    });
  } catch (error: any) {
    console.error('[GoogleDriveConfig] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '설정을 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST: Google Drive 설정 저장
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      idCardFolderId,
      bankbookFolderId,
      salesAudioFolderId,
      contractsFolderId,
      signaturesFolderId,
      passportsFolderId,
      cruiseImagesFolderId,
      cruiseMaterialsFolderId,
      productsFolderId,
    } = body;

    // 입력값 검증
    if (
      !idCardFolderId ||
      !bankbookFolderId ||
      !salesAudioFolderId ||
      !contractsFolderId ||
      !signaturesFolderId ||
      !passportsFolderId ||
      !cruiseImagesFolderId ||
      !cruiseMaterialsFolderId ||
      !productsFolderId
    ) {
      return NextResponse.json(
        { ok: false, error: '모든 폴더 ID를 입력해주세요' },
        { status: 400 }
      );
    }

    // 폴더 ID 형식 검증 (알파벳, 숫자, 하이픈, 언더스코어만 허용)
    const folderIdPattern = /^[a-zA-Z0-9_-]+$/;
    const folderIds = [
      idCardFolderId,
      bankbookFolderId,
      salesAudioFolderId,
      contractsFolderId,
      signaturesFolderId,
      passportsFolderId,
      cruiseImagesFolderId,
      cruiseMaterialsFolderId,
      productsFolderId,
    ];

    if (folderIds.some((id) => !folderIdPattern.test(id))) {
      return NextResponse.json(
        { ok: false, error: '올바른 폴더 ID 형식이 아닙니다' },
        { status: 400 }
      );
    }

    // 설정 저장 또는 업데이트
    await prisma.$transaction([
      // 신분증 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_id_card_folder_id' },
        update: {
          configValue: idCardFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_id_card_folder_id',
          configValue: idCardFolderId,
          description: '신분증 업로드 폴더 ID',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
      // 통장 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_bankbook_folder_id' },
        update: {
          configValue: bankbookFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_bankbook_folder_id',
          configValue: bankbookFolderId,
          description: '통장 업로드 폴더 ID',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
      // 녹음 파일 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_sales_audio_folder_id' },
        update: {
          configValue: salesAudioFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_sales_audio_folder_id',
          configValue: salesAudioFolderId,
          description: '녹음 파일 업로드 폴더 ID',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
      // 계약서 PDF 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_contracts_folder_id' },
        update: {
          configValue: contractsFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_contracts_folder_id',
          configValue: contractsFolderId,
          description: '계약서 PDF 폴더 ID',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
      // 계약서 서명 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_signatures_folder_id' },
        update: {
          configValue: signaturesFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_signatures_folder_id',
          configValue: signaturesFolderId,
          description: '계약서 서명 폴더 ID',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
      // 여권 제출 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_passports_folder_id' },
        update: {
          configValue: passportsFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_passports_folder_id',
          configValue: passportsFolderId,
          description: '여권 제출 폴더 ID',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
      // 크루즈정보사진 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_cruise_images_folder_id' },
        update: {
          configValue: cruiseImagesFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_cruise_images_folder_id',
          configValue: cruiseImagesFolderId,
          description: '크루즈정보사진 폴더 ID',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
      // 크루즈 자료 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_cruise_materials_folder_id' },
        update: {
          configValue: cruiseMaterialsFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_cruise_materials_folder_id',
          configValue: cruiseMaterialsFolderId,
          description: '크루즈 자료 폴더 ID',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
      // 상품 폴더 ID
      prisma.systemConfig.upsert({
        where: { configKey: 'google_drive_products_folder_id' },
        update: {
          configValue: productsFolderId,
          updatedAt: new Date(),
        },
        create: {
          configKey: 'google_drive_products_folder_id',
          configValue: productsFolderId,
          description: '상품 폴더 ID (썸네일, 상세페이지 이미지 백업)',
          category: 'google_drive',
          updatedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: 'Google Drive 설정이 저장되었습니다',
    });
  } catch (error: any) {
    console.error('[GoogleDriveConfig] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '설정 저장에 실패했습니다' },
      { status: 500 }
    );
  }
}
