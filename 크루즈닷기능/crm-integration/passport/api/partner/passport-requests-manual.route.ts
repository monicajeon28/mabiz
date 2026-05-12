export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_PASSPORT_TEMPLATE_BODY,
  buildPassportLink,
  fillTemplate,
  sanitizeLegacyTemplateBody,
} from '@/app/api/admin/passport-request/_utils';
import { requirePartnerContext } from '@/app/api/partner/_utils';

const DEFAULT_EXPIRES_HOURS = 72;

type TemplateSelect = {
  id: number;
  title: string;
  body: string;
  isDefault: boolean;
};

type ManualRequestBody = {
  leadId?: number;
  templateId?: number;
  messageBody?: string;
  expiresInHours?: number;
};

function generateToken() {
  // 16바이트로 줄여서 base62 인코딩 시 약 22자 정도로 짧게 만듦
  return randomBytes(16).toString('hex');
}

function clampExpires(hours?: number) {
  if (!hours || Number.isNaN(hours)) return DEFAULT_EXPIRES_HOURS;
  return Math.max(1, Math.min(hours, 24 * 14));
}

function formatDate(value: Date | null | undefined) {
  if (!value) return '';
  return value.toISOString().split('T')[0];
}

async function getTemplate(templateId?: number): Promise<TemplateSelect> {
  if (templateId) {
    const template = await prisma.passportRequestTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        title: true,
        body: true,
        isDefault: true,
      },
    });
    if (template) {
      const sanitizedBody = sanitizeLegacyTemplateBody(template.body);
      if (sanitizedBody !== template.body) {
        await prisma.passportRequestTemplate.update({
          where: { id: template.id },
          data: { body: sanitizedBody },
        });
        return { ...template, body: sanitizedBody };
      }
      return template;
    }
  }

  let template = await prisma.passportRequestTemplate.findFirst({
    where: { isDefault: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      body: true,
      isDefault: true,
    },
  });

  if (!template) {
    template = await prisma.passportRequestTemplate.create({
      data: {
        title: '여권 제출 안내',
        body: DEFAULT_PASSPORT_TEMPLATE_BODY,
        isDefault: true,
      },
      select: {
        id: true,
        title: true,
        body: true,
        isDefault: true,
      },
    });
  }

  const sanitizedBody = sanitizeLegacyTemplateBody(template.body);
  if (sanitizedBody !== template.body) {
    await prisma.passportRequestTemplate.update({
      where: { id: template.id },
      data: { body: sanitizedBody },
    });
    return { ...template, body: sanitizedBody };
  }

  return template;
}

async function upsertSubmission(params: {
  userId: number;
  tripId: number | null;
  token: string;
  tokenExpiresAt: Date;
}) {
  const { userId, tripId, token, tokenExpiresAt } = params;
  const existingSubmission = await prisma.passportSubmission.findFirst({
    where: { userId, isSubmitted: false },
    orderBy: { createdAt: 'desc' },
  });

  if (existingSubmission) {
    const updated = await prisma.passportSubmission.update({
      where: { id: existingSubmission.id },
      data: {
        token,
        tokenExpiresAt,
        tripId: tripId ?? existingSubmission.tripId,
        isSubmitted: false,
        updatedAt: new Date(),
        extraData: Prisma.JsonNull,
      },
    });
    return updated.id;
  }

  const now = new Date();
  const createData: any = {
    User: { connect: { id: userId } },
    token,
    tokenExpiresAt,
    isSubmitted: false,
    driveFolderUrl: null,
    extraData: Prisma.JsonNull,
    updatedAt: now,
  };
  
  if (tripId) {
    createData.UserTrip = { connect: { id: tripId } };
  }
  
  const created = await prisma.passportSubmission.create({
    data: createData,
  });
  return created.id;
}

async function recordManualLog(params: {
  userId: number;
  adminId: number;
  templateId: number | null;
  messageBody: string;
}) {
  const { userId, adminId, templateId, messageBody } = params;
  try {
    await prisma.passportRequestLog.create({
      data: {
        userId,
        adminId,
        templateId,
        messageBody,
        messageChannel: 'MANUAL_COPY',
        status: 'MANUAL',
        errorReason: null,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[PartnerPassportManual] Failed to insert log:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionUser, profile } = await requirePartnerContext();
    const body: ManualRequestBody = await req.json();

    if (!body.leadId || Number.isNaN(body.leadId)) {
      return NextResponse.json({ ok: false, message: 'leadId가 필요합니다.' }, { status: 400 });
    }

    const lead = await prisma.affiliateLead.findFirst({
      where: {
        id: body.leadId,
        OR: [{ managerId: profile.id }, { agentId: profile.id }],
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        Product: {
          select: {
            packageName: true,
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, message: '고객 정보를 찾을 수 없거나 접근 권한이 없습니다.' },
        { status: 404 },
      );
    }

    if (!lead.User) {
      return NextResponse.json(
        { ok: false, message: '해당 고객은 아직 회원 정보와 연결되지 않았습니다.' },
        { status: 400 },
      );
    }

    const expiresInHours = clampExpires(body.expiresInHours);
    const template = await getTemplate(body.templateId);
    const baseMessage =
      body.messageBody?.trim() || sanitizeLegacyTemplateBody(template.body) || DEFAULT_PASSPORT_TEMPLATE_BODY;

    if (!baseMessage) {
      return NextResponse.json({ ok: false, message: '메시지 내용을 입력해주세요.' }, { status: 400 });
    }

    const user = lead.User;
    const token = generateToken();
    const tokenExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const link = buildPassportLink(token);

    const personalizedMessage = fillTemplate(baseMessage, {
      고객명: (lead.customerName || user.name || '고객') + '님',
      링크: link,
      상품명: lead.Product?.packageName ?? '',
      출발일: formatDate(lead.passportRequestedAt ?? lead.createdAt),
    });

    const submissionId = await upsertSubmission({
      userId: user.id,
      tripId: null,
      token,
      tokenExpiresAt,
    });

    await prisma.affiliateLead.update({
      where: { id: lead.id },
      data: {
        passportRequestedAt: new Date(),
      },
    });

    await recordManualLog({
      userId: user.id,
      adminId: sessionUser.id,
      templateId: template.id,
      messageBody: personalizedMessage,
    });

    return NextResponse.json({
      ok: true,
      result: {
        leadId: lead.id,
        submissionId,
        link,
        token,
        message: personalizedMessage,
        expiresAt: tokenExpiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[PartnerPassportManual] POST error:', error);
    return NextResponse.json(
      { ok: false, message: '여권 제출 링크를 생성하는 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
