#!/usr/bin/env node

import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const reportPath = path.join(process.cwd(), 'TASK2_STEP1_DATA_VALIDATION_REPORT.md');

const report = {
  timestamp: new Date().toISOString(),
  checks: [],
  summary: {
    p0Issues: [],
    p1Issues: [],
    p2Issues: [],
  },
};

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function runValidation() {
  console.log('Starting GmReservation Data Consistency Review...\n');

  // Check 1: 기본 통계
  console.log('1️⃣ GmReservation 기본 통계 검토');
  try {
    const stats = await query(`
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN "tripId" IS NULL THEN 1 END) as null_tripid_count,
        COUNT(CASE WHEN "mainUserId" IS NULL THEN 1 END) as null_mailuserid_count,
        COUNT(DISTINCT "tripId") as unique_trip_count,
        COUNT(DISTINCT "mainUserId") as unique_user_count
      FROM "Reservation"
    `);

    const stat = stats[0];
    console.log(`   - Total Reservations: ${stat.total_count}`);
    console.log(`   - NULL tripId: ${stat.null_tripid_count}`);
    console.log(`   - NULL mainUserId: ${stat.null_mailuserid_count}`);
    console.log(`   - Unique Trips: ${stat.unique_trip_count}`);
    console.log(`   - Unique Users: ${stat.unique_user_count}\n`);

    report.checks.push({
      name: 'Basic Statistics',
      status: 'OK',
      data: stat,
    });

    if (stat.null_tripid_count > 0 || stat.null_mailuserid_count > 0) {
      report.summary.p1Issues.push(
        `Found ${stat.null_tripid_count} reservations with NULL tripId`,
      );
      report.summary.p1Issues.push(
        `Found ${stat.null_mailuserid_count} reservations with NULL mainUserId`,
      );
    }
  } catch (e) {
    console.error('❌ Error in basic statistics:', e.message);
    report.checks.push({
      name: 'Basic Statistics',
      status: 'ERROR',
      error: e.message,
    });
  }

  // Check 2: Orphaned Records (FK 위반 위험)
  console.log('2️⃣ Orphaned Records 검토 (FK 참조 무결성)');
  try {
    const orphanedTrips = await query(`
      SELECT COUNT(*) as count, COUNT(DISTINCT r."tripId") as unique_trips
      FROM "Reservation" r
      LEFT JOIN "Trip" t ON r."tripId" = t.id
      WHERE r."tripId" IS NOT NULL AND t.id IS NULL
    `);

    const orphanedUsers = await query(`
      SELECT COUNT(*) as count, COUNT(DISTINCT r."mainUserId") as unique_users
      FROM "Reservation" r
      LEFT JOIN "User" u ON r."mainUserId" = u.id
      WHERE r."mainUserId" IS NOT NULL AND u.id IS NULL
    `);

    console.log(`   - Orphaned Reservations (missing Trip): ${orphanedTrips[0].count}`);
    console.log(`   - Unique orphaned trips: ${orphanedTrips[0].unique_trips}`);
    console.log(`   - Orphaned Reservations (missing User): ${orphanedUsers[0].count}`);
    console.log(`   - Unique orphaned users: ${orphanedUsers[0].unique_users}\n`);

    report.checks.push({
      name: 'Orphaned Records',
      status: 'OK',
      data: {
        orphanedTrips: orphanedTrips[0],
        orphanedUsers: orphanedUsers[0],
      },
    });

    if (orphanedTrips[0].count > 0) {
      report.summary.p0Issues.push(
        `CRITICAL: ${orphanedTrips[0].count} reservations reference non-existent trips`,
      );
    }
    if (orphanedUsers[0].count > 0) {
      report.summary.p0Issues.push(
        `CRITICAL: ${orphanedUsers[0].count} reservations reference non-existent users`,
      );
    }
  } catch (e) {
    console.error('❌ Error checking orphaned records:', e.message);
    report.checks.push({
      name: 'Orphaned Records',
      status: 'ERROR',
      error: e.message,
    });
  }

  // Check 3: Duplicate Records 분석
  console.log('3️⃣ Duplicate Records 검토');
  try {
    const duplicateTripUser = await query(`
      SELECT "tripId", "mainUserId", COUNT(*) as count
      FROM "Reservation"
      GROUP BY "tripId", "mainUserId"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `);

    console.log(`   - Reservations with same (tripId, mainUserId): ${duplicateTripUser.length}`);
    if (duplicateTripUser.length > 0) {
      console.log('   - Top duplicates:');
      duplicateTripUser.forEach((row) => {
        console.log(
          `     • Trip ${row.tripId}, User ${row.mainUserId}: ${row.count} records`,
        );
      });
    }
    console.log();

    report.checks.push({
      name: 'Duplicate Records',
      status: 'OK',
      data: {
        duplicatesCount: duplicateTripUser.length,
        details: duplicateTripUser,
      },
    });

    if (duplicateTripUser.length > 0) {
      report.summary.p1Issues.push(
        `Found ${duplicateTripUser.length} groups with duplicate (tripId, mainUserId) combinations`,
      );
    }
  } catch (e) {
    console.error('❌ Error checking duplicate records:', e.message);
    report.checks.push({
      name: 'Duplicate Records',
      status: 'ERROR',
      error: e.message,
    });
  }

  // Check 4: Cascade Delete 영향도 분석
  console.log('4️⃣ Cascade Delete 영향도 분석');
  try {
    const tripDeletionImpact = await query(`
      SELECT
        COUNT(DISTINCT t.id) as affected_trips,
        COUNT(r.id) as affected_reservations,
        MIN(r.id) as first_reservation_id,
        MAX(r.id) as last_reservation_id
      FROM "Trip" t
      JOIN "Reservation" r ON t.id = r."tripId"
    `);

    const userDeletionImpact = await query(`
      SELECT
        COUNT(DISTINCT u.id) as affected_users,
        COUNT(r.id) as affected_reservations,
        MIN(r.id) as first_reservation_id,
        MAX(r.id) as last_reservation_id
      FROM "User" u
      JOIN "Reservation" r ON u.id = r."mainUserId"
    `);

    console.log(`   Trip Cascade Impact:`);
    console.log(`   - Active trips with reservations: ${tripDeletionImpact[0].affected_trips}`);
    console.log(
      `   - Total reservations affected: ${tripDeletionImpact[0].affected_reservations}`,
    );
    console.log();
    console.log(`   User Cascade Impact:`);
    console.log(`   - Users with reservations: ${userDeletionImpact[0].affected_users}`);
    console.log(
      `   - Total reservations affected: ${userDeletionImpact[0].affected_reservations}`,
    );
    console.log();

    report.checks.push({
      name: 'Cascade Delete Impact',
      status: 'OK',
      data: {
        tripImpact: tripDeletionImpact[0],
        userImpact: userDeletionImpact[0],
      },
    });

    report.summary.p2Issues.push(
      `Trip deletion cascade: ${tripDeletionImpact[0].affected_reservations} reservations at risk`,
    );
    report.summary.p2Issues.push(
      `User deletion cascade: ${userDeletionImpact[0].affected_reservations} reservations at risk`,
    );
  } catch (e) {
    console.error('❌ Error analyzing cascade impact:', e.message);
    report.checks.push({
      name: 'Cascade Delete Impact',
      status: 'ERROR',
      error: e.message,
    });
  }

  // Check 5: Reservation 상태 분포
  console.log('5️⃣ Reservation Status 분포');
  try {
    const statusDistribution = await query(`
      SELECT status, COUNT(*) as count
      FROM "Reservation"
      GROUP BY status
      ORDER BY count DESC
    `);

    statusDistribution.forEach((row) => {
      console.log(`   - ${row.status}: ${row.count}`);
    });
    console.log();

    report.checks.push({
      name: 'Status Distribution',
      status: 'OK',
      data: statusDistribution,
    });
  } catch (e) {
    console.error('❌ Error checking status distribution:', e.message);
    report.checks.push({
      name: 'Status Distribution',
      status: 'ERROR',
      error: e.message,
    });
  }

  // Check 6: 스키마 제약 조건 확인
  console.log('6️⃣ Schema Constraint Check');
  try {
    const constraints = await query(`
      SELECT
        constraint_name,
        constraint_type,
        table_name
      FROM information_schema.table_constraints
      WHERE table_name = 'Reservation'
      ORDER BY constraint_type
    `);

    console.log(`   - Total constraints: ${constraints.length}`);
    constraints.forEach((row) => {
      console.log(`     • ${row.constraint_type}: ${row.constraint_name}`);
    });
    console.log();

    report.checks.push({
      name: 'Schema Constraints',
      status: 'OK',
      data: constraints,
    });
  } catch (e) {
    console.error('❌ Error checking schema constraints:', e.message);
    report.checks.push({
      name: 'Schema Constraints',
      status: 'ERROR',
      error: e.message,
    });
  }

  // Summary
  console.log('═════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═════════════════════════════════════════════');
  console.log(`P0 Issues (Critical): ${report.summary.p0Issues.length}`);
  report.summary.p0Issues.forEach((issue) => {
    console.log(`  🔴 ${issue}`);
  });
  console.log();
  console.log(`P1 Issues (High): ${report.summary.p1Issues.length}`);
  report.summary.p1Issues.forEach((issue) => {
    console.log(`  🟡 ${issue}`);
  });
  console.log();
  console.log(`P2 Issues (Medium): ${report.summary.p2Issues.length}`);
  report.summary.p2Issues.forEach((issue) => {
    console.log(`  🟠 ${issue}`);
  });

  // Write report to file
  const markdown = generateMarkdownReport(report);
  fs.writeFileSync(reportPath, markdown, 'utf-8');
  console.log(`\n📄 Full report written to: ${reportPath}`);
}

function generateMarkdownReport(data) {
  let md = `# GmReservation Data Consistency Review Report

**Generated**: ${data.timestamp}
**Reviewer**: Agent γ (Automated)

## Executive Summary

- **P0 Issues (Critical FK Violations)**: ${data.summary.p0Issues.length}
- **P1 Issues (High Priority Data)**: ${data.summary.p1Issues.length}
- **P2 Issues (Medium Performance)**: ${data.summary.p2Issues.length}

## Findings

### P0 Issues (Critical)
${
  data.summary.p0Issues.length > 0
    ? data.summary.p0Issues.map((issue) => `- ${issue}`).join('\n')
    : '✅ None detected'
}

### P1 Issues (High)
${
  data.summary.p1Issues.length > 0
    ? data.summary.p1Issues.map((issue) => `- ${issue}`).join('\n')
    : '✅ None detected'
}

### P2 Issues (Medium)
${
  data.summary.p2Issues.length > 0
    ? data.summary.p2Issues.map((issue) => `- ${issue}`).join('\n')
    : '✅ None detected'
}

## Detailed Checks

`;

  data.checks.forEach((check) => {
    md += `### ${check.name}
- **Status**: ${check.status}
`;
    if (check.error) {
      md += `- **Error**: ${check.error}\n`;
    } else {
      md += `- **Data**: \`\`\`json\n${JSON.stringify(check.data, null, 2)}\n\`\`\`\n`;
    }
    md += '\n';
  });

  md += `## Recommendations

### For FK Addition
1. **Resolve P0 Issues First**: Address any orphaned records
   - Delete orphaned reservations OR
   - Create missing Trip/User records
2. **Nullable vs NOT NULL**:
   - If tripId is currently nullable, consider making it NOT NULL after cleanup
   - If mainUserId is currently nullable, consider making it NOT NULL after cleanup
3. **Cascade Delete Safety**:
   - Test cascade delete in development environment first
   - Consider soft deletes (flag-based) instead of hard deletes

### For Data Cleanup
- Create pre-migration script to handle orphaned records
- Add constraints gradually in multi-step migration
- Run validation after each step

### For Future Prevention
- Add NOT NULL constraints on FK columns
- Add CHECK constraints to validate data consistency
- Implement audit trails for record deletions

---
Generated by Task 2 Step 1: GmReservation Data Consistency Review (Agent γ)
`;

  return md;
}

runValidation()
  .then(() => {
    console.log('\n✅ Validation complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Validation failed:', err);
    process.exit(1);
  });
