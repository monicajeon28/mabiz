import { readFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';

const WATERMARK_PATH = join(process.cwd(), 'public', 'logo-watermark.png');

let _cachedWatermarkBuffer: Buffer | null | undefined = undefined;

export async function getWatermarkBuffer(): Promise<Buffer | null> {
  if (_cachedWatermarkBuffer !== undefined) return _cachedWatermarkBuffer;
  try {
    _cachedWatermarkBuffer = await readFile(WATERMARK_PATH);
  } catch {
    _cachedWatermarkBuffer = null;
  }
  return _cachedWatermarkBuffer;
}

export interface WatermarkOptions {
  opacity?: number;
  sizeRatio?: number;
  grayscale?: boolean;
}

export async function applyWatermarkToSharp(
  imageBuffer: Buffer,
  opts: WatermarkOptions = {}
): Promise<Buffer> {
  const { opacity = 0.4, sizeRatio = 0.5, grayscale = true } = opts;

  const watermarkBuffer = await getWatermarkBuffer();
  let processedImage: sharp.Sharp | null = null;
  let watermarkSharp: sharp.Sharp | null = null;
  let opacitySharp: sharp.Sharp | null = null;
  let finalWatermarkSharp: sharp.Sharp | null = null;

  try {
    processedImage = sharp(imageBuffer);
    const metadata = await processedImage.metadata();
    const imageWidth = metadata.width || 1000;
    const imageHeight = metadata.height || 1000;

    if (watermarkBuffer) {
      watermarkSharp = sharp(watermarkBuffer);
      const wmMeta = await watermarkSharp.metadata();
      const wmWidth = Math.floor(imageWidth * sizeRatio);
      const wmHeight = Math.floor((wmMeta.height || 1) * (wmWidth / (wmMeta.width || 1)));

      let pipeline = watermarkSharp.resize(wmWidth, wmHeight, { fit: 'inside' });
      if (grayscale) pipeline = pipeline.grayscale();
      const resizedWm = await pipeline.ensureAlpha().png().toBuffer();

      opacitySharp = sharp(resizedWm);
      const { data, info } = await opacitySharp.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

      for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.floor(data[i] * opacity);
      }

      finalWatermarkSharp = sharp(Buffer.from(data), {
        raw: { width: info.width, height: info.height, channels: 4 },
      });
      const finalWm = await finalWatermarkSharp.png().toBuffer();

      const top = Math.floor((imageHeight - info.height) / 2);
      const left = Math.floor((imageWidth - info.width) / 2);

      processedImage = processedImage.composite([
        { input: finalWm, top, left, blend: 'over' },
      ]);
    }

    return await processedImage.png({ compressionLevel: 6 }).toBuffer();
  } finally {
    processedImage?.destroy();
    watermarkSharp?.destroy();
    opacitySharp?.destroy();
    finalWatermarkSharp?.destroy();
  }
}
