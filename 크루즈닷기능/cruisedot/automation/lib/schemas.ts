import { z } from 'zod';

/**
 * Google Drive → Cloudinary 동기화 입력 검증 스키마
 */

export const SyncFolderSchema = z.object({
  folderId: z.string().min(1, 'Folder ID is required').max(255),
  maxFileSize: z.number().positive().default(50 * 1024 * 1024), // 50MB default
  batchSize: z.number().int().min(1).max(50).default(15),
  maxRetries: z.number().int().min(1).max(5).default(3),
  timeoutMs: z.number().int().min(1000).default(300000), // 300초
});

export const SyncFileSchema = z.object({
  googleFileId: z.string().min(1, 'Google File ID is required').max(255),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive('File size must be positive'),
  mimeType: z.string().default('image/jpeg'),
});

export const FilesListSchema = z.object({
  files: z.array(SyncFileSchema),
  folderId: z.string().min(1).max(255),
});

export const SyncResultSchema = z.object({
  totalFiles: z.number().int().nonnegative(),
  uploadedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  errors: z.array(z.object({
    googleFileId: z.string(),
    fileName: z.string(),
    reason: z.string(),
  })).default([]),
  duration: z.number().int().nonnegative(),
});

export type SyncFolder = z.infer<typeof SyncFolderSchema>;
export type SyncFile = z.infer<typeof SyncFileSchema>;
export type FilesList = z.infer<typeof FilesListSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
