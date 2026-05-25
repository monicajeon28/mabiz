/**
 * POST /api/sms/reactivation-campaign
 * 부재중 고객 재활성화 SMS 캠페인 발송
 *
 * Request Body:
 * {
 *   customerIds: string[],
 *   dayIndex: 0 | 1 | 2 | 3,
 *   variant: "A" | "B",
 *   segment: "3-6m" | "6-12m" | "1y+"
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   sent: number,
 *   failed: number,
 *   estimatedConversion: number,
 *   executedAt: ISO string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { getTemplate, interpolateTemplate } from '@/lib/sms/reactivation-templates';

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const body = await request.json();
    const { customerIds = [], dayIndex = 0, variant = 'A', segment = 'all' } = body;

    // 입력값 검증
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: 'customerIds must be a non-empty array' },
        { status: 400 },
      );
    }

    if (![0, 1, 2, 3].includes(dayIndex)) {
      return NextResponse.json(
        { error: 'dayIndex must be 0, 1, 2, or 3' },
        { status: 400 },
      );
    }

    if (!['A', 'B'].includes(variant)) {
      return NextResponse.json(
        { error: 'variant must be A or B' },
        { status: 400 },
      );
    }

    // SMS 템플릿 선택
    const template = getTemplate(dayIndex as 0 | 1 | 2 | 3, variant as 'A' | 'B');

    // 고객 정보 조회
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: customerIds },
        organizationId: organizationId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        lastCruiseDate: true,
        reactivationSegment: true,
        reactivationLikelihood: true,
      },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found' },
        { status: 400 },
      );
    }

    // SMS 발송 로직 (트랜잭션)
    const results = await Promise.allSettled(
      contacts.map(async (contact) => {
        // SMS 콘텐츠 생성
        const months = getMonthsInactive(contact.lastCruiseDate);
        const smsContent = interpolateTemplate(template, {
          customerName: contact.name,
          monthsAgo: months,
        });

        // SMS 발송 (실제 SMS 발송 로직은 별도 서비스 사용)
        // 여기서는 데이터베이스에 기록만 함
        const dayField = `smsDay${dayIndex}Sent`;
        const dayFieldAt = `smsDay${dayIndex}SentAt`;

        const updateData: any = {
          [dayField]: true,
          [dayFieldAt]: new Date(),
        };

        // SMS 이력 저장
        await prisma.smsLog.create({
          data: {
            organizationId: organizationId,
            contactId: contact.id,
            phone: contact.phone,
            contentPreview: smsContent.substring(0, 100),
            status: 'PENDING', // 실제 발송은 비동기로 처리
            channel: 'REACTIVATION_L0',
          },
        });

        // Contact 업데이트
        await prisma.contact.update({
          where: { id: contact.id },
          data: updateData,
        });

        return { contactId: contact.id, success: true };
      }),
    );

    // 발송 결과 집계
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // 예상 전환율 계산
    const avgLikelihood = contacts.reduce((sum, c) => sum + (c.reactivationLikelihood || 0), 0) / contacts.length;
    const estimatedConversion = Math.round(30 + (avgLikelihood / 100) * 65);

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: contacts.length,
      dayIndex,
      variant,
      estimatedConversion,
      estimatedRevenue: Math.round(sent * 0.65 * 1299), // 65% 전환율, $1299 평균
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to send reactivation campaign:', error);
    return NextResponse.json(
      { error: 'Failed to send campaign' },
      { status: 500 },
    );
  }
}

/**
 * 마지막 크루즈 이후 경과 개월 계산
 */
function getMonthsInactive(lastCruiseDate: Date | null): number {
  if (!lastCruiseDate) return 12;

  const now = new Date();
  const months = Math.floor(
    (now.getTime() - lastCruiseDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );

  return Math.max(months, 0);
}
