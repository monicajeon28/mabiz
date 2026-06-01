import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Passport Document Service
 * 여권 제출 시 자동으로 필요한 Document들을 생성하고 관리
 */

// Document 타입 정의 (여권에 필요한 4가지 문서)
type DocumentType = 'PASSPORT_APPLICATION' | 'VISA' | 'HEALTH_INSURANCE' | 'OTHER';

const REQUIRED_DOCUMENTS: { type: DocumentType; title: string; description: string }[] = [
  {
    type: 'PASSPORT_APPLICATION',
    title: 'Passport Application',
    description: '여권 신청서'
  },
  {
    type: 'VISA',
    title: 'Visa Documentation',
    description: '비자 서류'
  },
  {
    type: 'HEALTH_INSURANCE',
    title: 'Health Insurance Certificate',
    description: '건강보험증'
  },
  {
    type: 'OTHER',
    title: 'Additional Documents',
    description: '기타 서류'
  }
];

/**
 * Passport 생성 시 자동으로 필요한 Document 4개를 생성
 * prisma.$transaction() 사용: 모든 Document가 성공적으로 생성되거나 모두 롤백
 */
export async function autoCreateDocumentsOnPassportCreated(
  passportId: number,
  organizationId: string
): Promise<any[]> {
  try {
    // 트랜잭션 실행: 모든 Document 생성 또는 모두 롤백
    const createdDocuments = await prisma.$transaction(async (tx) => {
      const documents = [];

      for (const docTemplate of REQUIRED_DOCUMENTS) {
        const document = await tx.document.create({
          data: {
            organizationId,
            passportId,
            title: docTemplate.title,
            description: docTemplate.description,
            category: docTemplate.type,
            status: 'PENDING',
            createdBy: 'system_passport_auto',
            updatedBy: 'system_passport_auto'
          }
        });

        documents.push(document);

        logger.log('[Passport] Document 자동 생성', {
          passportId,
          documentId: document.id,
          type: docTemplate.type,
          title: docTemplate.title
        });
      }

      return documents;
    });

    logger.log('[Passport] Document 4개 생성 완료 (트랜잭션)', {
      passportId,
      organizationId,
      documentCount: createdDocuments.length
    });

    return createdDocuments;
  } catch (err) {
    logger.error('[Passport] Document 자동 생성 실패', {
      passportId,
      organizationId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

/**
 * Passport 상태 변경 시 관련 Document 상태도 동기화
 */
export async function syncDocumentStatusWithPassport(passportId: number): Promise<void> {
  try {
    const passport = await prisma.gmPassportSubmission.findUnique({
      where: { id: passportId },
      select: { isSubmitted: true, submittedAt: true, updatedAt: true }
    });

    if (!passport) {
      logger.warn('[Passport] Passport not found', { passportId });
      return;
    }

    // Passport이 제출되면 모든 Document 상태를 'SUBMITTED'으로 변경
    if (passport.isSubmitted) {
      await prisma.document.updateMany({
        where: { passportId },
        data: {
          status: 'SUBMITTED',
          updatedBy: 'system_passport_sync',
          updatedAt: passport.submittedAt || new Date()
        }
      });

      logger.log('[Passport] Document 상태 동기화', {
        passportId,
        newStatus: 'SUBMITTED'
      });
    }
  } catch (err) {
    logger.error('[Passport] Document 상태 동기화 실패', {
      passportId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

/**
 * Passport 완성도 계산 (몇 개 Document가 완료되었는가?)
 */
export async function getPassportCompletionStatus(
  passportId: number
): Promise<{ completed: number; total: number; percentage: number }> {
  try {
    const documents = await prisma.document.findMany({
      where: { passportId },
      select: { status: true }
    });

    const total = documents.length;
    const completed = documents.filter(d => d.status === 'APPROVED').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  } catch (err) {
    logger.error('[Passport] 완성도 계산 실패', {
      passportId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

/**
 * Passport 승인 전에 모든 Document가 준비되었는지 검증
 */
export async function validateAllDocumentsForApproval(
  passportId: number
): Promise<{ valid: boolean; issues: string[] }> {
  try {
    const documents = await prisma.document.findMany({
      where: { passportId },
      select: { id: true, title: true, status: true, driveFileId: true }
    });

    const issues: string[] = [];

    if (documents.length !== REQUIRED_DOCUMENTS.length) {
      issues.push(
        `Expected ${REQUIRED_DOCUMENTS.length} documents, found ${documents.length}`
      );
    }

    for (const doc of documents) {
      if (!doc.driveFileId) {
        issues.push(`Document "${doc.title}" (${doc.id}) has no file uploaded`);
      }

      if (doc.status !== 'APPROVED') {
        issues.push(
          `Document "${doc.title}" (${doc.id}) status is ${doc.status}, not APPROVED`
        );
      }
    }

    const valid = issues.length === 0;

    logger.log('[Passport] Document 검증', {
      passportId,
      valid,
      issueCount: issues.length,
      issues
    });

    return { valid, issues };
  } catch (err) {
    logger.error('[Passport] Document 검증 실패', {
      passportId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}
