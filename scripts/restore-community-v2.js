#!/usr/bin/env node

const { Client } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * CommunityPost & CommunityComment Restoration Script V2
 * Reads base64 from files instead of command line args (solves ENAMETOOLONG)
 *
 * Usage:
 *   node scripts/restore-community-v2.js
 */

// Configuration
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
};

// Temporary directory
const TEMP_DIR = path.join(process.cwd(), 'temp-restore');

// Track stats
const stats = {
  communityPost: { total: 0, inserted: 0, failed: 0, errors: [] },
  communityComment: { total: 0, inserted: 0, failed: 0, errors: [] },
};

/**
 * Decode base64 file and write to disk
 */
function decodeBase64ToExcel(base64Path, outputPath) {
  try {
    const base64Content = fs.readFileSync(base64Path, 'utf-8').trim();
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Decoded: ${path.basename(outputPath)} (${buffer.length} bytes)`);
    return outputPath;
  } catch (error) {
    console.error(`Failed to decode ${base64Path}:`, error);
    throw error;
  }
}

/**
 * Parse Excel file and extract data
 */
function parseExcelFile(filepath) {
  try {
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Parsed ${data.length} rows from ${path.basename(filepath)}`);
    return data;
  } catch (error) {
    console.error(`Failed to parse Excel file:`, error);
    throw error;
  }
}

/**
 * Connect to Neon database
 */
async function connectDB() {
  try {
    const client = new Client(DB_CONFIG);
    await client.connect();
    console.log('Connected to Neon database');
    return client;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

/**
 * Restore CommunityPost table
 */
async function restoreCommunityPost(client, data) {
  console.log('\n=== Restoring CommunityPost ===');
  stats.communityPost.total = data.length;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      const query = `
        INSERT INTO "CommunityPost"
          (id, title, content, category, "authorName", images, views, likes, comments,
           "isDeleted", "deletedAt", published, "shortCode", slug, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          "updatedAt" = EXCLUDED."updatedAt"
      `;

      const values = [
        row.id ? parseInt(row.id) : null,
        row.title || null,
        row.content || null,
        row.category || null,
        row.authorName || null,
        row.images || null,
        row.views ? parseInt(row.views) : 0,
        row.likes ? parseInt(row.likes) : 0,
        row.comments ? parseInt(row.comments) : 0,
        row.isDeleted === 'FALSE' || row.isDeleted === false ? false : true,
        row.deletedAt || null,
        row.published === 'TRUE' || row.published === true ? true : false,
        row.shortCode || null,
        row.slug || null,
        row.createdAt || new Date().toISOString(),
        row.updatedAt || new Date().toISOString(),
      ];

      await client.query(query, values);
      stats.communityPost.inserted++;

      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${data.length}`);
      }
    } catch (error) {
      stats.communityPost.failed++;
      stats.communityPost.errors.push({
        row: i + 1,
        id: row.id,
        error: error.message,
      });
      if (i < 3) {
        console.error(
          `  Error at row ${i + 1} (id=${row.id}): ${error.message}`
        );
      }
    }
  }

  console.log(
    `Completed: ${stats.communityPost.inserted} inserted, ${stats.communityPost.failed} failed`
  );
}

/**
 * Restore CommunityComment table
 */
async function restoreCommunityComment(client, data) {
  console.log('\n=== Restoring CommunityComment ===');
  stats.communityComment.total = data.length;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      const query = `
        INSERT INTO "CommunityComment"
          (id, "postId", "userId", "parentCommentId", content, "authorName", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          "updatedAt" = EXCLUDED."updatedAt"
      `;

      const values = [
        row.id ? parseInt(row.id) : null,
        row.postId ? parseInt(row.postId) : null,
        row.userId ? parseInt(row.userId) : null,
        row.parentCommentId ? parseInt(row.parentCommentId) : null,
        row.content || null,
        row.authorName || null,
        row.createdAt || new Date().toISOString(),
        row.updatedAt || new Date().toISOString(),
      ];

      await client.query(query, values);
      stats.communityComment.inserted++;

      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${data.length}`);
      }
    } catch (error) {
      stats.communityComment.failed++;
      stats.communityComment.errors.push({
        row: i + 1,
        id: row.id,
        error: error.message,
      });
      if (i < 3) {
        console.error(
          `  Error at row ${i + 1} (id=${row.id}): ${error.message}`
        );
      }
    }
  }

  console.log(
    `Completed: ${stats.communityComment.inserted} inserted, ${stats.communityComment.failed} failed`
  );
}

/**
 * Verify tables exist
 */
async function verifyTables(client) {
  console.log('\n=== Verifying Tables ===');

  try {
    const postResult = await client.query(`
      SELECT COUNT(*) as count FROM "CommunityPost"
    `);
    console.log(`CommunityPost total rows: ${postResult.rows[0].count}`);

    const commentResult = await client.query(`
      SELECT COUNT(*) as count FROM "CommunityComment"
    `);
    console.log(`CommunityComment total rows: ${commentResult.rows[0].count}`);

    // Show sample records
    console.log('\n=== Sample Records ===');

    const postSample = await client.query(`
      SELECT id, title, "authorName", "createdAt" FROM "CommunityPost" LIMIT 3
    `);
    console.log('\nCommunityPost samples:');
    postSample.rows.forEach((row) => {
      console.log(`  [${row.id}] ${row.title.substring(0, 40)}... by ${row.authorName}`);
    });

    const commentSample = await client.query(`
      SELECT id, "postId", "authorName", content FROM "CommunityComment" LIMIT 3
    `);
    console.log('\nCommunityComment samples:');
    commentSample.rows.forEach((row) => {
      console.log(`  [${row.id}] Post #${row.postId} by ${row.authorName}: ${row.content.substring(0, 30)}...`);
    });
  } catch (error) {
    console.error('Failed to verify tables:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();

  console.log('=== Community Tables Restoration V2 ===');
  console.log(`Start time: ${new Date().toISOString()}`);

  try {
    // Check base64 files exist
    const postBase64File = path.join(TEMP_DIR, 'post.b64');
    const commentBase64File = path.join(TEMP_DIR, 'comment.b64');

    if (!fs.existsSync(postBase64File)) {
      console.error(`Missing: ${postBase64File}`);
      process.exit(1);
    }
    if (!fs.existsSync(commentBase64File)) {
      console.error(`Missing: ${commentBase64File}`);
      process.exit(1);
    }

    // Decode base64 to Excel files
    console.log('\n=== Decoding Base64 Files ===');
    const postExcelPath = path.join(TEMP_DIR, 'CommunityPost.xlsx');
    const commentExcelPath = path.join(TEMP_DIR, 'CommunityComment.xlsx');

    decodeBase64ToExcel(postBase64File, postExcelPath);
    decodeBase64ToExcel(commentBase64File, commentExcelPath);

    // Parse Excel files
    console.log('\n=== Parsing Excel Files ===');
    const postData = parseExcelFile(postExcelPath);
    const commentData = parseExcelFile(commentExcelPath);

    // Connect to database
    console.log('\n=== Database Connection ===');
    const client = await connectDB();

    // Restore tables
    await restoreCommunityPost(client, postData);
    await restoreCommunityComment(client, commentData);

    // Verify results
    await verifyTables(client);

    // Cleanup
    await client.end();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n=== Restoration Summary ===');
    console.log(`CommunityPost:    ${stats.communityPost.inserted}/${stats.communityPost.total} inserted, ${stats.communityPost.failed} failed`);
    console.log(`CommunityComment: ${stats.communityComment.inserted}/${stats.communityComment.total} inserted, ${stats.communityComment.failed} failed`);
    console.log(`Total Duration: ${duration}s`);

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      gdrive: {
        communityPost: { id: '1NqZ5O3Xmv-odO4x6xQ35d7GXgfHTW9f8', date: '2026-04-24' },
        communityComment: { id: '1hp2S61Ftp2Ny26eMfNC_kM3gI9ccBwef', date: '2026-04-24' },
      },
      stats,
    };

    const reportPath = path.join(
      process.cwd(),
      'COMMUNITY_RESTORATION_REPORT.json'
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    // Exit with appropriate code
    if (stats.communityPost.failed === 0 && stats.communityComment.failed === 0) {
      console.log('\n✓ Restoration completed successfully');
      process.exit(0);
    } else {
      console.log('\n⚠ Restoration completed with errors');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
