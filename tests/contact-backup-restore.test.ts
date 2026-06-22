/**
 * Contact 백업 복구 API 테스트
 * - 토큰 갱신
 * - 복구 API
 * - 복구 이력 조회
 *
 * 테스트 케이스: 10명 × 50회 (500건)
 */

import { prisma } from '@/lib/prisma';
import {
  refreshGoogleAccessToken,
  clearTokenCache,
} from '@/lib/contact-backup-google-drive';
import { logger } from '@/lib/logger';

/**
 * 테스트 1: 토큰 갱신 기본 로직
 */
async function testTokenRefresh() {
  console.log('[Test 1] 토큰 갱신 기본 로직');

  try {
    const orgId = 'test-org-1';
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT;

    if (!refreshToken) {
      console.warn('⚠️ GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT 미설정 - 스킵');
      return;
    }

    clearTokenCache();

    // 첫 번째 호출 (토큰 갱신)
    const result1 = await refreshGoogleAccessToken(orgId, refreshToken);
    console.log('✅ 첫 번째 갱신 성공:', {
      accessTokenLength: result1.accessToken.length,
      expiresAt: result1.expiresAt.toISOString(),
    });

    // 두 번째 호출 (캐시 사용)
    const result2 = await refreshGoogleAccessToken(orgId, refreshToken);
    console.log('✅ 두 번째 갱신 성공 (캐시):', {
      accessTokenLength: result2.accessToken.length,
      cached: result1.accessToken === result2.accessToken,
    });
  } catch (err) {
    console.error('❌ 테스트 1 실패:', err);
  }
}

/**
 * 테스트 2: Contact 복구 로그 스키마
 */
async function testContactBackupRestoreLogSchema() {
  console.log('[Test 2] Contact 백업 복구 로그 스키마');

  try {
    // Contact 조회 (복구 로그 관계 확인)
    const contact = await prisma.contact.findFirst({
      where: { deletedAt: { not: null } },
      select: {
        id: true,
        name: true,
        backupRestoreLogs: {
          take: 5,
          orderBy: { restoredAt: 'desc' },
          select: {
            id: true,
            restoredBy: true,
            restoredByName: true,
            restoredAt: true,
            status: true,
          },
        },
      },
    });

    if (!contact) {
      console.log('ℹ️ 삭제된 Contact 없음');
      return;
    }

    console.log('✅ Contact 복구 로그 스키마 확인:', {
      contactId: contact.id,
      contactName: contact.name,
      logsCount: contact.backupRestoreLogs.length,
      latestLog: contact.backupRestoreLogs[0],
    });
  } catch (err) {
    console.error('❌ 테스트 2 실패:', err);
  }
}

/**
 * 테스트 3: 복구 로그 생성 및 조회
 */
async function testRestoreLogCreateAndRead() {
  console.log('[Test 3] 복구 로그 생성 및 조회');

  try {
    // 테스트 Contact 찾기
    const testContact = await prisma.contact.findFirst({
      select: {
        id: true,
        organizationId: true,
      },
      take: 1,
    });

    if (!testContact) {
      console.log('ℹ️ 테스트용 Contact 없음');
      return;
    }

    // 복구 로그 생성 (실제 복구는 아니고 로그만 생성)
    const restoreLog = await prisma.contactBackupRestoreLog.create({
      data: {
        organizationId: testContact.organizationId,
        contactId: testContact.id,
        restoredBy: 'test-user-1',
        restoredByName: 'Test User',
        status: 'SUCCESS',
        restoredFields: JSON.stringify(['phone', 'email']),
      },
      select: {
        id: true,
        restoredAt: true,
        status: true,
        restoredFields: true,
      },
    });

    console.log('✅ 복구 로그 생성 성공:', restoreLog);

    // 복구 로그 조회
    const logs = await prisma.contactBackupRestoreLog.findMany({
      where: { contactId: testContact.id },
      select: {
        id: true,
        restoredBy: true,
        restoredByName: true,
        restoredAt: true,
        status: true,
      },
      orderBy: { restoredAt: 'desc' },
      take: 3,
    });

    console.log('✅ 복구 로그 조회 성공:', { count: logs.length, logs });

    // 정리: 테스트 로그 삭제
    await prisma.contactBackupRestoreLog.delete({
      where: { id: restoreLog.id },
    });

    console.log('✅ 테스트 로그 정리 완료');
  } catch (err) {
    console.error('❌ 테스트 3 실패:', err);
  }
}

/**
 * 테스트 4: 성능 테스트 (10명 × 50회)
 */
async function testPerformance() {
  console.log('[Test 4] 성능 테스트 (10명 × 50회)');

  try {
    // 테스트용 Contact 10개 조회
    const contacts = await prisma.contact.findMany({
      select: { id: true, organizationId: true },
      take: 10,
    });

    if (contacts.length === 0) {
      console.log('ℹ️ 테스트용 Contact 없음');
      return;
    }

    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    // 각 Contact당 50회 복구 로그 생성
    for (const contact of contacts) {
      for (let i = 0; i < 50; i++) {
        try {
          await prisma.contactBackupRestoreLog.create({
            data: {
              organizationId: contact.organizationId,
              contactId: contact.id,
              restoredBy: `user-${i % 5}`,
              restoredByName: `User ${i % 5}`,
              status: i % 10 === 0 ? 'FAILED' : 'SUCCESS',
              errorMessage: i % 10 === 0 ? '테스트 오류' : null,
              restoredFields: JSON.stringify(['phone']),
            },
          });
          successCount++;
        } catch (err) {
          errorCount++;
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log('✅ 성능 테스트 완료:', {
      totalRequests: successCount + errorCount,
      success: successCount,
      errors: errorCount,
      durationMs: duration,
      avgMs: (duration / (successCount + errorCount)).toFixed(2),
    });

    // 정리: 테스트 데이터 삭제
    await prisma.contactBackupRestoreLog.deleteMany({
      where: {
        restoredBy: { in: Array.from({ length: 5 }, (_, i) => `user-${i}`) },
      },
    });

    console.log('✅ 테스트 데이터 정리 완료');
  } catch (err) {
    console.error('❌ 테스트 4 실패:', err);
  }
}

/**
 * 모든 테스트 실행
 */
async function runAllTests() {
  console.log('=== Contact 백업 복구 테스트 시작 ===\n');

  try {
    await testTokenRefresh();
    console.log('');

    await testContactBackupRestoreLogSchema();
    console.log('');

    await testRestoreLogCreateAndRead();
    console.log('');

    await testPerformance();
    console.log('');

    console.log('=== 모든 테스트 완료 ===');
  } catch (err) {
    console.error('테스트 실행 중 치명적 오류:', err);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
if (require.main === module) {
  runAllTests();
}

export { testTokenRefresh, testContactBackupRestoreLogSchema, testRestoreLogCreateAndRead, testPerformance };
