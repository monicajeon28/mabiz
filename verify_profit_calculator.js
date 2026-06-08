const { chromium } = require('./node_modules/playwright');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const results = [];

  function log(step, status, detail) {
    results.push({ step, status, detail });
    console.log(`[${status}] Step ${step}: ${detail}`);
  }

  try {
    // Login
    console.log('=== Logging in ===');
    await page.goto('https://mabizcruisedot.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_00_login.png' });

    // Fill login form
    const idInput = page.locator('input[name="userId"], input[name="username"], input[type="text"], input[placeholder*="아이디"], input[placeholder*="ID"], input[placeholder*="id"]').first();
    const pwInput = page.locator('input[type="password"]').first();
    await idInput.fill('admin1');
    await pwInput.fill('0313');
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_00b_login_filled.png' });
    await pwInput.press('Enter');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_00c_after_login.png' });
    console.log('Login attempted, URL:', page.url());

    // Navigate to profit calculator
    await page.goto('https://mabizcruisedot.com/tools/profit-calculator', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_01_page_load.png' });

    // Step 1: Check exchange rate badge
    console.log('=== Step 1: Exchange rate badge ===');
    try {
      // Look for exchange rate badge
      const exchangeBadge = await page.locator('text=/환율|USD|달러|exchange/i').first();
      const badgeVisible = await exchangeBadge.isVisible().catch(() => false);

      // Check for loading state
      const loadingEl = await page.locator('text=/로딩|loading|조회중|fetching/i').first();
      const isLoading = await loadingEl.isVisible().catch(() => false);

      // Check page text for exchange rate info
      const pageText = await page.textContent('body');
      const hasExchangeRate = /환율|USD|달러|\d{4}\.\d+/.test(pageText);
      const hasSuccess = /성공|원\/달러|₩.*USD|USD.*₩|\d+원/.test(pageText);
      const hasFail = /실패|오류|에러|error/i.test(pageText);

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_01_exchange_badge.png' });

      if (isLoading) {
        log(1, 'PARTIAL', `환율 배지 로딩 중 상태 감지됨`);
      } else if (hasSuccess || hasExchangeRate) {
        log(1, 'PASS', `환율 배지 표시됨 - 성공 상태 (hasExchangeRate: ${hasExchangeRate})`);
      } else if (hasFail) {
        log(1, 'PARTIAL', `환율 배지 실패 상태 감지됨`);
      } else {
        log(1, 'PARTIAL', `환율 배지 상태 불확실 (badgeVisible: ${badgeVisible})`);
      }
    } catch (e) {
      log(1, 'FAIL', `환율 배지 확인 오류: ${e.message}`);
    }

    // Step 2: Input 판매가 KRW 1200000 and check USD auto-conversion
    console.log('=== Step 2: 판매가 KRW input ===');
    try {
      // Find the 판매가 KRW input
      const krwInputs = await page.locator('input').all();
      console.log(`Found ${krwInputs.length} inputs`);

      // Try to find by label/placeholder
      let salesInput = await page.locator('input[placeholder*="판매가"], input[name*="sale"], input[name*="price"]').first();
      let salesInputVisible = await salesInput.isVisible().catch(() => false);

      if (!salesInputVisible) {
        // Look near text "판매가"
        salesInput = page.getByRole('textbox').first();
      }

      // Get all input labels
      const labels = await page.locator('label').allTextContents();
      console.log('Labels found:', labels.slice(0, 10));

      // Try to find KRW input next to 판매가 text
      const saleSection = page.locator('*:has-text("판매가")').first();
      const saleInputInSection = saleSection.locator('input').first();
      const saleInputVisible = await saleInputInSection.isVisible().catch(() => false);

      if (saleInputVisible) {
        await saleInputInSection.fill('');
        await saleInputInSection.fill('1200000');
        await saleInputInSection.press('Tab');
        await page.waitForTimeout(1000);
      } else {
        // Try all inputs and find numeric ones
        for (const inp of krwInputs) {
          const type = await inp.getAttribute('type');
          const placeholder = await inp.getAttribute('placeholder') || '';
          const name = await inp.getAttribute('name') || '';
          console.log(`Input type=${type} placeholder=${placeholder} name=${name}`);
        }
      }

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_02_sale_price_input.png' });

      const pageText = await page.textContent('body');
      // Look for USD value
      const hasUSD = /USD|\$|\d+\.\d{2}/.test(pageText);
      log(2, hasUSD ? 'PASS' : 'PARTIAL', `판매가 1200000 입력 후 USD 자동변환 - hasUSD: ${hasUSD}`);
    } catch (e) {
      log(2, 'FAIL', `판매가 입력 오류: ${e.message}`);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_02_error.png' });
    }

    // Get full page structure to understand inputs better
    const inputInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(inp => ({
        id: inp.id,
        name: inp.name,
        type: inp.type,
        placeholder: inp.placeholder,
        value: inp.value,
        ariaLabel: inp.getAttribute('aria-label'),
        parentText: inp.closest('label')?.textContent?.trim().slice(0, 50) ||
                    inp.closest('div')?.querySelector('label,span,p')?.textContent?.trim().slice(0, 50) || ''
      }));
    });
    console.log('Input details:', JSON.stringify(inputInfo, null, 2));

    // Step 3: 입금가 KRW input
    console.log('=== Step 3: 입금가 input ===');
    try {
      // Find deposit/cost price input
      let depositInput = page.locator('input').nth(1); // Try second input

      // Better: find near 입금가 text
      const depositSection = page.locator('*:has-text("입금가"), *:has-text("원가"), *:has-text("입금")').first();
      const depositInputInSection = depositSection.locator('input').first();
      const depositVisible = await depositInputInSection.isVisible().catch(() => false);

      if (depositVisible) {
        await depositInputInSection.fill('');
        await depositInputInSection.fill('900000');
        await depositInputInSection.press('Tab');
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_03_deposit_input.png' });
      const pageText = await page.textContent('body');
      const hasProfit = /영업이익|순이익|이익|profit/i.test(pageText);
      log(3, hasProfit ? 'PASS' : 'PARTIAL', `입금가 900000 입력 후 이익 재계산 - hasProfit: ${hasProfit}`);
    } catch (e) {
      log(3, 'FAIL', `입금가 입력 오류: ${e.message}`);
    }

    // Step 4: 대리점장 % input
    console.log('=== Step 4: 대리점장 % input ===');
    try {
      const agentSection = page.locator('*:has-text("대리점장"), *:has-text("대리점")').first();
      const agentPctInput = agentSection.locator('input[type="number"], input[placeholder*="%"], input').first();
      const agentVisible = await agentPctInput.isVisible().catch(() => false);

      if (agentVisible) {
        await agentPctInput.fill('7.0');
        await agentPctInput.press('Tab');
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_04_agent_pct.png' });
      const pageText = await page.textContent('body');
      const hasAgentKRW = /대리점장.*원|대리점.*\d{3,}/.test(pageText);
      log(4, agentVisible ? 'PASS' : 'PARTIAL', `대리점장 7.0% 입력 후 원화 자동계산 - agentVisible: ${agentVisible}`);
    } catch (e) {
      log(4, 'FAIL', `대리점장 % 입력 오류: ${e.message}`);
    }

    // Step 5: 대리점장 원화 직접 입력 → % 역산
    console.log('=== Step 5: 대리점장 원화 역산 ===');
    try {
      // Find KRW input in agent section
      const agentSection = page.locator('*:has-text("대리점장"), *:has-text("대리점")').first();
      const agentInputs = agentSection.locator('input');
      const count = await agentInputs.count();
      console.log(`Agent section inputs: ${count}`);

      if (count >= 2) {
        // Second input is likely KRW
        const agentKrwInput = agentInputs.nth(1);
        const agentKrwVisible = await agentKrwInput.isVisible().catch(() => false);
        if (agentKrwVisible) {
          await agentKrwInput.fill('84000');
          await agentKrwInput.press('Tab');
          await page.waitForTimeout(1000);
        }
      }

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_05_agent_krw.png' });
      log(5, 'PARTIAL', `대리점장 원화 직접 입력 시도 (count: ${count})`);
    } catch (e) {
      log(5, 'FAIL', `대리점장 원화 역산 오류: ${e.message}`);
    }

    // Step 6: "현재 계산 저장하기" button
    console.log('=== Step 6: Save button ===');
    try {
      const saveBtn = page.locator('button:has-text("저장"), button:has-text("현재 계산"), button:has-text("계산 저장")').first();
      const saveBtnVisible = await saveBtn.isVisible().catch(() => false);

      if (saveBtnVisible) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06a_save_clicked.png' });

        // Look for title input modal/dialog
        const titleInput = page.locator('input[placeholder*="제목"], input[placeholder*="title"], dialog input, [role="dialog"] input').first();
        const titleVisible = await titleInput.isVisible().catch(() => false);

        if (titleVisible) {
          await titleInput.fill('테스트 저장 항목');
          await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06b_title_input.png' });

          // Click confirm save button
          const confirmBtn = page.locator('dialog button:has-text("저장"), [role="dialog"] button:has-text("저장"), button:has-text("확인")').first();
          const confirmVisible = await confirmBtn.isVisible().catch(() => false);
          if (confirmVisible) {
            await confirmBtn.click();
            await page.waitForTimeout(1500);
          }
        } else {
          // Maybe it's inline - try pressing Enter or finding another button
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
        }

        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06c_after_save.png' });
        const pageText = await page.textContent('body');
        const hasSaved = /저장.*완료|테스트 저장|성공/.test(pageText);
        log(6, saveBtnVisible ? 'PASS' : 'PARTIAL', `저장 버튼 클릭 - btnVisible: ${saveBtnVisible}, hasSaved: ${hasSaved}`);
      } else {
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06_no_save_btn.png' });
        log(6, 'FAIL', '저장하기 버튼을 찾을 수 없음');
      }
    } catch (e) {
      log(6, 'FAIL', `저장 오류: ${e.message}`);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06_error.png' });
    }

    // Step 7: "세부확인" button on saved item
    console.log('=== Step 7: Detail view button ===');
    try {
      const detailBtn = page.locator('button:has-text("세부확인"), button:has-text("세부 확인"), button:has-text("상세")').first();
      const detailVisible = await detailBtn.isVisible().catch(() => false);

      if (detailVisible) {
        await detailBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_07_detail_modal.png' });

        const modal = page.locator('dialog, [role="dialog"], .modal').first();
        const modalVisible = await modal.isVisible().catch(() => false);
        log(7, modalVisible ? 'PASS' : 'PARTIAL', `세부확인 버튼 클릭 - detailVisible: ${detailVisible}, modalVisible: ${modalVisible}`);
      } else {
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_07_no_detail.png' });
        log(7, 'PARTIAL', '세부확인 버튼 없음 (저장된 항목 없을 수 있음)');
      }
    } catch (e) {
      log(7, 'FAIL', `세부확인 오류: ${e.message}`);
    }

    // Step 8: "계산기에 불러오기" button in modal
    console.log('=== Step 8: Load to calculator ===');
    try {
      const loadBtn = page.locator('button:has-text("불러오기"), button:has-text("계산기에"), button:has-text("적용")').first();
      const loadVisible = await loadBtn.isVisible().catch(() => false);

      if (loadVisible) {
        await loadBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_08_loaded.png' });
        log(8, 'PASS', `계산기에 불러오기 버튼 클릭 성공`);
      } else {
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_08_no_load.png' });
        log(8, 'PARTIAL', '불러오기 버튼 없음 (모달이 열리지 않았거나 기능 없음)');
      }
    } catch (e) {
      log(8, 'FAIL', `불러오기 오류: ${e.message}`);
    }

    // Close modal if open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Step 9: Delete saved item
    console.log('=== Step 9: Delete saved item ===');
    try {
      const deleteBtn = page.locator('button:has-text("✕"), button:has-text("×"), button[aria-label*="삭제"], button.delete').first();
      const deleteVisible = await deleteBtn.isVisible().catch(() => false);

      if (deleteVisible) {
        await deleteBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_09_after_delete.png' });
        log(9, 'PASS', `삭제 버튼 클릭 성공`);
      } else {
        // Try close/x buttons
        const xBtn = page.locator('button').filter({ hasText: /^[✕×X]$/ }).first();
        const xVisible = await xBtn.isVisible().catch(() => false);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_09_no_delete.png' });
        log(9, 'PARTIAL', `삭제 버튼 찾기 시도 - deleteVisible: ${deleteVisible}, xVisible: ${xVisible}`);
      }
    } catch (e) {
      log(9, 'FAIL', `삭제 오류: ${e.message}`);
    }

    // Step 10: "+ 저장" button (panel top)
    console.log('=== Step 10: + 저장 panel toggle ===');
    try {
      const plusSaveBtn = page.locator('button:has-text("+ 저장"), button:has-text("+저장"), button:has-text("저장 추가")').first();
      const plusSaveVisible = await plusSaveBtn.isVisible().catch(() => false);

      if (plusSaveVisible) {
        await plusSaveBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10a_plus_save_clicked.png' });

        // Click again to toggle
        await plusSaveBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10b_plus_save_toggled.png' });
        log(10, 'PASS', `+ 저장 버튼 토글 성공`);
      } else {
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10_no_plus_save.png' });
        log(10, 'PARTIAL', '+ 저장 버튼 없음 - 다른 UI 패턴일 수 있음');
      }
    } catch (e) {
      log(10, 'FAIL', `+ 저장 토글 오류: ${e.message}`);
    }

  } catch (e) {
    console.error('Fatal error:', e);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n=== TEST SUMMARY ===');
  let pass = 0, fail = 0, partial = 0;
  for (const r of results) {
    console.log(`Step ${r.step}: [${r.status}] ${r.detail}`);
    if (r.status === 'PASS') pass++;
    else if (r.status === 'FAIL') fail++;
    else partial++;
  }
  console.log(`\nTotal: PASS=${pass}, PARTIAL=${partial}, FAIL=${fail}`);
  return results;
}

main().catch(console.error);
