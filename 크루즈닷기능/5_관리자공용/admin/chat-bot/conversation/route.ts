export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { askGemini } from '@/lib/gemini';
import { requireAdmin, AdminAuthError } from '@/lib/auth/requireAdmin';

interface ConversationMessage {
  role: 'assistant' | 'user';
  content: string;
}

function buildFlowSummary(currentFlow?: {
  nodes?: Array<{ id: string; type?: string; label?: string; questionType?: string; options?: string[] }>;
  edges?: Array<{ id: string; source: string; target: string }>;
}): string {
  if (!currentFlow || !currentFlow.nodes || currentFlow.nodes.length === 0) {
    return '현재 플로우: (비어 있음)';
  }

  const nodeSummary = currentFlow.nodes
    .map(
      (node, index) =>
        `${index + 1}. ${node.type || 'text'} - ${node.label || '내용 없음'}${node.questionType ? ` (${node.questionType})` : ''
        }${node.options && node.options.length ? ` 옵션: ${node.options.join(', ')}` : ''}`,
    )
    .join('\n');

  const edgeSummary =
    currentFlow.edges && currentFlow.edges.length > 0
      ? `\n연결 정보:\n${currentFlow.edges
        .map((edge) => `- ${edge.source} → ${edge.target}`)
        .join('\n')}`
      : '';

  return `현재 플로우 개요:\n${nodeSummary}${edgeSummary}`;
}

function extractFlowSuggestion(text: string) {
  if (!text) return { message: '', flowSuggestion: null };

  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i);
  let flowSuggestion = null;
  let cleanedText = text;

  if (codeBlockMatch) {
    try {
      flowSuggestion = JSON.parse(codeBlockMatch[1]);
      cleanedText = text.replace(codeBlockMatch[0], '').trim();
    } catch (error) {
      console.warn('[ChatBot Conversation] Failed to parse flow suggestion json:', error);
    }
  }

  return { message: cleanedText.trim(), flowSuggestion };
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const messages: ConversationMessage[] = Array.isArray(body?.messages) ? body.messages : [];

    if (messages.length === 0) {
      return NextResponse.json(
        { ok: false, error: '대화 내용이 필요합니다.' },
        { status: 400 },
      );
    }

    const productCode = body.productCode as string | null;
    const productLabel = body.productLabel as string | null;
    const currentFlow = body.currentFlow;

    const systemPrompt = `당신은 세일즈 퍼널형 크루즈 상담 플로우를 설계하는 전문가입니다.
    
응답 규칙:
1. 반드시 한국어로 따뜻하고 이해하기 쉽게 답변하세요.
2. 사용자에게 다음에 진행할 질문이나 추천을 제안하세요.
3. 새로운 상담 흐름을 제안할 때는 아래 JSON 형식을 코드 블록( \`\`\`json )으로 포함하세요.
4. JSON 예시는 다음과 같습니다:
\`\`\`json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "start",
      "position": { "x": 150, "y": 120 },
      "data": { "label": "시작" }
    }
  ],
  "edges": [
    { "id": "edge-1-2", "source": "node-1", "target": "node-2" }
  ]
}
\`\`\`
5. nodes 배열의 각 항목에는 id, type(start|text|question|condition|ai|action|end), position(x,y) 그리고 data(label, content, questionType, options 등)를 포함해야 합니다.
6. edges는 source/target으로 노드를 연결하세요.
7. JSON 이외의 텍스트 설명도 함께 제공하세요.`;

    const contextParts: string[] = [];
    if (productCode || productLabel) {
      contextParts.push(
        `연결된 상품: ${productLabel || productCode} ${productCode ? `(코드: ${productCode})` : ''
        }`,
      );
    }
    contextParts.push(buildFlowSummary(currentFlow));

    const trimmedMessages = messages.slice(-8).map((message: ConversationMessage) => ({
      role: (message.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: message.content,
    }));

    const promptMessage = {
      role: 'user' as const,
      content: `${systemPrompt}\n\n[컨텍스트]\n${contextParts.join('\n')}\n\n이제 아래 대화를 이어가며 새로운 상담 흐름을 제안하거나 기존 흐름을 개선하세요.`,
    };

    const geminiMessages = [promptMessage, ...trimmedMessages];

    const response = await askGemini(geminiMessages, 0.6);
    const responseText = response.text || '';
    const { message, flowSuggestion } = extractFlowSuggestion(responseText);

    return NextResponse.json({
      ok: true,
      message: message || '새로운 아이디어를 제안했어요.',
      flowSuggestion: flowSuggestion || null,
    });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[ChatBot Conversation API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || '대화형 플로우 생성 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
