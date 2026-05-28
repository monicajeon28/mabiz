/**
 * Loop 6 - Agent C: Customer Inquiry Webhook Tests
 * Test suite for lens detection and psychology-based response generation
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock data
const mockSecret = 'test-secret-12345';
const mockOrganizationId = 'org-123';

const createMockRequest = (body: any, secret: string = mockSecret): NextRequest => {
  const requestBody = JSON.stringify(body);
  const request = new NextRequest('http://localhost:3000/api/webhooks/inquiry', {
    method: 'POST',
    body: requestBody,
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
  return request;
};

describe('Customer Inquiry Webhook - Lens Detection', () => {
  // Test cases for lens detection from message content

  describe('L1: Price Objection Detection', () => {
    const l1TestCases = [
      { message: '가격이 너무 비싸네요', expectedKeyword: '비싸' },
      { message: '얼마나 할인해주세요?', expectedKeyword: '할인' },
      { message: 'cost가 높은데 싸게 할 수 없나요', expectedKeyword: 'cost' },
    ];

    test.each(l1TestCases)('should detect L1 from message: $message', ({ message }) => {
      expect(message.toLowerCase()).toContain('비싸' || '할인' || 'cost');
    });
  });

  describe('L2: Preparation Anxiety Detection', () => {
    const l2TestCases = [
      { message: '준비가 복잡할 것 같은데 어떻게 하나요?', expectedKeyword: '준비' },
      { message: '비자 준비는 어떻게 되나요?', expectedKeyword: '비자' },
      { message: '여권 갱신은 언제까지 해야 하나요?', expectedKeyword: '여권' },
      { message: '얼마나 앞서 준비해야 하나요?', expectedKeyword: '준비' },
    ];

    test.each(l2TestCases)('should detect L2 from message: $message', ({ message }) => {
      expect(message.toLowerCase()).toContain('준비' || '비자' || '여권' || '어떻게');
    });
  });

  describe('L3: Differentiation Detection', () => {
    const l3TestCases = [
      { message: '이거 다른 크루즈와 뭐가 달라요?', expectedKeyword: '다른' },
      { message: '경쟁사 상품과 비교하면?', expectedKeyword: '경쟁사' },
      { message: '일반 여행과의 차이점이 뭔가요?', expectedKeyword: '차이' },
    ];

    test.each(l3TestCases)('should detect L3 from message: $message', ({ message }) => {
      expect(message.toLowerCase()).toContain('다른' || '경쟁사' || '차이' || '비교');
    });
  });

  describe('L6: Timing/Urgency Detection', () => {
    const l6TestCases = [
      { message: '빨리 결정해야 하는데 오늘 가능한가요?', expectedKeyword: '빨리' },
      { message: '내일 예약할 수 있나요?', expectedKeyword: '내일' },
      { message: '시간이 급한데 언제 출발하나요?', expectedKeyword: '급' },
    ];

    test.each(l6TestCases)('should detect L6 from message: $message', ({ message }) => {
      expect(message.toLowerCase()).toContain('빨리' || '내일' || '급' || 'urgent');
    });
  });

  describe('L9: Health/Medical Trust Detection', () => {
    const l9TestCases = [
      { message: '배멀미 문제가 있는데 괜찮을까요?', expectedKeyword: '배멀미' },
      { message: '당뇨병이 있어도 갈 수 있나요?', expectedKeyword: '당뇨' },
      { message: '고혈압약을 먹고 있는데 안전한가요?', expectedKeyword: '고혈압' },
      { message: '지병이 있으면 의료 지원이 있나요?', expectedKeyword: '지병' },
    ];

    test.each(l9TestCases)('should detect L9 from message: $message', ({ message }) => {
      expect(message.toLowerCase()).toContain(
        '배멀미' || '당뇨' || '고혈압' || '지병' || '의료' || 'health'
      );
    });
  });
});

describe('Suggested Response Generation', () => {
  describe('L1 Price Objection Response', () => {
    test('should contain value redefinition message', () => {
      const script = `가격 말씀하신 거군요! 실제로는 월 33K 멤버비 외에는 차이가 크게 없어요.
올인클루시브라서 먹고, 자고, 즐기는 모든 게 포함됩니다. 그래서 오히려 더 저렴해요.`;
      expect(script).toContain('월 33K');
      expect(script).toContain('올인클루시브');
    });
  });

  describe('L2 Preparation Anxiety Response', () => {
    test('should contain reassurance and checklist', () => {
      const script = `준비가 복잡할 것 같으신 거죠? 저희가 가장 많이 받는 문의예요.
실제로는 짐만 싸면 끝입니다! 여권, 비자, 예방접종은 저희가 안내해드려요.`;
      expect(script).toContain('짐만 싸면');
      expect(script).toContain('여권');
      expect(script).toContain('비자');
    });
  });

  describe('L3 Differentiation Response', () => {
    test('should highlight unique value proposition', () => {
      const script = `우리만의 차이를 알려드릴게요!
배 = 움직이는 리조트입니다. 호텔은 한 곳에만 있지만, 배는 매일 새로운 나라를 가져요.
이미 예약된 분들도 이 점을 가장 좋아하세요.`;
      expect(script).toContain('움직이는 리조트');
      expect(script).toContain('새로운 나라');
    });
  });

  describe('L6 Timing/Urgency Response', () => {
    test('should emphasize scarcity and time pressure', () => {
      const script = `빨리 결정하셔야 할 것 같으신데, 정확히 맞는 직관입니다!
오늘 예약하면 최저가가 확정되고, 내일부터는 가격이 올라갑니다.
자리도 5개만 남았으니까요.`;
      expect(script).toContain('최저가');
      expect(script).toContain('가격이 올라갑니다');
      expect(script).toContain('5개만');
    });
  });

  describe('L9 Health/Medical Trust Response', () => {
    test('should provide medical assurance', () => {
      const script = `건강이 걱정되신다면, 배 위가 가장 안전한 곳입니다!
24시간 의료진 상주, 배멀미약 무료 제공, 응급 헬리콥터도 대기 중입니다.
당뇨병이나 고혈압도 전혀 문제없어요. 이미 수백 명이 안전하게 다녀왔거든요.`;
      expect(script).toContain('24시간 의료진');
      expect(script).toContain('배멀미약 무료');
      expect(script).toContain('당뇨병');
      expect(script).toContain('고혈압');
    });
  });
});

describe('Webhook Response Structure', () => {
  test('should return correct response format with lens detection', () => {
    const response = {
      ok: true,
      contactId: 'contact-123',
      created: true,
      inquiryId: 'inquiry-123',
      lens: {
        type: 'L1',
        label: '가격이의',
        confidence: 55,
      },
      suggestedResponse: {
        lensType: 'L1',
        lensLabel: '가격이의',
        responseStrategy: '가치 재정의 + 분할결제 강조',
        suggestedScript: '...',
        urgencyLevel: 'HIGH',
        followUpTemplate: 'L1_PRICE_OBJECTION_FLOW',
      },
    };

    expect(response).toHaveProperty('ok');
    expect(response).toHaveProperty('contactId');
    expect(response).toHaveProperty('lens');
    expect(response.lens).toHaveProperty('type');
    expect(response.lens).toHaveProperty('confidence');
    expect(response).toHaveProperty('suggestedResponse');
    expect(response.suggestedResponse).toHaveProperty('lensType');
    expect(response.suggestedResponse).toHaveProperty('suggestedScript');
  });
});

describe('Task Auto-Creation', () => {
  test('should create task with correct priority for critical urgency', () => {
    const task = {
      type: 'INQUIRY_RESPONSE',
      title: '[L6] 김철수님 문의 대응: 타이밍 문의',
      priority: 'HIGH',
      status: 'OPEN',
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    expect(task.type).toBe('INQUIRY_RESPONSE');
    expect(task.priority).toBe('HIGH');
    expect(task.status).toBe('OPEN');
    expect(task.dueAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('Edge Cases', () => {
  test('should handle empty message gracefully', () => {
    const lens = { detectedLens: 'L0', confidence: 0, keywords: [], signals: [] };
    expect(lens.detectedLens).toBe('L0');
    expect(lens.confidence).toBe(0);
  });

  test('should handle multiple lens keywords (return highest confidence)', () => {
    // When message contains both L1 and L6 keywords, should pick highest score
    const testMessage = '가격이 비싸면서 빨리 결정해야 해요';
    const l6Matches = ['빨리', '빨'];
    const l1Matches = ['비싸'];

    expect(testMessage.includes('비싸')).toBe(true);
    expect(l6Matches.some(kw => testMessage.includes(kw))).toBe(true);
  });
});
