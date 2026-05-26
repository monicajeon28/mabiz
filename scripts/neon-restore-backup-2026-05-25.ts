import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { Pool } from 'pg';

/**
 * Download and restore Backup_2026-05-25 xlsx files from Google Drive to Neon PostgreSQL
 *
 * Usage:
 *   npm install pg @google-cloud/drive (or use existing setup)
 *   DATABASE_URL=postgresql://... npx ts-node scripts/neon-restore-backup-2026-05-25.ts
 *
 * Files to restore (16 tables):
 *   1. User → GmUser
 *   2. Trip → GmTrip
 *   3. Reservation → GmReservation
 *   4. Traveler → GmTraveler
 *   5. AffiliateProfile → GmAffiliateProfile
 *   6. AffiliateSale → AffiliateSale (custom table or mapping)
 *   7. AffiliateLead → GmAffiliateLead
 *   8. AffiliateProduct → AffiliateProduct
 *   9. AffiliateLedger → AffiliateLedger
 *  10. PassportSubmission → GmPassportSubmission
 *  11. AdminActionLog → AdminActionLog
 *  12. CruiseProduct → CruiseProduct
 *  13. ProductPricePeriod → ProductPricePeriod
 *  14. ProductCabinPrice → ProductCabinPrice
 *  15. ProductImage → ProductImage
 */

interface FileMapping {
  originalName: string;
  googleDriveId: string;
  localFileName: string;
  sheetName: string;
  dbTable: string;
  columns: { [key: string]: string }; // Excel column -> DB column mapping
  typeMap: { [column: string]: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array' };
}

// File mappings with Google Drive IDs
const FILE_MAPPINGS: FileMapping[] = [
  {
    originalName: 'User',
    googleDriveId: '10JPH9r0gQw0RE8k9cdEFwGNvvA57ZmRn',
    localFileName: 'User_2026-05-25_15-00-47.xlsx',
    sheetName: 'User',
    dbTable: 'GmUser',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'Trip',
    googleDriveId: '1d4lAmEkndld0JZYc1A-RQCTdepoPIMBf',
    localFileName: 'Trip_2026-05-25_15-00-49.xlsx',
    sheetName: 'Trip',
    dbTable: 'GmTrip',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'Reservation',
    googleDriveId: '1S8a_Iu9y9kqOuVDAPObN6rOeSfEyHENL',
    localFileName: 'Reservation_2026-05-25_15-00-50.xlsx',
    sheetName: 'Reservation',
    dbTable: 'GmReservation',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'Traveler',
    googleDriveId: '1tWBOOr2t8j1cemoCUxQgiCVhFm__omsG',
    localFileName: 'Traveler_2026-05-25_15-00-52.xlsx',
    sheetName: 'Traveler',
    dbTable: 'GmTraveler',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'AffiliateProfile',
    googleDriveId: '1dbpXJ-tFzJlLAZcduCFPPuV-lx9BsrNn',
    localFileName: 'AffiliateProfile_2026-05-25_15-00-53.xlsx',
    sheetName: 'AffiliateProfile',
    dbTable: 'GmAffiliateProfile',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'AffiliateSale',
    googleDriveId: '1EJsuKLTib75d_kTQKmZDQFlVs36I0ICI',
    localFileName: 'AffiliateSale_2026-05-25_15-00-55.xlsx',
    sheetName: 'AffiliateSale',
    dbTable: 'AffiliateSale',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'AffiliateLead',
    googleDriveId: '1XRtJiijkaheQt-3PUZ5-vMFPoqsfFNLO',
    localFileName: 'AffiliateLead_2026-05-25_15-00-57.xlsx',
    sheetName: 'AffiliateLead',
    dbTable: 'GmAffiliateLead',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'AffiliateProduct',
    googleDriveId: '1IqyI2Z9n90LJJY0u24q3nxyTCFsYFP0N',
    localFileName: 'AffiliateProduct_2026-05-25_15-00-58.xlsx',
    sheetName: 'AffiliateProduct',
    dbTable: 'AffiliateProduct',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'AffiliateLedger',
    googleDriveId: '1EKW9RNx5rhUpglS9Ycn74StJnuWOnm6B',
    localFileName: 'AffiliateLedger_2026-05-25_15-01-00.xlsx',
    sheetName: 'AffiliateLedger',
    dbTable: 'AffiliateLedger',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'AdminActionLog',
    googleDriveId: '1TTqXG4Ytkgo6Fxm81KZmcYIRe2TpiJM-',
    localFileName: 'AdminActionLog_2026-05-25_15-01-03.xlsx',
    sheetName: 'AdminActionLog',
    dbTable: 'AdminActionLog',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'CruiseProduct',
    googleDriveId: '1S2bc_oJbxKXSwteTFYTZW5m_G_giMybR',
    localFileName: 'CruiseProduct_2026-05-25_15-01-05.xlsx',
    sheetName: 'CruiseProduct',
    dbTable: 'CruiseProduct',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'ProductPricePeriod',
    googleDriveId: '1PGVdnuBeL63OUxJSLaeaPwa7LJNeuUgF',
    localFileName: 'ProductPricePeriod_2026-05-25_15-01-06.xlsx',
    sheetName: 'ProductPricePeriod',
    dbTable: 'ProductPricePeriod',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'ProductCabinPrice',
    googleDriveId: '1JcOG7mX1Psdgmo696bnC49-knDcGU9wE',
    localFileName: 'ProductCabinPrice_2026-05-25_15-01-08.xlsx',
    sheetName: 'ProductCabinPrice',
    dbTable: 'ProductCabinPrice',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'ProductImage',
    googleDriveId: '1_BFs3XdoJTrorWAeNtC-SC9CoNqIpCJ4',
    localFileName: 'ProductImage_2026-05-25_15-01-10.xlsx',
    sheetName: 'ProductImage',
    dbTable: 'ProductImage',
    columns: {},
    typeMap: {},
  },
  {
    originalName: 'PassportSubmission',
    googleDriveId: '1QEqZ-TBTzTyNrKJSd9hDHTjvMScs_k0q',
    localFileName: 'PassportSubmission_2026-05-25_15-01-02.xlsx',
    sheetName: 'PassportSubmission',
    dbTable: 'GmPassportSubmission',
    columns: {},
    typeMap: {},
  },
];

interface RestoreStats {
  table: string;
  downloaded: boolean;
  parsed: boolean;
  rowCount: number;
  insertedCount: number;
  skippedCount: number;
  failedCount: number;
  error?: string;
}

class BackupRestorer {
  private backupDir: string;
  private pool: Pool;
  private stats: Map<string, RestoreStats> = new Map();

  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups', 'neon-restore-2026-05-25');
    this.ensureBackupDir();

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`[RESTORE] Created backup directory: ${this.backupDir}`);
    }
  }

  private async downloadFile(mapping: FileMapping): Promise<boolean> {
    const filePath = path.join(this.backupDir, mapping.localFileName);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`[DOWNLOAD] ✓ File already exists: ${mapping.localFileName}`);
      return true;
    }

    try {
      // Note: In production, you would use Google Drive API client library
      // For now, we'll use fetch or gdrive CLI if available
      console.log(`[DOWNLOAD] Downloading ${mapping.originalName}...`);

      // This is a placeholder - in real implementation, use Google Drive API
      // For testing, assume files are manually downloaded or available
      console.log(`[DOWNLOAD] ⚠️  Placeholder - File should be downloaded via Google Drive API`);

      return false;
    } catch (error) {
      console.error(`[DOWNLOAD] ✗ Error downloading ${mapping.originalName}:`, error);
      return false;
    }
  }

  private parseExcelFile(mapping: FileMapping): any[] {
    const filePath = path.join(this.backupDir, mapping.localFileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
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

      return data;
    } catch (error) {
      console.error(`[PARSE] ✗ Error parsing ${mapping.originalName}:`, error);
      throw error;
    }
  }

  private normalizeColumnName(name: string): string {
    // Convert column names to camelCase format expected by database
    return name
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  }

  private convertValue(value: any, columnName: string, mapping: FileMapping): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Check type map for this column
    const columnType = mapping.typeMap[columnName];

    if (columnType === 'date') {
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'number') {
        const excelDate = new Date((value - 25569) * 86400 * 1000);
        return excelDate.toISOString();
      }
      return null;
    }

    if (columnType === 'boolean') {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
      }
      return Boolean(value);
    }

    if (columnType === 'number') {
      const num = parseFloat(String(value));
      return isNaN(num) ? null : num;
    }

    if (columnType === 'json') {
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return null;
    }

    if (columnType === 'array') {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
      }
      return [];
    }

    // Default: return as string
    return String(value).trim();
  }

  private buildInsertQuery(
    table: string,
    columns: string[],
    values: any[][]
  ): { query: string; params: any[] } {
    if (values.length === 0) {
      return { query: '', params: [] };
    }

    // Build parameterized query
    const placeholders = values
      .map((_, rowIndex) => {
        const paramIndices = columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
        return `(${paramIndices.join(',')})`;
      })
      .join(',');

    const query = `
      INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')})
      VALUES ${placeholders}
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `;

    const params = values.flat();

    return { query, params };
  }

  private async insertData(mapping: FileMapping, rows: any[]): Promise<RestoreStats> {
    const stat: RestoreStats = {
      table: mapping.dbTable,
      downloaded: true,
      parsed: true,
      rowCount: rows.length,
      insertedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };

    if (rows.length === 0) {
      console.log(`[INSERT] ℹ️  No data to insert for ${mapping.dbTable}`);
      return stat;
    }

    try {
      // Extract and normalize columns from first row
      const columns = Object.keys(rows[0])
        .filter(col => col && col.trim().length > 0)
        .map(col => this.normalizeColumnName(col));

      // Prepare values with type conversion
      const values: any[][] = [];
      for (const row of rows) {
        const rowValues: any[] = [];
        const rowKeys = Object.keys(row);

        for (let i = 0; i < columns.length; i++) {
          const originalKey = rowKeys[i];
          const value = this.convertValue(row[originalKey], columns[i], mapping);
          rowValues.push(value);
        }

        values.push(rowValues);
      }

      // Insert in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < values.length; i += BATCH_SIZE) {
        const batch = values.slice(i, Math.min(i + BATCH_SIZE, values.length));
        const batchRows = rows.slice(i, Math.min(i + BATCH_SIZE, values.length));

        const { query, params } = this.buildInsertQuery(mapping.dbTable, columns, batch);

        if (!query) continue;

        try {
          const result = await this.pool.query(query, params);
          stat.insertedCount += result.rowCount || 0;
        } catch (error: any) {
          if (error.code === '23505') {
            // Duplicate key - expected for idempotent inserts
            stat.skippedCount += batch.length;
          } else {
            console.error(`[INSERT] ✗ Error inserting batch for ${mapping.dbTable}:`, error.message);
            stat.failedCount += batch.length;
          }
        }
      }

      console.log(
        `[INSERT] ✓ ${mapping.dbTable}: ${stat.insertedCount} inserted, ${stat.skippedCount} skipped, ${stat.failedCount} failed`
      );
    } catch (error: any) {
      console.error(`[INSERT] ✗ Error processing ${mapping.dbTable}:`, error.message);
      stat.error = error.message;
    }

    return stat;
  }

  async restore(): Promise<void> {
    console.log('================================================');
    console.log('Neon PostgreSQL Restoration - Backup 2026-05-25');
    console.log('================================================\n');

    // Step 1: Download files (if using Google Drive API)
    console.log('[PHASE 1] Downloading files from Google Drive...\n');
    let downloadedCount = 0;
    for (const mapping of FILE_MAPPINGS) {
      const downloaded = await this.downloadFile(mapping);
      if (downloaded) downloadedCount++;
    }
    console.log(`\n[SUMMARY] Downloaded: ${downloadedCount}/${FILE_MAPPINGS.length} files\n`);

    // Step 2: Parse and restore
    console.log('[PHASE 2] Parsing and restoring data...\n');

    for (const mapping of FILE_MAPPINGS) {
      try {
        console.log(`[RESTORE] Processing ${mapping.originalName}...`);

        // Parse Excel file
        const rows = this.parseExcelFile(mapping);

        // Insert into database
        const stat = await this.insertData(mapping, rows);
        this.stats.set(mapping.dbTable, stat);
      } catch (error: any) {
        const stat: RestoreStats = {
          table: mapping.dbTable,
          downloaded: true,
          parsed: false,
          rowCount: 0,
          insertedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          error: error.message,
        };
        this.stats.set(mapping.dbTable, stat);
        console.error(`[RESTORE] ✗ Failed to restore ${mapping.originalName}:`, error.message);
      }
    }

    // Step 3: Generate report
    console.log('\n================================================');
    console.log('RESTORATION REPORT');
    console.log('================================================\n');

    let totalRows = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const [table, stat] of this.stats.entries()) {
      const status = stat.error ? '✗' : '✓';
      console.log(`${status} ${table}`);
      console.log(`  Rows: ${stat.rowCount} | Inserted: ${stat.insertedCount} | Skipped: ${stat.skippedCount} | Failed: ${stat.failedCount}`);

      if (stat.error) {
        console.log(`  Error: ${stat.error}`);
      }

      totalRows += stat.rowCount;
      totalInserted += stat.insertedCount;
      totalSkipped += stat.skippedCount;
      totalFailed += stat.failedCount;
    }

    console.log(`\nTOTAL: ${totalRows} rows | ${totalInserted} inserted | ${totalSkipped} skipped | ${totalFailed} failed\n`);

    // Step 4: Verification
    console.log('[PHASE 3] Verification...\n');
    await this.verifyData();

    // Cleanup
    await this.pool.end();
  }

  private async verifyData(): Promise<void> {
    try {
      for (const mapping of FILE_MAPPINGS) {
        const result = await this.pool.query(`SELECT COUNT(*) FROM "${mapping.dbTable}"`);
        const count = result.rows[0]?.count || 0;
        console.log(`  ${mapping.dbTable}: ${count} records`);
      }
    } catch (error: any) {
      console.error('[VERIFY] Error during verification:', error.message);
    }
  }
}

// Main execution
async function main() {
  try {
    const restorer = new BackupRestorer();
    await restorer.restore();
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Fatal error:', error);
    process.exit(1);
  }
}

main();
