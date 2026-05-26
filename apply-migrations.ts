import { Client } from 'pg';

async function applyMigrations() {
  const neonUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const client = new Client({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    console.log('🔄 Contact 테이블 마이그레이션 적용 중...\n');

    // Contact 테이블에 필드 추가
    const migrations = [
      // 1. Contact에 필드 추가
      `ALTER TABLE "Contact" 
       ADD COLUMN IF NOT EXISTS "cruiseProductId" INTEGER,
       ADD COLUMN IF NOT EXISTS "reservationId" INTEGER,
       ADD COLUMN IF NOT EXISTS "preferredCabinType" VARCHAR(30),
       ADD COLUMN IF NOT EXISTS "quotedPrice" INTEGER,
       ADD COLUMN IF NOT EXISTS "priceAcceptedAt" TIMESTAMP`,

      // 2. Payment에 필드 추가
      `ALTER TABLE "Payment"
       ADD COLUMN IF NOT EXISTS "contactId" TEXT,
       ADD COLUMN IF NOT EXISTS "reservationId" INTEGER`,

      // 3. GmReservation에 필드 추가
      `ALTER TABLE "GmReservation"
       ADD COLUMN IF NOT EXISTS "contactId" TEXT`,

      // 4. 인덱스 추가
      `CREATE INDEX IF NOT EXISTS "idx_contact_cruise_product" ON "Contact"("organizationId", "cruiseProductId")`,
      `CREATE INDEX IF NOT EXISTS "idx_contact_reservation" ON "Contact"("organizationId", "reservationId")`,
      `CREATE INDEX IF NOT EXISTS "idx_payment_contact" ON "Payment"("contactId")`,
      `CREATE INDEX IF NOT EXISTS "idx_reservation_contact" ON "GmReservation"("contactId")`,
    ];

    for (let i = 0; i < migrations.length; i++) {
      try {
        await client.query(migrations[i]);
        console.log(`✅ ${i+1}/${migrations.length} 완료`);
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          console.log(`⏭️  ${i+1}/${migrations.length} 스킵 (이미 존재)`);
        } else {
          console.log(`❌ ${i+1}/${migrations.length} 실패: ${e.message}`);
        }
      }
    }

    console.log('\n✅ 마이그레이션 완료!\n');

    // 확인
    const checkContact = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Contact' AND column_name IN ('cruiseProductId', 'reservationId', 'preferredCabinType')
      ORDER BY column_name
    `);

    console.log('📋 Contact 테이블 확인:');
    if (checkContact.rows.length > 0) {
      console.log(`✅ 새 필드 추가 완료 (${checkContact.rows.length}개)`);
      checkContact.rows.forEach((r: any) => console.log(`   - ${r.column_name}`));
    } else {
      console.log('⚠️  필드 추가 미확인');
    }

  } finally {
    await client.end();
  }
}

applyMigrations().catch(console.error);
