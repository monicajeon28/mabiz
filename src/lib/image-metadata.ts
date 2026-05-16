/**
 * 이미지 메타데이터 추출 라이브러리
 * - 이미지 크기 (width, height) 추출
 * - MIME 타입 검증
 */

/**
 * Buffer에서 이미지 메타데이터 추출 (크기, EXIF Orientation)
 * 반환: { width, height, orientation }
 */
export function extractImageDimensions(
  buffer: Buffer
): { width: number; height: number; orientation: number } | null {
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

    // 기본값 (EXIF 없음)
    return { width: 0, height: 0, orientation: 1 };
  } catch {
    return { width: 0, height: 0, orientation: 1 };
  }
}

/**
 * JPEG 크기 & EXIF Orientation 추출
 */
function extractJpegDimensions(buffer: Buffer): { width: number; height: number; orientation: number } | null {
  let offset = 2;
  let width = 0;
  let height = 0;
  let orientation = 1; // 기본값

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    offset += 2;

    // EXIF 세그먼트 (APP1, 0xFFE1)
    if (marker === 0xe1) {
      const segmentLength = (buffer[offset] << 8) | buffer[offset + 1];
      const exifOrientation = extractExifOrientation(buffer.subarray(offset, offset + segmentLength));
      if (exifOrientation !== null) {
        orientation = exifOrientation;
      }
      offset += segmentLength;
      continue;
    }

    // SOF 마커 (Start of Frame)
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      height = (buffer[offset + 3] << 8) | buffer[offset + 4];
      width = (buffer[offset + 5] << 8) | buffer[offset + 6];
      // SOF를 찾았으면 계속 EXIF 찾기 (이후 세그먼트)
      offset += 1;
      continue;
    }

    // 세그먼트 길이
    const length = (buffer[offset] << 8) | buffer[offset + 1];
    offset += length;
  }

  return width > 0 && height > 0 ? { width, height, orientation } : null;
}

/**
 * JPEG EXIF 데이터에서 Orientation 값 추출 (Tag 0x0112)
 */
function extractExifOrientation(exifBuffer: Buffer): number | null {
  try {
    // "Exif\0\0" 시그니처 확인 (offset 4-9)
    if (exifBuffer.length < 16) return null;
    if (exifBuffer[4] !== 0x45 || exifBuffer[5] !== 0x78 ||
        exifBuffer[6] !== 0x69 || exifBuffer[7] !== 0x66) {
      return null;
    }

    // TIFF 헤더 (offset 6)
    let offset = 6;
    const littleEndian = exifBuffer[offset + 1] === 0x49; // 'I' = little-endian

    // IFD0 오프셋
    const ifdOffset = littleEndian
      ? exifBuffer.readUInt32LE(offset + 4)
      : exifBuffer.readUInt32BE(offset + 4);

    if (ifdOffset + 6 > exifBuffer.length) return null;

    // IFD0 진입점
    const ifdPos = offset + ifdOffset;
    const numEntries = littleEndian
      ? exifBuffer.readUInt16LE(ifdPos)
      : exifBuffer.readUInt16BE(ifdPos);

    // IFD 항목 순회 (각 항목 12바이트)
    for (let i = 0; i < numEntries; i++) {
      const entryPos = ifdPos + 2 + i * 12;
      if (entryPos + 12 > exifBuffer.length) break;

      const tag = littleEndian
        ? exifBuffer.readUInt16LE(entryPos)
        : exifBuffer.readUInt16BE(entryPos);

      // Orientation 태그 (0x0112 = 274)
      if (tag === 0x0112) {
        const value = littleEndian
          ? exifBuffer.readUInt16LE(entryPos + 8)
          : exifBuffer.readUInt16BE(entryPos + 8);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * PNG 크기 추출 (orientation 기본값 1)
 */
function extractPngDimensions(buffer: Buffer): { width: number; height: number; orientation: number } | null {
  if (buffer.length < 24) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height, orientation: 1 };
}

/**
 * GIF 크기 추출 (orientation 기본값 1)
 */
function extractGifDimensions(buffer: Buffer): { width: number; height: number; orientation: number } | null {
  if (buffer.length < 10) return null;
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return { width, height, orientation: 1 };
}

/**
 * WebP 크기 추출 (orientation 기본값 1)
 */
function extractWebpDimensions(buffer: Buffer): { width: number; height: number; orientation: number } | null {
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
      return { width, height, orientation: 1 };
    }

    // VP8L 손실 없음 크기 추출
    if (buffer.subarray(vp8Index, vp8Index + 4).toString() === 'VP8L') {
      const offset = vp8Index + 5;
      const bits = buffer.readUInt32LE(offset);
      const width = ((bits & 0x3fff) + 1);
      const height = (((bits >> 14) & 0x3fff) + 1);
      return { width, height, orientation: 1 };
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
