export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendByChannel, resolveUserSmsConfig } from '@/lib/aligo';
import { sendSystemEmail } from '@/lib/system-email';

/**
 * GET /api/cron/contract-reminders
 * 계약서 서명 요청 재전송 자동화 (Day 0-3 심리학 적용)
 *
 * Vercel Cron: 매일 09:00 KST (00:00 UTC)
 * 조건: ContractInstance WHERE status=SENT AND sendAt+7days<now AND reminderCount<3
 * 액션: SMS + 이메일 발송
 *
 * 심리학 적용:
 * - L6 (손실회피): "7일 남았습니다" 시간 압박 메시지
 * - L10 (긴박감): "지금 서명하세요" 즉시 행동 유도
 * - A/B 테스트: 2가지 메시지 변형 (긴박감/친절)
 */

const BATCH_SIZE = 100;
const MAX_DURATION_MS = 250_000; // 250s

// ─── SMS 템플릿 (2가지 변형) ──────────────────────────────────────
const SMS_TEMPLATES = {
  URGENCY: (daysLeft: number, signerName: string) =>
    `${signerName}님, 계약서가 대기 중입니다. ${daysLeft}일 남았습니다. 지금 서명하세요: [링크]`,

  FRIENDLY: (daysLeft: number, signerName: string) =>
    `${signerName}님, 계약서를 아직 확인하지 않으셨네요. ${daysLeft}일 남았습니다. 클릭해서 서명 완료하세요: [링크]`,
};

// ─── 이메일 템플릿 ────────────────────────────────────────────────
const EMAIL_SUBJECT = '계약서 서명 재요청';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const getEmailBody = (signerName: string, daysLeft: number, signLink: string) => `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Apple SD Gothic Neo', '맑은 고딕', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 24px; }
    .card { background: #ffffff; border-radius: 12px; max-width: 560px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    h1 { color: #d32f2f; font-size: 22px; margin: 0 0 8px; }
    p { color: #4a5568; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .urgency { background: #ffebee; border-left: 4px solid #d32f2f; padding: 16px; margin: 16px 0; border-radius: 4px; color: #c62828; font-weight: 600; }
    .btn { display: inline-block; background: #d32f2f; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 8px 0 24px; }
    .note { font-size: 13px; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
    .url { font-size: 12px; color: #a0aec0; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🕐 계약서 서명 재요청</h1>
    <p>안녕하세요, <strong>${escHtml(signerName)}</strong>님!</p>
    <div class="urgency">
      아직 계약서가 서명되지 않았습니다. ${daysLeft}일 남았습니다. 지금 바로 서명을 완료해주세요.
    </div>
    <p>시간이 지날수록 계약 진행이 지연될 수 있습니다. 아래 버튼을 클릭하여 5~10분 내에 간편하게 전자서명을 완료하실 수 있습니다.</p>
    <a href="${signLink}" class="btn">⚡ 지금 바로 서명하기</a>
    <p>버튼이 작동하지 않는 경우 아래 주소를 직접 복사하여 브라우저에 붙여넣기 해주세요.</p>
    <p class="url">${signLink}</p>
    <div class="note">
      본 이메일은 마비즈 CRM에서 자동 발송된 메일입니다. 문의사항은 담당자에게 연락해 주세요.
    </div>
  </div>
</body>
</html>
`;

export async function GET(req: NextRequest) {
  // ─── Cron 보안 검증 ─────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET 미설정' },
      { status: 500 }
    );
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const startTime = Date.now();
  const now = new Date();

  // 7일 이전 SENT 상태 계약서 조회
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  logger.info('[Cron/contract-reminders] 시작', {
    time: now.toISOString(),
    sevenDaysAgo: sevenDaysAgo.toISOString(),
  });

  let sentCount = 0;
  let emailCount = 0;
  let skippedCount = 0;
  let processedTotal = 0;
  let earlyExit = false;

  const smsConfigCache: Record<string, Awaited<ReturnType<typeof resolveUserSmsConfig>>> = {};

  while (true) {
    // 시간 초과 시 조기 종료
    if (Date.now() - startTime > MAX_DURATION_MS) {
      earlyExit = true;
      logger.info('[Cron/contract-reminders] 시간 초과로 조기 종료', {
        processedTotal,
      });
      break;
    }

    // SENT 상태 + 7일 경과 + 재전송 횟수 < 3 계약서 조회
    const contracts = await prisma.contractInstance.findMany({
      take: BATCH_SIZE,
      where: {
        status: 'SENT',
        createdAt: { lte: sevenDaysAgo },
        reminderCount: { lt: 3 }, // 최대 3회까지만
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (contracts.length === 0) break;

    processedTotal += contracts.length;
    logger.info('[Cron/contract-reminders] 배치 처리 중', {
      batchSize: contracts.length,
      processedTotal,
    });

    for (const contract of contracts) {
      try {
        // boundData에서 서명자 정보 추출
        const boundData = (contract.boundData as Record<string, any>) || {};
        const signerName = boundData.signerName || '고객';
        const signerEmail = boundData.signerEmail || '';
        const signerPhone = boundData.signerPhone || '';

        if (!signerPhone && !signerEmail) {
          logger.warn('[Cron/contract-reminders] 연락처 없음', {
            contractId: contract.id,
          });
          skippedCount++;
          continue;
        }

        // 조직 SMS 설정 캐시
        if (!(contract.organizationId in smsConfigCache)) {
          smsConfigCache[contract.organizationId] = await resolveUserSmsConfig(
            contract.organizationId
          );
        }
        const smsConfig = smsConfigCache[contract.organizationId];

        // ─── A/B 테스트: 변형 선택 ────────────────────────────────
        // reminderCount % 2를 이용해 번갈아가며 전송
        const isUrgency = contract.reminderCount % 2 === 0;
        const template = isUrgency ? SMS_TEMPLATES.URGENCY : SMS_TEMPLATES.FRIENDLY;

        // 남은 기한 계산 (24시간 기본값에서 7일 후 현재까지 경과)
        const expiresAt = contract.expiresAt || new Date(contract.createdAt.getTime() + 86400000);
        const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000));

        // 서명 링크 생성 (실제로는 contract 라우터에서 생성하는 공개 서명 링크 사용)
        const signLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://mabiz-crm.vercel.app'}/contract/sign/${contract.id}`;

        // ─── SMS 발송 ──────────────────────────────────────────────
        if (signerPhone && smsConfig) {
          const smsMessage = template(daysLeft || 7, signerName).replace('[링크]', signLink);

          try {
            const result = await sendByChannel({
              channel: 'SMS',
              smsConfig: {
                key: smsConfig.key,
                userId: smsConfig.userId,
                sender: smsConfig.sender,
              },
              receiver: signerPhone,
              msg: smsMessage,
              organizationId: contract.organizationId,
              contactId: contract.contactId || undefined,
            });

            const code = Number(result.result_code);
            if (code === 1) {
              sentCount++;
              logger.info('[Cron/contract-reminders] SMS 발송 성공', {
                contractId: contract.id,
                signerPhone,
              });
            } else {
              logger.warn('[Cron/contract-reminders] SMS 발송 실패', {
                contractId: contract.id,
                resultCode: code,
              });
              skippedCount++;
            }
          } catch (smsErr) {
            logger.error('[Cron/contract-reminders] SMS 발송 예외', {
              contractId: contract.id,
              error: smsErr,
            });
            skippedCount++;
          }
        }

        // ─── 이메일 발송 (선택사항) ────────────────────────────────
        if (signerEmail) {
          // 이메일 형식 검증
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) {
            logger.warn('[Cron/contract-reminders] 유효하지 않은 이메일', {
              contractId: contract.id,
              signerEmail,
            });
          } else {
            try {
              const emailHtml = getEmailBody(signerName, daysLeft || 7, signLink);
              const sent = await sendSystemEmail({
                to: signerEmail,
                subject: `[마비즈] ${signerName}님, 계약서 서명 재요청`,
                html: emailHtml,
              });

              if (sent) {
                emailCount++;
                logger.info('[Cron/contract-reminders] 이메일 발송 성공', {
                  contractId: contract.id,
                  signerEmail,
                });
              } else {
                logger.warn('[Cron/contract-reminders] 이메일 발송 실패', {
                  contractId: contract.id,
                  signerEmail,
                });
              }
            } catch (emailErr) {
              logger.error('[Cron/contract-reminders] 이메일 발송 예외', {
                contractId: contract.id,
                error: emailErr,
              });
            }
          }
        }

        // ─── 계약서 상태 업데이트 ──────────────────────────────────
        await prisma.contractInstance.update({
          where: { id: contract.id },
          data: {
            lastReminderSentAt: new Date(),
            reminderCount: contract.reminderCount + 1,
          },
        });

        logger.info('[Cron/contract-reminders] 계약서 업데이트 완료', {
          contractId: contract.id,
          reminderCount: contract.reminderCount + 1,
        });
      } catch (err) {
        logger.error('[Cron/contract-reminders] 계약서 처리 실패', {
          contractId: contract.id,
          error: err,
        });
        skippedCount++;
      }
    }

    // 마지막 배치이면 루프 종료
    if (contracts.length < BATCH_SIZE) break;
  }

  const durationMs = Date.now() - startTime;
  logger.info('[Cron/contract-reminders] 완료', {
    sentCount,
    emailCount,
    skippedCount,
    processedTotal,
    durationMs,
    earlyExit,
  });

  return NextResponse.json({
    ok: true,
    sentCount,
    emailCount,
    skippedCount,
    processedTotal,
    durationMs,
    earlyExit,
  });
}
