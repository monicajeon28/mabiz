const { chromium } = require('./node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Intercept all API calls
  const apiCalls = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      apiCalls.push({ type: 'request', method: req.method(), url: req.url() });
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/')) {
      let body = '';
      try { body = await res.text(); } catch {}
      apiCalls.push({ type: 'response', status: res.status(), url: res.url(), body: body.slice(0, 300) });
    }
  });

  // Login
  await page.goto('https://mabizcruisedot.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input').first().fill('admin1');
  await page.locator('input[type="password"]').first().fill('0313');
  await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForTimeout(5000);

  // Clear and navigate to calculator
  apiCalls.length = 0;
  await page.goto('https://mabizcruisedot.com/tools/profit-calculator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  console.log('=== Initial API calls ===');
  apiCalls.forEach(c => {
    if (c.type === 'response') {
      console.log(`  ${c.status} ${c.url.replace('https://mabizcruisedot.com', '')} → ${c.body.slice(0, 150)}`);
    }
  });

  // Set up values first
  await page.locator('input').nth(0).click({ clickCount: 3 });
  await page.locator('input').nth(0).fill('1200000');
  await page.locator('input').nth(2).click({ clickCount: 3 });
  await page.locator('input').nth(2).fill('900000');
  await page.waitForTimeout(500);

  // Now try to save using the + 저장 button
  apiCalls.length = 0;
  console.log('\n=== Attempting save via + 저장 ===');

  const plusSaveBtn = page.locator('button:has-text("+ 저장")').first();
  await plusSaveBtn.click();
  await page.waitForTimeout(500);

  const titleInput = page.locator('input[placeholder="제목 입력 (선택)"]').first();
  await titleInput.fill('디버그 저장 테스트');

  const panelSaveBtn = page.locator('.bg-blue-50 button:has-text("저장")').first();
  console.log(`Panel save button text: "${await panelSaveBtn.textContent().catch(() => 'N/A')}"`);
  await panelSaveBtn.click();
  await page.waitForTimeout(3000);

  console.log('\n=== Save API calls ===');
  apiCalls.forEach(c => {
    const url = c.url.replace('https://mabizcruisedot.com', '');
    if (c.type === 'request') {
      console.log(`  → ${c.method} ${url}`);
    } else {
      console.log(`  ← ${c.status} ${url} | ${c.body.slice(0, 200)}`);
    }
  });

  // Check result
  const panelHeader = await page.locator('h2').filter({ hasText: '저장된 계산' }).first().textContent().catch(() => '');
  console.log(`\nPanel header after save: "${panelHeader}"`);

  // Check if the save failed due to costPrice >= salePrice validation issue
  // (we set sale=1200000, cost=900000, so sale > cost, should be valid)
  const inputError = await page.locator('.text-red-500').first().textContent().catch(() => '');
  console.log(`Input error visible: "${inputError}"`);

  // Also try: save via main area button
  apiCalls.length = 0;
  console.log('\n=== Attempting save via main "현재 계산 저장하기" ===');
  const mainSaveBtn = page.locator('button:has-text("현재 계산 저장하기"), button:has-text("+ 현재 계산 저장하기")').first();
  const mainSaveVisible = await mainSaveBtn.isVisible().catch(() => false);
  console.log(`Main save button visible: ${mainSaveVisible}`);

  if (mainSaveVisible) {
    await mainSaveBtn.click();
    await page.waitForTimeout(500);

    const mainTitleInput = page.locator('input[placeholder*="계산"]').first();
    const mainTitleVisible = await mainTitleInput.isVisible().catch(() => false);
    console.log(`Main title input visible: ${mainTitleVisible}`);

    if (mainTitleVisible) {
      await mainTitleInput.fill('메인 저장 테스트');
      // Press enter to save
      await mainTitleInput.press('Enter');
      await page.waitForTimeout(3000);

      console.log('\n=== Main save API calls ===');
      apiCalls.forEach(c => {
        const url = c.url.replace('https://mabizcruisedot.com', '');
        if (c.type === 'request') console.log(`  → ${c.method} ${url}`);
        else console.log(`  ← ${c.status} ${url} | ${c.body.slice(0, 200)}`);
      });
    }
  }

  const finalHeader = await page.locator('h2').filter({ hasText: '저장된 계산' }).first().textContent().catch(() => '');
  console.log(`\nFinal panel header: "${finalHeader}"`);
  await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_save_debug.png' });

  await browser.close();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
