import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { checkOrigin } from '@/lib/origin-guard';
import { getCache, setCache } from '@/lib/redis';
import { NotFoundError, RateLimitError, ServerError, B2BError } from '@/lib/b2b/errors';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Params = { params: Promise<{ id: string }> };

/**
 * Claude API 응답 타입 정의
 */
interface ClaudeContent {
  type: 'text' | 'image' | 'tool_use';
  text?: string;
}

/**
 * POST /api/b2b-landing/[id]/comments/generate
 * B2B 교육 프로그램 랜딩페이지용 AI 생성 후기
 *
 * Request: { count: number } — 생성할 댓글 수 (1~10)
 * Response: { ok: true, comments: [...] }
 */
export async function POST(req: Request, { params }: Params) {
  const startTime = Date.now();
  try {
    if (!checkOrigin(req, 'B2BCommentsGenerate')) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // B2B 랜딩페이지 조회 및 소유권 확인
    const page = await prisma.b2BLandingPage.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, title: true, htmlContent: true },
    });
    if (!page) {
      throw new NotFoundError('랜딩페이지');
    }

    // 요청 바디 파싱
    const body = await req.json();
    const count = Math.min(10, Math.max(1, (parseInt(body.count ?? '5') || 5)));

    // [Rate Limiting] 1시간당 5회 제한 (Claude API 비용 폭증 방지)
    // Issue 30: 클라이언트 fingerprint 추가 (IP + User-Agent 해시) — rate limit 우회 방지
    const clientIp = (req.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim() || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const clientFingerprint = crypto
      .createHash('sha256')
      .update(`${clientIp}:${userAgent}`)
      .digest('hex')
      .slice(0, 8);

    const rateLimitKey = `b2b:comments:generate:${orgId}:${id}:${clientFingerprint}`;
    const requestCount = await getCache<number>(rateLimitKey);

    // [ENV] Rate Limit: 시간당 최대 요청 횟수
    const rateLimitMaxCount = parseInt(process.env.RATE_LIMIT_COMMENTS_COUNT || '5');
    if (requestCount !== null && requestCount >= rateLimitMaxCount) {
      logger.warn('[POST /api/b2b-landing/[id]/comments/generate] Rate limit exceeded', {
        landingPageId: id,
        orgId,
        requestCount,
        durationMs: Date.now() - startTime,
      });
      throw new RateLimitError(`시간당 ${rateLimitMaxCount}회 이상 생성할 수 없습니다. (1시간 후 다시 시도)`);
    }

    // [ENV] Rate limit 카운터 증가 (초기: 1, TTL: 환경변수 RATE_LIMIT_TTL_SECONDS)
    const rateLimitTtlSeconds = parseInt(process.env.RATE_LIMIT_TTL_SECONDS || '3600');
    const nextCount = (requestCount ?? 0) + 1;
    await setCache(rateLimitKey, nextCount, rateLimitTtlSeconds);

    // HTML → 텍스트 추출 (태그 제거, 공백 정규화)
    const textContent = (page.htmlContent ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 800);

    // B2B 교육 프로그램 수료자 관점 프롬프트
    const prompt = `당신은 B2B 교육 프로그램 수료자입니다.
마비즈의 B2B 파트너 교육 프로그램에 대해 실제 사업가/담당자 후기처럼 보이는 댓글 ${count}개를 JSON 배열로 생성하세요.

콘텐츠 맥락:
"""
${textContent}
"""

규칙:
- 각 댓글은 {"authorName": "이름", "content": "내용"} 형식
- authorName: 실제 한국 이름 (성씨 + 이름 2~3글자)
- content: 50~120자, 자연스럽고 구체적인 후기
- 교육 효과, 실무 활용, 추천 포함
- 사업가/담당자 입장 (예: "매출이 30% 증가했어요", "실무에 바로 적용 가능하네요")
- 마케팅 문구 같지 않게, 실제 전문가 느낌
- JSON 배열만 반환`;

    // [ENV] Claude API 호출 (모델명: ANTHROPIC_MODEL)
    const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    const apiStartTime = Date.now();
    const message = await anthropic.messages.create({
      model: anthropicModel,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const apiDurationMs = Date.now() - apiStartTime;

    // API 응답에서 텍스트 추출
    const content = message.content[0] as ClaudeContent;
    if (!content || content.type !== 'text' || !content.text) {
      throw new ServerError('Claude 응답 형식 오류: text 타입의 응답이 필요합니다');
    }
    const raw = content.text.trim();

    // JSON 파싱 (배열 추출)
    // Issue 26: JSON 파싱 실패 처리 강화 — 테스트 케이스: 유효하지 않은 JSON, 불완전한 배열
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.error('[POST /api/b2b-landing/[id]/comments/generate] JSON parsing failed - no array found', {
        landingPageId: id,
        orgId,
        requestedCount: count,
        rawLength: raw.length,
        rawSnippet: raw.slice(0, 200),
        durationMs: Date.now() - startTime,
        apiDurationMs,
      });
      return NextResponse.json(
        { ok: false, error: 'PARSE_ERROR', message: 'AI 응답이 유효한 JSON 배열을 포함하지 않습니다' },
        { status: 500 }
      );
    }

    let generated: { authorName: string; content: string }[];
    try {
      generated = JSON.parse(jsonMatch[0]) as { authorName: string; content: string }[];
    } catch (parseErr) {
      logger.error('[POST /api/b2b-landing/[id]/comments/generate] JSON parse error', {
        landingPageId: id,
        orgId,
        requestedCount: count,
        parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
        jsonSnippet: jsonMatch[0].slice(0, 300),
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { ok: false, error: 'PARSE_ERROR', message: 'AI 응답 JSON 파싱 중 오류 발생' },
        { status: 500 }
      );
    }

    // 각 댓글의 필수 필드 검증
    if (!Array.isArray(generated) || generated.length === 0) {
      logger.error('[POST /api/b2b-landing/[id]/comments/generate] Empty or invalid array', {
        landingPageId: id,
        orgId,
        isArray: Array.isArray(generated),
        length: generated?.length ?? 'N/A',
      });
      return NextResponse.json(
        { ok: false, error: 'PARSE_ERROR', message: '생성된 댓글이 없습니다' },
        { status: 500 }
      );
    }

    // 각 댓글의 필수 필드 검증 (authorName, content)
    for (let i = 0; i < generated.length; i++) {
      const comment = generated[i];
      if (!comment.authorName?.trim() || !comment.content?.trim()) {
        logger.error('[POST /api/b2b-landing/[id]/comments/generate] Invalid comment structure', {
          landingPageId: id,
          index: i,
          hasAuthorName: !!comment.authorName?.trim(),
          hasContent: !!comment.content?.trim(),
        });
        return NextResponse.json(
          { ok: false, error: 'PARSE_ERROR', message: `댓글 ${i + 1}의 필드가 불완전합니다 (필수: 이름, 내용)` },
          { status: 500 }
        );
      }
    }

    // 트랜잭션으로 여러 댓글 동시 생성
    const created = await prisma.$transaction(
      generated.map((c) =>
        prisma.b2BLandingComment.create({
          data: {
            landingPageId: page.id,
            authorName: c.authorName,
            content: c.content,
            isAutoGenerated: true,
          },
          select: {
            id: true,
            authorName: true,
            content: true,
            createdAt: true,
          },
        })
      )
    );

    const totalDurationMs = Date.now() - startTime;
    logger.log('[POST /api/b2b-landing/[id]/comments/generate] Success', {
      landingPageId: id,
      orgId,
      requestedCount: count,
      generatedCount: created.length,
      apiDurationMs,
      totalDurationMs,
      tokenUsage: {
        inputTokens: message.usage?.input_tokens || 0,
        outputTokens: message.usage?.output_tokens || 0,
      },
      model: anthropicModel,
    });

    return NextResponse.json({ ok: true, comments: created });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    if (err instanceof B2BError) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[POST /api/b2b-landing/[id]/comments/generate] Error', {
      error: errorMsg,
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('\n') : undefined,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
