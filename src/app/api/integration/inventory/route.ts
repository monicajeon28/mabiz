import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Bearer Token 인증 (크루즈닷몰 → CRM 단방향)
function verifyIntegrationToken(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.MABIZ_INTEGRATION_SECRET ?? ''
  if (!secret) return false
  return auth === 'Bearer ' + secret
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyIntegrationToken(req)) {
      return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 })
    }

    const productCode = req.nextUrl.searchParams.get('productCode')
    if (!productCode) {
      return NextResponse.json({ ok: false, message: 'productCode 필수' }, { status: 400 })
    }

    const inventories = await prisma.cabinInventory.findMany({
      where: { tripCode: productCode },
      select: {
        organizationId: true,
        cabinType: true,
        totalCount: true,
        bookedCount: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { cabinType: 'asc' },
    })

    // cabinType별 집계 (조직 합산)
    const snapshot: Record<string, { total: number; booked: number; remaining: number }> = {}
    for (const inv of inventories) {
      if (!snapshot[inv.cabinType]) {
        snapshot[inv.cabinType] = { total: 0, booked: 0, remaining: 0 }
      }
      snapshot[inv.cabinType].total += inv.totalCount
      snapshot[inv.cabinType].booked += inv.bookedCount
      snapshot[inv.cabinType].remaining += Math.max(0, inv.totalCount - inv.bookedCount)
    }

    logger.info('[GET /api/integration/inventory]', { productCode, types: Object.keys(snapshot).length })

    return NextResponse.json({
      ok: true,
      productCode,
      snapshot,
      retrievedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    logger.error('[GET /api/integration/inventory]', { err })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
