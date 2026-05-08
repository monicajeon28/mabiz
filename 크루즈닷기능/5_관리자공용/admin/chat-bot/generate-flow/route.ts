export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/generate-flow/route.ts
// AI로 플로우 자동 생성 API

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User?.role === 'admin';
  } catch (error) {
    console.error('[Generate Flow] Auth check error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { prompt } = await req.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { ok: false, error: '플로우 설명을 입력해주세요.' },
        { status: 400 }
      );
    }

    // Gemini API 키 확인
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Gemini API 키가 설정되어 있지 않습니다. 환경 변수 GEMINI_API_KEY를 설정해주세요.' },
        { status: 500 }
      );
    }

    // askGemini는 모듈 로드 시 GEMINI_API_KEY가 없으면 에러를 던지므로, 동적으로 import
    let askGemini;
    try {
      const geminiModule = await import('@/lib/gemini');
      askGemini = geminiModule.askGemini;
    } catch (error: any) {
      if (error.message?.includes('Missing GEMINI_API_KEY')) {
        return NextResponse.json(
          { ok: false, error: 'Gemini API 키가 설정되어 있지 않습니다. 환경 변수 GEMINI_API_KEY를 설정해주세요.' },
          { status: 500 }
        );
      }
      throw error;
    }

    // AI에게 플로우 생성 요청
    const systemPrompt = `당신은 채팅봇 플로우 설계 전문가입니다. 사용자의 요구사항을 바탕으로 타입봇 스타일의 완전하고 실용적인 플로우를 JSON 형식으로 생성해주세요.

**중요 규칙:**
1. 반드시 시작 노드(start)와 종료 노드(end)를 포함해야 합니다
2. 모든 노드는 시작 노드에서 연결되어야 하고, 최종적으로 종료 노드에 연결되어야 합니다
3. 각 노드는 적절한 위치(position)를 가져야 합니다 (x, y 좌표, 겹치지 않도록 간격 유지)
4. 모든 노드는 적절한 엣지(edges)로 연결되어야 합니다

**노드 타입 설명:**
- **start**: 시작 노드 (항상 하나만, 플로우의 시작점)
  - data: { "label": "시작" }
  
- **text**: 텍스트 메시지 노드 (사용자에게 안내 메시지 표시)
  - data: { "label": "텍스트 메시지", "content": "표시할 메시지 내용" }
  
- **question**: 질문 노드 (사용자에게 질문하고 선택지를 제공)
  - data: { 
      "label": "질문", 
      "content": "질문 내용", 
      "questionType": "single" (또는 "multiple", "text"),
      "options": ["선택지1", "선택지2", ...]
    }
  
- **condition**: 조건 분기 노드 (조건에 따라 다른 경로로 이동)
  - data: { 
      "label": "조건 분기", 
      "condition": "조건식 (예: budget > 1000000)",
      "trueLabel": "참일 때 라벨 (선택)",
      "falseLabel": "거짓일 때 라벨 (선택)"
    }
  - 참일 때는 왼쪽 핸들(source Left), 거짓일 때는 오른쪽 핸들(source Right)로 연결
  
- **ai**: AI 응답 노드 (AI가 동적으로 응답 생성)
  - data: { "label": "AI 응답", "content": "AI 프롬프트 내용" }
  
- **action**: 액션 노드 (리다이렉트, 변수 설정, API 호출 등)
  - data: { 
      "label": "액션", 
      "actionType": "redirect" (또는 "variable", "api"),
      "actionValue": "액션 값"
    }
  
- **end**: 종료 노드 (플로우 종료 지점)
  - data: { "label": "종료" }

**위치 배치 규칙:**
- 시작 노드: x: 250, y: 50
- 다음 노드들은 y축으로 150-200px 간격으로 배치
- 같은 레벨의 노드들은 x축으로 300-400px 간격으로 배치

**엣지 연결 규칙:**
- source 노드 ID와 target 노드 ID를 명확히 지정
- 모든 노드는 다음 노드로 연결되어야 함
- 조건 분기 노드는 두 개의 엣지가 필요 (참/거짓)

**응답 형식 (반드시 JSON만 반환):**
{
  "name": "플로우 이름 (사용자 요구사항을 반영한 명확한 이름)",
  "nodes": [
    {
      "id": "node-start",
      "type": "start",
      "position": { "x": 250, "y": 50 },
      "data": { "label": "시작" }
    },
    {
      "id": "node-text-1",
      "type": "text",
      "position": { "x": 250, "y": 200 },
      "data": {
        "label": "텍스트 메시지",
        "content": "안녕하세요! 크루즈 여행을 도와드리겠습니다."
      }
    },
    {
      "id": "node-question-1",
      "type": "question",
      "position": { "x": 250, "y": 400 },
      "data": {
        "label": "질문",
        "content": "어떤 크루즈 여행을 원하시나요?",
        "questionType": "single",
        "options": ["유럽 크루즈", "동남아시아 크루즈", "일본 크루즈"]
      }
    },
    {
      "id": "node-end",
      "type": "end",
      "position": { "x": 250, "y": 600 },
      "data": { "label": "종료" }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-start",
      "target": "node-text-1"
    },
    {
      "id": "edge-2",
      "source": "node-text-1",
      "target": "node-question-1"
    },
    {
      "id": "edge-3",
      "source": "node-question-1",
      "target": "node-end"
    }
  ]
}

**중요:**
- 반드시 완전한 플로우를 생성해야 합니다 (시작 → 중간 노드들 → 종료)
- 모든 노드가 연결되어야 합니다
- 실제로 동작하는 의미 있는 플로우를 만들어야 합니다
- 한국어로 자연스럽고 사용자 친화적인 메시지를 작성하세요
- 응답은 반드시 유효한 JSON 형식이어야 하며, 설명이나 추가 텍스트 없이 JSON만 반환하세요`;

    const messages = [
      {
        role: 'user' as const,
        content: `${systemPrompt}\n\n사용자 요구사항: ${prompt}`,
      },
    ];

    const response = await askGemini(messages, 0.5); // temperature를 낮춰서 더 일관된 결과 생성
    const responseText = response.text || '';

    console.log('[Generate Flow] AI Response:', responseText.substring(0, 500));

    // JSON 추출 시도 (여러 패턴 시도)
    let flowData;
    try {
      let jsonText = '';
      
      // 1. JSON 코드 블록 추출
      const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/i) || 
                             responseText.match(/```\s*([\s\S]*?)\s*```/);
      
      if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1].trim();
      } else {
        // 2. JSON 객체 직접 찾기
        const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonText = jsonObjectMatch[0];
        } else {
          // 3. 전체 텍스트 시도
          jsonText = responseText.trim();
        }
      }

      // JSON 파싱
      flowData = JSON.parse(jsonText);
      
      // 기본 구조 검증
      if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
        throw new Error('nodes 배열이 없습니다.');
      }
      if (!flowData.edges || !Array.isArray(flowData.edges)) {
        throw new Error('edges 배열이 없습니다.');
      }
      
      console.log('[Generate Flow] Parsed successfully:', {
        name: flowData.name,
        nodeCount: flowData.nodes.length,
        edgeCount: flowData.edges.length,
      });
      
    } catch (parseError: any) {
      console.error('[Generate Flow] JSON 파싱 실패:', parseError);
      console.error('[Generate Flow] Response text:', responseText);
      
      // JSON 파싱 실패 시 더 상세한 기본 플로우 생성
      const safeName = prompt.substring(0, 50) || '새 플로우';
      flowData = {
        name: safeName,
        nodes: [
          {
            id: 'node-start',
            type: 'start',
            position: { x: 250, y: 50 },
            data: { label: '시작' },
          },
          {
            id: 'node-text-1',
            type: 'text',
            position: { x: 250, y: 200 },
            data: {
              label: '텍스트 메시지',
              content: '안녕하세요! 크루즈 여행을 도와드리겠습니다.',
            },
          },
          {
            id: 'node-question-1',
            type: 'question',
            position: { x: 250, y: 400 },
            data: {
              label: '질문',
              content: '어떤 크루즈 여행을 원하시나요?',
              questionType: 'single',
              options: ['유럽', '동남아시아', '일본'],
            },
          },
          {
            id: 'node-end',
            type: 'end',
            position: { x: 250, y: 600 },
            data: { label: '종료' },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-start',
            target: 'node-text-1',
          },
          {
            id: 'edge-2',
            source: 'node-text-1',
            target: 'node-question-1',
          },
          {
            id: 'edge-3',
            source: 'node-question-1',
            target: 'node-end',
          },
        ],
      };
    }

    // 노드 ID에 타임스탬프 추가하여 고유성 보장 및 검증
    const timestamp = Date.now();
    const nodes = (flowData.nodes || []).map((node: any, idx: number) => ({
      ...node,
      id: node.id || `node-${timestamp}-${idx}`,
      type: node.type || 'text',
      position: node.position || { x: 250, y: 50 + idx * 150 },
      data: node.data || { label: node.type || '노드' },
    }));

    // 엣지 검증 및 수정 (존재하지 않는 노드 참조 제거)
    const validNodeIds = new Set(nodes.map((n: any) => n.id));
    const edges = (flowData.edges || [])
      .filter((edge: any) => {
        const isValid = validNodeIds.has(edge.source) && validNodeIds.has(edge.target);
        if (!isValid) {
          console.warn(`[Generate Flow] Invalid edge removed: ${edge.source} -> ${edge.target}`);
        }
        return isValid;
      })
      .map((edge: any, idx: number) => ({
        ...edge,
        id: edge.id || `edge-${timestamp}-${idx}`,
      }));

    // 모든 노드가 연결되도록 기본 엣지 추가 (엣지가 없거나 부족한 경우)
    if (edges.length === 0 && nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-${timestamp}-${i}`,
          source: nodes[i].id,
          target: nodes[i + 1].id,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      name: flowData.name || prompt.substring(0, 50),
      nodes,
      edges,
    });
  } catch (error: any) {
    console.error('[Generate Flow API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '플로우 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
