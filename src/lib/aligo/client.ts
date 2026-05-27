/**
 * Aligo API v2 클라이언트
 * - 실제 SMS 발송 (배치 지원)
 * - 배송 상태 추적
 * - 오류 처리 및 재시도 로직
 *
 * @see https://aligo.in/api/send/
 * @see https://aligo.in/api/info/
 */

import { logger } from '@/lib/logger';

export interface AligoConfig {
  apiKey: string;
  userId: string;
  senderPhone: string;
}

export interface AligoSendRequest {
  receiver: string; // 수신 번호 (01012345678 형식)
  message: string;
  title?: string; // LMS 제목
  messageType?: 'SMS' | 'LMS'; // 기본값 SMS
  scheduledTime?: string; // 예약발송 (YYYY-MM-DD HH:MM 형식)
}

export interface AligoSendResponse {
  resultCode: number; // 1: 성공, 음수: 실패
  message: string;
  msgId?: string; // 메시지 ID (성공 시)
  failCount?: number;
}

export interface AligoDeliveryStatusRequest {
  msgId: string; // Aligo 메시지 ID
  receiver?: string;
}

export interface AligoDeliveryStatus {
  msgId: string;
  receiver: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  sentAt?: Date;
  deliveredAt?: Date;
  failureCode?: string;
  failureReason?: string;
}

/**
 * Aligo API 호출 기본 설정
 */
const ALIGO_API_BASE = 'https://apis.aligo.in';
const ALIGO_TIMEOUT = 8000; // 8초 (Vercel 10초 제한 대비)
const MAX_BATCH_SIZE = 1000; // 배치당 최대 건수

/**
 * Aligo API 응답 코드 분류
 */
const RETRYABLE_CODES = new Set([
  -1, // 일시적 오류
  10,  // 타임아웃
  11,  // 서버 오류
  12,  // 과부하
]);

const NON_RETRYABLE_CODES = new Set([
  -99, // 인증 실패
  -98, // 야간 발송 차단
  -97, // 수신 거부
  1,   // 성공 (재시도 불필요)
]);

/**
 * Aligo SMS 클라이언트
 */
export class AligoClient {
  private config: AligoConfig;

  constructor(config: AligoConfig) {
    this.config = config;
    this.validateConfig();
  }

  private validateConfig() {
    if (!this.config.apiKey || !this.config.userId || !this.config.senderPhone) {
      throw new Error('Aligo 설정 불완전: apiKey, userId, senderPhone 필수');
    }
  }

  /**
   * 단일 SMS 발송
   */
  async sendSms(request: AligoSendRequest): Promise<AligoSendResponse> {
    return this.sendWithRetry({
      ...request,
      messageType: request.messageType || 'SMS',
    });
  }

  /**
   * 배치 SMS 발송 (최대 1000건/요청)
   * 대량 발송이 필요한 경우 이 함수를 사용
   */
  async sendSmsBatch(requests: AligoSendRequest[]): Promise<AligoSendResponse> {
    if (requests.length === 0) {
      return { resultCode: 0, message: '빈 배치' };
    }

    if (requests.length > MAX_BATCH_SIZE) {
      logger.warn(`[Aligo] 배치 크기 초과: ${requests.length} > ${MAX_BATCH_SIZE}`);
    }

    // 배치는 1000건씩 분할
    const batches = [];
    for (let i = 0; i < requests.length; i += MAX_BATCH_SIZE) {
      batches.push(requests.slice(i, i + MAX_BATCH_SIZE));
    }

    const results = await Promise.all(
      batches.map(batch => this.sendBatchInternal(batch))
    );

    // 결과 집계
    const totalSuccess = results.filter(r => r.resultCode === 1).length;
    const totalFail = results.filter(r => r.resultCode !== 1).length;

    return {
      resultCode: totalFail === 0 ? 1 : -1,
      message: `${totalSuccess}건 성공, ${totalFail}건 실패`,
      failCount: totalFail,
    };
  }

  /**
   * 배치 발송 내부 구현
   */
  private async sendBatchInternal(
    requests: AligoSendRequest[]
  ): Promise<AligoSendResponse> {
    try {
      // URLSearchParams로 배치 구성
      const params = new URLSearchParams({
        key: this.config.apiKey,
        user_id: this.config.userId,
        sender: this.config.senderPhone,
        msg_type: 'SMS', // 배치는 SMS만 지원
      });

      // 각 수신자별 파라미터 추가
      requests.forEach((req, idx) => {
        const prefix = `receiver_${idx + 1}`;
        params.append(`${prefix}`, req.receiver);
        params.append(`msg_${idx + 1}`, req.message);
      });

      const response = await this.fetchWithTimeout(
        `${ALIGO_API_BASE}/send/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }
      );

      const data = (await response.json()) as any;

      logger.log('[Aligo] 배치 발송 결과', {
        resultCode: data.result_code,
        message: data.message,
        msgId: data.msg_id,
        failCount: data.fail_count,
      });

      return {
        resultCode: data.result_code || -1,
        message: data.message || '알 수 없는 오류',
        msgId: data.msg_id,
        failCount: data.fail_count,
      };
    } catch (error) {
      logger.error('[Aligo] 배치 발송 실패', {
        error: error instanceof Error ? error.message : String(error),
        count: requests.length,
      });

      return {
        resultCode: -1,
        message: error instanceof Error ? error.message : '네트워크 오류',
      };
    }
  }

  /**
   * 메시지 배송 상태 조회
   */
  async getDeliveryStatus(request: AligoDeliveryStatusRequest): Promise<AligoDeliveryStatus | null> {
    try {
      const params = new URLSearchParams({
        key: this.config.apiKey,
        user_id: this.config.userId,
        msg_id: request.msgId,
        ...(request.receiver && { receiver: request.receiver }),
      });

      const response = await this.fetchWithTimeout(
        `${ALIGO_API_BASE}/info/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }
      );

      const data = (await response.json()) as any;

      if (data.result_code !== 1) {
        logger.warn('[Aligo] 배송 상태 조회 실패', {
          msgId: request.msgId,
          resultCode: data.result_code,
          message: data.message,
        });
        return null;
      }

      // Aligo 상태 코드 변환
      const aligoStatus = data.status || data.state;
      const status = this.convertAligoStatus(aligoStatus);

      return {
        msgId: request.msgId,
        receiver: request.receiver || data.receiver || '',
        status,
        sentAt: data.sendtime ? new Date(data.sendtime) : undefined,
        deliveredAt: data.deliverytime ? new Date(data.deliverytime) : undefined,
        failureCode: data.failcode,
        failureReason: data.failmsg,
      };
    } catch (error) {
      logger.error('[Aligo] 배송 상태 조회 오류', {
        msgId: request.msgId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 발신자 번호 검증
   */
  async verifySenderNumber(): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        key: this.config.apiKey,
        user_id: this.config.userId,
      });

      const response = await this.fetchWithTimeout(
        `${ALIGO_API_BASE}/sender/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }
      );

      const data = (await response.json()) as any;

      if (!Array.isArray(data.list)) {
        return false;
      }

      const verified = data.list.some(
        (item: any) => item.flag === '1' && item.telnum === this.config.senderPhone
      );

      logger.log('[Aligo] 발신자 번호 검증', {
        senderPhone: this.config.senderPhone,
        verified,
      });

      return verified;
    } catch (error) {
      logger.error('[Aligo] 발신자 번호 검증 실패', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 내부: 재시도 로직을 포함한 발송
   */
  private async sendWithRetry(request: AligoSendRequest): Promise<AligoSendResponse> {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.sendInternal(request);

        // 성공
        if (response.resultCode === 1) {
          logger.log('[Aligo] SMS 발송 성공', {
            receiver: request.receiver.substring(0, 4) + '***',
            msgId: response.msgId,
            attempt,
          });
          return response;
        }

        // 재시도 가능한 오류인지 확인
        if (!RETRYABLE_CODES.has(response.resultCode)) {
          logger.warn('[Aligo] 재시도 불가능한 오류', {
            resultCode: response.resultCode,
            message: response.message,
          });
          return response;
        }

        lastError = response;

        // 재시도 전 대기 (지수 백오프: 1초 → 2초 → 4초)
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          logger.log('[Aligo] 재시도 대기', {
            receiver: request.receiver.substring(0, 4) + '***',
            attempt,
            delayMs,
          });
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        lastError = {
          resultCode: -1,
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        logger.error('[Aligo] 발송 시도 실패', {
          attempt,
          error: lastError.message,
        });
      }
    }

    logger.error('[Aligo] 최대 재시도 횟수 초과', {
      receiver: request.receiver.substring(0, 4) + '***',
      lastError: lastError?.message,
    });

    return lastError || { resultCode: -1, message: '알 수 없는 오류' };
  }

  /**
   * 내부: 단일 발송 구현
   */
  private async sendInternal(request: AligoSendRequest): Promise<AligoSendResponse> {
    const params = new URLSearchParams({
      key: this.config.apiKey,
      user_id: this.config.userId,
      sender: this.config.senderPhone,
      receiver: request.receiver,
      msg: request.message,
      msg_type: request.messageType || 'SMS',
      ...(request.title && request.messageType === 'LMS' && { title: request.title }),
      ...(request.scheduledTime && { reservation: request.scheduledTime }),
    });

    const response = await this.fetchWithTimeout(
      `${ALIGO_API_BASE}/send/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    const data = (await response.json()) as any;

    return {
      resultCode: data.result_code || -1,
      message: data.message || 'Unknown error',
      msgId: data.msg_id,
    };
  }

  /**
   * 내부: 타임아웃을 포함한 fetch
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ALIGO_TIMEOUT);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Aligo 상태 코드를 표준 상태로 변환
   */
  private convertAligoStatus(aligoStatus: string): AligoDeliveryStatus['status'] {
    const statusMap: Record<string, AligoDeliveryStatus['status']> = {
      '1': 'SENT', // 발송 완료
      '2': 'DELIVERED', // 전달됨
      '3': 'FAILED', // 실패
      '4': 'BOUNCED', // 반송
      '5': 'PENDING', // 대기 중
    };

    return statusMap[String(aligoStatus)] || 'PENDING';
  }
}

/**
 * 설정으로부터 클라이언트 생성
 */
export function createAligoClient(config: AligoConfig): AligoClient {
  return new AligoClient(config);
}
