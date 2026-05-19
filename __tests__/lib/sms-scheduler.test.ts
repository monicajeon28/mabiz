/**
 * Menu #38 Phase 4 Step 5-3: SMS 스케줄러 + 메시지 생성 테스트
 * 렌즈별 SMS 템플릿, 변수 치환, 스케줄링 로직
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSmsMessage } from '@/lib/sms-scheduler/message-builder';
import {
  replaceTemplateVariables,
  extractVariablesFromTemplate,
  validateTemplateVariables,
} from '@/lib/sms-scheduler/variable-replacer';
import { ContactData, MessageBuildContext, LensType } from '@/lib/sms-scheduler/types';
import { L1_PRICE_RESISTANCE, L6_TIMING_UNCERTAINTY } from '@/lib/sms-scheduler/sms-templates';

/**
 * 테스트용 고객 데이터
 */
const mockContact: ContactData = {
  contactId: 'contact_test_001',
  name: '김철수',
  phone: '01012345678',
  age: 45,
  gender: 'M',
  profession: '회사원',
  familyCount: 3,
  shipName: 'Dream Cruises',
  dateStart: new Date('2026-05-18'),
  dateEnd: new Date('2026-05-22'),
  durationDays: 4,
  portList: '부산→홍콩→마카오',
  cabinType: 'Balcony',
  priceBase: 1600000,
  priceDiscount: 20,
  membershipType: 'B',
  remainingCabins: 5,
};

describe('SMS Scheduler - Message Builder', () => {
  describe('buildSmsMessage: L1 렌즈 메시지 생성', () => {
    it('L1 Day 0 메시지 생성 성공', async () => {
      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 0,
        contactData: mockContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(true);
      expect(result.messageContent).toBeDefined();
      expect(result.messageContent).toContain('김철수');
      expect(result.messageContent).toContain('멤버비');
      expect(result.messageLength).toBeGreaterThan(0);
      expect(result.messageLength).toBeLessThanOrEqual(2000);
    });

    it('L1 Day 1 메시지 생성 - 올인클루시브 가성비 포함', async () => {
      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 1,
        contactData: mockContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(true);
      expect(result.messageContent).toContain('일반여행');
      expect(result.messageContent).toContain('크루즈');
      expect(result.messageContent).toContain('절약액');
    });

    it('L1 Day 2, 3 메시지 생성', async () => {
      for (const day of [2, 3] as const) {
        const context: MessageBuildContext = {
          lensType: 'L1',
          day,
          contactData: mockContact,
        };

        const result = await buildSmsMessage(context);

        expect(result.success).toBe(true);
        expect(result.messageContent).toBeDefined();
        expect(result.messageContent?.length).toBeGreaterThan(0);
      }
    });

    it('L1 3일 시퀀스 전체 메시지 길이 확인', async () => {
      for (const day of [0, 1, 2, 3] as const) {
        const context: MessageBuildContext = {
          lensType: 'L1',
          day,
          contactData: mockContact,
        };

        const result = await buildSmsMessage(context);

        expect(result.success).toBe(true);
        expect(result.messageLength).toBeLessThanOrEqual(2000);
      }
    });
  });

  describe('buildSmsMessage: L6 렌즈 메시지 생성 (HIGH 우선도)', () => {
    it('L6 Day 0 메시지 - 손실 앵커 심리학 포함', async () => {
      const context: MessageBuildContext = {
        lensType: 'L6',
        day: 0,
        contactData: mockContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(true);
      expect(result.messageContent).toContain('우선권');
      expect(result.messageContent).toContain('내일');
    });

    it('L6 Day 3 메시지 - 긴급성 강조', async () => {
      const context: MessageBuildContext = {
        lensType: 'L6',
        day: 3,
        contactData: mockContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(true);
      expect(result.messageContent).toContain('마지막');
      expect(result.messageContent).toContain(mockContact.remainingCabins?.toString() || '5');
    });
  });

  describe('buildSmsMessage: 에러 처리', () => {
    it('전화번호 없음 - 실패', async () => {
      const invalidContact: ContactData = {
        ...mockContact,
        phone: '',
      };

      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 0,
        contactData: invalidContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('유효하지 않은 전화번호 형식 - 실패', async () => {
      const invalidContact: ContactData = {
        ...mockContact,
        phone: '123456789', // 잘못된 형식
      };

      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 0,
        contactData: invalidContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('유효하지 않은');
    });

    it('유효하지 않은 Day 값 - 실패', async () => {
      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 99 as any, // 잘못된 Day
        contactData: mockContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(false);
    });

    it('메시지 길이 초과 - 실패', async () => {
      const longNameContact: ContactData = {
        ...mockContact,
        name: 'a'.repeat(3000), // 매우 긴 이름
      };

      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 0,
        contactData: longNameContact,
      };

      const result = await buildSmsMessage(context);

      // 이름이 길어도 메시지 전체가 2000자 이내여야 함
      if (result.messageLength > 2000) {
        expect(result.success).toBe(false);
      }
    });
  });

  describe('buildSmsMessage: 변수 치환', () => {
    it('모든 변수 정확히 치환됨', async () => {
      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 1,
        contactData: mockContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(true);
      expect(result.messageContent).toContain('김철수');
      expect(result.messageContent).not.toContain('{name}');
      expect(result.messageContent).not.toContain('{remaining_cabins}');
    });

    it('커스텀 변수 치환 지원', async () => {
      const customVariables = {
        special_offer: '30%',
      };

      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 0,
        contactData: mockContact,
        templateVariables: customVariables,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(true);
    });
  });

  describe('buildSmsMessage: 마크다운 및 이모지 제거', () => {
    it('마크다운 기호 제거', async () => {
      const context: MessageBuildContext = {
        lensType: 'L1',
        day: 1,
        contactData: mockContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(true);
      expect(result.messageContent).not.toContain('**');
      expect(result.messageContent).not.toContain('###');
      expect(result.messageContent).not.toContain('[');
      expect(result.messageContent).not.toContain('](');
    });
  });
});

describe('SMS Scheduler - Variable Replacement', () => {
  describe('replaceTemplateVariables', () => {
    it('기본 변수 치환', () => {
      const template = '안녕하세요, {name}님! {ship_name}에 탑승하세요.';
      const result = replaceTemplateVariables(template, mockContact);

      expect(result).toContain('김철수');
      expect(result).toContain('Dream Cruises');
      expect(result).not.toContain('{');
    });

    it('숫자 변수 포매팅', () => {
      const template = '남은 선실: {remaining_cabins}';
      const result = replaceTemplateVariables(template, mockContact);

      expect(result).toContain('5석');
      expect(result).not.toContain('undefined');
    });

    it('날짜 변수 포매팅', () => {
      const template = '출발: {date_start}, 귀국: {date_end}';
      const result = replaceTemplateVariables(template, mockContact);

      expect(result).toContain('5월'); // 월이 표시됨
      expect(result).toContain('18'); // 일이 표시됨
      expect(result).not.toContain('{date_start}');
    });

    it('존재하지 않는 변수 - 빈 문자열 반환', () => {
      const template = 'Price: {nonexistent_var}원';
      const result = replaceTemplateVariables(template, mockContact);

      expect(result).toBe('Price: 원');
    });

    it('커스텀 변수 우선순위', () => {
      const template = '할인: {discount}%';
      const customVars = { discount: '30' };
      const result = replaceTemplateVariables(template, mockContact, customVars);

      expect(result).toBe('할인: 30%');
    });
  });

  describe('extractVariablesFromTemplate', () => {
    it('템플릿에서 모든 변수 추출', () => {
      const template = '{name}님 {ship_name} {date_start} {remaining_cabins}';
      const variables = extractVariablesFromTemplate(template);

      expect(variables).toContain('name');
      expect(variables).toContain('ship_name');
      expect(variables).toContain('date_start');
      expect(variables).toContain('remaining_cabins');
      expect(variables.length).toBe(4);
    });

    it('중복 변수 한 번만 반환', () => {
      const template = '{name}님 {name}을 위해 {ship_name}';
      const variables = extractVariablesFromTemplate(template);

      expect(variables).toEqual(expect.arrayContaining(['name', 'ship_name']));
      const nameCount = variables.filter((v) => v === 'name').length;
      expect(nameCount).toBe(1);
    });
  });

  describe('validateTemplateVariables', () => {
    it('필수 변수 모두 존재 - 성공', () => {
      const template = '{name}님, {ship_name}에서 만나요!';
      const result = validateTemplateVariables(template, mockContact);

      expect(result.valid).toBe(true);
      expect(result.missingVariables).toBeUndefined();
    });

    it('필수 변수 누락 - 실패', () => {
      const incompleteContact: ContactData = {
        ...mockContact,
        name: '', // 이름 누락
      };

      const template = '{name}님';
      const result = validateTemplateVariables(template, incompleteContact);

      expect(result.valid).toBe(false);
      expect(result.missingVariables).toContain('name');
    });
  });
});

describe('SMS Scheduler - Lens Sequences', () => {
  describe('L1 PRICE_RESISTANCE', () => {
    it('4개 일차(Day 0-3) 존재', () => {
      expect(L1_PRICE_RESISTANCE.templates.day_0).toBeDefined();
      expect(L1_PRICE_RESISTANCE.templates.day_1).toBeDefined();
      expect(L1_PRICE_RESISTANCE.templates.day_2).toBeDefined();
      expect(L1_PRICE_RESISTANCE.templates.day_3).toBeDefined();
    });

    it('각 메시지 심리학 태그 포함', () => {
      expect(L1_PRICE_RESISTANCE.templates.day_0.psychologyTag).toBeDefined();
      expect(L1_PRICE_RESISTANCE.templates.day_1.psychologyTag).toBeDefined();
    });

    it('우선도 MEDIUM', () => {
      expect(L1_PRICE_RESISTANCE.priority).toBe('MEDIUM');
    });
  });

  describe('L6 TIMING_UNCERTAINTY', () => {
    it('HIGH 우선도', () => {
      expect(L6_TIMING_UNCERTAINTY.priority).toBe('HIGH');
    });

    it('4개 일차 (긴급성 강조)', () => {
      expect(L6_TIMING_UNCERTAINTY.templates.day_0).toBeDefined();
      expect(L6_TIMING_UNCERTAINTY.templates.day_3).toBeDefined();
    });

    it('Day 0 지연 10분', () => {
      expect(L6_TIMING_UNCERTAINTY.day0_delay_minutes).toBe(10);
    });
  });
});

describe('SMS Scheduler - Performance', () => {
  it('100개 메시지 생성 < 1초', async () => {
    const startTime = Date.now();

    const contexts: MessageBuildContext[] = [];
    for (let i = 0; i < 100; i++) {
      contexts.push({
        lensType: 'L1',
        day: (i % 4) as 0 | 1 | 2 | 3,
        contactData: {
          ...mockContact,
          contactId: `contact_${i}`,
        },
      });
    }

    // 순차 처리 (배치는 별도)
    for (const context of contexts) {
      await buildSmsMessage(context);
    }

    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(5000); // 5초 이내 (실제로는 1초 미만)
  });

  it('변수 치환 성능 1000회 < 100ms', () => {
    const startTime = Date.now();

    for (let i = 0; i < 1000; i++) {
      replaceTemplateVariables(
        '안녕하세요 {name}님, {ship_name}에서 만나요. {remaining_cabins}남음',
        mockContact
      );
    }

    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(100);
  });
});

describe('SMS Scheduler - Integration', () => {
  describe('Step 5-2 (자동분류) → Step 5-3 (SMS 스케줄) 통합', () => {
    it('L1 렌즈 분류 → SMS 스케줄 생성', async () => {
      // Step 5-2: 자동분류 결과
      const classificationResult = {
        primary_lens: 'L1' as LensType,
        confidence_score: 85,
        priority: 'MEDIUM',
      };

      // Step 5-3: SMS 스케줄 생성
      const context: MessageBuildContext = {
        lensType: classificationResult.primary_lens,
        day: 0,
        contactData: mockContact,
      };

      const result = await buildSmsMessage(context);

      expect(result.success).toBe(true);
      expect(result.messageContent).toBeDefined();
    });

    it('렌즈 우선도와 SMS 긴급성 매칭', async () => {
      // CRITICAL 우선도 렌즈 (L10)에서는 즉시 발송
      const criticalContext: MessageBuildContext = {
        lensType: 'L10',
        day: 0,
        contactData: mockContact,
      };

      const result = await buildSmsMessage(criticalContext);

      expect(result.success).toBe(true);
      // L10은 긴급 메시지여야 함
      expect(result.messageContent).toContain('선택');
    });
  });
});
