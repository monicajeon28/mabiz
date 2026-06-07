import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { sendSms, resolveUserSmsConfig } from '@/lib/aligo';
import { checkRateLimitAsync } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface FamilySmsPayload {
  contactId: string;
  targetRole: 'spouse' | 'parent' | 'friend'; // 누가 받을 SMS?
  day: 0 | 1 | 2 | 3; // Day 0-3 자동화
  useTemplate?: boolean; // 템플릿 사용 여부
}

const SMS_TEMPLATES = {
  spouse: {
    0: {
      variant_a: '안녕하세요 {spouse_name}님! {contact_name}님과 함께 하실 크루즈여행, 정말 좋으시지 않나요? 무료 상담 예약: {link}',
      variant_b: '{spouse_name}님, 이번 크루즈는 {contact_name}님과의 특별한 추억을 만드는 기회입니다. 지금 예약하면 50% 할인! {link}',
    },
    1: {
      variant_a: '{spouse_name}님, 고민 많으신가요? 저희가 모든 불안감을 해결해드립니다. 전문가 상담 예약: {link}',
      variant_b: '많은 부부들이 이 크루즈를 함께 선택합니다. {spouse_name}님도 가족과 행복한 추억을 만들어보세요. {link}',
    },
    2: {
      variant_a: '{spouse_name}님, 이 가격에 이 품질을 제공하는 크루즈는 드뭅니다. 지금이 최적의 기회입니다! {link}',
      variant_b: '가족과의 소중한 시간을 위해 {spouse_name}님의 결정이 필요합니다. 함께 결정해주세요! {link}',
    },
    3: {
      variant_a: '⏰ {spouse_name}님! 예약 마감이 24시간만 남았습니다. 지금 결정하세요! {link}',
      variant_b: '{spouse_name}님의 동의로 {contact_name}님과의 행복한 여행이 시작됩니다. 예약하세요! {link}',
    },
  },
  parent: {
    0: {
      variant_a: '안녕하세요 {parent_name}님! {contact_name}님이 드리는 가족 크루즈 여행 초대입니다. 함께 즐거운 시간을 보내세요! {link}',
      variant_b: '{parent_name}님, {contact_name}님이 선택한 프리미엄 크루즈에 초대합니다. 가족 단합의 기회! {link}',
    },
    1: {
      variant_a: '{parent_name}님, 자녀를 배려하는 마음으로 이 크루즈를 추천드립니다. 건강하고 행복한 추억을 함께 만들어보세요. {link}',
      variant_b: '부모님과의 소중한 시간, {contact_name}님이 준비했습니다. 함께하실래요? {link}',
    },
    2: {
      variant_a: '{parent_name}님, 많은 부모님들이 이 가격에 만족하시고 예약하십니다. 망설이지 마세요! {link}',
      variant_b: '자녀의 효심을 받으시고 행복한 여행을 함께하세요. {parent_name}님의 결정을 기다리고 있습니다! {link}',
    },
    3: {
      variant_a: '⏰ {parent_name}님! 마지막 기회입니다. 지금 함께하시겠습니까? {link}',
      variant_b: '{contact_name}님과의 행복한 크루즈, {parent_name}님의 손길을 기다립니다. 예약하세요! {link}',
    },
  },
  friend: {
    0: {
      variant_a: '안녕하세요 {friend_name}님! {contact_name}님이 함께 할 크루즈여행에 초대합니다. 친구와의 최고의 추억! {link}',
      variant_b: '{friend_name}님, {contact_name}님과 함께하는 특별한 크루즈 여행을 제안합니다. 친구들끼리 가장 즐거워요! {link}',
    },
    1: {
      variant_a: '{friend_name}님, 친구들과 함께하는 여행이 최고의 추억을 만듭니다. 이번 기회를 놓치지 마세요! {link}',
      variant_b: '{friend_name}님도 걱정하세요? 모든 친구들이 겪는 고민입니다. 함께 해결해드립니다. {link}',
    },
    2: {
      variant_a: '{friend_name}님, 이 가격은 정말 특별합니다. 친구들과 함께 공유하세요! {link}',
      variant_b: '친구의 초대가 이번 여행의 핵심입니다. {friend_name}님의 결정을 기다리고 있습니다! {link}',
    },
    3: {
      variant_a: '⏰ {friend_name}님! 최종 확인입니다. 친구들과 함께하시겠습니까? {link}',
      variant_b: '{contact_name}님과 최고의 추억을 만들 마지막 기회입니다. 지금 결정하세요! {link}',
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);
    const { contactId, targetRole, day, useTemplate = true } = await req.json() as FamilySmsPayload;

    if (!contactId || !targetRole || day === undefined) {
      return NextResponse.json(
        { error: 'contactId, targetRole, and day are required' },
        { status: 400 }
      );
    }

    const rlKey = `family_sms:${organizationId}:${contactId}:day${day}`;
    const { allowed } = await checkRateLimitAsync(rlKey, 1, 24 * 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: '이미 발송된 SMS입니다.' }, { status: 429 });
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: {
        id: true,
        name: true,
        phone: true,
        spouseName: true,
        spousePhone: true,
        parentName: true,
        parentPhone: true,
        friendName: true,
        friendPhone: true,
        companionSmsDay0Sent: true,
        companionSmsDay0SentAt: true,
        companionSmsDay1Sent: true,
        companionSmsDay1SentAt: true,
        companionSmsDay2Sent: true,
        companionSmsDay2SentAt: true,
        companionSmsDay3Sent: true,
        companionSmsDay3SentAt: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Determine recipient phone and name
    let recipientPhone = '';
    let recipientName = '';

    if (targetRole === 'spouse') {
      recipientPhone = contact.spousePhone || '';
      recipientName = contact.spouseName || '';
    } else if (targetRole === 'parent') {
      recipientPhone = contact.parentPhone || '';
      recipientName = contact.parentName || '';
    } else if (targetRole === 'friend') {
      recipientPhone = contact.friendPhone || '';
      recipientName = contact.friendName || '';
    }

    if (!recipientPhone) {
      return NextResponse.json(
        { error: '연락처 정보를 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // Get SMS template (A/B variant)
    const templates = SMS_TEMPLATES[targetRole][day];
    const variantKey = Math.random() > 0.5 ? 'variant_a' : 'variant_b';
    let messageTemplate = templates[variantKey];

    // Replace placeholders
    messageTemplate = messageTemplate
      .replace('{contact_name}', contact.name)
      .replace('{spouse_name}', contact.spouseName || '')
      .replace('{parent_name}', contact.parentName || '')
      .replace('{friend_name}', contact.friendName || '')
      .replace('{link}', `${process.env.NEXT_PUBLIC_APP_URL || 'https://mabizcruisedot.com'}/booking/${contactId}`);

    // Update sent flags based on day
    const updateData: any = {};
    if (day === 0) updateData.companionSmsDay0Sent = true;
    if (day === 0) updateData.companionSmsDay0SentAt = new Date();
    if (day === 1) updateData.companionSmsDay1Sent = true;
    if (day === 1) updateData.companionSmsDay1SentAt = new Date();
    if (day === 2) updateData.companionSmsDay2Sent = true;
    if (day === 2) updateData.companionSmsDay2SentAt = new Date();
    if (day === 3) updateData.companionSmsDay3Sent = true;
    if (day === 3) updateData.companionSmsDay3SentAt = new Date();

    await prisma.contact.update({
      where: { id: contactId, organizationId },
      data: updateData,
    });

    // 실제 Aligo SMS 발송
    const smsConfig = await resolveUserSmsConfig(organizationId, String(ctx.userId));
    let smsStatus: 'SENT' | 'FAILED' | 'PENDING' = 'PENDING';
    let msgId: string | null = null;

    if (smsConfig) {
      const aligoResult = await sendSms({
        config: smsConfig,
        receiver: recipientPhone,
        msg: messageTemplate,
        msgType: messageTemplate.length > 90 ? 'LMS' : 'SMS',
        organizationId,
        contactId,
        channel: 'FUNNEL',
      });
      smsStatus = aligoResult.result_code === 1 ? 'SENT' : 'FAILED';
      msgId = aligoResult.msg_id ?? null;
      logger.info('[FamilyPersuasion] Aligo 발송 결과', { result_code: aligoResult.result_code, targetRole, day });
    } else {
      logger.warn('[FamilyPersuasion] SMS 설정 없음 — PENDING 상태로 기록', { organizationId });
    }

    await prisma.smsLog.create({
      data: {
        organizationId,
        contactId,
        phone: recipientPhone,
        contentPreview: messageTemplate.substring(0, 100),
        status: smsStatus,
        channel: 'FAMILY_PERSUASION',
        msgId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${targetRole} 설득 SMS Day ${day} 발송 완료`,
      details: {
        recipientName,
        recipientPhone,
        day,
        targetRole,
        variant: variantKey,
        messagePreview: messageTemplate.substring(0, 100),
      },
    });
  } catch (error) {
    logger.error('[POST /api/sms/family-persuasion]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to send family persuasion SMS' },
      { status: 500 }
    );
  }
}
