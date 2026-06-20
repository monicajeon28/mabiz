export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/scheduled-kakao
 * Vercel Cron (매 5분) — PENDING 상태 + scheduledAt <= now() 발송 처리
 * 패턴: scheduled-sms/scheduled-email와 동일 (낙관적 잠금, 최대 50건/회)
 */
export async function GET(req: Request) {
  // Cron 인증 — Vercel Cron Bearer token
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';

  if (!secret) {
    const msg = 'CRON_SECRET 환경변수 미설정';
    logger.error('[CronScheduledKakao] 인증 실패', { reason: msg });
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const expected = `Bearer ${secret}`;
  let authValid = false;
  try {
    authValid = auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    authValid = false;
  }

  if (!authValid) {
    logger.warn('[CronScheduledKakao] 인증 실패', { ip: req.headers.get('x-forwarded-for') });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();

  // KST 시간 계산 (UTC+9)
  const kstNowHour = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
  const isNightTime = kstNowHour >= 22 || kstNowHour < 8;

  // 처리할 예약 목록 (최대 50건/회, 오래된 것부터)
  const due = await prisma.scheduledKakao.findMany({
    where: { status: { in: ['PENDING', 'NIGHT_BLOCKED'] }, scheduledAt: { lte: now } },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let errors = 0;

  for (const item of due) {
    try {
      // 야간 차단 (KST 22시-08시 사이 → NIGHT_BLOCKED 상태로 다음날 08시로 연기)
      if (isNightTime) {
        const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const kstTomorrowHour8 = new Date(
          Date.UTC(
            kstNow.getUTCFullYear(),
            kstNow.getUTCMonth(),
            kstNow.getUTCDate() + 1,
            -1, // UTC 23:00 = KST 08:00
            0,
            0,
            0
          )
        );
        await prisma.scheduledKakao.updateMany({
          where: { id: item.id },
          data: { status: 'NIGHT_BLOCKED', scheduledAt: kstTomorrowHour8 },
        });
        logger.log('[Cron/ScheduledKakao] 야간 차단', {
          id: item.id,
          kstNowHour,
          nextTry: kstTomorrowHour8,
        });
        continue;
      }

      // 낙관적 잠금 — 다른 Cron 인스턴스 중복 처리 방지
      const locked = await prisma.scheduledKakao.updateMany({
        where: { id: item.id, status: { in: ['PENDING', 'NIGHT_BLOCKED'] } },
        data: { status: 'SENDING' },
      });
      if (locked.count === 0) continue;

      // 수신자 목록 조회
      const recipients: { phone: string; name: string }[] = [];

      if (item.contactId) {
        const c = await prisma.contact.findFirst({
          where: { id: item.contactId, organizationId: item.organizationId, deletedAt: null },
          select: { phone: true, name: true },
        });
        if (c?.phone) recipients.push({ phone: c.phone, name: c.name || '' });
      } else if (item.groupId) {
        const members = await prisma.contact.findMany({
          where: {
            organizationId: item.organizationId,
            groups: { some: { id: item.groupId } },
            deletedAt: null,
          },
          select: { phone: true, name: true },
          take: 1000,
        });
        recipients.push(...members.map((m) => ({ phone: m.phone, name: m.name || '' })));
      }

      if (recipients.length === 0) {
        await prisma.scheduledKakao.update({
          where: { id: item.id },
          data: { status: 'FAILED', failureReason: '수신자 없음' },
        });
        logger.warn('[Cron/ScheduledKakao] 수신자 없음', { id: item.id });
        errors++;
        continue;
      }

      // 카카오톡 발송
      let sentCount = 0;
      let failedCount = 0;

      // 조직 카카오톡 설정 조회
      const kakaoConfig = await prisma.kakaoConfig.findUnique({
        where: { organizationId: item.organizationId },
      });

      if (!kakaoConfig) {
        await prisma.scheduledKakao.update({
          where: { id: item.id },
          data: { status: 'FAILED', failureReason: '카카오톡 설정이 없습니다' },
        });
        logger.error('[Cron/ScheduledKakao] 설정 없음', { id: item.id });
        errors++;
        continue;
      }

      const apiKey = process.env.ALIGO_API_KEY;
      const userId = process.env.ALIGO_USER_ID;

      if (!apiKey || !userId) {
        await prisma.scheduledKakao.update({
          where: { id: item.id },
          data: { status: 'FAILED', failureReason: 'Aligo 환경변수 누락' },
        });
        logger.error('[Cron/ScheduledKakao] 환경변수 누락', { id: item.id });
        errors++;
        continue;
      }

      for (const recipient of recipients) {
        try {
          // Aligo 카카오톡 API 호출
          const formData = new URLSearchParams();
          formData.append('key', apiKey);
          formData.append('user_id', userId);
          formData.append('senderkey', kakaoConfig.senderKey);
          formData.append('tpl_code', item.templateCode || 'EXAM');
          formData.append('receiver', recipient.phone);
          formData.append('subject', '알림');
          formData.append('message', item.message || '');

          // 템플릿 변수 추가
          if (item.variables) {
            try {
              const vars = JSON.parse(item.variables) as Record<string, string>;
              Object.entries(vars).forEach(([k, v], idx) => {
                formData.append(`var${idx + 1}`, String(v));
              });
            } catch (e) {
              logger.warn('[Cron/ScheduledKakao] 변수 파싱 실패', { id: item.id });
            }
          }

          const aligoRes = await fetch('https://kakao.aligo.in/send', {
            method: 'POST',
            body: formData,
          });

          if (!aligoRes.ok) {
            throw new Error(`HTTP ${aligoRes.status}`);
          }

          const resData = (await aligoRes.json()) as { result: string | number; msg_id?: string };
          if (resData.result !== '1' && resData.result !== 1) {
            throw new Error(`result=${resData.result}`);
          }

          sentCount++;
        } catch (err) {
          logger.error('[Cron/ScheduledKakao] 개별 발송 실패', {
            id: item.id,
            phone: recipient.phone,
            error: err instanceof Error ? err.message : String(err),
          });
          failedCount++;
        }
      }

      // 상태 업데이트
      const finalStatus = failedCount === 0 ? 'SENT' : failedCount === sentCount ? 'FAILED' : 'PARTIAL';
      await prisma.scheduledKakao.update({
        where: { id: item.id },
        data: {
          status: finalStatus,
          sentCount,
          failedCount,
          sentAt: finalStatus === 'SENT' || finalStatus === 'PARTIAL' ? now : undefined,
          failureReason: failedCount > 0 ? `${failedCount}/${recipients.length} 실패` : undefined,
        },
      });

      logger.log('[Cron/ScheduledKakao] 발송 완료', {
        id: item.id,
        sentCount,
        failedCount,
        status: finalStatus,
      });

      processed++;
    } catch (err) {
      logger.error('[Cron/ScheduledKakao] 예약 처리 실패', {
        id: item.id,
        error: err instanceof Error ? err.message : String(err),
      });

      // 실패 상태 저장
      await prisma.scheduledKakao.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
          failureReason: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => {
        // 업데이트 실패 시 로그만 기록
        logger.error('[Cron/ScheduledKakao] 상태 업데이트 실패', { id: item.id });
      });

      errors++;
    }
  }

  return NextResponse.json({ ok: true, processed, errors });
}
