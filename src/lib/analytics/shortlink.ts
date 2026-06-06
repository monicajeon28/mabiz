import prisma from '@/lib/prisma'

export interface ShortLinkAnalytics {
  linkId: string
  code: string
  title: string | null
  targetUrl: string
  category: string | null
  clickCount: number
  lastClickedAt: Date | null
  createdAt: Date
  dailyClicks: Array<{
    date: string
    clicks: number
  }>
  weeklyClicks?: number
  monthlyClicks?: number
  conversionRate?: number // Optional: clicks per unique users
}

/**
 * Get shortlink performance analytics for an organization
 * @param organizationId Organization ID
 * @param createdBy User ID (for filtering shortlinks created by this user)
 * @param days Number of days to look back (default: 7)
 * @returns Analytics data for all active shortlinks
 */
export async function getShortLinkAnalytics(
  organizationId: string,
  createdBy: string,
  days: number = 7
): Promise<ShortLinkAnalytics[]> {
  const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Get all active shortlinks for the user
  const shortLinks = await prisma.shortLink.findMany({
    where: {
      organizationId,
      createdBy,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      title: true,
      targetUrl: true,
      category: true,
      createdAt: true,
      clickCount: true,
    },
  })

  if (shortLinks.length === 0) {
    return []
  }

  const shortLinkIds = shortLinks.map((l) => l.id)

  // Get click statistics
  const clickStats = await prisma.shortLinkClick.groupBy({
    by: ['linkId'],
    where: {
      linkId: { in: shortLinkIds },
    },
    _count: { id: true },
    _max: { clickedAt: true },
  })

  const clickStatsMap = new Map(clickStats.map((s) => [s.linkId, s]))

  // Get time series data
  const timeSeriesData = await prisma.$queryRaw<
    Array<{
      linkId: string
      date: string
      clickCount: bigint
    }>
  >`
    SELECT
      "linkId",
      DATE(TIMEZONE('UTC', "clickedAt")) as "date",
      COUNT(*) as "clickCount"
    FROM "ShortLinkClick"
    WHERE "linkId" = ANY($1::TEXT[])
      AND "clickedAt" >= $2
    GROUP BY "linkId", DATE(TIMEZONE('UTC', "clickedAt"))
    ORDER BY DATE(TIMEZONE('UTC', "clickedAt")) ASC
  `

  const timeSeriesMap = new Map<
    string,
    Array<{ date: string; clicks: number }>
  >()
  shortLinkIds.forEach((id) => {
    timeSeriesMap.set(id, [])
  })

  timeSeriesData.forEach((row) => {
    const existing = timeSeriesMap.get(row.linkId) || []
    existing.push({
      date: row.date,
      clicks: Number(row.clickCount),
    })
    timeSeriesMap.set(row.linkId, existing)
  })

  // Get weekly and monthly click counts
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const weeklyStats = await prisma.shortLinkClick.groupBy({
    by: ['linkId'],
    where: {
      linkId: { in: shortLinkIds },
      clickedAt: { gte: weekAgo },
    },
    _count: { id: true },
  })

  const monthlyStats = await prisma.shortLinkClick.groupBy({
    by: ['linkId'],
    where: {
      linkId: { in: shortLinkIds },
      clickedAt: { gte: monthAgo },
    },
    _count: { id: true },
  })

  const weeklyStatsMap = new Map(weeklyStats.map((s) => [s.linkId, s._count.id]))
  const monthlyStatsMap = new Map(
    monthlyStats.map((s) => [s.linkId, s._count.id])
  )

  // Combine data
  const analytics: ShortLinkAnalytics[] = shortLinks.map((link) => {
    const stats = clickStatsMap.get(link.id)
    const timeSeries = timeSeriesMap.get(link.id) || []
    const weeklyClicks = weeklyStatsMap.get(link.id) || 0
    const monthlyClicks = monthlyStatsMap.get(link.id) || 0

    return {
      linkId: link.id,
      code: link.code,
      title: link.title,
      targetUrl: link.targetUrl,
      category: link.category,
      clickCount: stats?._count.id || 0,
      lastClickedAt: stats?._max.clickedAt || null,
      createdAt: link.createdAt,
      dailyClicks: timeSeries,
      weeklyClicks,
      monthlyClicks,
    }
  })

  return analytics.sort((a, b) => b.clickCount - a.clickCount)
}

/**
 * Get aggregate statistics for all shortlinks
 */
export async function getShortLinkAggregateStats(
  organizationId: string,
  createdBy: string,
  days: number = 7
): Promise<{
  totalClicks: number
  averageClicksPerDay: number
  trend: 'up' | 'down' | 'flat'
  linkCount: number
  topLink: { code: string; clicks: number } | null
}> {
  const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const halfDays = Math.ceil(days / 2)
  const midpoint = new Date(Date.now() - halfDays * 24 * 60 * 60 * 1000)

  const shortLinks = await prisma.shortLink.findMany({
    where: {
      organizationId,
      createdBy,
      isActive: true,
    },
    select: { id: true, code: true },
  })

  if (shortLinks.length === 0) {
    return {
      totalClicks: 0,
      averageClicksPerDay: 0,
      trend: 'flat',
      linkCount: 0,
      topLink: null,
    }
  }

  const shortLinkIds = shortLinks.map((l) => l.id)

  // Total clicks
  const totalClicks = await prisma.shortLinkClick.count({
    where: {
      linkId: { in: shortLinkIds },
      clickedAt: { gte: daysAgo },
    },
  })

  // Trend calculation
  const firstHalfClicks = await prisma.shortLinkClick.count({
    where: {
      linkId: { in: shortLinkIds },
      clickedAt: {
        gte: daysAgo,
        lt: midpoint,
      },
    },
  })

  const secondHalfClicks = await prisma.shortLinkClick.count({
    where: {
      linkId: { in: shortLinkIds },
      clickedAt: { gte: midpoint },
    },
  })

  const trend =
    firstHalfClicks === 0
      ? ('up' as const)
      : secondHalfClicks > firstHalfClicks
        ? ('up' as const)
        : secondHalfClicks < firstHalfClicks
          ? ('down' as const)
          : ('flat' as const)

  // Top link
  const topLinkStats = await prisma.shortLinkClick.groupBy({
    by: ['linkId'],
    where: {
      linkId: { in: shortLinkIds },
      clickedAt: { gte: daysAgo },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1,
  })

  const topLink =
    topLinkStats.length > 0
      ? {
          code: shortLinks.find((l) => l.id === topLinkStats[0].linkId)?.code || '',
          clicks: topLinkStats[0]._count.id,
        }
      : null

  return {
    totalClicks,
    averageClicksPerDay: Math.round((totalClicks / days) * 100) / 100,
    trend,
    linkCount: shortLinks.length,
    topLink,
  }
}

/**
 * Get clicks by contact for a shortlink
 */
export async function getShortLinkClicksByContact(
  linkId: string,
  limit: number = 10
): Promise<
  Array<{
    contactId: string | null
    contactName: string | null
    contactPhone: string | null
    clicks: number
    lastClickedAt: Date
  }>
> {
  const result = await prisma.$queryRaw<
    Array<{
      contactId: string | null
      contactName: string | null
      contactPhone: string | null
      clickCount: bigint
      lastClickedAt: Date
    }>
  >`
    SELECT
      slc."contactId",
      c."name" as "contactName",
      c."phone" as "contactPhone",
      COUNT(*) as "clickCount",
      MAX(slc."clickedAt") as "lastClickedAt"
    FROM "ShortLinkClick" slc
    LEFT JOIN "Contact" c ON slc."contactId" = c."id"
    WHERE slc."linkId" = $1
    GROUP BY slc."contactId", c."name", c."phone"
    ORDER BY "clickCount" DESC
    LIMIT $2
  `

  return result.map((row) => ({
    contactId: row.contactId,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    clicks: Number(row.clickCount),
    lastClickedAt: row.lastClickedAt,
  }))
}
