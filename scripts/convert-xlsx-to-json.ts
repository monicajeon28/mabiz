import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const excelDir = path.join(process.cwd(), 'backups/excel');
const jsonDir = path.join(process.cwd(), 'backups/json');

// Ensure JSON output directory exists
if (!fs.existsSync(jsonDir)) {
  fs.mkdirSync(jsonDir, { recursive: true });
}

const files = [
  'AffiliateProduct_2026-05-25_15-00-58.xlsx',
  'CruiseProduct_2026-05-25_15-01-05.xlsx',
  'User_2026-05-25_15-00-47.xlsx',
  'ProductImage_2026-05-25_15-01-10.xlsx',
  'Traveler_2026-05-25_15-00-52.xlsx',
];

const report: any[] = [];

files.forEach((filename) => {
  const filepath = path.join(excelDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    report.push({
      file: filename,
      status: 'FAILED',
      error: 'File not found',
    });
    return;
  }

  try {
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const jsonFilename = filename.replace('.xlsx', '.json');
    const jsonPath = path.join(jsonDir, jsonFilename);
    
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

    const rowCount = data.length;
    const colCount = data.length > 0 ? Object.keys(data[0]).length : 0;

    report.push({
      file: filename,
      status: 'SUCCESS',
      rows: rowCount,
      columns: colCount,
      output: jsonFilename,
    });

    console.log(`✓ ${filename} → ${rowCount} rows, ${colCount} columns`);
  } catch (error) {
    report.push({
      file: filename,
      status: 'FAILED',
      error: (error as Error).message,
    });
    console.error(`✗ ${filename}: ${(error as Error).message}`);
  }
});

// Write report
const reportPath = path.join(process.cwd(), 'EXCEL_TO_JSON_CONVERSION_REPORT.md');
const reportContent = `# Excel to JSON Conversion Report

**Date**: ${new Date().toISOString()}
**Total Files**: ${files.length}
**Successful**: ${report.filter(r => r.status === 'SUCCESS').length}

## Conversion Details

| File | Status | Rows | Columns | Output |
|------|--------|------|---------|--------|
${report.map(r => {
  if (r.status === 'SUCCESS') {
    return `| ${r.file} | ✓ SUCCESS | ${r.rows} | ${r.columns} | ${r.output} |`;
  } else {
    return `| ${r.file} | ✗ FAILED | - | - | ${r.error} |`;
  }
}).join('\n')}

## Summary

- Total files processed: ${files.length}
- Successful conversions: ${report.filter(r => r.status === 'SUCCESS').length}
- Failed conversions: ${report.filter(r => r.status === 'FAILED').length}
- Output directory: \`backups/json/\`

`;

fs.writeFileSync(reportPath, reportContent);
console.log('\nReport written to:', reportPath);
