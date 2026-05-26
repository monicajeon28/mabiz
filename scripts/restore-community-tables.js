const { Client } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * CommunityPost & CommunityComment Restoration Script
 * Downloads Excel files from GDrive and restores to Neon DB
 *
 * Usage:
 *   node scripts/restore-community-tables.js [base64_communitypost_content] [base64_communitycomment_content]
 */

// Configuration
const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
};

// File IDs and metadata
const GDRIVE_FILES = {
  communityPost: {
    id: '1NqZ5O3Xmv-odO4x6xQ35d7GXgfHTW9f8',
    date: '2026-04-24',
    name: 'CommunityPost.xlsx',
  },
  communityComment: {
    id: '1hp2S61Ftp2Ny26eMfNC_kM3gI9ccBwef',
    date: '2026-04-24',
    name: 'CommunityComment.xlsx',
  },
};

// Temporary directory for files
const TEMP_DIR = path.join(process.cwd(), 'temp-restore');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Track stats
const stats = {
  communityPost: { total: 0, inserted: 0, failed: 0, errors: [] },
  communityComment: { total: 0, inserted: 0, failed: 0, errors: [] },
};

/**
 * Save base64 content to file
 */
function saveBase64ToFile(base64Content, filename) {
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const filepath = path.join(TEMP_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`Saved file: ${filepath} (${buffer.length} bytes)`);
    return filepath;
  } catch (error) {
    console.error(`Failed to save ${filename}:`, error);
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

    console.log(`  Parsed ${data.length} rows from ${path.basename(filepath)}`);
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

  // First, clear existing data (optional - comment out if keeping history)
  // await client.query('TRUNCATE TABLE "CommunityPost" CASCADE');
  // console.log('Truncated existing data');

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      // Map Excel columns to DB schema
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
      console.error(
        `  Error at row ${i + 1} (id=${row.id}): ${error.message}`
      );
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

  // First, clear existing data (optional - comment out if keeping history)
  // await client.query('TRUNCATE TABLE "CommunityComment" CASCADE');
  // console.log('Truncated existing data');

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      // Map Excel columns to DB schema
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
      console.error(
        `  Error at row ${i + 1} (id=${row.id}): ${error.message}`
      );
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
      SELECT COUNT(*) FROM "CommunityPost"
    `);
    console.log(`CommunityPost rows: ${postResult.rows[0].count}`);

    const commentResult = await client.query(`
      SELECT COUNT(*) FROM "CommunityComment"
    `);
    console.log(`CommunityComment rows: ${commentResult.rows[0].count}`);
  } catch (error) {
    console.error('Failed to verify tables:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();

  console.log('=== Community Tables Restoration ===');
  console.log(`Start time: ${new Date().toISOString()}`);

  try {
    // Get base64 content from arguments or environment
    let communityPostBase64 = process.argv[2];
    let communityCommentBase64 = process.argv[3];

    if (!communityPostBase64 || !communityCommentBase64) {
      console.error('Usage: node scripts/restore-community-tables.js <base64_post> <base64_comment>');
      process.exit(1);
    }

    // Save Excel files from base64
    console.log('\n=== Saving Excel Files ===');
    const postPath = saveBase64ToFile(
      communityPostBase64,
      GDRIVE_FILES.communityPost.name
    );
    const commentPath = saveBase64ToFile(
      communityCommentBase64,
      GDRIVE_FILES.communityComment.name
    );

    // Parse Excel files
    console.log('\n=== Parsing Excel Files ===');
    const postData = parseExcelFile(postPath);
    const commentData = parseExcelFile(commentPath);

    // Connect to database
    console.log('\n=== Database Connection ===');
    const client = await connectDB();

    // Restore tables
    await restoreCommunityPost(client, postData);
    await restoreCommunityComment(client, commentData);

    // Verify results
    await verifyTables(client);

    // Cleanup and summary
    await client.end();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n=== Restoration Summary ===');
    console.log(`CommunityPost:    ${stats.communityPost.inserted}/${stats.communityPost.total} inserted`);
    console.log(`CommunityComment: ${stats.communityComment.inserted}/${stats.communityComment.total} inserted`);
    console.log(`Duration: ${duration}s`);

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      duration: duration,
      gdrive: GDRIVE_FILES,
      stats,
    };

    const reportPath = path.join(
      process.cwd(),
      'COMMUNITY_RESTORATION_REPORT.json'
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${reportPath}`);

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
