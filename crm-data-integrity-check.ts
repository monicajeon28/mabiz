import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

// Load environment variables from .env.local
config({ path: ".env.local" });

const prisma = new PrismaClient();

interface IntegrityReport {
  section: string;
  status: "PASS" | "FAIL" | "WARNING";
  details: string;
  count?: number;
  affectedIds?: any[];
}

const report: IntegrityReport[] = [];

async function runChecks() {
  console.log("🔍 CRM DATA INTEGRITY CHECK - Started at", new Date().toISOString());
  console.log("=".repeat(80));

  try {
    // ===== SECTION 1: Contact Data Completeness =====
    await checkContactCompleteness();

    // ===== SECTION 2: Product-Price Reference Integrity =====
    await checkProductPriceIntegrity();

    // ===== SECTION 3: Contact-Product Linkage =====
    await checkContactProductLinkage();

    // ===== SECTION 4: Numeric Fields Validity =====
    await checkNumericFieldValidity();

    // ===== SECTION 5: DateTime Fields Validity =====
    await checkDateTimeFieldValidity();

    // ===== SECTION 6: Duplicate Detection =====
    await checkDuplicates();

    // ===== SECTION 7: Soft Delete Audit =====
    await checkSoftDeleteAudit();

    // Print Final Report
    printReport();
  } catch (error) {
    console.error("❌ FATAL ERROR:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkContactCompleteness() {
  console.log("\n📋 SECTION 1: Contact Data Completeness");
  console.log("-".repeat(80));

  try {
    const contacts = await prisma.contact.findMany({
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        organizationId: true,
        type: true,
        leadScore: true,
        reEngageCount: true,
        deletedAt: true,
      },
    });

    const issues: any = {
      missingName: [] as string[],
      missingPhone: [] as string[],
      missingOrg: [] as string[],
      invalidLeadScore: [] as any[],
      invalidReEngageCount: [] as any[],
    };

    for (const contact of contacts) {
      if (!contact.name || contact.name.trim() === "") {
        issues.missingName.push(contact.id);
      }
      if (!contact.phone) {
        issues.missingPhone.push(contact.id);
      }
      if (!contact.organizationId) {
        issues.missingOrg.push(contact.id);
      }
      if (contact.leadScore < 0 || contact.leadScore > 100) {
        issues.invalidLeadScore.push({
          id: contact.id,
          value: contact.leadScore,
        });
      }
      if (contact.reEngageCount < 0) {
        issues.invalidReEngageCount.push({
          id: contact.id,
          value: contact.reEngageCount,
        });
      }
    }

    console.log(`✓ Total Contacts: ${contacts.length}`);

    if (issues.missingName.length > 0) {
      console.log(`⚠️  Missing Name (${issues.missingName.length})`, issues.missingName.slice(0, 3));
      report.push({
        section: "Contact Completeness - Missing Name",
        status: "WARNING",
        details: `${issues.missingName.length} contacts missing name`,
        count: issues.missingName.length,
        affectedIds: issues.missingName.slice(0, 5),
      });
    }

    if (issues.missingPhone.length > 0) {
      console.log(`❌ Missing Phone (${issues.missingPhone.length})`, issues.missingPhone.slice(0, 3));
      report.push({
        section: "Contact Completeness - Missing Phone",
        status: "FAIL",
        details: `${issues.missingPhone.length} contacts missing phone (PRIMARY KEY)`,
        count: issues.missingPhone.length,
        affectedIds: issues.missingPhone.slice(0, 5),
      });
    }

    if (issues.missingOrg.length > 0) {
      console.log(`❌ Missing OrganizationId (${issues.missingOrg.length})`, issues.missingOrg.slice(0, 3));
      report.push({
        section: "Contact Completeness - Missing OrganizationId",
        status: "FAIL",
        details: `${issues.missingOrg.length} contacts missing organizationId (FK)`,
        count: issues.missingOrg.length,
        affectedIds: issues.missingOrg.slice(0, 5),
      });
    }

    if (issues.invalidLeadScore.length > 0) {
      console.log(`⚠️  Invalid LeadScore (${issues.invalidLeadScore.length})`, issues.invalidLeadScore.slice(0, 3));
      report.push({
        section: "Contact Completeness - Invalid LeadScore",
        status: "WARNING",
        details: `${issues.invalidLeadScore.length} contacts with leadScore outside 0-100 range`,
        count: issues.invalidLeadScore.length,
        affectedIds: issues.invalidLeadScore.slice(0, 5),
      });
    }

    if (issues.invalidReEngageCount.length > 0) {
      console.log(`⚠️  Invalid ReEngageCount (${issues.invalidReEngageCount.length})`, issues.invalidReEngageCount.slice(0, 3));
      report.push({
        section: "Contact Completeness - Negative ReEngageCount",
        status: "WARNING",
        details: `${issues.invalidReEngageCount.length} contacts with negative reEngageCount`,
        count: issues.invalidReEngageCount.length,
        affectedIds: issues.invalidReEngageCount.slice(0, 5),
      });
    }

    if (
      issues.missingName.length === 0 &&
      issues.missingPhone.length === 0 &&
      issues.missingOrg.length === 0 &&
      issues.invalidLeadScore.length === 0 &&
      issues.invalidReEngageCount.length === 0
    ) {
      console.log("✅ All Contact records have complete required fields");
      report.push({
        section: "Contact Completeness",
        status: "PASS",
        details: "All contacts have required fields (phone, name, organizationId) with valid numeric ranges",
        count: contacts.length,
      });
    }
  } catch (error: any) {
    console.error("❌ Error in checkContactCompleteness:", error.message);
    report.push({
      section: "Contact Completeness",
      status: "FAIL",
      details: `Error: ${error.message}`,
    });
  }
}

async function checkProductPriceIntegrity() {
  console.log("\n💰 SECTION 2: Product-Price Reference Integrity");
  console.log("-".repeat(80));

  try {
    // Assuming product/price tables exist in Supabase
    // We'll check Contact.productName references
    const contacts = await prisma.contact.findMany({
      where: {
        productName: {
          not: null,
        },
      },
      select: {
        id: true,
        productName: true,
      },
    });

    console.log(`✓ Total Contacts with productName: ${contacts.length}`);

    if (contacts.length === 0) {
      console.log("ℹ️  No contacts have productName assigned yet");
      report.push({
        section: "Product-Price Integrity",
        status: "WARNING",
        details: "No contacts have productName assigned - consider linking products",
        count: 0,
      });
    } else {
      const uniqueProducts = [...new Set(contacts.map((c) => c.productName))];
      console.log(`✓ Unique Product Names: ${uniqueProducts.length}`, uniqueProducts.slice(0, 5));
      report.push({
        section: "Product-Price Integrity",
        status: "PASS",
        details: `${contacts.length} contacts linked to ${uniqueProducts.length} unique products`,
        count: contacts.length,
      });
    }
  } catch (error: any) {
    console.error("❌ Error in checkProductPriceIntegrity:", error.message);
    report.push({
      section: "Product-Price Integrity",
      status: "FAIL",
      details: `Error: ${error.message}`,
    });
  }
}

async function checkContactProductLinkage() {
  console.log("\n🔗 SECTION 3: Contact-Product Linkage");
  console.log("-".repeat(80));

  try {
    const contacts = await prisma.contact.findMany({
      select: {
        id: true,
        productName: true,
        cruiseInterest: true,
        lensMetadata: true,
      },
    });

    const issues: any = {
      productButNoCruiseInterest: [] as string[],
      productButLowCruiseInterest: [] as string[],
      missingLensMetadata: [] as string[],
      invalidLensMetadata: [] as string[],
    };

    for (const contact of contacts) {
      if (contact.productName && contact.cruiseInterest !== "HIGH") {
        issues.productButNoCruiseInterest.push(contact.id);
      }

      if (!contact.lensMetadata) {
        issues.missingLensMetadata.push(contact.id);
      } else {
        try {
          const meta = typeof contact.lensMetadata === "string" ? JSON.parse(contact.lensMetadata) : contact.lensMetadata;
          if (!meta.decisionLevel || !meta.readinessScore) {
            issues.invalidLensMetadata.push(contact.id);
          }
        } catch (e) {
          issues.invalidLensMetadata.push(contact.id);
        }
      }
    }

    console.log(`✓ Total Contacts: ${contacts.length}`);
    console.log(`✓ With Product Assignment: ${contacts.filter((c) => c.productName).length}`);

    if (issues.productButNoCruiseInterest.length > 0) {
      console.log(
        `⚠️  Product assigned but cruiseInterest ≠ HIGH (${issues.productButNoCruiseInterest.length})`,
        issues.productButNoCruiseInterest.slice(0, 3)
      );
      report.push({
        section: "Contact-Product Linkage - Interest Mismatch",
        status: "WARNING",
        details: `${issues.productButNoCruiseInterest.length} contacts with product but cruiseInterest ≠ HIGH`,
        count: issues.productButNoCruiseInterest.length,
        affectedIds: issues.productButNoCruiseInterest.slice(0, 5),
      });
    }

    if (issues.missingLensMetadata.length > 0) {
      console.log(
        `⚠️  Missing lensMetadata (${issues.missingLensMetadata.length})`,
        issues.missingLensMetadata.slice(0, 3)
      );
      report.push({
        section: "Contact-Product Linkage - Missing Metadata",
        status: "WARNING",
        details: `${issues.missingLensMetadata.length} contacts missing lensMetadata JSON`,
        count: issues.missingLensMetadata.length,
        affectedIds: issues.missingLensMetadata.slice(0, 5),
      });
    }

    if (issues.invalidLensMetadata.length > 0) {
      console.log(
        `⚠️  Invalid lensMetadata structure (${issues.invalidLensMetadata.length})`,
        issues.invalidLensMetadata.slice(0, 3)
      );
      report.push({
        section: "Contact-Product Linkage - Invalid Metadata",
        status: "WARNING",
        details: `${issues.invalidLensMetadata.length} contacts with malformed or missing key fields in lensMetadata`,
        count: issues.invalidLensMetadata.length,
        affectedIds: issues.invalidLensMetadata.slice(0, 5),
      });
    }

    if (
      issues.productButNoCruiseInterest.length === 0 &&
      issues.missingLensMetadata.length === 0 &&
      issues.invalidLensMetadata.length === 0
    ) {
      console.log("✅ All Contact-Product linkages are valid");
      report.push({
        section: "Contact-Product Linkage",
        status: "PASS",
        details: "All product-linked contacts have matching interest levels and valid metadata",
        count: contacts.length,
      });
    }
  } catch (error: any) {
    console.error("❌ Error in checkContactProductLinkage:", error.message);
    report.push({
      section: "Contact-Product Linkage",
      status: "FAIL",
      details: `Error: ${error.message}`,
    });
  }
}

async function checkNumericFieldValidity() {
  console.log("\n🔢 SECTION 4: Numeric Fields Validity");
  console.log("-".repeat(80));

  try {
    const contacts = await prisma.contact.findMany({
      select: {
        id: true,
        leadScore: true,
        ltvTotal: true,
        age: true,
        childrenCount: true,
        anxietyScore: true,
        selfProjectionScore: true,
        reactivationLikelihood: true,
      },
    });

    const issues: any = {
      negativeLTV: [] as any[],
      invalidAge: [] as any[],
      negativeChildrenCount: [] as any[],
      invalidLeadScore: [] as any[],
      invalidAnxietyScore: [] as any[],
      invalidSelfProjectionScore: [] as any[],
      invalidReactivationLikelihood: [] as any[],
    };

    for (const contact of contacts) {
      if (contact.ltvTotal && contact.ltvTotal < 0) {
        issues.negativeLTV.push({ id: contact.id, value: contact.ltvTotal });
      }
      if (contact.age && (contact.age < 0 || contact.age > 150)) {
        issues.invalidAge.push({ id: contact.id, value: contact.age });
      }
      if (contact.childrenCount && contact.childrenCount < 0) {
        issues.negativeChildrenCount.push({ id: contact.id, value: contact.childrenCount });
      }
      if (contact.leadScore < 0 || contact.leadScore > 100) {
        issues.invalidLeadScore.push({ id: contact.id, value: contact.leadScore });
      }
      if (contact.anxietyScore && (contact.anxietyScore < 0 || contact.anxietyScore > 100)) {
        issues.invalidAnxietyScore.push({ id: contact.id, value: contact.anxietyScore });
      }
      if (contact.selfProjectionScore && (contact.selfProjectionScore < 0 || contact.selfProjectionScore > 100)) {
        issues.invalidSelfProjectionScore.push({ id: contact.id, value: contact.selfProjectionScore });
      }
      if (contact.reactivationLikelihood && (contact.reactivationLikelihood < 0 || contact.reactivationLikelihood > 100)) {
        issues.invalidReactivationLikelihood.push({
          id: contact.id,
          value: contact.reactivationLikelihood,
        });
      }
    }

    console.log(`✓ Total Contacts checked: ${contacts.length}`);

    if (issues.negativeLTV.length > 0) {
      console.log(`❌ Negative LTV (${issues.negativeLTV.length})`, issues.negativeLTV.slice(0, 3));
      report.push({
        section: "Numeric Fields - Negative LTV",
        status: "FAIL",
        details: `${issues.negativeLTV.length} contacts with negative ltvTotal`,
        count: issues.negativeLTV.length,
        affectedIds: issues.negativeLTV.slice(0, 5),
      });
    }

    if (issues.invalidAge.length > 0) {
      console.log(`⚠️  Invalid Age (${issues.invalidAge.length})`, issues.invalidAge.slice(0, 3));
      report.push({
        section: "Numeric Fields - Invalid Age",
        status: "WARNING",
        details: `${issues.invalidAge.length} contacts with age outside 0-150 range`,
        count: issues.invalidAge.length,
        affectedIds: issues.invalidAge.slice(0, 5),
      });
    }

    if (issues.negativeChildrenCount.length > 0) {
      console.log(
        `⚠️  Negative Children Count (${issues.negativeChildrenCount.length})`,
        issues.negativeChildrenCount.slice(0, 3)
      );
      report.push({
        section: "Numeric Fields - Negative Children Count",
        status: "WARNING",
        details: `${issues.negativeChildrenCount.length} contacts with negative childrenCount`,
        count: issues.negativeChildrenCount.length,
        affectedIds: issues.negativeChildrenCount.slice(0, 5),
      });
    }

    if (issues.invalidLeadScore.length > 0) {
      console.log(`⚠️  Invalid LeadScore (${issues.invalidLeadScore.length})`, issues.invalidLeadScore.slice(0, 3));
      report.push({
        section: "Numeric Fields - Invalid LeadScore",
        status: "WARNING",
        details: `${issues.invalidLeadScore.length} contacts with leadScore outside 0-100`,
        count: issues.invalidLeadScore.length,
        affectedIds: issues.invalidLeadScore.slice(0, 5),
      });
    }

    if (issues.invalidAnxietyScore.length > 0) {
      console.log(
        `⚠️  Invalid AnxietyScore (${issues.invalidAnxietyScore.length})`,
        issues.invalidAnxietyScore.slice(0, 3)
      );
      report.push({
        section: "Numeric Fields - Invalid AnxietyScore",
        status: "WARNING",
        details: `${issues.invalidAnxietyScore.length} contacts with anxietyScore outside 0-100`,
        count: issues.invalidAnxietyScore.length,
        affectedIds: issues.invalidAnxietyScore.slice(0, 5),
      });
    }

    if (issues.invalidSelfProjectionScore.length > 0) {
      console.log(
        `⚠️  Invalid SelfProjectionScore (${issues.invalidSelfProjectionScore.length})`,
        issues.invalidSelfProjectionScore.slice(0, 3)
      );
      report.push({
        section: "Numeric Fields - Invalid SelfProjectionScore",
        status: "WARNING",
        details: `${issues.invalidSelfProjectionScore.length} contacts with selfProjectionScore outside 0-100`,
        count: issues.invalidSelfProjectionScore.length,
        affectedIds: issues.invalidSelfProjectionScore.slice(0, 5),
      });
    }

    if (issues.invalidReactivationLikelihood.length > 0) {
      console.log(
        `⚠️  Invalid ReactivationLikelihood (${issues.invalidReactivationLikelihood.length})`,
        issues.invalidReactivationLikelihood.slice(0, 3)
      );
      report.push({
        section: "Numeric Fields - Invalid ReactivationLikelihood",
        status: "WARNING",
        details: `${issues.invalidReactivationLikelihood.length} contacts with reactivationLikelihood outside 0-100`,
        count: issues.invalidReactivationLikelihood.length,
        affectedIds: issues.invalidReactivationLikelihood.slice(0, 5),
      });
    }

    if (
      issues.negativeLTV.length === 0 &&
      issues.invalidAge.length === 0 &&
      issues.negativeChildrenCount.length === 0 &&
      issues.invalidLeadScore.length === 0 &&
      issues.invalidAnxietyScore.length === 0 &&
      issues.invalidSelfProjectionScore.length === 0 &&
      issues.invalidReactivationLikelihood.length === 0
    ) {
      console.log("✅ All numeric fields are within valid ranges");
      report.push({
        section: "Numeric Fields Validity",
        status: "PASS",
        details: "All numeric fields (scores, ages, counts) are within valid ranges",
        count: contacts.length,
      });
    }
  } catch (error: any) {
    console.error("❌ Error in checkNumericFieldValidity:", error.message);
    report.push({
      section: "Numeric Fields Validity",
      status: "FAIL",
      details: `Error: ${error.message}`,
    });
  }
}

async function checkDateTimeFieldValidity() {
  console.log("\n📅 SECTION 5: DateTime Fields Validity");
  console.log("-".repeat(80));

  try {
    const contacts = await prisma.contact.findMany({
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        departureDate: true,
        purchasedAt: true,
        lastContactedAt: true,
        lastPaymentAt: true,
        lastCruiseDate: true,
        deletedAt: true,
      },
    });

    const now = new Date();
    const issues: any = {
      createdAfterUpdated: [] as string[],
      futureDepartureDate: [] as any[],
      futurePurchasedAt: [] as any[],
      futureLtsContactedAt: [] as any[],
      futureLastPaymentAt: [] as any[],
      deletedButNotSoftDeleted: [] as string[],
      createdInFuture: [] as any[],
    };

    for (const contact of contacts) {
      if (contact.createdAt > contact.updatedAt) {
        issues.createdAfterUpdated.push(contact.id);
      }

      if (contact.departureDate && contact.departureDate > now) {
        issues.futureDepartureDate.push({
          id: contact.id,
          date: contact.departureDate.toISOString(),
        });
      }

      if (contact.purchasedAt && contact.purchasedAt > now) {
        issues.futurePurchasedAt.push({
          id: contact.id,
          date: contact.purchasedAt.toISOString(),
        });
      }

      if (contact.lastContactedAt && contact.lastContactedAt > now) {
        issues.futureLtsContactedAt.push({
          id: contact.id,
          date: contact.lastContactedAt.toISOString(),
        });
      }

      if (contact.lastPaymentAt && contact.lastPaymentAt > now) {
        issues.futureLastPaymentAt.push({
          id: contact.id,
          date: contact.lastPaymentAt.toISOString(),
        });
      }

      if (contact.createdAt > now) {
        issues.createdInFuture.push({
          id: contact.id,
          date: contact.createdAt.toISOString(),
        });
      }
    }

    console.log(`✓ Total Contacts checked: ${contacts.length}`);

    if (issues.createdAfterUpdated.length > 0) {
      console.log(
        `⚠️  CreatedAt > UpdatedAt (${issues.createdAfterUpdated.length})`,
        issues.createdAfterUpdated.slice(0, 3)
      );
      report.push({
        section: "DateTime Fields - CreatedAt > UpdatedAt",
        status: "WARNING",
        details: `${issues.createdAfterUpdated.length} contacts with createdAt > updatedAt (logic error)`,
        count: issues.createdAfterUpdated.length,
        affectedIds: issues.createdAfterUpdated.slice(0, 5),
      });
    }

    if (issues.futureDepartureDate.length > 0) {
      console.log(
        `⚠️  Future Departure Date (${issues.futureDepartureDate.length})`,
        issues.futureDepartureDate.slice(0, 2)
      );
      report.push({
        section: "DateTime Fields - Future Departure",
        status: "WARNING",
        details: `${issues.futureDepartureDate.length} contacts with departureDate in future`,
        count: issues.futureDepartureDate.length,
        affectedIds: issues.futureDepartureDate.slice(0, 5),
      });
    }

    if (issues.futurePurchasedAt.length > 0) {
      console.log(
        `❌ Future PurchasedAt (${issues.futurePurchasedAt.length})`,
        issues.futurePurchasedAt.slice(0, 2)
      );
      report.push({
        section: "DateTime Fields - Future PurchasedAt",
        status: "FAIL",
        details: `${issues.futurePurchasedAt.length} contacts with purchasedAt in future (data integrity)`,
        count: issues.futurePurchasedAt.length,
        affectedIds: issues.futurePurchasedAt.slice(0, 5),
      });
    }

    if (issues.futureLtsContactedAt.length > 0) {
      console.log(
        `❌ Future LastContactedAt (${issues.futureLtsContactedAt.length})`,
        issues.futureLtsContactedAt.slice(0, 2)
      );
      report.push({
        section: "DateTime Fields - Future LastContactedAt",
        status: "FAIL",
        details: `${issues.futureLtsContactedAt.length} contacts with lastContactedAt in future`,
        count: issues.futureLtsContactedAt.length,
        affectedIds: issues.futureLtsContactedAt.slice(0, 5),
      });
    }

    if (issues.futureLastPaymentAt.length > 0) {
      console.log(
        `❌ Future LastPaymentAt (${issues.futureLastPaymentAt.length})`,
        issues.futureLastPaymentAt.slice(0, 2)
      );
      report.push({
        section: "DateTime Fields - Future LastPaymentAt",
        status: "FAIL",
        details: `${issues.futureLastPaymentAt.length} contacts with lastPaymentAt in future`,
        count: issues.futureLastPaymentAt.length,
        affectedIds: issues.futureLastPaymentAt.slice(0, 5),
      });
    }

    if (issues.createdInFuture.length > 0) {
      console.log(`❌ CreatedAt in Future (${issues.createdInFuture.length})`, issues.createdInFuture.slice(0, 2));
      report.push({
        section: "DateTime Fields - CreatedAt in Future",
        status: "FAIL",
        details: `${issues.createdInFuture.length} contacts with createdAt in future (clock skew)`,
        count: issues.createdInFuture.length,
        affectedIds: issues.createdInFuture.slice(0, 5),
      });
    }

    if (
      issues.createdAfterUpdated.length === 0 &&
      issues.futureDepartureDate.length === 0 &&
      issues.futurePurchasedAt.length === 0 &&
      issues.futureLtsContactedAt.length === 0 &&
      issues.futureLastPaymentAt.length === 0 &&
      issues.createdInFuture.length === 0
    ) {
      console.log("✅ All datetime fields are logically valid");
      report.push({
        section: "DateTime Fields Validity",
        status: "PASS",
        details: "All datetime fields are in correct chronological order and not in future",
        count: contacts.length,
      });
    }
  } catch (error: any) {
    console.error("❌ Error in checkDateTimeFieldValidity:", error.message);
    report.push({
      section: "DateTime Fields Validity",
      status: "FAIL",
      details: `Error: ${error.message}`,
    });
  }
}

async function checkDuplicates() {
  console.log("\n🔁 SECTION 6: Duplicate Detection");
  console.log("-".repeat(80));

  try {
    const contacts = await prisma.contact.findMany({
      select: {
        id: true,
        phone: true,
        email: true,
        organizationId: true,
      },
    });

    const phoneMap = new Map<string, string[]>();
    const emailMap = new Map<string, string[]>();

    for (const contact of contacts) {
      if (contact.phone) {
        if (!phoneMap.has(contact.phone)) {
          phoneMap.set(contact.phone, []);
        }
        phoneMap.get(contact.phone)!.push(contact.id);
      }

      if (contact.email) {
        if (!emailMap.has(contact.email)) {
          emailMap.set(contact.email, []);
        }
        emailMap.get(contact.email)!.push(contact.id);
      }
    }

    const duplicatePhones = Array.from(phoneMap.entries()).filter(([_, ids]) => ids.length > 1);
    const duplicateEmails = Array.from(emailMap.entries()).filter(([_, ids]) => ids.length > 1);

    console.log(`✓ Total Contacts: ${contacts.length}`);
    console.log(`✓ Unique Phone Numbers: ${phoneMap.size}`);
    console.log(`✓ Unique Email Addresses: ${emailMap.size}`);

    if (duplicatePhones.length > 0) {
      console.log(`⚠️  Duplicate Phones (${duplicatePhones.length} groups)`);
      duplicatePhones.slice(0, 3).forEach(([phone, ids]) => {
        console.log(`   ${phone}: ${ids.length} records`, ids.slice(0, 3));
      });
      report.push({
        section: "Duplicate Detection - Phone",
        status: "WARNING",
        details: `${duplicatePhones.length} duplicate phone groups affecting ${duplicatePhones.reduce((sum, [_, ids]) => sum + ids.length, 0)} records`,
        count: duplicatePhones.length,
        affectedIds: duplicatePhones.slice(0, 3).map(([phone, ids]) => `${phone} (${ids.length} records)`),
      });
    }

    if (duplicateEmails.length > 0) {
      console.log(`⚠️  Duplicate Emails (${duplicateEmails.length} groups)`);
      duplicateEmails.slice(0, 3).forEach(([email, ids]) => {
        console.log(`   ${email}: ${ids.length} records`, ids.slice(0, 3));
      });
      report.push({
        section: "Duplicate Detection - Email",
        status: "WARNING",
        details: `${duplicateEmails.length} duplicate email groups affecting ${duplicateEmails.reduce((sum, [_, ids]) => sum + ids.length, 0)} records`,
        count: duplicateEmails.length,
        affectedIds: duplicateEmails.slice(0, 3).map(([email, ids]) => `${email} (${ids.length} records)`),
      });
    }

    if (duplicatePhones.length === 0 && duplicateEmails.length === 0) {
      console.log("✅ No duplicate phone numbers or emails detected");
      report.push({
        section: "Duplicate Detection",
        status: "PASS",
        details: "All contact phone numbers and emails are unique",
        count: contacts.length,
      });
    }
  } catch (error: any) {
    console.error("❌ Error in checkDuplicates:", error.message);
    report.push({
      section: "Duplicate Detection",
      status: "FAIL",
      details: `Error: ${error.message}`,
    });
  }
}

async function checkSoftDeleteAudit() {
  console.log("\n🗑️  SECTION 7: Soft Delete Audit");
  console.log("-".repeat(80));

  try {
    // Include soft deleted records
    const deletedContacts = await prisma.contact.findMany({
      where: {
        deletedAt: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        deletedAt: true,
        lastContactedAt: true,
      },
    });

    const totalContacts = await prisma.contact.findMany({
      select: { id: true },
    });

    console.log(`✓ Total Records (including soft-deleted): ${totalContacts.length}`);
    console.log(`✓ Soft-Deleted Records: ${deletedContacts.length}`);

    if (deletedContacts.length > 0) {
      console.log(`⚠️  Soft-Deleted Records Found (${deletedContacts.length})`);
      deletedContacts.slice(0, 3).forEach((c) => {
        console.log(`   ${c.name} (${c.phone}) - deleted at ${c.deletedAt?.toISOString()}`);
      });
      report.push({
        section: "Soft Delete Audit",
        status: "WARNING",
        details: `${deletedContacts.length} soft-deleted contact records still in database (consider hard delete if not needed)`,
        count: deletedContacts.length,
        affectedIds: deletedContacts.slice(0, 5).map((c) => `${c.name} (${c.phone})`),
      });
    } else {
      console.log("✅ No soft-deleted records found");
      report.push({
        section: "Soft Delete Audit",
        status: "PASS",
        details: "No soft-deleted contact records in database",
        count: 0,
      });
    }
  } catch (error: any) {
    console.error("❌ Error in checkSoftDeleteAudit:", error.message);
    report.push({
      section: "Soft Delete Audit",
      status: "FAIL",
      details: `Error: ${error.message}`,
    });
  }
}

function printReport() {
  console.log("\n" + "=".repeat(80));
  console.log("📊 FINAL INTEGRITY REPORT");
  console.log("=".repeat(80));

  const passCount = report.filter((r) => r.status === "PASS").length;
  const failCount = report.filter((r) => r.status === "FAIL").length;
  const warningCount = report.filter((r) => r.status === "WARNING").length;

  console.log(`\n✅ PASSED: ${passCount}`);
  console.log(`⚠️  WARNINGS: ${warningCount}`);
  console.log(`❌ FAILURES: ${failCount}`);
  console.log("\n" + "-".repeat(80));

  // Print each section
  report.forEach((item, index) => {
    const icon = item.status === "PASS" ? "✅" : item.status === "WARNING" ? "⚠️ " : "❌";
    console.log(`\n${index + 1}. ${icon} ${item.section}`);
    console.log(`   Status: ${item.status}`);
    console.log(`   Details: ${item.details}`);
    if (item.count !== undefined) {
      console.log(`   Count: ${item.count}`);
    }
    if (item.affectedIds && item.affectedIds.length > 0) {
      console.log(`   Examples: ${item.affectedIds.slice(0, 3).join(", ")}`);
    }
  });

  console.log("\n" + "=".repeat(80));
  console.log(`Overall Status: ${failCount === 0 ? "🟢 HEALTHY" : "🔴 ISSUES FOUND"}`);
  console.log("=".repeat(80));

  // Summary statistics
  console.log("\n📈 RECOMMENDATIONS:");
  if (failCount > 0) {
    console.log("- Fix FAIL items immediately (data integrity at risk)");
  }
  if (warningCount > 0) {
    console.log("- Review and address WARNING items (data quality concerns)");
  }
  if (failCount === 0 && warningCount === 0) {
    console.log("- Database is in excellent condition ✨");
  }
}

runChecks();
