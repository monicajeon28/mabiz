const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  console.log('🔐 로그인 시작...\n');
  
  try {
    const page = await context.newPage();
    
    // 1. 로그인 페이지
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // 아이디 입력
    await page.fill('input[placeholder*="아이디"]', 'admin1');
    await page.fill('input[type="password"]', '0313');
    
    // 로그인 버튼 클릭
    await page.click('button:has-text("로그인")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    console.log('✅ 로그인 완료');
    
    // 2. 문서관리 페이지 접근
    console.log('\n📄 문서관리 페이지 접근...');
    await page.goto('http://localhost:3000/documents-approval', { waitUntil: 'networkidle' });
    
    // 스크린샷 저장
    await page.screenshot({ 
      path: 'docs-comparison-tab.png',
      fullPage: true 
    });
    
    console.log('✅ 비교견적서 탭 스크린샷 저장됨');
    
    // 3. 환불 탭 확인
    console.log('\n🔄 환불 탭 확인...');
    const refundTab = await page.locator('button:has-text("환불")').first();
    if (await refundTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refundTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'docs-refund-tab.png',
        fullPage: true 
      });
      console.log('✅ 환불 탭 스크린샷 저장됨');
    }
    
    // 4. 구매 탭 확인
    console.log('\n🔄 구매 탭 확인...');
    const purchaseTab = await page.locator('button:has-text("구매")').first();
    if (await purchaseTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await purchaseTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'docs-purchase-tab.png',
        fullPage: true 
      });
      console.log('✅ 구매 탭 스크린샷 저장됨');
    }
    
    console.log('\n✅ 검증 완료!');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await browser.close();
  }
})();
