import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logVisitToken } from '@/lib/visit-token';
import { getABTestVariant, selectABVariant } from '@/lib/link-tracking';

type Params = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Params) {
  const { code } = await params;

  // URL에서 고객 ID 추출 (?c=contactId)
  const reqUrl = new URL(req.url);
  const paramContactId = reqUrl.searchParams.get('c') ?? null;

  // visitToken 로깅 (쿠키에서 읽기)
  const cookieHeader = req.headers.get('cookie') ?? '';
  const vtMatch = cookieHeader.match(/visitToken=([^;]+)/);
  const existingVt = vtMatch?.[1] ?? null;
  logVisitToken(existingVt, 'ShortLink').catch(() => {});

  const link = await prisma.shortLink.findUnique({
    where: { code, isActive: true },
    select: { id: true, targetUrl: true, contactId: true, autoGroupId: true, organizationId: true },
  }).catch(() => null);

  if (!link) {
    return NextResponse.redirect('https://www.cruisedot.co.kr');
  }

  // ✅ A/B 테스트 확인
  let targetUrl = link.targetUrl;
  let variant: "A" | "B" | null = null;
  let abTestId: string | null = null;

  // 이 링크가 B 변형인가?
  const testAsB = await prisma.shortLinkABTest.findFirst({
    where: { variantB_id: link.id, status: "ACTIVE" }
  }).catch(() => null);

  if (testAsB) {
    // 테스트 중인 링크 (B 변형)
    variant = selectABVariant();
    abTestId = testAsB.id;

    if (variant === "B") {
      // B 링크니까 그냥 link.targetUrl 사용
      targetUrl = link.targetUrl;
    } else {
      // A 링크로 분산
      const variantA = await prisma.shortLink.findUnique({
        where: { id: testAsB.variantA_id }
      }).catch(() => null);
      targetUrl = variantA?.targetUrl || link.targetUrl;
    }
  } else {
    // 이 링크가 A 변형인가?
    const testAsA = await prisma.shortLinkABTest.findFirst({
      where: { variantA_id: link.id, status: "ACTIVE" }
    }).catch(() => null);

    if (testAsA) {
      variant = selectABVariant();
      abTestId = testAsA.id;

      if (variant === "A") {
        // A 링크니까 그냥 link.targetUrl 사용
        targetUrl = link.targetUrl;
      } else {
        // B 링크로 분산
        const variantB = await prisma.shortLink.findUnique({
          where: { id: testAsA.variantB_id }
        }).catch(() => null);
        targetUrl = variantB?.targetUrl || link.targetUrl;
      }
    }
  }

  // 클릭 기록 + 카운트 증가 (fire-and-forget)
  prisma.$transaction([
    prisma.shortLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    }),
    prisma.shortLinkClick.create({
      data: {
        linkId:    link.id,
        contactId: paramContactId ?? link.contactId ?? null,
        userAgent: req.headers.get('user-agent')?.substring(0, 200) ?? null,
        variant: variant || null,  // A/B 테스트 변형 추적
      },
    }),
  ]).catch((e) => logger.log('[ShortLink] 클릭 기록 실패', { code, error: e instanceof Error ? e.message : String(e) }));

  // 클릭 시 그룹 자동 배정 (contactId + autoGroupId 있을 때)
  if (link.contactId && link.autoGroupId) {
    const { triggerGroupFunnel } = await import('@/lib/funnel-trigger');
    prisma.contact.update({
      where: { id: link.contactId },
      data: { groups: { connect: { id: link.autoGroupId } } },
    }).then(() =>
      triggerGroupFunnel({ contactId: link.contactId!, groupId: link.autoGroupId!, organizationId: link.organizationId })
    ).catch((e) => logger.log('[ShortLink] 그룹 배정 실패', { error: e instanceof Error ? e.message : String(e) }));
  }

  logger.log('[ShortLink] 클릭', { code, contactId: link.contactId ?? '없음', variant, abTestId });
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:') {
      return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 302 });
    }
  } catch {
    return NextResponse.redirect('https://www.cruisedot.co.kr', { status: 302 });
  }
  const response = NextResponse.redirect(targetUrl, { status: 302 });
  // visitToken 쿠키 설정 (24시간 유효)
  response.cookies.set('visitToken', link.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  });
  return response;
}
