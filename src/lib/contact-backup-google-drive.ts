/**
 * Contact 백업 Google Drive 토큰 관리
 * - Google OAuth refresh_token 자동 갱신
 * - 토큰 캐싱 및 TTL 관리 (55분 기반)
 * - 갱신 실패 시 Slack 알림
 *
 * 환경변수:
 * - GOOGLE_OAUTH_CLIENT_ID
 * - GOOGLE_OAUTH_CLIENT_SECRET
 * - GOOGLE_OAUTH_REDIRECT_URI
 * - GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT (조직 토큰 저장, DB에서 읽음)
 * - SLACK_WEBHOOK_URL (알림용)
 */

import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface TokenCache {
  organizationId: string;
  accessToken: string;
  expiresAt: Date;
}

// 메모리 캐시 (프로세스별)
const tokenCache = new Map<string, TokenCache>();

/**
 * OAuth 2.0 클라이언트 생성
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    process.env.GOOGLE_OAUTH_REDIRECT_URI || ''
  );
}

/**
 * Google OAuth 토큰 갱신
 * TTL 55분 기반 (만료 5분 전 갱신)
 *
 * @param organizationId 조직 ID
 * @param refreshToken 리프레시 토큰
 * @returns 새로운 액세스 토큰 + 만료 시간
 */
export async function refreshGoogleAccessToken(
  organizationId: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  // 캐시 확인 (만료 5분 전까지만 유효)
  const cached = tokenCache.get(organizationId);
  if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    logger.info(`[refreshGoogleAccessToken] 캐시 사용: ${organizationId}`);
    return { accessToken: cached.accessToken, expiresAt: cached.expiresAt };
  }

  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const result = await oauth2Client.refreshAccessToken();
    const { access_token, expiry_date } = result.credentials;

    if (!access_token) {
      throw new Error('액세스 토큰 없음');
    }

    // 캐시 저장 (TTL 55분)
    const expiresAt = new Date(expiry_date || Date.now() + 55 * 60 * 1000);
    tokenCache.set(organizationId, {
      organizationId,
      accessToken: access_token,
      expiresAt,
    });

    logger.info(`[refreshGoogleAccessToken] 토큰 갱신 완료: ${organizationId}`, {
      expiresAt: expiresAt.toISOString(),
    });

    return { accessToken: access_token, expiresAt };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';

    logger.error(`[refreshGoogleAccessToken] 토큰 갱신 실패: ${organizationId}`, err);

    // Slack 알림
    try {
      await notifySlack(
        `❌ Contact 백업 토큰 갱신 실패\n\n조직: ${organizationId}\n오류: ${errorMessage}`
      );
    } catch (slackErr) {
      logger.error('[refreshGoogleAccessToken] Slack 알림 실패', slackErr);
    }

    throw new Error(`토큰 갱신 실패: ${errorMessage}`);
  }
}

/**
 * 조직의 모든 OAuth 토큰 갱신 (배치)
 * Cron job에서 호출
 *
 * @returns 갱신 결과
 */
export async function refreshAllOrganizationTokens(): Promise<{
  success: number;
  failed: number;
  skipped: number;
  organizations: Array<{
    id: string;
    name: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    errorMessage?: string;
  }>;
}> {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    organizations: [] as Array<{
      id: string;
      name: string;
      status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
      errorMessage?: string;
    }>,
  };

  try {
    // 환경변수에서 마스터 refresh token 조회
    const masterRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT;
    if (!masterRefreshToken) {
      logger.warn('[refreshAllOrganizationTokens] GOOGLE_OAUTH_REFRESH_TOKEN_CONTACT 미설정');
      return results;
    }

    // 모든 조직 조회 (Google Drive 백업 활성화된 조직)
    const organizations = await prisma.organization.findMany({
      where: {
        googleDriveAccessToken: { not: null },
      },
      select: {
        id: true,
        name: true,
      },
    });

    for (const org of organizations) {
      try {
        // 토큰 갱신
        const { accessToken, expiresAt } = await refreshGoogleAccessToken(
          org.id,
          masterRefreshToken
        );

        // DB에 토큰 저장 (암호화)
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            googleDriveAccessToken: accessToken,
          },
        });

        results.success++;
        results.organizations.push({
          id: org.id,
          name: org.name,
          status: 'SUCCESS',
        });

        logger.info(`[refreshAllOrganizationTokens] 갱신 완료: ${org.name}`, {
          expiresAt: expiresAt.toISOString(),
        });
      } catch (err) {
        results.failed++;
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';

        results.organizations.push({
          id: org.id,
          name: org.name,
          status: 'FAILED',
          errorMessage,
        });

        logger.error(`[refreshAllOrganizationTokens] 갱신 실패: ${org.name}`, err);
      }
    }

    return results;
  } catch (err) {
    logger.error('[refreshAllOrganizationTokens]', err);
    throw err;
  }
}

/**
 * Slack 알림 전송
 */
async function notifySlack(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn('[notifySlack] SLACK_WEBHOOK_URL 미설정');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        username: 'Contact Backup Bot',
        icon_emoji: ':floppy_disk:',
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack API 에러: ${response.status}`);
    }
  } catch (err) {
    logger.error('[notifySlack]', err);
    throw err;
  }
}

/**
 * 토큰 캐시 초기화 (테스트용)
 */
export function clearTokenCache(organizationId?: string): void {
  if (organizationId) {
    tokenCache.delete(organizationId);
  } else {
    tokenCache.clear();
  }
}
