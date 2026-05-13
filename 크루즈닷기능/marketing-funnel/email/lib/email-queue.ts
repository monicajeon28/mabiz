/**
 * O-1: 이메일 큐 (Bull + Redis)
 * 자동 이메일 발송을 위한 비동기 큐 시스템
 */

import Bull from 'bull';
import { renderTemplate } from './email-renderer';
import { prisma } from './prisma';
import { logger } from './logger';

export interface EmailJobData {
  templateId: number;
  recipientEmail: string;
  recipientName?: string;
  variables: Record<string, string | number>;
}

/**
 * Bull 큐 생성
 * Redis는 environment variable로 설정: REDIS_URL
 */
export const emailQueue = new Bull<EmailJobData>('email-queue', {
  redis: process.env.REDIS_URL || { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 3, // 최대 3회 재시도
    backoff: {
      type: 'exponential',
      delay: 2000, // 2초부터 시작해서 지수적으로 증가
    },
    removeOnComplete: true, // 완료된 작업은 자동 삭제
    removeOnFail: false, // 실패한 작업은 보존 (나중에 분석용)
  },
});

/**
 * 이메일 발송 처리 (메인 워커)
 * Bull 큐에 추가된 작업을 처리함
 */
emailQueue.process(async (job) => {
  const { templateId, recipientEmail, recipientName, variables } = job.data;

  try {
    // 템플릿 조회
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      logger.error('EmailQueue: Template not found', {
        templateId,
        context: 'emailQueue.process',
      });
      throw new Error(`Template not found: ${templateId}`);
    }

    // Handlebars로 템플릿 렌더링
    const { subject, body } = renderTemplate(template, variables);

    // 이메일 발송 (SendGrid 또는 다른 서비스)
    // TODO: 실제 이메일 서비스와 통합
    // await sendEmailViaSendGrid(recipientEmail, recipientName, subject, body);

    logger.info('EmailQueue: Email sent successfully', {
      templateId,
      recipientEmail,
      context: 'emailQueue.process',
    });

    // 발송 로그 저장
    await prisma.emailTemplate_Log.create({
      data: {
        templateId,
        recipientEmail,
        subject,
        status: 'SENT',
        variables: variables as any,
        sentAt: new Date(),
      },
    });

    return { success: true, sentAt: new Date() };
  } catch (error) {
    logger.error('EmailQueue: Error sending email', {
      templateId,
      recipientEmail,
      error: error instanceof Error ? error.message : String(error),
      context: 'emailQueue.process',
    });

    // 실패 로그 저장
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
      });

      if (template) {
        await prisma.emailTemplate_Log.create({
          data: {
            templateId,
            recipientEmail,
            subject: template.subject,
            status: 'FAILED',
            variables: variables as any,
            errorMessage: error instanceof Error ? error.message : String(error),
            retryCount: job.attemptsMade,
          },
        });
      }
    } catch (logError) {
      logger.error('EmailQueue: Failed to save error log', {
        error: logError instanceof Error ? logError.message : String(logError),
        context: 'emailQueue.process',
      });
    }

    throw error; // Bull이 재시도를 처리하도록 에러 전파
  }
});

/**
 * 큐 이벤트 핸들러
 */

// 작업 완료
emailQueue.on('completed', (job) => {
  logger.info('EmailQueue: Job completed', {
    jobId: job.id,
    context: 'emailQueue.on.completed',
  });
});

// 작업 실패 (재시도 불가)
emailQueue.on('failed', (job, err) => {
  logger.error('EmailQueue: Job failed permanently', {
    jobId: job.id,
    templateId: job.data.templateId,
    error: err.message,
    attempts: job.attemptsMade,
    context: 'emailQueue.on.failed',
  });
});

// 작업 재시도
emailQueue.on('retry', (job, err) => {
  logger.warn('EmailQueue: Job retry', {
    jobId: job.id,
    templateId: job.data.templateId,
    error: err.message,
    attempts: job.attemptsMade,
    context: 'emailQueue.on.retry',
  });
});

/**
 * 이메일 큐에 작업 추가
 * @param data 이메일 작업 데이터
 * @returns Job ID
 */
export async function addEmailJob(data: EmailJobData): Promise<string> {
  const job = await emailQueue.add(data);
  logger.info('EmailQueue: Job added', {
    jobId: job.id,
    templateId: data.templateId,
    recipientEmail: data.recipientEmail,
    context: 'addEmailJob',
  });
  return job.id;
}

/**
 * 이메일 큐 상태 확인
 */
export async function getEmailQueueStats() {
  const counts = await emailQueue.getJobCounts();
  return {
    active: counts.active,
    waiting: counts.waiting,
    completed: counts.completed,
    failed: counts.failed,
    delayed: counts.delayed,
  };
}

/**
 * 이메일 큐 초기화 (개발/테스트용)
 */
export async function clearEmailQueue() {
  await emailQueue.clean(0, 'completed');
  await emailQueue.clean(0, 'failed');
  logger.info('EmailQueue: Queue cleared', { context: 'clearEmailQueue' });
}
