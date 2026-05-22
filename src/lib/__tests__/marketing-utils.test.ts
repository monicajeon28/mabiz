import { formatAmount, formatDate, formatMonth, maskPhone } from '../marketing-utils';

describe('marketing-utils', () => {
  describe('formatAmount', () => {
    it('should format number with commas and 원', () => {
      expect(formatAmount(1000)).toBe('1,000원');
      expect(formatAmount(1000000)).toBe('1,000,000원');
      expect(formatAmount(0)).toBe('0원');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date to YYYY-MM-DD', () => {
      expect(formatDate('2026-05-22T10:00:00Z')).toBe('2026-05-22');
      expect(formatDate('2026-01-01T00:00:00Z')).toBe('2026-01-01');
    });

    it('should return "-" for null/undefined', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined as any)).toBe('-');
    });

    it('should pad single digit month/day', () => {
      expect(formatDate('2026-05-05T00:00:00Z')).toBe('2026-05-05');
    });
  });

  describe('formatMonth', () => {
    it('should format YYYY-MM to YYYY.MM', () => {
      expect(formatMonth('2026-05')).toBe('2026.05');
      expect(formatMonth('2026-12')).toBe('2026.12');
    });
  });

  describe('maskPhone', () => {
    it('should mask Korean phone numbers', () => {
      expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
      expect(maskPhone('02-123-4567')).toBe('02-****-4567');
    });

    it('should mask international phone numbers', () => {
      expect(maskPhone('+1-123-456-7890')).toBe('+1-****-7890');
      expect(maskPhone('+86-138-1234-5678')).toBe('+86-****-5678');
    });

    it('should return "-" for null/undefined/short numbers', () => {
      expect(maskPhone(null)).toBe('-');
      expect(maskPhone(undefined)).toBe('-');
      expect(maskPhone('123')).toBe('-');
    });

    it('should handle phone numbers without formatting', () => {
      expect(maskPhone('01012345678')).toBe('010-****-5678');
    });
  });
});
