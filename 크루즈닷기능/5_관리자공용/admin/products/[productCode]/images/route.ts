import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { validateCsrfToken } from '@/lib/csrf'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * AdminProductImage API
 *
 * GET /api/admin/products/[productId]/images
 * - 관리자가 특정 상품의 모든 이미지를 조회
 *
 * PATCH /api/admin/products/[productId]/images
 * - 이미지 정렬 순서 변경 (위치 재배치)
 * - Body: { images: [{id, order}] }
 * - position 필드로 순서 지정
 *
 * DELETE /api/admin/products/[productId]/images/[imageId]
 * - 특정 이미지 삭제 (Soft delete: deletedAt 설정)
 *
 * Security:
 * - 관리자 인증 필수
 * - CSRF 토큰 검증 (PATCH/DELETE)
 * - 상품 존재 확인
 * - 소유권 확인 (storagePath 검증)
 */

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

// Zod 스키마
const reorderImagesSchema = z.object({
  images: z.array(
    z.object({
      id: z.number().int().positive('이미지 ID는 양수여야 합니다.'),
      order: z.number().int().nonnegative('순서는 0 이상이어야 합니다.'),
    })
  )
    .min(1, '최소 1개의 이미지가 필요합니다.')
    .max(100, '최대 100개의 이미지까지만 정렬할 수 있습니다.'),
})

interface ProductImage {
  id: number
  cloudinaryPublicId: string
  cloudinaryUrl: string
  size: number
  createdAt: Date
}

interface GetProductImagesResponse {
  ok: boolean
  images?: ProductImage[]
  total?: number
  page?: number
  limit?: number
  error?: string
}

interface ReorderResponse {
  ok: boolean
  error?: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
): Promise<NextResponse<GetProductImagesResponse>> {
  try {
    // 관리자 인증 확인
    const { isAdmin } = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      )
    }

    const { productId } = await params

    // productId 유효성 검증
    const parsedProductId = parseInt(productId, 10)
    if (isNaN(parsedProductId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 상품 ID입니다.' },
        { status: 400 }
      )
    }

    // 상품 존재 여부 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { id: parsedProductId },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE)
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

    // 전체 이미지 개수 조회 (soft delete 제외)
    const total = await prisma.productImage.count({
      where: {
        storagePath: `products/${parsedProductId}`,
        deletedAt: null
      }
    })

    // 페이지네이션 계산
    const offset = (page - 1) * limit

    // 이미지 목록 조회 (위치순, 최신순)
    const images = await prisma.productImage.findMany({
      where: {
        storagePath: `products/${parsedProductId}`,
        deletedAt: null
      },
      select: {
        id: true,
        cloudinaryPublicId: true,
        fullUrl: true,
        fileSize: true,
        position: true,
        createdAt: true
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      skip: offset,
      take: limit
    })

    // Cloudinary URL 생성 및 위치 정보 포함
    const formattedImages: ProductImage[] = images.map((img, idx) => ({
      id: img.id,
      cloudinaryPublicId: img.cloudinaryPublicId,
      cloudinaryUrl: img.fullUrl ||
        (process.env.CLOUDINARY_CLOUD_NAME
          ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${img.cloudinaryPublicId}`
          : ''),
      size: img.fileSize,
      position: img.position || idx,
      createdAt: img.createdAt
    }))

    logger.log('[AdminProductImages GET] Success:', {
      productId: parsedProductId,
      total,
      page,
      limit,
      returned: formattedImages.length
    })

    return NextResponse.json({
      ok: true,
      images: formattedImages,
      total,
      page,
      limit
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[AdminProductImages GET] Error:', { error: errorMessage })

    return NextResponse.json(
      { ok: false, error: '이미지 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/products/[productId]/images
 *
 * 이미지 정렬 순서 변경
 *
 * Body:
 * {
 *   images: [
 *     { id: 1, order: 0 },
 *     { id: 2, order: 1 },
 *     { id: 3, order: 2 }
 *   ]
 * }
 *
 * Response:
 * - 200: { ok: true }
 * - 400: 입력 검증 실패 또는 CSRF 검증 실패
 * - 403: 관리자 권한 없음
 * - 404: 상품 없음
 * - 500: 서버 오류
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
): Promise<NextResponse<ReorderResponse>> {
  try {
    // 관리자 인증 확인
    const { isAdmin } = await checkAdminAuth()
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      )
    }

    const { productId } = await params

    // productId 유효성 검증
    const parsedProductId = parseInt(productId, 10)
    if (isNaN(parsedProductId)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 상품 ID입니다.' },
        { status: 400 }
      )
    }

    // CSRF 토큰 검증
    const csrfToken = req.headers.get('x-csrf-token')
    const cookies = req.cookies.get('csrf-token')?.value

    if (!validateCsrfToken(cookies, csrfToken)) {
      logger.warn('[AdminProductImages PATCH] CSRF validation failed:', {
        productId: parsedProductId,
      })
      return NextResponse.json(
        { ok: false, error: 'CSRF 검증 실패' },
        { status: 400 }
      )
    }

    // 상품 존재 여부 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { id: parsedProductId },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 요청 본문 파싱
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'JSON 파싱 실패' },
        { status: 400 }
      )
    }

    // Zod 스키마로 검증
    const validation = reorderImagesSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      logger.warn('[AdminProductImages PATCH] Validation failed:', { errors, productId: parsedProductId })
      return NextResponse.json(
        { ok: false, error: `입력 검증 실패: ${errors}` },
        { status: 400 }
      )
    }

    const { images } = validation.data

    // 이미지 ID 유효성 검증 (모두 storagePath가 올바른지 확인)
    const imageIds = images.map(img => img.id)
    const existingImages = await prisma.productImage.findMany({
      where: {
        id: { in: imageIds },
        storagePath: `products/${parsedProductId}`,
        deletedAt: null
      },
      select: { id: true }
    })

    if (existingImages.length !== imageIds.length) {
      return NextResponse.json(
        { ok: false, error: '일부 이미지를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // B-B-2: Serializable 격리 수준으로 동시성 제어
    // B-P-1: 배치 포지션 업데이트 (병렬 실행)
    // 여러 관리자가 동시에 이미지를 재정렬할 때 race condition 방지
    // Serializable 격리로 한 트랜잭션만 성공하고 나머지는 재시도
    await prisma.$transaction(
      images.map(img =>
        prisma.productImage.update({
          where: { id: img.id },
          data: { position: img.order }
        })
      ),
      {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 30000
      }
    )

    logger.log('[AdminProductImages PATCH] Success:', {
      productId: parsedProductId,
      imageCount: images.length
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[AdminProductImages PATCH] Error:', { error: errorMessage })

    return NextResponse.json(
      { ok: false, error: '이미지 정렬 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
