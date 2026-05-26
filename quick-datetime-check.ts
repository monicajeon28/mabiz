import { Client } from 'pg';

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Sample contacts
    const result = await client.query(`
      SELECT id, name, "createdAt", "updatedAt", "purchasedAt", "lastContactedAt"
      FROM "Contact"
      LIMIT 3
    `);

    console.log('Sample Contact Records:');
    result.rows.forEach(row => {
      console.log(`\n${row.name} (${row.id}):`);
      console.log(`  createdAt: ${row.createdAt}`);
      console.log(`  updatedAt: ${row.updatedAt}`);
      console.log(`  purchasedAt: ${row.purchasedAt}`);
      console.log(`  lastContactedAt: ${row.lastContactedAt}`);
    });

  } finally {
    await client.end();
  }
}

check();
