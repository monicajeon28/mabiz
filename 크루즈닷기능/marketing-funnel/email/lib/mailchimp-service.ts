/**
 * I-5: Mailchimp API 서비스
 * 뉴스레터 구독 및 발송을 위한 서비스
 *
 * 주의: .env.local에 다음 환경변수 필수:
 * - MAILCHIMP_API_KEY
 * - MAILCHIMP_AUDIENCE_ID (메인 뉴스레터 리스트)
 */

import { logger } from './logger';

interface MailchimpMember {
  email_address: string;
  status: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending';
  merge_fields?: Record<string, string>;
  interests?: Record<string, boolean>;
}

interface MailchimpResponse {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

/**
 * Mailchimp API 기본 요청 함수
 */
async function mailchimpRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, any>
): Promise<MailchimpResponse> {
  try {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

    if (!apiKey || !audienceId) {
      throw new Error('Mailchimp credentials not configured');
    }

    // Mailchimp API URL 생성 (API 키의 데이터센터 추출)
    const dc = apiKey.split('-')[1];
    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { detail?: string; title?: string };
      const errorMsg = errorData.detail || errorData.title || 'Mailchimp API error';
      logger.warn('Mailchimp API error', {
        context: 'mailchimpRequest',
        endpoint,
        method,
        status: response.status,
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }

    const data = (await response.json()) as Record<string, any>;
    return { success: true, data };
  } catch (error) {
    logger.error('Mailchimp request error', {
      context: 'mailchimpRequest',
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 뉴스레터 구독 추가 또는 업데이트
 */
export async function subscribeToNewsletter(
  email: string,
  categories: string[]
): Promise<MailchimpResponse> {
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!audienceId) {
    throw new Error('MAILCHIMP_AUDIENCE_ID not configured');
  }

  // 이메일을 Mailchimp 멤버 ID로 변환 (MD5 해시)
  const crypto = await import('crypto');
  const memberHash = crypto
    .createHash('md5')
    .update(email.toLowerCase())
    .digest('hex');

  // 관심사(interests) 맵핑
  // Mailchimp에서 실제 interest ID 설정 필요
  const interestMap: Record<string, string> = {
    '여행팁': 'interest_travel_tips',
    '할인정보': 'interest_discounts',
    '이벤트': 'interest_events',
  };

  const interests: Record<string, boolean> = {};
  categories.forEach(category => {
    if (interestMap[category]) {
      interests[interestMap[category]] = true;
    }
  });

  const body: MailchimpMember = {
    email_address: email,
    status: 'subscribed',
    interests,
  };

  return mailchimpRequest(
    `/lists/${audienceId}/members/${memberHash}`,
    'PUT',
    body
  );
}

/**
 * 뉴스레터 구독 해제
 */
export async function unsubscribeFromNewsletter(email: string): Promise<MailchimpResponse> {
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!audienceId) {
    throw new Error('MAILCHIMP_AUDIENCE_ID not configured');
  }

  const crypto = await import('crypto');
  const memberHash = crypto
    .createHash('md5')
    .update(email.toLowerCase())
    .digest('hex');

  return mailchimpRequest(
    `/lists/${audienceId}/members/${memberHash}`,
    'PUT',
    { status: 'unsubscribed' }
  );
}

/**
 * 뉴스레터 멤버 정보 조회
 */
export async function getNewsletterMember(email: string): Promise<MailchimpResponse> {
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!audienceId) {
    throw new Error('MAILCHIMP_AUDIENCE_ID not configured');
  }

  const crypto = await import('crypto');
  const memberHash = crypto
    .createHash('md5')
    .update(email.toLowerCase())
    .digest('hex');

  return mailchimpRequest(`/lists/${audienceId}/members/${memberHash}`);
}

/**
 * 캠페인 생성 및 발송
 * 주의: Mailchimp에서 실제 캠페인 구조에 맞게 조정 필요
 */
export async function sendNewsletterCampaign(
  subject: string,
  htmlContent: string,
  recipientSegment: 'all' | 'premium' | 'trial'
): Promise<MailchimpResponse> {
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!audienceId) {
    throw new Error('MAILCHIMP_AUDIENCE_ID not configured');
  }

  // 세그먼트 맵핑 (실제 Mailchimp 세그먼트 ID로 변경 필요)
  const segmentMap: Record<string, string> = {
    all: 'all',
    premium: 'segment_premium',
    trial: 'segment_trial',
  };

  const body = {
    type: 'regular',
    recipients: {
      list_id: audienceId,
      segment_opts:
        recipientSegment !== 'all'
          ? {
              saved_segment_id: segmentMap[recipientSegment],
            }
          : undefined,
    },
    settings: {
      subject_line: subject,
      preview_text: subject.substring(0, 50),
      title: `Newsletter - ${new Date().toISOString()}`,
      from_name: 'CruiseDot',
      reply_to: 'support@cruisedot.co.kr',
    },
    content: {
      html: htmlContent,
    },
  };

  return mailchimpRequest('/campaigns', 'POST', body);
}

/**
 * 구독자 통계 조회
 */
export async function getNewsletterStats(): Promise<MailchimpResponse> {
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!audienceId) {
    throw new Error('MAILCHIMP_AUDIENCE_ID not configured');
  }

  return mailchimpRequest(`/lists/${audienceId}`);
}

/**
 * 캠페인 통계 조회
 */
export async function getCampaignStats(campaignId: string): Promise<MailchimpResponse> {
  return mailchimpRequest(`/campaigns/${campaignId}/report`);
}
