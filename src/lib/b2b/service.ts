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
    phone?: { contains: string; mode: 'insensitive' };
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
        { phone: { contains: q, mode: 'insensitive' } },
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
    // Verify ownership (P1: 보안 - IDOR 방지)
    const prospect = await prisma.b2BProspect.findUnique({ where: { id } });
    if (!prospect || prospect.organizationId !== organizationId || prospect.deletedAt !== null) {
      throw new ProspectNotFoundError();
    }

    // Prepare update data
    const updateData: UpdateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
    if (data.productName !== undefined) updateData.productName = data.productName ? data.productName.trim() : null;
    if (data.paymentAmount !== undefined) updateData.paymentAmount = data.paymentAmount;
    if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate ? new Date(data.paymentDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null;
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await prisma.b2BProspect.update({
      where: { id },
      data: updateData,
    });

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
    // Verify ownership (P1: 보안 - IDOR 방지)
    const prospect = await prisma.b2BProspect.findUnique({ where: { id } });
    if (!prospect || prospect.organizationId !== organizationId || prospect.deletedAt !== null) {
      throw new ProspectNotFoundError();
    }

    // Soft delete
    await prisma.b2BProspect.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

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
