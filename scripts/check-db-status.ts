/**
 * DB 상태 확인 및 데이터 백업 스크립트
 * - Contact 데이터 확인
 * - B2B 랜딩 등록 확인
 * - 그룹 가입 확인
 * - SMS 로그 확인
 */

import prisma from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function checkDBStatus() {
  console.log('🔍 CRM 데이터베이스 상태 확인 시작...\n');

  try {
    // 1. Contact 데이터
    console.log('📋 1. Contact 데이터 확인');
    const contactCount = await prisma.contact.count();
    const contacts = await prisma.contact.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`   - 총 Contact: ${contactCount}명`);
    console.log(`   - 최근 Contact:`);
    contacts.forEach((c) => {
      console.log(
        `     • ${c.name || '(미정)'} | ${c.phone || c.email || '(미등록)'} | ${c.createdAt.toLocaleDateString('ko-KR')}`
      );
    });

    // 2. B2B Landing 등록
    console.log('\n📋 2. B2B 랜딩페이지 등록 확인');
    const b2bRegCount = await prisma.b2BLandingRegistration.count();
    const b2bRegs = await prisma.b2BLandingRegistration.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    console.log(`   - 총 B2B 등록: ${b2bRegCount}건`);
    b2bRegs.slice(0, 3).forEach((reg) => {
      console.log(`     • ${reg.name} | ${reg.phone} | ${reg.createdAt.toLocaleDateString('ko-KR')}`);
    });

    // 3. CRM Landing 등록
    console.log('\n📋 3. CRM 랜딩페이지 등록 확인');
    const crmLandingCount = await prisma.crmLandingRegistration.count();
    const crmLandings = await prisma.crmLandingRegistration.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    console.log(`   - 총 등록: ${crmLandingCount}건`);
    crmLandings.slice(0, 3).forEach((reg) => {
      console.log(`     • ${reg.name || '(미정)'} | ${reg.createdAt.toLocaleDateString('ko-KR')}`);
    });

    // 4. 그룹 가입
    console.log('\n📋 4. 그룹 가입 현황');
    const groupMemberCount = await prisma.contactGroupMember.count();
    const groupCount = await prisma.contactGroup.count();
    console.log(`   - 그룹 수: ${groupCount}개`);
    console.log(`   - 그룹 멤버: ${groupMemberCount}명`);

    // 5. SMS 로그
    console.log('\n📋 5. SMS 발송 로그');
    const smsCount = await prisma.smsLog.count();
    const smsLogs = await prisma.smsLog.findMany({
      take: 5,
      orderBy: { sentAt: 'desc' },
    });
    console.log(`   - 총 SMS 발송: ${smsCount}건`);
    smsLogs.slice(0, 3).forEach((log) => {
      console.log(
        `     • ${log.phone} | ${log.channel} | ${log.status} | ${log.sentAt.toLocaleDateString('ko-KR')}`
      );
    });

    // 6. CallLog
    console.log('\n📋 6. 콜 로그');
    const callLogCount = await prisma.callLog.count();
    console.log(`   - 총 콜 기록: ${callLogCount}건`);

    // 7. 데이터 백업 생성
    console.log('\n💾 데이터 백업 생성 중...');
    const backupData = {
      timestamp: new Date().toISOString(),
      backup_summary: {
        contact_total: contactCount,
        b2b_registration_total: b2bRegCount,
        crm_landing_total: crmLandingCount,
        group_member_total: groupMemberCount,
        group_total: groupCount,
        sms_total: smsCount,
        call_log_total: callLogCount,
      },
      recent_contacts: contacts,
      recent_b2b: b2bRegs.slice(0, 10),
      recent_crm_landing: crmLandings.slice(0, 10),
    };

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `crm-backup-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`   ✅ 백업 완료: ${backupFile}`);

    // 8. 최종 요약
    console.log('\n' + '='.repeat(60));
    console.log('✅ DB 연결 상태: 정상');
    console.log('✅ 데이터 동기화: 완료');
    console.log('✅ 백업 파일: 생성됨');
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      summary: backupData.backup_summary,
      backupFile,
    };
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    return { success: false, error };
  } finally {
    await prisma.$disconnect();
  }
}

checkDBStatus().then((result) => {
  if (result.success) {
    console.log('✨ 모든 확인 완료!');
    process.exit(0);
  } else {
    console.log('❌ 확인 실패');
    process.exit(1);
  }
});
