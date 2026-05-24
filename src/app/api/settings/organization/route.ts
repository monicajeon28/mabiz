/**
 * GET /api/settings/organization - 조직 정보 조회
 * PATCH /api/settings/organization - 조직 정보 수정
 * Menu #46 (설정)
 */

import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import { updateOrganizationSettingsSchema } from "@/lib/validations/settings";
import { OrganizationSettings, ApiResponse } from "@/lib/types/settings";
import prisma from "@/lib/prisma";

/**
 * GET /api/settings/organization
 * 조직 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const ctx = await getMabizSession();
    if (!ctx || !ctx.organizationId) {
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

    // 조직 정보 조회
    const organization = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: {
        id: true,
        name: true,
        companyName: true,
        businessRegistration: true,
        industry: true,
        size: true,
        website: true,
        logo: true,
        primaryColor: true,
        address: true,
        phone: true,
        contactEmail: true,
        timezone: true,
        language: true,
        status: true,
        planType: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!organization) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "조직을 찾을 수 없습니다",
          },
        },
        { status: 404 }
      );
    }

    const settings: OrganizationSettings = {
      id: organization.id,
      name: organization.name,
      companyName: organization.companyName ?? undefined,
      businessRegistration: organization.businessRegistration ?? undefined,
      industry: organization.industry ?? undefined,
      size: organization.size as
        | "SOLO"
        | "SMALL"
        | "MEDIUM"
        | "LARGE"
        | "ENTERPRISE"
        | undefined,
      website: organization.website ?? undefined,
      logo: organization.logo ?? undefined,
      primaryColor: organization.primaryColor ?? undefined,
      address: organization.address ?? undefined,
      phone: organization.phone ?? undefined,
      contactEmail: organization.contactEmail ?? undefined,
      timezone: organization.timezone || "Asia/Seoul",
      language: (organization.language as "ko" | "en") || "ko",
      status: (organization.status as
        | "ACTIVE"
        | "INACTIVE"
        | "TRIAL"
        | "SUSPENDED") || "ACTIVE",
      trialEndsAt: organization.trialEndsAt ?? undefined,
      planType: (organization.planType as
        | "FREE"
        | "STARTER"
        | "PROFESSIONAL"
        | "ENTERPRISE") || "FREE",
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };

    return NextResponse.json<ApiResponse<OrganizationSettings>>(
      {
        success: true,
        data: settings,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/settings/organization]", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "조직 정보 조회 중 오류가 발생했습니다",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/organization
 * 조직 정보 수정
 */
export async function PATCH(request: NextRequest) {
  try {
    // 인증 확인
    const ctx = await getMabizSession();
    if (!ctx || !ctx.organizationId) {
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

    // 권한 확인 (관리자만 조직 설정 수정 가능)
    const userRole = ctx.role || "MEMBER";
    const isAdmin = ["ADMIN", "OWNER"].includes(userRole);

    if (!isAdmin) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "조직 설정을 수정할 권한이 없습니다",
          },
        },
        { status: 403 }
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
    const validationResult = updateOrganizationSettingsSchema.safeParse(body);
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

    // 조직 정보 업데이트
    const updatedOrg = await prisma.organization.update({
      where: { id: ctx.organizationId },
      data: {
        ...(validationResult.data.name !== undefined && {
          name: validationResult.data.name,
        }),
        ...(validationResult.data.companyName !== undefined && {
          companyName: validationResult.data.companyName,
        }),
        ...(validationResult.data.businessRegistration !== undefined && {
          businessRegistration: validationResult.data.businessRegistration,
        }),
        ...(validationResult.data.industry !== undefined && {
          industry: validationResult.data.industry,
        }),
        ...(validationResult.data.size !== undefined && {
          size: validationResult.data.size,
        }),
        ...(validationResult.data.website !== undefined && {
          website: validationResult.data.website,
        }),
        ...(validationResult.data.logo !== undefined && {
          logo: validationResult.data.logo,
        }),
        ...(validationResult.data.primaryColor !== undefined && {
          primaryColor: validationResult.data.primaryColor,
        }),
        ...(validationResult.data.address !== undefined && {
          address: validationResult.data.address,
        }),
        ...(validationResult.data.phone !== undefined && {
          phone: validationResult.data.phone,
        }),
        ...(validationResult.data.contactEmail !== undefined && {
          contactEmail: validationResult.data.contactEmail,
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
        companyName: true,
        businessRegistration: true,
        industry: true,
        size: true,
        website: true,
        logo: true,
        primaryColor: true,
        address: true,
        phone: true,
        contactEmail: true,
        timezone: true,
        language: true,
        status: true,
        planType: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const settings: OrganizationSettings = {
      id: updatedOrg.id,
      name: updatedOrg.name,
      companyName: updatedOrg.companyName ?? undefined,
      businessRegistration: updatedOrg.businessRegistration ?? undefined,
      industry: updatedOrg.industry ?? undefined,
      size: updatedOrg.size as
        | "SOLO"
        | "SMALL"
        | "MEDIUM"
        | "LARGE"
        | "ENTERPRISE"
        | undefined,
      website: updatedOrg.website ?? undefined,
      logo: updatedOrg.logo ?? undefined,
      primaryColor: updatedOrg.primaryColor ?? undefined,
      address: updatedOrg.address ?? undefined,
      phone: updatedOrg.phone ?? undefined,
      contactEmail: updatedOrg.contactEmail ?? undefined,
      timezone: updatedOrg.timezone || "Asia/Seoul",
      language: (updatedOrg.language as "ko" | "en") || "ko",
      status: (updatedOrg.status as
        | "ACTIVE"
        | "INACTIVE"
        | "TRIAL"
        | "SUSPENDED") || "ACTIVE",
      trialEndsAt: updatedOrg.trialEndsAt ?? undefined,
      planType: (updatedOrg.planType as
        | "FREE"
        | "STARTER"
        | "PROFESSIONAL"
        | "ENTERPRISE") || "FREE",
      createdAt: updatedOrg.createdAt,
      updatedAt: updatedOrg.updatedAt,
    };

    return NextResponse.json<ApiResponse<OrganizationSettings>>(
      {
        success: true,
        data: settings,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/settings/organization]", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "조직 정보 수정 중 오류가 발생했습니다",
        },
      },
      { status: 500 }
    );
  }
}
