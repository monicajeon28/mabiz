const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    await client.connect();
    console.log('Connected to database');

    const sql = fs.readFileSync('prisma/migrations/20260527000001_add_customer_source_fields/migration.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        console.log(`Executing: ${stmt.substring(0, 50)}...`);
        await client.query(stmt);
      }
    }
    
    console.log('✅ Migration applied successfully');
  } catch (e) {
    console.error('❌ Migration error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
