export const dynamic = 'force-dynamic';

/**
 * GET  /api/affiliate/contracts?status=submitted&page=1  — 목록 (GLOBAL_ADMIN)
 * POST /api/affiliate/contracts                          — 신청서 제출 (공개, 인증 불필요)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
import { CONTRACT_PRICE_TIERS } from '@/lib/affiliate/priceTiers';
import { checkContractApplicationRateLimit } from '@/lib/affiliate-rate-limit';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    // GLOBAL_ADMIN(관리자) 또는 OWNER(대리점장)만 접근 가능
    if (!ctx || (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER')) {
      return NextResponse.json(
        { ok: false, message: '관리자 또는 대리점장 권한이 필요합니다.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'submitted'; // 기본: 승인 대기
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = 20;
    const skip = (page - 1) * limit;

    const typeFilter = searchParams.get('type') ?? '';
    const typeWhere = typeFilter === 'CRUISE_PARTNER'
      ? { metadata: { path: ['type'], equals: 'CRUISE_PARTNER' } }
      : typeFilter === 'SALES_AGENT'
        ? { NOT: { metadata: { path: ['type'], equals: 'CRUISE_PARTNER' } } }
        : {};

    const where = {
      ...(status === 'all' ? {} : { status }),
      ...typeWhere,
    };

    const [contracts, total] = await Promise.all([
      prisma.gmAffiliateContract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          metadata: true,
          createdAt: true,
          contractSignedAt: true,
        },
      }),
      prisma.gmAffiliateContract.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        contracts: contracts.map((c) => {
          const meta = c.metadata as Record<string, any> | null;
          return {
            ...c,
            contractType: meta?.type ?? 'SALES_AGENT',
            tierLabel: meta?.tierKey
              ? CONTRACT_PRICE_TIERS[meta?.tierKey as keyof typeof CONTRACT_PRICE_TIERS]?.label
              : null,
            approvedAt: meta?.approvedAt || null,
            rejectedAt: meta?.rejectedAt || null,
            rejectReason: meta?.rejectReason || null,
            rejectedByName: meta?.rejectedByName || null,
          };
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    logger.error('[AFFILIATE] 계약 목록 조회 실패', { error: err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ── POST: 가입 신청서 제출 (공개 — 인증 불필요) ───────────────────
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentCode = searchParams.get('agentCode')?.trim();

    const body = await req.json();

    // Rate Limit: 클라이언트 IP 추출
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';

    // 기본 정보
    const name: string | undefined = typeof body.name === 'string' ? body.name.trim() : undefined;
    const phone: string | undefined = typeof body.phone === 'string' ? body.phone.trim() : undefined;
    const email: string | undefined = typeof body.email === 'string' ? body.email.trim() : undefined;
    const address: string | undefined = typeof body.address === 'string' ? body.address.trim() : undefined;
    const residentId: string | undefined = typeof body.residentId === 'string' ? body.residentId.trim() : undefined;

    // 정산 계좌
    const bankName: string | undefined = typeof body.bankName === 'string' ? body.bankName.trim() : undefined;
    const bankAccount: string | undefined = typeof body.bankAccount === 'string' ? body.bankAccount.trim() : undefined;
    const bankAccountHolder: string | undefined = typeof body.bankAccountHolder === 'string' ? body.bankAccountHolder.trim() : undefined;

    // 서명 이미지 (base64 dataURL)
    const signatureImageUrl: string | undefined = typeof body.signatureImageUrl === 'string' ? body.signatureImageUrl : undefined;

    // displayName (프로필명)
    let displayName: string | undefined = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;

    // 동의 항목
    const consentPrivacy: boolean = body.consentPrivacy === true;
    const consentNonCompete: boolean = body.consentNonCompete === true;
    const consentDbUse: boolean = body.consentDbUse === true;
    const consentPenalty: boolean = body.consentPenalty === true;
    const consentRefund: boolean = body.consentRefund === true;

    // 등급 정보 (metadata에 보관)
    const tierKey: string | undefined = typeof body.tierKey === 'string' ? body.tierKey : undefined;
    const amount: number | undefined = typeof body.amount === 'number' ? body.amount : undefined;

    // 도장 이미지 (metadata에 보관)
    const stampImageUrl: string | undefined = typeof body.stampImageUrl === 'string' ? body.stampImageUrl : undefined;

    // metadata (type 식별용)
    const bodyMeta = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {};
    const contractType: string = typeof bodyMeta.type === 'string' ? bodyMeta.type : 'SALES_AGENT';

    // Rate Limit 검증 — IP 기반 (시간당 10회)
    const ipLimitResult = checkContractApplicationRateLimit(clientIp, 'ip');
    if (!ipLimitResult.allowed) {
      return NextResponse.json(
        {
          ok: false,
          message: '너무 많은 신청이 들어왔습니다. 잠시 후 다시 시도해 주세요.',
          retryAfter: Math.ceil((ipLimitResult.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((ipLimitResult.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    if (!name || name.length < 2) {
      return NextResponse.json({ ok: false, message: '이름을 입력해 주세요.' }, { status: 400 });
    }
    if (!phone || phone.length < 9) {
      return NextResponse.json({ ok: false, message: '연락처를 입력해 주세요.' }, { status: 400 });
    }

    // Rate Limit 검증 — 전화번호 기반 (일일 3회, 중복 신청 방지)
    const phoneLimitResult = checkContractApplicationRateLimit(phone, 'phone');
    if (!phoneLimitResult.allowed) {
      return NextResponse.json(
        {
          ok: false,
          message: '동일한 연락처로 너무 많은 신청이 있습니다. 담당자에게 문의해 주세요.',
          retryAfter: Math.ceil((phoneLimitResult.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((phoneLimitResult.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    // displayName 검증 (길이, 특수문자)
    if (displayName) {
      if (displayName.length > 20) {
        return NextResponse.json(
          { ok: false, message: '프로필명은 20자 이내여야 합니다.' },
          { status: 400 },
        );
      }
      // 특수문자 필터링 (한글, 영문, 숫자, 기본 기호만 허용)
      const sanitizedName = displayName.replace(/[^\p{L}\p{N}\s\-\.·]/gu, '').trim();
      if (!sanitizedName) {
        return NextResponse.json(
          { ok: false, message: '프로필명에는 유효한 문자가 필요합니다.' },
          { status: 400 },
        );
      }
      displayName = sanitizedName;
    }

    // CRUISE_PARTNER(크루즈닷 파트너스)는 프론트에서 모두 true로 보내므로 개인정보 동의만 검증
    if (contractType === 'CRUISE_PARTNER') {
      if (!consentPrivacy) {
        return NextResponse.json({ ok: false, message: '개인정보 처리 동의는 필수입니다.' }, { status: 400 });
      }
    } else {
      if (!consentPrivacy || !consentNonCompete || !consentDbUse || !consentPenalty || !consentRefund) {
        return NextResponse.json({ ok: false, message: '필수 동의 항목을 모두 확인해 주세요.' }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata: Record<string, any> = {};
    if (tierKey) metadata.tierKey = tierKey;
    if (amount) metadata.amount = amount;
    if (stampImageUrl) metadata.stampImageUrl = stampImageUrl;
    if (displayName) metadata.displayName = displayName;
    if (agentCode) metadata.agentCode = agentCode;

    // body.metadata 추가 필드 병합 (크루즈닷 파트너스 등 확장 필드)
    const allowedMetaKeys = [
      'type', 'signName', 'idPhotoUrl', 'bankBookUrl',
      'supervisorName', 'supervisorAgency', 'supervisorPhone', 'note',
      'snsChannels', 'applyNote',
    ];
    for (const key of allowedMetaKeys) {
      if (bodyMeta[key] !== undefined && bodyMeta[key] !== null && bodyMeta[key] !== '') {
        metadata[key] = bodyMeta[key];
      }
    }

    // Race Condition 방지: $transaction 내에서 중복 확인 + 생성을 원자적으로 처리
    // findFirst 후 create 사이에 다른 요청이 끼어드는 TOCTOU 문제를 차단
    const contract = await prisma.$transaction(async (tx) => {
      // 트랜잭션 내부에서 재확인 (serializable 수준 보장)
      const duplicate = await tx.gmAffiliateContract.findFirst({
        where: { phone, status: { in: ['submitted', 'PROCESSING'] } },
        select: { id: true },
      });
      if (duplicate) {
        // null 반환으로 중복 신호 전달
        return null;
      }

      return tx.gmAffiliateContract.create({
        data: {
          name,
          phone,
          email: email || null,
          address: address || null,
          residentId: residentId || null,
          bankName: bankName || null,
          bankAccount: bankAccount || null,
          bankAccountHolder: bankAccountHolder || null,
          signatureImageUrl: signatureImageUrl || null,
          consentPrivacy,
          consentNonCompete,
          consentDbUse,
          consentPenalty,
          consentRefund,
          status: 'submitted',
          submittedAt: new Date(),
          contractSignedAt: signatureImageUrl ? new Date() : null,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        },
      });
    });

    if (!contract) {
      return NextResponse.json(
        { ok: false, message: '이미 접수된 신청이 있습니다. 담당자에게 문의해 주세요.' },
        { status: 409 },
      );
    }

    logger.info('[AFFILIATE-CONTRACT] 신규 가입 신청', {
      contractId: contract.id,
      name,
      phone,
      tierKey,
      amount,
    });

    return NextResponse.json({
      ok: true,
      message: '신청이 완료되었습니다. 담당자가 확인 후 연락드리겠습니다.',
      data: { contractId: contract.id },
    });
  } catch (err) {
    logger.error('[AFFILIATE-CONTRACT] 신청 제출 실패', { error: err });
    return NextResponse.json({ ok: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}
