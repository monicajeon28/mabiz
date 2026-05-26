const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const tempDir = path.join(process.cwd(), 'temp-restore');

console.log('=== Verification of Extracted Excel Files ===\n');

// Check CommunityPost
const postPath = path.join(tempDir, 'CommunityPost.xlsx');
if (fs.existsSync(postPath)) {
  const workbook = XLSX.readFile(postPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`CommunityPost.xlsx:`);
  console.log(`  Rows: ${data.length}`);
  console.log(`  Columns: ${Object.keys(data[0] || {}).join(', ')}`);
  if (data.length > 0) {
    console.log(`  First row ID: ${data[0].id}, Title: ${(data[0].title || 'N/A').substring(0, 50)}`);
  }
}

console.log();

// Check CommunityComment
const commentPath = path.join(tempDir, 'CommunityComment.xlsx');
if (fs.existsSync(commentPath)) {
  const workbook = XLSX.readFile(commentPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`CommunityComment.xlsx:`);
  console.log(`  Rows: ${data.length}`);
  console.log(`  Columns: ${Object.keys(data[0] || {}).join(', ')}`);
  if (data.length > 0 && data[0].id !== undefined) {
    console.log(`  First row ID: ${data[0].id}, Content: ${(data[0].content || 'N/A').substring(0, 50)}`);
  }
}
