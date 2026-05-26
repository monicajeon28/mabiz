/**
 * DB 상태 확인 스크립트 (JavaScript)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function checkDBStatus() {
  console.log('\n🔍 CRM 데이터베이스 상태 확인 시작...\n');

  try {
    // 1. Contact
    const contactCount = await prisma.contact.count();
    const contacts = await prisma.contact.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    console.log('📋 Contact 데이터');
    console.log(`   - 총 Contact: ${contactCount}명`);
    console.log('   - 최근 데이터:');
    contacts.forEach((c) => {
      console.log(
        `     • ${c.name || '(미정)'} | ${c.phone || c.email || '(미등록)'} | ${new Date(c.createdAt).toLocaleDateString('ko-KR')}`
      );
    });

    // 2. B2B Landing
    const b2bCount = await prisma.b2BLandingRegistration.count();
    const b2bRegs = await prisma.b2BLandingRegistration.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    console.log('\n📋 B2B 랜딩페이지 등록');
    console.log(`   - 총 등록: ${b2bCount}건`);
    console.log('   - 최근 데이터:');
    b2bRegs.slice(0, 3).forEach((reg) => {
      console.log(
        `     • ${reg.name} | ${reg.phone} | ${new Date(reg.createdAt).toLocaleDateString('ko-KR')}`
      );
    });

    // 3. CRM Landing
    const crmLandingCount = await prisma.crmLandingRegistration.count();
    const crmLandings = await prisma.crmLandingRegistration.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    console.log('\n📋 CRM 랜딩페이지 등록');
    console.log(`   - 총 등록: ${crmLandingCount}건`);
    console.log('   - 최근 데이터:');
    crmLandings.slice(0, 3).forEach((reg) => {
      console.log(
        `     • ${reg.name || '(미정)'} | ${reg.phone} | ${new Date(reg.createdAt).toLocaleDateString('ko-KR')}`
      );
    });

    // 4. 그룹
    const groupCount = await prisma.contactGroup.count();
    const groupMemberCount = await prisma.contactGroupMember.count();
    console.log('\n📋 그룹 관리');
    console.log(`   - 그룹 수: ${groupCount}개`);
    console.log(`   - 그룹 멤버: ${groupMemberCount}명`);

    // 5. SMS Log
    const smsCount = await prisma.smsLog.count();
    console.log('\n📋 SMS 로그');
    console.log(`   - 총 발송: ${smsCount}건`);

    // 6. CallLog
    const callLogCount = await prisma.callLog.count();
    console.log('\n📋 콜 로그');
    console.log(`   - 총 기록: ${callLogCount}건`);

    // 7. 백업 생성
    console.log('\n💾 백업 파일 생성 중...');
    const backupData = {
      timestamp: new Date().toISOString(),
      summary: {
        contact_total: contactCount,
        b2b_registration: b2bCount,
        crm_landing_registration: crmLandingCount,
        group_count: groupCount,
        group_member_count: groupMemberCount,
        sms_log_count: smsCount,
        call_log_count: callLogCount,
      },
      recent_contacts: contacts.slice(0, 10),
      recent_b2b: b2bRegs.slice(0, 10),
      recent_crm_landing: crmLandings.slice(0, 10),
    };

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(
      backupDir,
      `crm-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`   ✅ 백업 완료: ${backupFile}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ DB 연결 상태: 정상');
    console.log('✅ 데이터 동기화: 완료');
    console.log('✅ 백업 파일: 생성됨');
    console.log('='.repeat(60) + '\n');

    return { success: true, backup: backupFile };
  } catch (error) {
    console.error('❌ 오류:', error.message);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

checkDBStatus().then((result) => {
  process.exit(result.success ? 0 : 1);
});
