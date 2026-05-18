const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixIdType() {
  const client = await pool.connect();
  
  try {
    console.log('=== TESTING ID TYPE CONVERSION ===\n');
    
    // Check current type
    const colInfo = await client.query(`
      SELECT data_type, column_default FROM information_schema.columns
      WHERE table_name = '_prisma_migrations' AND column_name = 'id'
    `);
    console.log('Current ID type:', colInfo.rows[0].data_type);
    console.log('Current default:', colInfo.rows[0].column_default);
    
    // Try converting to BIGINT
    console.log('\n[ATTEMPT] Converting id to BIGINT...');
    try {
      // Get the sequence name
      const seqName = await client.query(`
        SELECT sequencename FROM pg_sequences 
        WHERE tablename = '_prisma_migrations' AND attnum = 1
      `);
      
      if (seqName.rows.length > 0) {
        console.log('Found sequence:', seqName.rows[0].sequencename);
      }
      
      // Try ALTER COLUMN
      await client.query(`
        ALTER TABLE "_prisma_migrations" 
        ALTER COLUMN id TYPE BIGINT
      `);
      console.log('✅ Converted to BIGINT\n');
    } catch (err) {
      console.log('❌ Conversion failed:', err.message, '\n');
    }
    
    // Verify
    const newType = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = '_prisma_migrations' AND column_name = 'id'
    `);
    console.log('New ID type:', newType.rows[0].data_type);
    
  } finally {
    client.release();
    await pool.end();
  }
}

fixIdType();
