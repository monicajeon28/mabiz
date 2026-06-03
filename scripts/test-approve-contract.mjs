/**
 * 테스트 계약 생성 → 승인 → 크루즈닷 웹훅 발송 확인
 * node --env-file=.env.local scripts/test-approve-contract.mjs
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function run() {
  console.log('=== 테스트 계약 승인 + 크루즈닷 웹훅 발송 테스트 ===\n');

  // 1. 테스트 계약 생성
  console.log('[1/4] 테스트 계약 생성...');
  const testContract = await prisma.gmAffiliateContract.create({
    data: {
      name: '웹훅테스트_삭제예정',
      phone: '01099999999',
      email: 'webhook-test@mabiz-test.com',
      status: 'submitted',
      submittedAt: new Date(),
      metadata: {
        contractRef: `TEST-${Date.now()}`,
        isTestData: true,
      },
      consentPrivacy: true,
      consentDbUse: true,
      consentNonCompete: true,
      consentPenalty: true,
      consentRefund: true,
    }
  });
  console.log(`  ✅ 계약 생성: ID=${testContract.id}, contractRef=${testContract.metadata?.contractRef}`);

  // 2. 본사 관리자 세션 확인 (GLOBAL_ADMIN)
  console.log('\n[2/4] GLOBAL_ADMIN 확인...');
  const admin = await prisma.globalAdmin.findFirst({
    select: { id: true, displayName: true, phone: true }
  });
  if (!admin) { console.log('  ❌ GLOBAL_ADMIN 없음'); process.exit(1); }
  console.log(`  ✅ 관리자: ${admin.displayName || admin.phone || admin.id}`);

  // 3. API 호출로 계약 승인
  console.log('\n[3/4] 계약 승인 API 호출...');
  console.log(`  URL: PUT ${APP_URL}/api/affiliate/contracts/${testContract.id}/approve`);
  console.log('  ⚠️  로컬 서버가 실행 중이어야 합니다 (npm run dev)');
  console.log('  ⚠️  실제 승인은 관리자 UI에서 진행하거나 dev 서버 + 쿠키 인증 필요');

  // 4. 직접 provision 로직 대신 웹훅만 테스트
  console.log('\n[4/4] 웹훅 직접 발송 테스트...');
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
  if (!secret) {
    console.log('  ❌ CRUISEDOT_WEBHOOK_SECRET 미설정');
  } else {
    console.log(`  ✅ Secret 설정됨 (${secret.slice(0, 10)}...)`);

    const { createHmac } = await import('crypto');
    const contractRef = testContract.metadata?.contractRef;
    const payload = {
      event: 'contract.approved',
      contractId: testContract.id,
      contractRef: contractRef,
      contractorName: testContract.name,
      approvedAt: new Date().toISOString(),
      manager: {
        partnerId: 'boss_test_001',
        role: 'affiliate_manager',
        affiliateCode: 'MGR-TEST0001',
        linkCode: 'aff_TEST0001',
        linkUrl: 'https://cruisedot.co.kr?ref=aff_TEST0001'
      },
      agent: {
        partnerId: 'sales_test_001',
        role: 'affiliate_agent',
        affiliateCode: 'AGT-TEST0001',
        linkCode: 'aff_TEST0002',
        linkUrl: 'https://cruisedot.co.kr?ref=aff_TEST0002'
      },
      presales: {
        partnerId: 'pre_test_001',
        role: 'affiliate_presales',
        affiliateCode: 'PRE-TEST0001',
        linkCode: 'aff_TEST0003',
        linkUrl: 'https://cruisedot.co.kr?ref=aff_TEST0003'
      }
    };

    const body = JSON.stringify(payload);
    const timestamp = String(Date.now());
    const signature = `sha256=${createHmac('sha256', secret).update(Buffer.from(body)).digest('hex')}`;

    console.log(`\n  발송 URL: https://cruisedot.co.kr/api/webhooks/crm/affiliate-created`);
    console.log(`  contractRef: ${contractRef}`);
    console.log(`  X-Signature: ${signature.slice(0, 30)}...`);

    try {
      const res = await fetch('https://cruisedot.co.kr/api/webhooks/crm/affiliate-created', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Timestamp': timestamp,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const resText = await res.text().catch(() => '');
      if (res.ok) {
        console.log(`\n  ✅ 웹훅 발송 성공 (HTTP ${res.status})`);
        console.log(`  응답: ${resText.slice(0, 300)}`);
      } else {
        console.log(`\n  ❌ 웹훅 발송 실패 (HTTP ${res.status})`);
        console.log(`  응답: ${resText.slice(0, 300)}`);
      }
    } catch (e) {
      console.log(`  ❌ 네트워크 오류: ${e.message}`);
    }
  }

  // 5. 테스트 계약 클린업
  console.log('\n[5/5] 테스트 계약 클린업...');
  await prisma.gmAffiliateContract.delete({ where: { id: testContract.id } });
  console.log(`  ✅ 테스트 계약 삭제 완료 (ID=${testContract.id})`);

  await prisma.$disconnect();
  console.log('\n=== 완료 ===');
}

run().catch(async e => {
  console.error('❌', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
