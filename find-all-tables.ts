import { Client } from 'pg';

async function findAllTables() {
  console.log('🔍 모든 데이터베이스 검색 중...\n');

  // 1. Neon (CRM DB)
  console.log('═══ NEON (CRM) ═══\n');
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const neonClient = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await neonClient.connect();
    
    const neonTables = await neonClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Neon 테이블 목록:');
    neonTables.rows.forEach(r => console.log(`  - ${r.table_name}`));
    
    // 가격 관련 테이블 찾기
    const priceTables = neonTables.rows.filter(r => 
      r.table_name.toLowerCase().includes('price') || 
      r.table_name.toLowerCase().includes('product') ||
      r.table_name.toLowerCase().includes('cabin') ||
      r.table_name.toLowerCase().includes('cruise')
    );
    
    if (priceTables.length > 0) {
      console.log('\n💰 가격 관련 테이블:');
      priceTables.forEach(r => console.log(`  - ${r.table_name}`));
    }

  } finally {
    await neonClient.end();
  }

  // 2. Supabase (CruiseDot 백업)
  console.log('\n═══ SUPABASE (CruiseDot) ═══\n');
  const supabaseUrl = process.env.SUPABASE_BACKUP_URL || 'postgresql://postgres.cnynywuxapxvythbcagz:!Wjsgptjsdl2@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
  const supabaseClient = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await supabaseClient.connect();
    
    const supaTables = await supabaseClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Supabase 테이블 목록:');
    supaTables.rows.forEach(r => console.log(`  - ${r.table_name}`));
    
    // 가격 관련 테이블 찾기
    const priceTables = supaTables.rows.filter(r => 
      r.table_name.toLowerCase().includes('price') || 
      r.table_name.toLowerCase().includes('product') ||
      r.table_name.toLowerCase().includes('cabin') ||
      r.table_name.toLowerCase().includes('cruise') ||
      r.table_name.toLowerCase().includes('fare') ||
      r.table_name.toLowerCase().includes('cost')
    );
    
    if (priceTables.length > 0) {
      console.log('\n💰 가격/상품 관련 테이블:');
      priceTables.forEach(r => {
        console.log(`  - ${r.table_name}`);
      });
    }

  } finally {
    await supabaseClient.end();
  }
}

findAllTables().catch(console.error);
