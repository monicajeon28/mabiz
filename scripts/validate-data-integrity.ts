import fs from 'fs';
import path from 'path';

/**
 * 복원된 데이터의 정합성을 검증하는 스크립트
 *
 * 사용:
 *   npx ts-node scripts/validate-data-integrity.ts
 *
 * 검증 항목:
 * - 외래키 참조 유효성
 * - 중복 데이터 검사
 * - NULL 값 검증
 * - 타입 검증
 */

interface ValidationResult {
  tableName: string;
  totalRows: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  rowIndex: number;
  field: string;
  error: string;
}

interface ValidationWarning {
  rowIndex: number;
  field: string;
  warning: string;
}

interface ForeignKeyConstraint {
  field: string;
  references: { table: string; idField: string };
}

interface TableSchema {
  idField: string;
  requiredFields: string[];
  foreignKeys: ForeignKeyConstraint[];
  uniqueFields: string[];
  dateFields: string[];
  booleanFields: string[];
  integerFields: string[];
  floatFields: string[];
}

const TABLE_SCHEMAS: Record<string, TableSchema> = {
  organizations: {
    idField: 'id',
    requiredFields: ['id', 'name', 'slug'],
    foreignKeys: [],
    uniqueFields: ['slug'],
    dateFields: ['createdAt', 'updatedAt'],
    booleanFields: [],
    integerFields: [],
    floatFields: [],
  },
  organization_members: {
    idField: 'id',
    requiredFields: ['id', 'organizationId', 'userId'],
    foreignKeys: [
      { field: 'organizationId', references: { table: 'organizations', idField: 'id' } },
    ],
    uniqueFields: [],
    dateFields: ['createdAt', 'updatedAt'],
    booleanFields: ['isActive'],
    integerFields: [],
    floatFields: [],
  },
  contacts: {
    idField: 'id',
    requiredFields: ['id', 'phone', 'organizationId'],
    foreignKeys: [
      { field: 'organizationId', references: { table: 'organizations', idField: 'id' } },
    ],
    uniqueFields: [],
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
    ],
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
      'differentiationScore',
      'familyInfluenceScore',
      'cruiseReturnInterestLevel',
      'lastCruiseSatisfactionScore',
      'selfProjectionScore',
    ],
    floatFields: ['ltvTotal'],
  },
  contact_lens_classifications: {
    idField: 'id',
    requiredFields: ['id', 'contactId', 'organizationId', 'lensType'],
    foreignKeys: [
      { field: 'contactId', references: { table: 'contacts', idField: 'id' } },
      { field: 'organizationId', references: { table: 'organizations', idField: 'id' } },
    ],
    uniqueFields: [],
    dateFields: ['createdAt', 'updatedAt', 'appliedAt'],
    booleanFields: ['isActive'],
    integerFields: ['score'],
    floatFields: [],
  },
  sms_templates: {
    idField: 'id',
    requiredFields: ['id', 'organizationId', 'name'],
    foreignKeys: [
      { field: 'organizationId', references: { table: 'organizations', idField: 'id' } },
    ],
    uniqueFields: [],
    dateFields: ['createdAt', 'updatedAt'],
    booleanFields: [],
    integerFields: [],
    floatFields: [],
  },
  scheduled_sms: {
    idField: 'id',
    requiredFields: ['id', 'organizationId'],
    foreignKeys: [
      { field: 'organizationId', references: { table: 'organizations', idField: 'id' } },
    ],
    uniqueFields: [],
    dateFields: ['createdAt', 'updatedAt', 'scheduledAt', 'sentAt'],
    booleanFields: ['isSent'],
    integerFields: [],
    floatFields: [],
  },
  gm_users: {
    idField: 'id',
    requiredFields: ['id'],
    foreignKeys: [],
    uniqueFields: [],
    dateFields: ['createdAt', 'updatedAt'],
    booleanFields: [],
    integerFields: ['id'],
    floatFields: [],
  },
};

class DataValidator {
  private restoreDir: string;
  private data: Record<string, any[]> = {};
  private results: ValidationResult[] = [];

  constructor(restoreDir: string) {
    this.restoreDir = restoreDir;
  }

  private log(message: string): void {
    console.log(`[VALIDATE] ${message}`);
  }

  private loadData(): void {
    this.log('Loading data files...');

    for (const [tableName] of Object.entries(TABLE_SCHEMAS)) {
      const jsonFile = path.join(
        this.restoreDir,
        `${tableName.replace(/_/g, '_')}.json`
      );

      // 파일명 변환 (contacts -> contacts.json)
      const jsonFileName = tableName
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');

      const possibleNames = [
        path.join(this.restoreDir, `${tableName}.json`),
        path.join(this.restoreDir, `${jsonFileName}.json`),
      ];

      let found = false;
      for (const fname of possibleNames) {
        if (fs.existsSync(fname)) {
          try {
            const content = fs.readFileSync(fname, 'utf-8');
            this.data[tableName] = JSON.parse(content);
            this.log(`✓ Loaded ${tableName} (${this.data[tableName].length} rows)`);
            found = true;
            break;
          } catch (error) {
            console.error(`Error loading ${fname}:`, error);
          }
        }
      }

      if (!found) {
        this.log(`⚠ Skipping ${tableName} (file not found)`);
      }
    }
  }

  private validateRequiredFields(tableName: string, schema: TableSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    const rows = this.data[tableName] || [];

    rows.forEach((row, rowIndex) => {
      schema.requiredFields.forEach((field) => {
        if (row[field] === null || row[field] === undefined || row[field] === '') {
          errors.push({
            rowIndex,
            field,
            error: `Required field "${field}" is missing or empty`,
          });
        }
      });
    });

    return errors;
  }

  private validateForeignKeys(tableName: string, schema: TableSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    const rows = this.data[tableName] || [];

    schema.foreignKeys.forEach((fk) => {
      const refTable = fk.references.table;
      const refIdField = fk.references.idField;
      const refData = this.data[refTable];

      if (!refData) {
        this.log(`⚠ Reference table "${refTable}" not loaded, skipping FK validation for ${fk.field}`);
        return;
      }

      const validIds = new Set(refData.map((row: any) => row[refIdField]));

      rows.forEach((row, rowIndex) => {
        const value = row[fk.field];

        if (value !== null && value !== undefined && value !== '') {
          if (!validIds.has(value)) {
            errors.push({
              rowIndex,
              field: fk.field,
              error: `Foreign key constraint violated: ${fk.field}="${value}" not found in ${refTable}.${refIdField}`,
            });
          }
        }
      });
    });

    return errors;
  }

  private validateUniques(tableName: string, schema: TableSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    const rows = this.data[tableName] || [];

    schema.uniqueFields.forEach((field) => {
      const seen = new Set<any>();

      rows.forEach((row, rowIndex) => {
        const value = row[field];

        if (value !== null && value !== undefined && value !== '') {
          if (seen.has(value)) {
            errors.push({
              rowIndex,
              field,
              error: `Unique constraint violated: "${field}" value "${value}" is duplicated`,
            });
          }
          seen.add(value);
        }
      });
    });

    return errors;
  }

  private validateDataTypes(tableName: string, schema: TableSchema): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const rows = this.data[tableName] || [];

    rows.forEach((row, rowIndex) => {
      // Boolean 타입 검증
      schema.booleanFields.forEach((field) => {
        const value = row[field];
        if (value !== null && value !== undefined && typeof value !== 'boolean') {
          warnings.push({
            rowIndex,
            field,
            warning: `Expected boolean, got ${typeof value}: ${value}`,
          });
        }
      });

      // Integer 타입 검증
      schema.integerFields.forEach((field) => {
        const value = row[field];
        if (value !== null && value !== undefined && !Number.isInteger(value)) {
          warnings.push({
            rowIndex,
            field,
            warning: `Expected integer, got ${typeof value}: ${value}`,
          });
        }
      });

      // Float 타입 검증
      schema.floatFields.forEach((field) => {
        const value = row[field];
        if (value !== null && value !== undefined && typeof value !== 'number') {
          warnings.push({
            rowIndex,
            field,
            warning: `Expected number, got ${typeof value}: ${value}`,
          });
        }
      });

      // Date 타입 검증
      schema.dateFields.forEach((field) => {
        const value = row[field];
        if (value !== null && value !== undefined && typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            warnings.push({
              rowIndex,
              field,
              warning: `Invalid date format: ${value}`,
            });
          }
        }
      });
    });

    return warnings;
  }

  async validate(): Promise<boolean> {
    this.loadData();

    if (Object.keys(this.data).length === 0) {
      console.error('No data files loaded');
      return false;
    }

    let hasErrors = false;

    for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
      if (!this.data[tableName]) {
        this.log(`Skipping validation for ${tableName} (not loaded)`);
        continue;
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // 필수 필드 검증
      errors.push(...this.validateRequiredFields(tableName, schema));

      // 외래키 검증
      errors.push(...this.validateForeignKeys(tableName, schema));

      // 고유성 검증
      errors.push(...this.validateUniques(tableName, schema));

      // 데이터 타입 검증
      warnings.push(...this.validateDataTypes(tableName, schema));

      const result: ValidationResult = {
        tableName,
        totalRows: this.data[tableName].length,
        errors,
        warnings,
      };

      this.results.push(result);

      if (errors.length > 0) {
        hasErrors = true;
      }
    }

    this.printResults();
    return !hasErrors;
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('DATA INTEGRITY VALIDATION REPORT');
    console.log('='.repeat(80) + '\n');

    let totalRows = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const result of this.results) {
      totalRows += result.totalRows;
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;

      const status =
        result.errors.length > 0 ? '✗ FAILED' : result.warnings.length > 0 ? '⚠ WARNING' : '✓ OK';

      console.log(`${status} ${result.tableName} (${result.totalRows} rows)`);

      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
        result.errors.slice(0, 5).forEach((err) => {
          console.log(`    - Row ${err.rowIndex}: ${err.field} - ${err.error}`);
        });
        if (result.errors.length > 5) {
          console.log(`    ... and ${result.errors.length - 5} more errors`);
        }
      }

      if (result.warnings.length > 0) {
        console.log(`  Warnings: ${result.warnings.length}`);
        result.warnings.slice(0, 3).forEach((warn) => {
          console.log(`    - Row ${warn.rowIndex}: ${warn.field} - ${warn.warning}`);
        });
        if (result.warnings.length > 3) {
          console.log(`    ... and ${result.warnings.length - 3} more warnings`);
        }
      }

      console.log();
    }

    console.log('='.repeat(80));
    console.log(`SUMMARY: ${totalRows} total rows | ${totalErrors} errors | ${totalWarnings} warnings`);
    console.log('='.repeat(80) + '\n');

    if (totalErrors > 0) {
      console.log('❌ Validation FAILED - Fix errors before proceeding');
      process.exit(1);
    } else if (totalWarnings > 0) {
      console.log('⚠️  Validation passed with warnings - Review before proceeding');
      process.exit(0);
    } else {
      console.log('✓ Validation PASSED - All data is consistent');
      process.exit(0);
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

  const validator = new DataValidator(restoreDir);
  const isValid = await validator.validate();

  process.exit(isValid ? 0 : 1);
}

main().catch(console.error);
