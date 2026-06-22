export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendSms, resolveUserSmsConfig } from '@/lib/aligo';
import { checkRateLimitAsync, getRateLimitStatus } from '@/lib/rate-limit';

const MAX_RECIPIENTS = 200; // Vercel 타임아웃 방지 (10건 배치 × 20회 ≈ 2초)
const BATCH_SIZE     = 10;
const MAX_SMS_LENGTH = 90;
const SMS_BLAST_MAX_PER_DAY = 5;
const SMS_BLAST_WINDOW_MS   = 24 * 60 * 60 * 1000;
const DISALLOWED_CHARS = /[\x00-\x1F\x7F​-⁯﻿]/;

type Params = { params: Promise<{ id: string }> };

/** Contact 필드 + 담당자 이름으로 치환변수 8개 처리 */
interface PersonalizeContext {
  name: string;
  phone: string;
  assignedUserName: string;   // OrganizationMember.displayName or ''
  cruiseInterest: string;     // 상품명
  departureDate: string;      // 출발일 (포맷 적용)
}

function personalizeMessage(template: string, ctx: PersonalizeContext): string {
  return template
    .replace(/\[고객명\]/g, ctx.name)
    .replace(/\[이름\]/g,   ctx.name)
    .replace(/\[전화번호\]/g, ctx.phone)
    .replace(/\[담당자\]/g,  ctx.assignedUserName)
    .replace(/\[상품명\]/g,  ctx.cruiseInterest)
    .replace(/\[출발일\]/g,  ctx.departureDate)
    .replace(/\[가격\]/g,    '')
    .replace(/\[출발지\]/g,  '')
    .replace(/\[목적지\]/g,  '')
    .replace(/\[일정\]/g,    '')
    .replace(/\[객실유형\]/g, '');
}

/**
 * POST /api/groups/[id]/blast
 * 그룹 전체에 즉시 SMS 일괄 발송
 *
 * body: { message: string; dryRun?: boolean }
 * dryRun=true → 실제 발송 없이 대상 인원만 반환
 *
 * 권한 규칙:
 * - GLOBAL_ADMIN: 모든 그룹 발송 가능
 * - OWNER(대리점장): 자신의 그룹만 발송 가능
 * - AGENT(판매원): 그룹 발송 불가
 * - FREE_SALES: 접근 불가
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    if (!orgId) {
      logger.error('[GroupBlast] 조직 정보 없음', { userId: ctx?.userId });
      return NextResponse.json({ ok: false, message: '조직 정보 없음. 관리자에게 문의하세요.' }, { status: 403 });
    }
    const { id: groupId } = await params;

    // [P0-1] 역할 기반 권한 검증 (판매원은 단체발송 불가)
    if (ctx.role === "AGENT" || ctx.role === "FREE_SALES") {
      logger.warn('[GroupBlast] 권한 부족', { userId: ctx.userId, role: ctx.role });
      return NextResponse.json({
        ok: false,
        message: '단체 메시지 발송은 관리자와 대리점장만 가능합니다. 자신의 고객 목록에서 개별 발송하세요.',
      }, { status: 403 });
    }

    const { message, dryRun = false, scheduledTime } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, message: '메시지를 입력하세요.' }, { status: 400 });
    }

    const trimmedMsg = message.trim();
    if (trimmedMsg.length > MAX_SMS_LENGTH) {
      return NextResponse.json(
        { ok: false, error: 'MESSAGE_TOO_LONG', message: '메시지는 90자 이내여야 합니다.' },
        { status: 400 }
      );
    }
    if (DISALLOWED_CHARS.test(trimmedMsg)) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_CHARS', message: '사용할 수 없는 문자가 포함되어 있습니다.' },
        { status: 400 }
      );
    }

    // [보안] 그룹 소유권 검증 (IDOR 방지 — 조항 3)
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true, ownerId: true },
    });
    if (!group) {
      return NextResponse.json({ ok: false, message: '그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    // [P0-2] 대리점장의 그룹 발송 권한 검증 (자신의 그룹만 발송 가능)
    if (ctx.role === "OWNER" && group.ownerId && group.ownerId !== ctx.userId) {
      logger.warn('[GroupBlast] 그룹 소유권 불일치', {
        userId: ctx.userId,
        groupOwnerId: group.ownerId,
        groupId,
      });
      return NextResponse.json({
        ok: false,
        message: '다른 사용자의 그룹에는 발송할 수 없습니다.',
      }, { status: 403 });
    }

    const optedOutPhones = await prisma.smsOptOut.findMany({
      select: { phone: true },
    });
    const optedOutPhoneSet = new Set(optedOutPhones.map(o => o.phone));

    const members = await prisma.contactGroupMember.findMany({
      where: {
        groupId,
        contact: {
          organizationId: orgId,
          optOutAt:       null,
          phone:          { not: '' },
        },
      },
      include: {
        contact: {
          select: {
            id:             true,
            name:           true,
            phone:          true,
            assignedUserId: true,
            cruiseInterest: true,
            departureDate:  true,
          },
        },
      },
      take: MAX_RECIPIENTS + 1, // +1로 초과 여부 감지
    });

    // SmsOptOut 테이블에 등록된 번호 필터링
    const filteredMembers = members.filter(m => !optedOutPhoneSet.has(m.contact.phone));

    const totalInGroup = await prisma.contactGroupMember.count({ where: { groupId } });
    const isOverLimit  = filteredMembers.length > MAX_RECIPIENTS;
    const targets      = filteredMembers.slice(0, MAX_RECIPIENTS);
    const blockedByOptOut = members.length - filteredMembers.length;

    logger.log('[GroupBlast] 대상 파악', {
      group:      group.name,
      total:      totalInGroup,
      filtered:   filteredMembers.length,
      blockedByOptOut,
      targets:    targets.length,
      dryRun,
    });

    // dryRun: 실제 발송 없이 인원만 반환 (+ 첫 고객 치환 미리보기)
    if (dryRun) {
      const rlKey = `sms_blast:${ctx.userId || ''}`;
      const rateLimitStatus = getRateLimitStatus(rlKey, SMS_BLAST_MAX_PER_DAY, SMS_BLAST_WINDOW_MS);

      // [C-3] 첫 번째 대상 고객으로 치환된 미리보기 생성
      let sampleMessages: string[] = [];
      const firstTarget = targets[0];
      if (firstTarget) {
        const depStr = firstTarget.contact.departureDate
          ? firstTarget.contact.departureDate.toLocaleDateString('ko-KR', {
              year: 'numeric', month: '2-digit', day: '2-digit',
            })
          : '';
        sampleMessages = [personalizeMessage(trimmedMsg, {
          name:             firstTarget.contact.name,
          phone:            firstTarget.contact.phone,
          assignedUserName: '', // dryRun 시 담당자 조회 생략
          cruiseInterest:   firstTarget.contact.cruiseInterest ?? '',
          departureDate:    depStr,
        })];
      }

      return NextResponse.json({
        ok:          true,
        dryRun:      true,
        groupName:   group.name,
        total:       totalInGroup,
        willSend:    targets.length,
        sampleMessages,
        blockedByOptOut,
        isOverLimit,
        overLimitMsg: isOverLimit
          ? `200명 제한 초과 — 첫 ${MAX_RECIPIENTS}명에게만 발송됩니다.`
          : null,
        rateLimitStatus,
      });
    }

    // [P0-3] 예약발송 처리 (scheduledTime 있으면 ScheduledSms 저장 후 종료)
    if (scheduledTime && !dryRun) {
      const scheduledAt = new Date(scheduledTime);
      if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        return NextResponse.json(
          { ok: false, message: '유효한 미래 시간을 선택하세요.' },
          { status: 400 }
        );
      }
      await prisma.scheduledSms.create({
        data: {
          organizationId:   orgId,
          groupId,
          message:          trimmedMsg,
          scheduledAt,
          status:           'PENDING',
          channel:          'GROUP',
          createdByUserId:  ctx.userId ?? null,
        },
      });
      return NextResponse.json({
        ok:          true,
        scheduled:   true,
        scheduledAt: scheduledAt.toISOString(),
        groupName:   group.name,
        willSend:    targets.length,
      });
    }

    // [T4] Rate limit — 사용자 단위로 체크 (그룹별 우회 방지)
    const userId = ctx.userId || '';
    const rlKey2 = `sms_blast:${userId}`;
    const { allowed } = await checkRateLimitAsync(rlKey2, SMS_BLAST_MAX_PER_DAY, SMS_BLAST_WINDOW_MS);
    if (!allowed) {
      const status = getRateLimitStatus(rlKey2, SMS_BLAST_MAX_PER_DAY, SMS_BLAST_WINDOW_MS);
      return NextResponse.json({
        ok: false,
        message: `하루 발송 횟수(5회)를 초과했습니다. 내일 ${status.resetAt.toLocaleTimeString('ko-KR')}부터 가능합니다.`,
      }, { status: 429 });
    }

    // SMS 발신 계정 해석 (루프 밖, 1회): 개인(UserSmsConfig) > 조직 > 시스템 env.
    // 판매원·대리점장이 자기 알리고를 연결하면 단체발송도 본인 발신번호로 나간다.
    const config = await resolveUserSmsConfig(orgId, userId);
    if (!config) {
      return NextResponse.json({ ok: false, message: 'SMS 설정이 없습니다. 설정 → 문자에서 알리고를 연결하세요.' }, { status: 400 });
    }

    // 담당자 이름 맵 구축 (assignedUserId → displayName)
    // Contact.assignedUserId 는 OrganizationMember.userId 와 동일
    const assignedUserIds = [
      ...new Set(
        targets
          .map(m => m.contact.assignedUserId)
          .filter((uid): uid is string => !!uid)
      ),
    ];
    const assignedUserMap: Record<string, string> = {};
    if (assignedUserIds.length > 0) {
      const orgMembers = await prisma.organizationMember.findMany({
        where: {
          organizationId: orgId,
          userId:         { in: assignedUserIds },
        },
        select: { userId: true, displayName: true },
      });
      for (const om of orgMembers) {
        assignedUserMap[om.userId] = om.displayName ?? '';
      }
    }

    // 10건씩 배치 발송
    let sentCount    = 0;
    let blockedCount = 0;
    let failedCount  = 0;
    const failures: Array<{ phoneNumber: string; reason: string; timestamp: string }> = [];

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (m) => {
          const departureDateStr = m.contact.departureDate
            ? m.contact.departureDate.toLocaleDateString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
              })
            : '';
          const personalizedMsg = personalizeMessage(trimmedMsg, {
            name:             m.contact.name,
            phone:            m.contact.phone,
            assignedUserName: m.contact.assignedUserId
              ? (assignedUserMap[m.contact.assignedUserId] ?? '')
              : '',
            cruiseInterest:   m.contact.cruiseInterest ?? '',
            departureDate:    departureDateStr,
          });

          const result = await sendSms({
            config,
            receiver:       m.contact.phone,
            msg:            personalizedMsg,
            organizationId: orgId,
            contactId:      m.contact.id,
            channel:        'GROUP',
          });

          return {
            phoneNumber: m.contact.phone,
            resultCode: Number(result.result_code),
            resultMsg: result.message,
          };
        })
      );

      // CONS-004: 발송 실패 상세 기록
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
          if (code === 1) {
            sentCount++;
          } else if (code === -99 || code === -98) {
            blockedCount++;
          } else {
            failedCount++;
            failures.push({
              phoneNumber: r.value.phoneNumber,
              reason: `SMS API 오류 (코드: ${code}, 메시지: ${r.value.resultMsg})`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    }

    // 발송 실패 시 상세 로깅
    if (failures.length > 0) {
      logger.warn('[GroupBlastPartialFailure]', {
        group: group.name,
        totalAttempted: targets.length,
        failureCount: failures.length,
        failureRate: `${((failures.length / targets.length) * 100).toFixed(1)}%`,
        failureDetails: failures.slice(0, 10), // 최대 10개만 상세 기록
      });
    }

    logger.log('[GroupBlast] 발송 완료', {
      group: group.name,
      sentCount,
      blockedCount,
      failedCount,
      hasFailures: failures.length > 0,
    });

    return NextResponse.json({
      ok:          true,
      groupName:   group.name,
      sentCount,
      blockedCount,
      failedCount,
      blockedByOptOut,
      total:       targets.length,
      failures: failures.slice(0, 10), // 클라이언트에게도 첫 10개만 반환
    });

  } catch (err) {
    logger.error('[GroupBlast] 처리 실패', { err });
    return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
