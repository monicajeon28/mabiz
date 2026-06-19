/**
 * Passport Phase 2: WebP 테스트 이미지 생성 스크립트
 *
 * 실제 이미지 파일을 생성하여 WebP 최적화 엔진 테스트
 * - JPEG 3000x4000 (5MB 근처)
 * - PNG 1920x1080 (2MB)
 * - WebP 1280x720 (1MB)
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const testAssetsDir = './test-assets';

// 테스트 이미지 생성 (Sharp 사용)
async function generateTestImages() {
  // 디렉토리 생성
  if (!fs.existsSync(testAssetsDir)) {
    fs.mkdirSync(testAssetsDir, { recursive: true });
    console.log(`✓ 디렉토리 생성: ${testAssetsDir}`);
  }

  // 1. JPEG 테스트 이미지 (3000x4000, 파란색)
  console.log('📸 테스트 이미지 생성 중...');

  try {
    // 1-1. JPEG (여권 크기, 약 5MB) - 복잡한 패턴으로 압축률 낮춤
    console.log('  1. JPEG 3000x4000 생성...');
    const jpegPath = path.join(testAssetsDir, 'test-passport.jpg');

    // 큰 이미지 생성: 여러 색상 패턴으로 압축률 낮춤
    const svgJpeg = Buffer.from(`
      <svg width="3000" height="4000" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="#1E3C96"/>
            <circle cx="50" cy="50" r="30" fill="#FF6B6B"/>
            <rect x="10" y="10" width="30" height="30" fill="#FFD93D"/>
            <polygon points="70,70 100,70 85,100" fill="#6BCB77"/>
          </pattern>
        </defs>
        <rect width="3000" height="4000" fill="url(#pattern)"/>
      </svg>
    `);

    await sharp(svgJpeg, { density: 300 })
      .jpeg({ quality: 85, mozjpeg: false })
      .toFile(jpegPath);

    const jpegSize = fs.statSync(jpegPath).size;
    console.log(`    ✓ ${jpegPath} (${(jpegSize / 1024 / 1024).toFixed(2)}MB)`);

    // 1-2. PNG (1920x1080, 약 2MB) - 복잡한 패턴
    console.log('  2. PNG 1920x1080 생성...');
    const pngPath = path.join(testAssetsDir, 'test-landscape.png');

    const svgPng = Buffer.from(`
      <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pattern2" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect width="80" height="80" fill="#329696"/>
            <circle cx="40" cy="40" r="25" fill="#32CC96"/>
            <rect x="5" y="5" width="20" height="20" fill="#FF9696"/>
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#pattern2)"/>
      </svg>
    `);

    await sharp(svgPng, { density: 300 })
      .png({ compressionLevel: 2 })
      .toFile(pngPath);

    const pngSize = fs.statSync(pngPath).size;
    console.log(`    ✓ ${pngPath} (${(pngSize / 1024 / 1024).toFixed(2)}MB)`);

    // 1-3. WebP (1280x720, 약 1MB) - 복잡한 패턴
    console.log('  3. WebP 1280x720 생성...');
    const webpPath = path.join(testAssetsDir, 'test-small.webp');

    const svgWebp = Buffer.from(`
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pattern3" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <rect width="60" height="60" fill="#C83232"/>
            <circle cx="30" cy="30" r="20" fill="#FFB6B6"/>
            <polygon points="0,0 30,20 60,0" fill="#FF6B9D"/>
          </pattern>
        </defs>
        <rect width="1280" height="720" fill="url(#pattern3)"/>
      </svg>
    `);

    await sharp(svgWebp, { density: 300 })
      .webp({ quality: 75 })
      .toFile(webpPath);

    const webpSize = fs.statSync(webpPath).size;
    console.log(`    ✓ ${webpPath} (${(webpSize / 1024 / 1024).toFixed(2)}MB)`);

    console.log('\n✅ 모든 테스트 이미지 생성 완료!');
    console.log(`\n테스트 실행:`);
    console.log(`npm run test -- src/lib/image-optimization.test.ts --testNamePattern="E2E"`);

  } catch (error) {
    console.error('❌ 이미지 생성 실패:', error);
    process.exit(1);
  }
}

generateTestImages();
