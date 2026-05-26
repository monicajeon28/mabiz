import { Client } from "pg";

interface CheckResult {
  section: string;
  status: "PASS" | "FAIL" | "WARNING";
  message: string;
  count?: number;
}

const results: CheckResult[] = [];

async function runIntegrityCheck() {
  const neonUrl =
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  const client = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("🔍 CRM DATA INTEGRITY CHECK\n");
    console.log("=".repeat(80));

    // ===== SECTION 1: Contact Count & Completeness =====
    await checkContactCompleteness(client);

    // ===== SECTION 2: Product Assignment =====
    await checkProductAssignment(client);

    // ===== SECTION 3: Numeric Fields =====
    await checkNumericFields(client);

    // ===== SECTION 4: DateTime Fields =====
    await checkDateTimeFields(client);

    // ===== SECTION 5: Duplicates =====
    await checkDuplicates(client);

    // ===== SECTION 6: Soft Deletes =====
    await checkSoftDeletes(client);

    // ===== SECTION 7: Organization References =====
    await checkOrganizationReferences(client);

    // Print Final Report
    printFinalReport();
  } catch (error) {
    console.error("❌ FATAL ERROR:", error);
  } finally {
    await client.end();
  }
}

async function checkContactCompleteness(client: Client) {
  console.log("\n📋 SECTION 1: Contact Data Completeness");
  console.log("-".repeat(80));

  try {
    // Total contacts
    const totalResult = await client.query("SELECT COUNT(*) as count FROM \"Contact\"");
    const totalCount = totalResult.rows[0].count;
    console.log(`✓ Total Contacts: ${totalCount}`);

    // Missing required fields
    const missingNameResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "name" IS NULL OR "name" = \'\''
    );
    const missingNameCount = missingNameResult.rows[0].count;

    const missingPhoneResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "phone" IS NULL OR "phone" = \'\''
    );
    const missingPhoneCount = missingPhoneResult.rows[0].count;

    const missingOrgResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "organizationId" IS NULL'
    );
    const missingOrgCount = missingOrgResult.rows[0].count;

    console.log(
      `${missingNameCount === 0 ? "✓" : "⚠️ "} Missing Name: ${missingNameCount}`
    );
    console.log(
      `${missingPhoneCount === 0 ? "✓" : "❌"} Missing Phone: ${missingPhoneCount}`
    );
    console.log(
      `${missingOrgCount === 0 ? "✓" : "❌"} Missing OrganizationId: ${missingOrgCount}`
    );

    // LeadScore validation
    const invalidLeadScoreResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "leadScore" < 0 OR "leadScore" > 100'
    );
    const invalidLeadScoreCount = invalidLeadScoreResult.rows[0].count;
    console.log(
      `${invalidLeadScoreCount === 0 ? "✓" : "⚠️ "} Invalid LeadScore (outside 0-100): ${invalidLeadScoreCount}`
    );

    // ReEngageCount validation
    const negativeReEngageResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "reEngageCount" < 0'
    );
    const negativeReEngageCount = negativeReEngageResult.rows[0].count;
    console.log(
      `${negativeReEngageCount === 0 ? "✓" : "⚠️ "} Negative reEngageCount: ${negativeReEngageCount}`
    );

    if (
      missingPhoneCount === 0 &&
      missingOrgCount === 0 &&
      invalidLeadScoreCount === 0 &&
      negativeReEngageCount === 0
    ) {
      results.push({
        section: "Contact Completeness",
        status: "PASS",
        message: "All contacts have complete required fields",
        count: totalCount,
      });
    } else {
      results.push({
        section: "Contact Completeness",
        status: missingPhoneCount > 0 || missingOrgCount > 0 ? "FAIL" : "WARNING",
        message: `Issues found: ${missingPhoneCount} missing phone, ${missingOrgCount} missing org`,
      });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    results.push({
      section: "Contact Completeness",
      status: "FAIL",
      message: error.message,
    });
  }
}

async function checkProductAssignment(client: Client) {
  console.log("\n💰 SECTION 2: Product Assignment");
  console.log("-".repeat(80));

  try {
    const withProductResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "productName" IS NOT NULL'
    );
    const withProductCount = withProductResult.rows[0].count;

    const totalResult = await client.query("SELECT COUNT(*) as count FROM \"Contact\"");
    const totalCount = totalResult.rows[0].count;

    console.log(`✓ Contacts with productName: ${withProductCount}/${totalCount}`);

    if (withProductCount > 0) {
      const uniqueProductsResult = await client.query(
        'SELECT COUNT(DISTINCT "productName") as count FROM "Contact" WHERE "productName" IS NOT NULL'
      );
      const uniqueProductsCount = uniqueProductsResult.rows[0].count;
      console.log(`✓ Unique Products: ${uniqueProductsCount}`);

      const productsResult = await client.query(
        'SELECT DISTINCT "productName" FROM "Contact" WHERE "productName" IS NOT NULL ORDER BY "productName" LIMIT 5'
      );
      console.log(`  Examples: ${productsResult.rows.map((r) => r.productName).join(", ")}`);

      results.push({
        section: "Product Assignment",
        status: "PASS",
        message: `${withProductCount} contacts linked to ${uniqueProductsCount} products`,
        count: withProductCount,
      });
    } else {
      results.push({
        section: "Product Assignment",
        status: "WARNING",
        message: "No contacts have productName assigned",
        count: 0,
      });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    results.push({
      section: "Product Assignment",
      status: "FAIL",
      message: error.message,
    });
  }
}

async function checkNumericFields(client: Client) {
  console.log("\n🔢 SECTION 3: Numeric Fields Validity");
  console.log("-".repeat(80));

  try {
    // LTV validation
    const negativeLtvResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "ltvTotal" < 0'
    );
    const negativeLtvCount = negativeLtvResult.rows[0].count;
    console.log(`${negativeLtvCount === 0 ? "✓" : "❌"} Negative LTV: ${negativeLtvCount}`);

    // Age validation
    const invalidAgeResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "age" < 0 OR "age" > 150'
    );
    const invalidAgeCount = invalidAgeResult.rows[0].count;
    console.log(`${invalidAgeCount === 0 ? "✓" : "⚠️ "} Invalid Age: ${invalidAgeCount}`);

    // Children count validation
    const negativeChildrenResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "childrenCount" < 0'
    );
    const negativeChildrenCount = negativeChildrenResult.rows[0].count;
    console.log(`${negativeChildrenCount === 0 ? "✓" : "⚠️ "} Negative Children Count: ${negativeChildrenCount}`);

    // Anxiety score validation
    const invalidAnxietyResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "anxietyScore" < 0 OR "anxietyScore" > 100'
    );
    const invalidAnxietyCount = invalidAnxietyResult.rows[0].count;
    console.log(
      `${invalidAnxietyCount === 0 ? "✓" : "⚠️ "} Invalid Anxiety Score: ${invalidAnxietyCount}`
    );

    // Differentiation score validation (using existing field)
    const invalidDifferentiationResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "differentiationScore" < 0 OR "differentiationScore" > 100'
    );
    const invalidDifferentiationCount = invalidDifferentiationResult.rows[0].count;
    console.log(
      `${invalidDifferentiationCount === 0 ? "✓" : "⚠️ "} Invalid Differentiation Score: ${invalidDifferentiationCount}`
    );

    // Reactivation likelihood validation
    const invalidReactivationResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "reactivationLikelihood" < 0 OR "reactivationLikelihood" > 100'
    );
    const invalidReactivationCount = invalidReactivationResult.rows[0].count;
    console.log(
      `${invalidReactivationCount === 0 ? "✓" : "⚠️ "} Invalid Reactivation Likelihood: ${invalidReactivationCount}`
    );

    if (
      negativeLtvCount === 0 &&
      invalidAgeCount === 0 &&
      negativeChildrenCount === 0 &&
      invalidAnxietyCount === 0 &&
      invalidDifferentiationCount === 0 &&
      invalidReactivationCount === 0
    ) {
      results.push({
        section: "Numeric Fields Validity",
        status: "PASS",
        message: "All numeric fields are within valid ranges",
      });
    } else {
      results.push({
        section: "Numeric Fields Validity",
        status: negativeLtvCount > 0 ? "FAIL" : "WARNING",
        message: `Found ${negativeLtvCount} negative LTV, ${invalidAgeCount} invalid ages, ${invalidDifferentiationCount} invalid differentiation scores`,
      });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    results.push({
      section: "Numeric Fields Validity",
      status: "FAIL",
      message: error.message,
    });
  }
}

async function checkDateTimeFields(client: Client) {
  console.log("\n📅 SECTION 4: DateTime Fields Validity");
  console.log("-".repeat(80));

  try {
    // CreatedAt > UpdatedAt
    const createdAfterUpdatedResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "createdAt" > "updatedAt"'
    );
    const createdAfterUpdatedCount = createdAfterUpdatedResult.rows[0].count;
    console.log(
      `${createdAfterUpdatedCount === 0 ? "✓" : "⚠️ "} CreatedAt > UpdatedAt: ${createdAfterUpdatedCount}`
    );

    // Future departure date
    const futureDepartureDateResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "departureDate" > NOW()'
    );
    const futureDepartureDateCount = futureDepartureDateResult.rows[0].count;
    console.log(`⚠️  Future Departure Date: ${futureDepartureDateCount}`);

    // Future purchased date
    const futurePurchasedResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "purchasedAt" > NOW()'
    );
    const futurePurchasedCount = futurePurchasedResult.rows[0].count;
    console.log(`${futurePurchasedCount === 0 ? "✓" : "❌"} Future PurchasedAt: ${futurePurchasedCount}`);

    // Future last contacted date
    const futureLstContactedResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "lastContactedAt" > NOW()'
    );
    const futureLstContactedCount = futureLstContactedResult.rows[0].count;
    console.log(`${futureLstContactedCount === 0 ? "✓" : "❌"} Future LastContactedAt: ${futureLstContactedCount}`);

    // Future last payment date
    const futureLastPaymentResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "lastPaymentAt" > NOW()'
    );
    const futureLastPaymentCount = futureLastPaymentResult.rows[0].count;
    console.log(`${futureLastPaymentCount === 0 ? "✓" : "❌"} Future LastPaymentAt: ${futureLastPaymentCount}`);

    // CreatedAt in future (clock skew)
    const createdInFutureResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "createdAt" > NOW()'
    );
    const createdInFutureCount = createdInFutureResult.rows[0].count;
    console.log(`${createdInFutureCount === 0 ? "✓" : "❌"} CreatedAt in Future: ${createdInFutureCount}`);

    if (
      createdAfterUpdatedCount === 0 &&
      futurePurchasedCount === 0 &&
      futureLstContactedCount === 0 &&
      futureLastPaymentCount === 0 &&
      createdInFutureCount === 0
    ) {
      results.push({
        section: "DateTime Fields Validity",
        status: "PASS",
        message: "All datetime fields are in correct chronological order",
      });
    } else {
      results.push({
        section: "DateTime Fields Validity",
        status: "FAIL",
        message: `Found ${futurePurchasedCount} future purchases, ${createdInFutureCount} future creates`,
      });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    results.push({
      section: "DateTime Fields Validity",
      status: "FAIL",
      message: error.message,
    });
  }
}

async function checkDuplicates(client: Client) {
  console.log("\n🔁 SECTION 5: Duplicate Detection");
  console.log("-".repeat(80));

  try {
    // Duplicate phones
    const duplicatePhonesResult = await client.query(`
      SELECT "phone", COUNT(*) as cnt
      FROM "Contact"
      WHERE "phone" IS NOT NULL AND "phone" != ''
      GROUP BY "phone"
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
    `);
    const duplicatePhonesCount = duplicatePhonesResult.rows.length;
    console.log(`${duplicatePhonesCount === 0 ? "✓" : "⚠️ "} Duplicate Phone Groups: ${duplicatePhonesCount}`);

    if (duplicatePhonesCount > 0) {
      duplicatePhonesResult.rows.slice(0, 3).forEach((row) => {
        console.log(`   ${row.phone}: ${row.cnt} records`);
      });
    }

    // Duplicate emails
    const duplicateEmailsResult = await client.query(`
      SELECT "email", COUNT(*) as cnt
      FROM "Contact"
      WHERE "email" IS NOT NULL AND "email" != ''
      GROUP BY "email"
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
    `);
    const duplicateEmailsCount = duplicateEmailsResult.rows.length;
    console.log(`${duplicateEmailsCount === 0 ? "✓" : "⚠️ "} Duplicate Email Groups: ${duplicateEmailsCount}`);

    if (duplicateEmailsCount > 0) {
      duplicateEmailsResult.rows.slice(0, 3).forEach((row) => {
        console.log(`   ${row.email}: ${row.cnt} records`);
      });
    }

    if (duplicatePhonesCount === 0 && duplicateEmailsCount === 0) {
      results.push({
        section: "Duplicate Detection",
        status: "PASS",
        message: "No duplicate phone numbers or emails found",
      });
    } else {
      results.push({
        section: "Duplicate Detection",
        status: "WARNING",
        message: `Found ${duplicatePhonesCount} duplicate phone groups and ${duplicateEmailsCount} duplicate email groups`,
      });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    results.push({
      section: "Duplicate Detection",
      status: "FAIL",
      message: error.message,
    });
  }
}

async function checkSoftDeletes(client: Client) {
  console.log("\n🗑️  SECTION 6: Soft Delete Audit");
  console.log("-".repeat(80));

  try {
    const deletedContactsResult = await client.query(
      'SELECT COUNT(*) as count FROM "Contact" WHERE "deletedAt" IS NOT NULL'
    );
    const deletedContactsCount = deletedContactsResult.rows[0].count;

    const totalResult = await client.query("SELECT COUNT(*) as count FROM \"Contact\"");
    const totalCount = totalResult.rows[0].count;

    console.log(`✓ Total Contacts (including soft-deleted): ${totalCount}`);
    console.log(`${deletedContactsCount === 0 ? "✓" : "⚠️ "} Soft-Deleted Records: ${deletedContactsCount}`);

    if (deletedContactsCount > 0) {
      const examplesResult = await client.query(
        'SELECT "name", "phone", "deletedAt" FROM "Contact" WHERE "deletedAt" IS NOT NULL ORDER BY "deletedAt" DESC LIMIT 3'
      );
      examplesResult.rows.forEach((row) => {
        console.log(
          `   ${row.name} (${row.phone}) - deleted at ${row.deletedAt.toISOString().substring(0, 10)}`
        );
      });
    }

    results.push({
      section: "Soft Delete Audit",
      status: deletedContactsCount > 0 ? "WARNING" : "PASS",
      message: `${deletedContactsCount} soft-deleted records in database`,
      count: deletedContactsCount,
    });
  } catch (error: any) {
    console.error("Error:", error.message);
    results.push({
      section: "Soft Delete Audit",
      status: "FAIL",
      message: error.message,
    });
  }
}

async function checkOrganizationReferences(client: Client) {
  console.log("\n🏢 SECTION 7: Organization References");
  console.log("-".repeat(80));

  try {
    const totalOrgResult = await client.query("SELECT COUNT(*) as count FROM \"Organization\"");
    const totalOrgCount = totalOrgResult.rows[0].count;

    const contactsWithOrgResult = await client.query(
      'SELECT COUNT(DISTINCT "organizationId") as count FROM "Contact" WHERE "organizationId" IS NOT NULL'
    );
    const contactsWithOrgCount = contactsWithOrgResult.rows[0].count;

    const orphanedContactsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM "Contact" c
      WHERE "organizationId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o.id = c."organizationId")
    `);
    const orphanedContactsCount = orphanedContactsResult.rows[0].count;

    console.log(`✓ Total Organizations: ${totalOrgCount}`);
    console.log(`✓ Organizations with Contacts: ${contactsWithOrgCount}`);
    console.log(`${orphanedContactsCount === 0 ? "✓" : "❌"} Orphaned Contacts (invalid orgId): ${orphanedContactsCount}`);

    if (orphanedContactsCount === 0 && contactsWithOrgCount <= totalOrgCount) {
      results.push({
        section: "Organization References",
        status: "PASS",
        message: "All contact organization references are valid",
      });
    } else {
      results.push({
        section: "Organization References",
        status: orphanedContactsCount > 0 ? "FAIL" : "WARNING",
        message: `${orphanedContactsCount} orphaned contacts with invalid orgId`,
      });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    results.push({
      section: "Organization References",
      status: "FAIL",
      message: error.message,
    });
  }
}

function printFinalReport() {
  console.log("\n" + "=".repeat(80));
  console.log("📊 FINAL INTEGRITY REPORT");
  console.log("=".repeat(80));

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const warningCount = results.filter((r) => r.status === "WARNING").length;

  console.log(`\n✅ PASSED: ${passCount}`);
  console.log(`⚠️  WARNINGS: ${warningCount}`);
  console.log(`❌ FAILURES: ${failCount}`);
  console.log("\n" + "-".repeat(80));

  results.forEach((item, index) => {
    const icon = item.status === "PASS" ? "✅" : item.status === "WARNING" ? "⚠️ " : "❌";
    console.log(
      `\n${index + 1}. ${icon} ${item.section}`
    );
    console.log(`   Status: ${item.status}`);
    console.log(`   ${item.message}`);
    if (item.count !== undefined) {
      console.log(`   Count: ${item.count}`);
    }
  });

  console.log("\n" + "=".repeat(80));
  console.log(`Overall Status: ${failCount === 0 ? "🟢 HEALTHY" : "🔴 ISSUES FOUND"}`);
  console.log("=".repeat(80));

  console.log("\n📈 SUMMARY:");
  if (failCount > 0) {
    console.log("❌ ACTION REQUIRED: Fix FAIL items immediately (data integrity at risk)");
  }
  if (warningCount > 0) {
    console.log("⚠️  ATTENTION: Review WARNING items (data quality concerns)");
  }
  if (failCount === 0 && warningCount === 0) {
    console.log("✨ Database is in excellent condition!");
  }
}

runIntegrityCheck().catch(console.error);
