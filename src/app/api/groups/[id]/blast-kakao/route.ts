export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkRateLimitAsync, getRateLimitStatus } from '@/lib/rate-limit';

const MAX_RECIPIENTS = 200;
const BATCH_SIZE = 10;
const MAX_KAKAO_TITLE_LENGTH = 30;
const MAX_KAKAO_MESSAGE_LENGTH = 1000;
const KAKAO_BLAST_MAX_PER_DAY = 5;
const KAKAO_BLAST_WINDOW_MS = 24 * 60 * 60 * 1000;
const DISALLOWED_CHARS = /[\x00-\x1F\x7F​-⁯﻿]/;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/groups/[id]/blast-kakao
 * 그룹 전체에 즉시 카카오톡 일괄 발송
 *
 * body: { title: string; message: string; dryRun?: boolean }
 * dryRun=true → 실제 발송 없이 대상 인원만 반환
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    if (!orgId) {
      logger.error('[KakaoBlast] 조직 정보 없음', { userId: ctx?.userId });
      return NextResponse.json(
        { ok: false, message: '조직 정보 없음. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }
    const { id: groupId } = await params;

    const { title, message, dryRun = false } = await req.json();

    // 입력값 검증
    if (!title?.trim()) {
      return NextResponse.json(
        { ok: false, message: '제목을 입력하세요.' },
        { status: 400 }
      );
    }

    if (!message?.trim()) {
      return NextResponse.json(
        { ok: false, message: '메시지를 입력하세요.' },
        { status: 400 }
      );
    }

    const trimmedTitle = title.trim();
    const trimmedMsg = message.trim();

    if (trimmedTitle.length > MAX_KAKAO_TITLE_LENGTH) {
      return NextResponse.json(
        {
          ok: false,
          error: 'TITLE_TOO_LONG',
          message: '제목은 30자 이내여야 합니다.',
        },
        { status: 400 }
      );
    }

    if (trimmedMsg.length > MAX_KAKAO_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          ok: false,
          error: 'MESSAGE_TOO_LONG',
          message: '메시지는 1000자 이내여야 합니다.',
        },
        { status: 400 }
      );
    }

    if (DISALLOWED_CHARS.test(trimmedTitle) || DISALLOWED_CHARS.test(trimmedMsg)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_CHARS',
          message: '사용할 수 없는 문자가 포함되어 있습니다.',
        },
        { status: 400 }
      );
    }

    // [보안] 그룹 소유권 검증 (IDOR 방지)
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true },
    });
    if (!group) {
      return NextResponse.json(
        { ok: false, message: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 그룹 멤버 조회
    const members = await prisma.contactGroupMember.findMany({
      where: {
        groupId,
        contact: {
          organizationId: orgId,
          optOutAt: null,
          phone: { not: '' },
        },
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
      },
      take: MAX_RECIPIENTS + 1,
    });

    const totalInGroup = await prisma.contactGroupMember.count({ where: { groupId } });
    const isOverLimit = members.length > MAX_RECIPIENTS;
    const targets = members.slice(0, MAX_RECIPIENTS);

    logger.log('[KakaoBlast] 대상 파악', {
      group: group.name,
      total: totalInGroup,
      targets: targets.length,
      dryRun,
    });

    // dryRun: 실제 발송 없이 인원만 반환
    if (dryRun) {
      const rlKey = `kakao_blast:${ctx.userId || ''}:${groupId}`;
      const rateLimitStatus = getRateLimitStatus(rlKey, KAKAO_BLAST_MAX_PER_DAY, KAKAO_BLAST_WINDOW_MS);

      const sampleMessage = `${trimmedTitle}\n${trimmedMsg}`.substring(0, 200);

      return NextResponse.json({
        ok: true,
        dryRun: true,
        groupName: group.name,
        total: totalInGroup,
        willSend: targets.length,
        isOverLimit,
        overLimitMsg: isOverLimit
          ? `200명 제한 초과 — 첫 ${MAX_RECIPIENTS}명에게만 발송됩니다.`
          : null,
        sample: sampleMessage,
        rateLimitStatus,
      });
    }

    // Rate limit 확인
    const userId = ctx.userId || '';
    const rlKey = `kakao_blast:${userId}:${groupId}`;
    const { allowed } = await checkRateLimitAsync(rlKey, KAKAO_BLAST_MAX_PER_DAY, KAKAO_BLAST_WINDOW_MS);
    if (!allowed) {
      const status = getRateLimitStatus(rlKey, KAKAO_BLAST_MAX_PER_DAY, KAKAO_BLAST_WINDOW_MS);
      return NextResponse.json(
        {
          ok: false,
          message: `하루 발송 횟수(5회)를 초과했습니다. 내일 ${status.resetAt.toLocaleTimeString('ko-KR')}부터 가능합니다.`,
          rateLimitStatus: status,
        },
        { status: 429 }
      );
    }

    // Kakao 설정 조회
    const kakaoConfig = await prisma.kakaoConfig.findFirst({
      where: { organizationId: orgId, isActive: true },
      select: { senderKey: true },
    });
    if (!kakaoConfig) {
      return NextResponse.json(
        {
          ok: false,
          message: '카카오톡 설정이 없습니다. 설정 → 카카오톡에서 발신키를 입력하세요.',
        },
        { status: 400 }
      );
    }

    // 10건씩 배치 발송
    let sentCount = 0;
    let failedCount = 0;
    const failures: Array<{ phoneNumber: string; reason: string; timestamp: string }> = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (m) => {
          const personalizedTitle = trimmedTitle
            .replace(/\[이름\]/g, m.contact.name)
            .replace(/\[고객명\]/g, m.contact.name);

          const personalizedMsg = trimmedMsg
            .replace(/\[이름\]/g, m.contact.name)
            .replace(/\[고객명\]/g, m.contact.name)
            .replace(/\[전화번호\]/g, m.contact.phone);

          try {
            const res = await fetch('https://apis.aligo.in/send/', {
              method: 'POST',
              body: new URLSearchParams({
                key: process.env.ALIGO_API_KEY!,
                user_id: process.env.ALIGO_USER_ID!,
                senderkey: kakaoConfig.senderKey,
                tpl_code: process.env.ALIGO_KAKAO_TPL_CODE || 'EXAM',
                receiver: m.contact.phone,
                subject: personalizedTitle,
                message: personalizedMsg,
                failover: 'true',
              }),
            });

            const data = await res.json();

            return {
              phoneNumber: m.contact.phone,
              resultCode: data.result_code,
              resultMsg: data.message,
            };
          } catch (err) {
            return {
              phoneNumber: m.contact.phone,
              resultCode: '-1',
              resultMsg: err instanceof Error ? err.message : '알 수 없는 오류',
            };
          }
        })
      );

      // 발송 결과 처리
      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          failedCount++;
          const errorMsg = r.reason?.message || String(r.reason) || '알 수 없는 오류';
          failures.push({
            phoneNumber: batch[idx].contact.phone,
            reason: errorMsg,
            timestamp: new Date().toISOString(),
          });
        } else {
          const code = r.value.resultCode;
          if (code === '1') {
            sentCount++;
          } else {
            failedCount++;
            failures.push({
              phoneNumber: r.value.phoneNumber,
              reason: `Kakao API 오류 (코드: ${code}, 메시지: ${r.value.resultMsg})`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    }

    // 발송 실패 시 상세 로깅
    if (failures.length > 0) {
      logger.warn('[KakaoBlastPartialFailure]', {
        group: group.name,
        totalAttempted: targets.length,
        failureCount: failures.length,
        failureRate: `${((failures.length / targets.length) * 100).toFixed(1)}%`,
        failureDetails: failures.slice(0, 10),
      });
    }

    // 발송 이력 저장
    await prisma.adminMessage.create({
      data: {
        organizationId: orgId,
        adminId: ctx.userId,
        messageType: 'kakao',
        channel: 'KAKAO',
        groupId,
        content: `[${trimmedTitle}] ${trimmedMsg}`,
        totalSent: sentCount + failedCount,
        successCount: sentCount,
      },
    });

    // SmsLog에도 각 발송 기록을 저장 (채널 추적 용)
    const smsLogRecords = targets.map((m, idx) => ({
      organizationId: orgId,
      contactId: m.contact.id,
      phone: m.contact.phone,
      contentPreview: `[${trimmedTitle}] ${trimmedMsg}`.substring(0, 100),
      status: failures.some(f => f.phoneNumber === m.contact.phone) ? 'FAILED' : 'SENT',
      blockReason: failures.find(f => f.phoneNumber === m.contact.phone)?.reason ?? null,
      resultCode: '1', // Kakao API returns '1' for success
      channel: 'KAKAO',
      sentAt: new Date(),
    }));

    if (smsLogRecords.length > 0) {
      await prisma.smsLog.createMany({
        data: smsLogRecords,
        skipDuplicates: true,
      });
    }

    logger.log('[KakaoBlast] 발송 완료', {
      group: group.name,
      sentCount,
      failedCount,
      hasFailures: failures.length > 0,
    });

    return NextResponse.json({
      ok: true,
      groupName: group.name,
      sentCount,
      failedCount,
      total: targets.length,
      failures: failures.slice(0, 10),
    });
  } catch (err) {
    logger.error('[KakaoBlast] 처리 실패', { err });
    return NextResponse.json(
      { ok: false, message: '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
