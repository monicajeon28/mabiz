/**
 * Aligo SMS API 모듈
 *
 * 기능:
 * - 실제 SMS 발송 (단일/배치)
 * - 배송 상태 추적
 * - 자동 재시도
 *
 * 사용 예시:
 *
 * // 단일 발송
 * const client = createAligoClient(config);
 * const response = await client.sendSms({
 *   receiver: '01012345678',
 *   message: '안녕하세요',
 * });
 *
 * // 배치 발송
 * const batchResponse = await client.sendSmsBatch(requests);
 *
 * // 배송 상태 추적
 * const tracker = await trackSmsDelivery(organizationId);
 */

export {
  AligoClient,
  createAligoClient,
  type AligoConfig,
  type AligoSendRequest,
  type AligoSendResponse,
  type AligoDeliveryStatus,
  type AligoDeliveryStatusRequest,
} from './client';

export {
  trackSmsDelivery,
  trackAllSmsDelivery,
  type DeliveryTrackerResult,
} from './delivery-tracker';

export {
  processPendingSms,
  processAllPendingSms,
  type BatchSenderResult,
} from './batch-sender';

export {
  getServerPublicIP,
  detectAligoSendingIP,
  validateAligoIPWhitelist,
  clearIPCache,
  getIPCacheStatus,
  ALIGO_IP_WHITELIST_DOCS,
  type IPWhitelistStatus,
} from './ip-whitelist';

export {
  validateKoreanMessage,
  detectUnsupportedChars,
  sanitizeForEucKr,
  isSupportedInEucKr,
  canEncodeToEucKr,
  estimateEucKrByteLength,
  calculateMessageType,
  analyzeMessage,
  validateMessageBatch,
  sanitizeMessageBatch,
  ENCODING_ISSUE_TYPES,
  type EncodingValidation,
} from './encoding';
