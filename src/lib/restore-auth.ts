/**
 * M3-3: 권한 검증 체인
 *
 * Restore 작업에서 필수 권한 검증:
 * 1. Contact 존재 & 조직 일치
 * 2. Trip 폴더 권한 (GmTripGoogleDriveConfig)
 * 3. RBAC 검증 (OWNER/AGENT)
 *
 * Triple-check (3단계):
 * ✅ Step 1: Contact → Organization 검증
 * ✅ Step 2: Organization → Trip → Google Drive Config 검증
 * ✅ Step 3: RBAC 권한 검증 (OWNER/AGENT)
 *
 * 에러 코드:
 * - CONTACT_NOT_FOUND: Contact 없음
 * - ORG_MISMATCH: 조직 불일치 (IDOR 방지)
 * - TRIP_NOT_FOUND: Trip 없음
 * - GDRIVE_CONFIG_MISSING: Google Drive 설정 없음
 * - GDRIVE_FOLDER_MISSING: Google Drive 폴더 ID 없음
 * - RBAC_INSUFFICIENT: 권한 부족 (OWNER/AGENT 아님)
 * - RESTORED_BY_DELETED: 복구자가 조직 내 존재하지 않음
 */

import 'server-only';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AuthContext } from '@/lib/rbac';

/**
 * Restore 권한 검증 체인
 *
 * 3단계 Triple-check:
 * 1. Contact → Organization 일치성 확인
 * 2. Organization → Trip → Google Drive Config 계층 검증
 * 3. RBAC 권한 (OWNER/AGENT) 최종 검증
 *
 * @param contactId Contact ID
 * @param tripId Trip ID (선택사항, 있으면 검증)
 * @param ctx 인증 컨텍스트
 * @returns 검증 결과 { valid, contactOrgId, tripId, gdriveFolderId }
 * @throws 검증 실패 시 상세 에러 메시지
 */
export async function validateRestoreAuth(
  contactId: string,
  ctx: AuthContext,
  options: { tripId?: number } = {}
): Promise<{
  valid: true;
  contactOrgId: string;
  tripId?: number;
  gdriveFolderId?: string;
  restoredByMember?: {
    id: string;
    displayName: string | null;
  };
}> {
  try {
    // ========================================
    // Step 1: Contact 존재 & 조직 일치 검증
    // ========================================
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        userId: true,
      },
    });

    if (!contact) {
      logger.warn('[validateRestoreAuth] Contact 없음', { contactId });
      throw new Error('CONTACT_NOT_FOUND');
    }

    // 조직 일치 검증 (IDOR 방지)
    if (contact.organizationId !== ctx.organizationId) {
      logger.warn('[validateRestoreAuth] 조직 불일치 (IDOR)', {
        contactId,
        contactOrgId: contact.organizationId,
        ctxOrgId: ctx.organizationId,
      });
      throw new Error('ORG_MISMATCH');
    }

    // ========================================
    // Step 2: Trip → Google Drive Config 검증
    // ========================================
    let gdriveFolderId: string | undefined;

    if (options.tripId) {
      // Trip 존재 확인
      const trip = await prisma.gmTrip.findUnique({
        where: { id: options.tripId },
        select: {
          id: true,
          userId: true,
          googleDriveConfig: {
            select: {
              googleFolderId: true,
              deletedAt: true,
            },
          },
        },
      });

      if (!trip) {
        logger.warn('[validateRestoreAuth] Trip 없음', {
          tripId: options.tripId,
          contactId,
        });
        throw new Error('TRIP_NOT_FOUND');
      }

      // Google Drive Config 존재 확인
      if (!trip.googleDriveConfig) {
        logger.warn('[validateRestoreAuth] Google Drive Config 없음', {
          tripId: options.tripId,
          contactId,
        });
        throw new Error('GDRIVE_CONFIG_MISSING');
      }

      // Soft-deleted 검증
      if (trip.googleDriveConfig.deletedAt) {
        logger.warn('[validateRestoreAuth] Google Drive Config 삭제됨', {
          tripId: options.tripId,
          contactId,
          deletedAt: trip.googleDriveConfig.deletedAt,
        });
        throw new Error('GDRIVE_CONFIG_DELETED');
      }

      // Google Drive 폴더 ID 검증
      if (!trip.googleDriveConfig.googleFolderId) {
        logger.warn('[validateRestoreAuth] Google Drive 폴더 ID 없음', {
          tripId: options.tripId,
          contactId,
        });
        throw new Error('GDRIVE_FOLDER_MISSING');
      }

      gdriveFolderId = trip.googleDriveConfig.googleFolderId;
    }

    // ========================================
    // Step 3: RBAC 권한 검증 (최종)
    // ========================================
    // OWNER: 자기 조직 전체 + 소속 AGENT DB 접근
    // AGENT: 자기에게 배당된 고객만 접근 (할당자 확인)
    // GLOBAL_ADMIN: 모든 권한 (Contact 소유 조직 불일치 허용 안 함)

    if (ctx.role === 'GLOBAL_ADMIN') {
      // GLOBAL_ADMIN은 모든 Contact 접근 가능
    } else if (ctx.role === 'OWNER') {
      // OWNER는 자기 조직 내 모든 Contact 접근 가능
      // (위에서 이미 organizationId 일치 확인했으므로 OK)
    } else if (ctx.role === 'AGENT') {
      // AGENT는 할당받은 고객만 접근 가능
      // Contact.assignedUserId 또는 Contact.createdBy 확인 필요
      const assignedContact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          assignedUserId: true,
          createdBy: true,
        },
      });

      if (!assignedContact) {
        logger.warn('[validateRestoreAuth] Contact 재조회 실패', { contactId });
        throw new Error('CONTACT_NOT_FOUND');
      }

      const isAssigned =
        assignedContact.assignedUserId === ctx.userId ||
        assignedContact.createdBy === ctx.userId;

      if (!isAssigned) {
        logger.warn('[validateRestoreAuth] AGENT 할당 고객 아님', {
          contactId,
          userId: ctx.userId,
          assignedUserId: assignedContact.assignedUserId,
          createdBy: assignedContact.createdBy,
        });
        throw new Error('RBAC_INSUFFICIENT');
      }
    } else {
      // FREE_SALES는 Restore 권한 없음
      logger.warn('[validateRestoreAuth] 역할 권한 부족', {
        role: ctx.role,
        contactId,
      });
      throw new Error('RBAC_INSUFFICIENT');
    }

    // ========================================
    // 복구자 정보 검증 (선택사항)
    // ========================================
    let restoredByMember: { id: string; displayName: string | null } | undefined;

    if (ctx.member) {
      // 복구자가 조직 내 존재하는지 확인
      const member = await prisma.organizationMember.findUnique({
        where: {
          id: ctx.member.id,
        },
        select: {
          id: true,
          displayName: true,
        },
      });

      if (!member) {
        logger.warn('[validateRestoreAuth] 복구자 조직 멤버 아님', {
          memberId: ctx.member.id,
          organizationId: ctx.organizationId,
        });
        throw new Error('RESTORED_BY_DELETED');
      }

      restoredByMember = member;
    }

    logger.info('[validateRestoreAuth] 검증 완료 (3단계 통과)', {
      contactId,
      organizationId: contact.organizationId,
      tripId: options.tripId,
      gdriveFolderId,
      role: ctx.role,
    });

    return {
      valid: true,
      contactOrgId: contact.organizationId,
      tripId: options.tripId,
      gdriveFolderId,
      restoredByMember,
    };
  } catch (err) {
    const errorCode = err instanceof Error ? err.message : 'UNKNOWN_ERROR';

    logger.error('[validateRestoreAuth] 검증 실패', {
      contactId,
      tripId: options.tripId,
      errorCode,
      error: err instanceof Error ? err.message : err,
    });

    throw err;
  }
}

/**
 * Restore 권한 검증 에러 분석
 *
 * 에러 코드별 HTTP 상태 코드 매핑
 */
export function mapRestoreAuthErrorToStatus(errorCode: string): number {
  const statusMap: Record<string, number> = {
    CONTACT_NOT_FOUND: 404,
    ORG_MISMATCH: 403, // IDOR
    TRIP_NOT_FOUND: 404,
    GDRIVE_CONFIG_MISSING: 400, // Configuration not set
    GDRIVE_CONFIG_DELETED: 410, // Gone
    GDRIVE_FOLDER_MISSING: 400,
    RBAC_INSUFFICIENT: 403,
    RESTORED_BY_DELETED: 403, // Member no longer exists
  };

  return statusMap[errorCode] ?? 500;
}

/**
 * Restore 권한 검증 에러 메시지
 */
export function getRestoreAuthErrorMessage(errorCode: string): string {
  const messageMap: Record<string, string> = {
    CONTACT_NOT_FOUND: '고객을 찾을 수 없습니다',
    ORG_MISMATCH: '권한이 없습니다 (조직 불일치)',
    TRIP_NOT_FOUND: '여행을 찾을 수 없습니다',
    GDRIVE_CONFIG_MISSING: 'Google Drive 설정이 없습니다',
    GDRIVE_CONFIG_DELETED: 'Google Drive 설정이 삭제되었습니다',
    GDRIVE_FOLDER_MISSING: 'Google Drive 폴더를 찾을 수 없습니다',
    RBAC_INSUFFICIENT: '권한이 없습니다 (역할 부족)',
    RESTORED_BY_DELETED: '권한이 없습니다 (멤버 삭제됨)',
  };

  return messageMap[errorCode] ?? '검증 실패';
}
