const { readFileSync } = require('fs');
const envContent = readFileSync('.env.mabiz', 'utf8');
const line = envContent.split('\n').find(l => l.startsWith('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'));
const raw = line.substring(line.indexOf('=') + 1).replace(/^"|"$/g, '');

// Count occurrences
const bsCount = (raw.match(/\\/g) || []).length;
console.log('Backslash count:', bsCount);
console.log('Raw length:', raw.length);

// Try replaces
const r1 = raw.replace(/\\n/g, '\n');
console.log('r1 length:', r1.length, 'same as raw:', r1.length === raw.length);
console.log('r1 has actual newline:', r1.includes('\n'));

// Directly test if key works for JWT
const crypto = require('crypto');
try {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update('test');
  const sig = sign.sign(r1, 'base64');
  console.log('JWT sign with r1 SUCCESS');
} catch(e) {
  console.log('JWT sign with r1 FAILED:', e.message);

  const r2 = raw.split('\\n').join('\n');
  console.log('r2 has newline:', r2.includes('\n'));
  try {
    const sign2 = crypto.createSign('RSA-SHA256');
    sign2.update('test');
    sign2.sign(r2, 'base64');
    console.log('JWT sign with r2 SUCCESS');
  } catch(e2) {
    console.log('JWT sign with r2 FAILED:', e2.message);
  }
}
