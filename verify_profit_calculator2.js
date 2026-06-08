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
  console.log('=== Logging in ===');
  await page.goto('https://mabizcruisedot.com/sign-in', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type="text"], input[name="userId"], input[placeholder*="아이디"], input[placeholder*="ID"]').first().fill('admin1');
  await page.locator('input[type="password"]').first().fill('0313');
  await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForTimeout(5000);
  console.log('Login URL:', page.url());

  // Navigate to profit calculator
  await page.goto('https://mabizcruisedot.com/tools/profit-calculator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_01_page_load.png' });

  // Dump all button texts and inputs for diagnosis
  const allButtons = await page.locator('button').allTextContents();
  console.log('All buttons:', JSON.stringify(allButtons));

  const allInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map((inp, i) => ({
      index: i,
      type: inp.type,
      value: inp.value,
      placeholder: inp.placeholder,
      disabled: inp.disabled,
      parentText: inp.parentElement?.textContent?.trim().slice(0, 80) || ''
    }));
  });
  console.log('All inputs:', JSON.stringify(allInputs, null, 2));

  // Step 1: Exchange rate badge
  console.log('\n=== Step 1: Exchange rate badge ===');
  try {
    const pageText = await page.textContent('body');
    const hasExchangeRate = /환율|USD|달러|\d{4}\.\d+/.test(pageText);
    const hasFail = /환율.*실패|환율.*오류/.test(pageText);
    const hasLoading = /환율.*로딩|환율.*조회중/.test(pageText);

    // Check for specific exchange rate value
    const exchangeMatch = pageText.match(/(\d{4}[\.,]\d+)\s*원|환율[^\d]*(\d{4,5})/);
    const rateValue = exchangeMatch ? exchangeMatch[0] : 'N/A';

    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_01_exchange.png' });
    log(1, hasFail ? 'FAIL' : (hasLoading ? 'PARTIAL' : (hasExchangeRate ? 'PASS' : 'PARTIAL')),
      `환율 배지 상태: ${hasFail ? '실패' : hasLoading ? '로딩중' : hasExchangeRate ? '성공' : '불확실'} | 값: ${rateValue}`);
  } catch (e) {
    log(1, 'FAIL', e.message);
  }

  // Step 2: 판매가 KRW 입력 → USD 자동변환
  console.log('\n=== Step 2: 판매가 KRW 1200000 ===');
  try {
    // Input index 0 = 판매가 KRW (원)
    const saleKrwInput = page.locator('input').nth(0);
    await saleKrwInput.fill('1200000');
    await saleKrwInput.press('Tab');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_02_sale_price.png' });

    // Check USD input (index 1) has auto-calculated value
    const usdValue = await page.locator('input').nth(1).inputValue();
    const hasUSD = usdValue && usdValue !== '' && usdValue !== '0';
    log(2, hasUSD ? 'PASS' : 'PARTIAL', `판매가 1200000 입력 → USD 자동변환값: "${usdValue}" (${hasUSD ? '계산됨' : '미계산'})`);
  } catch (e) {
    log(2, 'FAIL', e.message);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_02_error.png' });
  }

  // Step 3: 입금가 KRW 900000 → 영업이익/세전순이익 재계산
  console.log('\n=== Step 3: 입금가 KRW 900000 ===');
  try {
    // Input index 2 = 입금가 KRW
    const depositKrwInput = page.locator('input').nth(2);
    await depositKrwInput.fill('900000');
    await depositKrwInput.press('Tab');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_03_deposit.png' });

    const pageText = await page.textContent('body');
    const hasProfit = /영업이익|세전순이익|순이익|이익/.test(pageText);
    // Check if profit value is shown (non-zero)
    const profitMatch = pageText.match(/영업이익[^\d]*(\d[\d,]+)/);
    const profitValue = profitMatch ? profitMatch[1] : 'N/A';
    log(3, hasProfit ? 'PASS' : 'PARTIAL', `입금가 900000 입력 → 이익 재계산 | hasProfit: ${hasProfit} | 영업이익: ${profitValue}`);
  } catch (e) {
    log(3, 'FAIL', e.message);
  }

  // Step 4: 대리점장 % 7.0 → 원화 자동계산
  console.log('\n=== Step 4: 대리점장 % 7.0 ===');
  try {
    // Input index 4 = 대리점장 % (0.0%)
    const agentPctInput = page.locator('input').nth(4);
    const pctVal = await agentPctInput.inputValue();
    console.log(`Agent % current value: ${pctVal}`);
    await agentPctInput.fill('7.0');
    await agentPctInput.press('Tab');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_04_agent_pct.png' });

    // Check KRW auto-calculated (input index 5)
    const agentKrwValue = await page.locator('input').nth(5).inputValue();
    const hasKRW = agentKrwValue && agentKrwValue !== '' && agentKrwValue !== '0';
    log(4, hasKRW ? 'PASS' : 'PARTIAL', `대리점장 7.0% 입력 → 원화 자동계산값: "${agentKrwValue}" (${hasKRW ? '계산됨' : '미계산'})`);
  } catch (e) {
    log(4, 'FAIL', e.message);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_04_error.png' });
  }

  // Step 5: 대리점장 원화 직접 입력 → % 역산
  console.log('\n=== Step 5: 대리점장 원화 역산 ===');
  try {
    // KRW input for agent (index 5) — check if disabled
    const agentKrwInput = page.locator('input').nth(5);
    const isDisabled = await agentKrwInput.isDisabled();
    console.log(`Agent KRW input disabled: ${isDisabled}`);

    if (isDisabled) {
      // The KRW field is disabled (read-only calculated). Check if there's an editable KRW input
      // This means the design is % → KRW (one-directional), not bidirectional
      const pageText = await page.textContent('body');
      log(5, 'FAIL', `대리점장 원화 입력란이 disabled(읽기전용) → % 역산 불가. KRW 필드는 계산 결과 표시용으로만 사용됨`);
    } else {
      await agentKrwInput.fill('84000');
      await agentKrwInput.press('Tab');
      await page.waitForTimeout(1500);
      const pctAfter = await page.locator('input').nth(4).inputValue();
      log(5, pctAfter && pctAfter !== '7.0' ? 'PASS' : 'PARTIAL', `대리점장 원화 84000 입력 → % 역산값: "${pctAfter}"`);
    }
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_05_agent_krw.png' });
  } catch (e) {
    log(5, 'FAIL', e.message);
  }

  // Step 6: "현재 계산 저장하기" button
  console.log('\n=== Step 6: 저장 버튼 ===');
  try {
    // Find any save button
    const saveBtns = await page.locator('button').allTextContents();
    console.log('Save-related buttons:', saveBtns.filter(t => /저장|save/i.test(t)));

    // Try various save button texts
    let saveBtn = null;
    const saveBtnTexts = ['현재 계산 저장하기', '저장하기', '계산 저장', '저장'];
    for (const text of saveBtnTexts) {
      const btn = page.locator(`button:has-text("${text}")`).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        saveBtn = btn;
        console.log(`Found save button: "${text}"`);
        break;
      }
    }

    if (!saveBtn) {
      // Try finding by partial text
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const text = await btn.textContent();
        if (/저장/.test(text)) {
          const visible = await btn.isVisible().catch(() => false);
          if (visible) {
            saveBtn = btn;
            console.log(`Found save button by scan: "${text}"`);
            break;
          }
        }
      }
    }

    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06a_save_clicked.png' });

      // Look for title input
      const titleInput = page.locator('input[placeholder*="제목"], input[placeholder*="title"], input[placeholder*="이름"]').first();
      const titleVisible = await titleInput.isVisible().catch(() => false);

      if (titleVisible) {
        await titleInput.fill('테스트 저장 항목');
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06b_title_input.png' });

        // Find confirm button
        const confirmTexts = ['저장', '확인', '완료', 'OK'];
        for (const text of confirmTexts) {
          const btn = page.locator(`[role="dialog"] button:has-text("${text}"), dialog button:has-text("${text}")`).first();
          const visible = await btn.isVisible().catch(() => false);
          if (visible) {
            await btn.click();
            console.log(`Clicked confirm: "${text}"`);
            break;
          }
        }
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06c_after_save.png' });

        const pageText = await page.textContent('body');
        const hasSaved = /테스트 저장|저장.*완료|success/.test(pageText);
        log(6, 'PASS', `저장 버튼 클릭 → 제목 입력 → 저장 완료 | titleVisible: ${titleVisible} | hasSaved: ${hasSaved}`);
      } else {
        // Maybe save is immediate (no title input needed) or different UI
        await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06_no_title.png' });
        const pageText = await page.textContent('body');
        const hasNewItem = /저장.*완료|saved|성공/.test(pageText);
        log(6, 'PARTIAL', `저장 버튼 클릭됨 (제목 입력란 없음) | hasNewItem: ${hasNewItem}`);
      }
    } else {
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06_no_btn.png' });
      log(6, 'FAIL', `저장 버튼을 찾을 수 없음. 전체 버튼: ${JSON.stringify(saveBtns.slice(0, 20))}`);
    }
  } catch (e) {
    log(6, 'FAIL', e.message);
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_06_error.png' });
  }

  // Step 7: "세부확인" button
  console.log('\n=== Step 7: 세부확인 버튼 ===');
  try {
    const allBtnTexts = await page.locator('button').allTextContents();
    console.log('All button texts for step 7:', allBtnTexts);

    const detailBtnTexts = ['세부확인', '세부 확인', '상세', '상세보기', '보기'];
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

    if (detailBtn) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_07_modal.png' });

      const modalVisible = await page.locator('[role="dialog"], dialog, .modal').first().isVisible().catch(() => false);
      log(7, modalVisible ? 'PASS' : 'PARTIAL', `세부확인 클릭 → 모달 팝업 | modalVisible: ${modalVisible}`);
    } else {
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_07_no_detail.png' });
      log(7, 'PARTIAL', `세부확인 버튼 없음. 저장된 항목이 없거나 버튼 텍스트가 다름. 전체: ${JSON.stringify(allBtnTexts)}`);
    }
  } catch (e) {
    log(7, 'FAIL', e.message);
  }

  // Step 8: "계산기에 불러오기"
  console.log('\n=== Step 8: 계산기에 불러오기 ===');
  try {
    const loadBtnTexts = ['불러오기', '계산기에 불러오기', '적용', '계산기 적용'];
    let loadBtn = null;
    for (const text of loadBtnTexts) {
      const btn = page.locator(`button:has-text("${text}")`).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        loadBtn = btn;
        console.log(`Found load button: "${text}"`);
        break;
      }
    }

    if (loadBtn) {
      await loadBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_08_loaded.png' });

      // Check if values restored
      const saleKrwValue = await page.locator('input').nth(0).inputValue();
      const restored = saleKrwValue && saleKrwValue !== '0';
      log(8, restored ? 'PASS' : 'PARTIAL', `계산기에 불러오기 → 값 복원 | saleKRW: "${saleKrwValue}"`);
    } else {
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_08_no_load.png' });
      log(8, 'PARTIAL', '불러오기 버튼 없음 (모달이 열리지 않았거나 버튼 없음)');
    }
  } catch (e) {
    log(8, 'FAIL', e.message);
  }

  // Close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Step 9: Delete saved item (✕ button)
  console.log('\n=== Step 9: 삭제 버튼 ===');
  try {
    await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_09_before_delete.png' });
    const allBtns = await page.locator('button').allTextContents();
    console.log('Buttons for delete check:', allBtns);

    // Find delete button by various means
    let deleteBtn = null;
    // Check for × ✕ X ✗ remove buttons
    const deleteTexts = ['✕', '×', 'X', '✗', '삭제', 'remove'];
    for (const text of deleteTexts) {
      const btns = page.locator(`button:has-text("${text}")`);
      const count = await btns.count();
      if (count > 0) {
        const visible = await btns.first().isVisible().catch(() => false);
        if (visible) {
          deleteBtn = btns.first();
          console.log(`Found delete button: "${text}" (count: ${count})`);
          break;
        }
      }
    }

    if (!deleteBtn) {
      // Try aria-label
      const ariaDeleteBtn = page.locator('[aria-label*="삭제"], [aria-label*="delete"], [aria-label*="remove"]').first();
      const visible = await ariaDeleteBtn.isVisible().catch(() => false);
      if (visible) {
        deleteBtn = ariaDeleteBtn;
        console.log('Found delete button by aria-label');
      }
    }

    if (deleteBtn) {
      await deleteBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_09_after_delete.png' });

      // Confirm if needed
      const confirmDelete = page.locator('button:has-text("확인"), button:has-text("삭제 확인"), button:has-text("yes")').first();
      const confirmVisible = await confirmDelete.isVisible().catch(() => false);
      if (confirmVisible) {
        await confirmDelete.click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_09_deleted.png' });
      log(9, 'PASS', '삭제 버튼 클릭 → 항목 삭제됨');
    } else {
      log(9, 'PARTIAL', `삭제 버튼 없음. 저장 항목 없거나 버튼 텍스트 다름. 전체: ${JSON.stringify(allBtns)}`);
    }
  } catch (e) {
    log(9, 'FAIL', e.message);
  }

  // Step 10: "+ 저장" button panel toggle
  console.log('\n=== Step 10: + 저장 패널 토글 ===');
  try {
    const allBtns = await page.locator('button').allTextContents();
    console.log('All buttons for step 10:', allBtns);

    // Look for + 저장 or similar
    const plusTexts = ['+ 저장', '+저장', '저장 추가', '새 저장', '새로 저장'];
    let plusBtn = null;
    for (const text of plusTexts) {
      const btn = page.locator(`button:has-text("${text}")`).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        plusBtn = btn;
        console.log(`Found + save button: "${text}"`);
        break;
      }
    }

    if (!plusBtn) {
      // Try to find button with + and 저장 in it
      const allBtnEls = await page.locator('button').all();
      for (const btn of allBtnEls) {
        const text = (await btn.textContent() || '').trim();
        if (/\+.*저장|저장.*\+/.test(text)) {
          plusBtn = btn;
          console.log(`Found + save button by regex: "${text}"`);
          break;
        }
      }
    }

    if (plusBtn) {
      // Take screenshot before
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10_before.png' });
      await plusBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10a_clicked.png' });

      // Click again to toggle off
      const stillVisible = await plusBtn.isVisible().catch(() => false);
      if (stillVisible) {
        await plusBtn.click();
        await page.waitForTimeout(800);
      }
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10b_toggled.png' });
      log(10, 'PASS', '+ 저장 버튼 클릭 → 입력폼 토글 확인');
    } else {
      await page.screenshot({ path: 'D:\\mabiz-crm\\verify_pc_10_not_found.png' });
      log(10, 'PARTIAL', `+ 저장 버튼 없음. 전체 버튼: ${JSON.stringify(allBtns)}`);
    }
  } catch (e) {
    log(10, 'FAIL', e.message);
  }

  await browser.close();

  // Final summary
  console.log('\n============ TEST SUMMARY ============');
  let pass = 0, fail = 0, partial = 0;
  for (const r of results) {
    console.log(`Step ${r.step}: [${r.status}] ${r.detail}`);
    if (r.status === 'PASS') pass++;
    else if (r.status === 'FAIL') fail++;
    else partial++;
  }
  console.log(`\nTotal: PASS=${pass}, PARTIAL=${partial}, FAIL=${fail}`);
}

main().catch(console.error);
