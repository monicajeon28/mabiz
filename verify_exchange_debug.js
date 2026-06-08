const { chromium } = require('./node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('response', async res => {
    if (res.url().includes('/api/tools/exchange')) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.log(`Exchange rate API: ${res.status()} → ${body}`);
    }
  });

  await page.goto('https://mabizcruisedot.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input').first().fill('admin1');
  await page.locator('input[type="password"]').first().fill('0313');
  await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForTimeout(5000);

  await page.goto('https://mabizcruisedot.com/tools/profit-calculator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);  // Wait longer for exchange rate to load

  const badgeText = await page.locator('.font-mono').first().textContent().catch(() => '');
  console.log(`Badge text: "${badgeText}"`);

  await browser.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
