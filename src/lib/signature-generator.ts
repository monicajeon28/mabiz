/**
 * Automated Signature Generator
 * Generates stylized digital signatures from names using Canvas API
 * Supports 5 font styles with caching for performance
 *
 * Usage:
 * ```typescript
 * const base64 = await generateAutoSignature('홍길동', 'brush');
 * // Use base64 in <img src={base64} />
 * ```
 */

/**
 * Font style types
 */
export type FontName = 'brush' | 'comic' | 'hand' | 'modern' | 'classic';

/**
 * Font family mappings with fallbacks
 */
const FONT_FAMILY_MAP: Record<FontName, string> = {
  brush: '"Dancing Script", cursive, "Microsoft YaHei", sans-serif',
  comic: '"Comic Sans MS", cursive, "Microsoft YaHei", sans-serif',
  hand: '"Permanent Marker", cursive, "Microsoft YaHei", sans-serif',
  modern: '"Montserrat", sans-serif, "Microsoft YaHei", sans-serif',
  classic: '"Playfair Display", serif, "Noto Serif KR", serif',
};

/**
 * Signature cache to avoid regenerating the same signature
 * Key: "${name}:${fontName}"
 */
const SIGNATURE_CACHE = new Map<string, string>();

/**
 * Canvas size configuration (in pixels)
 */
const CANVAS_CONFIG = {
  width: 400,
  height: 120,
  dpi: 96,
} as const;

/**
 * Text rendering configuration
 */
const TEXT_CONFIG = {
  fontSize: 48,
  color: '#000000',
  x: 30,
  y: 70,
  maxWidth: 350,
} as const;

/**
 * Main function to generate auto signature as Base64 data URI
 *
 * @param name - Name to be signed (supports Korean, English, etc.)
 * @param fontName - Font style to use (brush, comic, hand, modern, classic)
 * @returns Base64 PNG data URI (e.g., "data:image/png;base64,...")
 *
 * @example
 * const sig = await generateAutoSignature('김철수', 'brush');
 * <img src={sig} alt="signature" />
 */
export async function generateAutoSignature(
  name: string,
  fontName: FontName
): Promise<string> {
  // Validate inputs
  if (!name || name.trim().length === 0) {
    throw new Error('[Signature] Name cannot be empty');
  }

  if (!Object.keys(FONT_FAMILY_MAP).includes(fontName)) {
    throw new Error(
      `[Signature] Invalid font name: ${fontName}. Must be one of: ${Object.keys(FONT_FAMILY_MAP).join(', ')}`
    );
  }

  // Check cache first (case-sensitive)
  const cacheKey = `${name}:${fontName}`;
  const cached = SIGNATURE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Render signature on canvas
  const canvas = renderSignatureToCanvas(name, fontName);

  // Convert canvas to Base64
  const base64 = canvasToBase64(canvas);

  // Validate output size (should be < 500KB)
  if (base64.length > 500 * 1024 * 4) {
    // 4x because base64 encoding increases size by ~33%
    throw new Error(
      `[Signature] Generated signature too large (${base64.length} bytes)`
    );
  }

  // Cache result
  SIGNATURE_CACHE.set(cacheKey, base64);

  return base64;
}

/**
 * Render signature text on HTML5 Canvas
 *
 * @internal
 * @param name - Name to render
 * @param fontName - Font style
 * @returns HTMLCanvasElement with signature rendered
 */
function renderSignatureToCanvas(name: string, fontName: FontName): HTMLCanvasElement {
  // Check if Canvas is supported
  if (typeof document === 'undefined') {
    // Server-side: use canvas package (Node.js)
    return renderSignatureCanvasNode(name, fontName);
  }

  // Client-side: use browser Canvas API
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_CONFIG.width;
  canvas.height = CANVAS_CONFIG.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('[Signature] Failed to get 2D context from canvas');
  }

  // Set background to white
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Load and set font
  const fontFamily = FONT_FAMILY_MAP[fontName];
  ctx.font = `${TEXT_CONFIG.fontSize}px ${fontFamily}`;
  ctx.fillStyle = TEXT_CONFIG.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Draw text
  try {
    ctx.fillText(name, TEXT_CONFIG.x, TEXT_CONFIG.y, TEXT_CONFIG.maxWidth);
  } catch (error) {
    console.warn(
      `[Signature] Warning: Text rendering may have failed for "${name}"`,
      error
    );
  }

  return canvas;
}

/**
 * Server-side Canvas rendering using node-canvas package
 *
 * @internal
 * @param name - Name to render
 * @param fontName - Font style
 * @returns Canvas object
 */
function renderSignatureCanvasNode(name: string, fontName: FontName): any {
  // Dynamic require to avoid breaking client-side bundling
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require('canvas');

    const canvas = createCanvas(CANVAS_CONFIG.width, CANVAS_CONFIG.height);
    const ctx = canvas.getContext('2d');

    // Set background to white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set font
    const fontFamily = FONT_FAMILY_MAP[fontName];
    ctx.font = `${TEXT_CONFIG.fontSize}px ${fontFamily}`;
    ctx.fillStyle = TEXT_CONFIG.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Draw text
    ctx.fillText(name, TEXT_CONFIG.x, TEXT_CONFIG.y, TEXT_CONFIG.maxWidth);

    return canvas;
  } catch (error) {
    throw new Error(
      `[Signature] Server-side canvas requires 'canvas' package. Install: npm install canvas. Error: ${error}`
    );
  }
}

/**
 * Convert Canvas to Base64 PNG data URI
 *
 * @internal
 * @param canvas - HTMLCanvasElement or node-canvas Canvas
 * @returns Base64 data URI (data:image/png;base64,...)
 */
function canvasToBase64(canvas: HTMLCanvasElement | any): string {
  // Browser Canvas
  if (canvas.toDataURL) {
    return canvas.toDataURL('image/png');
  }

  // Node Canvas
  if (canvas.toBuffer) {
    const buffer = canvas.toBuffer('image/png');
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  throw new Error('[Signature] Canvas object does not support toDataURL or toBuffer');
}

/**
 * Clear signature cache (useful for testing or freeing memory)
 *
 * @example
 * clearSignatureCache();
 */
export function clearSignatureCache(): void {
  SIGNATURE_CACHE.clear();
}

/**
 * Get cache statistics
 *
 * @example
 * const stats = getSignatureCacheStats();
 * console.log(`Cache size: ${stats.size} entries, ${stats.totalBytes} bytes`);
 */
export function getSignatureCacheStats(): {
  size: number;
  totalBytes: number;
  entries: Array<{ key: string; bytes: number }>;
} {
  let totalBytes = 0;
  const entries: Array<{ key: string; bytes: number }> = [];

  SIGNATURE_CACHE.forEach((value, key) => {
    const bytes = value.length;
    totalBytes += bytes;
    entries.push({ key, bytes });
  });

  return {
    size: SIGNATURE_CACHE.size,
    totalBytes,
    entries: entries.sort((a, b) => b.bytes - a.bytes),
  };
}

/**
 * Unit test helper: generate signature without cache
 *
 * @internal
 * @param name - Name to sign
 * @param fontName - Font style
 * @returns Base64 PNG
 */
export async function generateAutoSignatureNoCache(
  name: string,
  fontName: FontName
): Promise<string> {
  const canvas = renderSignatureToCanvas(name, fontName);
  return canvasToBase64(canvas);
}
