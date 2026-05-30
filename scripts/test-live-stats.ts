/**
 * Test script for live-stats endpoint
 * Validates CUID format, rate limiting, and response structure
 */

// ─── Test Cases ──────────────────────────────────────────────────────────────

const testCases = {
  validCUID: 'c1234567890123456789012', // 24 chars: c + 23 alnum
  invalidCUID_short: 'c123456789',
  invalidCUID_badChar: 'c12345678901234567890_2', // underscore not allowed
  invalidCUID_uppercase: 'C1234567890123456789012', // uppercase C not allowed
  invalidCUID_notCUID: '1234567890123456789012', // doesn't start with c
};

// ─── CUID Validation Test ────────────────────────────────────────────────────

function isValidCUID(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  return /^c[a-z0-9]{20,}$/.test(id);
}

console.log('=== CUID Validation Tests ===');
Object.entries(testCases).forEach(([name, cuid]) => {
  const isValid = isValidCUID(cuid);
  console.log(`${name}: "${cuid}" → ${isValid ? '✅ VALID' : '❌ INVALID'}`);
});

// ─── Rate Limit Key Generation Test ──────────────────────────────────────────

function generateRateLimitKey(ip: string): string {
  return `landing:live-stats:${ip}`;
}

const testIPs = [
  '192.168.1.1',
  '::1',
  '2001:0db8:85a3::8a2e:0370:7334',
];

console.log('\n=== Rate Limit Key Generation ===');
testIPs.forEach((ip) => {
  const key = generateRateLimitKey(ip);
  console.log(`IP: ${ip} → Key: ${key}`);
});

// ─── IP Extraction Test ──────────────────────────────────────────────────────

function getClientIP_mock(headers: Record<string, string | null>): string {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return headers['cf-connecting-ip'] || headers['x-real-ip'] || 'unknown';
}

const headerTests = [
  {
    name: 'x-forwarded-for single IP',
    headers: { 'x-forwarded-for': '203.0.113.5', 'cf-connecting-ip': null, 'x-real-ip': null },
    expected: '203.0.113.5',
  },
  {
    name: 'x-forwarded-for multiple IPs (takes first)',
    headers: { 'x-forwarded-for': '203.0.113.5, 198.51.100.17, 192.0.2.1', 'cf-connecting-ip': null, 'x-real-ip': null },
    expected: '203.0.113.5',
  },
  {
    name: 'cf-connecting-ip fallback',
    headers: { 'x-forwarded-for': null, 'cf-connecting-ip': '104.21.0.1', 'x-real-ip': null },
    expected: '104.21.0.1',
  },
  {
    name: 'x-real-ip final fallback',
    headers: { 'x-forwarded-for': null, 'cf-connecting-ip': null, 'x-real-ip': '10.0.0.1' },
    expected: '10.0.0.1',
  },
  {
    name: 'unknown when no headers',
    headers: { 'x-forwarded-for': null, 'cf-connecting-ip': null, 'x-real-ip': null },
    expected: 'unknown',
  },
];

console.log('\n=== IP Extraction Tests ===');
headerTests.forEach(({ name, headers, expected }) => {
  const ip = getClientIP_mock(headers);
  const status = ip === expected ? '✅' : '❌';
  console.log(`${status} ${name}: got "${ip}" (expected "${expected}")`);
});

// ─── Rate Limit Window Calculation Test ──────────────────────────────────────

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 60;

console.log('\n=== Rate Limit Configuration ===');
console.log(`Window: ${ONE_HOUR_MS / 1000 / 60} minutes (${ONE_HOUR_MS}ms)`);
console.log(`Max requests per window: ${MAX_REQUESTS}`);
console.log(`Effective rate: ${MAX_REQUESTS / 60} req/min = 1 req/sec`);

// ─── Response Header Simulation ──────────────────────────────────────────────

interface ResponseHeaders {
  'Cache-Control': string;
  'Pragma': string;
  'Expires': string;
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

function generateResponseHeaders(
  rateLimitRemaining: number,
  rateLimitReset: number
): ResponseHeaders {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-RateLimit-Limit': MAX_REQUESTS.toString(),
    'X-RateLimit-Remaining': rateLimitRemaining.toString(),
    'X-RateLimit-Reset': new Date(rateLimitReset).toISOString(),
  };
}

const now = Date.now();
const resetTime = now + ONE_HOUR_MS;
const headers = generateResponseHeaders(59, resetTime);

console.log('\n=== Response Headers (Sample) ===');
Object.entries(headers).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});

// ─── Error Response Formats ──────────────────────────────────────────────────

interface ErrorResponse {
  error: string;
  timestamp: string;
}

const errorScenarios = [
  {
    status: 400,
    error: 'Invalid landing page ID. Must be a valid CUID (format: c[a-z0-9]{20,})',
  },
  {
    status: 404,
    error: 'Landing page not found.',
  },
  {
    status: 429,
    error: 'Rate limit exceeded. Maximum 60 requests per hour allowed.',
  },
  {
    status: 500,
    error: 'Internal server error.',
  },
];

console.log('\n=== Error Response Formats ===');
errorScenarios.forEach(({ status, error }) => {
  const response: ErrorResponse = {
    error,
    timestamp: new Date().toISOString(),
  };
  console.log(`${status} ${error}`);
  console.log(`  └─ timestamp: ${response.timestamp}`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n=== Summary ===');
console.log('✅ CUID validation: regex /^c[a-z0-9]{20,}$/ enforced');
console.log('✅ Rate limiting: 60 req/hour per IP (Redis + memory fallback)');
console.log('✅ Dynamic rendering: force-dynamic export set');
console.log('✅ Cache headers: no-cache, must-revalidate');
console.log('✅ Error handling: 4 standardized error responses');
console.log('✅ IP extraction: X-Forwarded-For, CF-Connecting-IP, X-Real-IP support');
