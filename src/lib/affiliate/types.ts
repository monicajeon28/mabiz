/**
 * Affiliate Sales API Response Types
 * 대리점 매출 관련 API 응답 타입 정의
 */

/**
 * Admin Affiliate Sales Response Item
 * `/api/admin/affiliate-sales` 응답에서 각 대리점 정보
 */
export type AdminAffiliateSalesItem = {
  affiliateUserId: string;
  affiliateName: string;
  totalRevenue: number;
  conversionRate: number;
  avgOrderAmount: number;
  pageCount: number;
  status: 'active' | 'inactive';
};

/**
 * Admin Affiliate Sales Response
 * `/api/admin/affiliate-sales` 전체 응답
 */
export type AdminAffiliateSalesResponse = {
  ok: true;
  data: AdminAffiliateSalesItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Affiliate Sale Item
 * `/api/affiliate-sales` 응답에서 각 판매 정보
 */
export type AffiliateSaleItem = {
  id: number;
  agentId: number | null;
  managerId: number | null;
  status: string;
  saleAmount: number;
  salesCommission: number | null;
  yearMonth: string | null;
  saleDate: string | null;
  confirmedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  externalOrderCode: string | null;
  agentDisplayName: string | null;
  agentMallUserId: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

/**
 * Affiliate Sales Response
 * `/api/affiliate-sales` 전체 응답
 */
export type AffiliateSalesResponse = {
  ok: true;
  sales: AffiliateSaleItem[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * Error Response
 */
export type ErrorResponse = {
  ok: false;
  error?: string;
};
