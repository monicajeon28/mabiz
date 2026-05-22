import {
  isValidObjectionId,
  getObjectionData,
  getAllObjectionIds,
  getObjectionsByCategory,
  validateCustomerReaction,
  validateObjectionInput,
} from '@/lib/objections/validation';

describe('CallLog Objection Handling', () => {
  describe('isValidObjectionId', () => {
    test('should return true for valid objection IDs', () => {
      expect(isValidObjectionId('A-001')).toBe(true);
      expect(isValidObjectionId('A-002')).toBe(true);
      expect(isValidObjectionId('B-001')).toBe(true);
    });

    test('should return false for invalid objection IDs', () => {
      expect(isValidObjectionId('Z-999')).toBe(false);
      expect(isValidObjectionId('invalid')).toBe(false);
      expect(isValidObjectionId('')).toBe(false);
    });
  });

  describe('getObjectionData', () => {
    test('should return objection data for valid ID', () => {
      const data = getObjectionData('A-001');
      expect(data).toBeTruthy();
      expect(data?.id).toBe('A-001');
      expect(data?.categoryName).toBeDefined();
      expect(data?.immediateResponse).toBeDefined();
    });

    test('should return null for invalid ID', () => {
      const data = getObjectionData('Z-999');
      expect(data).toBeNull();
    });
  });

  describe('getAllObjectionIds', () => {
    test('should return all objection IDs sorted', () => {
      const ids = getAllObjectionIds();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain('A-001');
      // Check if sorted
      const sorted = [...ids].sort();
      expect(ids).toEqual(sorted);
    });
  });

  describe('getObjectionsByCategory', () => {
    test('should return objections for valid category', () => {
      const objections = getObjectionsByCategory('1');
      expect(objections.length).toBeGreaterThan(0);
      expect(objections.every(o => o.categoryId === '1')).toBe(true);
    });

    test('should return empty array for invalid category', () => {
      const objections = getObjectionsByCategory('999');
      expect(objections).toEqual([]);
    });
  });

  describe('validateCustomerReaction', () => {
    test('should validate correct reactions', () => {
      expect(validateCustomerReaction('positive')).toBe(true);
      expect(validateCustomerReaction('neutral')).toBe(true);
      expect(validateCustomerReaction('negative')).toBe(true);
    });

    test('should reject invalid reactions', () => {
      expect(validateCustomerReaction('great')).toBe(false);
      expect(validateCustomerReaction('bad')).toBe(false);
      expect(validateCustomerReaction('')).toBe(false);
    });
  });

  describe('validateObjectionInput', () => {
    test('should validate empty input', () => {
      const result = validateObjectionInput({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate valid objectionId', () => {
      const result = validateObjectionInput({ objectionId: 'A-001' });
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid objectionId', () => {
      const result = validateObjectionInput({ objectionId: 'Z-999' });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate valid customerReaction', () => {
      const result = validateObjectionInput({ customerReaction: 'positive' });
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid customerReaction', () => {
      const result = validateObjectionInput({ customerReaction: 'great' });
      expect(result.isValid).toBe(false);
    });

    test('should validate valid recoveryTime', () => {
      const result = validateObjectionInput({ recoveryTime: 45 });
      expect(result.isValid).toBe(true);
    });

    test('should reject negative recoveryTime', () => {
      const result = validateObjectionInput({ recoveryTime: -10 });
      expect(result.isValid).toBe(false);
    });

    test('should validate multiple fields together', () => {
      const result = validateObjectionInput({
        objectionId: 'A-001',
        customerReaction: 'positive',
        recovered: true,
        recoveryTime: 30,
      });
      expect(result.isValid).toBe(true);
    });

    test('should collect all errors', () => {
      const result = validateObjectionInput({
        objectionId: 'Z-999',
        customerReaction: 'great',
        recoveryTime: -5,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('Objection Data Structure', () => {
    test('should have all required fields', () => {
      const data = getObjectionData('A-001');
      expect(data?.id).toBeDefined();
      expect(data?.categoryId).toBeDefined();
      expect(data?.categoryName).toBeDefined();
      expect(data?.priority).toBeDefined();
      expect(data?.frequency).toBeDefined();
      expect(data?.customerSayings).toBeDefined();
      expect(data?.psychologyLens).toBeDefined();
      expect(data?.immediateResponse).toBeDefined();
      expect(data?.expectedConversionLift).toBeDefined();
    });

    test('should have valid psychologyLens values', () => {
      const allIds = getAllObjectionIds();
      const validLenses = [
        'Authority',
        'Social Proof',
        'Loss Aversion',
        'Scarcity',
        'Reframing',
        'Reassurance',
      ];

      allIds.forEach(id => {
        const data = getObjectionData(id);
        expect(data?.psychologyLens).toBeDefined();
        (data?.psychologyLens || []).forEach(lens => {
          expect(validLenses).toContain(lens);
        });
      });
    });

    test('should have immediate response under 30 words', () => {
      const allIds = getAllObjectionIds();
      allIds.forEach(id => {
        const data = getObjectionData(id);
        const response = data?.immediateResponse || '';
        const wordCount = response.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(30);
      });
    });
  });
});
