import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface Quiz {
  courseId: string;
  title: string;
  questions: QuizQuestion[];
  passingScore: number; // e.g., 70
  timeLimit?: number; // minutes
}

/**
 * GET /api/training/quiz — 퀴즈 조회
 * 쿼리: courseId (required)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 }
      );
    }

    // 강의별 퀴즈 예제 (50대 친화형 문제)
    const QUIZZES: Record<string, Quiz> = {
      "beginner-1": {
        courseId: "beginner-1",
        title: "크루즈 상품 5가지 마스터 - 퀴즈",
        passingScore: 70,
        timeLimit: 10,
        questions: [
          {
            id: "q1",
            question: "GOLD 회원권의 가장 큰 특징은?",
            options: [
              "1년에 1회 크루즈 탈 수 있음",
              "연중 최대 3회까지 선택 가능",
              "평생 무제한 이용",
              "초대손님만 동반 가능",
            ],
            correctAnswer: 1,
            explanation:
              "GOLD 회원권은 연중 최대 3회까지 원하는 시간에 크루즈를 선택할 수 있는 유연성이 가장 큰 특징입니다.",
            difficulty: "easy",
          },
          {
            id: "q2",
            question:
              "DIAMOND와 PLATINUM의 주요 차이점은 무엇인가요? (50대 관심사 기준)",
            options: [
              "탑승 횟수만 다름",
              "동반 가족 수 + 스위트룸 등급이 다름",
              "가격만 다름",
              "국내선만 vs 국제선 포함",
            ],
            correctAnswer: 1,
            explanation:
              "PLATINUM은 가족과 함께 더 많은 사람을 데려갈 수 있고, 스위트룸과 같은 더 좋은 객실을 이용할 수 있어서 특별한 경험을 원하는 50대에게 인기입니다.",
            difficulty: "medium",
          },
          {
            id: "q3",
            question: "SAPPHIRE 회원의 혜택 중 다른 상품과의 가장 큰 차별점은?",
            options: [
              "할인이 가장 많음",
              "배우자와 자녀를 위한 평생 권리 제공",
              "국내 호텔 할인",
              "항공사 마일리지 제공",
            ],
            correctAnswer: 1,
            explanation:
              "SAPPHIRE는 배우자와 자녀가 평생 동안 혜택을 받을 수 있어서, 가족 세대를 넘어 가치를 만드는 상품입니다.",
            difficulty: "medium",
          },
          {
            id: "q4",
            question: "어떤 고객이 EMERALD를 가장 선호하나요?",
            options: [
              "독신 1인 가구",
              "1년에 여러 번 여행하고 싶은 활동적인 분",
              "자녀 교육비 많이 드는 가정",
              "은퇴 후 충분한 여유가 있는 분",
            ],
            correctAnswer: 1,
            explanation:
              "EMERALD는 월 1회 이상 여행하고 싶은 활동적인 고객, 특히 자식들을 자주 데려가고 싶은 50대에게 가장 적합합니다.",
            difficulty: "hard",
          },
        ],
      },
      "beginner-2": {
        courseId: "beginner-2",
        title: "고객 심리 기본 - 퀴즈",
        passingScore: 70,
        timeLimit: 10,
        questions: [
          {
            id: "q1",
            question: "손실회피(Loss Aversion)의 기본 개념은?",
            options: [
              "뭔가 얻는 것이 잃는 것보다 좋은 심리",
              "뭔가 잃을 것 같은 생각에 더 강하게 반응하는 심리",
              "위험을 피하려는 심리",
              "확실한 것을 원하는 심리",
            ],
            correctAnswer: 1,
            explanation:
              "손실회피는 행동경제학의 핵심으로, 같은 금액을 얻는 것보다 잃을 것을 더 강하게 느끼는 인간의 심리적 편향입니다.",
            difficulty: "easy",
          },
          {
            id: "q2",
            question: "L6 렌즈(타이밍 손실회피) 판매 대사로 가장 적절한 것은?",
            options: [
              "언제든 신청 가능합니다",
              "지금 신청하지 않으면 내년에는 선착순이 마감될 수 있습니다",
              "저희 상품은 매우 인기가 있습니다",
              "많은 분들이 만족하고 있습니다",
            ],
            correctAnswer: 1,
            explanation:
              "L6 렌즈는 지금 이 순간을 놓치면 후회할 것이라는 타이밍 손실감을 만들어서 구매 결정을 촉진합니다.",
            difficulty: "medium",
          },
          {
            id: "q3",
            question: "희소성 심리를 활용한 판매 전략 예시는?",
            options: [
              "매년 같은 시간에 판매",
              "최초 100명에게만 50% 할인 (마감 3일 남음)",
              "할인은 얼마든지 가능",
              "언제든 신청 받습니다",
            ],
            correctAnswer: 1,
            explanation:
              "희소성은 수량이나 시간이 제한될 때 사람들이 더 빠르게 결정한다는 원리입니다. 50대는 이 심리에 매우 반응적입니다.",
            difficulty: "medium",
          },
          {
            id: "q4",
            question: "L10 렌즈(즉시 구매 클로징)를 적용하려면?",
            options: [
              "충분한 시간을 주기",
              "가족과 상의할 시간 제공",
              "지금 바로 신청하면 추가 선물 제공",
              "나중에 다시 연락드리겠습니다",
            ],
            correctAnswer: 2,
            explanation:
              "L10은 이 순간 바로 결정하도록 강한 인센티브(선물, 할인, 우선권)를 제공하는 클로징 기법입니다.",
            difficulty: "hard",
          },
        ],
      },
    };

    const quiz = QUIZZES[courseId];

    if (!quiz) {
      return NextResponse.json(
        { error: "Quiz not found for this course" },
        { status: 404 }
      );
    }

    logger.log("[TrainingQuizAPI]", {
      action: "get-quiz",
      userId: ctx.userId,
      courseId,
      questionCount: quiz.questions.length,
    });

    return NextResponse.json({
      success: true,
      ...quiz,
    });
  } catch (err) {
    logger.error("[TrainingQuizAPI]", {
      action: "get-quiz",
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/training/quiz — 퀴즈 제출
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const body = await req.json();

    const { courseId, answers, timeSpent } = body;

    if (!courseId || !answers) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 정답 채점
    const QUIZZES: Record<string, Quiz> = {
      "beginner-1": {
        courseId: "beginner-1",
        title: "크루즈 상품 5가지 마스터 - 퀴즈",
        passingScore: 70,
        timeLimit: 10,
        questions: [
          {
            id: "q1",
            question: "GOLD 회원권의 가장 큰 특징은?",
            options: [
              "1년에 1회 크루즈 탈 수 있음",
              "연중 최대 3회까지 선택 가능",
              "평생 무제한 이용",
              "초대손님만 동반 가능",
            ],
            correctAnswer: 1,
            explanation: "",
            difficulty: "easy",
          },
          {
            id: "q2",
            question: "DIAMOND와 PLATINUM의 주요 차이점은?",
            options: [
              "탑승 횟수만 다름",
              "동반 가족 수 + 스위트룸 등급이 다름",
              "가격만 다름",
              "국내선만 vs 국제선 포함",
            ],
            correctAnswer: 1,
            explanation: "",
            difficulty: "medium",
          },
          {
            id: "q3",
            question: "SAPPHIRE 회원의 혜택 중 다른 상품과의 가장 큰 차별점은?",
            options: [
              "할인이 가장 많음",
              "배우자와 자녀를 위한 평생 권리 제공",
              "국내 호텔 할인",
              "항공사 마일리지 제공",
            ],
            correctAnswer: 1,
            explanation: "",
            difficulty: "medium",
          },
          {
            id: "q4",
            question: "어떤 고객이 EMERALD를 가장 선호하나요?",
            options: [
              "독신 1인 가구",
              "1년에 여러 번 여행하고 싶은 활동적인 분",
              "자녀 교육비 많이 드는 가정",
              "은퇴 후 충분한 여유가 있는 분",
            ],
            correctAnswer: 1,
            explanation: "",
            difficulty: "hard",
          },
        ],
      },
    };

    const quiz = QUIZZES[courseId];
    if (!quiz) {
      return NextResponse.json(
        { error: "Quiz not found" },
        { status: 404 }
      );
    }

    let correctCount = 0;
    quiz.questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;

    logger.log("[TrainingQuizAPI]", {
      action: "submit-quiz",
      userId: ctx.userId,
      courseId,
      score,
      passed,
      timeSpent,
    });

    return NextResponse.json({
      success: true,
      score,
      passed,
      correctCount,
      totalQuestions: quiz.questions.length,
      message: passed ? "축하합니다! 퀴즈를 통과했습니다." : "다시 시도해주세요.",
    });
  } catch (err) {
    logger.error("[TrainingQuizAPI]", {
      action: "submit-quiz",
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Failed to submit quiz" },
      { status: 500 }
    );
  }
}
