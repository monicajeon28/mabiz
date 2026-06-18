export interface Campaign {
  id: string;
  title: string;
  status: string;
  totalCount: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  registeredCount: number;
  group: { id: string; name: string };
  createdAt: string;
}

export interface Summary {
  totalViews: number;
  totalRegistrations: number;
  totalFunnelEntered: number;
  totalPurchased: number;
  conversionRate: number;
  purchaseRate: number;
  thisMonthRegistrations?: number;
  lastMonthRegistrations?: number;
  registrationDelta?: number | null;
}

export interface TopPage {
  id: string;
  title: string;
  slug: string;
  viewCount: number;
  registrations: number;
  conversionRate: number;
}

export interface TrendDay {
  date: string;
  count: number;
}

export interface DashboardData {
  summary: Summary;
  topPages: TopPage[];
  trend: TrendDay[];
}

export interface MonthlyRow {
  month: string;
  revenue: number;
  count: number;
}

export interface LandingRow {
  landingPageId: string | null;
  landingPageTitle: string;
  revenue: number;
  count: number;
}

export interface RecentRow {
  orderId: string;
  amount: number;
  status: string;
  buyerName: string;
  buyerTel: string;
  paidAt: string | null;
  landingPageId: string | null;
}

export interface SalesSummary {
  totalRevenue: number;
  totalRefund:  number;
  netRevenue:   number;
  paidCount:    number;
  month:        string;
}

export interface SalesApiData {
  ok: boolean;
  summary: SalesSummary;
  monthly: MonthlyRow[];
  byLanding: LandingRow[];
  recent: RecentRow[];
  pagination?: { page: number; limit: number; totalCount: number; totalPages: number };
}
