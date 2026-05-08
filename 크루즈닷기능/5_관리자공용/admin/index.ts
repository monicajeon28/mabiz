// lib/admin/index.ts
// CRM/어드민 전용 배럴 exports
// 사용법: import { calculateCommissionBreakdown } from '@/lib/admin'
//
// 포함: 어필리에이트, 스케줄러, 구글 연동, 백업, 분석/인사이트
// 주의: 기존 import 경로('@/lib/affiliate' 등)는 그대로 유지됩니다.
// 주의: trackPageView 충돌 → analytics는 trackPageView, marketing은 trackMarketingPageView

// ============================================================================
// 어필리에이트 (Affiliate) - affiliate/index.ts가 commission + commission-ledger 포함
// ============================================================================
export * from '../affiliate';

// ============================================================================
// 스케줄러 (Scheduler) - 명시적 export (export *는 가독성 저하)
// ============================================================================

// 고객 생애주기
export {
  reactivateUser,
  updateLastActive,
  startLifecycleManager,
  manualHibernationCheck,
  manualReactivationNotifications,
} from '../scheduler/lifecycleManager';

// 예약 메시지 발송
export {
  startScheduledMessageSender,
  manualProcessScheduledMessages,
} from '../scheduler/scheduledMessageSender';

// 파트너 퍼널 발송
export {
  startPartnerFunnelSender,
  manualProcessFunnelMessages,
} from '../scheduler/partnerFunnelSender';

// DB 백업 스케줄러
export {
  runDatabaseBackup,
  manualRunDatabaseBackup,
  startDatabaseBackupScheduler,
} from '../scheduler/databaseBackup';

// 스프레드시트 백업 스케줄러
export {
  runSpreadsheetBackup,
  manualRunSpreadsheetBackup,
  startSpreadsheetBackupScheduler,
} from '../scheduler/spreadsheetBackup';

// 급여명세서 발송
export {
  sendApprovedPayslips,
  startPayslipSenderScheduler,
  manualSendPayslips,
} from '../scheduler/payslipSender';

// 어필리에이트 링크 정리
export {
  startAffiliateLinkCleanupScheduler,
  runManualCleanup,
} from '../scheduler/affiliateLinkCleanup';

// 여행 상태 업데이터
export {
  startTripStatusScheduler,
  manualUpdateTripStatuses,
} from '../scheduler/tripStatusUpdater';

// 재구매 트리거
export {
  startRePurchaseTriggerScheduler,
  manualCheckTripEnds,
  manualCheckGracePeriodEnds,
} from '../scheduler/rePurchaseTrigger';

// 계약 해지 처리
export {
  recoverDbFromTerminatedContracts,
  recoverSalesAgentDb,
  recoverBranchManagerDb,
} from '../scheduler/contractTerminationHandler';

// 프로액티브 엔진
export {
  startProactiveEngine,
  runProactiveEngineNow,
  manualRunProactiveEngine,
} from '../scheduler/proactiveEngine';

// ============================================================================
// Google Drive / Sheets 연동
// ============================================================================
export {
  getGoogleAuth,
  getDriveClient,
  findOrCreateFolder,
  listFilesInFolder,
  listFoldersInFolder,
  uploadFileToDrive,
  deleteFileFromDrive,
  moveFileToFolder,
  createFolder,
  renameFolder,
  getDriveFileUrl,
  optimizeDriveUrl,
} from '../google-drive';

export {
  uploadAffiliateInfoFile,
  backupContractSignaturesToDrive,
  backupContractPDFToDrive,
  uploadAffiliateFileByType,
} from './google-drive-affiliate-info';

export { uploadCompanyLogo } from './google-drive-company-logo';

export {
  backupImageToGoogleDrive,
  backupProductImages,
} from './google-drive-product-backup';

export {
  getGoogleDriveAuth,
  getGoogleAuthUrl,
  uploadToGoogleDrive,
  getGoogleUserInfo,
  getGoogleDriveFolders,
  uploadToGoogleDriveFolder,
} from '../google/drive';

export {
  backupAllCustomersToSheet,
  backupCustomersByBadgeToSheet,
  backupCustomersByManagerToSheet,
  backupConsultationNotesToSheet,
  backupConsultationsByManagerToSheet,
  backupCustomerToSheet,
  runFullCustomerBackup,
  backupReservationsToSheet,
} from '../google/customer-backup';

export {
  appendB2BLeadToSheet,
  appendSystemConsultationToSheet,
  appendConsultationNoteToSheet,
  appendSystemConsultationNoteToSheet,
} from '../google/b2b-backup';

export {
  sendToGoogleSheet,
  syncApisSpreadsheet,
  syncToMasterApisSheet,
  savePostToSheets,
  saveCommentToSheets,
  updatePassportLinkInApis,
  syncApisWithRetry,
  syncApisInBackground,
} from '../google-sheets';

export {
  ensureTripFolder,
  ensureApisSheet,
  recordPaymentToPurchasedList,
  initApisSheetRows,
  uploadCertificateToDrive,
} from '../google-automation';

export { getGoogleAccessToken } from '../google-auth-jwt';

// ============================================================================
// 드라이브 동기화
// ============================================================================
export {
  syncDirectoryToDrive,
  syncContracts,
  syncDocuments,
  syncAllActiveTripsApis,
  syncLeads,
  syncSales,
  syncSettlements,
} from '../drive-sync';

// ============================================================================
// 백업 시스템
// ============================================================================
export {
  uploadWithLogging,
  logApisSyncResult,
  logContractPdfBackup,
  logDocumentBackup,
  logActivityArchive,
} from '../backup';
export type { BackupType, BackupStatus, BackupLogData } from '../backup/backup-logger';
export { backupLinkData } from '../backup/affiliateDataBackup';

export {
  backupImageToDrive,
  backupImageFromUrl,
  logMessageToSpreadsheet,
  backupEmailWithImages,
  backupSmsLog,
  initializeSpreadsheetHeaders,
} from '../message-backup';

// ============================================================================
// 분석 / 인사이트 (trackPageView 충돌 주의)
// ============================================================================
export {
  trackActivity,
  trackPageView,       // ← analytics.trackPageView (이벤트 기반)
  trackFeature,
} from '../analytics';

export {
  generateDestinationPreference,
  generateSpendingPattern,
  generateFeatureUsage,
  generateRePurchaseScore,
  generateEngagementScore,
  generateSatisfactionScore,
  generateLifecycleStage,
  generateCruisePreference,
  generateCommunicationPreference,
  generateAllInsights,
} from '../insights/generator';

export {
  getCurrentCustomerGroup,
  recordCustomerJourney,
  getCustomerJourneyHistory,
  getCustomerCountByGroup,
} from './customer-journey';
export type { CustomerGroup, TriggerType } from './customer-journey';

export { performanceMonitor, measureApi } from '../performance-monitor';

export {
  getPartnerDashboardStats,
  getAdminDashboardStats,
  invalidateDashboardCache,
  onSaleApproved,
  onSaleRejected,
  onSaleCreated,
  clearAllDashboardCache,
  getDashboardCacheStatus,
} from '../dashboard-sync';

// ============================================================================
// 마케팅 트래킹 (trackPageView → trackMarketingPageView 로 별칭)
// ============================================================================
export {
  trackGA4Event,
  trackFacebookEvent,
  trackNaverEvent,
  trackKakaoEvent,
  trackEvent,
  trackPageView as trackMarketingPageView,  // analytics.trackPageView 와 충돌 방지
  trackPurchase,
  trackViewItem,
  trackLead,
  trackSignUp,
  trackAddToCart,
  trackSearch,
} from '../marketing/tracking';

export {
  schedulePartnerFunnelMessages,
  scheduleAdminFunnelMessages,
} from '../funnel-scheduler';
export type { FunnelScheduleOptions } from '../funnel-scheduler';

// ============================================================================
// 알림 / 푸시
// ============================================================================
export {
  notifyAdminOfApprovalRequest,
  notifyRequesterOfApproval,
  notifyRequesterOfRejection,
} from '../notifications/certificateNotifications';

export {
  requestNotificationPermission as requestAlarmPermission,
  getScheduledAlarms,
  scheduleAlarm,
  removeAlarm,
  clearAllAlarms,
} from '../notifications/scheduleAlarm';
export type { AlarmSchedule } from '../notifications/scheduleAlarm';

// 서버 사이드 웹 푸시
export {
  sendNotificationToUser,
  sendNotificationToUsers,
  sendBroadcastNotification,
  savePushSubscription,
  deletePushSubscription,
} from '../push/server';
export type { NotificationPayload } from '../push/server';

// 클라이언트 사이드 푸시 (클라이언트 컴포넌트에서만 사용)
export {
  registerServiceWorker,
  subscribeToPush,
  saveSubscriptionToServer,
  unsubscribeFromPush,
  checkPushSubscription,
  initializePushNotifications,
} from '../push/client';

// ============================================================================
// 보안
// ============================================================================
export {
  protectApiRequest,
  maskSensitiveData,
  getCorsHeaders,
} from '../security/api-protection';

export { sanitizeResponse, sanitizeError } from '../security/response-sanitizer';
export { isBot, isSuspiciousRequest, isScraperTool } from '../security/bot-detection';

// ============================================================================
// 법적 준수 / 컴플라이언스
// ============================================================================
export {
  checkContractCompliance,
  checkProductCompliance,
  checkSettlementCompliance,
  getComplianceStatusColor,
  getCategoryLabel,
} from './legal-compliance';
export type { ComplianceCheckResult } from './legal-compliance';

// AI 법률/세무/노무 프롬프트
export {
  TAX_ADVISOR_PROMPT,
  LEGAL_ADVISOR_PROMPT,
  LABOR_ADVISOR_PROMPT,
  GENERAL_ADVISOR_PROMPT,
  detectAdvisorType,
  getAdvisorPrompt,
  getAdvisorName,
  DISCLAIMER,
} from '../prompts/legal-advisor';
export type { AdvisorType } from '../prompts/legal-advisor';

// ============================================================================
// 감사 로그
// ============================================================================
export {
  logAudit,
  getClientInfo,
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from './audit-logger';
export type { AuditLogParams } from './audit-logger';

// ============================================================================
// 파트너 인증
// ============================================================================
export { requirePartnerContext, PartnerApiError } from '../partner-auth';

// ============================================================================
// Vercel API
// ============================================================================
export * from './vercel-api';

// ============================================================================
// 이미지 관리
// ============================================================================
export * from '../photos-search';
// image-cache-search.ts와 image-cache-sync.ts 모두 searchImagesFromDB/getSubfoldersFromDB를 export
// → image-cache-search.ts 버전 사용, sync는 syncImageCache만 export
export { searchImagesFromDB, getSubfoldersFromDB } from '../image-cache-search';
export { syncImageCache } from '../image-cache-sync';

// ============================================================================
// 뉴스 / 콘텐츠
// ============================================================================
export * from '../cruisedot-news-access';
export * from '../cruisedot-news-editor';
export * from '../cruisedot-news-template';

// ============================================================================
// 메시지 / 동기화
// ============================================================================
export * from '../apis-sync-queue';

// ============================================================================
// 테스트 모드
// ============================================================================
export * from '../test-mode';

// ============================================================================
// 유튜브
// ============================================================================
export * from '../youtube-video-selector';
export * from '../youtubeScraper';

// ============================================================================
// 인증서 생성
// ============================================================================
export { generateCertificatePng, testCertificateGeneration } from '../certificate-generator';
