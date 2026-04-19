export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { DEFAULT_CONTRACT_TEMPLATES, ContractTemplate } from '@/lib/contract-templates-data';

// 타입 정의
const DEFAULT_TEMPLATES: Record<string, ContractTemplate> = DEFAULT_CONTRACT_TEMPLATES;

// 커스텀 계약서 타입 키
const CUSTOM_CONTRACT_TYPES_KEY = 'custom_contract_types';

/**
 * 커스텀 계약서 타입 목록 조회
 */
async function getCustomContractTypes(): Promise<string[]> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { configKey: CUSTOM_CONTRACT_TYPES_KEY },
    });
    if (config?.configValue) {
      return JSON.parse(config.configValue);
    }
  } catch (e) {
    logger.error('[Contract Templates] Failed to load custom types:', { error: e instanceof Error ? e.message : String(e) });
  }
  return [];
}

/**
 * 커스텀 계약서 타입 저장
 */
async function saveCustomContractTypes(types: string[]): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { configKey: CUSTOM_CONTRACT_TYPES_KEY },
    create: {
      configKey: CUSTOM_CONTRACT_TYPES_KEY,
      configValue: JSON.stringify(types),
      description: '커스텀 계약서 타입 목록',
      category: 'contract_templates',
      updatedAt: new Date(),
    },
    update: {
      configValue: JSON.stringify(types),
      updatedAt: new Date(),
    },
  });
}

/**
 * 계약서 템플릿 목록 조회
 */
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // 커스텀 계약서 타입 로드
    const customTypes = await getCustomContractTypes();

    // SystemConfig에서 계약서 템플릿 가져오기
    const configs = await prisma.systemConfig.findMany({
      where: {
        configKey: {
          startsWith: 'contract_template_',
        },
      },
    });

    // 기본 템플릿과 저장된 템플릿 병합
    const templates: Record<string, ContractTemplate> = { ...DEFAULT_TEMPLATES };

    // 저장된 템플릿 병합 (기존 + 커스텀)
    configs.forEach((config) => {
      const contractType = config.configKey.replace('contract_template_', '');
      try {
        const savedTemplate = config.configValue ? JSON.parse(config.configValue) : null;
        if (savedTemplate) {
          if (DEFAULT_TEMPLATES[contractType]) {
            // 기본 템플릿이 있으면 병합
            templates[contractType] = {
              ...DEFAULT_TEMPLATES[contractType],
              ...savedTemplate,
            };
          } else {
            // 커스텀 템플릿은 그대로
            templates[contractType] = {
              ...savedTemplate,
              isCustom: true, // 커스텀 표시
            };
          }
        }
      } catch (e) {
        logger.error(`[Contract Templates] Failed to parse template for ${contractType}:`, { error: e instanceof Error ? e.message : String(e) });
      }
    });

    // 모든 계약서 타입 목록 (기본 + 커스텀)
    const allContractTypes = [
      ...Object.keys(DEFAULT_TEMPLATES),
      ...customTypes.filter((t) => !DEFAULT_TEMPLATES[t]),
    ];

    return NextResponse.json({
      ok: true,
      templates,
      contractTypes: allContractTypes,
      defaultTypes: Object.keys(DEFAULT_TEMPLATES),
      customTypes,
    });
  } catch (error: unknown) {
    logger.error('[Contract Templates GET] Error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: '템플릿 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 계약서 템플릿 저장/수정 (기존 + 커스텀)
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { contractType, title, sections, isNew, price, description: templateDescription, icon } = await req.json();

    if (!contractType) {
      return NextResponse.json(
        { ok: false, message: '계약서 타입이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!title || !sections || !Array.isArray(sections)) {
      return NextResponse.json(
        { ok: false, message: '제목과 섹션 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // 새 계약서 타입인 경우
    if (isNew) {
      // 타입 이름 검증 (영문 대문자 + 언더스코어만)
      if (!/^[A-Z][A-Z0-9_]*$/.test(contractType)) {
        return NextResponse.json(
          { ok: false, message: '계약서 타입 코드는 영문 대문자와 언더스코어만 사용 가능합니다. (예: NEW_CONTRACT)' },
          { status: 400 }
        );
      }

      // 중복 체크
      const customTypes = await getCustomContractTypes();
      if (DEFAULT_TEMPLATES[contractType] || customTypes.includes(contractType)) {
        return NextResponse.json(
          { ok: false, message: '이미 존재하는 계약서 타입입니다.' },
          { status: 400 }
        );
      }

      // 커스텀 타입 목록에 추가
      customTypes.push(contractType);
      await saveCustomContractTypes(customTypes);
    } else {
      // 기존 타입 검증
      const customTypes = await getCustomContractTypes();
      if (!DEFAULT_TEMPLATES[contractType] && !customTypes.includes(contractType)) {
        return NextResponse.json(
          { ok: false, message: '유효하지 않은 계약서 타입입니다.' },
          { status: 400 }
        );
      }
    }

    const configKey = `contract_template_${contractType}`;
    const configValue = JSON.stringify({
      title,
      sections,
      price: price || null,
      description: templateDescription || null,
      icon: icon || '📄',
      isCustom: !DEFAULT_TEMPLATES[contractType],
      updatedAt: new Date().toISOString(),
    });

    // SystemConfig에 저장 (upsert)
    await prisma.systemConfig.upsert({
      where: { configKey },
      create: {
        configKey,
        configValue,
        description: `${title} 템플릿`,
        category: 'contract_templates',
        updatedAt: new Date(),
      },
      update: {
        configValue,
        description: `${title} 템플릿`,
        updatedAt: new Date(),
      },
    });

    logger.log(`[Contract Templates] Template ${isNew ? 'created' : 'saved'} for ${contractType} by GLOBAL_ADMIN`);

    return NextResponse.json({
      ok: true,
      message: isNew ? '새 계약서가 추가되었습니다.' : '계약서 템플릿이 저장되었습니다.',
      contractType,
    });
  } catch (error: unknown) {
    logger.error('[Contract Templates POST] Error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: '템플릿 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 계약서 템플릿 삭제 (기본값 복원 또는 커스텀 완전 삭제)
 */
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { contractType, permanent } = await req.json();

    if (!contractType) {
      return NextResponse.json(
        { ok: false, message: '계약서 타입이 필요합니다.' },
        { status: 400 }
      );
    }

    const customTypes = await getCustomContractTypes();
    const isCustom = customTypes.includes(contractType);
    const isDefault = !!DEFAULT_TEMPLATES[contractType];

    if (!isDefault && !isCustom) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 계약서 타입입니다.' },
        { status: 400 }
      );
    }

    const configKey = `contract_template_${contractType}`;

    // SystemConfig에서 삭제
    await prisma.systemConfig.deleteMany({
      where: { configKey },
    });

    // 커스텀 계약서 완전 삭제 (permanent 플래그 또는 커스텀 타입)
    if (isCustom && (permanent || !isDefault)) {
      const updatedCustomTypes = customTypes.filter((t) => t !== contractType);
      await saveCustomContractTypes(updatedCustomTypes);

      logger.log(`[Contract Templates] Custom template deleted: ${contractType} by GLOBAL_ADMIN`);

      return NextResponse.json({
        ok: true,
        message: '커스텀 계약서가 완전히 삭제되었습니다.',
        deleted: true,
      });
    }

    logger.log(`[Contract Templates] Template reset for ${contractType} by GLOBAL_ADMIN`);

    return NextResponse.json({
      ok: true,
      message: '계약서 템플릿이 기본값으로 복원되었습니다.',
      defaultTemplate: DEFAULT_TEMPLATES[contractType],
    });
  } catch (error: unknown) {
    logger.error('[Contract Templates DELETE] Error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: '템플릿 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
