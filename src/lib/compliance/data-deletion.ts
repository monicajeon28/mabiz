/**
 * 🔐 GDPR Right to be Forgotten - 데이터 삭제 워크플로우
 *
 * 삭제 요청 → 30일 유예기간 → 영구 삭제
 * 유예기간 중 복구 가능
 *
 * 2026-05-27 Compliance Monitor Agent
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { auditLogger } from './audit-logger';

export type DeletionStatus = 'PENDING_DELETION' | 'SCHEDULED_FOR_DELETE' | 'HARD_DELETED' | 'RESTORED';

export interface DataDeletionRequest {
  contactId: string;
  organizationId: string;
  requestedBy: string;
  requestedAt: Date;
  reason: string;
  scheduledDeleteAt: Date;
  status: DeletionStatus;
  gracePeriodDays?: number;
}

/**
 * 🔐 데이터 삭제 관리자
 */
export class DataDeletionManager {
  private readonly GRACE_PERIOD_DAYS = 30;

  /**
   * 📋 삭제 요청 생성 (GDPR 우측 to be forgotten)
   */
  async scheduleContactDeletion(payload: {
    contactId: string;
    organizationId: string;
    requestedBy: string;
    reason: string;
    gracePeriodDays?: number;
  }): Promise<DataDeletionRequest> {
    try {
      const gracePeriodDays = payload.gracePeriodDays || this.GRACE_PERIOD_DAYS;
      const now = new Date();
      const scheduledDeleteAt = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

      // 1. 삭제 요청 기록
      const deletionRequest = await prisma.dataDeletionRequest.create({
        data: {
          contactId: payload.contactId,
          organizationId: payload.organizationId,
          requestedBy: payload.requestedBy,
          reason: payload.reason,
          requestedAt: now,
          scheduledDeleteAt,
          status: 'PENDING_DELETION',
          gracePeriodDays,
        },
      });

      // 2. Contact를 PENDING_DELETION으로 표시
      await prisma.contact.update({
        where: { id: payload.contactId },
        data: {
          status: 'PENDING_DELETION',
          updatedAt: now,
        },
      });

      // 3. 감시 로그 기록
      await auditLogger.record({
        organizationId: payload.organizationId,
        userId: payload.requestedBy,
        action: 'DELETE',
        resourceType: 'Contact',
        resourceId: payload.contactId,
        status: 'SUCCESS',
        purpose: 'Compliance',
        reasonDescription: `GDPR 삭제 요청: ${payload.reason}`,
      });

      // 4. 발송 예약 취소
      await this.cancelScheduledCommunications(payload.contactId);

      logger.info('✅ Contact Deletion Scheduled', {
        contactId: payload.contactId,
        scheduledDeleteAt,
        gracePeriodDays,
      });

      return deletionRequest;
    } catch (error) {
      logger.error('❌ Schedule Deletion Failed', { error, payload });
      throw error;
    }
  }

  /**
   * ⏸️ 삭제 요청 취소 (유예기간 중)
   */
  async cancelDeletionRequest(
    contactId: string,
    cancelledBy: string,
    reason: string,
  ): Promise<void> {
    try {
      const request = await prisma.dataDeletionRequest.findFirst({
        where: {
          contactId,
          status: 'PENDING_DELETION',
        },
      });

      if (!request) {
        throw new Error('Deletion request not found or already processed');
      }

      // 1. 삭제 요청 취소
      await prisma.dataDeletionRequest.update({
        where: { id: request.id },
        data: {
          status: 'RESTORED',
        },
      });

      // 2. Contact 상태 복구
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      // 3. 감시 로그 기록
      await auditLogger.record({
        organizationId: request.organizationId,
        userId: cancelledBy,
        action: 'UPDATE',
        resourceType: 'Contact',
        resourceId: contactId,
        status: 'SUCCESS',
        purpose: 'Compliance',
        reasonDescription: `삭제 요청 취소: ${reason}`,
      });

      logger.info('✅ Deletion Request Cancelled', {
        contactId,
        cancelledBy,
      });
    } catch (error) {
      logger.error('❌ Cancel Deletion Failed', { error, contactId });
      throw error;
    }
  }

  /**
   * 🗑️ 영구 삭제 (30일 유예기간 후)
   */
  async hardDeleteContact(contactId: string): Promise<void> {
    try {
      const request = await prisma.dataDeletionRequest.findFirst({
        where: {
          contactId,
          status: 'PENDING_DELETION',
        },
      });

      if (!request) {
        throw new Error('No pending deletion request found');
      }

      const now = new Date();
      if (now < request.scheduledDeleteAt) {
        throw new Error(
          `Deletion not yet scheduled. Grace period ends at ${request.scheduledDeleteAt.toISOString()}`
        );
      }

      // 1. 모든 관련 데이터 삭제
      await Promise.all([
        // SMS 로그 삭제
        prisma.smsLog.deleteMany({ where: { contactId } }),

        // 콜 로그 삭제
        prisma.callLog.deleteMany({ where: { contactId } }),

        // Contact 메모 삭제
        prisma.contactMemo.deleteMany({ where: { contactId } }),

        // Contact 렌즈 분류 삭제
        prisma.contactLensClassification.deleteMany({ where: { contactId } }),

        // Contact 렌즈 시퀀스 삭제
        prisma.contactLensSequence.deleteMany({ where: { contactId } }),

        // 그룹 멤버십 삭제
        prisma.contactGroupMember.deleteMany({ where: { contactId } }),
      ]);

      // 2. Contact 삭제
      await prisma.contact.delete({
        where: { id: contactId },
      });

      // 3. 삭제 요청 상태 업데이트
      await prisma.dataDeletionRequest.update({
        where: { id: request.id },
        data: {
          status: 'HARD_DELETED',
        },
      });

      // 4. 감시 로그 기록 (Contact ID는 이미 삭제되었으므로 요청 정보에서 기록)
      logger.warn('🗑️ Contact Hard Deleted', {
        contactId,
        organizationId: request.organizationId,
        requestedAt: request.requestedAt,
        deletedAt: now,
      });
    } catch (error) {
      logger.error('❌ Hard Delete Failed', { error, contactId });
      throw error;
    }
  }

  /**
   * 📊 삭제 대기 중인 Contact 목록
   */
  async getPendingDeletions(organizationId: string): Promise<DataDeletionRequest[]> {
    try {
      return await prisma.dataDeletionRequest.findMany({
        where: {
          organizationId,
          status: 'PENDING_DELETION',
        },
        orderBy: { scheduledDeleteAt: 'asc' },
      });
    } catch (error) {
      logger.error('❌ Get Pending Deletions Failed', { error });
      throw error;
    }
  }

  /**
   * 📊 삭제 유예기간이 만료된 항목 자동 삭제
   * Cron job에서 매일 호출
   */
  async processExpiredDeletionRequests(): Promise<number> {
    try {
      const now = new Date();

      const expiredRequests = await prisma.dataDeletionRequest.findMany({
        where: {
          status: 'PENDING_DELETION',
          scheduledDeleteAt: { lte: now },
        },
      });

      let deletedCount = 0;

      for (const request of expiredRequests) {
        try {
          await this.hardDeleteContact(request.contactId);
          deletedCount++;
        } catch (error) {
          logger.error('❌ Failed to hard delete contact in batch', {
            error,
            contactId: request.contactId,
          });
        }
      }

      logger.info('✅ Expired Deletion Requests Processed', {
        processedCount: deletedCount,
        totalExpired: expiredRequests.length,
      });

      return deletedCount;
    } catch (error) {
      logger.error('❌ Process Expired Deletions Failed', { error });
      return 0;
    }
  }

  /**
   * 📤 사용자 데이터 다운로드 (GDPR Data Access Right)
   */
  async exportUserData(contactId: string): Promise<object> {
    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        throw new Error('Contact not found');
      }

      // Get all related data
      const [smsLogs, callLogs, memos, lensClassifications, groupMembers] = await Promise.all([
        prisma.smsLog.findMany({
          where: { contactId },
          select: { id: true, msg: true, sentAt: true, status: true },
        }),
        prisma.callLog.findMany({
          where: { contactId },
          select: { id: true, result: true, duration: true, createdAt: true, content: true },
        }),
        prisma.contactMemo.findMany({
          where: { contactId },
          select: { id: true, content: true, createdAt: true },
        }),
        prisma.contactLensClassification.findMany({
          where: { contactId },
          select: { id: true, lensType: true, confidenceScore: true, identifiedAt: true },
        }),
        prisma.contactGroupMember.findMany({
          where: { contactId },
          include: { group: true },
        }),
      ]);

      // Contact 데이터 구조화
      const exportData = {
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
          type: contact.type,
        },
        communications: {
          smsLogs: smsLogs.map(log => ({
            id: log.id,
            message: log.msg,
            sentAt: log.sentAt,
            status: log.status,
          })),
          callLogs: callLogs.map(log => ({
            id: log.id,
            result: log.result,
            duration: log.duration,
            date: log.createdAt,
            content: log.content,
          })),
        },
        metadata: {
          memos: memos.map(m => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt,
          })),
          lensClassifications: lensClassifications.map(l => ({
            lensType: l.lensType,
            confidenceScore: l.confidenceScore,
            identifiedAt: l.identifiedAt,
          })),
          groups: groupMembers.map(gm => ({
            groupId: gm.group.id,
            groupName: gm.group.name,
            joinedAt: gm.addedAt,
          })),
        },
        exportedAt: new Date().toISOString(),
      };

      // 감시 로그 기록
      await auditLogger.record({
        userId: contactId,
        action: 'EXPORT',
        resourceType: 'Contact',
        resourceId: contactId,
        status: 'SUCCESS',
        purpose: 'Compliance',
        reasonDescription: 'GDPR 데이터 접근 요청',
      });

      return exportData;
    } catch (error) {
      logger.error('❌ Export User Data Failed', { error, contactId });
      throw error;
    }
  }

  /**
   * ⏸️ 예약된 SMS/이메일 캐ン슬
   */
  private async cancelScheduledCommunications(contactId: string): Promise<void> {
    try {
      // SMS 취소
      await prisma.scheduledSms.updateMany({
        where: { contactId },
        data: { cancelled: true },
      });

      logger.info('✅ Scheduled Communications Cancelled', { contactId });
    } catch (error) {
      logger.error('❌ Cancel Communications Failed', { error, contactId });
    }
  }
}

// Singleton instance
export const dataDeletionManager = new DataDeletionManager();
