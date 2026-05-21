require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeContactUserId() {
  try {
    console.log('=== Contact 테이블 userId 상태 분석 ===\n');

    // 1. 전체 통계
    console.log('1️⃣ 전체 통계\n');
    const totalContacts = await prisma.contact.count();
    console.log(`총 Contact 건수: ${totalContacts}`);

    const contactsWithUserId = await prisma.contact.count({
      where: { userId: { not: null } }
    });
    console.log(`userId 설정된 건수: ${contactsWithUserId}`);

    const contactsWithoutUserId = await prisma.contact.count({
      where: { userId: null }
    });
    console.log(`userId NULL 건수: ${contactsWithoutUserId}`);

    const userIdSetRate = totalContacts > 0 ? ((contactsWithUserId / totalContacts) * 100).toFixed(2) : 0;
    const userIdNullRate = totalContacts > 0 ? ((contactsWithoutUserId / totalContacts) * 100).toFixed(2) : 0;
    console.log(`userId 설정률: ${userIdSetRate}% (NULL률: ${userIdNullRate}%)\n`);

    // 2. Phone 중복 분석
    console.log('2️⃣ Phone 중복 분석\n');
    const phoneDuplicates = await prisma.$queryRaw`
      SELECT phone, "organizationId", COUNT(*) as count
      FROM "Contact"
      WHERE "deletedAt" IS NULL
      GROUP BY phone, "organizationId"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `;
    console.log(`같은 phone+org 중복 Contact 그룹: ${phoneDuplicates.length}`);
    if (phoneDuplicates.length > 0) {
      console.log('TOP 5 중복 그룹:');
      phoneDuplicates.slice(0, 5).forEach(item => {
        console.log(`  - phone: ${item.phone.substring(0, 8)}... | org: ${item.organizationId.substring(0, 8)}... | 건수: ${item.count}`);
      });
    }
    const totalDuplicatePhones = phoneDuplicates.reduce((sum, item) => sum + (item.count - 1), 0);
    console.log(`총 중복 Contact (중복 부분): ${totalDuplicatePhones}\n`);

    // 3. userId 분포 (실제 값들)
    console.log('3️⃣ userId 분포 (상위 10개)\n');
    const userIdDistribution = await prisma.$queryRaw`
      SELECT "userId", COUNT(*) as count
      FROM "Contact"
      WHERE "userId" IS NOT NULL AND "deletedAt" IS NULL
      GROUP BY "userId"
      ORDER BY count DESC
      LIMIT 10
    `;
    console.log(`서로 다른 userId 개수: ${userIdDistribution.length}`);
    console.log('TOP 5 userId별 Contact 건수:');
    userIdDistribution.slice(0, 5).forEach(item => {
      console.log(`  - userId: ${item.userId} | 건수: ${item.count}`);
    });
    console.log('');

    // 4. Organization별 userId NULL 비율
    console.log('4️⃣ Organization별 userId 설정률\n');
    const orgStats = await prisma.$queryRaw`
      SELECT
        o.id,
        o.name,
        COUNT(c.id) as total,
        COUNT(CASE WHEN c."userId" IS NOT NULL THEN 1 END) as with_userId,
        COUNT(CASE WHEN c."userId" IS NULL THEN 1 END) as without_userId
      FROM "Contact" c
      JOIN "Organization" o ON c."organizationId" = o.id
      WHERE c."deletedAt" IS NULL
      GROUP BY o.id, o.name
      ORDER BY total DESC
      LIMIT 10
    `;
    console.log(`상위 10개 Organization (Contact 많은 순):}`);
    orgStats.forEach(org => {
      const rate = org.total > 0 ? ((org.with_userId / org.total) * 100).toFixed(1) : 0;
      console.log(`  - ${org.name}: 총 ${org.total} | userId 설정 ${org.with_userId} (${rate}%) | NULL ${org.without_userId}`);
    });
    console.log('');

    // 5. 고아 Contact (userId는 있는데 해당 Traveler 없음) - cruisedot 몰 기반
    console.log('5️⃣ 고아 Contact 분석 (userId 참조 문제)\n');
    const orphanedContacts = await prisma.$queryRaw`
      SELECT c.id, c.phone, c."userId", c.name
      FROM "Contact" c
      WHERE c."userId" IS NOT NULL
        AND c."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Traveler" t WHERE t.id = c."userId"
        )
      LIMIT 10
    `;
    console.log(`고아 Contact (userId는 있지만 Traveler 없음): ${orphanedContacts.length} (샘플: 최대 10개)`);
    if (orphanedContacts.length > 0) {
      orphanedContacts.forEach(contact => {
        console.log(`  - ID: ${contact.id.substring(0, 8)}... | phone: ${contact.phone.substring(0, 8)}... | userId: ${contact.userId} | name: ${contact.name}`);
      });
    }
    console.log('');

    // 6. 삭제된 Contact 통계
    console.log('6️⃣ 삭제된 Contact 통계\n');
    const deletedContacts = await prisma.contact.count({
      where: { deletedAt: { not: null } }
    });
    console.log(`소프트 삭제된 Contact: ${deletedContacts}`);
    console.log('');

    // 7. 수동 개입 필요 케이스
    console.log('7️⃣ 마이그레이션 전 검토 필요 케이스\n');

    // Case A: 같은 phone으로 여러 userId 가진 Contact
    const phoneMultipleUserIds = await prisma.$queryRaw`
      SELECT phone, "organizationId",
             COUNT(DISTINCT "userId") as distinct_userids,
             COUNT(*) as total_contacts
      FROM "Contact"
      WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
      GROUP BY phone, "organizationId"
      HAVING COUNT(DISTINCT "userId") > 1
      LIMIT 10
    `;
    console.log(`A) 같은 phone이지만 다른 userId 가진 Contact 그룹: ${phoneMultipleUserIds.length}`);
    if (phoneMultipleUserIds.length > 0) {
      phoneMultipleUserIds.forEach(item => {
        console.log(`   - phone: ${item.phone.substring(0, 8)}... | userIds개: ${item.distinct_userids} | Contact 건수: ${item.total_contacts}`);
      });
    }
    console.log('');

    // Case B: 최근 30일 동안 userId 없이 생성된 Contact
    const recentNoUserId = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Contact"
      WHERE "deletedAt" IS NULL
        AND "userId" IS NULL
        AND "createdAt" >= NOW() - INTERVAL '30 days'
    `;
    console.log(`B) 최근 30일 userId 없이 생성된 Contact: ${recentNoUserId[0].count}`);
    console.log('');

    // Case C: userId는 있지만 이름이 없는 Contact
    const noNameWithUserId = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "Contact"
      WHERE "deletedAt" IS NULL
        AND "userId" IS NOT NULL
        AND (name = '' OR name IS NULL)
    `;
    console.log(`C) userId는 있지만 name 없는 Contact: ${noNameWithUserId[0].count}`);
    console.log('');

    console.log('=== 분석 완료 ===');

  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeContactUserId();
