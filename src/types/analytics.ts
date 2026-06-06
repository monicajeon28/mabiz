/**
 * ShortLink Performance Analytics Types
 */

export interface DailyClickData {
  date: string
  clicks: number
}

export interface ShortLinkPerformanceDetail {
  id: string
  code: string
  title: string | null
  targetUrl: string
  category: string | null
  clickCount: number
  lastClickedAt: Date | null
  createdAt: Date
  dailyClicks?: DailyClickData[]
}

export interface ShortLinkAggregateStats {
  clickCount: number
  averageClicksPerDay: number
  trend: 'up' | 'down' | 'flat'
}

export interface ShortLinkPerformanceResponse {
  ok: boolean
  data: {
    total: ShortLinkAggregateStats
    shortLinks: ShortLinkPerformanceDetail[]
  } | null
  error?: string
}

export interface ShortLinkClickByContact {
  contactId: string | null
  contactName: string | null
  contactPhone: string | null
  clicks: number
  lastClickedAt: Date
}

export interface ShortLinkClicksByContactResponse {
  ok: boolean
  data: ShortLinkClickByContact[] | null
  error?: string
}

/**
 * Analytics Query Parameters
 */

export interface ShortLinkAnalyticsParams {
  organizationId: string
  createdBy: string
  groupBy?: 'daily' | 'hourly'
  days?: number // Default: 7
}

export interface ShortLinkClicksParams {
  linkId: string
  limit?: number // Default: 10
}

/**
 * Export Summary Types
 */

export interface ShortLinkPerformanceExport {
  code: string
  title: string | null
  category: string | null
  totalClicks: number
  weeklyClicks: number
  monthlyClicks: number
  lastClickedAt: string | null
  createdAt: string
  targetUrl: string
}

export interface ShortLinkAnalyticsExportResponse {
  exportDate: string
  organizationId: string
  totalLinks: number
  totalClicks: number
  averageClicksPerDay: number
  trend: 'up' | 'down' | 'flat'
  links: ShortLinkPerformanceExport[]
}
