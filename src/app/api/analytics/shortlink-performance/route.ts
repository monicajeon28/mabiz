import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthContext } from '@/lib/rbac'

interface ClicksByDate {
  date: string
  clicks: number
}

interface ShortLinkPerformance {
  id: string
  code: string
  title: string | null
  targetUrl: string
  clickCount: number
  lastClickedAt: Date | null
  createdAt: Date
  category: string | null
  dailyClicks?: ClicksByDate[]
}

interface AnalyticsResponse {
  ok: boolean
  data: {
    total: {
      clickCount: number
      averageClicksPerDay: number
      trend: 'up' | 'down' | 'flat'
    }
    shortLinks: ShortLinkPerformance[]
  } | null
  error?: string
}

export async function GET(req: NextRequest): Promise<NextResponse<AnalyticsResponse>> {
  try {
    const ctx = await getAuthContext().catch(() => null)
    if (!ctx?.userId) {
      return NextResponse.json(
        { ok: false, data: null, error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId')
    const createdBy = searchParams.get('createdBy')
    const groupBy = searchParams.get('groupBy') || 'daily' // 'daily' | 'hourly'
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam, 10) : 7

    if (!organizationId || !createdBy) {
      return NextResponse.json(
        { ok: false, data: null, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // 1. 조직의 모든 활성 숏링크 조회 (사용자별 격리)
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
      },
    })

    if (shortLinks.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            total: {
              clickCount: 0,
              averageClicksPerDay: 0,
              trend: 'flat' as const,
            },
            shortLinks: [],
          },
        },
        { status: 200 }
      )
    }

    const shortLinkIds = shortLinks.map((l) => l.id)
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // 2. 각 링크별 클릭 통계 & 최근 클릭 시간
    const clickStats = await prisma.shortLinkClick.groupBy({
      by: ['linkId'],
      where: {
        linkId: { in: shortLinkIds },
      },
      _count: { id: true },
      _max: { clickedAt: true },
    })

    const clickStatsMap = new Map(clickStats.map((s) => [s.linkId, s]))

    // 3. 시계열 데이터 (groupBy: daily | hourly)
    const dailyClicksData = await prisma.shortLinkClick.groupBy({
      by: ['linkId'],
      where: {
        linkId: { in: shortLinkIds },
        clickedAt: { gte: daysAgo },
      },
      _count: { id: true },
    })

    // 더 세밀한 시계열 데이터를 위해 raw query 사용
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

    // 4. 성능 데이터 조합
    const shortLinkPerformances: ShortLinkPerformance[] = shortLinks.map(
      (link) => {
        const stats = clickStatsMap.get(link.id)
        const timeSeries = timeSeriesMap.get(link.id) || []

        return {
          id: link.id,
          code: link.code,
          title: link.title,
          targetUrl: link.targetUrl,
          category: link.category,
          clickCount: stats?._count.id || 0,
          lastClickedAt: stats?._max.clickedAt || null,
          createdAt: link.createdAt,
          dailyClicks: timeSeries,
        }
      }
    )

    // 5. 전체 통계 계산
    const totalClicks = shortLinkPerformances.reduce(
      (sum, link) => sum + link.clickCount,
      0
    )
    const averageClicksPerDay = totalClicks / days

    // Trend 계산: 이전 절반 vs 최근 절반
    const halfDays = Math.ceil(days / 2)
    const midpoint = new Date(Date.now() - halfDays * 24 * 60 * 60 * 1000)

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

    return NextResponse.json(
      {
        ok: true,
        data: {
          total: {
            clickCount: totalClicks,
            averageClicksPerDay: Math.round(averageClicksPerDay * 100) / 100,
            trend,
          },
          shortLinks: shortLinkPerformances.sort(
            (a, b) => b.clickCount - a.clickCount
          ),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[shortlink-performance] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
