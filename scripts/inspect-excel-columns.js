const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const tempDir = path.join(process.cwd(), 'temp-restore');
const commentPath = path.join(tempDir, 'CommunityComment.xlsx');

if (fs.existsSync(commentPath)) {
  const workbook = XLSX.readFile(commentPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log('CommunityComment Excel Structure:');
  console.log('Columns:', Object.keys(data[0] || {}));
  console.log('\nFirst 3 rows:');
  data.slice(0, 3).forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row);
  });
} else {
  console.error('File not found:', commentPath);
}
