export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

const SESSION_COOKIE = 'cg.sid.v2';
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'admin-settings.json');

// 설정 파일 읽기
async function readSettingsFile(): Promise<any> {
  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // 파일이 없으면 기본값 반환
    return {
      kakaoApiManagers: [],
      kakaoApiKeys: [],
      kakaoSenderKeys: [],
      serverIps: [],
    };
  }
}

// 설정 파일 쓰기
async function writeSettingsFile(data: any): Promise<void> {
  // 디렉토리가 없으면 생성
  const dir = path.dirname(SETTINGS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 현재 IP 가져오기
function getCurrentIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIp || 'Unknown';
}

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
    console.error('[Admin Settings] Auth check error:', error);
    return null;
  }
}

// GET: 관리자 정보 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 403 });
    }

    // 설정 파일에서 추가 정보 읽기
    const settings = await readSettingsFile();
    const currentIp = getCurrentIp(req);

    // 자동화 설정 읽기 (SystemConfig에서)
    const automationConfigs = await prisma.systemConfig.findMany({
      where: {
        configKey: {
          startsWith: 'automation_',
        },
      },
    });

    const automationSettings: Record<string, boolean> = {};
    automationConfigs.forEach((config) => {
      const key = config.configKey.replace('automation_', '');
      automationSettings[key] = config.configValue === 'true' || config.configValue === '1';
    });

    // 환경 변수에서 정보 가져오기 (민감한 정보는 마스킹하지 않고 그대로 반환)
    const info = {
      email: process.env.EMAIL_SMTP_USER || '',
      emailFromName: process.env.EMAIL_FROM_NAME || '',
      emailSmtpHost: process.env.EMAIL_SMTP_HOST || '',
      emailSmtpPort: process.env.EMAIL_SMTP_PORT || '',
      emailSmtpPassword: process.env.EMAIL_SMTP_PASSWORD || '',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      kakaoJsKey: process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '',
      kakaoAppName: process.env.KAKAO_APP_NAME || '크루즈닷',
      kakaoAppId: process.env.KAKAO_APP_ID || '1293313',
      kakaoRestApiKey: process.env.KAKAO_REST_API_KEY || '',
      kakaoAdminKey: process.env.KAKAO_ADMIN_KEY || '',
      kakaoChannelId: process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID || '',
      kakaoChannelName: '크루즈닷', // 채널 이름
      kakaoChannelSearchId: 'cruisedot', // 검색용 아이디
      kakaoChannelUrl: process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID ? `https://pf.kakao.com/_${process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID}` : 'http://pf.kakao.com/_CzxgPn',
      kakaoChannelChatUrl: process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID ? `https://pf.kakao.com/_${process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID}/chat` : 'http://pf.kakao.com/_CzxgPn/chat',
      kakaoChannelBotId: process.env.KAKAO_CHANNEL_BOT_ID || '',
      aligoApiKey: process.env.ALIGO_API_KEY || '',
      aligoUserId: process.env.ALIGO_USER_ID || '',
      aligoSenderPhone: process.env.ALIGO_SENDER_PHONE || '01032893800',
      aligoKakaoSenderKey: process.env.ALIGO_KAKAO_SENDER_KEY || '',
      aligoKakaoChannelId: process.env.ALIGO_KAKAO_CHANNEL_ID || '',
      pgSignkey: process.env.PG_SIGNKEY || '',
      pgFieldEncryptIv: process.env.PG_FIELD_ENCRYPT_IV || '',
      pgFieldEncryptKey: process.env.PG_FIELD_ENCRYPT_KEY || '',
      pgSignkeyNonAuth: process.env.PG_SIGNKEY_NON_AUTH || '',
      pgFieldEncryptIvNonAuth: process.env.PG_FIELD_ENCRYPT_IV_NON_AUTH || '',
      pgFieldEncryptKeyNonAuth: process.env.PG_FIELD_ENCRYPT_KEY_NON_AUTH || '',
      pgMidAuth: process.env.PG_MID_AUTH || '',
      pgMidPassword: process.env.PG_MID_PASSWORD || '',
      pgMidNonAuth: process.env.PG_MID_NON_AUTH || '',
      pgAdminUrl: process.env.PG_ADMIN_URL || '',
      pgMerchantName: process.env.PG_MERCHANT_NAME || '',
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || '',
      welcomePayUrl: process.env.NEXT_PUBLIC_WELCOME_PAY_URL || '',
      payappUserid: process.env.PAYAPP_USERID || '',
      payappLinkkey: process.env.PAYAPP_LINKKEY || '',
      payappLinkval: process.env.PAYAPP_LINKVAL || '',
      pgCallbackUrl: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/callback` : '',
      pgNotifyUrl: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/notify` : '',
      pgVirtualAccountUrl: process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/virtual-account` : '',
      sendMethod: process.env.EMAIL_SMTP_HOST === 'smtp.gmail.com' ? 'Gmail SMTP' : '기타',
      youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
      googleDriveServiceAccountEmail: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
      googleDriveServiceAccountPrivateKey: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '',
      googleDriveSharedDriveId: process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || '',
      googleDriveRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '',
      googleDrivePassportFolderId: process.env.GOOGLE_DRIVE_PASSPORT_FOLDER_ID || '',
      // Google Sheets
      communityBackupSpreadsheetId: process.env.COMMUNITY_BACKUP_SPREADSHEET_ID || '',
      tripApisArchiveSpreadsheetId: process.env.TRIP_APIS_ARCHIVE_SPREADSHEET_ID || '',
      // Upload folders
      googleDriveUploadsImagesFolderId: process.env.GOOGLE_DRIVE_UPLOADS_IMAGES_FOLDER_ID || '',
      googleDriveUploadsProfilesFolderId: process.env.GOOGLE_DRIVE_UPLOADS_PROFILES_FOLDER_ID || '',
      googleDriveUploadsReviewsFolderId: process.env.GOOGLE_DRIVE_UPLOADS_REVIEWS_FOLDER_ID || '',
      googleDriveUploadsAudioFolderId: process.env.GOOGLE_DRIVE_UPLOADS_AUDIO_FOLDER_ID || '',
      googleDriveUploadsDocumentsFolderId: process.env.GOOGLE_DRIVE_UPLOADS_DOCUMENTS_FOLDER_ID || '',
      googleDriveUploadsVideosFolderId: process.env.GOOGLE_DRIVE_UPLOADS_VIDEOS_FOLDER_ID || '',
      googleDriveUploadsSalesAudioFolderId: process.env.GOOGLE_DRIVE_UPLOADS_SALES_AUDIO_FOLDER_ID || '',
      googleDriveUploadsFontsFolderId: process.env.GOOGLE_DRIVE_UPLOADS_FONTS_FOLDER_ID || '',
      googleDriveContractsPdfsFolderId: process.env.GOOGLE_DRIVE_CONTRACTS_PDFS_FOLDER_ID || '',
      googleDriveProductsFolderId: process.env.GOOGLE_DRIVE_PRODUCTS_FOLDER_ID || '',
      googleDriveCruiseImagesFolderId: process.env.GOOGLE_DRIVE_CRUISE_IMAGES_FOLDER_ID || '',
      // Affiliate documents
      googleDriveContractsFolderId: process.env.GOOGLE_DRIVE_CONTRACTS_FOLDER_ID || '',
      googleDriveContractSignaturesFolderId: process.env.GOOGLE_DRIVE_CONTRACT_SIGNATURES_FOLDER_ID || '',
      googleDriveContractAudioFolderId: process.env.GOOGLE_DRIVE_CONTRACT_AUDIO_FOLDER_ID || '',
      googleDriveIdCardFolderId: process.env.GOOGLE_DRIVE_ID_CARD_FOLDER_ID || '',
      googleDriveBankbookFolderId: process.env.GOOGLE_DRIVE_BANKBOOK_FOLDER_ID || '',
      // Additional folders
      googleDriveCompanyLogoFolderId: process.env.GOOGLE_DRIVE_COMPANY_LOGO_FOLDER_ID || '',
      googleDriveAffiliateInfoFolderId: process.env.GOOGLE_DRIVE_AFFILIATE_INFO_FOLDER_ID || '',
      kakaoApiManagers: settings.kakaoApiManagers || [],
      kakaoApiKeys: settings.kakaoApiKeys || [],
      kakaoSenderKeys: settings.kakaoSenderKeys || [],
      serverIps: settings.serverIps || [],
      currentIp: currentIp,
      automationSettings: automationSettings,
    };

    return NextResponse.json({ ok: true, info });
  } catch (error) {
    console.error('[Admin Settings GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch admin info' },
      { status: 500 }
    );
  }
}
