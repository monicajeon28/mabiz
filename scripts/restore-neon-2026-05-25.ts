import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { Pool, PoolClient } from 'pg';

/**
 * Restore Backup_2026-05-25 xlsx files to Neon PostgreSQL
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx ts-node scripts/restore-neon-2026-05-25.ts
 *
 * Files structure:
 *   - Downloads from: backups/neon-restore-2026-05-25/
 *   - Supported tables: 16 xlsx files with cruise/travel data
 */

interface TableMapping {
  excelFile: string;
  sheetName: string;
  dbTable: string;
  idField: string;
  columnMappings: { [excelCol: string]: string }; // Excel column -> DB column
  columnTypes: { [dbCol: string]: 'string' | 'integer' | 'float' | 'boolean' | 'timestamp' | 'json' | 'text' };
}

// Table mappings
const TABLE_MAPPINGS: TableMapping[] = [
  {
    excelFile: 'User_2026-05-25_15-00-47.xlsx',
    sheetName: 'User',
    dbTable: 'GmUser',
    idField: 'id',
    columnMappings: {},
    columnTypes: {
      id: 'integer',
      externalId: 'string',
      name: 'string',
      email: 'string',
      phone: 'string',
      password: 'string',
      onboarded: 'boolean',
      loginCount: 'integer',
      tripCount: 'integer',
      totalTripCount: 'integer',
      currentTripEndDate: 'timestamp',
      role: 'string',
      onboardingUpdatedAt: 'timestamp',
      onboardingUpdatedByUser: 'boolean',
      lastActiveAt: 'timestamp',
      hibernatedAt: 'timestamp',
      isHibernated: 'boolean',
      isLocked: 'boolean',
      lockedAt: 'timestamp',
      lockedReason: 'string',
      customerStatus: 'string',
      testModeStartedAt: 'timestamp',
      customerSource: 'string',
      adminMemo: 'text',
      mallUserId: 'string',
      mallNickname: 'string',
      genieStatus: 'string',
      genieLinkedAt: 'timestamp',
      kakaoChannelAdded: 'boolean',
      kakaoChannelAddedAt: 'timestamp',
      createdAt: 'timestamp',
      updatedAt: 'timestamp',
      pwaGenieInstalledAt: 'timestamp',
      pwaMallInstalledAt: 'timestamp',
      refundCertificateCount: 'integer',
      grade: 'string',
      isPasswordSet: 'boolean',
      goldMemberId: 'integer',
      passwordResetToken: 'string',
      passwordResetTokenExpiresAt: 'timestamp',
      sourceAgentId: 'integer',
      affiliateCode: 'string',
      socialEmail: 'string',
      socialId: 'string',
      socialProvider: 'string',
      socialProfileImg: 'string',
      customerGroupId: 'integer',
      nextActionDate: 'timestamp',
      nextActionNote: 'string',
      memberStatus: 'string',
    },
  },
  {
    excelFile: 'Trip_2026-05-25_15-00-49.xlsx',
    sheetName: 'Trip',
    dbTable: 'GmTrip',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'Reservation_2026-05-25_15-00-50.xlsx',
    sheetName: 'Reservation',
    dbTable: 'GmReservation',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'Traveler_2026-05-25_15-00-52.xlsx',
    sheetName: 'Traveler',
    dbTable: 'GmTraveler',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'AffiliateProfile_2026-05-25_15-00-53.xlsx',
    sheetName: 'AffiliateProfile',
    dbTable: 'GmAffiliateProfile',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'AffiliateSale_2026-05-25_15-00-55.xlsx',
    sheetName: 'AffiliateSale',
    dbTable: 'AffiliateSale',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'AffiliateLead_2026-05-25_15-00-57.xlsx',
    sheetName: 'AffiliateLead',
    dbTable: 'GmAffiliateLead',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'AffiliateProduct_2026-05-25_15-00-58.xlsx',
    sheetName: 'AffiliateProduct',
    dbTable: 'AffiliateProduct',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'AffiliateLedger_2026-05-25_15-01-00.xlsx',
    sheetName: 'AffiliateLedger',
    dbTable: 'AffiliateLedger',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'AdminActionLog_2026-05-25_15-01-03.xlsx',
    sheetName: 'AdminActionLog',
    dbTable: 'AdminActionLog',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'CruiseProduct_2026-05-25_15-01-05.xlsx',
    sheetName: 'CruiseProduct',
    dbTable: 'CruiseProduct',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'ProductPricePeriod_2026-05-25_15-01-06.xlsx',
    sheetName: 'ProductPricePeriod',
    dbTable: 'ProductPricePeriod',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'ProductCabinPrice_2026-05-25_15-01-08.xlsx',
    sheetName: 'ProductCabinPrice',
    dbTable: 'ProductCabinPrice',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'ProductImage_2026-05-25_15-01-10.xlsx',
    sheetName: 'ProductImage',
    dbTable: 'ProductImage',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
  {
    excelFile: 'PassportSubmission_2026-05-25_15-01-02.xlsx',
    sheetName: 'PassportSubmission',
    dbTable: 'GmPassportSubmission',
    idField: 'id',
    columnMappings: {},
    columnTypes: {},
  },
];

interface RestoreResult {
  table: string;
  file: string;
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsFailed: number;
  error?: string;
}

class NeonRestorer {
  private backupDir: string;
  private pool: Pool;
  private results: RestoreResult[] = [];

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    this.backupDir = path.join(process.cwd(), 'backups', 'neon-restore-2026-05-25');
    this.pool = new Pool({ connectionString: dbUrl });
  }

  private convertValue(value: any, columnType: string): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    try {
      switch (columnType) {
        case 'integer':
          return parseInt(String(value), 10) || null;

        case 'float':
          return parseFloat(String(value)) || null;

        case 'boolean':
          if (typeof value === 'boolean') return value;
          const str = String(value).toLowerCase();
          return str === 'true' || str === '1' || str === 'yes';

        case 'timestamp':
          if (typeof value === 'string') {
            const date = new Date(value);
            return isNaN(date.getTime()) ? null : date.toISOString();
          }
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (typeof value === 'number') {
            // Excel serial date
            const excelDate = new Date((value - 25569) * 86400 * 1000);
            return excelDate.toISOString();
          }
          return null;

        case 'json':
          if (typeof value === 'object') return value;
          if (typeof value === 'string') {
            return JSON.parse(value);
          }
          return null;

        case 'text':
        case 'string':
        default:
          return String(value).trim();
      }
    } catch {
      return null;
    }
  }

  private parseExcelFile(mapping: TableMapping): any[] {
    const filePath = path.join(this.backupDir, mapping.excelFile);

    if (!fs.existsSync(filePath)) {
      console.warn(`[PARSE] ⚠️  File not found: ${mapping.excelFile}`);
      return [];
    }

    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const worksheet = workbook.Sheets[mapping.sheetName];

      if (!worksheet) {
        console.warn(`[PARSE] ⚠️  Sheet not found: ${mapping.sheetName}`);
        return [];
      }

      const data = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        blankrows: false,
      });

      console.log(`[PARSE] ✓ Parsed ${mapping.excelFile}: ${data.length} rows`);
      return data;
    } catch (error) {
      console.error(`[PARSE] ✗ Error parsing ${mapping.excelFile}:`, error);
      return [];
    }
  }

  private async insertBatch(
    client: PoolClient,
    table: string,
    mapping: TableMapping,
    rows: any[]
  ): Promise<{ inserted: number; skipped: number; failed: number }> {
    if (rows.length === 0) {
      return { inserted: 0, skipped: 0, failed: 0 };
    }

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    // Get columns from first row
    const columns = Object.keys(rows[0]).filter(col => col && col.trim().length > 0);

    for (const row of rows) {
      try {
        // Build insert query
        const insertCols = [];
        const insertVals = [];
        const params: any[] = [];
        let paramIdx = 1;

        for (const col of columns) {
          const dbCol = mapping.columnMappings[col] || col;
          const dbType = mapping.columnTypes[dbCol] || 'string';
          const value = this.convertValue(row[col], dbType);

          if (value !== undefined) {
            insertCols.push(`"${dbCol}"`);
            insertVals.push(`$${paramIdx++}`);
            params.push(value);
          }
        }

        if (insertCols.length === 0) {
          failed++;
          continue;
        }

        const query = `
          INSERT INTO "${table}" (${insertCols.join(',')})
          VALUES (${insertVals.join(',')})
          ON CONFLICT (${mapping.idField}) DO UPDATE SET
            ${insertCols.map((col, i) => `${col} = $${i + 1}`).join(',')}
          RETURNING ${mapping.idField};
        `;

        await client.query(query, params);
        inserted++;
      } catch (error: any) {
        if (error.code === '23505') {
          // Duplicate key
          skipped++;
        } else {
          console.error(`[INSERT] ✗ Error inserting row:`, error.message);
          failed++;
        }
      }
    }

    return { inserted, skipped, failed };
  }

  async restoreTable(mapping: TableMapping): Promise<RestoreResult> {
    const result: RestoreResult = {
      table: mapping.dbTable,
      file: mapping.excelFile,
      rowsRead: 0,
      rowsInserted: 0,
      rowsSkipped: 0,
      rowsFailed: 0,
    };

    try {
      console.log(`\n[RESTORE] Processing ${mapping.dbTable}...`);

      // Parse Excel file
      const rows = this.parseExcelFile(mapping);
      result.rowsRead = rows.length;

      if (rows.length === 0) {
        console.log(`[RESTORE] ℹ️  No data to restore for ${mapping.dbTable}`);
        return result;
      }

      // Insert into database in batches
      const client = await this.pool.connect();

      try {
        const BATCH_SIZE = 100;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));
          const { inserted, skipped, failed } = await this.insertBatch(client, mapping.dbTable, mapping, batch);

          result.rowsInserted += inserted;
          result.rowsSkipped += skipped;
          result.rowsFailed += failed;

          const progress = Math.min(i + BATCH_SIZE, rows.length);
          console.log(`[INSERT] Progress: ${progress}/${rows.length} (${inserted} inserted, ${skipped} skipped, ${failed} failed)`);
        }
      } finally {
        client.release();
      }

      console.log(`[RESTORE] ✓ ${mapping.dbTable}: ${result.rowsInserted} inserted, ${result.rowsSkipped} skipped, ${result.rowsFailed} failed`);
    } catch (error: any) {
      console.error(`[RESTORE] ✗ Error restoring ${mapping.dbTable}:`, error.message);
      result.error = error.message;
    }

    return result;
  }

  async restore(): Promise<void> {
    console.log('='.repeat(70));
    console.log('Neon PostgreSQL Restoration - Backup 2026-05-25');
    console.log('='.repeat(70));
    console.log(`\nBackup directory: ${this.backupDir}\n`);

    // Restore each table
    for (const mapping of TABLE_MAPPINGS) {
      const result = await this.restoreTable(mapping);
      this.results.push(result);
    }

    // Generate report
    await this.printReport();

    // Verify and close
    await this.verify();
    await this.pool.end();
  }

  private async printReport(): Promise<void> {
    console.log('\n' + '='.repeat(70));
    console.log('RESTORATION REPORT');
    console.log('='.repeat(70) + '\n');

    let totalRead = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const result of this.results) {
      const status = result.error ? '✗' : '✓';
      console.log(`${status} ${result.table}`);
      console.log(`  File: ${result.file}`);
      console.log(`  Read: ${result.rowsRead} | Inserted: ${result.rowsInserted} | Skipped: ${result.rowsSkipped} | Failed: ${result.rowsFailed}`);

      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }

      totalRead += result.rowsRead;
      totalInserted += result.rowsInserted;
      totalSkipped += result.rowsSkipped;
      totalFailed += result.rowsFailed;
    }

    console.log(`\n${'-'.repeat(70)}`);
    console.log(`TOTAL: ${totalRead} read | ${totalInserted} inserted | ${totalSkipped} skipped | ${totalFailed} failed`);
    console.log(`${'-'.repeat(70)}\n`);
  }

  private async verify(): Promise<void> {
    console.log('='.repeat(70));
    console.log('DATABASE VERIFICATION');
    console.log('='.repeat(70) + '\n');

    try {
      for (const mapping of TABLE_MAPPINGS) {
        try {
          const result = await this.pool.query(`SELECT COUNT(*) as count FROM "${mapping.dbTable}"`);
          const count = result.rows[0]?.count || 0;
          console.log(`${mapping.dbTable}: ${count} records`);
        } catch (error: any) {
          if (error.code === '42P01') {
            console.log(`${mapping.dbTable}: TABLE NOT FOUND`);
          } else {
            console.error(`${mapping.dbTable}: ERROR - ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('[VERIFY] Error during verification:', error);
    }

    console.log('\n' + '='.repeat(70) + '\n');
  }
}

async function main() {
  try {
    const restorer = new NeonRestorer();
    await restorer.restore();
    console.log('[SUCCESS] Restoration complete\n');
    process.exit(0);
  } catch (error) {
    console.error('[FATAL ERROR]:', error);
    process.exit(1);
  }
}

main();
