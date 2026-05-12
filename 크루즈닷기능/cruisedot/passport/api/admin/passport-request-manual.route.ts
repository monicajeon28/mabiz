export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_PASSPORT_TEMPLATE_BODY,
  requireAdminUser,
  buildPassportLink,
  fillTemplate,
  sanitizeLegacyTemplateBody,
} from '../_utils';

const DEFAULT_EXPIRES_HOURS = 72;

type TemplateSelect = {
  id: number;
  title: string;
  body: string;
  isDefault: boolean;
};

type ManualRequestBody = {
  userId: number;
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
    console.error('[AdminPassportManual] Failed to insert log:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 403 }
      );
    }

    const body: ManualRequestBody = await req.json();

    if (!body.userId || Number.isNaN(body.userId)) {
      return NextResponse.json({ ok: false, message: 'userId가 필요합니다.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: '고객 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // User의 최신 여행 정보 조회 (파트너 대시보드와 동일하게)
    const latestTrip = await prisma.userTrip.findFirst({
      where: { userId: user.id },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        cruiseName: true,
        startDate: true,
      },
    });

    const expiresInHours = clampExpires(body.expiresInHours);
    const template = await getTemplate(body.templateId);
    const baseMessage =
      body.messageBody?.trim() || sanitizeLegacyTemplateBody(template.body) || DEFAULT_PASSPORT_TEMPLATE_BODY;

    if (!baseMessage) {
      return NextResponse.json({ ok: false, message: '메시지 내용을 입력해주세요.' }, { status: 400 });
    }

    const token = generateToken();
    const tokenExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const link = buildPassportLink(token);

    // 파트너 대시보드와 동일한 방식으로 템플릿 변수 채우기
    const personalizedMessage = fillTemplate(baseMessage, {
      고객명: (user.name || '고객') + '님',
      링크: link,
      상품명: latestTrip?.cruiseName ?? '',
      출발일: latestTrip?.startDate ? formatDate(latestTrip.startDate) : '',
    });

    const submissionId = await upsertSubmission({
      userId: user.id,
      tripId: latestTrip?.id ?? null,
      token,
      tokenExpiresAt,
    });

    await recordManualLog({
      userId: user.id,
      adminId: admin.id,
      templateId: template.id,
      messageBody: personalizedMessage,
    });

    return NextResponse.json({
      ok: true,
      result: {
        userId: user.id,
        submissionId,
        link,
        token,
        message: personalizedMessage,
        expiresAt: tokenExpiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[AdminPassportManual] POST error:', error);
    console.error('[AdminPassportManual] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      { 
        ok: false, 
        message: '여권 제출 링크를 생성하는 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined,
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.stack : undefined)
          : undefined,
      },
      { status: 500 }
    );
  }
}
