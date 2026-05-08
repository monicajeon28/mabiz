import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { resolveGeminiModelName } from '@/lib/ai/geminiModel';

const GUIDE_KEYWORDS = [
  // 크루즈 선사
  { key: 'guide_msc', label: 'MSC 크루즈' },
  { key: 'guide_royal', label: '로얄캐리비안' },
  { key: 'guide_carnival', label: '카니발 크루즈' },
  { key: 'guide_disney', label: '디즈니 크루즈' },
  { key: 'guide_norwegian', label: '노르웨이 크루즈' },
  { key: 'guide_princess', label: '프린세스 크루즈' },
  { key: 'guide_celebrity', label: '셀러브리티 크루즈' },
  // 선내 정보
  { key: 'guide_onboard', label: '선내 활동' },
  { key: 'guide_menu', label: '크루즈 메뉴/음식' },
  { key: 'guide_entertainment', label: '공연/엔터테인먼트' },
  { key: 'guide_health', label: '건강/의료 서비스' },
  { key: 'guide_wifi', label: '인터넷/와이파이' },
  { key: 'guide_shopping', label: '쇼핑 정보' },
  // 실용 팁
  { key: 'guide_port', label: '기항지 정보' },
  { key: 'guide_prepare', label: '탑승 준비' },
  { key: 'guide_boarding', label: '탑승 절차 및 방법' },
  { key: 'guide_checklist', label: '예약 후 체크리스트' },
  { key: 'guide_photos', label: '사진/카메라 팁' },
  { key: 'guide_weather', label: '날씨/복장' },
  { key: 'guide_budget', label: '예산/비용 관리' },
  { key: 'guide_family', label: '가족 여행 팁' },
  { key: 'guide_community', label: '크루즈 소모임 및 커뮤니티' },
  { key: 'guide_after', label: '여행 후 팁' },
];

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error('[admin/bot/generate-answers] GEMINI_API_KEY 없음');
      return NextResponse.json({ error: 'AI 서비스를 사용할 수 없습니다.' }, { status: 500 });
    }

    const model = resolveGeminiModelName();

    const prompt = `당신은 크루즈닷 챗봇의 가이드 답변을 작성하는 전문가입니다.
다음 ${GUIDE_KEYWORDS.length}개 카테고리에 대해 각각 친절하고 실용적인 가이드 답변을 생성해주세요.
모든 답변은 초안 상태(isActive: false)로 관리자 승인을 기다립니다.

[카테고리]
${GUIDE_KEYWORDS.map(k => `- ${k.label}`).join('\n')}

[생성 규칙 - 필수]
1. 각 카테고리별 1개의 자연스러운 사용자 질문 + 100~150자 범위의 답변
2. 답변 길이: 정확히 100자 이상 150자 이하 (필수)
3. 톤: 친절하고 전문적이며 실용적인 조언
4. 내용: 크루즈 여행객이 실제로 원하는 정보 제공

[금지어 - 절대 사용 금지]
- "크달" (크루즈닷 약자로 불가)
- "최저가", "가장 저렴한", "추가 비용" (비용 강조 금지)
- "~할 수 있어요", "~하세요" (과도한 반복)

[양질의 답변 예시]
Q: "MSC 크루즈는 어떤 특징이 있나요?"
A: "MSC는 유럽의 대표 크루즈 선사로 14개 선박을 보유하고 있습니다. 이탈리아 발상지만큼 지중해 항로에 강하며, 다양한 연령층을 위한 프로그램과 현대적인 선박이 특징입니다."
(129자)

Q: "크루즈에서 와이파이를 사용할 수 있나요?"
A: "대부분의 현대 크루즈선에서는 선내 와이파이 서비스를 제공합니다. 탑승객 전원이 이용 가능하지만 속도 제한이 있을 수 있으므로, 중요한 업무가 있다면 선상 인터넷 서비스 업그레이드를 고려해보세요."
(118자)

[JSON 출력 형식 - 정확히 이 형식]
[
  {
    "key": "guide_msc",
    "question": "사용자가 묻는 자연스러운 질문",
    "answer": "100~150자 범위의 친절한 답변"
  },
  {
    "key": "guide_royal",
    "question": "다음 카테고리의 질문",
    "answer": "100~150자 범위의 친절한 답변"
  }
]

[중요 체크]
- 모든 답변이 100자 이상 150자 이하인지 확인
- 금지어가 포함되지 않았는지 확인
- 유효한 JSON 형식으로만 반환`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 4000, // 20+ 카테고리를 위해 증가
        },
      }),
    });

    const data = await res.json();

    if (data.error) {
      logger.error('[admin/bot/generate-answers] Gemini API 오류', {
        error: data.error,
      });
      return NextResponse.json({ error: 'AI 생성 실패' }, { status: 500 });
    }

    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!rawText) {
      logger.error('[admin/bot/generate-answers] Gemini 응답 비어있음');
      return NextResponse.json({ error: 'AI 응답이 비어 있습니다.' }, { status: 500 });
    }

    let jsonArray: Array<{ key: string; question: string; answer: string }> = [];

    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonArray = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 배열을 찾을 수 없습니다.');
      }
    } catch (parseError) {
      logger.warn('[admin/bot/generate-answers] JSON 파싱 실패', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        rawText: rawText.slice(0, 200),
      });
      return NextResponse.json(
        { error: 'AI 응답을 파싱할 수 없습니다.' },
        { status: 422 }
      );
    }

    // 답변 길이 검증 (100~150자)
    const validatedArray = jsonArray.filter(item => {
      if (!item.key || !item.question || !item.answer) {
        return false;
      }
      const answerLength = item.answer.length;
      if (answerLength < 100 || answerLength > 150) {
        logger.warn('[admin/bot/generate-answers] 답변 길이 범위 초과', {
          key: item.key,
          length: answerLength,
          answer: item.answer.slice(0, 50),
        });
        return false;
      }
      return true;
    });

    const created = await Promise.all(
      validatedArray.map(item =>
        prisma.botGuideAnswer.upsert({
          where: { key: item.key },
          update: {
            question: item.question,
            answer: item.answer,
            isActive: false,
          },
          create: {
            key: item.key,
            question: item.question,
            answer: item.answer,
            source: 'ai-generated',
            isActive: false,
          },
        })
      )
    );

    const skippedCount = jsonArray.length - validatedArray.length;

    logger.log('[admin/bot/generate-answers] 초안 생성 완료', {
      count: created.length,
      skipped: skippedCount,
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      message: `${created.length}개 답변 초안이 생성되었습니다.${skippedCount > 0 ? ` (${skippedCount}개 길이 범위 초과로 제외)` : ''}`,
      answers: created,
      stats: {
        total: jsonArray.length,
        created: created.length,
        skipped: skippedCount,
      },
    });
  } catch (error) {
    logger.error('[admin/bot/generate-answers] POST 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: '요청 처리 실패' }, { status: 500 });
  }
}
