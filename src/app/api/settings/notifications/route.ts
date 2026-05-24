/**
 * GET /api/settings/notifications - 알림 설정 조회
 * PATCH /api/settings/notifications - 알림 설정 수정
 * Menu #46 (설정)
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import { updateNotificationSettingsSchema } from "@/lib/validations/settings";
import { NotificationSettings, ApiResponse } from "@/lib/types/settings";
import prisma from "@/lib/prisma";

/**
 * 기본 알림 설정
 */
const DEFAULT_NOTIFICATION_PREFERENCES = [
  {
    category: "CONTACT_ACTIVITY" as const,
    channels: { email: true, sms: false, inApp: true, push: true },
    enabled: true,
    frequency: "IMMEDIATE" as const,
  },
  {
    category: "SALES_UPDATE" as const,
    channels: { email: true, sms: false, inApp: true, push: true },
    enabled: true,
    frequency: "IMMEDIATE" as const,
  },
  {
    category: "SMS_CAMPAIGN" as const,
    channels: { email: false, sms: false, inApp: false, push: false },
    enabled: true,
    frequency: "IMMEDIATE" as const,
  },
  {
    category: "SYSTEM_ALERT" as const,
    channels: { email: true, sms: false, inApp: true, push: true },
    enabled: true,
    frequency: "IMMEDIATE" as const,
  },
  {
    category: "TEAM_ACTIVITY" as const,
    channels: { email: false, sms: false, inApp: true, push: false },
    enabled: true,
    frequency: "DAILY" as const,
  },
  {
    category: "REPORT_SCHEDULED" as const,
    channels: { email: true, sms: false, inApp: false, push: false },
    enabled: true,
    frequency: "WEEKLY" as const,
  },
  {
    category: "BILLING" as const,
    channels: { email: true, sms: false, inApp: false, push: false },
    enabled: true,
    frequency: "IMMEDIATE" as const,
  },
  {
    category: "SECURITY" as const,
    channels: { email: true, sms: true, inApp: true, push: true },
    enabled: true,
    frequency: "IMMEDIATE" as const,
  },
];

/**
 * GET /api/settings/notifications
 * 알림 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const ctx = await getMabizSession();
    if (!ctx || !ctx.userId || !ctx.organizationId) {
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

    // 기존 알림 설정 조회
    let notificationSettings = await prisma.notificationSetting.findUnique({
      where: {
        organizationId_userId: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
        },
      },
    });

    // 알림 설정이 없으면 기본값으로 생성
    if (!notificationSettings) {
      notificationSettings = await prisma.notificationSetting.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          preferences: DEFAULT_NOTIFICATION_PREFERENCES,
          allowMarketing: false,
          allowNotifications: true,
          summary: "DAILY",
          unsubscribedCategories: [],
        },
      });
    }

    const settings: NotificationSettings = {
      id: notificationSettings.id,
      organizationId: notificationSettings.organizationId,
      userId: notificationSettings.userId,
      preferences: notificationSettings.preferences as any[],
      allowMarketing: notificationSettings.allowMarketing,
      allowNotifications: notificationSettings.allowNotifications,
      summary: (notificationSettings.summary as "NONE" | "DAILY" | "WEEKLY") || "DAILY",
      unsubscribedCategories: notificationSettings.unsubscribedCategories as any[],
      createdAt: notificationSettings.createdAt,
      updatedAt: notificationSettings.updatedAt,
    };

    return NextResponse.json<ApiResponse<NotificationSettings>>(
      {
        success: true,
        data: settings,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/settings/notifications]", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "알림 설정 조회 중 오류가 발생했습니다",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/notifications
 * 알림 설정 수정
 */
export async function PATCH(request: NextRequest) {
  try {
    // 인증 확인
    const ctx = await getMabizSession();
    if (!ctx || !ctx.userId || !ctx.organizationId) {
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
    const validationResult = updateNotificationSettingsSchema.safeParse(body);
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

    // 기존 알림 설정 조회
    let notificationSettings = await prisma.notificationSetting.findUnique({
      where: {
        organizationId_userId: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
        },
      },
    });

    // 알림 설정이 없으면 기본값으로 생성
    if (!notificationSettings) {
      notificationSettings = await prisma.notificationSetting.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          preferences: DEFAULT_NOTIFICATION_PREFERENCES,
          allowMarketing: false,
          allowNotifications: true,
          summary: "DAILY",
          unsubscribedCategories: [],
        },
      });
    }

    // 알림 설정 업데이트
    const updatedSettings = await prisma.notificationSetting.update({
      where: { id: notificationSettings.id },
      data: {
        ...(validationResult.data.preferences !== undefined && {
          preferences: validationResult.data.preferences,
        }),
        ...(validationResult.data.allowMarketing !== undefined && {
          allowMarketing: validationResult.data.allowMarketing,
        }),
        ...(validationResult.data.allowNotifications !== undefined && {
          allowNotifications: validationResult.data.allowNotifications,
        }),
        ...(validationResult.data.summary !== undefined && {
          summary: validationResult.data.summary,
        }),
        ...(validationResult.data.unsubscribedCategories !== undefined && {
          unsubscribedCategories: validationResult.data.unsubscribedCategories,
        }),
        updatedAt: new Date(),
      },
    });

    const settings: NotificationSettings = {
      id: updatedSettings.id,
      organizationId: updatedSettings.organizationId,
      userId: updatedSettings.userId,
      preferences: updatedSettings.preferences as any[],
      allowMarketing: updatedSettings.allowMarketing,
      allowNotifications: updatedSettings.allowNotifications,
      summary: (updatedSettings.summary as "NONE" | "DAILY" | "WEEKLY") || "DAILY",
      unsubscribedCategories: updatedSettings.unsubscribedCategories as any[],
      createdAt: updatedSettings.createdAt,
      updatedAt: updatedSettings.updatedAt,
    };

    return NextResponse.json<ApiResponse<NotificationSettings>>(
      {
        success: true,
        data: settings,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/settings/notifications]", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "알림 설정 수정 중 오류가 발생했습니다",
        },
      },
      { status: 500 }
    );
  }
}
