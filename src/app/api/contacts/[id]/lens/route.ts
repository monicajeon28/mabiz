/**
 * Menu #38 Phase 4 Step 5-2: 렌즈 분류 조회 API
 * GET /api/contacts/[id]/lens
 * 특정 고객의 렌즈 분류 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ContactLensClassification } from '@prisma/client';
import { getAuthContext } from '@/lib/rbac';
import { Prisma } from '@prisma/client';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ContactLensClassification | null>>> {
  try {
    const { id } = await params;

    // 0. ID 검증 (UUID/CUID 형식 확인)
    if (!id || id.trim() === '' || !/^[a-z0-9\-]+$/i.test(id)) {
      return NextResponse.json(
        { success: false, error: 'Bad Request: Invalid contact lens ID format' },
        { status: 400 }
      );
    }

    // 1. 인증: getAuthContext()를 통해 권한 검증
    let ctx;
    try {
      ctx = await getAuthContext();
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid session' },
        { status: 401 }
      );
    }

    // 2. organizationId 확인
    if (!ctx.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Organization required' },
        { status: 403 }
      );
    }

    const organizationId = ctx.organizationId;

    // 3. ContactLensClassification 조회 (organizationId 필터 포함 - IDOR 방지)
    const lensClassification = await prisma.contactLensClassification.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        contactId: true,
        organizationId: true,
        lensType: true,
        lensLabel: true,
        confidenceScore: true,
        identificationMethod: true,
        decisionLevel: true,
        readinessScore: true,
        priorityLevel: true,
        status: true,
        identifiedAt: true,
        lastUpdated: true,
        convertedAt: true,
        notes: true,
        tags: true,
      },
    });

    // 4. 404: 렌즈 분류 없음
    if (!lensClassification) {
      return NextResponse.json(
        { success: false, error: 'Lens classification not found' },
        { status: 404 }
      );
    }

    // 5. 응답 반환 (200)
    return NextResponse.json(
      {
        success: true,
        data: lensClassification,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/contacts/[id]/lens]', error);

    // P1: 에러 종류별 구분 처리
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // 레코드 없음
        return NextResponse.json(
          { success: false, error: 'Lens classification not found' },
          { status: 404 }
        );
      }
      // 그 외 DB 에러 (제약조건 위반 등)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 400 }
      );
    }

    // 기타 에러 (프로그래밍 에러, 네트워크 등)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
