/**
 * 여권 암호화 테스트
 * 실행: npm test -- passport-encryption
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  encryptPassport,
  decryptPassport,
  maskPassport,
  validateEncryptionKey,
  generateEncryptionKey,
} from './passport-encryption';

describe('Passport Encryption', () => {
  beforeAll(() => {
    // 테스트용 키 설정 (이미 환경변수에 있어야 함)
    if (!process.env.PASSPORT_ENCRYPTION_KEY) {
      process.env.PASSPORT_ENCRYPTION_KEY = generateEncryptionKey();
    }
  });

  describe('encryptPassport & decryptPassport', () => {
    it('평문을 암호화 후 복호화하면 원래대로 복원', () => {
      const plaintext = 'M12345678';
      const { encryptedData, iv } = encryptPassport(plaintext);

      // 암호화된 데이터와 IV가 반환됨
      expect(encryptedData).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(encryptedData).not.toBe(plaintext);

      // 복호화하면 원래대로 복원
      const decrypted = decryptPassport(encryptedData, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('같은 평문도 매번 다르게 암호화 (IV 때문)', () => {
      const plaintext = 'M87654321';

      const encrypted1 = encryptPassport(plaintext);
      const encrypted2 = encryptPassport(plaintext);

      // 암호화된 데이터가 다름 (IV가 다르므로)
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);

      // 하지만 복호화하면 같은 결과
      const decrypted1 = decryptPassport(encrypted1.encryptedData, encrypted1.iv);
      const decrypted2 = decryptPassport(encrypted2.encryptedData, encrypted2.iv);
      expect(decrypted1).toBe(decrypted2);
      expect(decrypted1).toBe(plaintext);
    });

    it('다양한 여권번호 형식 처리', () => {
      const testCases = [
        'M12345678', // 한국
        'C12345678', // 중국
        'P12345678', // 파스포트
        '123456789', // 숫자만
        'ABC-DEF-GHI', // 특수문자
        '여권번호테스트', // 한글
      ];

      for (const plaintext of testCases) {
        const { encryptedData, iv } = encryptPassport(plaintext);
        const decrypted = decryptPassport(encryptedData, iv);
        expect(decrypted).toBe(plaintext);
      }
    });

    it('빈 문자열 처리', () => {
      const plaintext = '';
      const { encryptedData, iv } = encryptPassport(plaintext);
      const decrypted = decryptPassport(encryptedData, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('긴 문자열 처리', () => {
      const plaintext = 'M'.repeat(200); // 200자
      const { encryptedData, iv } = encryptPassport(plaintext);
      const decrypted = decryptPassport(encryptedData, iv);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('maskPassport', () => {
    it('마스킹: 뒤 4자만 표시', () => {
      expect(maskPassport('M12345678')).toBe('****5678');
      expect(maskPassport('C87654321')).toBe('****4321');
      expect(maskPassport('P11111111')).toBe('****1111');
    });

    it('4자 미만이면 마스킹 불가', () => {
      expect(maskPassport('ABC')).toBe('****');
      expect(maskPassport('M')).toBe('****');
      expect(maskPassport('')).toBe('****');
    });

    it('정확히 4자면 전체 마스킹', () => {
      expect(maskPassport('M123')).toBe('****M123');
    });
  });

  describe('validateEncryptionKey', () => {
    it('올바른 키가 설정되면 true 반환', () => {
      expect(validateEncryptionKey()).toBe(true);
    });

    it('키가 없으면 false 반환', () => {
      const original = process.env.PASSPORT_ENCRYPTION_KEY;
      delete process.env.PASSPORT_ENCRYPTION_KEY;

      expect(validateEncryptionKey()).toBe(false);

      process.env.PASSPORT_ENCRYPTION_KEY = original;
    });
  });

  describe('generateEncryptionKey', () => {
    it('32바이트 hex 문자열 생성', () => {
      const key = generateEncryptionKey();

      // 64자 (32바이트 = 64 hex 문자)
      expect(key.length).toBe(64);

      // 모두 hex 문자
      expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true);
    });

    it('매번 다른 키 생성', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('Edge Cases', () => {
    it('특수문자 처리', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const { encryptedData, iv } = encryptPassport(plaintext);
      const decrypted = decryptPassport(encryptedData, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('새줄 문자 처리', () => {
      const plaintext = 'Line1\nLine2\nLine3';
      const { encryptedData, iv } = encryptPassport(plaintext);
      const decrypted = decryptPassport(encryptedData, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('유니코드 처리', () => {
      const plaintext = '🔐🔑🛡️'; // 이모지
      const { encryptedData, iv } = encryptPassport(plaintext);
      const decrypted = decryptPassport(encryptedData, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('잘못된 IV로 복호화하면 오류 발생', () => {
      const plaintext = 'M12345678';
      const { encryptedData } = encryptPassport(plaintext);
      const wrongIv = encryptPassport('wrong').iv;

      expect(() => {
        decryptPassport(encryptedData, wrongIv);
      }).toThrow();
    });

    it('손상된 암호화 데이터로 복호화하면 오류 발생', () => {
      const plaintext = 'M12345678';
      const { iv } = encryptPassport(plaintext);
      const corruptedData = 'aabbccddee'; // 임의의 데이터

      expect(() => {
        decryptPassport(corruptedData, iv);
      }).toThrow();
    });
  });

  describe('Performance', () => {
    it('1000회 암호화 성능', () => {
      const plaintext = 'M12345678';
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        encryptPassport(plaintext);
      }

      const elapsed = Date.now() - startTime;
      console.log(`1000회 암호화: ${elapsed}ms (평균 ${(elapsed / 1000).toFixed(3)}ms)`);

      // 1000회 암호화가 5초 이내 (보통 100-200ms)
      expect(elapsed).toBeLessThan(5000);
    });

    it('1000회 복호화 성능', () => {
      const plaintext = 'M12345678';
      const { encryptedData, iv } = encryptPassport(plaintext);
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        decryptPassport(encryptedData, iv);
      }

      const elapsed = Date.now() - startTime;
      console.log(`1000회 복호화: ${elapsed}ms (평균 ${(elapsed / 1000).toFixed(3)}ms)`);

      // 1000회 복호화가 5초 이내 (보통 100-200ms)
      expect(elapsed).toBeLessThan(5000);
    });
  });
});

/**
 * 테스트 실행:
 * npm test -- passport-encryption
 *
 * 테스트 범위:
 * ✅ 암호화/복호화 (평문 복원)
 * ✅ 같은 평문도 매번 다르게 암호화 (IV 검증)
 * ✅ 다양한 여권번호 형식
 * ✅ 빈 문자열 & 긴 문자열
 * ✅ 마스킹 (뒤 4자)
 * ✅ 키 검증
 * ✅ 키 생성 (32바이트)
 * ✅ Edge Cases (특수문자, 유니코드, 잘못된 IV)
 * ✅ 성능 (1000회 < 5초)
 */
