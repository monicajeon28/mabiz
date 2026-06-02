import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@prisma/config';

// Prisma 7 no longer auto-loads .env files for CLI commands (migrate/generate),
// so load them explicitly here. .env.local overrides .env.
loadEnv({ path: path.join(__dirname, '.env') });
loadEnv({ path: path.join(__dirname, '.env.local'), override: true });

// Migrations need a direct (non-pooled) connection for the shadow database.
// Neon's PgBouncer pooler cannot manage shadow DBs, so prefer DIRECT_URL.
const migrationUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: migrationUrl,
  },
});
