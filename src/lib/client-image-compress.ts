export const MAX_IMAGE_UPLOAD_BYTES = 100 * 1024 * 1024;
/**
 * GIF 전용 업로드 한도 (약 4MB).
 * GIF는 애니메이션 보존을 위해 클라 압축을 하지 않고 원본 그대로 전송되므로,
 * Vercel 함수 본문 한도(~4.5MB)에 직격한다. 4MB로 사전 차단하면 플랫폼 한도가
 * 정확히 몇이든 안전마진 안에서 "약 4MB까지" 안내가 항상 참이 된다.
 * (JPG/PNG/WebP는 1920px WebP로 압축되어 작아지므로 이 한도 미적용)
 */
export const GIF_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 1920;
const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/bmp']);

export async function prepareImageForUpload(file: File): Promise<File> {
  const mimeType = (file.type || '').toLowerCase();

  // GIF는 애니메이션 보존을 위해 원본 유지
  if (mimeType === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
    return file;
  }

  if (!mimeType.startsWith('image/') || !COMPRESSIBLE_TYPES.has(mimeType)) {
    return file;
  }

  if (file.size <= 3.5 * 1024 * 1024 && mimeType === 'image/webp') {
    return file;
  }

  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (nextBlob) => resolve(nextBlob),
        'image/webp',
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 로드 실패'));
    };
    img.src = url;
  });

  if (!blob) return file;
  const compressedName = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], compressedName, { type: 'image/webp' });
}
