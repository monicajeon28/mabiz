/**
 * Neon DB 무결성 검증 - PostgreSQL 드라이버 직접 사용
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

class NeonIntegrityCheck {
  constructor() {
    this.client = new Client({ connectionString: dbUrl });
    this.results = {
      timestamp: new Date().toISOString(),
      status: 'PASSED',
      tables: [],
      statistics: {
        totalRecords: 0,
        tables: {},
        fkIssues: 0,
        duplicates: 0,
      },
      issues: [],
    };
  }

  log(msg) {
    console.log(`[CHECK] ${msg}`);
  }

  addIssue(severity, table, msg, count = 0) {
    this.results.issues.push({ severity, table, msg, count });
    if (severity === 'ERROR') this.results.status = 'FAILED';
    else if (severity === 'WARNING' && this.results.status === 'PASSED') this.results.status = 'WARNING';
  }

  async connect() {
    try {
      this.log('Connecting to Neon DB...');
      await this.client.connect();
      this.log('✓ Connected successfully');
      return true;
    } catch (err) {
      this.addIssue('ERROR', 'connection', `Connection failed: ${err.message}`);
      console.error('Connection error:', err);
      return false;
    }
  }

  async checkTableCounts() {
    this.log('Checking table row counts...');

    const tables = [
      { name: 'Organization', label: 'Organizations' },
      { name: 'Contact', label: 'Contacts' },
      { name: 'User', label: 'Users' },
      { name: 'CruiseProduct', label: 'Cruise Products' },
      { name: 'AffiliateProduct', label: 'Affiliate Products' },
      { name: 'ProductReview', label: 'Product Reviews' },
      { name: 'CommunityPost', label: 'Community Posts' },
      { name: 'SmsTemplate', label: 'SMS Templates' },
    ];

    for (const tbl of tables) {
      try {
        const result = await this.client.query(`SELECT COUNT(*) as count FROM "${tbl.name}"`);
        const count = parseInt(result.rows[0].count);
        this.results.statistics.tables[tbl.name] = count;
        this.results.statistics.totalRecords += count;

        const status = count > 0 ? 'OK' : 'WARNING';
        this.results.tables.push({ table: tbl.label, count, status });

        if (count === 0) {
          this.addIssue('WARNING', tbl.name, `No data found`);
        }

        this.log(`✓ ${tbl.label}: ${count}`);
      } catch (err) {
        this.addIssue('WARNING', tbl.name, err.message);
        this.log(`⚠ ${tbl.label}: ${err.message}`);
      }
    }
  }

  async checkUserRoles() {
    this.log('Analyzing user roles...');
    try {
      const result = await this.client.query(`
        SELECT role, COUNT(*) as count FROM "User" GROUP BY role
      `);
      this.results.statistics.usersByRole = {};
      result.rows.forEach(row => {
        this.results.statistics.usersByRole[row.role] = parseInt(row.count);
        this.log(`  - ${row.role}: ${row.count}`);
      });
    } catch (err) {
      this.addIssue('WARNING', 'User', `Could not analyze roles: ${err.message}`);
    }
  }

  async checkFK() {
    this.log('Checking foreign key integrity...');
    try {
      const result = await this.client.query(`
        SELECT COUNT(*) as count FROM "Contact" c
        WHERE NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o.id = c."organizationId")
      `);
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        this.addIssue('ERROR', 'Contact', `Invalid organizationId references`, count);
        this.results.statistics.fkIssues = count;
      } else {
        this.log('✓ No FK violations');
      }
    } catch (err) {
      this.addIssue('WARNING', 'Contact', `FK check failed: ${err.message}`);
    }
  }

  async checkDuplicates() {
    this.log('Checking for duplicates...');
    try {
      const result = await this.client.query(`
        SELECT COUNT(*) as count FROM (
          SELECT phone FROM "Contact" WHERE phone IS NOT NULL
          GROUP BY phone HAVING COUNT(*) > 1
        ) t
      `);
      const count = parseInt(result.rows[0].count);
      if (count > 0) {
        this.addIssue('WARNING', 'Contact', `Duplicate phone numbers`, count);
        this.results.statistics.duplicates = count;
      } else {
        this.log('✓ No duplicates');
      }
    } catch (err) {
      this.addIssue('WARNING', 'Contact', `Duplicate check failed: ${err.message}`);
    }
  }

  async runAllChecks() {
    await this.checkTableCounts();
    await this.checkUserRoles();
    await this.checkFK();
    await this.checkDuplicates();
  }

  generateReport() {
    let report = `# Neon DB Data Integrity Report\n\n`;
    report += `**Generated**: ${this.results.timestamp}\n`;
    report += `**Status**: ${this.results.status === 'PASSED' ? '✅ PASSED' : this.results.status === 'WARNING' ? '⚠️  WARNING' : '❌ FAILED'}\n\n`;

    report += `---\n\n## 📊 Summary\n\n`;
    report += `- **Total Records**: ${this.results.statistics.totalRecords}\n`;
    report += `- **FK Issues**: ${this.results.statistics.fkIssues}\n`;
    report += `- **Duplicates**: ${this.results.statistics.duplicates}\n\n`;

    report += `---\n\n## 📋 Table Status\n\n`;
    report += `| Table | Records | Status |\n`;
    report += `|-------|---------|--------|\n`;
    this.results.tables.forEach(t => {
      const icon = t.status === 'OK' ? '✅' : '⚠️';
      report += `| ${t.table} | ${t.count} | ${icon} ${t.status} |\n`;
    });

    if (this.results.statistics.usersByRole) {
      report += `\n---\n\n## 👥 User Roles\n\n`;
      Object.entries(this.results.statistics.usersByRole).forEach(([role, count]) => {
        report += `- **${role}**: ${count}\n`;
      });
    }

    if (this.results.issues.length > 0) {
      report += `\n---\n\n## ⚠️ Issues\n\n`;
      this.results.issues.forEach(issue => {
        const icon = issue.severity === 'ERROR' ? '❌' : '⚠️';
        report += `- ${icon} **${issue.table}**: ${issue.msg}`;
        if (issue.count) report += ` (${issue.count})`;
        report += `\n`;
      });
    }

    return report;
  }

  async close() {
    await this.client.end();
  }
}

async function main() {
  const checker = new NeonIntegrityCheck();

  try {
    console.log('\n' + '='.repeat(80));
    console.log('NEON DB DATA INTEGRITY CHECK');
    console.log('='.repeat(80) + '\n');

    const connected = await checker.connect();
    if (!connected) {
      process.exit(1);
    }

    await checker.runAllChecks();

    const report = checker.generateReport();
    const reportPath = path.join(process.cwd(), 'DATA_INTEGRITY_REPORT.md');
    fs.writeFileSync(reportPath, report);

    console.log('\n' + '='.repeat(80));
    console.log(report);
    console.log('='.repeat(80) + '\n');

    console.log(`✅ Report saved to: ${reportPath}\n`);

    process.exit(checker.results.status === 'FAILED' ? 1 : 0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await checker.close();
  }
}

main();
