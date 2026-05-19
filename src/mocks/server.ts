import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

/**
 * MSW (Mock Service Worker) 서버 셋업
 *
 * Delta SMS 마법사 테스트를 위한 API 모킹
 * - GET /api/campaigns/[id]/delta: 기존 설정 조회
 * - POST /api/campaigns/delta: 새 설정 저장
 * - GET /api/campaigns/[id]/delta/stats: 예상 발송 건수 통계
 */

export const server = setupServer(
  // GET /api/campaigns/:campaignId/delta
  // 기존 캠페인 Delta 설정 조회
  http.get('/api/campaigns/:campaignId/delta', ({ params }) => {
    const { campaignId } = params as { campaignId: string };

    // 특정 캠페인 ID에 대한 모의 응답
    if (campaignId === 'campaign_not_found') {
      return HttpResponse.json(
        {
          ok: false,
          error: 'NOT_FOUND',
          message: '캠페인을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      ok: true,
      campaignId,
      triggerType: 'PURCHASE',
      schedule: [
        {
          day: 0,
          message: 'Day 0 기본 메시지: 안녕하세요! 예약을 감사합니다.',
          sentCount: 2400,
          openRate: 45,
        },
        {
          day: 1,
          message: 'Day 1 기본 메시지: 여행 준비가 잘 진행되고 있나요?',
          sentCount: 1800,
          openRate: 38,
        },
        {
          day: 2,
          message: 'Day 2 기본 메시지: 특별 할인 혜택을 놓치지 마세요!',
          sentCount: 1200,
          openRate: 32,
        },
        {
          day: 3,
          message: 'Day 3 기본 메시지: 마지막 기회! 지금 확인하세요.',
          sentCount: 1200,
          openRate: 28,
        },
      ],
      organizationId: 'org_test_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  // POST /api/campaigns/delta
  // 새로운 Delta 설정 저장
  http.post('/api/campaigns/delta', async ({ request }) => {
    let body: any;

    try {
      body = await request.json();
    } catch {
      return HttpResponse.json(
        {
          ok: false,
          error: 'INVALID_JSON',
          message: '요청 본문이 유효한 JSON이 아닙니다.',
        },
        { status: 400 }
      );
    }

    // 요청 유효성 검증
    const { campaignId, messages, triggerType } = body;

    if (!campaignId) {
      return HttpResponse.json(
        {
          ok: false,
          error: 'MISSING_FIELD',
          message: 'campaignId는 필수입니다.',
          errors: { campaignId: 'required' },
        },
        { status: 400 }
      );
    }

    if (!messages || typeof messages !== 'object') {
      return HttpResponse.json(
        {
          ok: false,
          error: 'INVALID_MESSAGES',
          message: 'messages는 필수이며 객체여야 합니다.',
          errors: { messages: 'required' },
        },
        { status: 400 }
      );
    }

    // 메시지 길이 검증
    const MESSAGE_LIMITS = {
      day0: 90,
      day1: 160,
      day2: 160,
      day3: 160,
    };

    const errors: Record<string, string> = {};

    if (!messages.day0?.trim()) {
      errors.deltaDay0Message = 'Day 0 메시지는 필수입니다.';
    } else if (messages.day0.length > MESSAGE_LIMITS.day0) {
      errors.deltaDay0Message = `Day 0 메시지는 ${MESSAGE_LIMITS.day0}자 이하여야 합니다. (현재: ${messages.day0.length}자)`;
    }

    if (!messages.day1?.trim()) {
      errors.deltaDay1Message = 'Day 1 메시지는 필수입니다.';
    } else if (messages.day1.length > MESSAGE_LIMITS.day1) {
      errors.deltaDay1Message = `Day 1 메시지는 ${MESSAGE_LIMITS.day1}자 이하여야 합니다. (현재: ${messages.day1.length}자)`;
    }

    if (!messages.day2?.trim()) {
      errors.deltaDay2Message = 'Day 2 메시지는 필수입니다.';
    } else if (messages.day2.length > MESSAGE_LIMITS.day2) {
      errors.deltaDay2Message = `Day 2 메시지는 ${MESSAGE_LIMITS.day2}자 이하여야 합니다. (현재: ${messages.day2.length}자)`;
    }

    if (!messages.day3?.trim()) {
      errors.deltaDay3Message = 'Day 3 메시지는 필수입니다.';
    } else if (messages.day3.length > MESSAGE_LIMITS.day3) {
      errors.deltaDay3Message = `Day 3 메시지는 ${MESSAGE_LIMITS.day3}자 이하여야 합니다. (현재: ${messages.day3.length}자)`;
    }

    if (Object.keys(errors).length > 0) {
      return HttpResponse.json(
        {
          ok: false,
          error: 'VALIDATION_ERROR',
          message: '메시지 검증 실패',
          errors,
        },
        { status: 400 }
      );
    }

    // 저장 성공 응답
    return HttpResponse.json({
      ok: true,
      message: '설정이 저장되었습니다.',
      deltaCampaignConfigId: `config_${Date.now()}`,
      campaignId,
      triggerType: triggerType || 'PURCHASE',
      schedule: [
        { day: 0, message: messages.day0 },
        { day: 1, message: messages.day1 },
        { day: 2, message: messages.day2 },
        { day: 3, message: messages.day3 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  // GET /api/campaigns/:campaignId/delta/stats
  // 예상 발송 건수 및 통계 조회
  http.get('/api/campaigns/:campaignId/delta/stats', ({ params }) => {
    const { campaignId } = params as { campaignId: string };

    if (campaignId === 'campaign_not_found') {
      return HttpResponse.json(
        {
          ok: false,
          error: 'NOT_FOUND',
          message: '캠페인을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      estimatesByHour: {
        9: 2400,
        14: 1800,
        19: 1200,
      },
      totalEstimate: 5400,
      variance: '±25% (지난 7일 평균)',
      lastUpdatedAt: new Date().toISOString(),
    });
  })
);
