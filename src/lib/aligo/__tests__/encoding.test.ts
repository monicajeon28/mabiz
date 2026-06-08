/**
 * EUC-KR 인코딩 검증 및 변환 테스트
 */

import {
  validateKoreanMessage,
  detectUnsupportedChars,
  sanitizeForEucKr,
  isSupportedInEucKr,
  canEncodeToEucKr,
  estimateEucKrByteLength,
  calculateMessageType,
  validateMessageBatch,
  sanitizeMessageBatch,
} from '../encoding';

describe('EUC-KR Encoding Validation', () => {
  describe('isSupportedInEucKr', () => {
    it('should support Korean characters', () => {
      expect(isSupportedInEucKr('안')).toBe(true);
      expect(isSupportedInEucKr('녕')).toBe(true);
      expect(isSupportedInEucKr('하')).toBe(true);
      expect(isSupportedInEucKr('세')).toBe(true);
      expect(isSupportedInEucKr('요')).toBe(true);
    });

    it('should support ASCII characters', () => {
      expect(isSupportedInEucKr('a')).toBe(true);
      expect(isSupportedInEucKr('A')).toBe(true);
      expect(isSupportedInEucKr('0')).toBe(true);
      expect(isSupportedInEucKr(' ')).toBe(true);
      expect(isSupportedInEucKr('!')).toBe(true);
    });

    it('should support basic symbols', () => {
      expect(isSupportedInEucKr('@')).toBe(true);
      expect(isSupportedInEucKr('#')).toBe(true);
      expect(isSupportedInEucKr('(')).toBe(true);
      expect(isSupportedInEucKr(')')).toBe(true);
      expect(isSupportedInEucKr('-')).toBe(true);
    });

    it('should reject emojis', () => {
      expect(isSupportedInEucKr('☺')).toBe(false);
      expect(isSupportedInEucKr('❤')).toBe(false);
      expect(isSupportedInEucKr('🎉')).toBe(false);
    });

    it('should reject control characters', () => {
      expect(isSupportedInEucKr('\x00')).toBe(false);
      expect(isSupportedInEucKr('\x1f')).toBe(false);
    });
  });

  describe('detectUnsupportedChars', () => {
    it('should detect emoji in message', () => {
      const unsupported = detectUnsupportedChars('안녕☺');
      expect(unsupported).toContain('☺');
      expect(unsupported.length).toBe(1);
    });

    it('should detect multiple different unsupported chars', () => {
      const unsupported = detectUnsupportedChars('안녕☺❤');
      expect(unsupported).toHaveLength(2);
      expect(unsupported).toContain('☺');
      expect(unsupported).toContain('❤');
    });

    it('should return empty array for valid message', () => {
      const unsupported = detectUnsupportedChars('안녕하세요');
      expect(unsupported).toHaveLength(0);
    });

    it('should deduplicate same unsupported chars', () => {
      const unsupported = detectUnsupportedChars('☺☺☺');
      expect(unsupported).toHaveLength(1);
      expect(unsupported[0]).toBe('☺');
    });
  });

  describe('validateKoreanMessage', () => {
    it('should validate message with only Korean text', () => {
      const result = validateKoreanMessage('안녕하세요');
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.unsupportedChars).toHaveLength(0);
    });

    it('should validate message with Korean and English', () => {
      const result = validateKoreanMessage('안녕 hello');
      expect(result.valid).toBe(true);
    });

    it('should reject message with emoji', () => {
      const result = validateKoreanMessage('안녕☺');
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.unsupportedChars.length).toBeGreaterThan(0);
    });

    it('should detect all unsupported chars', () => {
      const result = validateKoreanMessage('안녕☺❤');
      expect(result.valid).toBe(false);
      expect(result.unsupportedChars).toHaveLength(2);
    });

    it('should include code point information', () => {
      const result = validateKoreanMessage('☺');
      expect(result.unsupportedChars[0]).toHaveProperty('codePoint');
      expect(result.unsupportedChars[0]).toHaveProperty('description');
      expect(result.unsupportedChars[0].codePoint).toMatch(/^U\+/);
    });

    it('should handle empty message', () => {
      const result = validateKoreanMessage('');
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeForEucKr', () => {
    it('should replace unsupported chars with default replacement', () => {
      const result = sanitizeForEucKr('안녕☺');
      expect(result).toBe('안녕?');
    });

    it('should replace with custom replacement', () => {
      const result = sanitizeForEucKr('안녕☺', '*');
      expect(result).toBe('안녕*');
    });

    it('should remove unsupported chars when replacement is empty', () => {
      const result = sanitizeForEucKr('안녕☺', '');
      expect(result).toBe('안녕');
    });

    it('should handle multiple unsupported chars', () => {
      const result = sanitizeForEucKr('안녕☺❤');
      expect(result).toBe('안녕??');
    });

    it('should preserve valid message', () => {
      const result = sanitizeForEucKr('안녕하세요');
      expect(result).toBe('안녕하세요');
    });

    it('should handle empty string', () => {
      const result = sanitizeForEucKr('');
      expect(result).toBe('');
    });
  });

  describe('canEncodeToEucKr', () => {
    it('should return true for valid Korean text', () => {
      expect(canEncodeToEucKr('안녕하세요')).toBe(true);
    });

    it('should return false for text with emoji', () => {
      expect(canEncodeToEucKr('안녕☺')).toBe(false);
    });
  });

  describe('estimateEucKrByteLength', () => {
    it('should estimate bytes for ASCII', () => {
      expect(estimateEucKrByteLength('Hello')).toBe(5);
    });

    it('should estimate bytes for Korean', () => {
      const result = estimateEucKrByteLength('안녕');
      expect(result).toBe(4);
    });

    it('should estimate bytes for mixed content', () => {
      const result = estimateEucKrByteLength('안녕 hello');
      expect(result).toBe(10);
    });

    it('should handle empty string', () => {
      expect(estimateEucKrByteLength('')).toBe(0);
    });
  });

  describe('calculateMessageType', () => {
    it('should classify short message as SMS', () => {
      const result = calculateMessageType('안녕하세요');
      expect(result.type).toBe('SMS');
      expect(result.parts).toBe(1);
    });

    it('should classify message at 90 char limit as SMS', () => {
      const message = 'a'.repeat(90);
      const result = calculateMessageType(message);
      expect(result.type).toBe('SMS');
      expect(result.parts).toBe(1);
    });

    it('should classify 91-char message as LMS', () => {
      const message = 'a'.repeat(91);
      const result = calculateMessageType(message);
      expect(result.type).toBe('LMS');
      expect(result.parts).toBe(1);
    });

    it('should classify >2000 char message as split SMS', () => {
      const message = 'a'.repeat(2001);
      const result = calculateMessageType(message);
      expect(result.type).toBe('SMS');
      expect(result.parts).toBeGreaterThan(1);
    });
  });

  describe('validateMessageBatch', () => {
    it('should validate multiple messages', () => {
      const results = validateMessageBatch(['안녕', '☺']);
      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });

    it('should include original message in result', () => {
      const results = validateMessageBatch(['안녕']);
      expect(results[0].message).toBe('안녕');
    });
  });

  describe('sanitizeMessageBatch', () => {
    it('should sanitize multiple messages', () => {
      const results = sanitizeMessageBatch(['안녕☺', '안녕❤']);
      expect(results).toEqual(['안녕?', '안녕?']);
    });

    it('should use custom replacement', () => {
      const results = sanitizeMessageBatch(['안녕☺'], '*');
      expect(results).toEqual(['안녕*']);
    });
  });
});
