export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateContractStatus } from '@/lib/affiliate/contract';
import { profileInclude } from '@/app/api/admin/affiliate/profiles/shared';
import { generateAffiliateCode } from '@/lib/affiliate/code-generator';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

/**
 * 파트너 아이디 생성 (숫자만 증가)
 * - 대리점장: boss1, boss2, boss3...
 * - 판매원: user1, user2, user3...
 * - 정액제: gest1, gest2, gest3...
 * phone 필드에 저장됨
 */
async function generatePartnerId(type: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'SUBSCRIPTION_AGENT', name: string): Promise<string> {
  let prefix: string;
  if (type === 'BRANCH_MANAGER') {
    prefix = 'boss';
  } else if (type === 'SUBSCRIPTION_AGENT') {
    prefix = 'gest';
  } else {
    prefix = 'user';
  }

  // phone 필드에서 해당 prefix 형식 찾기 (이름 포함/미포함 모두)
  const existing = await prisma.user.findMany({
    where: {
      phone: {
        startsWith: prefix,
      },
    },
    select: { phone: true },
  });

  const used = new Set<number>();
  existing.forEach((record) => {
    if (!record.phone) return;
    // boss1 또는 boss1-홍길동 형식 모두 체크
    const match = record.phone.match(new RegExp(`^${prefix}(\\d{1,5})(?:-.*)?$`, 'i'));
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num)) {
        used.add(num);
      }
    }
  });

  // 1부터 시작해서 사용 가능한 번호 찾기
  for (let i = 1; i <= 99999; i += 1) {
    if (!used.has(i)) {
      // 숫자만 반환 (이름 제거)
      return `${prefix}${i}`;
    }
  }

  throw new Error(`사용 가능한 ${type === 'BRANCH_MANAGER' ? '대리점장' : '판매원'} 아이디가 없습니다.`);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  let resolvedParams: { contractId: string } | undefined;
  try {
    resolvedParams = await params;
    const { contractId: contractIdStr } = resolvedParams;
    const contractId = Number(contractIdStr);
    if (!contractId || Number.isNaN(contractId)) {
      return NextResponse.json({ ok: false, message: 'Invalid contract ID' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      console.error('[Approve Contract] No session user');
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    logger.log('[Approve Contract] Admin check:', { userId: sessionUser.id, role: admin?.role });
    if (!admin) {
      console.error('[Approve Contract] Admin user not found:', sessionUser.id);
      return NextResponse.json({ ok: false, message: 'Admin user not found' }, { status: 403 });
    }
    const guard = requireAdmin(admin.role);
    if (guard) {
      console.error('[Approve Contract] Admin access denied:', { userId: sessionUser.id, role: admin.role });
      return guard;
    }

    const contract = await prisma.affiliateContract.findUnique({
      where: { id: contractId },
      include: {
        User_AffiliateContract_userIdToUser: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ ok: false, message: 'Contract not found' }, { status: 404 });
    }

    if (contract.status === 'approved') {
      return NextResponse.json({ ok: false, message: '이미 승인된 계약입니다.' }, { status: 400 });
    }

    // 계약서 타입 결정
    const sourceMeta = (contract.metadata ?? {}) as Record<string, any>;
    const contractType = sourceMeta?.contractType as string | undefined;
    const invitedByProfileId = contract.invitedByProfileId || (sourceMeta?.invitedByProfileId as number | undefined);
    logger.log('[Approve Contract] Contract info:', {
      contractId,
      contractType,
      invitedByProfileId,
      contractInvitedByProfileId: contract.invitedByProfileId,
      metadataInvitedByProfileId: sourceMeta?.invitedByProfileId,
    });

    // contractType이 있으면 우선 사용, 없으면 invitedByProfileId로 판단
    let partnerType: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'SUBSCRIPTION_AGENT' = 'SALES_AGENT';
    if (contractType === 'BRANCH_MANAGER') {
      partnerType = 'BRANCH_MANAGER';
    } else if (contractType === 'SUBSCRIPTION_AGENT') {
      // 정액제는 gest 아이디로 생성
      partnerType = 'SUBSCRIPTION_AGENT';
    } else if (contractType === 'CRUISE_STAFF') {
      // 크루즈스탭은 판매원 아이디로 생성
      partnerType = 'SALES_AGENT';
    } else if (!invitedByProfileId) {
      // contractType이 없고 invitedByProfileId도 없으면 대리점장
      partnerType = 'BRANCH_MANAGER';
    }

    // 파트너 아이디 생성 (이름 포함: boss1-홍길동, user1-김철수...)
    const partnerId = await generatePartnerId(partnerType, contract.name);

    let userId = contract.userId;
    let userRecord = contract.User_AffiliateContract_userIdToUser
      ? await prisma.user.findUnique({
        where: { id: contract.userId! },
        select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
      })
      : null;

    // 기존 사용자가 있고 이미 boss1/user1/gest1 형식이면 그대로 사용 (이름 포함/미포함 모두)
    let partnerIdPattern: RegExp;
    if (partnerType === 'BRANCH_MANAGER') {
      partnerIdPattern = /^boss\d+(-.*)?$/i;
    } else if (partnerType === 'SUBSCRIPTION_AGENT') {
      partnerIdPattern = /^gest\d+(-.*)?$/i;
    } else {
      partnerIdPattern = /^user\d+(-.*)?$/i;
    }
    if (userId && userRecord && userRecord.phone?.match(partnerIdPattern)) {
      // 이미 파트너 아이디가 있으면 그대로 사용
    } else if (!userId) {
      // 기존 사용자 확인 (phone으로)
      const normalizedPhone = normalizePhone(contract.phone);
      const digitsPhone = contract.phone.replace(/[^0-9]/g, '');

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ phone: normalizedPhone }, { phone: digitsPhone }],
        },
        select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
      });

      if (existingUser) {
        userId = existingUser.id;
        userRecord = existingUser;
        await prisma.affiliateContract.update({
          where: { id: contractId },
          data: { userId: existingUser.id },
        });
      } else {
        // 신규 사용자 생성: phone 필드에 user1, user2... 저장, 비밀번호 1101
        // 유효기간 60일 설정
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60); // 60일 후
        const expiresAtStr = expiresAt.toISOString().split('T')[0]; // YYYY-MM-DD 형식

        const newUser = await prisma.user.create({
          data: {
            name: contract.name,
            phone: partnerId, // phone 필드에 user1, user2... 저장
            email: contract.email || undefined,
            password: '1101', // 비밀번호 1101로 고정
            role: 'community',
            customerSource: 'affiliate-contract-approval',
            customerStatus: 'pending',
            adminMemo: `Auto-created from affiliate contract approval by admin ${sessionUser.id}. Valid until ${expiresAtStr}`,
            mallUserId: partnerId, // mallUserId에도 동일하게 저장 (호환성)
            mallNickname: contract.name,
            updatedAt: new Date(), // 필수 필드 추가
          },
          select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
        });
        userId = newUser.id;
        userRecord = newUser;
        await prisma.affiliateContract.update({ where: { id: contractId }, data: { userId: newUser.id } });
      }
    }

    if (!userId) {
      return NextResponse.json({ ok: false, message: '연결된 사용자 정보가 없습니다.' }, { status: 400 });
    }

    if (!userRecord) {
      userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
      });
    }

    if (!userRecord) {
      return NextResponse.json({ ok: false, message: '사용자 정보를 불러올 수 없습니다.' }, { status: 404 });
    }

    // phone 필드가 boss1/user1 형식이 아니면 업데이트
    // 유효기간 60일 설정
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60); // 60일 후

    const updateData: Record<string, unknown> = {};
    if (!userRecord.phone || !userRecord.phone.match(partnerIdPattern)) {
      updateData.phone = partnerId;
      updateData.mallUserId = partnerId; // 호환성을 위해 mallUserId도 업데이트
    }
    if (!userRecord.mallNickname) {
      updateData.mallNickname = contract.name;
    }
    if (userRecord.role !== 'community') {
      updateData.role = 'community';
    }
    // 비밀번호가 1101이 아니면 1101로 설정
    if (userRecord.password !== '1101') {
      updateData.password = '1101';
      // 비밀번호 변경 이벤트 기록 (실패해도 계속 진행)
      try {
        await prisma.passwordEvent.create({
          data: {
            userId: userRecord.id,
            from: userRecord.password,
            to: '1101',
            reason: `계약서 승인 시 자동 설정 (관리자 ID: ${sessionUser.id})`,
          },
        });
      } catch (eventError) {
        console.warn('[Approve Contract] passwordEvent 기록 실패 (무시하고 계속 진행):', eventError);
      }
    }

    // User 모델에는 metadata 필드가 없으므로 adminMemo에 유효기간 정보 저장
    const expiresAtStr = expiresAt.toISOString().split('T')[0]; // YYYY-MM-DD 형식
    const accountInfo = `계약서 승인 (${new Date().toISOString().split('T')[0]}) - 유효기간: ${expiresAtStr} (관리자 ID: ${sessionUser.id})`;

    // updateData에 adminMemo 추가 (기존 메모가 있으면 추가)
    if (Object.keys(updateData).length > 0) {
      const existingMemo = (userRecord as any).adminMemo || '';
      updateData.adminMemo = existingMemo
        ? `${existingMemo}\n${accountInfo}`
        : accountInfo;

      const updated = await prisma.user.update({
        where: { id: userRecord.id },
        data: updateData,
        select: { phone: true, mallUserId: true, mallNickname: true, role: true, password: true },
      });
      userRecord = { ...userRecord, ...updated };
    }

    const finalPartnerId = userRecord.phone || partnerId;

    const existingProfile = await prisma.affiliateProfile.findUnique({
      where: { userId },
      include: profileInclude,
    });

    let profile;
    const now = new Date();

    if (existingProfile) {
      // 기존 프로필이 있으면 업데이트
      logger.log('[Approve Contract] 기존 프로필 발견, 업데이트 진행:', {
        profileId: existingProfile.id,
        existingType: existingProfile.type,
        newType: partnerType,
        invitedByProfileId,
      });

      const updateData: Record<string, unknown> = {
        type: partnerType, // 타입 업데이트
        status: 'ACTIVE', // 상태 활성화
        displayName: contract.name, // 표시명 업데이트
        nickname: contract.name, // 닉네임 업데이트
        contactPhone: contract.phone, // 연락처 업데이트
        contactEmail: contract.email || null, // 이메일 업데이트
        bankName: contract.bankName || null, // 은행명 업데이트
        bankAccount: contract.bankAccount || null, // 계좌번호 업데이트
        bankAccountHolder: contract.bankAccountHolder || null, // 예금주 업데이트
        contractStatus: 'SIGNED', // 계약 상태: 서명됨
        contractSignedAt: now, // 계약 서명일
        published: true, // 노출: 활성화
        publishedAt: now, // 노출 시작일
        updatedAt: now, // 수정일
      };

      // branchLabel 업데이트 (대리점장인 경우만)
      if (partnerType === 'BRANCH_MANAGER' && !invitedByProfileId) {
        updateData.branchLabel = contract.name;
      }

      // landingSlug 업데이트
      if (finalPartnerId) {
        updateData.landingSlug = finalPartnerId;
      }

      // metadata 업데이트
      const existingMetadata = (existingProfile.metadata as Record<string, any>) || {};
      updateData.metadata = {
        ...existingMetadata,
        invitedByProfileId: invitedByProfileId || existingMetadata.invitedByProfileId,
        approvedAt: now.toISOString(),
        approvedBy: sessionUser.id,
        contractId: contractId,
      };

      profile = await prisma.affiliateProfile.update({
        where: { id: existingProfile.id },
        data: updateData as any,
        include: profileInclude,
      });

      logger.log('[Approve Contract] 기존 프로필 업데이트 완료:', {
        profileId: profile.id,
        type: profile.type,
      });
    } else {
      // 기존 프로필이 없으면 새로 생성
      const affiliateCode = generateAffiliateCode(contract.name, contract.id);

      // 프로필 생성 시 모든 필수 필드 채우기
      const payload: Record<string, unknown> = {
        userId: userId, // userId 직접 사용 (connect 대신)
        affiliateCode,
        type: partnerType,
        status: 'ACTIVE', // 상태: 활성
        displayName: contract.name, // 표시명
        branchLabel: invitedByProfileId ? null : (partnerType === 'BRANCH_MANAGER' ? contract.name : undefined), // 지점명 (대리점장인 경우)
        nickname: contract.name, // 닉네임
        contactPhone: contract.phone, // 연락처
        contactEmail: contract.email || null, // 이메일
        bankName: contract.bankName || null, // 은행명
        bankAccount: contract.bankAccount || null, // 계좌번호
        bankAccountHolder: contract.bankAccountHolder || null, // 예금주
        withholdingRate: 3.3, // 원천징수율
        contractStatus: 'SIGNED', // 계약 상태: 서명됨
        contractSignedAt: now, // 계약 서명일
        published: true, // 노출: 활성화
        publishedAt: now, // 노출 시작일
        updatedAt: now, // 수정일 (필수 필드)
        metadata: invitedByProfileId
          ? {
            invitedByProfileId,
            createdAt: now.toISOString(),
            createdBy: sessionUser.id,
          }
          : {
            createdAt: now.toISOString(),
            createdBy: sessionUser.id,
          },
      };

      // landingSlug는 phone 필드의 user1, user2... 사용
      if (!payload.landingSlug && finalPartnerId) {
        payload.landingSlug = finalPartnerId;
      }

      profile = await prisma.affiliateProfile.create({
        data: payload as any,
        include: profileInclude,
      });

      logger.log('[Approve Contract] 새 프로필 생성 완료:', {
        profileId: profile.id,
        type: profile.type,
        affiliateCode: profile.affiliateCode,
      });
    }

    // AffiliateRelation 생성/업데이트 (기존 프로필이든 새 프로필이든 모두 처리)
    if (invitedByProfileId) {
      logger.log('[Approve Contract] Creating/Updating AffiliateRelation:', {
        managerId: invitedByProfileId,
        agentId: profile.id,
        profileType: profile.type,
        isExistingProfile: !!existingProfile,
      });
      const relationNow = new Date();
      const relation = await prisma.affiliateRelation.upsert({
        where: {
          managerId_agentId: {
            managerId: invitedByProfileId,
            agentId: profile.id,
          },
        },
        create: {
          managerId: invitedByProfileId,
          agentId: profile.id,
          status: 'ACTIVE',
          connectedAt: relationNow,
          updatedAt: relationNow, // 필수 필드
        },
        update: {
          status: 'ACTIVE',
          connectedAt: relationNow,
          disconnectedAt: null,
          updatedAt: relationNow, // 필수 필드
        },
      });
      logger.log('[Approve Contract] AffiliateRelation created/updated:', relation);
    } else {
      logger.log('[Approve Contract] No invitedByProfileId, skipping AffiliateRelation creation');
    }

    await updateContractStatus(contractId, 'approved', sessionUser.id, {
      contractSignedAt: new Date(),
      invitedByProfileId: invitedByProfileId ?? null,
      metadata: {
        ...(contract.metadata || {}),
        affiliateProfileId: profile.id,
        partnerId: finalPartnerId, // user1, user2... 형식의 아이디
      },
    });

    // 관리자 승인은 아이디 생성만 수행 (PDF 전송은 대리점장이 완료 승인 시 수행)
    // 계약자에게 완료된 계약서 PDF 전송은 하지 않음

    // Google Drive에 서명 이미지 및 계약서 PDF 백업 (비동기 - 실패해도 승인은 완료)
    import('@/lib/google-drive-affiliate-info').then(({ backupContractSignaturesToDrive, backupContractPDFToDrive }) => {
      // 서명 이미지 백업
      backupContractSignaturesToDrive(contractId, profile.id, contract.name).catch((err) => {
        console.error('[Approve Contract] Drive 서명 백업 실패:', err);
      });
      // 계약서 PDF 백업 (Contracts 폴더에 저장)
      backupContractPDFToDrive(contractId, profile.id, contract.name).catch((err) => {
        console.error('[Approve Contract] Drive PDF 백업 실패:', err);
      });
    });

    // 새로 승인된 파트너에게 모든 활성 상품에 대한 개인 링크 자동 생성 (비동기)
    if (partnerType === 'BRANCH_MANAGER' || partnerType === 'SALES_AGENT') {
      import('@/lib/affiliate/auto-link-generator').then(({ generateLinksForPartner }) => {
        generateLinksForPartner(profile.id, partnerType as 'BRANCH_MANAGER' | 'SALES_AGENT', sessionUser.id)
          .then((result) => {
            logger.log(`[Approve Contract] 자동 링크 생성 완료 - 파트너: ${contract.name}, 생성: ${result.created}, 스킵: ${result.skipped}, 에러: ${result.errors.length}`);
          })
          .catch((error) => {
            console.error('[Approve Contract] 자동 링크 생성 실패:', error);
          });
      }).catch((importError) => {
        console.error('[Approve Contract] 자동 링크 생성 모듈 로드 실패:', importError);
      });
    }

    return NextResponse.json({ ok: true, profile, profileId: profile.id });
  } catch (error: any) {
    const errorContractId = resolvedParams ? resolvedParams.contractId : 'unknown';
    console.error(`POST /api/admin/affiliate/contracts/${errorContractId}/approve error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorCode = error?.code; // Prisma 에러 코드
    const errorMeta = error?.meta; // Prisma 에러 메타데이터
    console.error('[Approve Contract] Error details:', { errorMessage, errorStack, errorCode, errorMeta });

    // Prisma 에러 종류에 따른 친절한 메시지
    let userMessage = '계약 승인 중 오류가 발생했습니다.';
    if (errorCode === 'P2002') {
      userMessage = '중복된 데이터가 있습니다. 이미 등록된 사용자일 수 있습니다.';
    } else if (errorCode === 'P2025') {
      userMessage = '데이터를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.';
    } else if (errorCode === 'P2003') {
      userMessage = '참조 데이터가 없습니다. 관련 데이터가 삭제되었을 수 있습니다.';
    }

    return NextResponse.json(
      {
        ok: false,
        message: userMessage,
        error: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? { meta: errorMeta, stack: errorStack } : undefined,
      },
      { status: 500 }
    );
  }
}
