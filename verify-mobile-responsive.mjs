import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 }, // iPhone SE size
  });

  try {
    // Navigate to documents page
    console.log('📱 375px 모바일 뷰포트에서 문서관리 페이지 로드 중...');
    try {
      await page.goto('http://localhost:3001/documents-approval', { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (e) {
      console.log('⚠️ networkidle 타임아웃, domcontentloaded로 진행:', e.message);
    }

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Capture full page screenshot
    const screenshotPath = path.join(process.cwd(), 'mobile-375px-full.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ 전체 페이지 스크린샷 저장: ${screenshotPath}`);

    // Scroll to form section and capture
    const formSection = await page.locator('text=고객명').first();
    if (await formSection.isVisible()) {
      await formSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const formScreenshot = path.join(process.cwd(), 'mobile-375px-form.png');
      await page.screenshot({ path: formScreenshot });
      console.log(`✅ 입력 폼 섹션 스크린샷: ${formScreenshot}`);
    }

    // Test input field widths and heights
    console.log('\n📊 반응형 검증 결과:');

    // Check customer name input
    const customerNameInput = page.locator('input[placeholder="고객 이름"]').first();
    if (await customerNameInput.isVisible()) {
      const box = await customerNameInput.boundingBox();
      if (box) {
        console.log(`✅ 고객명 입력필드: ${box.width}px 너비, ${box.height}px 높이 (목표: 100%, 44px+)`);
      }
    }

    // Check all inputs for 44px+ height
    const inputs = await page.locator('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], input[type="date"]').all();
    console.log(`\n🔍 입력필드 높이 검증 (${inputs.length}개):"`);
    let validHeight = 0;
    for (let i = 0; i < Math.min(5, inputs.length); i++) {
      const box = await inputs[i].boundingBox();
      if (box && box.height >= 44) {
        validHeight++;
        console.log(`  ✅ Input ${i+1}: ${box.height}px 높이`);
      } else if (box) {
        console.log(`  ⚠️ Input ${i+1}: ${box.height}px 높이 (44px 미만)`);
      }
    }

    // Check button heights
    const buttons = await page.locator('button').all();
    console.log(`\n🔘 버튼 높이 검증 (처음 3개):"`);
    for (let i = 0; i < Math.min(3, buttons.length); i++) {
      const box = await buttons[i].boundingBox();
      if (box && box.height >= 44) {
        console.log(`  ✅ Button ${i+1}: ${box.height}px 높이`);
      } else if (box) {
        console.log(`  ⚠️ Button ${i+1}: ${box.height}px 높이 (44px 미만)`);
      }
    }

    // Check for horizontal scrolling (layout overflow)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 375;
    console.log(`\n📐 레이아웃 오버플로우 검증:`);
    console.log(`  Body Width: ${bodyWidth}px, Viewport: ${viewportWidth}px`);
    if (bodyWidth > viewportWidth) {
      console.log(`  ⚠️ 수평 스크롤 발생 (${bodyWidth - viewportWidth}px 오버)`);
    } else {
      console.log(`  ✅ 수평 스크롤 없음 (레이아웃 안전)`);
    }

    // Check for "고급옵션" toggle button
    console.log(`\n🎛️ 고급옵션 토글 버튼 검증:`);
    const toggleBtn = await page.locator('button', { hasText: /고급옵션/ }).first();
    if (await toggleBtn.isVisible()) {
      const box = await toggleBtn.boundingBox();
      console.log(`  ✅ 토글 버튼 발견: ${box?.height}px 높이, 너비: ${box?.width}px`);

      // Click toggle to expand advanced options
      await toggleBtn.click();
      await page.waitForTimeout(500);
      console.log(`  ✅ 토글 클릭 성공 (고급옵션 펼침)`);

      const expandedScreenshot = path.join(process.cwd(), 'mobile-375px-expanded.png');
      await page.screenshot({ path: expandedScreenshot });
      console.log(`  ✅ 확장된 폼 스크린샷: ${expandedScreenshot}`);
    } else {
      console.log(`  ❌ 토글 버튼을 찾을 수 없음`);
    }

    // Font size check (should be responsive)
    const labels = await page.locator('label').all();
    if (labels.length > 0) {
      const fontSize = await labels[0].evaluate(el => window.getComputedStyle(el).fontSize);
      console.log(`\n🔤 폰트 크기 (label): ${fontSize}`);
    }

    console.log('\n✅ 모바일 반응형 검증 완료');

  } catch (error) {
    console.error('❌ 검증 중 오류:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
