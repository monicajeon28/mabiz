export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE } from '@/lib/session';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (!session || !session.User) return false;
    return session.User.role === 'admin';
  } catch (error) {
    console.error('[Marketing Customers Backup] Auth check error:', error);
    return false;
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ 
        ok: false, 
        error: '인증이 필요합니다.' 
      }, { status: 403 });
    }

    const isAdmin = await checkAdminAuth(sid);
    if (!isAdmin) {
      return NextResponse.json({ 
        ok: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 });
    }

    // 모든 고객 데이터 조회
    const customers = await prisma.marketingCustomer.findMany({
      include: {
        MarketingAccount: {
          select: {
            accountName: true,
          },
        },
        MarketingLead: true,
        LeadScore: true,
        FunnelConversion: true,
      },
    });

    // 백업 데이터 준비
    const backupData = {
      version: '1.0',
      backupDate: new Date().toISOString(),
      totalCustomers: customers.length,
      customers: customers.map((customer) => ({
        id: customer.id,
        accountId: customer.accountId,
        accountName: customer.MarketingAccount?.accountName,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        source: customer.source,
        status: customer.status,
        leadScore: customer.leadScore,
        tags: customer.tags,
        notes: customer.notes,
        lastContactedAt: customer.lastContactedAt,
        convertedAt: customer.convertedAt,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        leads: customer.MarketingLead.map((lead) => ({
          id: lead.id,
          source: lead.source,
          status: lead.status,
          leadScore: lead.leadScore,
          createdAt: lead.createdAt,
        })),
        scores: customer.LeadScore.map((score) => ({
          id: score.id,
          score: score.score,
          lastCalculatedAt: score.lastCalculatedAt,
        })),
        conversions: customer.FunnelConversion.map((conv) => ({
          id: conv.id,
          conversionType: conv.conversionType,
          conversionValue: conv.conversionValue,
          convertedAt: conv.convertedAt,
        })),
      })),
    };

    // 백업 디렉토리 생성
    const backupDir = join(process.cwd(), 'backups', 'marketing-customers');
    await mkdir(backupDir, { recursive: true });

    // 백업 파일 저장
    const backupFileName = `customers_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backupFilePath = join(backupDir, backupFileName);
    await writeFile(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

    return NextResponse.json({
      ok: true,
      message: '백업이 완료되었습니다.',
      data: {
        backupFile: backupFileName,
        backupPath: backupFilePath,
        totalCustomers: customers.length,
        backupDate: backupData.backupDate,
      },
    });
  } catch (error) {
    console.error('[Marketing Customers Backup] Error:', error);
    return NextResponse.json({
      ok: false,
      error: '백업에 실패했습니다.',
    }, { status: 500 });
  }
}
