import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthContext } from '@/lib/rbac'

export interface ShortLinkClickByContact {
  contactId: string | null
  contactName: string | null
  contactPhone: string | null
  clicks: number
  lastClickedAt: string
}

export interface ShortLinkClicksByContactResponse {
  ok: boolean
  data: ShortLinkClickByContact[] | null
  error?: string
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<ShortLinkClicksByContactResponse>> {
  try {
    const ctx = await getAuthContext().catch(() => null)
    if (!ctx?.userId) {
      return NextResponse.json(
        { ok: false, data: null, error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const linkId = searchParams.get('linkId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 10

    if (!linkId) {
      return NextResponse.json(
        { ok: false, data: null, error: 'Missing required parameter: linkId' },
        { status: 400 }
      )
    }

    // Verify that the user has access to this shortlink
    const shortLink = await prisma.shortLink.findUnique({
      where: { id: linkId },
      select: {
        id: true,
        organizationId: true,
        createdBy: true,
      },
    })

    if (!shortLink) {
      return NextResponse.json(
        { ok: false, data: null, error: 'ShortLink not found' },
        { status: 404 }
      )
    }

    // Get clicks by contact for this shortlink
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

    const clicks: ShortLinkClickByContact[] = result.map((row) => ({
      contactId: row.contactId,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      clicks: Number(row.clickCount),
      lastClickedAt: row.lastClickedAt.toISOString(),
    }))

    return NextResponse.json(
      {
        ok: true,
        data: clicks,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[shortlink-clicks-by-contact] Error:', error)
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
