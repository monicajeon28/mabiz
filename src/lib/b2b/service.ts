import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { B2BProspectCreateInput, B2BProspectUpdateInput } from './validation';
import { DuplicateProspectError, ProspectNotFoundError } from './errors';

// Type definitions for type safety
interface WhereInput {
  organizationId?: string;
  deletedAt: null;
  eduType?: string;
  status?: string;
  OR?: Array<{
    name?: { contains: string; mode: 'insensitive' };
    phone?: { contains: string }; // mode: 'insensitive' 제거 — 전화번호는 대소문자 무의미, 인덱스 활용
    email?: { contains: string; mode: 'insensitive' };
    productName?: { contains: string; mode: 'insensitive' };
  }>;
}

type UpdateData = Partial<{
  name: string;
  email: string | null;
  productName: string | null;
  paymentAmount: number | null;
  paymentDate: Date | null;
  notes: string | null;
  status: string;
}>;

// Type for the formatProspect function input (Prisma select projection)
interface ProspectFormatInput {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  eduType: string;
  createdAt: Date;
  productName: string | null;
  paymentAmount: number | null;
  paymentDate?: Date | null;
  notes?: string | null;
  organizationId?: string;
  updatedAt?: Date;
}

export async function getB2BProspects(
  organizationId: string | null,
  params: {
    page: number;
    limit: number;
    eduType?: string;
    status?: string;
    q?: string;
  }
) {
  try {
    const { page, limit, eduType, status, q } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    // organizationId가 null이면 GLOBAL_ADMIN의 전체 조회 → organizationId 필터 생략
    const where: WhereInput = {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    };

    if (eduType) {
      where.eduType = eduType;
    }

    if (status) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } }, // mode: 'insensitive' 제거 — 인덱스 활용
        { email: { contains: q, mode: 'insensitive' } },
        { productName: { contains: q, mode: 'insensitive' } },
      ];
    }

    // P1: 병렬 쿼리 + select 필드 완성 (N+1 제거, 목록 뷰용 최적화)
    const [prospects, total] = await Promise.all([
      prisma.b2BProspect.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          eduType: true,
          createdAt: true,
          productName: true,
          paymentAmount: true,
          paymentDate: true,
          notes: true,
        },
      }),
      prisma.b2BProspect.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      ok: true as const,
      prospects: prospects.map(formatProspect),
      total,
      page,
      limit,
      totalPages,
    };
  } catch (err) {
    logger.error('[b2b] getB2BProspects error', { err, organizationId });
    throw err;
  }
}

export async function createB2BProspect(
  organizationId: string,
  data: B2BProspectCreateInput
) {
  try {
    // Check for duplicate (organizationId + phone + eduType combination)
    const existing = await prisma.b2BProspect.findFirst({
      where: {
        organizationId,
        phone: data.phone,
        eduType: data.eduType,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new DuplicateProspectError();
    }

    // Normalize empty strings to null/undefined
    const createData = {
      organizationId,
      name: data.name,
      phone: data.phone.trim(),
      email: data.email ? data.email.trim() : null,
      productName: data.productName ? data.productName.trim() : null,
      paymentAmount: data.paymentAmount ?? null,
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
      notes: data.notes ? data.notes.trim() : null,
      status: data.status,
      eduType: data.eduType,
    };

    const prospect = await prisma.b2BProspect.create({
      data: createData,
    });

    return {
      ok: true as const,
      prospect: formatProspect(prospect),
    };
  } catch (err) {
    logger.error('[b2b] createB2BProspect error', { err, organizationId });
    throw err;
  }
}

export async function updateB2BProspect(
  organizationId: string,
  id: string,
  data: B2BProspectUpdateInput
) {
  try {
    // Prepare update data
    const updateData: UpdateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
    if (data.productName !== undefined) updateData.productName = data.productName ? data.productName.trim() : null;
    if (data.paymentAmount !== undefined) updateData.paymentAmount = data.paymentAmount;
    if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate ? new Date(data.paymentDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null;
    if (data.status !== undefined) updateData.status = data.status;

    // T-009: TOCTOU 레이스 컨디션 방지 — updateMany로 소유권(organizationId) + deletedAt 조건을
    // update와 동시에 원자적으로 적용. 기존 findFirst→update(id만) 패턴은 두 쿼리 사이
    // 레코드 변경 시 소유권 재검증 없이 업데이트되는 취약점이 있었음.
    const result = await prisma.b2BProspect.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: updateData,
    });
    if (result.count === 0) throw new ProspectNotFoundError();

    // 업데이트 후 전체 레코드 재조회 (formatProspect에 필요한 전체 필드 포함)
    const updated = await prisma.b2BProspect.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!updated) throw new ProspectNotFoundError();

    return {
      ok: true as const,
      prospect: formatProspect(updated),
    };
  } catch (err) {
    logger.error('[b2b] updateB2BProspect error', { err, organizationId, id });
    throw err;
  }
}

export async function deleteB2BProspect(organizationId: string, id: string) {
  try {
    // T-010: TOCTOU 레이스 컨디션 방지 — updateMany로 소유권(organizationId) + deletedAt 조건을
    // 소프트 삭제와 동시에 원자적으로 적용. 기존 findFirst→update(id만) 패턴은 두 쿼리 사이
    // 다른 조직의 레코드가 soft-delete 우회 가능한 취약점이 있었음.
    const deleteResult = await prisma.b2BProspect.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (deleteResult.count === 0) throw new ProspectNotFoundError();

    return {
      ok: true as const,
      message: '삭제 완료',
    };
  } catch (err) {
    logger.error('[b2b] deleteB2BProspect error', { err, organizationId, id });
    throw err;
  }
}

// P1: formatProspect 이제 paymentDate와 notes 포함 반환
function formatProspect(prospect: ProspectFormatInput) {
  return {
    id: prospect.id,
    name: prospect.name,
    phone: prospect.phone,
    email: prospect.email,
    status: prospect.status,
    eduType: prospect.eduType,
    createdAt: prospect.createdAt.toISOString(),
    productName: prospect.productName,
    paymentAmount: prospect.paymentAmount,
    paymentDate: prospect.paymentDate ? prospect.paymentDate.toISOString().split('T')[0] : null,
    notes: prospect.notes,
  };
}
