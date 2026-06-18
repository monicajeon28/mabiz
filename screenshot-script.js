const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/affiliate-sales', { waitUntil: 'networkidle' });
  // Wait a moment for page to fully render
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'affiliate-sales-screenshot.png', fullPage: true });
  console.log('Screenshot saved: affiliate-sales-screenshot.png');
  await browser.close();
})();
