const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  try {
    // 문서관리 페이지로 직접 이동 (이미 로그인 상태라고 가정)
    console.log('📄 문서관리 페이지 접근...');
    
    // 각 탭별로 스크린샷 캡처
    const tabs = [
      { name: '비교견적서', selector: 'button:text-is("비교견적서")' },
      { name: '구매확인증서', selector: 'button:text-is("구매확인증서")' },
      { name: '환불인증서', selector: 'button:text-is("환불인증서")' },
    ];
    
    for (const tab of tabs) {
      try {
        await page.goto(`http://localhost:3000/documents-approval`, { waitUntil: 'domcontentloaded', timeout: 5000 });
        
        // 스크린샷 캡처 (로그인 상태 여부 상관없이)
        const filename = `docs-preview-${tab.name}.png`;
        await page.screenshot({ path: filename, fullPage: true });
        console.log(`✅ ${tab.name}: ${filename}`);
        
      } catch (e) {
        console.log(`⚠️  ${tab.name}: 접근 불가 (로그인 필요)`);
      }
    }
    
  } finally {
    await browser.close();
  }
})();
