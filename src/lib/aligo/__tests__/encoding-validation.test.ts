/**
 * Aligo 인코딩 검증 + msg_type 자동 분기 테스트
 *
 * Test Cases:
 * 1. calculateMessageBytes() - 바이트 계산 (한글 2바이트, ASCII 1바이트)
 * 2. detectMessageType() - SMS/LMS 자동 감지
 * 3. validateKoreanMessage() - 한글 메시지 인코딩 검증
 * 4. 배치 발송 시 msg_type 분류
 */

import {
  calculateMessageBytes,
  detectMessageType,
  validateKoreanMessage,
  type EncodingValidationResult,
} from '../../../aligo';

describe('Aligo Encoding Validation & msg_type Detection', () => {
  describe('calculateMessageBytes()', () => {
    it('should calculate ASCII characters as 1 byte each', () => {
      const msg = 'Hello';
      expect(calculateMessageBytes(msg)).toBe(5);
    });

    it('should calculate Korean characters as 2 bytes each', () => {
      const msg = '안녕';
      expect(calculateMessageBytes(msg)).toBe(4);
    });

    it('should handle mixed Korean and ASCII', () => {
      // "Hello 안녕하세요" = 5 (Hello) + 1 (space) + 10 (안녕하세요 5자×2) = 16
      const msg = 'Hello 안녕하세요';
      expect(calculateMessageBytes(msg)).toBe(16);
    });

    it('should handle special characters correctly', () => {
      // "Hello, 세상!" = 5 + 1 + 1 + 1 (세) + 1 (상) + 1 (!) = 10
      // 실제: H(1) + e(1) + l(1) + l(1) + o(1) + ,(1) + space(1) + 세(2) + 상(2) + !(1) = 12
      const msg = 'Hello, 세상!';
      expect(calculateMessageBytes(msg)).toBe(12);
    });

    it('should handle Korean text with numbers', () => {
      // "상품2개 구매" = 상(2) + 품(2) + 2(1) + 개(2) + space(1) + 구(2) + 매(2) = 14
      const msg = '상품2개 구매';
      expect(calculateMessageBytes(msg)).toBe(14);
    });
  });

  describe('detectMessageType()', () => {
    it('should return SMS for messages <= 80 bytes', () => {
      const shortMsg = 'Hello';
      expect(detectMessageType(shortMsg)).toBe('SMS');
    });

    it('should return SMS for Korean text <= 80 bytes', () => {
      // 40자 한글 = 80바이트
      const msg = '안녕하세요환영합니다감사합니다축하합니다행운을빕니다사랑합니다기쁩니다';
      expect(calculateMessageBytes(msg)).toBe(80);
      expect(detectMessageType(msg)).toBe('SMS');
    });

    it('should return LMS for messages > 80 bytes', () => {
      // 41자 한글 = 82바이트
      const msg = '안녕하세요환영합니다감사합니다축하합니다행운을빕니다사랑합니다기쁩니다안';
      expect(calculateMessageBytes(msg)).toBe(82);
      expect(detectMessageType(msg)).toBe('LMS');
    });

    it('should return LMS for mixed content > 80 bytes', () => {
      const msg = 'Dear customer, 고객님께서는 특별한 이벤트에 당첨되었습니다! 클릭하여 상세 정보를 확인하세요.';
      const bytes = calculateMessageBytes(msg);
      expect(bytes).toBeGreaterThan(80);
      expect(detectMessageType(msg)).toBe('LMS');
    });

    it('should handle boundary case at exactly 80 bytes', () => {
      // 정확히 80바이트인 메시지는 SMS
      const msg = '안녕하세요환영합니다감사합니다축하합니다행운을빕니다사랑합니다기쁩니다';
      expect(calculateMessageBytes(msg)).toBe(80);
      expect(detectMessageType(msg)).toBe('SMS');
    });

    it('should handle boundary case at 81 bytes (LMS)', () => {
      // 81바이트는 LMS
      const msg = '안녕하세요환영합니다감사합니다축하합니다행운을빕니다사랑합니다기쁩니다가';
      expect(calculateMessageBytes(msg)).toBe(82);
      expect(detectMessageType(msg)).toBe('LMS');
    });
  });

  describe('validateKoreanMessage()', () => {
    it('should validate a simple valid SMS', () => {
      const msg = 'Hello World';
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.messageType).toBe('SMS');
      expect(result.bytes).toBe(11);
      expect(result.issues).toHaveLength(0);
    });

    it('should validate a simple valid Korean SMS', () => {
      const msg = '주문 확인 완료!';
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.messageType).toBe('SMS');
      expect(result.issues).toHaveLength(0);
    });

    it('should validate a valid LMS message', () => {
      const msg = '새로운 상품이 입고되었습니다. 지금 확인하고 구매하면 특별 할인을 받을 수 있습니다. 이 기회를 놓치지 마세요!';
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.messageType).toBe('LMS');
      expect(result.bytes).toBeGreaterThan(80);
      expect(result.issues).toHaveLength(0);
    });

    it('should warn for empty message', () => {
      const msg = '';
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('비어있');
    });

    it('should warn for whitespace-only message', () => {
      const msg = '   ';
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should warn for LMS exceeding 2000 bytes', () => {
      // 1001자 한글 = 2002바이트
      const msg = '가'.repeat(1001);
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(false);
      expect(result.messageType).toBe('LMS');
      expect(result.bytes).toBeGreaterThan(2000);
      expect(result.issues.some(i => i.includes('2000'))).toBe(true);
    });

    it('should return correct encoding format', () => {
      const msg = '테스트 메시지';
      const result = validateKoreanMessage(msg);
      expect(result.encoding).toBe('EUC-KR');
    });

    it('should handle Korean text with numbers and symbols', () => {
      const msg = '[공지] 상품 구매 시 2024년 10월 31일까지 20% 할인!';
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should categorize LMS boundary message correctly', () => {
      // 1000자 한글 = 2000바이트 (경계값)
      const msg = '가'.repeat(1000);
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(true);
      expect(result.messageType).toBe('LMS');
      expect(result.bytes).toBe(2000);
    });
  });

  describe('msg_type 자동 분기 시나리오', () => {
    it('should classify batch SMS correctly', () => {
      const messages = [
        '단문 메시지1', // SMS
        '단문 메시지2', // SMS
        '다양한 환영 메시지입니다. 오늘 특별 이벤트를 개최하고 있으며, 고객님께서 당첨되었습니다! 클릭하세요!', // LMS
      ];

      const types = messages.map(msg => ({
        msg,
        bytes: calculateMessageBytes(msg),
        type: detectMessageType(msg),
      }));

      // SMS 2개, LMS 1개
      const smsCount = types.filter(t => t.type === 'SMS').length;
      const lmsCount = types.filter(t => t.type === 'LMS').length;

      expect(smsCount).toBe(2);
      expect(lmsCount).toBe(1);
    });

    it('should handle promotional message classification', () => {
      const promotional = {
        short: '[이벤트] 지금 구매하세요!', // SMS (30바이트)
        long: '[이벤트] 지금 구매하시면 특별 할인을 받으실 수 있습니다! 이 기회는 오늘 자정까지만 유효합니다. 서두르세요!', // LMS (126바이트)
      };

      expect(detectMessageType(promotional.short)).toBe('SMS');
      expect(calculateMessageBytes(promotional.short)).toBeLessThanOrEqual(80);

      expect(detectMessageType(promotional.long)).toBe('LMS');
      expect(calculateMessageBytes(promotional.long)).toBeGreaterThan(80);
    });

    it('should classify urgent notification correctly', () => {
      const urgent = '[긴급] 귀사의 계정에 비정상 접속이 감지되었습니다. 즉시 비밀번호를 변경하시기 바랍니다. 도움말: 123-456-7890';
      const result = validateKoreanMessage(urgent);
      expect(result.messageType).toBe('LMS');
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle newlines in LMS', () => {
      const msg = '안녕하세요.\n감사합니다.';
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(true);
    });

    it('should handle tabs and special whitespace', () => {
      const msg = '상품\t가격\t수량\n123\t10000\t2';
      const result = validateKoreanMessage(msg);
      expect(result.valid).toBe(true);
    });

    it('should preserve original bytes calculation for special chars', () => {
      // 괄호, 이음표 등 특수문자
      const msg = '상품명: 크루즈 여행권 (5박 6일) - 최고의 경험!';
      const bytes = calculateMessageBytes(msg);
      const result = validateKoreanMessage(msg);
      expect(result.bytes).toBe(bytes);
    });
  });
});
