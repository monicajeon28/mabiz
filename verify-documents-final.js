const { chromium } = require('playwright');

(async () => {
  console.log('📋 서류관리 시스템 최종 검증\n');
  
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await context.newPage();
    
    // 1. 로그인
    console.log('🔐 로그인 중...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.fill('input[placeholder*="아이디"]', 'admin1');
    await page.fill('input[type="password"]', '0313');
    await page.click('button:has-text("로그인")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    console.log('✅ 로그인 완료\n');
    
    // 2. 문서관리 페이지
    console.log('📄 문서관리 페이지 확인...');
    await page.goto('http://localhost:3000/documents-approval', { waitUntil: 'networkidle' });
    
    // 각 탭 확인
    const tabs = ['비교견적서', '구매확인증서', '환불인증서', '계약서'];
    
    for (const tab of tabs) {
      console.log(`\n📍 ${tab} 확인 중...`);
      
      // 탭 클릭
      const tabBtn = await page.locator(`button:has-text("${tab}")`).first();
      if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tabBtn.click();
        await page.waitForTimeout(500);
        
        // 스크린샷
        const filename = `docs-${tab}.png`;
        await page.screenshot({ path: filename, fullPage: true });
        console.log(`  ✅ 스크린샷: ${filename}`);
        
        // 미리보기 영역 확인
        const preview = await page.locator('text=/미리보기|Preview/').first();
        if (await preview.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`  ✅ 미리보기 영역: 있음`);
        } else {
          console.log(`  ❌ 미리보기 영역: 없음`);
        }
        
        // 다운로드 버튼 확인
        const dlBtn = await page.locator('button:has-text(/다운로드|Download/)').first();
        if (await dlBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`  ✅ 다운로드 버튼: 있음`);
        }
      }
    }
    
    console.log('\n✅ 검증 완료!');
    console.log('\n📊 최종 체크리스트:');
    console.log('□ 비교견적서: 미리보기 + 다운로드');
    console.log('□ 구매확인증서: 미리보기 + 다운로드');
    console.log('□ 환불인증서: 미리보기 + 다운로드');
    console.log('□ 계약서 관리: (PNG 다운로드 제외)');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await browser.close();
  }
})();
