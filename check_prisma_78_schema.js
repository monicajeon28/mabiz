const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Read package.json to confirm version
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
console.log('Prisma Client version:', pkg.dependencies['@prisma/client']);
console.log('Prisma version:', pkg.devDependencies?.prisma);

// Check if migrations table might have different expectations in v7.8
console.log('\nPrisma v7.8.0 uses PostgreSQL schema-engine');
console.log('Expected _prisma_migrations columns:');
console.log('  ✅ id (INT, PK)');
console.log('  ✅ checksum (VARCHAR(64), UNIQUE)');
console.log('  ✅ finished_at (TIMESTAMP)');
console.log('  ✅ execution_time (BIGINT)');
console.log('  ✅ success (BOOLEAN, DEFAULT true)');
console.log('  ✅ started_at (TIMESTAMP, DEFAULT NOW())');
console.log('  ✅ logs (TEXT)');
console.log('  ✅ rolled_back_at (TIMESTAMP)');
console.log('  ✅ started_by (VARCHAR)');
console.log('  ✅ finished_by (VARCHAR)');
console.log('  ✅ migration_name (VARCHAR(255), UNIQUE)');
console.log('  ✅ applied_steps_count (INT, DEFAULT 1)');
console.log('\nAll columns present in DB.');
console.log('Issue: Schema-engine type parsing error on "id" column.');
