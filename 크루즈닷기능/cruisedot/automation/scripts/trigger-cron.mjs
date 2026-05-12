import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CRON_SECRET = process.env.CRON_SECRET;
const API_URL = 'http://localhost:3000/api/cron/sync-image-cache-to-cloudinary';

if (!CRON_SECRET) {
  console.error('CRON_SECRET not found in .env.local');
  process.exit(1);
}

console.log('Triggering cron job at', API_URL);
console.log('CRON_SECRET:', CRON_SECRET.substring(0, 10) + '...');

try {
  const response = await fetch(API_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    timeout: 300000, // 5 minutes
  });

  const result = await response.json();
  
  console.log('\nCron Response:');
  console.log(JSON.stringify(result, null, 2));

  if (response.status !== 200) {
    console.error(`Error: HTTP ${response.status}`);
    process.exit(1);
  }

} catch (error) {
  console.error('Error triggering cron:', error.message);
  process.exit(1);
}
