/**
 * Tests for Sequence Lifecycle Service
 * Tests core logic for calculating days, substitution, and progress tracking
 */

import {
  calculateCurrentDay,
  shouldSendDay,
  performSubstitution,
  isSequenceComplete,
  shouldMarkAsFailed
} from '../sequence-lifecycle-service';

describe('Sequence Lifecycle Service', () => {
  describe('calculateCurrentDay', () => {
    it('should return day 0 for 0-24 hours', () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
      expect(calculateCurrentDay(startedAt)).toBe(0);
    });

    it('should return day 1 for 24-48 hours', () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36 hours ago
      expect(calculateCurrentDay(startedAt)).toBe(1);
    });

    it('should return day 2 for 48-72 hours', () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 60 * 60 * 60 * 1000); // 60 hours ago
      expect(calculateCurrentDay(startedAt)).toBe(2);
    });

    it('should return day 3 for 72+ hours', () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 100 * 60 * 60 * 1000); // 100 hours ago
      expect(calculateCurrentDay(startedAt)).toBe(3);
    });

    it('should handle exact boundaries', () => {
      const now = new Date();

      // Exactly 24 hours
      const day0End = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(calculateCurrentDay(day0End)).toBe(1);

      // Just before 24 hours
      const beforeDay1 = new Date(now.getTime() - 23.99 * 60 * 60 * 1000);
      expect(calculateCurrentDay(beforeDay1)).toBe(0);
    });
  });

  describe('shouldSendDay', () => {
    it('should return true if day not in daysSent array', () => {
      expect(shouldSendDay(0, [1, 2, 3])).toBe(true);
      expect(shouldSendDay(2, [0, 1])).toBe(true);
    });

    it('should return false if day in daysSent array', () => {
      expect(shouldSendDay(0, [0, 1, 2])).toBe(false);
      expect(shouldSendDay(3, [0, 1, 2, 3])).toBe(false);
    });

    it('should handle empty array', () => {
      expect(shouldSendDay(0, [])).toBe(true);
      expect(shouldSendDay(3, [])).toBe(true);
    });

    it('should handle null values in array', () => {
      expect(shouldSendDay(0, [null, 1, 2])).toBe(true);
      expect(shouldSendDay(1, [0, null, 2])).toBe(false);
    });
  });

  describe('performSubstitution', () => {
    it('should replace {{name}} placeholder', async () => {
      const template = 'Hello {{name}}, how are you?';
      const contact = {
        id: 'c1',
        name: 'John',
        phone: '01012345678',
        productName: 'Cruise Gold'
      };
      const sequence = {
        organizationId: 'org1',
        productCode: 'CRUISE_GOLD'
      };

      const result = await performSubstitution(template, contact, sequence);
      expect(result).toContain('John');
      expect(result).not.toContain('{{name}}');
    });

    it('should replace {{product}} placeholder', async () => {
      const template = '당신의 {{product}}가 준비되었습니다.';
      const contact = {
        id: 'c1',
        name: 'John',
        phone: '01012345678',
        productName: 'Cruise Gold'
      };
      const sequence = {
        organizationId: 'org1',
        productCode: 'CRUISE_GOLD'
      };

      const result = await performSubstitution(template, contact, sequence);
      expect(result).toContain('Cruise Gold');
      expect(result).not.toContain('{{product}}');
    });

    it('should handle missing product name gracefully', async () => {
      const template = 'Your {{product}} is ready';
      const contact = {
        id: 'c1',
        name: 'John',
        phone: '01012345678',
        productName: null
      };
      const sequence = {
        organizationId: 'org1',
        productCode: 'CRUISE_GOLD'
      };

      const result = await performSubstitution(template, contact, sequence);
      expect(result).toContain('CRUISE_GOLD');
    });

    it('should be case-insensitive for placeholders', async () => {
      const template = 'Hello {{NAME}}, meet {{PRODUCT}}';
      const contact = {
        id: 'c1',
        name: 'John',
        phone: '01012345678',
        productName: 'Gold'
      };
      const sequence = {
        organizationId: 'org1',
        productCode: null
      };

      const result = await performSubstitution(template, contact, sequence);
      expect(result).not.toContain('{{NAME}}');
      expect(result).not.toContain('{{PRODUCT}}');
      expect(result).toContain('John');
      expect(result).toContain('Gold');
    });
  });

  describe('isSequenceComplete', () => {
    it('should return true if all days sent', () => {
      const instance = {
        day0SentAt: new Date(),
        day1SentAt: new Date(),
        day2SentAt: new Date(),
        day3SentAt: new Date()
      };
      expect(isSequenceComplete(instance)).toBe(true);
    });

    it('should return false if any day not sent', () => {
      const instance = {
        day0SentAt: new Date(),
        day1SentAt: new Date(),
        day2SentAt: new Date(),
        day3SentAt: null
      };
      expect(isSequenceComplete(instance)).toBe(false);
    });

    it('should return false if no days sent', () => {
      const instance = {
        day0SentAt: null,
        day1SentAt: null,
        day2SentAt: null,
        day3SentAt: null
      };
      expect(isSequenceComplete(instance)).toBe(false);
    });
  });

  describe('shouldMarkAsFailed', () => {
    it('should return true if 7+ days elapsed without completion', () => {
      const now = new Date();
      const createdAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const instance = {
        day0SentAt: new Date(),
        day1SentAt: null,
        day2SentAt: null,
        day3SentAt: null
      };

      expect(shouldMarkAsFailed(instance, createdAt)).toBe(true);
    });

    it('should return false if less than 7 days elapsed', () => {
      const now = new Date();
      const createdAt = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago
      const instance = {
        day0SentAt: new Date(),
        day1SentAt: null,
        day2SentAt: null,
        day3SentAt: null
      };

      expect(shouldMarkAsFailed(instance, createdAt)).toBe(false);
    });

    it('should return false if sequence is complete', () => {
      const now = new Date();
      const createdAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const instance = {
        day0SentAt: new Date(),
        day1SentAt: new Date(),
        day2SentAt: new Date(),
        day3SentAt: new Date()
      };

      expect(shouldMarkAsFailed(instance, createdAt)).toBe(false);
    });
  });
});
