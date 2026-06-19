import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { resolveUserSmsConfig } from '@/lib/aligo';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_LIMIT = 200;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (
    token.length !== cronSecret.length ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
  ) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const now = new Date();
  let dispatched = 0;
  let failed = 0;

  try {
    // Find ready-to-send sequence instances
    const instances = await prisma.contactSequenceInstance.findMany({
      where: {
        status: 'ACTIVE',
        nextSendAt: { lte: now },
      },
      include: {
        template: {
          include: { variants: true },
        },
      },
      take: BATCH_LIMIT,
    });

    logger.log('[sequence-dispatcher] instances to dispatch', { count: instances.length });

    for (const instance of instances) {
      try {
        // Determine next day to send
        const day = instance.day0SentAt === null
          ? 0
          : instance.day1SentAt === null
          ? 1
          : instance.day2SentAt === null
          ? 2
          : instance.day3SentAt === null
          ? 3
          : null;

        if (day === null) {
          // All days sent — mark as completed
          await prisma.contactSequenceInstance.update({
            where: { id: instance.id },
            data: { status: 'COMPLETED' },
          });
          continue;
        }

        // Find variant for this day (prefer 'A' variant)
        const variant = instance.template.variants.find(
          (v) => v.day === day && v.variantCode === 'A'
        ) ?? instance.template.variants.find((v) => v.day === day);

        if (!variant) {
          logger.warn('[sequence-dispatcher] no variant for day', { instanceId: instance.id, day });
          continue;
        }

        // Get contact and org SMS config (복호화된 키 사용)
        const [contact, smsConfig] = await Promise.all([
          prisma.contact.findUnique({
            where: { id: instance.contactId },
            select: { id: true, phone: true, name: true, optOutAt: true },
          }),
          resolveUserSmsConfig(instance.organizationId),
        ]);

        if (!contact?.phone || contact.optOutAt || !smsConfig) {
          await prisma.contactSequenceInstance.update({
            where: { id: instance.id },
            data: {
              status: contact?.optOutAt ? 'FAILED' : 'PAUSED',
              failureReason: contact?.optOutAt ? 'OPT_OUT' : 'SMS_CONFIG_MISSING',
            },
          });
          continue;
        }

        // Send via Aligo (복호화된 key/userId/sender 사용)
        const formData = new URLSearchParams();
        formData.append('user_id', smsConfig.userId);
        formData.append('key', smsConfig.key);
        formData.append('sender', smsConfig.sender);
        formData.append('receiver', contact.phone.replace(/[^0-9]/g, ''));
        formData.append('msg', variant.messageContent.replace(/\{이름\}/g, contact.name ?? '고객'));
        formData.append('msg_type', variant.messageContent.length > 90 ? 'LMS' : 'SMS');

        const aligoRes = await fetch('https://apis.aligo.in/send/', {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(15000),
        });
        const aligoJson: any = await aligoRes.json();
        const success = aligoJson.result_code === 1;

        // Compute next send time
        const delayMinutes = day === 0 ? instance.template.day1Delay
          : day === 1 ? instance.template.day2Delay
          : day === 2 ? instance.template.day3Delay
          : null;

        const nextSendAt = delayMinutes !== null
          ? new Date(now.getTime() + delayMinutes * 60 * 1000)
          : null;

        // Update instance
        const sentField = `day${day}SentAt` as 'day0SentAt' | 'day1SentAt' | 'day2SentAt' | 'day3SentAt';
        await prisma.contactSequenceInstance.update({
          where: { id: instance.id },
          data: {
            [sentField]: now,
            nextSendAt: nextSendAt ?? undefined,
            status: success ? (nextSendAt ? 'ACTIVE' : 'COMPLETED') : 'ACTIVE',
            failureReason: success ? null : (aligoJson.message ?? 'ALIGO_ERROR'),
          },
        });

        if (success) {
          dispatched++;
          // Record in PartnerSmsLog for tracking
          await prisma.partnerSmsLog.create({
            data: {
              organizationId: instance.organizationId,
              contactId: contact.id,
              phoneNumber: contact.phone,
              messageContent: variant.messageContent,
              messageType: `SEQUENCE_DAY${day}`,
              status: 'SENT',
              day: `day${day}`,
              smsId: String(aligoJson.msg_id ?? ''),
            },
          }).catch(() => {}); // non-fatal
        } else {
          failed++;
          logger.warn('[sequence-dispatcher] aligo send failed', {
            instanceId: instance.id,
            day,
            result_code: aligoJson.result_code,
          });
        }
      } catch (instanceErr) {
        failed++;
        logger.error('[sequence-dispatcher] instance error', {
          instanceId: instance.id,
          error: instanceErr instanceof Error ? instanceErr.message : String(instanceErr),
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.log('[sequence-dispatcher] done', { dispatched, failed, duration });

    return NextResponse.json({ ok: true, dispatched, failed, durationMs: duration });
  } catch (err) {
    logger.error('[sequence-dispatcher] fatal error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
