import { validateTraveler, validateAllTravelers, validateTravelerCount } from '@/lib/pnr-validators';
import type { Traveler } from '@/src/lib/types/pnr';

describe('PNR Validators', () => {
  describe('validateTraveler - 필드 검증', () => {
    it('should return error for missing korName (대표자)', () => {
      const traveler: Traveler = {
        korName: '',
        residentNum: '000000-0000000',
        phone: '010-1234-5678',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 0);
      expect(error).toBeDefined();
      expect(error?.field).toBe('korName');
      expect(error?.message).toContain('대표자');
      expect(error?.message).toContain('이름');
    });

    it('should return error for empty korName with whitespace', () => {
      const traveler: Traveler = {
        korName: '   ',
        residentNum: '000000-0000000',
        phone: '010-1234-5678',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 0);
      expect(error).toBeDefined();
      expect(error?.message).toContain('대표자');
    });

    it('should return error for missing residentNum (대표자)', () => {
      const traveler: Traveler = {
        korName: '홍길동',
        residentNum: '',
        phone: '010-1234-5678',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 0);
      expect(error).toBeDefined();
      expect(error?.field).toBe('residentNum');
      expect(error?.message).toContain('주민등록번호');
    });

    it('should return error for invalid residentNum format (too short)', () => {
      const traveler: Traveler = {
        korName: '홍길동',
        residentNum: '000000-00',
        phone: '010-1234-5678',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 0);
      expect(error).toBeDefined();
      expect(error?.field).toBe('residentNum');
      expect(error?.message).toContain('형식');
    });

    it('should return error for missing phone number', () => {
      const traveler: Traveler = {
        korName: '홍길동',
        residentNum: '000000-0000000',
        phone: '',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 0);
      expect(error).toBeDefined();
      expect(error?.field).toBe('phone');
      expect(error?.message).toContain('연락처');
    });

    it('should accept valid primary traveler (대표자)', () => {
      const traveler: Traveler = {
        korName: '홍길동',
        residentNum: '000000-0000000',
        phone: '010-1234-5678',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 0);
      expect(error).toBeNull();
    });

    it('should accept valid companion traveler without residentNum and phone (동행자)', () => {
      const traveler: Traveler = {
        korName: '김영희',
        residentNum: null as any,
        phone: null as any,
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 1); // index 1 = 동행자
      expect(error).toBeNull();
    });

    it('should accept companion traveler with all fields filled', () => {
      const traveler: Traveler = {
        korName: '김영희',
        residentNum: '900101-0000000',
        phone: '010-9999-9999',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 1);
      expect(error).toBeNull();
    });

    it('should label companion travelers correctly in error messages', () => {
      const traveler: Traveler = {
        korName: '',
        residentNum: '',
        phone: '',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 2); // 동행자 2
      expect(error?.message).toContain('동행자 2');
    });

    it('should accept valid residentNum with format XXXXXX-XXXXXXX', () => {
      const traveler: Traveler = {
        korName: '홍길동',
        residentNum: '900101-1234567',
        phone: '010-1234-5678',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 0);
      expect(error).toBeNull();
    });

    it('should accept residentNum without dash (13 digits)', () => {
      const traveler: Traveler = {
        korName: '홍길동',
        residentNum: '9001011234567',
        phone: '010-1234-5678',
        roomNumber: 1,
      };
      const error = validateTraveler(traveler, 0);
      expect(error).toBeNull();
    });
  });

  describe('validateAllTravelers - 전체 검증', () => {
    it('should validate single primary traveler', () => {
      const travelers: Traveler[] = [
        {
          korName: '홍길동',
          residentNum: '000000-0000000',
          phone: '010-1234-5678',
          roomNumber: 1,
        },
      ];
      const error = validateAllTravelers(travelers);
      expect(error).toBeNull();
    });

    it('should validate multiple travelers correctly', () => {
      const travelers: Traveler[] = [
        {
          korName: '홍길동',
          residentNum: '000000-0000000',
          phone: '010-1234-5678',
          roomNumber: 1,
        },
        {
          korName: '김영희',
          residentNum: null as any,
          phone: null as any,
          roomNumber: 1,
        },
        {
          korName: '이순신',
          residentNum: null as any,
          phone: null as any,
          roomNumber: 2,
        },
      ];
      const error = validateAllTravelers(travelers);
      expect(error).toBeNull();
    });

    it('should detect invalid traveler in array at index 0', () => {
      const travelers: Traveler[] = [
        {
          korName: '',
          residentNum: '000000-0000000',
          phone: '010-1234-5678',
          roomNumber: 1,
        },
      ];
      const error = validateAllTravelers(travelers);
      expect(error).toBeDefined();
      expect(error?.message).toContain('대표자');
    });

    it('should detect invalid traveler in middle of array', () => {
      const travelers: Traveler[] = [
        {
          korName: '홍길동',
          residentNum: '000000-0000000',
          phone: '010-1234-5678',
          roomNumber: 1,
        },
        {
          korName: '',
          residentNum: null as any,
          phone: null as any,
          roomNumber: 1,
        },
      ];
      const error = validateAllTravelers(travelers);
      expect(error).toBeDefined();
      expect(error?.message).toContain('동행자 1');
    });

    it('should return first error only', () => {
      const travelers: Traveler[] = [
        {
          korName: '',
          residentNum: '',
          phone: '',
          roomNumber: 1,
        },
        {
          korName: '김영희',
          residentNum: null as any,
          phone: null as any,
          roomNumber: 1,
        },
      ];
      const error = validateAllTravelers(travelers);
      expect(error).toBeDefined();
      expect(error?.field).toBe('korName');
    });
  });

  describe('validateTravelerCount - 인원 검증', () => {
    it('should reject empty array', () => {
      const travelers: Traveler[] = [];
      const error = validateTravelerCount(travelers);
      expect(error).toBeDefined();
      expect(error?.message).toContain('최소 1명');
    });

    it('should accept 1 traveler', () => {
      const travelers: Traveler[] = [
        {
          korName: '홍길동',
          residentNum: '000000-0000000',
          phone: '010-1234-5678',
          roomNumber: 1,
        },
      ];
      const error = validateTravelerCount(travelers);
      expect(error).toBeNull();
    });

    it('should accept 10 travelers', () => {
      const travelers: Traveler[] = Array(10).fill({
        korName: '홍길동',
        residentNum: '000000-0000000',
        phone: '010-1234-5678',
        roomNumber: 1,
      });
      const error = validateTravelerCount(travelers);
      expect(error).toBeNull();
    });

    it('should accept 20 travelers (maximum)', () => {
      const travelers: Traveler[] = Array(20).fill({
        korName: '홍길동',
        residentNum: '000000-0000000',
        phone: '010-1234-5678',
        roomNumber: 1,
      });
      const error = validateTravelerCount(travelers);
      expect(error).toBeNull();
    });

    it('should reject 21 travelers (exceeds maximum)', () => {
      const travelers: Traveler[] = Array(21).fill({
        korName: '홍길동',
        residentNum: '000000-0000000',
        phone: '010-1234-5678',
        roomNumber: 1,
      });
      const error = validateTravelerCount(travelers);
      expect(error).toBeDefined();
      expect(error?.message).toContain('최대 20명');
    });

    it('should reject null array', () => {
      const travelers = null as any;
      const error = validateTravelerCount(travelers);
      expect(error).toBeDefined();
    });
  });

  describe('Integration: Multiple validation rules', () => {
    it('should validate entire flow for form submission', () => {
      // 시나리오: 3명의 여행자, 2개 방
      const travelers: Traveler[] = [
        {
          korName: '홍길동',
          residentNum: '900101-1234567',
          phone: '010-1111-1111',
          roomNumber: 1,
        },
        {
          korName: '홍순신',
          residentNum: null as any,
          phone: null as any,
          roomNumber: 1,
        },
        {
          korName: '이순신',
          residentNum: null as any,
          phone: null as any,
          roomNumber: 2,
        },
      ];

      // 1. 인원 수 검증
      const countError = validateTravelerCount(travelers);
      expect(countError).toBeNull();

      // 2. 전체 필드 검증
      const validationError = validateAllTravelers(travelers);
      expect(validationError).toBeNull();

      // 3. 개별 검증
      travelers.forEach((traveler, index) => {
        const error = validateTraveler(traveler, index);
        expect(error).toBeNull();
      });
    });

    it('should handle edge case: 1 person with same name repeated', () => {
      const travelers: Traveler[] = [
        {
          korName: '김길동',
          residentNum: '000000-0000000',
          phone: '010-1234-5678',
          roomNumber: 1,
        },
      ];

      const countError = validateTravelerCount(travelers);
      expect(countError).toBeNull();

      const validationError = validateAllTravelers(travelers);
      expect(validationError).toBeNull();
    });
  });
});
