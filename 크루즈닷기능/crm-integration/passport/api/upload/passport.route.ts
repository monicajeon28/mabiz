import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateFolder, uploadFileToDrive } from '@/lib/google-drive';

export const runtime = 'nodejs'; // Edge Runtime 금지 (파일 시스템 접근 필요)
export const dynamic = 'force-dynamic'; // 이미지 업로드는 캐시 X

/**
 * POST /api/upload/passport
 * 여권 이미지를 구글 드라이브에 체계적으로 저장합니다.
 * 
 * 입력:
 * - file: 이미지 파일
 * - tripInfo: { departureDate: string (YYYYMMDD), shipName: string }
 * - userInfo: { name: string, phoneLast4: string, passportNo: string, engName: string }
 * 
 * 출력:
 * - webViewLink: 구글 드라이브 공유 링크
 */
export async function POST(req: NextRequest) {
  try {
    // FormData 파싱
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tripInfoStr = formData.get('tripInfo') as string | null;
    const userInfoStr = formData.get('userInfo') as string | null;

    // 필수 입력값 검증
    if (!file) {
      return NextResponse.json(
        { ok: false, error: '이미지 파일이 없습니다.' },
        { status: 400 }
      );
    }

    if (!tripInfoStr || !userInfoStr) {
      return NextResponse.json(
        { ok: false, error: 'tripInfo 또는 userInfo가 없습니다.' },
        { status: 400 }
      );
    }

    // JSON 파싱
    let tripInfo: { departureDate: string; shipName: string };
    let userInfo: { name: string; phoneLast4: string; passportNo: string; engName: string };

    try {
      tripInfo = JSON.parse(tripInfoStr);
      userInfo = JSON.parse(userInfoStr);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: 'tripInfo 또는 userInfo JSON 파싱 실패' },
        { status: 400 }
      );
    }

    // 입력값 검증
    if (!tripInfo.departureDate || !tripInfo.shipName) {
      return NextResponse.json(
        { ok: false, error: 'tripInfo에 departureDate와 shipName이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!userInfo.name || !userInfo.phoneLast4 || !userInfo.passportNo || !userInfo.engName) {
      return NextResponse.json(
        { ok: false, error: 'userInfo에 name, phoneLast4, passportNo, engName이 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: '지원하지 않는 이미지 형식입니다. JPEG, PNG, WebP만 지원합니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: '파일 크기는 10MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 여권 전용 폴더 ID (통일된 여권 백업 폴더)
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const rootFolderId = await getDriveFolderId('PASSPORTS');

    // Level 1: 여행 상품 폴더 생성/검색
    // 형식: [출발일]_[선박명] (예: 20250510_MSC Bellissima)
    const tripFolderName = `${tripInfo.departureDate}_${tripInfo.shipName}`;
    const tripFolderResult = await findOrCreateFolder(tripFolderName, rootFolderId);

    if (!tripFolderResult.ok || !tripFolderResult.folderId) {
      return NextResponse.json(
        { ok: false, error: `여행 상품 폴더 생성 실패: ${tripFolderResult.error}` },
        { status: 500 }
      );
    }

    // Level 2: 예약 그룹 폴더 생성/검색
    // 형식: [예약자명]_[전화뒷4자리] (예: 김여행_5678)
    const groupFolderName = `${userInfo.name}_${userInfo.phoneLast4}`;
    const groupFolderResult = await findOrCreateFolder(groupFolderName, tripFolderResult.folderId);

    if (!groupFolderResult.ok || !groupFolderResult.folderId) {
      return NextResponse.json(
        { ok: false, error: `예약 그룹 폴더 생성 실패: ${groupFolderResult.error}` },
        { status: 500 }
      );
    }

    // 파일명 생성
    // 형식: [여권번호]_[성명].jpg (예: M1234567_HONGGILDONG.jpg)
    const fileName = `${userInfo.passportNo}_${userInfo.engName.toUpperCase()}.jpg`;

    // 파일을 Buffer로 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Level 3: 파일 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: groupFolderResult.folderId,
      fileName,
      mimeType: file.type,
      buffer,
      makePublic: false, // 공유 드라이브이므로 공개 권한 불필요
    });

    if (!uploadResult.ok || !uploadResult.url) {
      return NextResponse.json(
        { ok: false, error: `파일 업로드 실패: ${uploadResult.error}` },
        { status: 500 }
      );
    }

    // 성공 응답
    return NextResponse.json({
      ok: true,
      webViewLink: uploadResult.url,
      fileId: uploadResult.fileId,
      folderPath: `${tripFolderName}/${groupFolderName}/${fileName}`,
    });
  } catch (error: any) {
    console.error('[Passport Upload API] Error:', error);

    return NextResponse.json(
      { ok: false, error: error?.message || '여권 이미지 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


