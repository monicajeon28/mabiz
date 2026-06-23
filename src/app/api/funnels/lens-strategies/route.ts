import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/rbac'
import type { PsychologyLens } from '@/types/funnel-wizard'
import { LENS_DETAILS } from '@/types/funnel-wizard'

interface LensStrategy {
  id: string
  title: string
  description: string
}

interface LensStrategiesResponse {
  strategies: Record<PsychologyLens, {
    lens: PsychologyLens
    name: string
    description: string
    strategies: LensStrategy[]
  }>
}

// GET /api/funnels/lens-strategies
// 판매원 마법사 Step 1-2에서 렌즈와 전략 목록 조회
export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx.userId) {
      return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 })
    }

    // L0~L10 렌즈별 전략 목록 구성
    const strategies: LensStrategiesResponse['strategies'] = {} as any

    const lenses = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'] as const

    for (const lens of lenses) {
      const detail = LENS_DETAILS[lens]
      strategies[lens] = {
        lens,
        name: detail.name,
        description: detail.description,
        strategies: detail.strategies.map((title, idx) => ({
          id: `${lens}-strategy-${idx}`,
          title,
          description: `${title} 전략으로 고객 설득`,
        })),
      }
    }

    return NextResponse.json({
      ok: true,
      data: { strategies },
    })
  } catch (error) {
    console.error('❌ GET /api/funnels/lens-strategies 에러:', error)
    return NextResponse.json(
      { ok: false, error: '서버 에러' },
      { status: 500 }
    )
  }
}
