export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

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

function buildInviteMessage(name: string, contractUrl: string) {
  const displayName = name || '파트너님';
  return [
    '[크루즈닷 어필리에이트 계약 안내]',
    `${displayName}, 본사와의 계약을 위해 아래 링크에서 신청서를 작성해주세요.`,
    contractUrl,
    '',
    '준비물: 신분증 사본, 통장 사본 (구글 드라이브 공유 링크 업로드)',
    '작성 완료 후 본사에서 검토하고 승인 안내를 드립니다.',
  ].join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const body = await req.json();
    const name = (body?.name ?? '').toString().trim();
    const phoneInput = (body?.phone ?? '').toString().trim();

    if (!name || !phoneInput) {
      return NextResponse.json({ ok: false, message: '이름과 연락처를 모두 입력해주세요.' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phoneInput);
    if (normalizedPhone.replace(/[^0-9]/g, '').length < 9) {
      return NextResponse.json({ ok: false, message: '연락처 형식을 확인해주세요.' }, { status: 400 });
    }

    let existing = await prisma.affiliateContract.findFirst({
      where: {
        phone: normalizedPhone,
        status: { in: ['submitted', 'in_review', 'approved'] },
      },
      select: { id: true, status: true, metadata: true, userId: true },
    });

    if (existing?.status === 'approved') {
      const meta = (existing.metadata ?? {}) as Record<string, unknown>;
      const rawMetaId = meta['affiliateProfileId'];
      let affiliateProfileId: number | null = null;

      if (typeof rawMetaId === 'number') {
        affiliateProfileId = rawMetaId;
      } else if (typeof rawMetaId === 'string') {
        const parsed = Number(rawMetaId);
        if (!Number.isNaN(parsed) && parsed > 0) {
          affiliateProfileId = parsed;
        }
      }

      let profileExists: { id: number } | null = null;

      if (affiliateProfileId) {
        profileExists = await prisma.affiliateProfile.findUnique({
          where: { id: affiliateProfileId },
          select: { id: true },
        });
      } else if (existing.userId) {
        profileExists = await prisma.affiliateProfile.findUnique({
          where: { userId: existing.userId },
          select: { id: true },
        });
      }

      if (!profileExists) {
        const staleContractId = existing.id;

        await prisma.$transaction(async (tx) => {
          await tx.affiliateDocument.deleteMany({
            where: { affiliateContractId: staleContractId },
          });

          await tx.affiliateContract.delete({
            where: { id: staleContractId },
          });
        });

        existing = null;
      }
    }

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          message: '이미 진행 중인 계약 신청이 있습니다. 계약 목록에서 상태를 확인해주세요.',
          contractId: existing.id,
        },
        { status: 409 },
      );
    }

    const { origin } = new URL(req.url);
    const contractUrl = `${origin.replace(/\/$/, '')}/affiliate/contract`;
    const message = buildInviteMessage(name, contractUrl);

    return NextResponse.json({ ok: true, message, contractUrl, phone: normalizedPhone });
  } catch (error) {
    console.error('POST /api/admin/affiliate/contracts/invite error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
