import { z } from 'zod';

// ─── B2C Dashboard ────────────────────────────────────────
export const b2cSaleSchema = z.object({
  id: z.string(),
  productName: z.string(),
  amount: z.number(),
  commission: z.number(),
  commissionRate: z.number().nullable(),
  status: z.string(),
  date: z.string(),
});

export const b2cPassportSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  passportStatus: z.string(),
  pnrStatus: z.string(),
  confirmedAt: z.string().nullable(),
  assignedName: z.string().optional(),
  commissionAmount: z.number().optional(),
  saleId: z.string().nullable().optional(),
});

export const b2cDataSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    totalSalesAmount: z.number(),
    salesCount: z.number(),
    reservationCount: z.number(),
    recentSales: z.array(b2cSaleSchema),
    passportPnr: z.array(b2cPassportSchema),
    passportSummary: z.record(z.number()).optional(),
    pnrSummary: z.record(z.number()).optional(),
    trends: z.record(z.number()).optional(),
  }).nullable(),
});

// ─── B2B Dashboard ────────────────────────────────────────
export const b2bLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  interestedPackage: z.string().nullable(),
  source: z.string(),
  status: z.string(),
  date: z.string(),
});

export const b2bDataSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    newLeads: z.number(),
    eduApplicants: z.number(),
    paymentAmount: z.number(),
    recentLeads: z.array(b2bLeadSchema),
    trends: z.record(z.number()).optional(),
  }).nullable(),
});

// ─── Gold Dashboard ────────────────────────────────────────
export const goldDataSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    totalRevenue: z.number(),
    memberCount: z.number(),
    inquiryCount: z.number(),
    trends: z.record(z.number()).optional(),
  }).nullable(),
});

// ─── Drilldown Detail ────────────────────────────────────────
export const drilldownItemSchema = z.record(z.unknown());

export const drilldownDetailSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    items: z.array(drilldownItemSchema),
    totalCount: z.number(),
    page: z.number(),
    totalPages: z.number(),
  }).nullable(),
});

// ─── Suspension Status ────────────────────────────────────────
export const suspensionStatusSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    suspended: z.boolean(),
    suspensionReason: z.string().nullable(),
    suspendedAt: z.string().nullable(),
    appealStatus: z.enum(['NONE', 'PENDING', 'APPROVED', 'REJECTED']).nullable(),
  }).nullable(),
});

// ─── Bulk Passport Link ────────────────────────────────────────
export const bulkLinkResultSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    results: z.array(z.object({
      userId: z.number(),
      userName: z.string(),
      link: z.string(),
      message: z.string(),
      expiresAt: z.string(),
    })),
  }).nullable(),
});

// ─── Generic API Response ────────────────────────────────────────
export const genericApiResponseSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});
