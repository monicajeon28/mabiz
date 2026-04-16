import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const pending = await prisma.aiCallLog.findMany({
    where: { analysisStatus: 'PENDING' },
    take: 20,
    orderBy: { uploadedAt: 'asc' },
  });

  let processed = 0;
  for (const call of pending) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `크루즈 골드 멤버십 판매 통화 분석. JSON만 반환.
통화: ${call.rawTextMasked.substring(0, 3000)}

{
  "personaType": "FILIAL_DUTY|NEWLYWEDS|SINGLE_ADVENTURE|RETIRED_LEISURE|PRICE_SENSITIVE",
  "personaConfidence": 0~1,
  "totalScore": 0~15,
  "strengths": ["강점1","강점2"],
  "weaknesses": ["약점1"],
  "objectionTypes": ["가격","시간","신뢰"] 등 감지된 반론,
  "keyPhrases": ["효과적이었던 멘트1","멘트2"]
}`,
        }],
      });

      const raw = (msg.content[0] as { type: string; text: string }).text;
      const result = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>;

      await prisma.$transaction([
        prisma.aiCallLog.update({
          where: { id: call.id },
          data: { analysisStatus: 'DONE', personaType: result.personaType as string ?? null },
        }),
        prisma.aiCallAnalysis.create({
          data: {
            callLogId: call.id,
            personaDetected: (result.personaType as string) ?? 'UNKNOWN',
            personaConfidence: (result.personaConfidence as number) ?? 0,
            scores: { total: Number(result.totalScore ?? 0) } as import('@prisma/client').Prisma.InputJsonValue,
            keyPhrases: (result.keyPhrases as string[]) ?? [],
            strengths: (result.strengths as string[]) ?? [],
            weaknesses: (result.weaknesses as string[]) ?? [],
            objectionTypes: (result.objectionTypes as string[]) ?? [],
            goldValueScore: call.productType === 'GOLD' ? (result.totalScore as number ?? 0) / 15 : null,
          },
        }),
      ]);
      processed++;
    } catch (e) {
      await prisma.aiCallLog.update({
        where: { id: call.id },
        data: { analysisStatus: 'ERROR' },
      }).catch(() => {});
      logger.log('[AnalyzeCalls] 분석 실패', { id: call.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  logger.log('[AnalyzeCalls] 배치 완료', { processed, total: pending.length });
  return NextResponse.json({ ok: true, processed });
}
