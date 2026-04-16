import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
const PERSONAS = ['FILIAL_DUTY','NEWLYWEDS','SINGLE_ADVENTURE','RETIRED_LEISURE','PRICE_SENSITIVE'];

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('organizationId');
  if (!orgId) return NextResponse.json({ ok: false, message: 'organizationId 필수' }, { status: 400 });

  let extracted = 0;

  for (const persona of PERSONAS) {
    const successCalls = await prisma.aiCallLog.findMany({
      where: { organizationId: orgId, personaType: persona, converted: true, analysisStatus: 'DONE' },
      include: { analysis: true },
      take: 50,
      orderBy: { uploadedAt: 'desc' },
    });

    if (successCalls.length < 10) continue; // 최소 10건 이상일 때만 추출

    const allPhrases = successCalls
      .flatMap((c) => (c.analysis?.keyPhrases as string[]) ?? [])
      .slice(0, 100)
      .join('\n');

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `크루즈 골드 멤버십 ${persona} 페르소나 성공 통화 핵심 패턴 추출.
아래 성공 멘트들에서 가장 효과적인 패턴 5개를 추출하라. JSON 배열만 반환.

멘트 목록:
${allPhrases}

[
  {
    "category": "OPENING|EMPATHY|VALUE|OBJECTION|CLOSING",
    "objectionType": "가격|시간|신뢰|가족반대|null",
    "patternText": "실제로 쓸 수 있는 구체적 멘트",
    "why": "왜 이게 효과적인가 한 줄"
  }
]`,
        }],
      });

      const raw = (msg.content[0] as { type: string; text: string }).text;
      const patterns = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as Array<{
        category: string; objectionType?: string; patternText: string; why?: string;
      }>;

      for (const p of patterns) {
        const created = await prisma.scriptPattern.create({
          data: {
            organizationId: orgId,
            productType: 'GOLD',
            personaType: persona,
            category: p.category ?? 'VALUE',
            objectionType: p.objectionType ?? null,
            patternText: p.patternText ?? '',
            exampleCall: p.why ?? null,
            status: 'DRAFT',
          },
        }).catch((e) => {
          logger.log('[ExtractPatterns] 패턴 저장 실패', { error: e instanceof Error ? e.message : String(e) });
          return null;
        });
        if (created) extracted++;
      }
    } catch (e) {
      logger.log('[ExtractPatterns] 추출 실패', { persona, error: e instanceof Error ? e.message : String(e) });
    }
  }

  logger.log('[ExtractPatterns] 완료', { extracted });
  return NextResponse.json({ ok: true, extracted });
}
