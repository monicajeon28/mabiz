/**
 * Sensitive Data Encryption Tests
 *
 * 암호화/복호화 기능 검증
 */

import {
  encryptLandingNotes,
  decryptLandingNotes,
  encryptAuditLogDetails,
  decryptAuditLogDetails,
  canDecryptSensitiveData,
  maskSensitiveData
} from './sensitive-data-encryption';

describe('Sensitive Data Encryption', () => {
  // ──────────────────────────────────────────────────────────────
  // 1. Landing Notes Encryption/Decryption
  // ──────────────────────────────────────────────────────────────

  describe('encryptLandingNotes / decryptLandingNotes', () => {
    it('should encrypt and decrypt landing notes correctly', () => {
      const testData = {
        travelType: '해외여행',
        budget: '159만원',
        problem: '신혼부부 여행 계획'
      };

      // 암호화
      const encrypted = encryptLandingNotes(testData);

      // 검증: IV:encryptedData:authTag 형식
      expect(encrypted).toMatch(/^[a-f0-9]{32}:[a-f0-9]+:[a-f0-9]{32}$/);

      // 복호화
      const decrypted = decryptLandingNotes(encrypted);

      // 검증: 원본 데이터 복원
      expect(decrypted.source).toBe('LANDING_CRUISEDOT');
      expect(decrypted.data).toEqual(testData);
      expect(decrypted.timestamp).toBeTruthy();
    });

    it('should handle empty data', () => {
      const encrypted = encryptLandingNotes({});

      expect(encrypted).toMatch(/^[a-f0-9]{32}:[a-f0-9]+:[a-f0-9]{32}$/);

      const decrypted = decryptLandingNotes(encrypted);
      expect(decrypted.source).toBe('LANDING_CRUISEDOT');
      expect(decrypted.data).toEqual({});
    });

    it('should handle partially filled data', () => {
      const testData = {
        travelType: '국내',
        budget: undefined,
        problem: '예산 상담 필요'
      };

      const encrypted = encryptLandingNotes(testData);
      const decrypted = decryptLandingNotes(encrypted);

      expect(decrypted.data).toEqual(testData);
    });

    it('should fail to decrypt with wrong key', () => {
      const testData = {
        travelType: '해외',
        budget: '200만원',
        problem: '싱글 여행'
      };

      const encrypted = encryptLandingNotes(testData);

      // 의도적으로 잘못된 authTag 사용
      const tampered = encrypted.replace(/:[a-f0-9]{32}$/, ':' + 'a'.repeat(32));

      // 복호화 시도 (실패 예상)
      const decrypted = decryptLandingNotes(tampered);

      // Fallback: 빈 객체 반환
      expect(decrypted.data).toBeUndefined();
    });

    it('should handle plaintext fallback for non-encrypted data', () => {
      const plaintext = JSON.stringify({
        source: 'LANDING_CRUISEDOT',
        data: { travelType: '국내' }
      });

      const decrypted = decryptLandingNotes(plaintext);

      expect(decrypted.source).toBe('LANDING_CRUISEDOT');
      expect(decrypted.data.travelType).toBe('국내');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 2. Audit Log Encryption/Decryption
  // ──────────────────────────────────────────────────────────────

  describe('encryptAuditLogDetails / decryptAuditLogDetails', () => {
    it('should encrypt and decrypt audit log details', () => {
      const action = 'LANDING_SIGNUP';
      const details = {
        email: 'user@example.com',
        phone: '01012345678',
        lens: 'L6'
      };

      const encrypted = encryptAuditLogDetails(action, details);
      const decrypted = decryptAuditLogDetails(encrypted);

      expect(decrypted.action).toBe(action);
      expect(decrypted.details).toEqual(details);
      expect(decrypted.timestamp).toBeTruthy();
    });

    it('should handle complex audit log data', () => {
      const action = 'CONTACT_IMPORTED';
      const details = {
        count: 150,
        source: 'CSV',
        fields: ['name', 'email', 'phone'],
        timestamp: new Date().toISOString()
      };

      const encrypted = encryptAuditLogDetails(action, details);
      const decrypted = decryptAuditLogDetails(encrypted);

      expect(decrypted.action).toBe(action);
      expect(decrypted.details).toEqual(details);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 3. Permission Check
  // ──────────────────────────────────────────────────────────────

  describe('canDecryptSensitiveData', () => {
    it('should allow ADMIN role', () => {
      expect(canDecryptSensitiveData('ADMIN')).toBe(true);
    });

    it('should allow OWNER role', () => {
      expect(canDecryptSensitiveData('OWNER')).toBe(true);
    });

    it('should allow MANAGER role', () => {
      expect(canDecryptSensitiveData('MANAGER')).toBe(true);
    });

    it('should allow SUPER_ADMIN role', () => {
      expect(canDecryptSensitiveData('SUPER_ADMIN')).toBe(true);
    });

    it('should deny AGENT role', () => {
      expect(canDecryptSensitiveData('AGENT')).toBe(false);
    });

    it('should deny VIEWER role', () => {
      expect(canDecryptSensitiveData('VIEWER')).toBe(false);
    });

    it('should deny undefined role', () => {
      expect(canDecryptSensitiveData(undefined)).toBe(false);
    });

    it('should handle case-insensitive roles', () => {
      expect(canDecryptSensitiveData('admin')).toBe(true);
      expect(canDecryptSensitiveData('Admin')).toBe(true);
      expect(canDecryptSensitiveData('ADMIN')).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 4. Data Masking
  // ──────────────────────────────────────────────────────────────

  describe('maskSensitiveData', () => {
    it('should mask specified fields', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        budget: '200만원',
        problem: '예산 상담 필요'
      };

      const masked = maskSensitiveData(data, ['budget', 'problem']);

      expect(masked.name).toBe('John Doe');
      expect(masked.email).toBe('john@example.com');
      expect(masked.budget).toMatch(/^[^\*]{3}\*+$/); // first 3 chars + ****
      expect(masked.problem).toMatch(/^[^\*]{3}\*+$/);
    });

    it('should use default mask fields', () => {
      const data = {
        name: 'Jane Smith',
        budget: '159만원',
        problem: 'Single traveler',
        email: 'jane@example.com'
      };

      const masked = maskSensitiveData(data);

      // Default: ['budget', 'problem', 'email']
      expect(masked.budget).toMatch(/\*+/);
      expect(masked.problem).toMatch(/\*+/);
      expect(masked.email).toMatch(/\*+/);
      expect(masked.name).toBe('Jane Smith'); // not masked by default
    });

    it('should handle short strings', () => {
      const data = {
        code: 'ABC'
      };

      const masked = maskSensitiveData(data, ['code']);

      // Short string handling
      expect(masked.code).toBe('****');
    });

    it('should handle missing fields', () => {
      const data = {
        name: 'Test'
      };

      const masked = maskSensitiveData(data, ['budget', 'phone']);

      expect(masked.name).toBe('Test');
      expect(masked.budget).toBeUndefined();
      expect(masked.phone).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 5. Integration Tests
  // ──────────────────────────────────────────────────────────────

  describe('Integration Tests', () => {
    it('should handle complete landing signup workflow', () => {
      // 1. User submits landing form
      const formData = {
        travelType: '해외여행',
        budget: '200만원',
        problem: '신혼부부 맞춤 여행'
      };

      // 2. Server encrypts and stores
      const encrypted = encryptLandingNotes(formData);

      // 3. Admin retrieves and decrypts
      const decrypted = decryptLandingNotes(encrypted);

      expect(decrypted.data).toEqual(formData);

      // 4. Agent views (masked)
      const masked = maskSensitiveData(decrypted.data || {}, [
        'budget',
        'problem'
      ]);

      expect(masked.travelType).toBe('해외여행');
      expect(masked.budget).toMatch(/\*+/);
      expect(masked.problem).toMatch(/\*+/);
    });

    it('should preserve data integrity across multiple encrypt/decrypt cycles', () => {
      const original = {
        travelType: '크루즈',
        budget: '159만원',
        problem: '가족 단체 여행'
      };

      // Cycle 1
      let encrypted = encryptLandingNotes(original);
      let decrypted = decryptLandingNotes(encrypted);
      expect(decrypted.data).toEqual(original);

      // Cycle 2
      encrypted = encryptLandingNotes(decrypted.data || original);
      decrypted = decryptLandingNotes(encrypted);
      expect(decrypted.data).toEqual(original);

      // Cycle 3
      encrypted = encryptLandingNotes(decrypted.data || original);
      decrypted = decryptLandingNotes(encrypted);
      expect(decrypted.data).toEqual(original);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 6. Performance Tests (Optional)
  // ──────────────────────────────────────────────────────────────

  describe('Performance', () => {
    it('should encrypt in reasonable time', () => {
      const testData = {
        travelType: '해외여행',
        budget: '200만원',
        problem: '신혼부부 맞춤 여행 플래너 상담 필요'
      };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        encryptLandingNotes(testData);
      }
      const duration = performance.now() - start;

      // 100 encryptions should take < 500ms (< 5ms each)
      expect(duration).toBeLessThan(500);
    });

    it('should decrypt in reasonable time', () => {
      const testData = {
        travelType: '해외여행',
        budget: '200만원',
        problem: '신혼부부 맞춤 여행'
      };

      const encrypted = encryptLandingNotes(testData);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        decryptLandingNotes(encrypted);
      }
      const duration = performance.now() - start;

      // 100 decryptions should take < 500ms (< 5ms each)
      expect(duration).toBeLessThan(500);
    });
  });
});
