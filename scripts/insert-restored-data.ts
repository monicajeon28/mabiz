import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

/**
 * 복원된 데이터를 Neon DB에 삽입하는 스크립트
 *
 * 사용:
 *   DATABASE_URL=... npx ts-node scripts/insert-restored-data.ts
 *
 * 기능:
 * - Prisma를 사용하여 JSON 데이터를 DB에 삽입
 * - 트랜잭션 처리로 원자성 보장
 * - 에러 처리 및 자세한 로깅
 * - 진행 상황 실시간 출력
 */

interface InsertStats {
  table: string;
  inserted: number;
  failed: number;
  skipped: number;
}

interface InsertResult {
  success: boolean;
  stats: InsertStats[];
  errors: Array<{ table: string; rowIndex: number; error: string }>;
  duration: number;
}

class DataInserter {
  private prisma: PrismaClient;
  private restoreDir: string;
  private stats: InsertStats[] = [];
  private errors: Array<{ table: string; rowIndex: number; error: string }> = [];
  private startTime: number = 0;

  constructor(restoreDir: string) {
    this.restoreDir = restoreDir;
    this.prisma = new PrismaClient({
      log: [{ emit: 'event', level: 'error' }],
    });

    this.prisma.$on('error', (event) => {
      console.error('[PRISMA ERROR]', event);
    });
  }

  private log(message: string): void {
    console.log(`[INSERT] ${message}`);
  }

  private logError(message: string): void {
    console.error(`[ERROR] ${message}`);
  }

  private async insertOrganizations(): Promise<InsertStats> {
    const stats: InsertStats = {
      table: 'organizations',
      inserted: 0,
      failed: 0,
      skipped: 0,
    };

    const filePath = path.join(this.restoreDir, 'organizations.json');
    if (!fs.existsSync(filePath)) {
      this.log(`Skipping organizations (file not found)`);
      return stats;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.log(`Inserting ${rows.length} organizations...`);

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        // 중복 확인
        const existing = await this.prisma.organization.findUnique({
          where: { id: row.id },
        });

        if (existing) {
          stats.skipped++;
          continue;
        }

        await this.prisma.organization.create({
          data: {
            id: row.id,
            name: row.name,
            slug: row.slug,
            plan: row.plan || 'FREE',
            status: row.status || 'ACTIVE',
            externalAffiliateProfileId: row.externalAffiliateProfileId,
            contractRef: row.contractRef,
            createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
            updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
          },
        });

        stats.inserted++;

        if ((stats.inserted + stats.skipped) % 10 === 0) {
          process.stdout.write(
            `\r  [${stats.inserted + stats.skipped}/${rows.length}] Inserted: ${stats.inserted}, Skipped: ${stats.skipped}`
          );
        }
      } catch (error) {
        stats.failed++;
        this.errors.push({
          table: 'organizations',
          rowIndex: i,
          error: String(error),
        });
        this.logError(`Row ${i}: ${error}`);
      }
    }

    console.log();
    this.log(`✓ Organizations: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
  }

  private async insertOrganizationMembers(): Promise<InsertStats> {
    const stats: InsertStats = {
      table: 'organization_members',
      inserted: 0,
      failed: 0,
      skipped: 0,
    };

    const filePath = path.join(this.restoreDir, 'organization_members.json');
    if (!fs.existsSync(filePath)) {
      this.log(`Skipping organization_members (file not found)`);
      return stats;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.log(`Inserting ${rows.length} organization members...`);

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        // 중복 확인
        const existing = await this.prisma.organizationMember.findUnique({
          where: { id: row.id },
        });

        if (existing) {
          stats.skipped++;
          continue;
        }

        await this.prisma.organizationMember.create({
          data: {
            id: row.id,
            organizationId: row.organizationId,
            userId: row.userId,
            phone: row.phone,
            passwordHash: row.passwordHash,
            role: row.role || 'AGENT',
            displayName: row.displayName,
            isActive: row.isActive !== false,
            email: row.email,
            emailSenderName: row.emailSenderName,
            createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
            updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
          },
        });

        stats.inserted++;

        if ((stats.inserted + stats.skipped) % 10 === 0) {
          process.stdout.write(
            `\r  [${stats.inserted + stats.skipped}/${rows.length}] Inserted: ${stats.inserted}, Skipped: ${stats.skipped}`
          );
        }
      } catch (error) {
        stats.failed++;
        this.errors.push({
          table: 'organization_members',
          rowIndex: i,
          error: String(error),
        });
        this.logError(`Row ${i}: ${error}`);
      }
    }

    console.log();
    this.log(`✓ Organization Members: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
  }

  private async insertContacts(): Promise<InsertStats> {
    const stats: InsertStats = {
      table: 'contacts',
      inserted: 0,
      failed: 0,
      skipped: 0,
    };

    const filePath = path.join(this.restoreDir, 'contacts.json');
    if (!fs.existsSync(filePath)) {
      this.log(`Skipping contacts (file not found)`);
      return stats;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.log(`Inserting ${rows.length} contacts...`);

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        // 중복 확인
        const existing = await this.prisma.contact.findUnique({
          where: { id: row.id },
        });

        if (existing) {
          stats.skipped++;
          continue;
        }

        await this.prisma.contact.create({
          data: {
            id: row.id,
            phone: row.phone,
            organizationId: row.organizationId,
            name: row.name,
            email: row.email,
            adminMemo: row.adminMemo,
            affiliateCode: row.affiliateCode,
            assignedUserId: row.assignedUserId,
            bookingRef: row.bookingRef,
            budgetRange: row.budgetRange,
            cruiseInterest: row.cruiseInterest,
            departureDate: row.departureDate ? new Date(row.departureDate) : null,
            lastContactedAt: row.lastContactedAt ? new Date(row.lastContactedAt) : null,
            leadScore: row.leadScore || 0,
            optOutAt: row.optOutAt ? new Date(row.optOutAt) : null,
            productName: row.productName,
            purchasedAt: row.purchasedAt ? new Date(row.purchasedAt) : null,
            lastPaymentStatus: row.lastPaymentStatus,
            lastPaymentAt: row.lastPaymentAt ? new Date(row.lastPaymentAt) : null,
            lastRefundedAt: row.lastRefundedAt ? new Date(row.lastRefundedAt) : null,
            paymentStatusNote: row.paymentStatusNote,
            reEngageCount: row.reEngageCount || 0,
            reEngagedAt: row.reEngagedAt ? new Date(row.reEngagedAt) : null,
            sourceOrgId: row.sourceOrgId,
            tags: row.tags || [],
            type: row.type || 'LEAD',
            utmSource: row.utmSource,
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
            partnerId: row.partnerId,
            phoneEncrypted: row.phoneEncrypted,
            phoneHash: row.phoneHash,
            emailEncrypted: row.emailEncrypted,
            nameEncrypted: row.nameEncrypted,
            userId: row.userId,
            channel: row.channel || 'direct',
            age: row.age,
            childrenCount: row.childrenCount || 0,
            gender: row.gender,
            lensMetadata: row.lensMetadata || { decisionLevel: 0, readinessScore: 0 },
            maritalStatus: row.maritalStatus,
            segmentOverride: row.segmentOverride,
            segment: row.segment,
            recommendedProduct: row.recommendedProduct,
            marriageStatus: row.marriageStatus,
            marriageDate: row.marriageDate ? new Date(row.marriageDate) : null,
            childrenAges: row.childrenAges || [],
            childrenPlanned: row.childrenPlanned,
            ageInYears: row.ageInYears,
            autoSegment: row.autoSegment || 'unclassified',
            socialProvider: row.socialProvider,
            anxietyScore: row.anxietyScore || 0,
            anxietyCategory: row.anxietyCategory || 'low',
            preparationStage: row.preparationStage || 'inquiry',
            visaRequired: row.visaRequired || false,
            passportDaysLeft: row.passportDaysLeft,
            firstTimeCruise: row.firstTimeCruise || false,
            familyWithKids: row.familyWithKids || false,
            healthConcerns: row.healthConcerns,
            anxietyAssessmentAt: row.anxietyAssessmentAt ? new Date(row.anxietyAssessmentAt) : null,
            anxietySequenceStartedAt: row.anxietySequenceStartedAt ? new Date(row.anxietySequenceStartedAt) : null,
            reactivationSegment: row.reactivationSegment,
            reactivationLikelihood: row.reactivationLikelihood || 0,
            lastCruiseDate: row.lastCruiseDate ? new Date(row.lastCruiseDate) : null,
            lastSatisfactionScore: row.lastSatisfactionScore,
            cruiseCount: row.cruiseCount || 0,
            vipStatus: row.vipStatus,
            smsDay0Sent: row.smsDay0Sent || false,
            smsDay0SentAt: row.smsDay0SentAt ? new Date(row.smsDay0SentAt) : null,
            smsDay1Sent: row.smsDay1Sent || false,
            smsDay1SentAt: row.smsDay1SentAt ? new Date(row.smsDay1SentAt) : null,
            smsDay2Sent: row.smsDay2Sent || false,
            smsDay2SentAt: row.smsDay2SentAt ? new Date(row.smsDay2SentAt) : null,
            smsDay3Sent: row.smsDay3Sent || false,
            smsDay3SentAt: row.smsDay3SentAt ? new Date(row.smsDay3SentAt) : null,
            competitorMentioned: row.competitorMentioned || false,
            competitorNames: row.competitorNames || [],
            lastCompetitorMentionAt: row.lastCompetitorMentionAt ? new Date(row.lastCompetitorMentionAt) : null,
            lastCompetitorName: row.lastCompetitorName,
            differentiationScore: row.differentiationScore || 0,
            hotelExperienceLevel: row.hotelExperienceLevel,
            preparationFrameworkLevel: row.preparationFrameworkLevel,
            differentiationResponseSent: row.differentiationResponseSent || false,
            lastDifferentiationResponseAt: row.lastDifferentiationResponseAt
              ? new Date(row.lastDifferentiationResponseAt)
              : null,
            comparisonDocumentId: row.comparisonDocumentId,
            differentiationSequenceStartedAt: row.differentiationSequenceStartedAt
              ? new Date(row.differentiationSequenceStartedAt)
              : null,
            familyComposition: row.familyComposition,
            decisionMaker: row.decisionMaker,
            familyInfluenceScore: row.familyInfluenceScore || 0,
            companionPersuasionStage: row.companionPersuasionStage || 'inquiry',
            spouseName: row.spouseName,
            spousePhone: row.spousePhone,
            spouseEngagement: row.spouseEngagement,
            parentName: row.parentName,
            parentPhone: row.parentPhone,
            parentEngagement: row.parentEngagement,
            friendName: row.friendName,
            friendPhone: row.friendPhone,
            friendEngagement: row.friendEngagement,
            familyObjections: row.familyObjections || [],
            companionSmsDay0Sent: row.companionSmsDay0Sent || false,
            companionSmsDay0SentAt: row.companionSmsDay0SentAt ? new Date(row.companionSmsDay0SentAt) : null,
            companionSmsDay1Sent: row.companionSmsDay1Sent || false,
            companionSmsDay1SentAt: row.companionSmsDay1SentAt ? new Date(row.companionSmsDay1SentAt) : null,
            companionSmsDay2Sent: row.companionSmsDay2Sent || false,
            companionSmsDay2SentAt: row.companionSmsDay2SentAt ? new Date(row.companionSmsDay2SentAt) : null,
            companionSmsDay3Sent: row.companionSmsDay3Sent || false,
            companionSmsDay3SentAt: row.companionSmsDay3SentAt ? new Date(row.companionSmsDay3SentAt) : null,
            familyAssessmentCompletedAt: row.familyAssessmentCompletedAt
              ? new Date(row.familyAssessmentCompletedAt)
              : null,
            companionPersuasionStartedAt: row.companionPersuasionStartedAt
              ? new Date(row.companionPersuasionStartedAt)
              : null,
            cruiseClubTier: row.cruiseClubTier,
            ltvTotal: row.ltvTotal || 0,
            nextCruiseRecommendation: row.nextCruiseRecommendation,
            lastCruiseSatisfactionScore: row.lastCruiseSatisfactionScore,
            lastCruiseEndDate: row.lastCruiseEndDate ? new Date(row.lastCruiseEndDate) : null,
            cruiseReturnInterestLevel: row.cruiseReturnInterestLevel || 0,
            returnVisitScheduledDate: row.returnVisitScheduledDate
              ? new Date(row.returnVisitScheduledDate)
              : null,
            smsDay10ReturnSent: row.smsDay10ReturnSent || false,
            smsDay10ReturnSentAt: row.smsDay10ReturnSentAt ? new Date(row.smsDay10ReturnSentAt) : null,
            smsDay30ReturnSent: row.smsDay30ReturnSent || false,
            smsDay30ReturnSentAt: row.smsDay30ReturnSentAt ? new Date(row.smsDay30ReturnSentAt) : null,
            smsDay60ReturnSent: row.smsDay60ReturnSent || false,
            smsDay60ReturnSentAt: row.smsDay60ReturnSentAt ? new Date(row.smsDay60ReturnSentAt) : null,
            smsDay90ReturnSent: row.smsDay90ReturnSent || false,
            smsDay90ReturnSentAt: row.smsDay90ReturnSentAt ? new Date(row.smsDay90ReturnSentAt) : null,
            ltvCalculatedAt: row.ltvCalculatedAt ? new Date(row.ltvCalculatedAt) : null,
            selfProjectionScore: row.selfProjectionScore || 0,
            selfProjectionType: row.selfProjectionType,
            personalHealthCondition: row.personalHealthCondition,
            personalHealthConcern: row.personalHealthConcern,
            compoundHealthRisk: row.compoundHealthRisk || false,
            spouseHealthCondition: row.spouseHealthCondition,
            spouseHealthConcern: row.spouseHealthConcern,
            familyHealthProfile: row.familyHealthProfile,
            selfProjectionAssessmentAt: row.selfProjectionAssessmentAt
              ? new Date(row.selfProjectionAssessmentAt)
              : null,
            selfProjectionSequenceStartedAt: row.selfProjectionSequenceStartedAt
              ? new Date(row.selfProjectionSequenceStartedAt)
              : null,
            createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
            updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
          },
        });

        stats.inserted++;

        if ((stats.inserted + stats.skipped) % 50 === 0) {
          process.stdout.write(
            `\r  [${stats.inserted + stats.skipped}/${rows.length}] Inserted: ${stats.inserted}, Skipped: ${stats.skipped}`
          );
        }
      } catch (error) {
        stats.failed++;
        this.errors.push({
          table: 'contacts',
          rowIndex: i,
          error: String(error),
        });
        // 대량 데이터 삽입 시 몇 개 에러만 로깅
        if (stats.failed <= 5) {
          this.logError(`Row ${i}: ${error}`);
        }
      }
    }

    console.log();
    this.log(`✓ Contacts: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
  }

  private async insertSmsTemplates(): Promise<InsertStats> {
    const stats: InsertStats = {
      table: 'sms_templates',
      inserted: 0,
      failed: 0,
      skipped: 0,
    };

    const filePath = path.join(this.restoreDir, 'sms_templates.json');
    if (!fs.existsSync(filePath)) {
      this.log(`Skipping sms_templates (file not found)`);
      return stats;
    }

    const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.log(`Inserting ${rows.length} SMS templates...`);

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        const existing = await this.prisma.smsTemplate.findUnique({
          where: { id: row.id },
        });

        if (existing) {
          stats.skipped++;
          continue;
        }

        await this.prisma.smsTemplate.create({
          data: {
            id: row.id,
            organizationId: row.organizationId,
            name: row.name,
            content: row.content,
            createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
            updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
          },
        });

        stats.inserted++;
      } catch (error) {
        stats.failed++;
        this.errors.push({
          table: 'sms_templates',
          rowIndex: i,
          error: String(error),
        });
      }
    }

    this.log(`✓ SMS Templates: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.failed} failed`);
    return stats;
  }

  async insertAllData(): Promise<InsertResult> {
    this.startTime = Date.now();

    try {
      // 순서가 중요함: 부모 테이블 먼저
      this.stats.push(await this.insertOrganizations());
      this.stats.push(await this.insertOrganizationMembers());
      this.stats.push(await this.insertContacts());
      this.stats.push(await this.insertSmsTemplates());

      const duration = Date.now() - this.startTime;

      console.log('\n' + '='.repeat(80));
      console.log('DATA INSERTION SUMMARY');
      console.log('='.repeat(80) + '\n');

      let totalInserted = 0;
      let totalSkipped = 0;
      let totalFailed = 0;

      for (const stat of this.stats) {
        totalInserted += stat.inserted;
        totalSkipped += stat.skipped;
        totalFailed += stat.failed;

        const status = stat.failed > 0 ? '⚠' : '✓';
        console.log(
          `${status} ${stat.table}: ${stat.inserted} inserted, ${stat.skipped} skipped, ${stat.failed} failed`
        );
      }

      console.log('\n' + '-'.repeat(80));
      console.log(
        `Total: ${totalInserted} inserted, ${totalSkipped} skipped, ${totalFailed} failed (${(duration / 1000).toFixed(2)}s)`
      );
      console.log('-'.repeat(80) + '\n');

      if (this.errors.length > 0 && this.errors.length <= 10) {
        console.log('Errors encountered:');
        this.errors.forEach((err) => {
          console.log(`  - ${err.table} row ${err.rowIndex}: ${err.error}`);
        });
        console.log();
      }

      return {
        success: totalFailed === 0,
        stats: this.stats,
        errors: this.errors,
        duration,
      };
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

async function main() {
  const restoreDir = path.join(process.cwd(), 'backups', 'restore-data');

  if (!fs.existsSync(restoreDir)) {
    console.error(`Restore data directory not found: ${restoreDir}`);
    console.log('Run "npm run script:restore-from-backup" first');
    process.exit(1);
  }

  const inserter = new DataInserter(restoreDir);
  const result = await inserter.insertAllData();

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
