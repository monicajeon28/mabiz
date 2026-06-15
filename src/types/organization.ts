/**
 * Organization 및 ContactBackup 타입 정의
 */

export interface ContactBackup {
  id: string;
  organizationId: string;
  backupAt: Date;
  contactCount: number;
  driveSheetId?: string | null;
  backupType: 'MANUAL' | 'AUTO' | 'API';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationWithBackup {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  googleDriveAccessToken?: string | null; // OAuth 액세스 토큰 (암호화됨)
  googleDriveFolderId?: string | null; // 백업 폴더 ID (root: 마비즈CRM-Backup)
  contactBackups?: ContactBackup[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupResult {
  sheetId: string;
  folderId?: string;
  backupAt: Date;
  count: number;
}

export interface BackupFolderStructure {
  rootFolder: string; // 마비즈CRM-Backup
  yearMonthFolder: string; // 2026-06
  sheetPath: string; // Contact_2026-06-15
}
