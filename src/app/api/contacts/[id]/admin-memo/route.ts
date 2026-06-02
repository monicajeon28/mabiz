/**
 * GET /api/contacts/[id]/admin-memo
 * Contact의 암호화된 adminMemo 조회 및 복호화
 *
 * - Admin/Owner/Manager 역할만 접근 가능
 * - 암호화된 데이터를 복호화하여 반환
 * - 권한 없으면 403 Forbidden 반환
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { decryptLandingNotes, canDecryptSensitiveData } from '@/lib/sensitive-data-encryption';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    // 1. 세션 및 권한 검증
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 역할 기반 접근 제어 (Admin/Owner/Manager만 가능)
    const userRole = session.role || 'AGENT';
    if (!canDecryptSensitiveData(userRole)) {
      return NextResponse.json(
        {
          error: '민감 정보 접근 권한이 없습니다',
          requiredRole: 'ADMIN, OWNER, MANAGER'
        },
        { status: 403 }
      );
    }

    // 3. Contact 조회
    const { id } = await params;
    const contact = await prisma.contact.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        adminMemo: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 4. adminMemo 복호화
    let decryptedMemo: Record<string, any> = {};
    if (contact.adminMemo) {
      decryptedMemo = decryptLandingNotes(contact.adminMemo);
    }

    // 5. 성공 응답
    return NextResponse.json({
      success: true,
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      },
      adminMemo: decryptedMemo,
      encrypted: !!contact.adminMemo
    });

  } catch (error) {
    console.error('[admin-memo-decrypt-error]', error);

    return NextResponse.json(
      {
        error: '민감 정보 조회 중 오류가 발생했습니다',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
