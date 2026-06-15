/**
 * Contact 백업 관련 타입 정의
 */

export interface ContactBackupRecord {
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

export interface BackupResponse {
  ok: boolean;
  message?: string;
  error?: string;
  backup?: {
    id: string;
    sheetId: string;
    backupAt: Date;
    contactCount: number;
  };
  backups?: ContactBackupRecord[];
}

export interface ContactForBackup {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  sourceId?: string | null;
  visibility?: string;
  createdAt?: Date;
}

/**
 * Google Drive 백업 결과
 */
export interface GoogleDriveBackupResult {
  sheetId: string;
  folderId: string;
  backupAt: Date;
  count: number;
}

/**
 * 백업 목록 항목
 */
export interface BackupListItem {
  fileId: string;
  name: string;
  createdAt: string;
  webViewLink?: string;
}
