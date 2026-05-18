/**
 * 이미지 처리 라이브러리
 * - 워터마크 추가 (크루즈닷 로고, 회색 음영)
 * - WebP 변환
 * - sharp 기반 (Next.js 의존성으로 이미 설치됨)
 *
 * P0 이슈 #7: 타임아웃 설정으로 무한 대기 방지
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
import sharp from 'sharp';

/**
 * Promise.race를 사용한 타임아웃 구현
 * sharp는 내부 타임아웃이 없으므로 이를 통해 처리
 * @template T 반환 값의 타입
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`${operationName} timeout (${timeoutMs}ms)`)),
      timeoutMs
    );

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

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

/**
 * 워터마크 추가
 * Issue #7: 10초 타임아웃 설정
 */
export async function addWatermark(inputBuffer: Buffer): Promise<Buffer> {
  const { webpBuffer, width, height } = await processImageForLibrary(inputBuffer);
  const watermarkSvg = getWatermarkSvg(width, height);

  return withTimeout(
    sharp(webpBuffer)
      .composite([{ input: watermarkSvg, gravity: 'center', blend: 'over' }])
      .toBuffer(),
    10000,
    'Watermark processing'
  );
}

/**
 * WebP 변환
 * Issue #7: 10초 타임아웃 설정
 */
export async function convertToWebP(inputBuffer: Buffer, quality = 85): Promise<Buffer> {
  return withTimeout(
    sharp(inputBuffer).webp({ quality }).toBuffer(),
    10000,
    'WebP conversion'
  );
}

/**
 * 원스텝 처리: 워터마크 + WebP 변환 + 메타데이터 추출
 * Issue #7: 10초 타임아웃 설정 (메타데이터 읽기 + 처리)
 */
export async function processImageForLibrary(inputBuffer: Buffer): Promise<{
  webpBuffer: Buffer;
  width: number;
  height: number;
}> {
  // 워터마크 SVG 생성을 위해 원본 크기만 먼저 조회 (헤더만 읽음)
  const metadata = await withTimeout(
    sharp(inputBuffer).metadata(),
    10000,
    'Image metadata extraction'
  );
  const w = ((metadata as unknown as { width?: number })?.width) ?? 800;
  const h = ((metadata as unknown as { height?: number })?.height) ?? 600;
  const watermarkSvg = getWatermarkSvg(w, h);

  // 합성 + WebP 변환을 한 파이프라인으로 실행, 출력 메타데이터도 함께 수집
  const result = (await withTimeout(
    sharp(inputBuffer)
      .composite([{ input: watermarkSvg, gravity: 'center', blend: 'over' }])
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true }),
    10000,
    'Image processing (composite + WebP)'
  )) as unknown as { data: Buffer; info: { width: number; height: number } };

  return { webpBuffer: result.data, width: result.info.width, height: result.info.height };
}
