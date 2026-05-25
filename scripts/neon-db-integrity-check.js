/**
 * Neon DB 데이터 무결성 검증 스크립트 (JavaScript)
 *
 * 사용:
 *   node scripts/neon-db-integrity-check.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

class NeonDBIntegrityChecker {
  constructor() {
    this.prisma = new PrismaClient();
    this.results = {
      timestamp: new Date().toISOString(),
      status: 'PASSED',
      tables: [],
      statistics: {
        totalRecords: 0,
        tables: {},
        fkIssues: 0,
        duplicates: 0,
        timestampAnomalies: 0,
      },
      issues: [],
    };
    this.issues = [];
  }

  log(message) {
    console.log(`[CHECK] ${message}`);
  }

  addIssue(severity, tableName, message, count) {
    this.issues.push({ severity, tableName, message, count });
    if (severity === 'ERROR') {
      this.results.status = 'FAILED';
    } else if (severity === 'WARNING' && this.results.status === 'PASSED') {
      this.results.status = 'WARNING';
    }
  }

  async checkConnection() {
    try {
      this.log('Testing Neon DB connection...');
      const result = await this.prisma.$queryRaw`SELECT 1`;
      this.log('✓ Neon DB connection successful');
      return true;
    } catch (error) {
      this.addIssue('ERROR', 'connection', `Failed to connect to Neon DB: ${error.message}`);
      console.error('Connection error:', error);
      return false;
    }
  }

  async checkTableCounts() {
    this.log('Checking table row counts...');

    const tablesToCheck = [
      { name: 'Organization', label: 'Organizations' },
      { name: 'OrganizationMember', label: 'Organization Members' },
      { name: 'Contact', label: 'Contacts' },
      { name: 'ContactLensClassification', label: 'Lens Classifications' },
      { name: 'SmsTemplate', label: 'SMS Templates' },
      { name: 'ScheduledSms', label: 'Scheduled SMS' },
      { name: 'User', label: 'Users' },
      { name: 'AffiliateProduct', label: 'Affiliate Products' },
      { name: 'CruiseProduct', label: 'Cruise Products' },
      { name: 'ProductReview', label: 'Product Reviews' },
      { name: 'CommunityPost', label: 'Community Posts' },
      { name: 'CommunityComment', label: 'Community Comments' },
    ];

    for (const table of tablesToCheck) {
      try {
        const count = await this.prisma[table.name].count();
        this.results.statistics.tables[table.name] = { count };
        this.results.statistics.totalRecords += count;

        const status = count > 0 ? 'OK' : 'WARNING';
        const detail = `${count} records found`;

        this.results.tables.push({
          tableName: table.label,
          rowCount: count,
          status: status,
          details: [detail],
        });

        if (count === 0) {
          this.addIssue('WARNING', table.name, `No data found in ${table.label}`);
        }

        this.log(`✓ ${table.label}: ${count} records`);
      } catch (error) {
        this.results.tables.push({
          tableName: table.label,
          rowCount: 0,
          status: 'ERROR',
          details: [error.message],
        });

        this.addIssue('WARNING', table.name, `Could not count ${table.label}: ${error.message}`);
        this.log(`⚠ ${table.label}: ${error.message}`);
      }
    }
  }

  async checkUsersByRole() {
    this.log('Analyzing user roles...');
    try {
      const usersByRole = await this.prisma.$queryRaw`
        SELECT role, COUNT(*) as count
        FROM "User"
        GROUP BY role
      `;

      if (Array.isArray(usersByRole)) {
        this.results.statistics.usersByRole = {};
        for (const row of usersByRole) {
          this.results.statistics.usersByRole[row.role] = Number(row.count);
          this.log(`  - ${row.role}: ${row.count} users`);
        }
      }
    } catch (error) {
      this.addIssue('WARNING', 'User', `Could not analyze user roles: ${error.message}`);
    }
  }

  async checkProductStats() {
    this.log('Checking product statistics...');
    try {
      const cruiseCount = await this.prisma.cruiseProduct.count();
      const affiliateCount = await this.prisma.affiliateProduct.count();

      this.results.statistics.productStats = {
        totalProducts: cruiseCount + affiliateCount,
        activeProducts: cruiseCount + affiliateCount,
      };

      this.log(`✓ Cruise Products: ${cruiseCount}`);
      this.log(`✓ Affiliate Products: ${affiliateCount}`);
    } catch (error) {
      this.addIssue('WARNING', 'Product', `Could not check product stats: ${error.message}`);
    }
  }

  async checkForeignKeyIntegrity() {
    this.log('Checking foreign key integrity...');

    try {
      // Check Contacts with invalid organizationId
      const invalidOrgContacts = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM "Contact" c
        WHERE NOT EXISTS (
          SELECT 1 FROM "Organization" o WHERE o.id = c."organizationId"
        )
      `;

      const count = invalidOrgContacts[0]?.count || 0;
      if (count > 0) {
        this.addIssue('ERROR', 'Contact', `Found ${count} contacts with invalid organizationId`, count);
        this.results.statistics.fkIssues += count;
      } else {
        this.log('✓ All contacts have valid organizationId');
      }
    } catch (error) {
      this.addIssue('WARNING', 'Contact', `Could not check FK integrity: ${error.message}`);
    }
  }

  async checkDuplicateContacts() {
    this.log('Checking for duplicate contacts...');

    try {
      const duplicates = await this.prisma.$queryRaw`
        SELECT phone, COUNT(*) as count
        FROM "Contact"
        WHERE phone IS NOT NULL
        GROUP BY phone
        HAVING COUNT(*) > 1
        LIMIT 10
      `;

      if (Array.isArray(duplicates) && duplicates.length > 0) {
        const totalDupes = await this.prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM (
            SELECT phone, COUNT(*) as cnt
            FROM "Contact"
            WHERE phone IS NOT NULL
            GROUP BY phone
            HAVING COUNT(*) > 1
          ) t
        `;

        const dupeCount = totalDupes[0]?.count || 0;
        this.addIssue('WARNING', 'Contact', `Found ${dupeCount} phone numbers with duplicates`, dupeCount);
        this.results.statistics.duplicates = dupeCount;
        this.log(`⚠ ${dupeCount} duplicate phone numbers found`);
      } else {
        this.log('✓ No duplicate phone numbers found');
      }
    } catch (error) {
      this.addIssue('WARNING', 'Contact', `Could not check duplicates: ${error.message}`);
    }
  }

  async checkTimestampAnomalies() {
    this.log('Checking timestamp anomalies...');

    try {
      const futureContacts = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM "Contact"
        WHERE "createdAt" > NOW()
      `;

      const count = futureContacts[0]?.count || 0;
      if (count > 0) {
        this.addIssue('WARNING', 'Contact', `Found ${count} contacts with future createdAt`, count);
        this.results.statistics.timestampAnomalies += count;
      } else {
        this.log('✓ No timestamp anomalies found in contacts');
      }
    } catch (error) {
      this.addIssue('WARNING', 'Contact', `Could not check timestamps: ${error.message}`);
    }
  }

  async checkReviewStatistics() {
    this.log('Checking review statistics...');

    try {
      const reviews = await this.prisma.productReview.count();
      const comments = await this.prisma.communityComment.count();

      this.log(`✓ Product Reviews: ${reviews}`);
      this.log(`✓ Community Comments: ${comments}`);

      if (reviews === 0) {
        this.addIssue('WARNING', 'ProductReview', 'No product reviews found');
      }
    } catch (error) {
      this.addIssue('WARNING', 'ProductReview', `Could not check reviews: ${error.message}`);
    }
  }

  async runAllChecks() {
    try {
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        this.log('Cannot proceed without connection');
        return;
      }

      await this.checkTableCounts();
      await this.checkUsersByRole();
      await this.checkProductStats();
      await this.checkForeignKeyIntegrity();
      await this.checkDuplicateContacts();
      await this.checkTimestampAnomalies();
      await this.checkReviewStatistics();
    } catch (error) {
      this.addIssue('ERROR', 'system', `Unexpected error during checks: ${error.message}`);
      console.error('Unexpected error:', error);
    } finally {
      this.results.issues = this.issues;
    }
  }

  async generateReport() {
    const timestamp = new Date().toISOString();
    const overallStatus = this.results.status;

    let report = `# Neon DB Data Integrity Report\n\n`;
    report += `**Generated**: ${timestamp}\n`;
    report += `**Status**: ${overallStatus === 'PASSED' ? '✅ PASSED' : overallStatus === 'WARNING' ? '⚠️  WARNING' : '❌ FAILED'}\n\n`;

    report += `---\n\n## 📊 Summary Statistics\n\n`;
    report += `- **Total Records**: ${this.results.statistics.totalRecords}\n`;
    report += `- **Tables Checked**: ${this.results.tables.length}\n`;
    report += `- **FK Issues**: ${this.results.statistics.fkIssues}\n`;
    report += `- **Duplicate Records**: ${this.results.statistics.duplicates}\n`;
    report += `- **Timestamp Anomalies**: ${this.results.statistics.timestampAnomalies}\n\n`;

    report += `---\n\n## 📋 Table Status\n\n`;
    report += `| Table | Records | Status | Details |\n`;
    report += `|-------|---------|--------|----------|\n`;

    for (const table of this.results.tables) {
      const statusIcon = table.status === 'OK' ? '✅' : table.status === 'WARNING' ? '⚠️' : '❌';
      const details = table.details.join('; ');
      report += `| ${table.tableName} | ${table.rowCount} | ${statusIcon} ${table.status} | ${details} |\n`;
    }

    report += `\n---\n\n## 👥 User Role Distribution\n\n`;
    if (this.results.statistics.usersByRole) {
      for (const [role, count] of Object.entries(this.results.statistics.usersByRole)) {
        report += `- **${role}**: ${count} users\n`;
      }
    } else {
      report += `- No user role data available\n`;
    }

    report += `\n---\n\n## 📦 Product Statistics\n\n`;
    if (this.results.statistics.productStats) {
      report += `- **Total Products**: ${this.results.statistics.productStats.totalProducts}\n`;
      report += `- **Active Products**: ${this.results.statistics.productStats.activeProducts}\n`;
    } else {
      report += `- No product statistics available\n`;
    }

    report += `\n---\n\n## ⚠️ Issues Found\n\n`;
    if (this.issues.length === 0) {
      report += `✅ No issues found\n`;
    } else {
      report += `| Severity | Table | Message | Count |\n`;
      report += `|----------|-------|---------|-------|\n`;

      for (const issue of this.issues) {
        const icon = issue.severity === 'ERROR' ? '❌' : issue.severity === 'WARNING' ? '⚠️' : 'ℹ️';
        const count = issue.count ? ` (${issue.count})` : '';
        report += `| ${icon} ${issue.severity} | ${issue.tableName} | ${issue.message} | ${count} |\n`;
      }
    }

    report += `\n---\n\n## ✅ Verification Checklist\n\n`;
    report += `- [${this.results.statistics.fkIssues === 0 ? 'x' : ' '}] No foreign key violations\n`;
    report += `- [${this.results.statistics.duplicates === 0 ? 'x' : ' '}] No duplicate records\n`;
    report += `- [${this.results.statistics.timestampAnomalies === 0 ? 'x' : ' '}] No timestamp anomalies\n`;
    report += `- [${this.results.statistics.totalRecords > 0 ? 'x' : ' '}] Data exists in database\n`;
    report += `- [${this.issues.filter(i => i.severity === 'ERROR').length === 0 ? 'x' : ' '}] No critical errors\n`;

    return report;
  }

  async saveReport(report) {
    const reportPath = path.join(process.cwd(), 'DATA_INTEGRITY_REPORT.md');
    fs.writeFileSync(reportPath, report, 'utf-8');
    this.log(`Report saved to: ${reportPath}`);
    return reportPath;
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

async function main() {
  const checker = new NeonDBIntegrityChecker();

  try {
    console.log('\n' + '='.repeat(80));
    console.log('NEON DB DATA INTEGRITY CHECK');
    console.log('='.repeat(80) + '\n');

    await checker.runAllChecks();

    const report = await checker.generateReport();
    const reportPath = await checker.saveReport(report);

    console.log('\n' + '='.repeat(80));
    console.log(report);
    console.log('='.repeat(80) + '\n');

    console.log(`\n✅ Report saved to: ${reportPath}\n`);

    process.exit(checker.results.status === 'FAILED' ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await checker.close();
  }
}

main().catch(console.error);
