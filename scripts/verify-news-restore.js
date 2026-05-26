const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function verifyRestore() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to Neon database');

    // Get total count
    const countResult = await client.query('SELECT COUNT(*) as count FROM "News"');
    const totalCount = parseInt(countResult.rows[0].count);

    // Get recent count (last hour)
    const recentResult = await client.query(
      'SELECT COUNT(*) as count FROM "News" WHERE "createdAt" > NOW() - INTERVAL \'1 hour\''
    );
    const recentCount = parseInt(recentResult.rows[0].count);

    // Get published count
    const publishedResult = await client.query(
      'SELECT COUNT(*) as count FROM "News" WHERE status = \'published\''
    );
    const publishedCount = parseInt(publishedResult.rows[0].count);

    // Get all slugs
    const slugResult = await client.query('SELECT slug, title, status FROM "News" ORDER BY slug');

    console.log('\n===== NEWS TABLE VERIFICATION =====');
    console.log(`Total News records: ${totalCount}`);
    console.log(`Published records: ${publishedCount}`);
    console.log(`Records added in last hour: ${recentCount}`);

    console.log(`\n===== ALL RECORDS (${totalCount} total) =====`);
    slugResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.slug}`);
      console.log(`   Title: ${row.title}`);
      console.log(`   Status: ${row.status}`);
    });

    // Check for the 9 originally restored
    console.log('\n===== ORIGINALLY RESTORED (9 records) =====');
    const originalSlugs = [
      'busan-cruise-guide',
      'singapore-cruise-guide',
      'cruise-casino-guide',
      'cruise-medical-emergency-guide',
      'cruise-wifi-internet-guide',
      '5060-cruise-perfect',
      'domestic-vs-overseas',
      'jeju-cruise-guide',
      'cruise-checklist-beginners',
    ];

    for (const slug of originalSlugs) {
      const found = slugResult.rows.find(r => r.slug === slug);
      if (found) {
        console.log(`✓ ${slug}`);
      } else {
        console.log(`✗ ${slug} (MISSING!)`);
      }
    }

    console.log(`\n===== NEWLY RESTORED (${recentCount} records added this session) =====`);
    const recentRecords = slugResult.rows.filter(r => {
      const createdAt = new Date(r.created_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return createdAt > oneHourAgo;
    });

    recentRecords.slice(0, 20).forEach((record) => {
      console.log(`+ ${record.slug}`);
    });
    if (recentRecords.length > 20) {
      console.log(`... and ${recentRecords.length - 20} more`);
    }

    await client.end();
  } catch (error) {
    console.error('Database error:', error);
    process.exit(1);
  }
}

verifyRestore();
