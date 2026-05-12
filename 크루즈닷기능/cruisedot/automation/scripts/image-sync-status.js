#!/usr/bin/env node

/**
 * Image Sync Status Checker
 * Quick status check without database connection
 * Usage: node scripts/image-sync-status.js [--verbose]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERBOSE = process.argv.includes('--verbose');

// Color codes
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(title, 'cyan');
  log('='.repeat(60), 'cyan');
}

/**
 * Check ImageCache sync status
 */
function checkImageCacheStatus() {
  section('📊 ImageCache Sync Status');

  try {
    // Read environment
    const envFile = path.join(__dirname, '..', '.env');
    const env = {};

    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf-8');
      const lines = envContent.split('\n');
      lines.forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          env[match[1]] = match[2];
        }
      });
    }

    log('✓ Environment loaded', 'green');

    // Check Prisma
    const prismaPath = path.join(__dirname, '..', 'node_modules', '.prisma');
    if (fs.existsSync(prismaPath)) {
      log('✓ Prisma client installed', 'green');
    } else {
      log('✗ Prisma client not found', 'red');
      log('  Run: npm install', 'yellow');
    }

    // Check database connectivity
    if (!env.DATABASE_URL) {
      log('✗ DATABASE_URL not configured', 'red');
      log('  Sync monitoring requires database connection', 'yellow');
      return false;
    }

    log('✓ Database configured', 'green');

    if (VERBOSE) {
      log(`  Database: ${env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown'}`, 'blue');
    }

    return true;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Check Cloudinary configuration
 */
function checkCloudinaryStatus() {
  section('☁️  Cloudinary Status');

  try {
    const envFile = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envFile)) {
      log('✗ .env file not found', 'red');
      return false;
    }

    const envContent = fs.readFileSync(envFile, 'utf-8');
    const hasCloudinaryUrl = envContent.includes('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME');
    const hasCloudinaryKey = envContent.includes('CLOUDINARY_API_KEY');
    const hasCloudinarySecret = envContent.includes('CLOUDINARY_API_SECRET');

    if (!hasCloudinaryUrl) {
      log('✗ NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME not configured', 'red');
    } else {
      log('✓ Cloudinary cloud name configured', 'green');
    }

    if (!hasCloudinaryKey) {
      log('⚠ CLOUDINARY_API_KEY not configured (optional for read-only)', 'yellow');
    } else {
      log('✓ Cloudinary API key configured', 'green');
    }

    if (!hasCloudinarySecret) {
      log('⚠ CLOUDINARY_API_SECRET not configured (optional for read-only)', 'yellow');
    } else {
      log('✓ Cloudinary API secret configured', 'green');
    }

    return hasCloudinaryUrl;
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Check cron sync configuration
 */
function checkCronStatus() {
  section('⏰ Cron Sync Configuration');

  try {
    const vercelPath = path.join(__dirname, '..', 'vercel.json');
    if (!fs.existsSync(vercelPath)) {
      log('✗ vercel.json not found', 'red');
      return false;
    }

    const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
    const cronJobs = vercelConfig.crons || [];

    log(`✓ Found ${cronJobs.length} cron jobs`, 'green');

    const syncCrons = cronJobs.filter(job =>
      job.path.includes('sync') || job.path.includes('image')
    );

    if (syncCrons.length === 0) {
      log('⚠ No image sync cron jobs found', 'yellow');
      return false;
    }

    syncCrons.forEach(job => {
      log(`\n  📌 ${job.path}`, 'blue');
      log(`     Schedule: ${job.schedule}`, 'blue');
      log(`     Description: ${job.description}`, 'blue');
    });

    return true;
  } catch (error) {
    log(`✗ Error parsing vercel.json: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Check sync handler status
 */
function checkSyncHandlers() {
  section('🔄 Sync Handler Status');

  const handlers = [
    {
      name: 'sync-image-cache-to-cloudinary',
      path: 'app/api/cron/sync-image-cache-to-cloudinary/route.ts',
    },
    {
      name: 'sync-images',
      path: 'app/api/cron/sync-images/route.ts',
    },
  ];

  let found = 0;

  handlers.forEach(handler => {
    const fullPath = path.join(__dirname, '..', handler.path);
    if (fs.existsSync(fullPath)) {
      log(`✓ ${handler.name}`, 'green');
      found++;

      if (VERBOSE) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const hasMaxDuration = content.includes('maxDuration');
        const hasBatchSize = content.includes('take:');
        const hasErrorHandling = content.includes('catch');

        log(`  - Max duration configured: ${hasMaxDuration ? 'yes' : 'no'}`, 'blue');
        log(`  - Batch processing: ${hasBatchSize ? 'yes' : 'no'}`, 'blue');
        log(`  - Error handling: ${hasErrorHandling ? 'yes' : 'no'}`, 'blue');
      }
    } else {
      log(`✗ ${handler.name} not found`, 'red');
    }
  });

  return found > 0;
}

/**
 * Check logger configuration
 */
function checkLoggerStatus() {
  section('📝 Logger Status');

  try {
    const loggerPath = path.join(__dirname, '..', 'lib', 'logger.ts');
    if (fs.existsSync(loggerPath)) {
      log('✓ Logger utility found', 'green');

      if (VERBOSE) {
        const content = fs.readFileSync(loggerPath, 'utf-8');
        const hasDailyRotation = content.includes('rotation');
        const hasStructured = content.includes('json');

        log(`  - Daily rotation: ${hasDailyRotation ? 'yes' : 'no'}`, 'blue');
        log(`  - Structured logging: ${hasStructured ? 'yes' : 'no'}`, 'blue');
      }

      return true;
    } else {
      log('✗ Logger not found', 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Print summary and next steps
 */
function printSummary(results) {
  section('📋 Summary & Next Steps');

  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    log('✓ All checks passed!', 'green');
    log('\n🚀 Start monitoring with:', 'green');
    log('   ./scripts/monitor-image-sync.sh', 'blue');
  } else {
    log('⚠ Some checks failed. Please fix before monitoring.', 'yellow');
    log('\n📖 Quick fixes:', 'yellow');

    if (!results.database) {
      log('   1. Configure DATABASE_URL in .env', 'blue');
    }

    if (!results.cloudinary) {
      log('   2. Add Cloudinary credentials to .env', 'blue');
    }

    if (!results.cron) {
      log('   3. Deploy to Vercel to enable cron jobs', 'blue');
    }
  }

  log('\n💡 Monitoring commands:', 'cyan');
  log('   # Full monitoring (6 hours)', 'blue');
  log('   ./scripts/monitor-image-sync.sh\n', 'blue');
  log('   # Manual status check only', 'blue');
  log('   ./scripts/monitor-image-sync.sh --manual-check\n', 'blue');
  log('   # View logs', 'blue');
  log('   tail -f /tmp/image-sync-monitor-*.log\n', 'blue');
}

// Run checks
const results = {
  database: checkImageCacheStatus(),
  cloudinary: checkCloudinaryStatus(),
  cron: checkCronStatus(),
  handlers: checkSyncHandlers(),
  logger: checkLoggerStatus(),
};

printSummary(results);
