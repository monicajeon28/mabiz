import sharp from 'sharp';

export const MAX_IMAGE_UPLOAD_BYTES = 100 * 1024 * 1024;
const ANIMATED_MAX_WIDTH = 1200;
const STILL_MAX_WIDTH = 1600;

export type ProcessedUploadImage = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  isAnimated: boolean;
};

export async function processUploadedImage(
  inputBuffer: Buffer,
  inputMimeType: string,
  fileName: string,
  preferredBaseName?: string,
): Promise<ProcessedUploadImage> {
  const baseName = (preferredBaseName?.trim() || fileName).replace(/\.[^.]+$/, '');
  const isGif = inputMimeType === 'image/gif';

  if (isGif) {
    let processedBuffer: Buffer | null = null;
    let finalMimeType = 'image/webp';
    let finalFileName = `${baseName}.webp`;

    try {
      const metadata = await sharp(inputBuffer, { animated: true }).metadata();
      const needsResize = Boolean(metadata.width && metadata.width > ANIMATED_MAX_WIDTH);

      processedBuffer = await sharp(inputBuffer, { animated: true })
        .resize(needsResize ? ANIMATED_MAX_WIDTH : (metadata.width ?? undefined), null, {
          withoutEnlargement: true,
        })
        .webp({ quality: 80, loop: 0 })
        .toBuffer();
    } catch {
      try {
        const metadata = await sharp(inputBuffer, { animated: true }).metadata();
        const needsResize = Boolean(metadata.width && metadata.width > ANIMATED_MAX_WIDTH);

        processedBuffer = await sharp(inputBuffer, { animated: true })
          .resize(needsResize ? ANIMATED_MAX_WIDTH : (metadata.width ?? undefined), null, {
            withoutEnlargement: true,
          })
          .gif({ colors: 256 })
          .toBuffer();
        finalMimeType = 'image/gif';
        finalFileName = fileName.replace(/\.[^.]+$/, '.gif');
      } catch {
        processedBuffer = inputBuffer;
        finalMimeType = 'image/gif';
        finalFileName = fileName.endsWith('.gif') ? fileName : `${baseName}.gif`;
      }
    }

    return {
      buffer: processedBuffer,
      mimeType: finalMimeType,
      fileName: finalFileName,
      isAnimated: true,
    };
  }

  const processedBuffer = await sharp(inputBuffer)
    .rotate()
    .resize(STILL_MAX_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  return {
    buffer: processedBuffer,
    mimeType: 'image/webp',
    fileName: `${baseName}.webp`,
    isAnimated: false,
  };
}
