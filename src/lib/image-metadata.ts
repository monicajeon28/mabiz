/**
 * 이미지 메타데이터 추출 라이브러리
 * - 이미지 크기 (width, height) 추출
 * - MIME 타입 검증
 */

/**
 * Buffer에서 이미지 크기 추출 (jpeg, png, gif, webp)
 */
export function extractImageDimensions(
  buffer: Buffer
): { width: number; height: number } | null {
  try {
    // JPEG 시그니처: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return extractJpegDimensions(buffer);
    }

    // PNG 시그니처: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return extractPngDimensions(buffer);
    }

    // GIF 시그니처: 47 49 46
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46
    ) {
      return extractGifDimensions(buffer);
    }

    // WebP 시그니처: 52 49 46 46 ... 57 45 42 50
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return extractWebpDimensions(buffer);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * JPEG 크기 추출
 */
function extractJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    offset += 2;

    // SOF 마커 (Start of Frame)
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      const height = (buffer[offset + 3] << 8) | buffer[offset + 4];
      const width = (buffer[offset + 5] << 8) | buffer[offset + 6];
      return { width, height };
    }

    // 세그먼트 길이
    const length = (buffer[offset] << 8) | buffer[offset + 1];
    offset += length;
  }

  return null;
}

/**
 * PNG 크기 추출
 */
function extractPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

/**
 * GIF 크기 추출
 */
function extractGifDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return { width, height };
}

/**
 * WebP 크기 추출
 */
function extractWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    // "VP8 " 청크 찾기 (손실 압축) 또는 "VP8L" (무손실)
    const vp8Index = buffer.indexOf('VP8', 12);
    if (vp8Index === -1) return null;

    // VP8 청크에서 크기 추출 (프레임 태그 이후)
    if (buffer.subarray(vp8Index, vp8Index + 3).toString() === 'VP8 ') {
      const offset = vp8Index + 10;
      const frameTag = buffer.readUIntLE(offset, 3);
      const width = ((frameTag >> 0) & 0x3fff) + 1;
      const height = ((frameTag >> 14) & 0x3fff) + 1;
      return { width, height };
    }

    // VP8L 손실 없음 크기 추출
    if (buffer.subarray(vp8Index, vp8Index + 4).toString() === 'VP8L') {
      const offset = vp8Index + 5;
      const bits = buffer.readUInt32LE(offset);
      const width = ((bits & 0x3fff) + 1);
      const height = (((bits >> 14) & 0x3fff) + 1);
      return { width, height };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * MIME 타입별 파일 확장자
 */
export const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * 파일 확장자별 MIME 타입
 */
export const EXT_MIMES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/**
 * 파일 크기를 인간 친화적 형식으로 변환
 */
export function formatFileSize(bytes: number | bigint): string {
  if (typeof bytes === 'bigint') {
    bytes = Number(bytes);
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
