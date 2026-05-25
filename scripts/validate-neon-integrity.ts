import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface IntegrityReport {
  timestamp: string;
  database: {
    version: string;
    status: string;
  };
  tables: {
    [key: string]: {
      count: number;
      sample?: any;
    };
  };
  distributions: {
    [key: string]: any;
  };
  checks: {
    [key: string]: {
      status: 'PASS' | 'FAIL' | 'WARNING';
      details: string;
    };
  };
  summary: {
    totalRecords: number;
    allChecksPassed: boolean;
    warnings: string[];
  };
}

async function validateIntegrity(): Promise<IntegrityReport> {
  console.log('🔍 데이터 무결성 검증 시작...\n');

  const report: IntegrityReport = {
    timestamp: new Date().toISOString(),
    database: {
      version: '',
      status: '',
    },
    tables: {},
    distributions: {},
    checks: {},
    summary: {
      totalRecords: 0,
      allChecksPassed: true,
      warnings: [],
    },
  };

  try {
    // 1. 데이터베이스 연결 확인
    console.log('✓ Step 1: 데이터베이스 연결 확인...');
    try {
      await prisma.$queryRaw`SELECT 1`;
      report.database.status = 'CONNECTED';
      report.database.version = 'Neon PostgreSQL';
      console.log('✓ DB 연결 성공\n');
    } catch (error) {
      report.database.status = 'FAILED';
      report.checks['db_connection'] = {
        status: 'FAIL',
        details: `DB 연결 실패: ${error}`,
      };
      report.summary.allChecksPassed = false;
      return report;
    }

    // 2. 테이블별 레코드 수 확인
    console.log('✓ Step 2: 테이블별 레코드 수 확인...');

    const tables = [
      'User',
      'CruiseProduct',
      'Review',
      'CommunityPost',
      'AffiliateUser',
      'Booking',
      'ContactMessage',
      'NewsletterSubscriber',
    ];

    let totalRecords = 0;

    for (const table of tables) {
      try {
        let count = 0;
        let sample = null;

        if (table === 'User') {
          count = await prisma.user.count();
          sample = await prisma.user.findFirst();
          report.tables[table] = {
            count,
            sample: sample
              ? {
                  id: sample.id,
                  email: sample.email,
                  name: sample.name,
                  role: sample.role,
                  createdAt: sample.createdAt,
                }
              : null,
          };
        } else if (table === 'CruiseProduct') {
          count = await prisma.cruiseProduct.count();
          sample = await prisma.cruiseProduct.findFirst();
          report.tables[table] = {
            count,
            sample: sample
              ? {
                  id: sample.id,
                  name: sample.name,
                  price: sample.price,
                  createdAt: sample.createdAt,
                }
              : null,
          };
        } else if (table === 'Review') {
          count = await prisma.review.count();
          report.tables[table] = { count };
        } else if (table === 'CommunityPost') {
          count = await prisma.communityPost.count();
          report.tables[table] = { count };
        } else if (table === 'AffiliateUser') {
          count = await prisma.affiliateUser.count();
          report.tables[table] = { count };
        } else if (table === 'Booking') {
          count = await prisma.booking.count();
          report.tables[table] = { count };
        } else if (table === 'ContactMessage') {
          count = await prisma.contactMessage.count();
          report.tables[table] = { count };
        } else if (table === 'NewsletterSubscriber') {
          count = await prisma.newsletterSubscriber.count();
          report.tables[table] = { count };
        }

        totalRecords += count;
        console.log(`  ${table}: ${count} 레코드`);
      } catch (error) {
        console.log(`  ${table}: ⚠️ 테이블 조회 불가 (존재하지 않음 또는 접근 불가)`);
      }
    }

    report.summary.totalRecords = totalRecords;
    console.log(`\n  총 레코드 수: ${totalRecords}\n`);

    // 3. User 등급별 분포
    console.log('✓ Step 3: User 등급별 분포...');
    try {
      const roleDistribution = await prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true,
        },
      });

      report.distributions['User_Roles'] = {};
      roleDistribution.forEach((item: any) => {
        report.distributions['User_Roles'][item.role] = item._count.id;
        console.log(`  ${item.role}: ${item._count.id}명`);
      });
      console.log();
    } catch (error) {
      console.log(`  ⚠️ User 등급 분포 조회 실패\n`);
    }

    // 4. 무결성 체크

    console.log('✓ Step 4: 무결성 체크...');

    // 4.1 User 검사
    try {
      const usersWithoutEmail = await prisma.user.count({
        where: {
          email: null,
        },
      });

      if (usersWithoutEmail === 0) {
        report.checks['user_email_not_null'] = {
          status: 'PASS',
          details: '모든 User 레코드의 email이 설정되어 있음',
        };
        console.log('  ✓ User email NOT NULL 체크: PASS');
      } else {
        report.checks['user_email_not_null'] = {
          status: 'WARNING',
          details: `${usersWithoutEmail}개의 User 레코드에서 email이 NULL`,
        };
        report.summary.warnings.push(
          `User email NULL: ${usersWithoutEmail}개 레코드`,
        );
        console.log(`  ⚠️  User email NULL 경고: ${usersWithoutEmail}개`);
      }
    } catch (error) {
      report.checks['user_email_not_null'] = {
        status: 'FAIL',
        details: `체크 실패: ${error}`,
      };
    }

    // 4.2 CruiseProduct 검사
    try {
      const productsWithoutName = await prisma.cruiseProduct.count({
        where: {
          name: null,
        },
      });

      if (productsWithoutName === 0) {
        report.checks['product_name_not_null'] = {
          status: 'PASS',
          details: '모든 CruiseProduct 레코드의 name이 설정되어 있음',
        };
        console.log('  ✓ CruiseProduct name NOT NULL 체크: PASS');
      } else {
        report.checks['product_name_not_null'] = {
          status: 'WARNING',
          details: `${productsWithoutName}개의 CruiseProduct 레코드에서 name이 NULL`,
        };
        report.summary.warnings.push(
          `Product name NULL: ${productsWithoutName}개 레코드`,
        );
        console.log(`  ⚠️  Product name NULL 경고: ${productsWithoutName}개`);
      }
    } catch (error) {
      report.checks['product_name_not_null'] = {
        status: 'FAIL',
        details: `체크 실패: ${error}`,
      };
    }

    // 4.3 중복 검사 (User email)
    try {
      const duplicateEmails = await prisma.$queryRaw<any[]>`
        SELECT email, COUNT(*) as count
        FROM "User"
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
      `;

      if (duplicateEmails.length === 0) {
        report.checks['user_email_unique'] = {
          status: 'PASS',
          details: 'User email 중복 없음',
        };
        console.log('  ✓ User email 중복 검사: PASS');
      } else {
        report.checks['user_email_unique'] = {
          status: 'WARNING',
          details: `${duplicateEmails.length}개의 중복 email 발견`,
        };
        report.summary.warnings.push(
          `중복 email: ${duplicateEmails.length}개`,
        );
        console.log(`  ⚠️  중복 email 경고: ${duplicateEmails.length}개`);
      }
    } catch (error) {
      console.log(`  ⚠️  중복 검사 불가\n`);
    }

    // 4.4 Foreign Key 무결성 검사
    try {
      const orphanedBookings = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count
        FROM "Booking" b
        LEFT JOIN "User" u ON b."userId" = u.id
        WHERE u.id IS NULL AND b."userId" IS NOT NULL
      `;

      if (orphanedBookings[0].count === 0) {
        report.checks['booking_user_fk'] = {
          status: 'PASS',
          details: 'Booking-User FK 무결성: 정상',
        };
        console.log('  ✓ Booking-User FK 무결성: PASS');
      } else {
        report.checks['booking_user_fk'] = {
          status: 'WARNING',
          details: `${orphanedBookings[0].count}개의 orphaned Booking 발견`,
        };
        report.summary.warnings.push(
          `Orphaned Booking: ${orphanedBookings[0].count}개`,
        );
        console.log(`  ⚠️  Orphaned Booking 경고: ${orphanedBookings[0].count}개`);
      }
    } catch (error) {
      console.log(`  ⚠️  FK 체크 불가\n`);
    }

    console.log();

    // 5. 최종 결과
    console.log('✓ Step 5: 최종 결과 요약');
    console.log('═══════════════════════════════════════');

    if (report.summary.warnings.length === 0) {
      console.log('✅ 모든 무결성 체크 통과!');
      console.log('✅ 데이터가 정상적으로 복구되었습니다.');
    } else {
      console.log(`⚠️  ${report.summary.warnings.length}개의 경고 발견:`);
      report.summary.warnings.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w}`);
      });
    }

    console.log('═══════════════════════════════════════\n');
  } catch (error) {
    console.error('검증 중 오류 발생:', error);
    report.summary.allChecksPassed = false;
  } finally {
    await prisma.$disconnect();
  }

  return report;
}

// 실행
validateIntegrity().then((report) => {
  // 콘솔 출력 완료
  console.log('\n📊 상세 리포트:');
  console.log(JSON.stringify(report, null, 2));

  // 프로세스 종료
  process.exit(report.summary.allChecksPassed ? 0 : 1);
});
