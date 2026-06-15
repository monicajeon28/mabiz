/**
 * Unit tests for signature-generator.ts
 * Tests Base64 generation, caching, and error handling
 */

import {
  generateAutoSignature,
  generateAutoSignatureNoCache,
  clearSignatureCache,
  getSignatureCacheStats,
  type FontName,
} from '../signature-generator';

describe('Signature Generator', () => {
  beforeEach(() => {
    clearSignatureCache();
  });

  describe('generateAutoSignature', () => {
    it('should generate Base64 PNG for Korean name with brush font', async () => {
      const sig = await generateAutoSignature('홍길동', 'brush');

      // Check Base64 format
      expect(sig).toMatch(/^data:image\/png;base64,.+$/);
      expect(sig.length).toBeGreaterThan(100);
      expect(sig.length).toBeLessThan(500 * 1024 * 4); // < 500KB
    });

    it('should generate Base64 PNG for English name with modern font', async () => {
      const sig = await generateAutoSignature('John Smith', 'modern');

      expect(sig).toMatch(/^data:image\/png;base64,.+$/);
      expect(sig.length).toBeGreaterThan(100);
    });

    it('should support all 5 font styles', async () => {
      const fonts: FontName[] = ['brush', 'comic', 'hand', 'modern', 'classic'];

      for (const font of fonts) {
        const sig = await generateAutoSignature('김철수', font);
        expect(sig).toMatch(/^data:image\/png;base64,.+$/);
      }
    });

    it('should cache identical signatures (< 10ms on second call)', async () => {
      const name = '박영희';
      const font: FontName = 'brush';

      // First call (cache miss)
      const start1 = performance.now();
      const sig1 = await generateAutoSignature(name, font);
      const duration1 = performance.now() - start1;

      // Second call (cache hit)
      const start2 = performance.now();
      const sig2 = await generateAutoSignature(name, font);
      const duration2 = performance.now() - start2;

      // Should return identical result
      expect(sig1).toBe(sig2);

      // Cache hit should be faster (< 10ms)
      expect(duration2).toBeLessThan(10);
    });

    it('should throw on empty name', async () => {
      await expect(generateAutoSignature('', 'brush')).rejects.toThrow(
        'Name cannot be empty'
      );
    });

    it('should throw on whitespace-only name', async () => {
      await expect(generateAutoSignature('   ', 'brush')).rejects.toThrow(
        'Name cannot be empty'
      );
    });

    it('should throw on invalid font name', async () => {
      // @ts-expect-error - Testing invalid input
      await expect(generateAutoSignature('홍길동', 'invalid')).rejects.toThrow(
        'Invalid font name'
      );
    });

    it('should generate different Base64 for different names', async () => {
      const sig1 = await generateAutoSignature('이름1', 'brush');
      const sig2 = await generateAutoSignature('이름2', 'brush');

      // Different names should produce different signatures
      expect(sig1).not.toBe(sig2);
    });

    it('should generate different Base64 for same name with different fonts', async () => {
      const name = '김미영';
      const sig1 = await generateAutoSignature(name, 'brush');
      const sig2 = await generateAutoSignature(name, 'modern');

      // Different fonts should produce different signatures
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('generateAutoSignatureNoCache', () => {
    it('should bypass cache and generate new signature each time', async () => {
      const name = '신구호';
      const font: FontName = 'classic';

      clearSignatureCache();

      const sig1 = await generateAutoSignatureNoCache(name, font);
      const sig2 = await generateAutoSignatureNoCache(name, font);

      // Both should be valid Base64 PNGs
      expect(sig1).toMatch(/^data:image\/png;base64,.+$/);
      expect(sig2).toMatch(/^data:image\/png;base64,.+$/);

      // Cache should still be empty
      expect(getSignatureCacheStats().size).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should track cache statistics', async () => {
      await generateAutoSignature('홍길동', 'brush');
      await generateAutoSignature('박영희', 'modern');

      const stats = getSignatureCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.totalBytes).toBeGreaterThan(100);
      expect(stats.entries.length).toBe(2);
      expect(stats.entries[0]).toHaveProperty('key');
      expect(stats.entries[0]).toHaveProperty('bytes');
    });

    it('should clear cache', async () => {
      await generateAutoSignature('홍길동', 'brush');
      expect(getSignatureCacheStats().size).toBe(1);

      clearSignatureCache();
      expect(getSignatureCacheStats().size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters', async () => {
      const sig = await generateAutoSignature('김철수™®©', 'brush');
      expect(sig).toMatch(/^data:image\/png;base64,.+$/);
    });

    it('should handle very long names', async () => {
      const longName = 'A'.repeat(100);
      const sig = await generateAutoSignature(longName, 'modern');
      expect(sig).toMatch(/^data:image\/png;base64,.+$/);
    });

    it('should handle mixed Korean-English names', async () => {
      const sig = await generateAutoSignature('Kim철수 John', 'hand');
      expect(sig).toMatch(/^data:image\/png;base64,.+$/);
    });
  });
});
