/**
 * GET /api/statements/documents/[profileId]
 * 특정 파트너의 문서 상태 조회
 *
 * 경로 파라미터:
 * - profileId: GmAffiliateProfile.id (Int)
 *
 * 인증 필요 (모든 역할 접근 가능, 단 자신의 프로필만 조회 가능)
 * GLOBAL_ADMIN / OWNER는 모든 프로필 조회 가능
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

interface DocumentData {
  profileId: number;
  userId: number | null;
  hasIdCard: boolean;
  idCardName: string | null;
  hasBankBook: boolean;
  bankBookName: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  withholdingRate: number;
  contractStatus: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { profileId: string } }
): Promise<NextResponse> {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { role } = session;

    const { profileId: profileIdParam } = params;
    const profileId = parseInt(profileIdParam, 10);
    if (isNaN(profileId)) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: '유효하지 않은 profileId입니다.' },
        { status: 400 }
      );
    }

    // GmAffiliateProfile 조회
    type ProfileRow = {
      id: number;
      userId: number | null;
      withholdingRate: number;
      bankName: string | null;
      bankAccount: string | null;
      bankAccountHolder: string | null;
      contractStatus: string | null;
    };

    const profileRows = await prisma.$queryRaw<ProfileRow[]>(
      Prisma.sql`
        SELECT
          id,
          "userId",
          "withholdingRate",
          "bankName",
          "bankAccount",
          "bankAccountHolder",
          "contractStatus"
        FROM "AffiliateProfile"
        WHERE id = ${profileId}
        LIMIT 1
      `
    );

    if (profileRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const profile = profileRows[0];

    // 자신의 프로필인지 확인 (GLOBAL_ADMIN / OWNER는 모두 조회 가능)
    if (role !== 'GLOBAL_ADMIN' && role !== 'OWNER') {
      const mallUserId = session.mallUser?.id;
      const mallAffiliateProfileId = session.mallUser?.affiliateProfileId;

      // 세션의 affiliateProfileId 또는 userId와 비교
      const isOwner =
        mallAffiliateProfileId === profileId ||
        (profile.userId !== null && mallUserId === profile.userId);

      if (!isOwner) {
        return NextResponse.json(
          { ok: false, error: 'FORBIDDEN', message: '본인의 프로필만 조회할 수 있습니다.' },
          { status: 403 }
        );
      }
    }

    // GmAffiliateContract 조회 (userId 기반)
    type ContractRow = {
      idCardPath: string | null;
      idCardOriginalName: string | null;
      bankbookPath: string | null;
      bankbookOriginalName: string | null;
      bankName: string | null;
      bankAccount: string | null;
      bankAccountHolder: string | null;
    };

    let contract: ContractRow | null = null;

    if (profile.userId !== null) {
      const contractRows = await prisma.$queryRaw<ContractRow[]>(
        Prisma.sql`
          SELECT
            "idCardPath",
            "idCardOriginalName",
            "bankbookPath",
            "bankbookOriginalName",
            "bankName",
            "bankAccount",
            "bankAccountHolder"
          FROM "AffiliateContract"
          WHERE "userId" = ${profile.userId}
          ORDER BY "createdAt" DESC
          LIMIT 1
        `
      );
      contract = contractRows[0] ?? null;
    }

    const documentData: DocumentData = {
      profileId: profile.id,
      userId: profile.userId,
      hasIdCard: !!contract?.idCardPath,
      idCardName: contract?.idCardOriginalName ?? null,
      hasBankBook: !!contract?.bankbookPath,
      bankBookName: contract?.bankbookOriginalName ?? null,
      bankName: contract?.bankName ?? profile.bankName,
      bankAccount: contract?.bankAccount ?? profile.bankAccount,
      bankAccountHolder: contract?.bankAccountHolder ?? profile.bankAccountHolder,
      withholdingRate: profile.withholdingRate ?? 3.3,
      contractStatus: profile.contractStatus,
    };

    return NextResponse.json({
      ok: true,
      data: documentData,
    });

  } catch (err) {
    logger.error('[GET /api/statements/documents/[profileId]]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
