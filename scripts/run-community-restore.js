#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Wrapper script to run community table restoration
 * Reads base64 files from temp directory and passes them to restore script
 */

const tempDir = path.join(process.cwd(), 'temp-restore');
const postFile = path.join(tempDir, 'post.b64');
const commentFile = path.join(tempDir, 'comment.b64');

console.log('=== Community Tables Restoration Wrapper ===\n');

// Check if base64 files exist
if (!fs.existsSync(postFile)) {
  console.error(`Error: ${postFile} not found`);
  process.exit(1);
}

if (!fs.existsSync(commentFile)) {
  console.error(`Error: ${commentFile} not found`);
  process.exit(1);
}

// Read base64 contents
console.log('Reading base64 files...');
const base64Post = fs.readFileSync(postFile, 'utf-8').trim();
const base64Comment = fs.readFileSync(commentFile, 'utf-8').trim();

console.log(`  CommunityPost:    ${base64Post.length} chars`);
console.log(`  CommunityComment: ${base64Comment.length} chars\n`);

// Execute restore script with base64 arguments
const restoreScript = path.join(__dirname, 'restore-community-tables.js');
const cmd = `node "${restoreScript}" "${base64Post}" "${base64Comment}"`;

console.log('Executing restoration script...\n');

const child = exec(cmd, {
  maxBuffer: 100 * 1024 * 1024, // 100MB buffer
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
});

// Pipe stdout and stderr
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✓ Restoration completed successfully');
    process.exit(0);
  } else {
    console.error(`\n✗ Restoration failed with exit code ${code}`);
    process.exit(code);
  }
});
