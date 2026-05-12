import { z } from 'zod';

export const productImageUploadSchema = z.object({
  cloudinaryPublicId: z.string().min(25).max(255),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  webpPublicId: z.string().min(25).max(255).optional(),
  storagePath: z.string().default('Products'),
  purpose: z.string().default('product'),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  thumbnailUrl: z.string().url().optional(),
  fullUrl: z.string().url().optional(),
  isGif: z.boolean().default(false),
});

export type ProductImageUpload = z.infer<typeof productImageUploadSchema>;

/**
 * PATCH /api/admin/mall/images/[id] 요청 검증
 * 이미지 메타데이터 업데이트 (tags, folder, metadata)
 */
export const productImageUpdateSchema = z.object({
  tags: z
    .array(z.string().max(100))
    .max(50)
    .optional()
    .describe('최대 50개, 각 태그 최대 100자'),
  folder: z
    .string()
    .max(255)
    .optional()
    .describe('폴더 경로, 최대 255자'),
  metadata: z
    .record(z.any())
    .optional()
    .describe('추가 메타데이터'),
});

export type ProductImageUpdate = z.infer<typeof productImageUpdateSchema>;

/**
 * POST /api/products/[id]/images 요청 검증 (클라이언트)
 * FormData로 전송되는 file과 folder 검증
 */
export const imageUploadRequestSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be less than 255 characters')
    .regex(/^[\w\-. ]+\.(jpg|jpeg|png|webp|gif)$/i, 'Invalid file name format'),

  fileSize: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be greater than 0')
    .max(50 * 1024 * 1024, 'File must be less than 50MB'),

  mimeType: z.enum(
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    { message: 'Unsupported image format. Allowed: JPEG, PNG, WebP, GIF' }
  ),
});

export type ImageUploadRequest = z.infer<typeof imageUploadRequestSchema>;
