import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthContext, resolveOrgId } from '@/lib/rbac'

interface PreviewRequest {
  contactId: string
  psychologyLens: string
  messages: Record<string, string>
  startDate?: string
  hour?: number
}

// GET /api/funnels/preview
// 판매원이 입력한 Day 0-3 메시지 미리보기
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx.userId) {
      return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 })
    }

    const orgId = resolveOrgId(ctx)
    if (!orgId) {
      return NextResponse.json({ ok: false, error: '조직 정보 필요' }, { status: 403 })
    }

    const url = new URL(req.url)
    const contactId = url.searchParams.get('contactId')
    const lens = url.searchParams.get('lens')
    const startDate = url.searchParams.get('startDate') || new Date().toISOString().split('T')[0]
    const hour = parseInt(url.searchParams.get('hour') || '12')

    if (!contactId || !lens) {
      return NextResponse.json(
        { ok: false, error: '필수 파라미터 누락' },
        { status: 400 }
      )
    }

    // Contact 조회 (동적 변수 치환용)
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
    })

    if (!contact) {
      return NextResponse.json(
        { ok: false, error: '고객을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 동적 변수 치환 함수
    const substituteVariables = (text: string): string => {
      let result = text
      result = result.replace(/\{\{고객명\}\}/g, contact.name || '홍길동')
      result = result.replace(/\{\{전화번호\}\}/g, contact?.phone || '010-0000-0000')
      result = result.replace(/\{\{담당자명\}\}/g, ctx.userId || '담당자')
      result = result.replace(/\{\{상품명\}\}/g, '크루즈 상품')
      result = result.replace(/\{\{출발일\}\}/g, new Date().toLocaleDateString('ko-KR'))
      return result
    }

    // Day 0-3 미리보기 생성
    const baseDate = new Date(startDate)
    baseDate.setHours(hour, 0, 0, 0)

    const preview = []
    for (let day = 0; day < 4; day++) {
      const msgKey = day.toString()
      const rawMessage = url.searchParams.get(`msg${day}`) || ''

      if (!rawMessage) continue

      const scheduledAt = new Date(baseDate)
      scheduledAt.setDate(scheduledAt.getDate() + day)

      preview.push({
        day,
        scheduledAt: scheduledAt.toISOString(),
        scheduledAtFormatted: scheduledAt.toLocaleDateString('ko-KR', {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        message: rawMessage,
        rendered: substituteVariables(rawMessage),
      })
    }

    return NextResponse.json({
      ok: true,
      data: {
        contactName: contact.name,
        preview,
      },
    })
  } catch (error) {
    console.error('❌ GET /api/funnels/preview 에러:', error)
    return NextResponse.json(
      { ok: false, error: '서버 에러' },
      { status: 500 }
    )
  }
}
