export interface Campaign {
  id: string;
  title: string;
  status: 'DRAFT' | 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  totalCount: number;
  sentCount: number;
  failedCount: number;  // LIB-TYPES-NEW-001: send/route.ts에서 increment되는 필드 추가
  openCount: number;
  clickCount: number;
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
  ok: boolean;
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

export interface CampaignDetail {
  id: string;
  title: string;
  status: 'DRAFT' | 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  sendAt: string | null;
  createdAt: string;
  failedCount?: number;  // LIB-TYPES-NEW-001: track GET 응답에 포함될 수 있는 failedCount
}

export interface CampaignStats {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  registered: number;
}

export interface CampaignConversionRates {
  sentRate: string;
  openRate: string;
  clickRate: string;
  registrationRate: string;
}

export interface SalesApiData {
  ok: boolean;
  summary: SalesSummary;
  monthly: MonthlyRow[];
  byLanding: LandingRow[];
  recent: RecentRow[];
  // LIB-TYPES-014: API는 항상 pagination을 반환하므로 필수 필드로 변경
  pagination: { page: number; limit: number; totalCount: number; totalPages: number };
  warning?: string;
}

// LIB-TYPES-NEW-002: variants/page.tsx 로컬 정의 인터페이스를 이곳으로 이동 (LIB-TYPES-012 완료)
export interface VariantContent {
  smsBody?: string;
  emailSubject?: string;
  emailBody?: string;
  trafficSplit?: number;
}

export interface Variant {
  id: string;
  variantKey: 'A' | 'B';
  smsBody?: string;
  emailSubject?: string;
  emailBody?: string;
  trafficSplit: number;
  isActive: boolean;
  createdAt: string;
}

export interface StatsData {
  variants: Record<string, {
    sent: number;
    success: number;
    failure: number;
    successRate: number;
  }>;
  analysis: {
    chiSquare?: {
      chi2: number;
      pValue: number;
      isSignificant: boolean;
    };
    cramersV: number;
    recommendation?: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    interpretation: string;
  };
  metadata: {
    sampleSizeRecommendation?: string;
  };
}
