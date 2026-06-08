import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { MABIZ_SESSION_COOKIE } from '@/lib/auth';
import { createHash, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { checkRateLimitAsync } from '@/lib/rate-limit';

function isBcryptHash(h: string) {
  return h.startsWith('$2b$') || h.startsWith('$2a$');
}

async function checkPassword(input: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  if (isBcryptHash(stored)) {
    return bcrypt.compare(input, stored);
  }

  // SHA256 비교
  const inputHash = createHash('sha256').update(input).digest('hex');
  try {
    const a = Buffer.from(inputHash);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// GMcruise User 테이블에서 파트너/어드민 조회
async function findMallUser(identifier: string): Promise<{
  id: number;
  name: string | null;
  password: string;
  role: string;
  mallUserId: string | null;
  affiliateType: string | null;
} | null> {
  type RawUser = {
    id: number;
    name: string | null;
    password: string;
    role: string;
    mallUserId: string | null;
    affiliateType: string | null;
  };
  try {
    const rows = await prisma.$queryRawUnsafe<RawUser[]>(
      `SELECT u.id, u.name, u.password, u.role, u."mallUserId",
              ap.type as "affiliateType"
       FROM "User" u
       LEFT JOIN "AffiliateProfile" ap ON ap."userId" = u.id AND ap.status = 'ACTIVE'
       WHERE (u."mallUserId" = $1 OR u.phone = $1)
         AND u."isLocked" = false
       LIMIT 1`,
      identifier
    );
    return rows[0] ?? null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[findMallUser] raw SQL 실패', { identifier, msg });
    throw err;
  }
}

// GMcruise mallUserId 기반 CRM 역할 결정
function resolveRoleFromMallUser(role: string, mallUserId: string | null, affiliateType: string | null): 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT' | 'FREE_SALES' | null {
  if (role === 'admin') return 'GLOBAL_ADMIN';
  if (!affiliateType) return null; // community인데 AffiliateProfile 없으면 로그인 불가
  if (affiliateType === 'BRANCH_MANAGER' || affiliateType === 'HQ') return 'OWNER';
  if (affiliateType === 'PRESALES') return 'FREE_SALES';
  if (affiliateType === 'SALES_AGENT') return 'AGENT';
  // 알 수 없는 affiliateType은 null 반환 (로그인 불가)
  return null;
}

export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json() as { phone?: string; password?: string };

    if (!phone?.trim() || !password) {
      return NextResponse.json({ ok: false, error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // 아이디: 숫자만 있으면 전화번호 정규화, 영문 포함이면 그대로
    const raw = phone.trim();
    const phoneClean = /^[0-9\-\s]+$/.test(raw) ? raw.replace(/[^0-9]/g, '') : raw;

    // 브루트포스 방지: 식별자(전화번호)별 15분 내 10회 제한
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rlKey = `login:${phoneClean}:${ip}`;
    const rl = await checkRateLimitAsync(rlKey, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      logger.warn('[POST /api/auth/login] 레이트리밋 초과', { phoneClean, ip });
      return NextResponse.json(
        { ok: false, error: '잠시 후 다시 시도해주세요. (15분 후 재시도 가능)' },
        { status: 429 }
      );
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const cookieStore = await cookies();

    // 1단계: GlobalAdmin 확인 (CRM 전용 어드민)
    const admin = await prisma.globalAdmin.findFirst({
      where: { phone: phoneClean },
    });

    if (admin) {
      if (!await checkPassword(password, admin.passwordHash ?? null)) {
        return NextResponse.json({ ok: false, error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
      }

      // SHA-256 레거시 → bcrypt 자동 업그레이드
      if (admin.passwordHash && !isBcryptHash(admin.passwordHash)) {
        const upgraded = await bcrypt.hash(password, 12);
        await prisma.globalAdmin.update({ where: { id: admin.id }, data: { passwordHash: upgraded } });
        logger.log('[POST /api/auth/login] GlobalAdmin SHA-256→bcrypt 업그레이드', { adminId: admin.id });
      }

      const session = await prisma.mabizSession.create({
        data: { adminId: admin.id, role: 'GLOBAL_ADMIN', expiresAt },
      });

      cookieStore.set(MABIZ_SESSION_COOKIE, session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });

      logger.log('[POST /api/auth/login] GlobalAdmin 로그인', { adminId: admin.id });
      return NextResponse.json({ ok: true, role: 'GLOBAL_ADMIN' });
    }

    // 2단계: OrganizationMember 확인 (CRM 전용 멤버)
    const member = await prisma.organizationMember.findFirst({
      where: { phone: phoneClean, isActive: true },
    });

    if (member) {
      if (!await checkPassword(password, member.passwordHash ?? null)) {
        return NextResponse.json({ ok: false, error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
      }

      // SHA-256 레거시 → bcrypt 자동 업그레이드
      if (member.passwordHash && !isBcryptHash(member.passwordHash)) {
        const upgraded = await bcrypt.hash(password, 12);
        await prisma.organizationMember.update({ where: { id: member.id }, data: { passwordHash: upgraded } });
        logger.log('[POST /api/auth/login] OrganizationMember SHA-256→bcrypt 업그레이드', { memberId: member.id });
      }

      const role =
        member.role === 'OWNER'      ? 'OWNER'      :
        member.role === 'FREE_SALES' ? 'FREE_SALES' : 'AGENT';

      const session = await prisma.mabizSession.create({
        data: { memberId: member.id, role, organizationId: member.organizationId, expiresAt },
      });

      cookieStore.set(MABIZ_SESSION_COOKIE, session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });

      logger.log('[POST /api/auth/login] OrganizationMember 로그인', { memberId: member.id, role });
      return NextResponse.json({ ok: true, role });
    }

    // 3단계: GMcruise User 테이블 폴백 (크루즈닷몰 파트너/어드민)
    const mallUser = await findMallUser(phoneClean);

    if (!mallUser) {
      return NextResponse.json({ ok: false, error: '등록되지 않은 아이디입니다.' }, { status: 401 });
    }

    // 소셜 로그인 계정 차단 (비밀번호를 알 수 없으므로 CRM 로그인 불가)
    const socialPrefixes = ['naver_', 'kakao_', 'google_'];
    if (mallUser.mallUserId && socialPrefixes.some(p => mallUser.mallUserId!.startsWith(p))) {
      return NextResponse.json(
        { ok: false, error: '카카오·네이버·구글 소셜 계정은 파트너스 CRM에 직접 로그인할 수 없습니다.' },
        { status: 403 }
      );
    }

    // GMcruise User.password 검증 (bcrypt 또는 SHA-256 레거시)
    const passwordOk = await checkPassword(password, mallUser.password);
    if (!passwordOk) {
      return NextResponse.json({ ok: false, error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    // SHA-256 레거시 → bcrypt 자동 업그레이드 (로그인 성공 시 한 번만)
    if (!isBcryptHash(mallUser.password)) {
      const upgraded = await bcrypt.hash(password, 12);
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
        upgraded, mallUser.id
      );
      logger.log('[POST /api/auth/login] GmUser SHA-256→bcrypt 업그레이드', { mallUserId: mallUser.id });
    }

    const role = resolveRoleFromMallUser(mallUser.role, mallUser.mallUserId, mallUser.affiliateType);
    if (!role) {
      return NextResponse.json({ ok: false, error: '로그인 권한이 없는 계정입니다.' }, { status: 403 });
    }
    if (role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: 'CRM 로그인 권한이 없는 계정입니다.' }, { status: 403 });
    }

    // OWNER/AGENT는 org 연결 필요 — externalAffiliateProfileId 매핑 필수
    let orgId: string | null = null;
    if (role !== 'GLOBAL_ADMIN') {
      // 어필리에이트 프로필 ID로 조직 찾기
      if (mallUser.affiliateType) {
        type OrgRow = { id: string };
        const orgRows = await prisma.$queryRawUnsafe<OrgRow[]>(
          `SELECT id FROM "Organization" WHERE "externalAffiliateProfileId" = $1 LIMIT 1`,
          String(mallUser.id)
        );
        // 매핑된 org 없으면 로그인 불가 (임의 org 사용 금지)
        if (!orgRows[0]) {
          logger.error('[POST /api/auth/login] org 매핑 실패 — externalAffiliateProfileId 없음', { mallUserId: mallUser.id });
          return NextResponse.json({ ok: false, error: '조직 연결이 되어 있지 않습니다. 관리자에게 문의해주세요.' }, { status: 401 });
        }
        orgId = orgRows[0].id;
      }
    }

    const session = await prisma.mabizSession.create({
      data: { mallUserId: mallUser.id, role, organizationId: orgId, expiresAt },
    });

    cookieStore.set(MABIZ_SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    logger.log('[POST /api/auth/login] GMcruise User 로그인', { mallUserId: mallUser.id, role });
    return NextResponse.json({ ok: true, role });

  } catch (err) {
    logger.error('[POST /api/auth/login]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
