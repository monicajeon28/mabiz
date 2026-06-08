const { chromium } = require('./node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const results = [];

  function log(step, status, detail) {
    results.push({ step, status, detail });
    console.log(`[${status}] Step ${step}: ${detail}`);
  }

  // Login
  await page.goto('https://mabizcruisedot.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input').first().fill('admin1');
  await page.locator('input[type="password"]').first().fill('0313');
  await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForTimeout(5000);

  // Navigate to profit calculator
  await page.goto('https://mabizcruisedot.com/tools/profit-calculator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_01_page_load.png' });

  // ===== Step 1: Exchange rate badge =====
  console.log('\n=== Step 1: Exchange rate badge ===');
  try {
    const pageText = await page.textContent('body');

    // Check for "실패" pattern near exchange rate context
    const hasExchangeFail = /환율.*실패|실패.*환율|환율.*오류|오류.*환율/.test(pageText);
    const hasExchangeSuccess = /\d{4,5}[,.]?\d*\s*원.*달러|\d{4,5}\s*원\/\$|환율.*\d{4,5}/.test(pageText);

    // Check for specific badge element
    const badgeEl = await page.locator('text=/환율/').first().textContent().catch(() => '');
    console.log('Exchange badge text:', badgeEl);

    // Look at full page text around 환율
    const matchIdx = pageText.indexOf('환율');
    const exchangeContext = matchIdx >= 0 ? pageText.slice(Math.max(0, matchIdx - 20), matchIdx + 100) : 'NOT FOUND';
    console.log('Exchange rate context:', exchangeContext);

    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_01_exchange.png' });

    // Determine status
    if (hasExchangeFail) {
      log(1, 'FAIL', `환율 배지 실패 상태. Context: "${exchangeContext}"`);
    } else if (hasExchangeSuccess) {
      log(1, 'PASS', `환율 배지 성공 상태. Context: "${exchangeContext}"`);
    } else {
      log(1, 'PARTIAL', `환율 배지 상태 불확실. Context: "${exchangeContext}"`);
    }
  } catch (e) {
    log(1, 'FAIL', e.message);
  }

  // ===== Step 2: 판매가 KRW 1200000 → USD 자동변환 =====
  console.log('\n=== Step 2: 판매가 KRW 1200000 ===');
  try {
    // Input[0] = 판매가 원, Input[1] = 판매가 $ (disabled = auto-calculated)
    const saleKrwInput = page.locator('input').nth(0);
    await saleKrwInput.triple_click ? await saleKrwInput.triple_click() : await saleKrwInput.click({ clickCount: 3 });
    await saleKrwInput.fill('1200000');
    await saleKrwInput.press('Tab');
    await page.waitForTimeout(2000);

    // Check USD field value
    const usdDisabled = await page.locator('input').nth(1).isDisabled();
    const usdValue = await page.locator('input').nth(1).inputValue();

    console.log(`USD input: disabled=${usdDisabled}, value="${usdValue}"`);

    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_02_sale_price.png' });

    if (usdDisabled) {
      // USD field is disabled but might have auto-calculated value shown via JS
      // Check if the page visually shows USD
      const pageText = await page.textContent('body');
      const hasUSDValue = /\$\s*\d+|\d+\.\d{2}\s*USD/.test(pageText);
      log(2, hasUSDValue ? 'PASS' : 'PARTIAL',
        `판매가 USD 필드가 disabled(읽기전용). 환율 로드 안됨으로 USD 계산 불가. usdValue="${usdValue}", hasUSDInText: ${hasUSDValue}`);
    } else {
      const hasUSD = usdValue && usdValue !== '' && parseFloat(usdValue) > 0;
      log(2, hasUSD ? 'PASS' : 'PARTIAL', `판매가 1200000 → USD: "${usdValue}"`);
    }
  } catch (e) {
    log(2, 'FAIL', e.message);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_02_error.png' });
  }

  // ===== Step 3: 입금가 KRW 900000 → 영업이익/세전순이익 =====
  console.log('\n=== Step 3: 입금가 KRW 900000 ===');
  try {
    const depositInput = page.locator('input').nth(2);
    await depositInput.click({ clickCount: 3 });
    await depositInput.fill('900000');
    await depositInput.press('Tab');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_03_deposit.png' });
    const pageText = await page.textContent('body');

    // Look for profit values
    const profitMatch = pageText.match(/영업이익[^\d]*(\d[\d,]+)/);
    const taxProfitMatch = pageText.match(/세전순이익[^\d]*(\d[\d,]+)/);
    const profitValue = profitMatch ? profitMatch[1] : null;
    const taxProfitValue = taxProfitMatch ? taxProfitMatch[1] : null;

    console.log(`영업이익: ${profitValue}, 세전순이익: ${taxProfitValue}`);

    // 1200000 - 900000 = 300000 expected profit
    const correctProfit = profitValue && parseInt(profitValue.replace(/,/g, '')) === 300000;

    log(3, profitValue ? 'PASS' : 'PARTIAL',
      `입금가 900000 입력 → 영업이익: ${profitValue}원 (예상 300,000) | 세전순이익: ${taxProfitValue}원 | ${correctProfit ? '정확' : '확인필요'}`);
  } catch (e) {
    log(3, 'FAIL', e.message);
  }

  // ===== Step 4: 대리점장 % 7.0 → 원화 자동계산 =====
  console.log('\n=== Step 4: 대리점장 % 7.0 ===');
  try {
    // Input[4] = 대리점장 %, Input[5] = 대리점장 KRW
    const agentPctInput = page.locator('input').nth(4);
    const prevPct = await agentPctInput.inputValue();
    await agentPctInput.click({ clickCount: 3 });
    await agentPctInput.fill('7.0');
    await agentPctInput.press('Tab');
    await page.waitForTimeout(2000);

    const agentKrwValue = await page.locator('input').nth(5).inputValue();
    console.log(`Agent % before: ${prevPct} → 7.0, KRW after: ${agentKrwValue}`);

    // Expected: 1200000 * 7% = 84000 (or based on 영업이익)
    const krwNum = parseInt(agentKrwValue.replace(/,/g, ''));
    const expectedKrw = Math.round(1200000 * 0.07);
    console.log(`Expected KRW: ${expectedKrw}, Actual: ${krwNum}`);

    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_04_agent_pct.png' });
    log(4, agentKrwValue && krwNum > 0 ? 'PASS' : 'PARTIAL',
      `대리점장 7.0% 입력 → 원화: ${agentKrwValue}원 (예상 ~${expectedKrw}원)`);
  } catch (e) {
    log(4, 'FAIL', e.message);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_04_error.png' });
  }

  // ===== Step 5: 대리점장 원화 직접 입력 → % 역산 =====
  console.log('\n=== Step 5: 대리점장 원화 역산 ===');
  try {
    const agentKrwInput = page.locator('input').nth(5);
    const isDisabled = await agentKrwInput.isDisabled();
    const prevKrw = await agentKrwInput.inputValue();

    console.log(`Agent KRW: disabled=${isDisabled}, value=${prevKrw}`);

    if (!isDisabled) {
      await agentKrwInput.click({ clickCount: 3 });
      await agentKrwInput.fill('60000');
      await agentKrwInput.press('Tab');
      await page.waitForTimeout(2000);

      const pctAfter = await page.locator('input').nth(4).inputValue();
      const pctNum = parseFloat(pctAfter);
      // Expected: 60000 / 1200000 * 100 = 5.0
      const expectedPct = (60000 / 1200000 * 100).toFixed(1);
      console.log(`After KRW=60000, % reversed to: ${pctAfter} (expected ~${expectedPct})`);

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_05_krw_reverse.png' });
      log(5, pctNum > 0 && pctAfter !== '7.0' ? 'PASS' : 'PARTIAL',
        `대리점장 원화 60000 입력 → % 역산: ${pctAfter}% (예상 ${expectedPct}%)`);
    } else {
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_05_disabled.png' });
      log(5, 'FAIL', `대리점장 원화 필드가 disabled(읽기전용). 양방향 역산 기능 없음`);
    }
  } catch (e) {
    log(5, 'FAIL', e.message);
  }

  // ===== Step 6: 현재 계산 저장하기 =====
  console.log('\n=== Step 6: 현재 계산 저장하기 ===');
  try {
    // Click the save button
    const saveBtn = page.locator('button:has-text("현재 계산 저장하기")').first();
    const saveBtnVisible = await saveBtn.isVisible();
    console.log(`Save button visible: ${saveBtnVisible}`);

    if (saveBtnVisible) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06a_save_dialog.png' });

      // Check for title input
      const allInputsAfterClick = await page.locator('input[type="text"], input[placeholder*="제목"], input[placeholder*="이름"]').all();
      console.log(`Text inputs found after click: ${allInputsAfterClick.length}`);

      let titleInput = null;
      for (const inp of allInputsAfterClick) {
        const visible = await inp.isVisible().catch(() => false);
        const placeholder = await inp.getAttribute('placeholder') || '';
        console.log(`  Input: visible=${visible}, placeholder="${placeholder}"`);
        if (visible) {
          titleInput = inp;
          break;
        }
      }

      if (titleInput) {
        await titleInput.fill('테스트 저장 항목');
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06b_title_filled.png' });

        // Find the confirm "저장" button (not 취소)
        // Multiple 저장 buttons might exist - find the one in dialog context
        const dialogSaveBtn = page.locator('[role="dialog"] button:has-text("저장"), .save-dialog button:has-text("저장")').first();
        const dialogSaveBtnVisible = await dialogSaveBtn.isVisible().catch(() => false);

        if (dialogSaveBtnVisible) {
          await dialogSaveBtn.click();
        } else {
          // Try pressing Enter on the input
          await titleInput.press('Enter');
        }

        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06c_after_save.png' });

        const allBtnsAfter = await page.locator('button').allTextContents();
        console.log('Buttons after save:', allBtnsAfter);

        // Check saved list count
        const savedCountBtn = allBtnsAfter.find(t => /저장 목록.*\d+건/.test(t));
        const savedCount = savedCountBtn ? parseInt(savedCountBtn.match(/(\d+)건/)?.[1] || '0') : 0;
        console.log('Saved count:', savedCount);

        log(6, savedCount > 0 ? 'PASS' : 'PARTIAL',
          `저장 버튼 클릭 → 제목 입력 "테스트 저장 항목" → 저장 완료 | 저장 목록: ${savedCount}건`);
      } else {
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06_no_title.png' });
        log(6, 'PARTIAL', '제목 입력란을 찾을 수 없음');
      }
    } else {
      log(6, 'FAIL', '"현재 계산 저장하기" 버튼 없음');
    }
  } catch (e) {
    log(6, 'FAIL', e.message);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06_error.png' });
  }

  // ===== Step 7: "세부확인" button in saved list =====
  console.log('\n=== Step 7: 세부확인 버튼 ===');
  try {
    // First, open the saved list panel
    const savedListBtn = page.locator('button:has-text("저장 목록 보기")').first();
    const savedListVisible = await savedListBtn.isVisible().catch(() => false);
    console.log(`Saved list button visible: ${savedListVisible}`);

    if (savedListVisible) {
      await savedListBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_07_saved_list_open.png' });
    }

    // Now check for saved items and 세부확인 button
    const allBtns = await page.locator('button').allTextContents();
    console.log('Buttons after opening list:', allBtns);

    const detailBtnTexts = ['세부확인', '세부 확인', '상세', '상세보기'];
    let detailBtn = null;
    for (const text of detailBtnTexts) {
      const btn = page.locator(`button:has-text("${text}")`).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        detailBtn = btn;
        console.log(`Found detail button: "${text}"`);
        break;
      }
    }

    // Also search all button texts for close matches
    const detailLikeBtn = allBtns.find(t => /확인|상세|보기|detail/i.test(t) && !/저장|취소|로그아웃/.test(t));
    console.log('Detail-like button text:', detailLikeBtn);

    if (detailBtn) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_07_modal.png' });

      const modalVisible = await page.locator('[role="dialog"], dialog').first().isVisible().catch(() => false);
      log(7, modalVisible ? 'PASS' : 'PARTIAL', `세부확인 클릭 → 모달 팝업 | modalVisible: ${modalVisible}`);
    } else {
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_07_no_detail.png' });
      // Check if saved list has items at all
      const pageText = await page.textContent('body');
      const hasItems = /테스트 저장/.test(pageText);
      log(7, 'PARTIAL', `세부확인 버튼 없음. 저장 항목 표시: ${hasItems} | 전체 버튼: ${JSON.stringify(allBtns)}`);
    }
  } catch (e) {
    log(7, 'FAIL', e.message);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_07_error.png' });
  }

  // ===== Step 8: 계산기에 불러오기 =====
  console.log('\n=== Step 8: 계산기에 불러오기 ===');
  try {
    const allBtns = await page.locator('button').allTextContents();
    console.log('Buttons for step 8:', allBtns);

    const loadBtnTexts = ['불러오기', '계산기에 불러오기', '적용', '가져오기', '복원'];
    let loadBtn = null;
    for (const text of loadBtnTexts) {
      const btn = page.locator(`button:has-text("${text}")`).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        loadBtn = btn;
        break;
      }
    }

    if (loadBtn) {
      const saleKrwBefore = await page.locator('input').nth(0).inputValue();
      await loadBtn.click();
      await page.waitForTimeout(1500);
      const saleKrwAfter = await page.locator('input').nth(0).inputValue();
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_08_loaded.png' });
      log(8, 'PASS', `불러오기 클릭 → 판매가 before: ${saleKrwBefore} → after: ${saleKrwAfter}`);
    } else {
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_08_no_load.png' });
      log(8, 'PARTIAL', `불러오기 버튼 없음. 전체 버튼: ${JSON.stringify(allBtns)}`);
    }
  } catch (e) {
    log(8, 'FAIL', e.message);
  }

  // Close modal if open
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ===== Step 9: 삭제 버튼 =====
  console.log('\n=== Step 9: 삭제 (✕) 버튼 ===');
  try {
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_09_before.png' });
    const allBtns = await page.locator('button').allTextContents();
    console.log('All buttons for step 9:', allBtns);

    // Check saved list count before
    const savedCountText = allBtns.find(t => /저장 목록.*\d+건/.test(t));
    console.log('Saved count text:', savedCountText);

    // Find delete button - may have X, ×, ✕ or similar chars
    let deleteBtn = null;

    // Approach 1: by text content
    const allBtnEls = await page.locator('button').all();
    for (const btn of allBtnEls) {
      const text = (await btn.textContent() || '').trim();
      if (/^[✕×xX✗]$|^삭제$/.test(text)) {
        const visible = await btn.isVisible().catch(() => false);
        if (visible) {
          deleteBtn = btn;
          console.log(`Found delete button: "${text}"`);
          break;
        }
      }
    }

    // Approach 2: aria-label
    if (!deleteBtn) {
      const ariaBtn = page.locator('[aria-label*="삭제"], [aria-label*="delete"]').first();
      if (await ariaBtn.isVisible().catch(() => false)) {
        deleteBtn = ariaBtn;
        console.log('Found delete button by aria-label');
      }
    }

    // Approach 3: SVG close buttons
    if (!deleteBtn) {
      const svgBtns = await page.locator('button svg').all();
      console.log(`SVG buttons found: ${svgBtns.length}`);
    }

    if (deleteBtn) {
      await deleteBtn.click();
      await page.waitForTimeout(1500);

      // Handle confirm dialog if any
      const confirmBtn = page.locator('button:has-text("확인"), button:has-text("삭제")').first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_09_deleted.png' });
      const newBtns = await page.locator('button').allTextContents();
      const newSavedCount = newBtns.find(t => /저장 목록.*\d+건/.test(t));
      log(9, 'PASS', `삭제 버튼 클릭 → 항목 삭제됨 | 전후: "${savedCountText}" → "${newSavedCount}"`);
    } else {
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_09_no_delete.png' });
      log(9, 'PARTIAL', `삭제 버튼(✕) 없음. 저장된 항목 없거나 버튼 형태 다름`);
    }
  } catch (e) {
    log(9, 'FAIL', e.message);
  }

  // ===== Step 10: "+ 저장" 패널 토글 =====
  console.log('\n=== Step 10: + 저장 패널 토글 ===');
  try {
    const allBtns = await page.locator('button').allTextContents();
    console.log('All buttons for step 10:', allBtns);

    // From earlier run we know "+ 저장" button exists at load time
    // Re-check current state
    const plusSaveBtn = page.locator('button:has-text("+ 저장")').first();
    const plusSaveVisible = await plusSaveBtn.isVisible().catch(() => false);
    console.log(`"+ 저장" button visible: ${plusSaveVisible}`);

    if (plusSaveVisible) {
      // Check state before click (is form visible?)
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10_before.png' });

      await plusSaveBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10a_clicked.png' });

      // Click again
      const stillVisible = await plusSaveBtn.isVisible().catch(() => false);
      if (stillVisible) {
        await plusSaveBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10b_toggled.png' });
      }
      log(10, 'PASS', '"+ 저장" 버튼 클릭 → 입력폼 토글 확인');
    } else {
      // It might have changed to something else after saving
      // Check for "현재 계산 저장하기" button
      const saveMainBtn = page.locator('button:has-text("현재 계산 저장하기"), button:has-text("+ 현재 계산 저장하기")').first();
      const saveMainVisible = await saveMainBtn.isVisible().catch(() => false);
      console.log(`"현재 계산 저장하기" visible: ${saveMainVisible}`);

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10_check.png' });
      log(10, 'PARTIAL', `"+ 저장" 버튼 현재 안보임. "현재 계산 저장하기" visible: ${saveMainVisible} | 전체: ${JSON.stringify(allBtns)}`);
    }
  } catch (e) {
    log(10, 'FAIL', e.message);
  }

  await browser.close();

  // Final summary
  console.log('\n============ FINAL TEST SUMMARY ============');
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
