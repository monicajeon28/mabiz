const { chromium } = require('./node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Intercept response bodies
  page.on('response', async res => {
    if (res.url().includes('/api/tools/profit-calc') || res.url().includes('/api/auth/me') || res.url().includes('/api/tools/exchange')) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.log(`${res.status()} ${res.url().replace('https://mabizcruisedot.com', '')} → ${body.slice(0, 300)}`);
    }
  });

  // Login
  await page.goto('https://mabizcruisedot.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input').first().fill('admin1');
  await page.locator('input[type="password"]').first().fill('0313');
  await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForTimeout(5000);

  await page.goto('https://mabizcruisedot.com/tools/profit-calculator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  // Set values
  await page.locator('input').nth(0).click({ clickCount: 3 });
  await page.locator('input').nth(0).fill('1200000');
  await page.locator('input').nth(2).click({ clickCount: 3 });
  await page.locator('input').nth(2).fill('900000');
  await page.waitForTimeout(500);

  // Save via + 저장
  await page.locator('button:has-text("+ 저장")').first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="제목 입력 (선택)"]').first().fill('테스트');
  await page.locator('.bg-blue-50 button:has-text("저장")').first().click();
  await page.waitForTimeout(3000);

  await browser.close();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
