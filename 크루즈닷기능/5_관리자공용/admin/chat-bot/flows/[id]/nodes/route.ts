export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/flows/[id]/nodes/route.ts
// 플로우의 노드와 엣지를 질문으로 변환하여 저장

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params; const flowId = parseInt(idStr);
    const { nodes, edges } = await req.json();

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json(
        { ok: false, error: '노드 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 플로우 존재 확인
    const flow = await prisma.chatBotFlow.findUnique({
      where: { id: flowId },
    });

    if (!flow) {
      return NextResponse.json(
        { ok: false, error: '플로우를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 기존 질문 삭제
    await prisma.chatBotQuestion.deleteMany({
      where: { flowId },
    });

    // 시작 노드 찾기
    const startNode = nodes.find((n: any) => n.type === 'start');
    if (!startNode) {
      return NextResponse.json(
        { ok: false, error: '시작 노드가 필요합니다.' },
        { status: 400 }
      );
    }

    // 노드를 질문으로 변환하여 저장
    const nodeToQuestionMap = new Map<number, string>(); // questionId -> nodeId
    const questionToNodeMap = new Map<string, number>(); // nodeId -> questionId

    // 노드를 순서대로 처리
    const sortedNodes = [...nodes].sort((a, b) => {
      // start 노드는 맨 앞
      if (a.type === 'start') return -1;
      if (b.type === 'start') return 1;
      // end 노드는 맨 뒤
      if (a.type === 'end') return 1;
      if (b.type === 'end') return -1;
      return 0;
    });

    let order = 0;
    for (const node of sortedNodes) {
      if (node.type === 'start' || node.type === 'end') {
        // 시작/종료 노드는 질문으로 저장하지 않음
        continue;
      }

      order++;
      const questionData: any = {
        flowId,
        questionText: node.data.content || node.data.label || '',
        questionType: node.type === 'question' ? 'choice' : 'info',
        order,
        isActive: true,
      };

      // 질문 노드인 경우 선택지 처리
      if (node.type === 'question') {
        const options = node.data.options || [];
        if (options.length >= 1) {
          questionData.optionA = options[0];
        }
        if (options.length >= 2) {
          questionData.optionB = options[1];
        }
        // SPIN 타입은 나중에 설정 가능
      }

      // 정보 제공 노드인 경우
      if (node.type === 'text' || node.type === 'ai') {
        questionData.information = node.data.content || '';
      }

      const question = await prisma.chatBotQuestion.create({
        data: questionData,
      });

      questionToNodeMap.set(node.id, question.id);
      nodeToQuestionMap.set(question.id, node.id);
    }

    // 엣지를 기반으로 다음 질문 연결 설정
    for (const edge of edges || []) {
      const sourceNodeId = edge.source;
      const targetNodeId = edge.target;

      // 시작 노드에서 나가는 엣지는 startQuestionId로 설정
      const sourceNode = nodes.find((n: any) => n.id === sourceNodeId);
      if (sourceNode && sourceNode.type === 'start') {
        const targetQuestionId = questionToNodeMap.get(targetNodeId);
        if (targetQuestionId) {
          await prisma.chatBotFlow.update({
            where: { id: flowId },
            data: { startQuestionId: targetQuestionId },
          });
        }
        continue;
      }

      // 일반 노드 간 연결
      const sourceQuestionId = questionToNodeMap.get(sourceNodeId);
      const targetQuestionId = questionToNodeMap.get(targetNodeId);

      if (sourceQuestionId && targetQuestionId) {
        const sourceQuestion = await prisma.chatBotQuestion.findUnique({
          where: { id: sourceQuestionId },
        });

        if (sourceQuestion) {
          // A/B 선택지가 있는 경우
          if (sourceQuestion.optionA && sourceQuestion.optionB) {
            // 첫 번째 엣지는 A, 두 번째는 B로 가정 (더 정교한 로직 필요 시 개선)
            const existingA = sourceQuestion.nextQuestionIdA;
            if (!existingA) {
              await prisma.chatBotQuestion.update({
                where: { id: sourceQuestionId },
                data: { nextQuestionIdA: targetQuestionId },
              });
            } else {
              await prisma.chatBotQuestion.update({
                where: { id: sourceQuestionId },
                data: { nextQuestionIdB: targetQuestionId },
              });
            }
          } else {
            // 단일 연결인 경우 optionA로 설정
            await prisma.chatBotQuestion.update({
              where: { id: sourceQuestionId },
              data: { nextQuestionIdA: targetQuestionId },
            });
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: '플로우가 저장되었습니다.',
    });
  } catch (error: any) {
    console.error('[Save Nodes API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '노드 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
