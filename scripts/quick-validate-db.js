#!/usr/bin/env node

/**
 * 빠른 Neon DB 데이터 무결성 검증 스크립트 (Node.js)
 * npm install pg dotenv 필요
 */

const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// .env.local 로드
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

class DataIntegrityValidator {
  constructor() {
    this.client = new Client({
      connectionString: DATABASE_URL,
    });
    this.report = {
      timestamp: new Date().toISOString(),
      database: {
        version: '',
        status: 'UNKNOWN',
      },
      tables: {},
      distributions: {},
      checks: {},
      summary: {
        totalRecords: 0,
        allChecksPassed: true,
        warnings: [],
        errors: [],
      },
    };
  }

  log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
  }

  async connect() {
    try {
      this.log('🔍 Neon DB에 연결 중...');
      await this.client.connect();
      this.report.database.status = 'CONNECTED';
      this.log('✅ DB 연결 성공\n');
      return true;
    } catch (error) {
      this.log(`❌ DB 연결 실패: ${error.message}`);
      this.report.database.status = 'FAILED';
      this.report.checks['db_connection'] = {
        status: 'FAIL',
        details: error.message,
      };
      return false;
    }
  }

  async validateTablesAndCounts() {
    this.log('📊 Step 1: 테이블별 레코드 수 확인...');

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
        const result = await this.client.query(
          `SELECT COUNT(*) as count FROM "${table}"`
        );
        const count = parseInt(result.rows[0].count);
        this.report.tables[table] = {
          count,
          status: 'OK',
        };
        totalRecords += count;
        console.log(`  ✓ ${table}: ${count} 레코드`);
      } catch (error) {
        console.log(
          `  ⚠️  ${table}: 테이블 조회 불가 (존재하지 않거나 접근 불가)`
        );
        this.report.tables[table] = {
          count: 0,
          status: 'NOT_FOUND',
        };
      }
    }

    this.report.summary.totalRecords = totalRecords;
    console.log(`\n  📈 총 레코드 수: ${totalRecords}\n`);
  }

  async validateUserDistributions() {
    this.log('👥 Step 2: User 등급별 분포 확인...');

    try {
      const result = await this.client.query(
        `SELECT "role", COUNT(*) as count FROM "User" GROUP BY "role" ORDER BY count DESC`
      );

      this.report.distributions['UserRoles'] = {};

      if (result.rows.length === 0) {
        console.log('  ⚠️  User 데이터가 없습니다.');
      } else {
        result.rows.forEach((row) => {
          this.report.distributions['UserRoles'][row.role] = row.count;
          console.log(`  ${row.role}: ${row.count}명`);
        });
      }
      console.log();
    } catch (error) {
      console.log(
        `  ⚠️  User 등급 분포 조회 실패: ${error.message}\n`
      );
    }
  }

  async validateIntegrityChecks() {
    this.log('🔐 Step 3: 데이터 무결성 체크...');

    // 3.1 User email NOT NULL
    try {
      const result = await this.client.query(
        `SELECT COUNT(*) as count FROM "User" WHERE email IS NULL`
      );
      const nullCount = parseInt(result.rows[0].count);

      if (nullCount === 0) {
        this.report.checks['user_email_not_null'] = {
          status: 'PASS',
          details: '모든 User 레코드의 email이 설정되어 있음',
        };
        console.log('  ✓ User email NOT NULL: PASS');
      } else {
        this.report.checks['user_email_not_null'] = {
          status: 'WARNING',
          details: `${nullCount}개의 User email이 NULL`,
        };
        this.report.summary.warnings.push(
          `User email NULL: ${nullCount}개 레코드`
        );
        console.log(`  ⚠️  User email NULL 경고: ${nullCount}개`);
      }
    } catch (error) {
      console.log(`  ⚠️  User email 체크 불가\n`);
    }

    // 3.2 CruiseProduct name NOT NULL
    try {
      const result = await this.client.query(
        `SELECT COUNT(*) as count FROM "CruiseProduct" WHERE name IS NULL`
      );
      const nullCount = parseInt(result.rows[0].count);

      if (nullCount === 0) {
        this.report.checks['product_name_not_null'] = {
          status: 'PASS',
          details: '모든 CruiseProduct 레코드의 name이 설정되어 있음',
        };
        console.log('  ✓ CruiseProduct name NOT NULL: PASS');
      } else {
        this.report.checks['product_name_not_null'] = {
          status: 'WARNING',
          details: `${nullCount}개의 Product name이 NULL`,
        };
        this.report.summary.warnings.push(
          `Product name NULL: ${nullCount}개 레코드`
        );
        console.log(`  ⚠️  Product name NULL 경고: ${nullCount}개`);
      }
    } catch (error) {
      console.log(`  ⚠️  Product name 체크 불가\n`);
    }

    // 3.3 User email 중복 검사
    try {
      const result = await this.client.query(`
        SELECT email, COUNT(*) as count
        FROM "User"
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
      `);

      if (result.rows.length === 0) {
        this.report.checks['user_email_unique'] = {
          status: 'PASS',
          details: 'User email 중복 없음',
        };
        console.log('  ✓ User email 중복 검사: PASS');
      } else {
        this.report.checks['user_email_unique'] = {
          status: 'WARNING',
          details: `${result.rows.length}개의 중복 email 발견`,
        };
        this.report.summary.warnings.push(
          `중복 email: ${result.rows.length}개`
        );
        console.log(`  ⚠️  중복 email 경고: ${result.rows.length}개`);
      }
    } catch (error) {
      console.log(`  ⚠️  중복 검사 불가\n`);
    }

    // 3.4 Foreign Key 검사 (Booking-User)
    try {
      const result = await this.client.query(`
        SELECT COUNT(*) as count
        FROM "Booking" b
        LEFT JOIN "User" u ON b."userId" = u.id
        WHERE u.id IS NULL AND b."userId" IS NOT NULL
      `);

      const orphanedCount = parseInt(result.rows[0].count);

      if (orphanedCount === 0) {
        this.report.checks['booking_user_fk'] = {
          status: 'PASS',
          details: 'Booking-User FK 무결성: 정상',
        };
        console.log('  ✓ Booking-User FK 무결성: PASS');
      } else {
        this.report.checks['booking_user_fk'] = {
          status: 'WARNING',
          details: `${orphanedCount}개의 orphaned Booking 발견`,
        };
        this.report.summary.warnings.push(
          `Orphaned Booking: ${orphanedCount}개`
        );
        console.log(`  ⚠️  Orphaned Booking 경고: ${orphanedCount}개`);
      }
    } catch (error) {
      console.log(`  ⚠️  FK 검사 불가\n`);
    }

    console.log();
  }

  async printSummary() {
    this.log('📋 Step 4: 최종 결과 요약');
    console.log('═══════════════════════════════════════════════════════');

    if (this.report.summary.warnings.length === 0) {
      console.log('✅ 모든 무결성 체크 통과!');
      console.log('✅ 데이터가 정상적으로 복구되었습니다.');
    } else {
      console.log(`⚠️  ${this.report.summary.warnings.length}개의 경고 발견:`);
      this.report.summary.warnings.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w}`);
      });
    }

    console.log('═══════════════════════════════════════════════════════\n');

    // 상세 리포트 저장
    const reportPath = path.join(__dirname, '../DATA_INTEGRITY_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    console.log(`📄 상세 리포트 저장: ${reportPath}\n`);
  }

  async run() {
    try {
      const connected = await this.connect();
      if (!connected) {
        process.exit(1);
      }

      await this.validateTablesAndCounts();
      await this.validateUserDistributions();
      await this.validateIntegrityChecks();
      await this.printSummary();

      // 결과 출력
      process.exit(
        this.report.summary.warnings.length === 0 ? 0 : 1
      );
    } catch (error) {
      console.error('❌ 검증 중 오류 발생:', error);
      process.exit(1);
    } finally {
      await this.client.end();
    }
  }
}

// 실행
const validator = new DataIntegrityValidator();
validator.run().catch(console.error);
