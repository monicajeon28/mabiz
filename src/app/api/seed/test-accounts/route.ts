/**
 * Seed Test Accounts API
 * POST /api/seed/test-accounts
 *
 * 로컬 개발 환경에서만 테스트 계정을 자동으로 생성합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

const SALT_ROUNDS = 10;

interface TestAccount {
  phone: string;
  password: string;
  displayName: string;
  type: 'admin' | 'member';
  role?: string;
}

const TEST_ACCOUNTS: TestAccount[] = [
  // GlobalAdmin 계정
  {
    phone: 'admin1',
    password: '0313',
    displayName: '관리자 1',
    type: 'admin',
  },
  {
    phone: 'admin2',
    password: '0313',
    displayName: '관리자 2',
    type: 'admin',
  },
  // OrganizationMember 계정
  {
    phone: 'boss1',
    password: '1101',
    displayName: '지사장 1',
    type: 'member',
    role: 'OWNER',
  },
  {
    phone: 'sales1',
    password: '1101',
    displayName: '대리점장 1',
    type: 'member',
    role: 'AGENT',
  },
  {
    phone: 'pre1',
    password: '1101',
    displayName: '마케터 1',
    type: 'member',
    role: 'FREE_SALES',
  },
];

export async function POST(req: NextRequest) {
  try {
    // 개발 환경에서만 허용
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { ok: false, error: 'Test accounts can only be created in development environment' },
        { status: 403 }
      );
    }

    const results = {
      admins: [] as Array<{ phone: string; displayName: string; success: boolean }>,
      members: [] as Array<{ phone: string; displayName: string; role: string; success: boolean }>,
      organization: { created: false, id: '' },
    };

    // GlobalAdmin 계정 생성
    const adminAccounts = TEST_ACCOUNTS.filter(a => a.type === 'admin');
    for (const account of adminAccounts) {
      try {
        const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);

        const existing = await prisma.globalAdmin.findFirst({
          where: { phone: account.phone },
        });

        if (!existing) {
          await prisma.globalAdmin.create({
            data: {
              phone: account.phone,
              passwordHash,
              displayName: account.displayName,
            },
          });
          results.admins.push({ phone: account.phone, displayName: account.displayName, success: true });
        } else {
          results.admins.push({ phone: account.phone, displayName: account.displayName, success: false });
        }
      } catch (e) {
        results.admins.push({ phone: account.phone, displayName: account.displayName, success: false });
      }
    }

    // 테스트 조직 확인 및 생성
    let testOrg = await prisma.organization.findFirst({
      where: { name: 'Test Organization' },
    });

    if (!testOrg) {
      testOrg = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
        },
      });
      results.organization = { created: true, id: testOrg.id };
    } else {
      results.organization = { created: false, id: testOrg.id };
    }

    // OrganizationMember 계정 생성
    const memberAccounts = TEST_ACCOUNTS.filter(a => a.type === 'member');
    for (const account of memberAccounts) {
      try {
        const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);

        const existing = await prisma.organizationMember.findFirst({
          where: {
            organizationId: testOrg.id,
            phone: account.phone,
          },
        });

        if (!existing) {
          await prisma.organizationMember.create({
            data: {
              organizationId: testOrg.id,
              userId: `user_${account.phone}`,
              phone: account.phone,
              passwordHash,
              displayName: account.displayName,
              role: account.role || 'AGENT',
              isActive: true,
            },
          });
          results.members.push({
            phone: account.phone,
            displayName: account.displayName,
            role: account.role || 'AGENT',
            success: true,
          });
        } else {
          results.members.push({
            phone: account.phone,
            displayName: account.displayName,
            role: account.role || 'AGENT',
            success: false,
          });
        }
      } catch (e) {
        results.members.push({
          phone: account.phone,
          displayName: account.displayName,
          role: account.role || 'AGENT',
          success: false,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Test accounts created/verified successfully',
      results,
      loginCredentials: {
        admins: [
          { phone: 'admin1', password: '0313' },
          { phone: 'admin2', password: '0313' },
        ],
        members: [
          { phone: 'boss1', password: '1101' },
          { phone: 'sales1', password: '1101' },
          { phone: 'pre1', password: '1101' },
        ],
      },
    });
  } catch (error) {
    logger.error('[Seed] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
