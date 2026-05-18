require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyMigrations() {
  try {
    console.log('🔄 마이그레이션 기록 추가 시작...');
    console.log(`📍 DATABASE_URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`);

    const migrationsDir = './prisma/migrations';
    const folders = fs.readdirSync(migrationsDir)
      .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .filter(f => f.match(/^\d{14,}/) || f.startsWith('20260'))
      .sort();

    let added = 0;
    let skipped = 0;

    for (const folder of folders) {
      const migrationFile = path.join(migrationsDir, folder, 'migration.sql');
      
      if (fs.existsSync(migrationFile)) {
        try {
          const content = fs.readFileSync(migrationFile, 'utf-8');
          const checksum = crypto.createHash('sha256').update(content).digest('hex');

          // Prisma 직접 SQL 실행
          await prisma.$executeRawUnsafe(
            `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
             VALUES ('${folder}', '${checksum}', NOW(), '${folder}', 'Auto-applied', NULL, NOW(), 0)
             ON CONFLICT (id) DO NOTHING`
          );

          added++;
          console.log(`✅ ${folder}`);
        } catch (err) {
          console.log(`⚠️  ${folder}: ${err.message.substring(0, 60)}`);
        }
      }
    }

    console.log(`\n✅ 완료: ${added}개 마이그레이션 기록 추가됨`);
    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ 오류:', err.message);
    process.exit(1);
  }
}

applyMigrations();
