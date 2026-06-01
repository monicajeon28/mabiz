export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { autoCreateDocumentsOnPassportCreated } from '@/lib/passport-document-service';

// ── Zod 스키마 ──────────────────────────────────────────────

const AutoGenerateSchema = z.object({
  passportSubmissionId: z.number().int().positive('Valid Passport Submission ID required'),
});

// ── 타입 ────────────────────────────────────────────────────

interface AutoGenerateRequestBody {
  passportSubmissionId: number;
}

interface AutoGenerateResult {
  success: boolean;
  passportSubmissionId: number;
  documentIds: string[];
  status: string;
  message: string;
}

// ── POST /api/passport/documents/auto-generate ────────────────

/**
 * Passport 문서 자동 생성 API
 * - 기존 PassportSubmission에 대해 4개의 Document를 자동으로 생성
 * - 멱등성: 이미 문서가 존재하면 409 Conflict 반환
 * - 권한: Manager(GLOBAL_ADMIN, OWNER) 전용
 * - 트랜잭션: 모든 문서가 생성되거나 모두 롤백
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 인증 검증
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        { ok: false, message: 'Authentication required. Please log in again.' },
        { status: 403 },
      );
    }

    // organizationId 필수 (CRM 인증 필수)
    if (!manager.organizationId) {
      return NextResponse.json(
        { ok: false, message: 'Organization context missing.' },
        { status: 403 },
      );
    }

    // 2. JSON 파싱
    let rawBody;
    try {
      rawBody = await req.json();
    } catch (error) {
      logger.error('[PassportDocuments] JSON parsing error:', error as Record<string, unknown>);
      return NextResponse.json(
        { ok: false, message: 'Invalid request format.' },
        { status: 400 },
      );
    }

    // 3. Zod 스키마 검증
    const validation = AutoGenerateSchema.safeParse(rawBody);
    if (!validation.success) {
      logger.warn('[PassportDocuments] Validation error:', validation.error.issues);
      return NextResponse.json(
        {
          ok: false,
          message: 'Invalid input data.',
          errors: validation.error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    const body: AutoGenerateRequestBody = validation.data;

    // 4. Passport 존재 여부 확인
    const passport = await prisma.gmPassportSubmission.findUnique({
      where: { id: body.passportSubmissionId },
      select: {
        id: true,
        userId: true,
        token: true,
        isSubmitted: true,
        submittedAt: true,
      },
    });

    if (!passport) {
      return NextResponse.json(
        { ok: false, message: 'Passport submission not found.' },
        { status: 404 },
      );
    }

    // 5. 이미 존재하는 문서 확인 (멱등성 체크)
    const existingDocs = await prisma.document.findMany({
      where: { passportId: body.passportSubmissionId },
      select: { id: true },
    });

    if (existingDocs.length > 0) {
      logger.warn('[PassportDocuments] Documents already exist for this passport', {
        passportSubmissionId: body.passportSubmissionId,
        existingCount: existingDocs.length,
      });
      return NextResponse.json(
        {
          ok: false,
          message: 'Documents already exist for this passport submission.',
          passportSubmissionId: body.passportSubmissionId,
          existingDocumentIds: existingDocs.map(d => d.id),
        },
        { status: 409 }, // Conflict
      );
    }

    // 6. 문서 자동 생성 (트랜잭션)
    const createdDocuments = await autoCreateDocumentsOnPassportCreated(
      body.passportSubmissionId,
      manager.organizationId,
    );

    const result: AutoGenerateResult = {
      success: true,
      passportSubmissionId: body.passportSubmissionId,
      documentIds: createdDocuments.map(doc => doc.id),
      status: 'PENDING',
      message: `${createdDocuments.length} documents auto-generated successfully.`,
    };

    logger.log('[PassportDocuments] Auto-generation completed', {
      passportSubmissionId: body.passportSubmissionId,
      organizationId: manager.organizationId,
      documentCount: createdDocuments.length,
      documentIds: createdDocuments.map(doc => doc.id),
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    logger.error('[PassportDocuments] POST error:', error as Record<string, unknown>);
    logger.error('[PassportDocuments] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { ok: false, message: 'Failed to auto-generate documents.' },
      { status: 500 },
    );
  }
}
