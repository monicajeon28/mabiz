#!/usr/bin/env node
/**
 * Execute Neon PostgreSQL restoration for Backup_2026-05-25
 *
 * This script:
 * 1. Validates backup files exist
 * 2. Parses Excel files
 * 3. Restores to Neon database
 * 4. Generates verification report
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/execute-neon-restore.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');

// Configuration
const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'neon-restore-2026-05-25');

const TABLE_CONFIGS = [
  { file: 'User_2026-05-25_15-00-47.xlsx', sheet: 'User', table: 'GmUser', idField: 'id' },
  { file: 'Trip_2026-05-25_15-00-49.xlsx', sheet: 'Trip', table: 'GmTrip', idField: 'id' },
  { file: 'Reservation_2026-05-25_15-00-50.xlsx', sheet: 'Reservation', table: 'GmReservation', idField: 'id' },
  { file: 'Traveler_2026-05-25_15-00-52.xlsx', sheet: 'Traveler', table: 'GmTraveler', idField: 'id' },
  { file: 'AffiliateProfile_2026-05-25_15-00-53.xlsx', sheet: 'AffiliateProfile', table: 'GmAffiliateProfile', idField: 'id' },
  { file: 'AffiliateSale_2026-05-25_15-00-55.xlsx', sheet: 'AffiliateSale', table: 'AffiliateSale', idField: 'id' },
  { file: 'AffiliateLead_2026-05-25_15-00-57.xlsx', sheet: 'AffiliateLead', table: 'GmAffiliateLead', idField: 'id' },
  { file: 'AffiliateProduct_2026-05-25_15-00-58.xlsx', sheet: 'AffiliateProduct', table: 'AffiliateProduct', idField: 'id' },
  { file: 'AffiliateLedger_2026-05-25_15-01-00.xlsx', sheet: 'AffiliateLedger', table: 'AffiliateLedger', idField: 'id' },
  { file: 'AdminActionLog_2026-05-25_15-01-03.xlsx', sheet: 'AdminActionLog', table: 'AdminActionLog', idField: 'id' },
  { file: 'CruiseProduct_2026-05-25_15-01-05.xlsx', sheet: 'CruiseProduct', table: 'CruiseProduct', idField: 'id' },
  { file: 'ProductPricePeriod_2026-05-25_15-01-06.xlsx', sheet: 'ProductPricePeriod', table: 'ProductPricePeriod', idField: 'id' },
  { file: 'ProductCabinPrice_2026-05-25_15-01-08.xlsx', sheet: 'ProductCabinPrice', table: 'ProductCabinPrice', idField: 'id' },
  { file: 'ProductImage_2026-05-25_15-01-10.xlsx', sheet: 'ProductImage', table: 'ProductImage', idField: 'id' },
  { file: 'PassportSubmission_2026-05-25_15-01-02.xlsx', sheet: 'PassportSubmission', table: 'GmPassportSubmission', idField: 'id' },
];

// Type converters
function convertValue(value, columnType) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  try {
    switch (columnType) {
      case 'integer':
        const intVal = parseInt(String(value), 10);
        return isNaN(intVal) ? null : intVal;

      case 'float':
      case 'decimal':
        const floatVal = parseFloat(String(value));
        return isNaN(floatVal) ? null : floatVal;

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
  } catch (e) {
    return null;
  }
}

class RestoreManager {
  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    this.pool = new Pool({ connectionString: dbUrl });
    this.results = [];
  }

  parseExcelFile(config) {
    const filePath = path.join(BACKUP_DIR, config.file);

    if (!fs.existsSync(filePath)) {
      console.warn(`[PARSE] ⚠️  File not found: ${config.file}`);
      return [];
    }

    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const worksheet = workbook.Sheets[config.sheet];

      if (!worksheet) {
        console.warn(`[PARSE] ⚠️  Sheet not found: ${config.sheet}`);
        return [];
      }

      const data = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        blankrows: false,
      });

      console.log(`[PARSE] ✓ ${config.file}: ${data.length} rows`);
      return data;
    } catch (error) {
      console.error(`[PARSE] ✗ Error parsing ${config.file}:`, error.message);
      return [];
    }
  }

  async insertRows(table, config, rows) {
    if (rows.length === 0) {
      return { inserted: 0, skipped: 0, failed: 0 };
    }

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    const client = await this.pool.connect();

    try {
      for (const row of rows) {
        try {
          // Get columns
          const columns = Object.keys(row).filter(col => col && col.trim().length > 0);

          // Build insert
          const insertCols = [];
          const insertVals = [];
          const params = [];
          let paramIdx = 1;

          for (const col of columns) {
            const value = convertValue(row[col], 'string'); // Default to string type

            if (value !== undefined) {
              insertCols.push(`"${col}"`);
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
            ON CONFLICT ("${config.idField}") DO UPDATE SET
              ${insertCols.map((col, i) => `${col} = $${i + 1}`).join(',')}
          `;

          await client.query(query, params);
          inserted++;
        } catch (error) {
          if (error.code === '23505') {
            skipped++;
          } else {
            failed++;
          }
        }
      }
    } finally {
      client.release();
    }

    return { inserted, skipped, failed };
  }

  async restoreTable(config) {
    console.log(`\n[RESTORE] Processing ${config.table}...`);

    const rows = this.parseExcelFile(config);

    if (rows.length === 0) {
      console.log(`[RESTORE] ℹ️  No data for ${config.table}`);
      return {
        table: config.table,
        file: config.file,
        rowsRead: 0,
        rowsInserted: 0,
        rowsSkipped: 0,
        rowsFailed: 0,
        error: null
      };
    }

    try {
      const { inserted, skipped, failed } = await this.insertRows(config.table, config, rows);

      console.log(`[INSERT] ✓ ${config.table}: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);

      return {
        table: config.table,
        file: config.file,
        rowsRead: rows.length,
        rowsInserted: inserted,
        rowsSkipped: skipped,
        rowsFailed: failed,
        error: null
      };
    } catch (error) {
      console.error(`[RESTORE] ✗ Error: ${error.message}`);
      return {
        table: config.table,
        file: config.file,
        rowsRead: rows.length,
        rowsInserted: 0,
        rowsSkipped: 0,
        rowsFailed: rows.length,
        error: error.message
      };
    }
  }

  async restore() {
    console.log('='.repeat(70));
    console.log('Neon PostgreSQL Restoration - Backup 2026-05-25');
    console.log('='.repeat(70));
    console.log(`\nBackup directory: ${BACKUP_DIR}\n`);

    // Check directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      console.error(`[ERROR] Backup directory not found: ${BACKUP_DIR}`);
      console.error(`Please download Excel files to: ${BACKUP_DIR}`);
      process.exit(1);
    }

    // Restore each table
    for (const config of TABLE_CONFIGS) {
      const result = await this.restoreTable(config);
      this.results.push(result);
    }

    // Generate report
    this.printReport();

    // Verify
    await this.verify();
    await this.pool.end();
  }

  printReport() {
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

  async verify() {
    console.log('='.repeat(70));
    console.log('DATABASE VERIFICATION');
    console.log('='.repeat(70) + '\n');

    for (const config of TABLE_CONFIGS) {
      try {
        const result = await this.pool.query(`SELECT COUNT(*) as count FROM "${config.table}"`);
        const count = result.rows[0]?.count || 0;
        console.log(`${config.table}: ${count} records`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log(`${config.table}: TABLE NOT FOUND`);
        } else {
          console.error(`${config.table}: ERROR - ${error.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70) + '\n');
  }
}

async function main() {
  try {
    const manager = new RestoreManager();
    await manager.restore();
    console.log('[SUCCESS] Restoration complete\n');
    process.exit(0);
  } catch (error) {
    console.error('[FATAL ERROR]:', error.message);
    process.exit(1);
  }
}

main();
