import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { B2BProspectCreateInput, B2BProspectUpdateInput } from './validation';

export async function getB2BProspects(
  organizationId: string,
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
    const where: any = {
      organizationId,
      deletedAt: null,
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

    // Fetch data in parallel
    const [prospects, total] = await Promise.all([
      prisma.b2BProspect.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
      const error = new Error('DuplicateProspect');
      (error as any).code = 'DUPLICATE_PROSPECT';
      throw error;
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
    // Verify ownership
    const prospect = await prisma.b2BProspect.findUnique({ where: { id } });
    if (!prospect || prospect.organizationId !== organizationId || prospect.deletedAt !== null) {
      const error = new Error('NotFound');
      (error as any).code = 'PROSPECT_NOT_FOUND';
      throw error;
    }

    // Prepare update data
    const updateData: any = {};
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
    // Verify ownership
    const prospect = await prisma.b2BProspect.findUnique({ where: { id } });
    if (!prospect || prospect.organizationId !== organizationId || prospect.deletedAt !== null) {
      const error = new Error('NotFound');
      (error as any).code = 'PROSPECT_NOT_FOUND';
      throw error;
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

function formatProspect(prospect: any) {
  return {
    id: prospect.id,
    organizationId: prospect.organizationId,
    eduType: prospect.eduType,
    name: prospect.name,
    phone: prospect.phone,
    email: prospect.email,
    productName: prospect.productName,
    paymentAmount: prospect.paymentAmount,
    paymentDate: prospect.paymentDate?.toISOString?.() ?? null,
    notes: prospect.notes,
    status: prospect.status,
    createdAt: prospect.createdAt?.toISOString?.() ?? new Date(prospect.createdAt).toISOString(),
    updatedAt: prospect.updatedAt?.toISOString?.() ?? new Date(prospect.updatedAt).toISOString(),
  };
}
