/**
 * B-C-2: ProductImage API 스키마 (Zod)
 *
 * 목표: 4개의 any 타입 제거, 정확한 타입 안전성 확보
 */

import { z } from 'zod'

/**
 * Cloudinary 폴더 형식 검증
 * - 예: "products/P001", "cruise-images/ACT001"
 */
export const cloudinaryFolderSchema = z
  .string()
  .regex(/^[a-z0-9\-/]+$/, 'Invalid folder format')
  .min(5)
  .max(255)

/**
 * ProductImage 업데이트 스키마
 */
export const ProductImageUpdateSchema = z.object({
  tags: z
    .array(z.string().max(50))
    .max(10)
    .optional()
    .describe('이미지 태그 (최대 10개, 각 50자)'),

  folder: cloudinaryFolderSchema.optional().describe('Cloudinary 폴더'),

  metadata: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .max(10)
    .optional()
    .describe('메타데이터 (스칼라만, 최대 10개 키)'),

  position: z
    .number()
    .int()
    .nonnegative()
    .max(999)
    .optional()
    .describe('정렬 순서 (0-999)'),
})

export type ProductImageUpdate = z.infer<typeof ProductImageUpdateSchema>

/**
 * 이미지 재정렬 스키마
 */
export const ReorderImagesSchema = z.object({
  images: z
    .array(
      z.object({
        id: z
          .number()
          .int()
          .positive()
          .describe('이미지 ID'),
        position: z
          .number()
          .int()
          .nonnegative()
          .max(999)
          .describe('새로운 순서 (0-999)'),
      })
    )
    .min(1)
    .max(500)
    .refine(
      (images) => {
        const positions = new Set(images.map((img) => img.position))
        return positions.size === images.length // 중복 position 불가
      },
      { message: 'Duplicate positions not allowed' }
    )
    .describe('재정렬할 이미지들'),
})

export type ReorderImages = z.infer<typeof ReorderImagesSchema>

/**
 * ProductImage GET 응답 스키마
 */
export const ProductImageResponseSchema = z.object({
  id: z.number(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  cloudinaryPublicId: z.string(),
  webpPublicId: z.string().nullable(),
  fullUrl: z.string().url(),
  webpUrl: z.string().url().nullable(),
  position: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.unknown()).nullable(),
})

export type ProductImageResponse = z.infer<typeof ProductImageResponseSchema>

/**
 * ProductImage LIST 응답 스키마
 */
export const ProductImagesListSchema = z.object({
  ok: z.boolean(),
  images: z.array(ProductImageResponseSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
  }),
})

export type ProductImagesList = z.infer<typeof ProductImagesListSchema>

/**
 * 에러 응답 스키마
 */
export const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

/**
 * API 응답 유니온 타입
 */
export const ProductImageApiResponseSchema = z.union([
  ProductImageResponseSchema,
  ProductImagesListSchema,
  ErrorResponseSchema,
])

export type ProductImageApiResponse = z.infer<
  typeof ProductImageApiResponseSchema
>

/**
 * 파일 업로드 바디 (multipart/form-data)
 */
export const FileUploadSchema = z.object({
  file: z.instanceof(File).describe('이미지 파일'),
  tags: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .optional()
    .describe('쉼표로 구분된 태그'),
})

export type FileUpload = z.infer<typeof FileUploadSchema>

/**
 * 스키마 검증 헬퍼
 */
export function validateProductImageUpdate(data: unknown) {
  return ProductImageUpdateSchema.safeParse(data)
}

export function validateReorderImages(data: unknown) {
  return ReorderImagesSchema.safeParse(data)
}

export function validateFileUpload(data: unknown) {
  return FileUploadSchema.safeParse(data)
}
