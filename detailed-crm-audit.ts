import { Client } from "pg";

interface AuditResult {
  section: string;
  status: "✅ PASS" | "⚠️  WARNING" | "❌ FAIL";
  findings: string[];
  dataPoints?: { [key: string]: any };
}

const results: AuditResult[] = [];

async function runAudit() {
  const neonUrl =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  const client = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("\n🔍 CRM DATA INTEGRITY & QUALITY AUDIT (최종 점검)\n");
    console.log("=".repeat(90));

    // ===== 1. Contact 기본 현황 =====
    await section1ContactOverview(client);

    // ===== 2. 필수 필드 완성도 =====
    await section2RequiredFields(client);

    // ===== 3. 데이터 타입 및 범위 검증 =====
    await section3NumericRanges(client);

    // ===== 4. 참조 무결성 =====
    await section4ReferentialIntegrity(client);

    // ===== 5. 중복 데이터 검사 =====
    await section5DuplicateDetection(client);

    // ===== 6. 상품 연동 상태 =====
    await section6ProductLinkage(client);

    // ===== 7. 심리학 렌즈 필드 (Menu #47-51 관련) =====
    await section7PsychologyLenses(client);

    // ===== 8. 소프트 델리트 및 아카이브 =====
    await section8SoftDeletesAndArchive(client);

    // Print consolidated report
    printAuditReport();
  } catch (error) {
    console.error("❌ FATAL ERROR:", error);
  } finally {
    await client.end();
  }
}

async function section1ContactOverview(client: Client) {
  console.log("\n📊 1. CONTACT 기본 현황");
  console.log("-".repeat(90));

  try {
    const totalResult = await client.query(
      'SELECT COUNT(*) as total, COUNT(DISTINCT "organizationId") as orgs FROM "Contact" WHERE "deletedAt" IS NULL'
    );
    const { total, orgs } = totalResult.rows[0];

    const typeCountResult = await client.query(
      'SELECT "type", COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL GROUP BY "type"'
    );

    const channelCountResult = await client.query(
      'SELECT "channel", COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL GROUP BY "channel"'
    );

    console.log(`✓ 총 연락처: ${total}명`);
    console.log(`✓ 조직 수: ${orgs}개`);
    console.log(`✓ 타입별 분류:`);
    typeCountResult.rows.forEach((row) => {
      console.log(`    • ${row.type}: ${row.count}명`);
    });
    console.log(`✓ 채널별 분류:`);
    channelCountResult.rows.forEach((row) => {
      console.log(`    • ${row.channel}: ${row.count}명`);
    });

    results.push({
      section: "1. Contact 기본 현황",
      status: "✅ PASS",
      findings: [`총 ${total}명의 연락처 (${orgs}개 조직) 관리 중`],
      dataPoints: {
        total,
        organizations: orgs,
        types: typeCountResult.rows,
        channels: channelCountResult.rows,
      },
    });
  } catch (error: any) {
    results.push({
      section: "1. Contact 기본 현황",
      status: "❌ FAIL",
      findings: [error.message],
    });
  }
}

async function section2RequiredFields(client: Client) {
  console.log("\n✅ 2. 필수 필드 완성도");
  console.log("-".repeat(90));

  try {
    const issues: string[] = [];
    const checks = [
      { field: "name", label: "이름(name)" },
      { field: "phone", label: "전화(phone)" },
      { field: "organizationId", label: "조직(organizationId)" },
      { field: "email", label: "이메일(email)" },
    ];

    for (const check of checks) {
      const result = await client.query(
        `SELECT COUNT(*) as missing FROM "Contact" WHERE "deletedAt" IS NULL AND ("${check.field}" IS NULL OR "${check.field}" = '')`
      );
      const missing = result.rows[0].missing;
      const status = missing === 0 ? "✓" : "✗";
      console.log(`  ${status} ${check.label}: ${missing === 0 ? "완전" : `${missing}건 누락`}`);
      if (missing > 0) {
        issues.push(`${check.label} ${missing}건 누락`);
      }
    }

    if (issues.length === 0) {
      results.push({
        section: "2. 필수 필드 완성도",
        status: "✅ PASS",
        findings: ["모든 필수 필드가 완성됨"],
      });
    } else {
      results.push({
        section: "2. 필수 필드 완성도",
        status: "⚠️  WARNING",
        findings: issues,
      });
    }
  } catch (error: any) {
    results.push({
      section: "2. 필수 필드 완성도",
      status: "❌ FAIL",
      findings: [error.message],
    });
  }
}

async function section3NumericRanges(client: Client) {
  console.log("\n🔢 3. 수치 필드 범위 검증");
  console.log("-".repeat(90));

  try {
    const issues: string[] = [];

    const checks = [
      {
        field: "leadScore",
        label: "리드 점수",
        min: 0,
        max: 100,
        warn: true,
      },
      {
        field: "anxietyScore",
        label: "불안도 점수",
        min: 0,
        max: 100,
        warn: true,
      },
      {
        field: "reactivationLikelihood",
        label: "재활성화 확률",
        min: 0,
        max: 100,
        warn: true,
      },
      {
        field: "differentiationScore",
        label: "차별성 점수",
        min: 0,
        max: 100,
        warn: true,
      },
      { field: "ltvTotal", label: "생명주기 가치", min: 0, max: 999999, warn: false },
      { field: "age", label: "나이", min: 0, max: 150, warn: true },
    ];

    for (const check of checks) {
      const query = check.min === null
        ? `SELECT COUNT(*) as invalid FROM "Contact" WHERE "deletedAt" IS NULL AND "${check.field}" IS NOT NULL AND "${check.field}" < 0`
        : `SELECT COUNT(*) as invalid FROM "Contact" WHERE "deletedAt" IS NULL AND ("${check.field}" < ${check.min} OR "${check.field}" > ${check.max})`;

      const result = await client.query(query);
      const invalid = result.rows[0].invalid;

      if (invalid === 0) {
        console.log(`  ✓ ${check.label}: 범위 내 (${check.min}-${check.max})`);
      } else {
        console.log(`  ⚠️  ${check.label}: ${invalid}건 범위 외`);
        issues.push(`${check.label} ${invalid}건 범위 외 값`);
      }
    }

    if (issues.length === 0) {
      results.push({
        section: "3. 수치 필드 범위 검증",
        status: "✅ PASS",
        findings: ["모든 수치 필드가 유효한 범위 내"],
      });
    } else {
      results.push({
        section: "3. 수치 필드 범위 검증",
        status: "⚠️  WARNING",
        findings: issues,
      });
    }
  } catch (error: any) {
    results.push({
      section: "3. 수치 필드 범위 검증",
      status: "❌ FAIL",
      findings: [error.message],
    });
  }
}

async function section4ReferentialIntegrity(client: Client) {
  console.log("\n🔗 4. 참조 무결성 (Foreign Key)");
  console.log("-".repeat(90));

  try {
    const issues: string[] = [];

    // Check organization references
    const orphanedContactsResult = await client.query(`
      SELECT COUNT(*) as orphaned
      FROM "Contact" c
      WHERE c."organizationId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o.id = c."organizationId")
    `);
    const orphanedCount = orphanedContactsResult.rows[0].orphaned;

    console.log(`  ${orphanedCount === 0 ? "✓" : "✗"} Organization FK: ${orphanedCount === 0 ? "모두 유효" : `${orphanedCount}건 고아`}`);
    if (orphanedCount > 0) {
      issues.push(`${orphanedCount}개의 고아 연락처 (조직 참조 없음)`);
    }

    // Check user references (if userId exists)
    const userRefResult = await client.query(
      'SELECT COUNT(*) as refs FROM "Contact" WHERE "userId" IS NOT NULL'
    );
    const userRefsCount = userRefResult.rows[0].refs;
    console.log(`  ℹ️  User 참조: ${userRefsCount}건 (선택사항)`);

    if (issues.length === 0) {
      results.push({
        section: "4. 참조 무결성",
        status: "✅ PASS",
        findings: ["모든 외래키 참조가 유효함"],
      });
    } else {
      results.push({
        section: "4. 참조 무결성",
        status: "❌ FAIL",
        findings: issues,
      });
    }
  } catch (error: any) {
    results.push({
      section: "4. 참조 무결성",
      status: "❌ FAIL",
      findings: [error.message],
    });
  }
}

async function section5DuplicateDetection(client: Client) {
  console.log("\n🔁 5. 중복 데이터 검사");
  console.log("-".repeat(90));

  try {
    const issues: string[] = [];

    // Duplicate phones
    const dupPhonesResult = await client.query(`
      SELECT COUNT(*) as dup_groups, SUM(cnt) as dup_records
      FROM (
        SELECT "phone", COUNT(*) as cnt
        FROM "Contact"
        WHERE "deletedAt" IS NULL AND "phone" IS NOT NULL AND "phone" != ''
        GROUP BY "phone"
        HAVING COUNT(*) > 1
      ) t
    `);
    const dupPhoneGroups = dupPhonesResult.rows[0].dup_groups;
    const dupPhoneRecords = dupPhonesResult.rows[0].dup_records || 0;

    console.log(`  ${dupPhoneGroups === 0 ? "✓" : "⚠️ "} 중복 전화: ${dupPhoneGroups === 0 ? "없음" : `${dupPhoneGroups}개 그룹 (${dupPhoneRecords}건)`}`);
    if (dupPhoneGroups > 0) {
      issues.push(`${dupPhoneGroups}개의 전화번호 중복 그룹 (${dupPhoneRecords}건 영향)`);
    }

    // Duplicate emails
    const dupEmailsResult = await client.query(`
      SELECT COUNT(*) as dup_groups, SUM(cnt) as dup_records
      FROM (
        SELECT "email", COUNT(*) as cnt
        FROM "Contact"
        WHERE "deletedAt" IS NULL AND "email" IS NOT NULL AND "email" != ''
        GROUP BY "email"
        HAVING COUNT(*) > 1
      ) t
    `);
    const dupEmailGroups = dupEmailsResult.rows[0].dup_groups;
    const dupEmailRecords = dupEmailsResult.rows[0].dup_records || 0;

    console.log(`  ${dupEmailGroups === 0 ? "✓" : "⚠️ "} 중복 이메일: ${dupEmailGroups === 0 ? "없음" : `${dupEmailGroups}개 그룹 (${dupEmailRecords}건)`}`);
    if (dupEmailGroups > 0) {
      issues.push(`${dupEmailGroups}개의 이메일 중복 그룹 (${dupEmailRecords}건 영향)`);
    }

    if (issues.length === 0) {
      results.push({
        section: "5. 중복 데이터 검사",
        status: "✅ PASS",
        findings: ["중복 데이터 없음"],
      });
    } else {
      results.push({
        section: "5. 중복 데이터 검사",
        status: "⚠️  WARNING",
        findings: issues,
      });
    }
  } catch (error: any) {
    results.push({
      section: "5. 중복 데이터 검사",
      status: "❌ FAIL",
      findings: [error.message],
    });
  }
}

async function section6ProductLinkage(client: Client) {
  console.log("\n💰 6. 상품 연동 상태");
  console.log("-".repeat(90));

  try {
    const withProductResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL AND "productName" IS NOT NULL'
    );
    const withProduct = withProductResult.rows[0].count;

    const totalResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL'
    );
    const total = totalResult.rows[0].count;

    const uniqueProductsResult = await client.query(
      'SELECT COUNT(DISTINCT "productName") as count FROM "Contact" WHERE "deletedAt" IS NULL AND "productName" IS NOT NULL'
    );
    const uniqueProducts = uniqueProductsResult.rows[0].count;

    const examplesResult = await client.query(
      'SELECT DISTINCT "productName" FROM "Contact" WHERE "deletedAt" IS NULL AND "productName" IS NOT NULL ORDER BY "productName" LIMIT 5'
    );

    console.log(`✓ 상품 할당: ${withProduct}/${total}명 (${((withProduct / total) * 100).toFixed(1)}%)`);
    console.log(`✓ 고유 상품: ${uniqueProducts}개`);
    if (examplesResult.rows.length > 0) {
      console.log(`✓ 상품 예시:`);
      examplesResult.rows.forEach((row) => {
        console.log(`    • ${row.productName.substring(0, 60)}${row.productName.length > 60 ? "..." : ""}`);
      });
    }

    results.push({
      section: "6. 상품 연동 상태",
      status: "✅ PASS",
      findings: [
        `${withProduct}명에게 ${uniqueProducts}개의 고유 상품 할당됨 (${((withProduct / total) * 100).toFixed(1)}%)`,
      ],
      dataPoints: {
        assigned: withProduct,
        total,
        uniqueProducts,
      },
    });
  } catch (error: any) {
    results.push({
      section: "6. 상품 연동 상태",
      status: "⚠️  WARNING",
      findings: [error.message],
    });
  }
}

async function section7PsychologyLenses(client: Client) {
  console.log("\n🧠 7. 심리학 렌즈 필드 (L0-L10)");
  console.log("-".repeat(90));

  try {
    // L0: Reactivation (Menu #47)
    const l0Result = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL AND "reactivationLikelihood" > 0'
    );
    console.log(`  L0 (재활성화): ${l0Result.rows[0].count}명 점수화됨`);

    // L2: Anxiety/Preparation (Menu #48)
    const l2Result = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL AND "anxietyScore" > 0'
    );
    console.log(`  L2 (준비 불안): ${l2Result.rows[0].count}명 점수화됨`);

    // L3: Differentiation (Menu #49)
    const l3Result = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL AND ("competitorMentioned" = true OR "differentiationScore" > 0)'
    );
    console.log(`  L3 (차별성): ${l3Result.rows[0].count}명 감지됨`);

    // L7: Companion (Menu #50)
    const l7Result = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL AND "familyComposition" IS NOT NULL'
    );
    console.log(`  L7 (동반자): ${l7Result.rows[0].count}명 가족구성 설정됨`);

    // L8: Repurchase (Menu #51)
    const l8Result = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NULL AND "ltvTotal" > 0'
    );
    console.log(`  L8 (재구매): ${l8Result.rows[0].count}명 LTV 계산됨`);

    results.push({
      section: "7. 심리학 렌즈 필드",
      status: "✅ PASS",
      findings: ["심리학 렌즈 필드들이 점진적으로 채워지고 있음"],
      dataPoints: {
        l0_reactivation: l0Result.rows[0].count,
        l2_anxiety: l2Result.rows[0].count,
        l3_differentiation: l3Result.rows[0].count,
        l7_companion: l7Result.rows[0].count,
        l8_repurchase: l8Result.rows[0].count,
      },
    });
  } catch (error: any) {
    results.push({
      section: "7. 심리학 렌즈 필드",
      status: "⚠️  WARNING",
      findings: [error.message],
    });
  }
}

async function section8SoftDeletesAndArchive(client: Client) {
  console.log("\n🗑️  8. 소프트 델리트 & 아카이브");
  console.log("-".repeat(90));

  try {
    const deletedResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NOT NULL'
    );
    const deletedCount = deletedResult.rows[0].count;

    const optOutResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "optOutAt" IS NOT NULL'
    );
    const optOutCount = optOutResult.rows[0].count;

    console.log(`  ${deletedCount === 0 ? "✓" : "ℹ️ "} 소프트 삭제: ${deletedCount}건`);
    console.log(`  ${optOutCount === 0 ? "✓" : "ℹ️ "} 옵트아웃: ${optOutCount}건`);

    results.push({
      section: "8. 소프트 델리트 & 아카이브",
      status: "✅ PASS",
      findings: [`${deletedCount}건 삭제됨, ${optOutCount}건 옵트아웃됨`],
      dataPoints: {
        softDeleted: deletedCount,
        optedOut: optOutCount,
      },
    });
  } catch (error: any) {
    results.push({
      section: "8. 소프트 델리트 & 아카이브",
      status: "❌ FAIL",
      findings: [error.message],
    });
  }
}

function printAuditReport() {
  console.log("\n\n" + "=".repeat(90));
  console.log("📋 최종 감시 보고서 (FINAL AUDIT REPORT)");
  console.log("=".repeat(90));

  const passCount = results.filter((r) => r.status.includes("PASS")).length;
  const warnCount = results.filter((r) => r.status.includes("WARNING")).length;
  const failCount = results.filter((r) => r.status.includes("FAIL")).length;

  console.log(`\n상태 요약:`);
  console.log(`  ✅ 통과: ${passCount}개 섹션`);
  console.log(`  ⚠️  주의: ${warnCount}개 섹션`);
  console.log(`  ❌ 실패: ${failCount}개 섹션\n`);

  results.forEach((result, idx) => {
    console.log(`${result.status} ${result.section}`);
    result.findings.forEach((finding) => {
      console.log(`     • ${finding}`);
    });
    if (result.dataPoints) {
      console.log(`     데이터: ${JSON.stringify(result.dataPoints)}`);
    }
    console.log();
  });

  console.log("=".repeat(90));
  if (failCount === 0) {
    console.log(
      `🟢 전체 상태: HEALTHY - CRM 데이터베이스는 좋은 상태를 유지하고 있습니다.\n`
    );
  } else {
    console.log(
      `🔴 전체 상태: ISSUES FOUND - ${failCount}개의 심각한 문제가 있습니다.\n`
    );
  }

  if (warnCount > 0) {
    console.log(`⚠️  개선 권장사항:`);
    results.forEach((result) => {
      if (result.status.includes("WARNING")) {
        console.log(`   • ${result.section}: ${result.findings.join(", ")}`);
      }
    });
    console.log();
  }

  console.log(`📊 데이터 품질 점수: ${((passCount / results.length) * 100).toFixed(0)}%\n`);
}

runAudit().catch(console.error);
