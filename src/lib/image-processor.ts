/**
 * 이미지 처리 라이브러리
 * - 워터마크 추가 (크루즈닷 로고, 회색 음영)
 * - WebP 변환
 * - sharp 기반 (Next.js 의존성으로 이미 설치됨)
 */
import sharp from 'sharp';

/** 이미지 크기에 맞는 워터마크 SVG 동적 생성 */
function getWatermarkSvg(width: number, height: number): Buffer {
  const fontSize = Math.min(width, height) * 0.1;
  const subFontSize = fontSize * 0.4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <g opacity="0.25" filter="url(#shadow)">
      <text x="50%" y="46%" text-anchor="middle" dominant-baseline="central"
            font-family="Arial, sans-serif" font-size="${fontSize}px"
            font-weight="bold" fill="#888">
        cruisedot
      </text>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="central"
            font-family="Arial, sans-serif" font-size="${subFontSize}px"
            fill="#999">
        크루즈닷파트너스
      </text>
    </g>
  </svg>`;
  return Buffer.from(svg);
}

/** 워터마크 추가 */
export async function addWatermark(inputBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(inputBuffer).metadata();
  const w = metadata.width || 800;
  const h = metadata.height || 600;
  const watermarkSvg = getWatermarkSvg(w, h);

  return sharp(inputBuffer)
    .composite([{ input: watermarkSvg, gravity: 'center', blend: 'over' }])
    .toBuffer();
}

/** WebP 변환 */
export async function convertToWebP(inputBuffer: Buffer, quality = 85): Promise<Buffer> {
  return sharp(inputBuffer).webp({ quality }).toBuffer();
}

/** 원스텝 처리: 워터마크 + WebP 변환 + 메타데이터 추출 */
export async function processImageForLibrary(inputBuffer: Buffer): Promise<{
  webpBuffer: Buffer;
  width: number;
  height: number;
}> {
  const metadata = await sharp(inputBuffer).metadata();
  const w = metadata.width || 800;
  const h = metadata.height || 600;
  const watermarkSvg = getWatermarkSvg(w, h);

  const webpBuffer = await sharp(inputBuffer)
    .composite([{ input: watermarkSvg, gravity: 'center', blend: 'over' }])
    .webp({ quality: 85 })
    .toBuffer();

  return { webpBuffer, width: w, height: h };
}
