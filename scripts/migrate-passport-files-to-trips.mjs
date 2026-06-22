/**
 * M2-5: Passport Files Migration Script
 * 기존 평면 폴더 구조 → Trip별 계층 구조로 마이그레이션
 *
 * 마이그레이션 전:
 *   마비즈CRM-여권백업/
 *   └─ 2026-06/
 *      ├─ guest-1-여권.webp
 *      ├─ guest-1-ocr.json
 *      └─ ...
 *
 * 마이그레이션 후:
 *   마비즈CRM-여권백업/
 *   └─ Org-{orgId}/
 *      └─ Trip-{tripId}/
 *         ├─ 여권이미지/
 *         │  ├─ guest-1.webp
 *         │  └─ guest-2.webp
 *         └─ OCR데이터/
 *            ├─ guest-1.json
 *            └─ guest-2.json
 */

import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';

// .env.local 로드
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

// Google API 설정
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;
const BACKUP_ACCESS_TOKEN = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;

/**
 * OAuth 2.0 인증 클라이언트 생성
 */
function createAuthClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
}

/**
 * Trip별 organizationId 조회 (OrganizationMember 통해)
 * - GmTrip → GmUser (userId) → OrganizationMember (organizationId)
 * - 없으면 fallback: "USER_{userId}"
 */
async function getOrganizationIdForTrip(tripId, userId) {
  try {
    // 1. OrganizationMember에서 조직 조회 (GmUser.id는 String이 아니므로 직접 연결 불가)
    // Fallback: Trip의 userId 기반으로 첫 번째 조직 찾기
    const members = await prisma.organizationMember.findMany({
      where: {
        userId: String(userId), // GmUser.id를 String으로 변환
      },
      select: {
        organizationId: true,
      },
      take: 1,
    });

    if (members.length > 0) {
      return members[0].organizationId;
    }

    // Fallback: USER_{tripId} (조직 정보 없을 경우)
    return `USER_${tripId}`;
  } catch (err) {
    console.error(`⚠️  organizationId 조회 실패 (Trip ${tripId}):`, err.message);
    return `USER_${tripId}`;
  }
}

/**
 * Trip별 폴더 생성/조회
 */
async function getOrCreateTripFolder(tripId, organizationId, accessToken) {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // 1. DB에서 기존 폴더 조회
    const tripConfig = await prisma.gmTripGoogleDriveConfig.findUnique({
      where: { tripId },
    });

    if (tripConfig?.googleFolderId && !tripConfig.deletedAt) {
      console.log(
        `  ✓ Trip ${tripId} 기존 폴더 조회: ${tripConfig.googleFolderId}`
      );
      return tripConfig.googleFolderId;
    }

    // 2. 루트 폴더 찾기 (마비즈CRM-여권백업)
    const rootListRes = await drive.files.list({
      q: "name='마비즈CRM-여권백업' and trashed=false and mimeType='application/vnd.google-apps.folder'",
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    if (!rootListRes.data.files?.length) {
      throw new Error('Root backup folder not found');
    }

    const rootFolderId = rootListRes.data.files[0].id;

    // 3. 조직 폴더 생성/조회
    const orgFolderName = `Org-${organizationId}`;
    const orgListRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and name='${orgFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    let orgFolderId;
    if (orgListRes.data.files?.length) {
      orgFolderId = orgListRes.data.files[0].id;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: orgFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        },
        fields: 'id',
      });
      orgFolderId = createRes.data.id;
      console.log(`  ✓ 조직 폴더 생성: ${orgFolderName}`);
    }

    // 4. Trip 폴더 생성/조회
    const tripFolderName = `Trip-${tripId}`;
    const tripListRes = await drive.files.list({
      q: `'${orgFolderId}' in parents and name='${tripFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    let tripFolderId;
    if (tripListRes.data.files?.length) {
      tripFolderId = tripListRes.data.files[0].id;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: tripFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [orgFolderId],
        },
        fields: 'id',
      });
      tripFolderId = createRes.data.id;
      console.log(`  ✓ Trip 폴더 생성: ${tripFolderName}`);
    }

    // 5. DB 저장
    await prisma.gmTripGoogleDriveConfig.upsert({
      where: { tripId },
      create: {
        tripId,
        googleFolderId: tripFolderId,
        googleFolderName: tripFolderName,
        accessToken: '',
        refreshToken: '',
        expiresAt: new Date(),
      },
      update: {
        googleFolderId: tripFolderId,
        googleFolderName: tripFolderName,
      },
    });

    console.log(`  ✓ Trip 폴더 생성 & DB 저장: ${tripFolderName}`);
    return tripFolderId;
  } catch (err) {
    console.error(`❌ getOrCreateTripFolder 실패:`, err);
    throw err;
  }
}

/**
 * Sub-folder 생성/조회 (여권이미지, OCR데이터)
 */
async function getOrCreateSubFolder(parentFolderId, folderName, accessToken) {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const listRes = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    if (listRes.data.files?.length) {
      return listRes.data.files[0].id;
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
    });

    console.log(`    ✓ ${folderName} 폴더 생성`);
    return createRes.data.id;
  } catch (err) {
    console.error(`❌ getOrCreateSubFolder 실패:`, err);
    throw err;
  }
}

/**
 * 파일 이동 (복사 후 원본 삭제)
 */
async function moveFileToFolder(fileId, targetFolderId, currentParentId, accessToken) {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    await drive.files.update(
      {
        fileId,
        addParents: targetFolderId,
        removeParents: currentParentId,
      },
      { supportsAllDrives: true }
    );
    return true;
  } catch (err) {
    console.error(`❌ 파일 이동 실패 (${fileId}):`, err);
    return false;
  }
}

/**
 * 파일명 변경
 */
async function renameFile(fileId, newName, accessToken) {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    await drive.files.update(
      {
        fileId,
        requestBody: {
          name: newName,
        },
      },
      { supportsAllDrives: true }
    );
    return true;
  } catch (err) {
    console.error(`❌ 파일 이름 변경 실패 (${fileId}):`, err);
    return false;
  }
}

/**
 * 메인 마이그레이션 로직
 */
async function migrateFilesToTripFolders() {
  console.log('🚀 마이그레이션 시작: 평면 폴더 → Trip별 계층');
  console.log('========================================\n');

  try {
    if (!BACKUP_ACCESS_TOKEN) {
      throw new Error('GOOGLE_OAUTH_ACCESS_TOKEN 환경변수가 설정되지 않았습니다');
    }

    // 1. 백업된 모든 guests 조회
    const guests = await prisma.gmPassportSubmissionGuest.findMany({
      where: {
        backupStatus: 'success',
        googleDriveFileId: { not: null },
      },
      include: {
        submission: {
          include: {
            trip: {
              include: {
                user: {
                  select: {
                    organizationId: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ submission: { tripId: 'asc' } }, { id: 'asc' }],
    });

    console.log(`✅ 총 ${guests.length}명의 guest 발견\n`);

    if (guests.length === 0) {
      console.log('마이그레이션할 파일이 없습니다.');
      await prisma.$disconnect();
      return;
    }

    let migratedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Trip별로 그룹화
    const guestsByTrip = new Map();
    for (const guest of guests) {
      const tripId = guest.submission?.tripId;
      if (!tripId) {
        console.log(`⚠️  게스트 ${guest.id} tripId 없음, 스킵`);
        skippedCount++;
        continue;
      }

      if (!guestsByTrip.has(tripId)) {
        guestsByTrip.set(tripId, []);
      }
      guestsByTrip.get(tripId).push(guest);
    }

    // 2. Trip별 처리
    for (const [tripId, tripGuests] of guestsByTrip.entries()) {
      console.log(`\n📋 Trip-${tripId}: ${tripGuests.length}명 처리 시작`);

      const trip = tripGuests[0].submission?.trip;
      if (!trip) {
        console.log(`❌ Trip ${tripId} 정보 없음, 스킵`);
        skippedCount += tripGuests.length;
        continue;
      }

      // organizationId 조회 (OrganizationMember 통해)
      const organizationId = await getOrganizationIdForTrip(tripId, trip.userId);
      console.log(`  ℹ️  organizationId: ${organizationId}`);

      if (!organizationId) {
        console.log(`❌ Trip ${tripId} organizationId 조회 실패, 스킵`);
        skippedCount += tripGuests.length;
        continue;
      }

      try {
        // Trip 폴더 생성/조회
        const tripFolderId = await getOrCreateTripFolder(
          tripId,
          organizationId,
          BACKUP_ACCESS_TOKEN
        );

        // 여권이미지, OCR데이터 폴더 생성
        const imageFolderId = await getOrCreateSubFolder(
          tripFolderId,
          '여권이미지',
          BACKUP_ACCESS_TOKEN
        );
        const ocrFolderId = await getOrCreateSubFolder(
          tripFolderId,
          'OCR데이터',
          BACKUP_ACCESS_TOKEN
        );

        // 각 guest 파일 이동
        for (const guest of tripGuests) {
          try {
            const oldImageFileId = guest.googleDriveFileId;
            const oldOcrFileId = guest.googleDriveFileIdOcr;

            // 이미지 파일 이동 + 이름 변경
            if (oldImageFileId) {
              const newImageFileName = `guest-${guest.id}.webp`;
              const moved = await moveFileToFolder(
                oldImageFileId,
                imageFolderId,
                '', // 현재 부모 (사용 안 함 - 구글드라이브는 다중 부모 지원)
                BACKUP_ACCESS_TOKEN
              );

              if (moved) {
                await renameFile(oldImageFileId, newImageFileName, BACKUP_ACCESS_TOKEN);
                console.log(`    ✓ 게스트 ${guest.id} 이미지 파일 이동: ${newImageFileName}`);
              }
            }

            // OCR 파일 이동 + 이름 변경
            if (oldOcrFileId) {
              const newOcrFileName = `guest-${guest.id}.json`;
              const moved = await moveFileToFolder(
                oldOcrFileId,
                ocrFolderId,
                '',
                BACKUP_ACCESS_TOKEN
              );

              if (moved) {
                await renameFile(oldOcrFileName, newOcrFileName, BACKUP_ACCESS_TOKEN);
                console.log(`    ✓ 게스트 ${guest.id} OCR 파일 이동: ${newOcrFileName}`);
              }
            }

            // DB 업데이트 (마이그레이션 추적)
            await prisma.gmPassportSubmissionGuest.update({
              where: { id: guest.id },
              data: {
                // 선택사항: migratedToTripFolder: true, 등의 필드 추가 가능
                updatedAt: new Date(),
              },
            });

            migratedCount++;
          } catch (err) {
            failedCount++;
            console.error(`    ❌ 게스트 ${guest.id} 마이그레이션 실패:`, err.message);
          }
        }

        console.log(`  ✅ Trip-${tripId} 마이그레이션 완료 (${tripGuests.length}명)`);
      } catch (err) {
        failedCount += tripGuests.length;
        console.error(`❌ Trip-${tripId} 처리 실패:`, err.message);
      }
    }

    // 3. 결과 출력
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 마이그레이션 완료:`);
    console.log(`   ✅ 성공: ${migratedCount}명`);
    console.log(`   ❌ 실패: ${failedCount}명`);
    console.log(`   ⏭️  스킵: ${skippedCount}명`);
    console.log(`   🎯 총: ${guests.length}명`);
    console.log(`${'='.repeat(50)}\n`);

    if (failedCount > 0) {
      console.log('⚠️  일부 파일 마이그레이션에 실패했습니다.');
      console.log('Google Drive API 할당량 또는 권한을 확인하세요.\n');
    } else {
      console.log('✨ 모든 파일이 성공적으로 마이그레이션되었습니다!\n');
    }
  } catch (err) {
    console.error('❌ 마이그레이션 중단:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
migrateFilesToTripFolders();
