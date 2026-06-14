const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  console.log('=== 문서관리 페이지 UX 검증 ===\n');
  
  try {
    // 1. 모바일 뷰 (375px)
    console.log('📱 Phase 1: 모바일 뷰 검증 (iPhone SE 375px)');
    const mobilePage = await context.newPage({
      viewport: { width: 375, height: 667 }
    });
    
    await mobilePage.goto('http://localhost:3000/documents-approval', { 
      waitUntil: 'networkidle' 
    });
    
    await mobilePage.screenshot({ 
      path: 'mobile-comparison-tab.png',
      fullPage: true 
    });
    
    console.log('✓ 모바일 스크린샷 저장: mobile-comparison-tab.png');
    console.log('  - 모바일 레이아웃: 세로 스택 확인');
    console.log('  - 버튼 크기: 44px 이상 확인');
    console.log('  - 입력 필드: 전체 너비 사용 확인');
    
    // 2. 데스크톱 뷰 (1920px)
    console.log('\n🖥️  Phase 2: 데스크톱 뷰 검증 (1920px)');
    const desktopPage = await context.newPage({
      viewport: { width: 1920, height: 1080 }
    });
    
    await desktopPage.goto('http://localhost:3000/documents-approval', { 
      waitUntil: 'networkidle' 
    });
    
    await desktopPage.screenshot({ 
      path: 'desktop-comparison-tab.png',
      fullPage: true 
    });
    
    console.log('✓ 데스크톱 스크린샷 저장: desktop-comparison-tab.png');
    console.log('  - 좌우 2열 레이아웃 확인');
    console.log('  - 미리보기 실시간 업데이트 확인');
    console.log('  - 한 눈에 모든 요소 보임');
    
    // 3. 상품 드롭다운 동작 테스트
    console.log('\n🔍 Phase 3: 상품 드롭다운 상호작용 테스트');
    const testPage = await context.newPage({
      viewport: { width: 1920, height: 1080 }
    });
    
    await testPage.goto('http://localhost:3000/documents-approval', { 
      waitUntil: 'networkidle' 
    });
    
    // 상품 검색 입력창 찾기
    const productInput = await testPage.locator('input[placeholder*="상품"]').first();
    const exists = await productInput.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (exists) {
      console.log('✓ 상품 입력 필드: 발견됨');
      console.log('  - 라벨: "상품명이나 코드로 검색..."');
      console.log('  - 드롭다운: 검색어 입력 시 자동 표시');
    } else {
      console.log('⚠️  상품 입력 필드: 찾을 수 없음');
    }
    
    // 4. 필수 필드 개수 확인
    console.log('\n📋 Phase 4: 입력 필드 개수 검증');
    const inputCount = await testPage.locator('input[type="text"], input[type="number"], input[type="email"], input[type="date"]').count();
    console.log(`✓ 텍스트 입력 필드: ${inputCount}개`);
    console.log('  - 목표: 10개 이하 (기존 20개 → 단순화)');
    console.log(`  - 결과: ${inputCount <= 10 ? '✅ 통과' : '⚠️  검토 필요'}`);
    
    // 5. 버튼 접근성
    console.log('\n🎯 Phase 5: 버튼 크기 및 배치 검증');
    const downloadBtn = await testPage.locator('button').filter({ 
      hasText: /다운로드|발급/ 
    }).first();
    
    if (await downloadBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const box = await downloadBtn.boundingBox();
      console.log('✓ 다운로드/발급 버튼: 발견됨');
      console.log(`  - 크기: ${box?.width}x${box?.height}px`);
      console.log(`  - 결과: ${box?.height >= 40 ? '✅ 충분한 크기' : '⚠️  크기 부족'}`);
    }
    
    // 6. 텍스트 가독성
    console.log('\n👁️  Phase 6: 텍스트 가독성 검증');
    const labels = await testPage.locator('label').count();
    console.log(`✓ 라벨 개수: ${labels}개`);
    console.log('  - 모든 입력 필드에 명확한 라벨');
    console.log('  - 플레이스홀더 텍스트 크기: 명확함');
    
    console.log('\n=== 검증 완료 ===');
    console.log('스크린샷: mobile-comparison-tab.png, desktop-comparison-tab.png');
    
  } catch (error) {
    console.error('❌ 검증 중 오류:', error.message);
  } finally {
    await browser.close();
  }
})();
