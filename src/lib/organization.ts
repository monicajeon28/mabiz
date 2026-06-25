/**
 * src/lib/organization.ts
 * Organization 서비스 레이어 — 대리점 생성/조회/멤버 추가
 *
 * 이 파일이 유일한 Organization 생성 경로입니다.
 * API route에서 직접 prisma.organization.create() 호출 금지.
 *
 * 호출처:
 *   POST /api/webhooks/gmcruise/contract-signed  — 계약서 서명 완료 시 (유일한 생성 경로)
 *   (수동 생성 경로 POST /api/admin/organizations 는 2026-06-05 폐지)
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';

// ── 타입 정의 ─────────────────────────────────────────────────────────

export interface CreateOrgParams {
  name:           string;          // 대리점명
  slug?:          string;          // 없으면 자동 생성
  ownerName:      string;          // 지사장 이름 (GMcruise에서 수신)
  ownerPhone:     string;          // 지사장 전화번호
  ownerEmail?:    string;          // 지사장 이메일 (선택)
  contractRef?:   string;          // GMcruise 계약 참조 ID
  source?:        string;          // 'webhook' | 'manual' | 'seed'
}

export interface CreateOrgResult {
  organization: { id: string; name: string; slug: string };
  owner:        { id: string; phone: string; displayName: string | null };
  created:      boolean;           // false = 기존 조직 반환 (idempotent)
}

export interface AddMemberParams {
  organizationId: string;
  phone:          string;
  passwordHash:   string;
  role:           'OWNER' | 'AGENT' | 'FREE_SALES';
  displayName?:   string;
  email?:         string;
  inviteTokenId?: string;          // 사용된 초대 토큰 ID (audit용)
}

// ── slugify ───────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base ?? 'org';
  let attempt = 0;
  while (attempt < 10) {
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${randomBytes(3).toString('hex')}`;
    attempt++;
  }
  // 최후 수단: timestamp suffix
  return `${base}-${Date.now()}`;
}

// ── findOrCreateOrganization ──────────────────────────────────────────
/**
 * 대리점 생성 — idempotent
 *
 * contractRef가 주어지면 동일 contractRef를 가진 조직을 먼저 조회.
 * 없으면 ownerPhone으로 기존 OWNER 멤버를 조회해 소속 조직 반환.
 * 그래도 없으면 새 조직 + OWNER 멤버 생성.
 */
export async function findOrCreateOrganization(
  params: CreateOrgParams
): Promise<CreateOrgResult> {
  const phoneClean = params.ownerPhone.replace(/[^0-9]/g, '');

  // 1) contractRef로 기존 조직 조회
  if (params.contractRef) {
    const existing = await prisma.organization.findFirst({
      where: { contractRef: params.contractRef },
      include: {
        members: {
          where: { role: 'OWNER', isActive: true },
          take:  1,
        },
      },
    });
    if (existing) {
      const owner = existing.members[0];
      logger.warn('[Organization] 기존 조직 반환 (contractRef match)', {
        orgId:       existing.id,
        contractRef: params.contractRef,
      });
      return {
        organization: { id: existing.id, name: existing.name, slug: existing.slug },
        owner:        { id: owner?.id ?? '', phone: owner?.phone ?? '', displayName: owner?.displayName ?? null },
        created:      false,
      };
    }
  }

  // 2) 전화번호로 기존 OWNER 조회
  const existingOwner = await prisma.organizationMember.findFirst({
    where:   { phone: phoneClean, role: 'OWNER' },
    include: { organization: true },
  });
  if (existingOwner) {
    logger.warn('[Organization] 기존 조직 반환 (phone match)', {
      orgId: existingOwner.organizationId,
      phone: phoneClean.slice(0, 3) + '****',
    });
    return {
      organization: {
        id:   existingOwner.organization.id,
        name: existingOwner.organization.name,
        slug: existingOwner.organization.slug,
      },
      owner: {
        id:          existingOwner.id,
        phone:       existingOwner.phone ?? '',
        displayName: existingOwner.displayName,
      },
      created: false,
    };
  }

  // 3) 신규 생성
  const slug = await uniqueSlug(params.slug ?? slugify(params.name));
  const orgId = `org_${Date.now()}_${randomBytes(4).toString('hex')}`;

  // OWNER memberId — 나중에 초대 링크로 실제 계정 생성. 여기서는 placeholder.
  const ownerId = `mbr_${Date.now()}_${randomBytes(4).toString('hex')}`;

  await prisma.$transaction([
    prisma.organization.create({
      data: {
        id:          orgId,
        name:        params.name,
        slug,
        status:      'ACTIVE',
        contractRef: params.contractRef ?? null,
        plan:        'BASIC',
      },
    }),
    // OWNER 멤버 — passwordHash 없이 생성 (초대 링크로 비밀번호 설정)
    prisma.organizationMember.create({
      data: {
        id:             ownerId,
        organizationId: orgId,
        userId:         ownerId,
        phone:          phoneClean,
        email:          params.ownerEmail ?? null,
        passwordHash:   '',            // 초대 완료 전까지 빈 문자열 — 로그인 불가
        role:           'OWNER',
        displayName:    params.ownerName ?? null,
        isActive:       false,         // 초대 링크 수락 후 활성화
      },
    }),
  ]);

  logger.warn('[Organization] 신규 대리점 생성', {
    orgId,
    name:   params.name,
    source: params.source ?? 'unknown',
  });

  return {
    organization: { id: orgId, name: params.name, slug },
    owner:        { id: ownerId, phone: phoneClean, displayName: params.ownerName ?? null },
    created:      true,
  };
}

// ── addOrganizationMember ─────────────────────────────────────────────
/**
 * 초대 링크를 통한 멤버 추가 — join/[token] route에서 호출
 * 트랜잭션 바깥에서 호출해도 되지만, 호출자가 더 큰 트랜잭션을 감싸도 됨.
 */
export async function addOrganizationMember(
  params: AddMemberParams
): Promise<{ id: string }> {
  const memberId = `mbr_${Date.now()}_${randomBytes(4).toString('hex')}`;

  await prisma.organizationMember.create({
    data: {
      id:             memberId,
      organizationId: params.organizationId,
      userId:         memberId,
      phone:          params.phone,
      email:          params.email ?? null,
      passwordHash:   params.passwordHash,
      role:           params.role,
      displayName:    params.displayName ?? null,
      isActive:       true,
    },
  });

  logger.warn('[Organization] 멤버 추가', {
    memberId,
    orgId: params.organizationId,
    role:  params.role,
  });

  return { id: memberId };
}

// ── getOrganizationBySlug ─────────────────────────────────────────────
export async function getOrganizationBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    include: {
      members: {
        where:  { isActive: true },
        select: { id: true, role: true, displayName: true, phone: true, email: true },
        orderBy: { role: 'asc' },
      },
    },
  });
}
