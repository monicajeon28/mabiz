import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export interface Course {
  id: string;
  title: string;
  duration: string;
  lessons: number;
  description: string;
  path: "beginner" | "intermediate" | "advanced";
}

export interface CourseDetail extends Course {
  content: string;
  objectives: string[];
  materials: {
    video?: string;
    pdf?: string;
    script?: string;
  };
}

/**
 * GET /api/training/courses — 강의 목록 조회
 * 쿼리: path (beginner | intermediate | advanced) - 선택사항
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") as "beginner" | "intermediate" | "advanced" | null;

    const COURSES: Record<string, Course[]> = {
      beginner: [
        {
          id: "beginner-1",
          title: "크루즈 상품 5가지 마스터",
          duration: "15분",
          lessons: 4,
          description: "GOLD, DIAMOND, PLATINUM, EMERALD, SAPPHIRE의 차이점 완벽 이해",
          path: "beginner",
        },
        {
          id: "beginner-2",
          title: "고객 심리 기본 (L6-L10)",
          duration: "12분",
          lessons: 3,
          description: "손실회피, 희소성, 긴박감으로 구매 결정 유도",
          path: "beginner",
        },
        {
          id: "beginner-3",
          title: "첫 통화 스크립트 Day 0",
          duration: "10분",
          lessons: 2,
          description: "인사부터 초기 아이스브레이킹까지 완벽하게",
          path: "beginner",
        },
        {
          id: "beginner-4",
          title: "PASONA 프레임워크 입문",
          duration: "18분",
          lessons: 5,
          description: "문제 → 자극 → 해결 → 오퍼 → 행동의 흐름",
          path: "beginner",
        },
      ],
      intermediate: [
        {
          id: "intermediate-1",
          title: "5가지 이의 대응 마스터",
          duration: "20분",
          lessons: 5,
          description: "가격 / 준비 / 기항지 / 자유 / 의료 완벽 대응",
          path: "intermediate",
        },
        {
          id: "intermediate-2",
          title: "클로징 기법 5가지",
          duration: "15분",
          lessons: 4,
          description: "직접 / 가정 / 한정 / 선택 / 긴박감 클로징",
          path: "intermediate",
        },
        {
          id: "intermediate-3",
          title: "세그먼트별 메시지 (A-E)",
          duration: "16분",
          lessons: 5,
          description: "신민형 vs 모니카형 vs 루셀형 대화 전략",
          path: "intermediate",
        },
        {
          id: "intermediate-4",
          title: "실제 통화 사례 분석",
          duration: "25분",
          lessons: 5,
          description: "성공 사례 5개 분석 + 실수 패턴 인식",
          path: "intermediate",
        },
      ],
      advanced: [
        {
          id: "advanced-1",
          title: "심리학 10렌즈 마스터",
          duration: "45분",
          lessons: 10,
          description: "L0-L10 완벽 이해 + 렌즈별 대응 전략",
          path: "advanced",
        },
        {
          id: "advanced-2",
          title: "업셀/크로스셀 전략",
          duration: "18분",
          lessons: 4,
          description: "기존 고객 수익 2배 이상 확대 기법",
          path: "advanced",
        },
        {
          id: "advanced-3",
          title: "데이터 분석 & KPI 읽기",
          duration: "20분",
          lessons: 4,
          description: "성과 메트릭 분석 + 개인 목표 설정",
          path: "advanced",
        },
        {
          id: "advanced-4",
          title: "팀 리더 트레이닝",
          duration: "30분",
          lessons: 6,
          description: "신입 코칭 + 성과 관리 + 팀 빌딩",
          path: "advanced",
        },
      ],
    };

    const courses = path ? COURSES[path] : Object.values(COURSES).flat();

    logger.log("[TrainingCoursesAPI]", {
      action: "list-courses",
      userId: ctx.userId,
      path,
      count: courses.length,
    });

    return NextResponse.json({
      success: true,
      courses,
      total: courses.length,
    });
  } catch (err) {
    logger.error("[TrainingCoursesAPI]", {
      action: "list-courses",
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
