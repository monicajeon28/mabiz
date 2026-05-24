/**
 * GET /api/settings/profile - 사용자 프로필 조회
 * PATCH /api/settings/profile - 사용자 프로필 수정
 * Menu #46 (설정)
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import { updateUserProfileSchema } from "@/lib/validations/settings";
import { UserProfile, ApiResponse } from "@/lib/types/settings";
import prisma from "@/lib/prisma";

/**
 * GET /api/settings/profile
 * 사용자 프로필 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const ctx = await getMabizSession();
    if (!ctx || !ctx.userId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "인증이 필요합니다",
          },
        },
        { status: 401 }
      );
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        timezone: true,
        language: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "사용자를 찾을 수 없습니다",
          },
        },
        { status: 404 }
      );
    }

    const profile: UserProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? undefined,
      avatar: user.avatar ?? undefined,
      timezone: user.timezone || "Asia/Seoul",
      language: (user.language as "ko" | "en") || "ko",
      status: (user.status as "ACTIVE" | "INACTIVE") || "ACTIVE",
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return NextResponse.json<ApiResponse<UserProfile>>(
      {
        success: true,
        data: profile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/settings/profile]", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "프로필 조회 중 오류가 발생했습니다",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/profile
 * 사용자 프로필 수정
 */
export async function PATCH(request: NextRequest) {
  try {
    // 인증 확인
    const ctx = await getMabizSession();
    if (!ctx || !ctx.userId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "인증이 필요합니다",
          },
        },
        { status: 401 }
      );
    }

    // 요청 본문 파싱
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "유효한 JSON 형식이 필요합니다",
          },
        },
        { status: 400 }
      );
    }

    // 입력 검증
    const validationResult = updateUserProfileSchema.safeParse(body);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });

      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "입력 값 검증에 실패했습니다",
            details: errors,
          },
        },
        { status: 400 }
      );
    }

    // 사용자 정보 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        ...(validationResult.data.name !== undefined && {
          name: validationResult.data.name,
        }),
        ...(validationResult.data.phone !== undefined && {
          phone: validationResult.data.phone,
        }),
        ...(validationResult.data.avatar !== undefined && {
          avatar: validationResult.data.avatar,
        }),
        ...(validationResult.data.timezone !== undefined && {
          timezone: validationResult.data.timezone,
        }),
        ...(validationResult.data.language !== undefined && {
          language: validationResult.data.language,
        }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        timezone: true,
        language: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const profile: UserProfile = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone ?? undefined,
      avatar: updatedUser.avatar ?? undefined,
      timezone: updatedUser.timezone || "Asia/Seoul",
      language: (updatedUser.language as "ko" | "en") || "ko",
      status: (updatedUser.status as "ACTIVE" | "INACTIVE") || "ACTIVE",
      lastLoginAt: updatedUser.lastLoginAt ?? undefined,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    return NextResponse.json<ApiResponse<UserProfile>>(
      {
        success: true,
        data: profile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/settings/profile]", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "프로필 수정 중 오류가 발생했습니다",
        },
      },
      { status: 500 }
    );
  }
}
