/**
 * 모니터링 시스템 통합 예제
 *
 * 이 파일은 다음을 보여줍니다:
 * 1. Sentry 초기화 및 에러 추적
 * 2. API 에러 모니터링
 * 3. 데이터베이스 에러 추적
 * 4. 성능 모니터링
 * 5. 자동 복구 시스템 연동
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initializeSentry,
  captureException,
  captureMessage,
  trackApiError,
  trackDatabaseError,
  trackCrmError,
  trackCampaignError,
  trackPerformance,
  startTransaction
} from '@/monitoring/sentry.config';

// ============================================================================
// 1. 서버 시작 시 초기화 (server.ts 또는 app/layout.tsx)
// ============================================================================

/**
 * 애플리케이션 시작 시 Sentry 초기화
 * 이 코드는 서버 시작 시 한 번만 실행
 */
export function initializeMonitoring() {
  if (typeof window === 'undefined') {
    // 서버 환경에서만 실행
    initializeSentry();
    console.log('✅ Sentry monitoring initialized');
  }
}

// ============================================================================
// 2. API 라우트 에러 추적 예제
// ============================================================================

/**
 * API 라우트 핸들러 래퍼
 * 자동으로 에러 추적 및 성능 모니터링
 */
export function createApiHandler(
  handlerName: string,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    const endpoint = req.nextUrl.pathname;

    try {
      const response = await handler(req);
      const duration = Date.now() - startTime;

      // 느린 API 추적
      if (duration > 1000) {
        trackPerformance(`API: ${endpoint}`, duration, {
          method: req.method,
          statusCode: response.status
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error instanceof Error ? 500 : 500;

      // 에러 추적
      trackApiError(endpoint, statusCode, error as Error, duration);

      // Sentry에도 전송
      captureException(error, {
        api: {
          endpoint,
          method: req.method,
          duration
        }
      });

      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: statusCode }
      );
    }
  };
}

/**
 * 사용 예제:
 *
 * // src/app/api/contacts/route.ts
 * import { createApiHandler } from '@/lib/monitoring/integration-example';
 *
 * export const GET = createApiHandler('getContacts', async (req) => {
 *   const contacts = await db.contacts.findMany();
 *   return Response.json(contacts);
 * });
 */

// ============================================================================
// 3. 데이터베이스 에러 추적 예제
// ============================================================================

/**
 * Supabase 쿼리 래퍼
 * 데이터베이스 에러를 자동으로 추적
 */
export async function executeDbQuery<T>(
  operation: string,
  table: string,
  query: () => Promise<T>
): Promise<T> {
  try {
    const result = await query();
    return result;
  } catch (error) {
    // 에러 추적
    trackDatabaseError(operation, table, error as Error);

    // Sentry 전송
    captureException(error, {
      database: {
        operation,
        table,
        errorMessage: (error as Error).message
      }
    });

    throw error;
  }
}

/**
 * 사용 예제:
 *
 * const contacts = await executeDbQuery(
 *   'SELECT',
 *   'contacts',
 *   () => supabase.from('contacts').select('*')
 * );
 */

// ============================================================================
// 4. CRM 작업 에러 추적 예제
// ============================================================================

/**
 * Contact 업데이트 래퍼
 * CRM 관련 에러 추적
 */
export async function updateContact(
  contactId: string,
  data: Record<string, any>
) {
  const startTime = Date.now();

  try {
    // 데이터베이스 업데이트
    const { data: updated, error } = await executeDbQuery(
      'UPDATE',
      'contacts',
      () =>
        fetch(`/api/contacts/${contactId}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        }).then(r => r.json())
    );

    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;
    trackPerformance(`Contact update: ${contactId}`, duration);

    return updated;
  } catch (error) {
    // CRM 에러 추적
    trackCrmError('UPDATE', contactId, error as Error);
    throw error;
  }
}

// ============================================================================
// 5. 캠페인 작업 에러 추적 예제
// ============================================================================

/**
 * Campaign 전송 래퍼
 * 캠페인 관련 에러 추적
 */
export async function sendCampaign(campaignId: string) {
  const startTime = Date.now();

  try {
    // API 호출
    const response = await fetch(`/api/campaigns/${campaignId}/send`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Campaign send failed: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    trackPerformance(`Campaign send: ${campaignId}`, duration);

    return data;
  } catch (error) {
    // 캠페인 에러 추적
    trackCampaignError(campaignId, 'SEND', error as Error);

    // Sentry 전송
    captureException(error, {
      campaign: {
        campaignId,
        action: 'SEND'
      }
    });

    throw error;
  }
}

// ============================================================================
// 6. 미들웨어에서의 에러 핸들링 예제
// ============================================================================

/**
 * Express/Next.js 미들웨어
 * 모든 요청의 에러를 추적
 */
export function errorHandlingMiddleware() {
  return (error: any, req: any, res: any, next: any) => {
    const statusCode = error.statusCode || 500;

    // 에러 추적
    trackApiError(req.path, statusCode, error, 0);

    // Sentry에 전송
    captureException(error, {
      request: {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    // 응답
    res.status(statusCode).json({
      error: error.message,
      requestId: req.id
    });
  };
}

// ============================================================================
// 7. 배치 작업 모니터링 예제
// ============================================================================

/**
 * 배치 작업(예: 스케줄된 SMS 발송)을 모니터링
 */
export async function monitorBatchJob(
  jobName: string,
  execute: () => Promise<any>
) {
  const startTime = Date.now();
  const batchSize = 100;
  let processedCount = 0;
  let errorCount = 0;

  try {
    console.log(`[${jobName}] Started`);

    const result = await execute();

    processedCount = result.processed || 0;
    errorCount = result.errors || 0;

    const duration = Date.now() - startTime;
    const avgTimePerItem = processedCount > 0 ? duration / processedCount : 0;

    // 성능 메트릭 추적
    trackPerformance(`Batch: ${jobName}`, duration, {
      processed: processedCount,
      errors: errorCount,
      avgTimePerItem
    });

    // 메시지 로깅
    captureMessage(
      `Batch job completed: ${jobName}`,
      'info',
      {
        batch: {
          jobName,
          processed: processedCount,
          errors: errorCount,
          duration
        }
      }
    );

    console.log(`[${jobName}] Completed: ${processedCount} processed, ${errorCount} errors`);

    return result;
  } catch (error) {
    // 배치 작업 실패 추적
    captureException(error, {
      batch: {
        jobName,
        processed: processedCount,
        errors: errorCount
      }
    });

    console.error(`[${jobName}] Failed:`, error);
    throw error;
  }
}

/**
 * 사용 예제:
 *
 * await monitorBatchJob('SendDaySmsMessages', async () => {
 *   const messages = await db.crm_marketing_messages.findMany({
 *     where: { sent_at: null }
 *   });
 *
 *   let processed = 0;
 *   let errors = 0;
 *
 *   for (const msg of messages) {
 *     try {
 *       await sendSms(msg);
 *       processed++;
 *     } catch (e) {
 *       errors++;
 *     }
 *   }
 *
 *   return { processed, errors };
 * });
 */

// ============================================================================
// 8. 성능 모니터링 데코레이터 예제
// ============================================================================

/**
 * 함수 성능을 자동으로 모니터링하는 데코레이터
 */
export function monitorPerformance(
  name: string,
  options = { threshold: 1000 }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        if (duration > options.threshold) {
          trackPerformance(name, duration);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        trackPerformance(`${name} (ERROR)`, duration);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 사용 예제:
 *
 * class ContactService {
 *   @monitorPerformance('ContactService.getAll', { threshold: 500 })
 *   async getAll() {
 *     return await db.contacts.findMany();
 *   }
 * }
 */

// ============================================================================
// 9. 트랜잭션 추적 예제
// ============================================================================

/**
 * 긴 작업을 트랜잭션으로 추적
 */
export async function trackTransaction(
  name: string,
  operation: () => Promise<any>
) {
  const transaction = startTransaction(name, 'http.request');

  try {
    const result = await operation();
    transaction.finish();
    return result;
  } catch (error) {
    transaction.setStatus('error');
    transaction.finish();
    throw error;
  }
}

/**
 * 사용 예제:
 *
 * const result = await trackTransaction(
 *   'ProcessPayment',
 *   async () => {
 *     // 결제 처리
 *     const payment = await processPayment(orderId);
 *     // 이메일 발송
 *     await sendConfirmationEmail(customer);
 *     return payment;
 *   }
 * );
 */

// ============================================================================
// 10. 헬스 체크 통합 예제
// ============================================================================

/**
 * 시스템 헬스 체크
 */
export async function healthCheck() {
  const checks = {
    database: false,
    api: false,
    cache: false,
    sms: false
  };

  try {
    // DB 체크
    const { error: dbError } = await executeDbQuery(
      'HEALTH_CHECK',
      'contacts',
      () =>
        fetch('/api/health/database').then(r =>
          r.ok ? Promise.resolve(r.json()) : Promise.reject(new Error('DB down'))
        )
    );
    checks.database = !dbError;
  } catch {
    checks.database = false;
  }

  try {
    // API 체크
    const apiResponse = await fetch('/api/health');
    checks.api = apiResponse.ok;
  } catch {
    checks.api = false;
  }

  try {
    // 캐시 체크
    const cacheResponse = await fetch('/api/health/cache');
    checks.cache = cacheResponse.ok;
  } catch {
    checks.cache = false;
  }

  try {
    // SMS 게이트웨이 체크
    const smsResponse = await fetch('/api/health/sms');
    checks.sms = smsResponse.ok;
  } catch {
    checks.sms = false;
  }

  const allHealthy = Object.values(checks).every(v => v);

  if (!allHealthy) {
    captureMessage('Health check failed', 'error', { checks });
  }

  return {
    healthy: allHealthy,
    checks,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// 초기화
// ============================================================================

// 애플리케이션 시작 시 자동으로 모니터링 초기화
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  initializeMonitoring();
}

export default {
  initializeMonitoring,
  createApiHandler,
  executeDbQuery,
  updateContact,
  sendCampaign,
  errorHandlingMiddleware,
  monitorBatchJob,
  monitorPerformance,
  trackTransaction,
  healthCheck
};
