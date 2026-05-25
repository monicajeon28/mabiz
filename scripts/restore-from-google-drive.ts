import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

/**
 * Google Drive Excel 백업 파일을 JSON으로 변환하는 스크립트
 *
 * 사용:
 *   npx ts-node scripts/restore-from-google-drive.ts
 *
 * 입력: backups/google-drive-backup-2026-05-25/*.xlsx
 * 출력: backups/restore-data/*.json
 */

interface RestoreConfig {
  inputDir: string;
  outputDir: string;
  encoding: string;
  verbose: boolean;
}

interface SheetMapping {
  sheetName: string;
  outputFile: string;
  idField: string;
  dateFields: string[];
  jsonFields: string[]; // JSON으로 파싱할 필드
  booleanFields: string[];
  integerFields: string[];
  arrayFields: string[]; // 쉼표 구분 배열로 변환할 필드
}

const SHEET_MAPPINGS: SheetMapping[] = [
  {
    sheetName: 'organizations',
    outputFile: 'organizations.json',
    idField: 'id',
    dateFields: ['createdAt', 'updatedAt'],
    jsonFields: [],
    booleanFields: [],
    integerFields: [],
    arrayFields: [],
  },
  {
    sheetName: 'organization_members',
    outputFile: 'organization_members.json',
    idField: 'id',
    dateFields: ['createdAt', 'updatedAt'],
    jsonFields: [],
    booleanFields: ['isActive'],
    integerFields: [],
    arrayFields: [],
  },
  {
    sheetName: 'contacts',
    outputFile: 'contacts.json',
    idField: 'id',
    dateFields: [
      'createdAt',
      'updatedAt',
      'departureDate',
      'lastContactedAt',
      'optOutAt',
      'purchasedAt',
      'lastPaymentAt',
      'lastRefundedAt',
      'reEngagedAt',
      'deletedAt',
      'segmentUpdatedAt',
      'anxietyAssessmentAt',
      'anxietySequenceStartedAt',
      'lastCruiseDate',
      'smsDay0SentAt',
      'smsDay1SentAt',
      'smsDay2SentAt',
      'smsDay3SentAt',
      'lastDifferentiationResponseAt',
      'differentiationSequenceStartedAt',
      'lastCompetitorMentionAt',
      'companionSmsDay0SentAt',
      'companionSmsDay1SentAt',
      'companionSmsDay2SentAt',
      'companionSmsDay3SentAt',
      'familyAssessmentCompletedAt',
      'companionPersuasionStartedAt',
      'lastCruiseEndDate',
      'returnVisitScheduledDate',
      'smsDay10ReturnSentAt',
      'smsDay30ReturnSentAt',
      'smsDay60ReturnSentAt',
      'smsDay90ReturnSentAt',
      'ltvCalculatedAt',
      'selfProjectionAssessmentAt',
      'selfProjectionSequenceStartedAt',
    ],
    jsonFields: ['lensMetadata', 'familyHealthProfile'],
    booleanFields: [
      'visaRequired',
      'firstTimeCruise',
      'familyWithKids',
      'compoundHealthRisk',
      'competitorMentioned',
      'differentiationResponseSent',
    ],
    integerFields: [
      'leadScore',
      'reEngageCount',
      'age',
      'childrenCount',
      'ageInYears',
      'anxietyScore',
      'passportDaysLeft',
      'reactivationLikelihood',
      'cruiseCount',
      'differentiationScore',
      'familyInfluenceScore',
      'cruiseReturnInterestLevel',
      'ltvTotal',
      'lastCruiseSatisfactionScore',
      'selfProjectionScore',
    ],
    arrayFields: [
      'tags',
      'competitorNames',
      'healthConcerns',
      'personalHealthConcern',
      'spouseHealthConcern',
      'familyObjections',
      'childrenAges',
    ],
  },
  {
    sheetName: 'contact_groups',
    outputFile: 'contact_groups.json',
    idField: 'id',
    dateFields: ['createdAt', 'updatedAt'],
    jsonFields: [],
    booleanFields: [],
    integerFields: [],
    arrayFields: [],
  },
  {
    sheetName: 'contact_lens_classifications',
    outputFile: 'contact_lens_classifications.json',
    idField: 'id',
    dateFields: ['createdAt', 'updatedAt', 'appliedAt'],
    jsonFields: ['metadata'],
    booleanFields: ['isActive'],
    integerFields: ['score'],
    arrayFields: [],
  },
  {
    sheetName: 'sms_templates',
    outputFile: 'sms_templates.json',
    idField: 'id',
    dateFields: ['createdAt', 'updatedAt'],
    jsonFields: [],
    booleanFields: [],
    integerFields: [],
    arrayFields: [],
  },
  {
    sheetName: 'scheduled_sms',
    outputFile: 'scheduled_sms.json',
    idField: 'id',
    dateFields: ['createdAt', 'updatedAt', 'scheduledAt', 'sentAt'],
    jsonFields: [],
    booleanFields: ['isSent'],
    integerFields: [],
    arrayFields: ['recipientPhone'],
  },
  {
    sheetName: 'gm_users',
    outputFile: 'gm_users.json',
    idField: 'id',
    dateFields: ['createdAt', 'updatedAt'],
    jsonFields: [],
    booleanFields: [],
    integerFields: ['id'],
    arrayFields: [],
  },
];

class GoogleDriveRestorer {
  private config: RestoreConfig;
  private idMappings: Map<string, Map<string, string>> = new Map(); // { table: { oldId: newId } }

  constructor(config: RestoreConfig) {
    this.config = config;
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
      this.log(`Created output directory: ${this.config.outputDir}`);
    }
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[RESTORE] ${message}`);
    }
  }

  private findInputFile(filename: string): string | null {
    if (fs.existsSync(filename)) {
      return filename;
    }

    const possibleNames = [
      filename,
      filename.replace('.xlsx', '.xls'),
      path.join(this.config.inputDir, path.basename(filename)),
      path.join(this.config.inputDir, path.basename(filename).replace('.xlsx', '.xls')),
    ];

    for (const name of possibleNames) {
      if (fs.existsSync(name)) {
        return name;
      }
    }

    return null;
  }

  private convertValue(value: any, field: string, mapping: SheetMapping): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // 날짜 필드 처리
    if (mapping.dateFields.includes(field)) {
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      // Excel 숫자 형식 (Serial Date)
      if (typeof value === 'number') {
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        return excelDate.toISOString();
      }
      return null;
    }

    // Boolean 필드 처리
    if (mapping.booleanFields.includes(field)) {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
      }
      return Boolean(value);
    }

    // Integer 필드 처리
    if (mapping.integerFields.includes(field)) {
      const num = parseInt(String(value), 10);
      return isNaN(num) ? 0 : num;
    }

    // JSON 필드 처리
    if (mapping.jsonFields.includes(field)) {
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          this.log(`Warning: Failed to parse JSON field ${field}: ${value}`);
          return {};
        }
      }
      return {};
    }

    // Array 필드 처리 (쉼표 구분)
    if (mapping.arrayFields.includes(field)) {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
      }
      return [];
    }

    // 기본값: 문자열
    return String(value).trim();
  }

  private readSheet(workbook: XLSX.WorkBook, sheetName: string): any[] {
    try {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        this.log(`Warning: Sheet "${sheetName}" not found`);
        return [];
      }

      const data = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        blankrows: false,
      });

      return data;
    } catch (error) {
      console.error(`Error reading sheet "${sheetName}":`, error);
      return [];
    }
  }

  private processRows(rows: any[], mapping: SheetMapping): any[] {
    return rows
      .filter((row) => row[mapping.idField]) // ID가 없는 행 제외
      .map((row) => {
        const processed: any = {};

        for (const [key, value] of Object.entries(row)) {
          const cleanKey = String(key).trim();
          processed[cleanKey] = this.convertValue(value, cleanKey, mapping);
        }

        return processed;
      });
  }

  async restoreFromExcel(): Promise<void> {
    const inputFile = this.findInputFile(path.join(this.config.inputDir, '*'));

    // 가장 최신 백업 파일 찾기
    const backupDir = this.config.inputDir;
    if (!fs.existsSync(backupDir)) {
      console.error(`Backup directory not found: ${backupDir}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.xlsx') || f.endsWith('.xls'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error(`No backup files found in ${backupDir}`);
      process.exit(1);
    }

    const latestBackupFile = path.join(backupDir, files[0]);
    this.log(`Using backup file: ${latestBackupFile}`);

    try {
      const workbook = XLSX.readFile(latestBackupFile, { cellDates: true });
      this.log(`Loaded workbook with sheets: ${workbook.SheetNames.join(', ')}`);

      for (const mapping of SHEET_MAPPINGS) {
        const rows = this.readSheet(workbook, mapping.sheetName);
        if (rows.length === 0) {
          this.log(`Skipping empty sheet: ${mapping.sheetName}`);
          continue;
        }

        const processed = this.processRows(rows, mapping);
        const outputPath = path.join(this.config.outputDir, mapping.outputFile);

        fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2), {
          encoding: this.config.encoding,
        });

        this.log(`✓ Converted ${mapping.sheetName} (${rows.length} rows) -> ${mapping.outputFile}`);
      }

      console.log('\n✓ All Excel files converted successfully');
    } catch (error) {
      console.error('Error processing Excel file:', error);
      process.exit(1);
    }
  }
}

async function main() {
  const config: RestoreConfig = {
    inputDir: path.join(process.cwd(), 'backups', 'google-drive-backup-latest'),
    outputDir: path.join(process.cwd(), 'backups', 'restore-data'),
    encoding: 'utf-8',
    verbose: true,
  };

  const restorer = new GoogleDriveRestorer(config);
  await restorer.restoreFromExcel();
}

main().catch(console.error);
