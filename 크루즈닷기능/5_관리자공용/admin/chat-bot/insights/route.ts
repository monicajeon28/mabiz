export const dynamic = 'force-dynamic';

// app/api/admin/chat-bot/insights/route.ts
// 채팅봇 인사이트 데이터 조회

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const flows = await prisma.chatBotFlow.findMany({
      where: {
        category: 'AI 지니 채팅봇(구매)',
      },
      include: {
        ChatBotQuestion: {
          orderBy: { order: 'asc' },
        },
        ChatBotSession: {
          include: {
            ChatBotResponse: true,
          },
        },
      },
    });

    const flowStats = flows.map(flow => {
      const sessions = flow.ChatBotSession;
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.isCompleted).length;
      const conversionRate = totalSessions > 0
        ? (completedSessions / totalSessions) * 100
        : 0;

      // 평균 완료 시간 계산
      const completedSessionsWithTime = sessions
        .filter(s => s.isCompleted && s.completedAt)
        .map(s => {
          const timeDiff = s.completedAt!.getTime() - s.startedAt.getTime();
          return timeDiff / (1000 * 60); // 분 단위
        });
      const avgCompletionTime = completedSessionsWithTime.length > 0
        ? completedSessionsWithTime.reduce((a, b) => a + b, 0) / completedSessionsWithTime.length
        : 0;

      // 질문별 통계
      const questionStats = flow.ChatBotQuestion.map(question => {
        // 해당 질문에 대한 모든 응답
        const responses = sessions.flatMap(s =>
          s.ChatBotResponse.filter(r => r.questionId === question.id)
        );

        const totalViews = responses.length;
        const totalResponses = responses.filter(r => !r.isAbandoned).length;
        const abandoned = responses.filter(r => r.isAbandoned).length;
        
        const responseRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;
        const abandonmentRate = totalViews > 0 ? (abandoned / totalViews) * 100 : 0;

        const optionASelected = responses.filter(r => r.selectedOption === 'A').length;
        const optionBSelected = responses.filter(r => r.selectedOption === 'B').length;

        const responseTimes = responses
          .filter(r => r.responseTime !== null)
          .map(r => (r.responseTime || 0) / 1000); // 초 단위
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

        return {
          questionId: question.id,
          questionText: question.questionText,
          totalViews,
          totalResponses,
          responseRate,
          abandonmentRate,
          optionASelected,
          optionBSelected,
          avgResponseTime,
          nextQuestionIdA: question.nextQuestionIdA,
          nextQuestionIdB: question.nextQuestionIdB,
        };
      });

      return {
        flowId: flow.id,
        flowName: flow.name,
        totalSessions,
        completedSessions,
        conversionRate,
        avgCompletionTime,
        questionStats,
      };
    });

    return NextResponse.json({
      ok: true,
      data: flowStats,
    });
  } catch (error) {
    console.error('[ChatBot Insights] Error:', error);
    return NextResponse.json(
      { ok: false, error: '인사이트를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
