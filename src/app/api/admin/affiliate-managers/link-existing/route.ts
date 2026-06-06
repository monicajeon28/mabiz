export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/affiliate-managers/link-existing
 *
 * 크루즈닷몰에 이미 존재하는 어필리에이트(BRANCH_MANAGER)를 CRM 대리점장으로 연결.
 * - 업그레이드 이전 계약한 기존 파트너용 수동 연결 도구
 * - GmAffiliateProfile(affiliateCode) → GmUser → OrganizationMember(OWNER) 생성
 * - 기존 비밀번호 그대로 복사 → 크루즈닷몰 아이디/비밀번호로 CRM 로그인 가능
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const affiliateCode =
    typeof body?.affiliateCode === 'string' ? body.affiliateCode.trim() : '';
  if (!affiliateCode) {
    return NextResponse.json(
      { ok: false, message: '어필리에이트 코드를 입력해주세요.' },
      { status: 400 },
    );
  }

  // 1. AffiliateProfile 조회
  const profile = await prisma.gmAffiliateProfile.findUnique({
    where: { affiliateCode },
  });
  if (!profile) {
    return NextResponse.json(
      { ok: false, message: '해당 어필리에이트 코드를 찾을 수 없습니다.' },
      { status: 404 },
    );
  }
  if (profile.type !== 'BRANCH_MANAGER') {
    return NextResponse.json(
      {
        ok: false,
        message: '대리점장(BRANCH_MANAGER) 계정만 연결할 수 있습니다.',
      },
      { status: 400 },
    );
  }

  // 2. GmUser 조회
  const gmUser = await prisma.gmUser.findUnique({ where: { id: profile.userId } });
  if (!gmUser) {
    return NextResponse.json(
      { ok: false, message: 'GmUser를 찾을 수 없습니다. 크루즈닷몰 DB를 확인해주세요.' },
      { status: 404 },
    );
  }

  // 3. 이미 연결된 OrganizationMember 확인 (중복 방지)
  const existing = await prisma.organizationMember.findFirst({
    where: { userId: `gm-${gmUser.id}` },
    select: { id: true, organizationId: true, displayName: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        message: '이미 CRM에 연결된 계정입니다.',
        data: { memberId: existing.id, organizationId: existing.organizationId, displayName: existing.displayName },
      },
      { status: 409 },
    );
  }

  // 4. 본사 organizationId 결정
  const organizationId = ctx.organizationId ?? process.env.BONSA_ORG_ID ?? '';
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: '본사 조직 ID를 찾을 수 없습니다. BONSA_ORG_ID 환경변수를 확인해주세요.' },
      { status: 500 },
    );
  }

  // 5. OrganizationMember(OWNER) 생성
  const phone = profile.contactPhone ?? gmUser.phone ?? null;
  const email = profile.contactEmail ?? gmUser.email ?? null;
  const displayName = profile.displayName ?? gmUser.name ?? '대리점장';

  const member = await prisma.organizationMember.create({
    data: {
      organizationId,
      userId: `gm-${gmUser.id}`,
      role: 'OWNER',
      displayName,
      phone,
      email,
      passwordHash: gmUser.password, // 크루즈닷몰 기존 비밀번호 그대로 복사
      isActive: true,
    },
  });

  logger.info('[link-existing] 기존 어필리에이트 CRM 연결 완료', {
    affiliateCode,
    gmUserId: gmUser.id,
    memberId: member.id,
    organizationId,
    displayName,
  });

  return NextResponse.json({
    ok: true,
    message: `${displayName}님이 CRM 대리점장으로 연결되었습니다.`,
    data: {
      memberId: member.id,
      organizationId,
      displayName,
      phone,
      affiliateCode,
    },
  });
}
