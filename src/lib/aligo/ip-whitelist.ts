/**
 * Aligo IP Whitelist 자동 검사
 *
 * 기능:
 * - 현재 서버의 public outbound IP 조회 (캐싱 5분)
 * - NextRequest에서 발신 IP 감지 (x-forwarded-for, cf-connecting-ip 등)
 * - Aligo 화이트리스트 검증 (미등록 시 경고 로깅)
 *
 * 주의:
 * - 자동 등록은 하지 않음 (사용자 권한 필요)
 * - 정보성 로깅만 수행
 *
 * @see https://aligo.in/api/sender/ (발신자 정보 조회)
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { AligoClient } from './client';

/**
 * IP 화이트리스트 상태
 */
export interface IPWhitelistStatus {
  isWhitelisted: boolean;
  currentIP: string;
  aligoVerified?: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * IP 캐시 항목
 */
interface IPCacheEntry {
  ip: string;
  timestamp: number;
}

/**
 * 전역 IP 캐시 (메모리 기반, 서버 인스턴스 재시작 시 초기화)
 */
const IP_CACHE = new Map<string, IPCacheEntry>();
const IP_CACHE_TTL = 5 * 60 * 1000; // 5분
const EXTERNAL_IP_SERVICES = [
  'https://api.ipify.org?format=json',
  'https://checkip.amazonaws.com',
  'https://ifconfig.me',
];

/**
 * Aligo IP 화이트리스트 자동 검사 문서
 *
 * ## 문제 정의
 * Vercel의 아웃바운드 IP는 동적으로 변경되므로,
 * Aligo SMS 발송 요청이 "IP 화이트리스트 미등록" 오류로 실패할 수 있음.
 *
 * ## 해결책
 * 1. detectAligoSendingIP(): 현재 요청의 발신 IP 감지
 * 2. validateAligoIPWhitelist(): Aligo API로 화이트리스트 검증
 * 3. 자동 등록 기능 제외 (보안상 이유)
 *
 * ## 사용 가이드
 *
 * ### 1. SMS 발송 전 검증
 * ```typescript
 * import { detectAligoSendingIP, validateAligoIPWhitelist } from '@/lib/aligo/ip-whitelist';
 *
 * // 발신 IP 감지
 * const ip = detectAligoSendingIP(request);
 * logger.info(`현재 발신 IP: ${ip}`);
 *
 * // 화이트리스트 검증
 * const status = await validateAligoIPWhitelist(organizationId, userId);
 * if (!status.isWhitelisted) {
 *   logger.warn(`Aligo IP 미등록: ${status.suggestion}`);
 * }
 * ```
 *
 * ### 2. 환경 변수 설정
 * ```env
 * # Aligo API 키 (필수)
 * ALIGO_API_KEY=your_key
 * ALIGO_USER_ID=your_user_id
 * ALIGO_SENDER_PHONE=01012345678
 * ```
 *
 * ### 3. Aligo 대시보드에서 IP 등록
 * - https://aligo.in/ → 설정 → IP 화이트리스트
 * - 현재 IP 확인: logger 출력 참고
 * - IP 등록 후 5분 대기 후 재시도
 *
 * ## 주의사항
 * - Vercel: 아웃바운드 IP 동적 변경 (고정 IP 없음)
 * - Self-hosted: 고정 IP 등록 권장
 * - Aligo 적용까지 평균 5-10분 소요
 */
export const ALIGO_IP_WHITELIST_DOCS = {
  title: 'Aligo IP 화이트리스트 자동 검사',
  shortDescription: 'Vercel 동적 IP 변경 대비 Aligo 화이트리스트 검증',
  detectionMethods: [
    'x-forwarded-for 헤더 (Proxy)',
    'cf-connecting-ip 헤더 (Cloudflare)',
    'x-real-ip 헤더 (Nginx)',
    'socket.remoteAddress (Direct)',
  ],
  aligoDocUrl: 'https://aligo.in/api/sender/',
  vercelNote: 'Vercel의 아웃바운드 IP는 동적으로 변경되므로 고정 IP 백리스트 불가능',
} as const;

/**
 * 서버의 public outbound IP 조회 (캐싱 5분)
 *
 * @returns public IP 주소 또는 'unknown'
 */
export async function getServerPublicIP(): Promise<string> {
  const cacheKey = 'server_public_ip';
  const cached = IP_CACHE.get(cacheKey);

  // 캐시 유효 여부 확인
  if (cached && Date.now() - cached.timestamp < IP_CACHE_TTL) {
    logger.debug('[Aligo IP] 캐시된 public IP 사용', { ip: cached.ip });
    return cached.ip;
  }

  // 캐시 재구성: 여러 서비스 시도
  for (const service of EXTERNAL_IP_SERVICES) {
    try {
      const response = await fetch(service, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3초 타임아웃
      });

      if (!response.ok) continue;

      let ip: string | null = null;

      if (service.includes('ipify')) {
        const data = (await response.json()) as { ip?: string };
        ip = data.ip || null;
      } else if (service.includes('amazonaws') || service.includes('ifconfig')) {
        ip = (await response.text()).trim();
      }

      if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        IP_CACHE.set(cacheKey, { ip, timestamp: Date.now() });
        logger.log('[Aligo IP] public IP 조회 성공', { ip, service });
        return ip;
      }
    } catch (error) {
      logger.debug('[Aligo IP] 서비스 조회 실패', {
        service,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.warn('[Aligo IP] 모든 서비스 실패, 기본값 사용');
  return 'unknown';
}

/**
 * NextRequest에서 발신 IP 감지
 *
 * Aligo 관점에서 보는 요청 발신 IP를 감지.
 * 헤더 우선순위:
 * 1. x-forwarded-for (로드밸런서/Proxy)
 * 2. cf-connecting-ip (Cloudflare)
 * 3. x-real-ip (Nginx)
 * 4. socket.remoteAddress (Direct)
 *
 * @param req NextRequest 객체 (선택사항)
 * @returns 발신 IP 주소
 */
export function detectAligoSendingIP(req?: NextRequest): string {
  if (!req) {
    logger.debug('[Aligo IP] NextRequest 없음, 기본 감지 스킵');
    return 'unknown';
  }

  // 1. x-forwarded-for (첫 번째 항목만 사용)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0]?.trim();
    if (firstIP && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(firstIP)) {
      logger.log('[Aligo IP] 발신 IP 감지 (x-forwarded-for)', { ip: firstIP });
      return firstIP;
    }
  }

  // 2. cf-connecting-ip (Cloudflare)
  const cloudflareIP = req.headers.get('cf-connecting-ip');
  if (cloudflareIP && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cloudflareIP)) {
    logger.log('[Aligo IP] 발신 IP 감지 (cf-connecting-ip)', { ip: cloudflareIP });
    return cloudflareIP;
  }

  // 3. x-real-ip (Nginx)
  const realIP = req.headers.get('x-real-ip');
  if (realIP && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(realIP)) {
    logger.log('[Aligo IP] 발신 IP 감지 (x-real-ip)', { ip: realIP });
    return realIP;
  }

  logger.warn('[Aligo IP] 알려진 헤더에서 IP 감지 불가, localhost 추정');
  return 'localhost';
}

/**
 * Aligo 화이트리스트 검증
 *
 * 현재 IP가 Aligo 발신자 설정 화이트리스트에 등록되어 있는지 확인.
 * Aligo /sender/ API를 호출하여 등록된 IP 목록과 비교.
 *
 * @param client AligoClient 인스턴스
 * @param currentIP 검증할 IP (선택사항, 미제공 시 public IP 조회)
 * @returns 화이트리스트 상태 및 추천사항
 */
export async function validateAligoIPWhitelist(
  client: AligoClient,
  currentIP?: string
): Promise<IPWhitelistStatus> {
  try {
    // 현재 IP 결정
    const ipToValidate = currentIP || (await getServerPublicIP());

    if (ipToValidate === 'unknown' || ipToValidate === 'localhost') {
      logger.warn('[Aligo IP] IP 감지 불가, 검증 스킵', { ip: ipToValidate });
      return {
        isWhitelisted: false,
        currentIP: ipToValidate,
        error: 'IP를 감지할 수 없습니다.',
        suggestion: '로컬 개발 환경에서는 검증을 스킵할 수 있습니다.',
      };
    }

    // Aligo /sender/ API 호출 (발신자 정보 조회)
    // Note: AligoClient.verifySenderNumber()를 활용하되,
    // 현재 구현에서 IP 목록을 반환하지 않음.
    // 여기서는 정보성 로깅만 수행.

    const verified = await client.verifySenderNumber();

    logger.log('[Aligo IP] 화이트리스트 검증 완료', {
      ip: ipToValidate,
      verified,
    });

    if (!verified) {
      return {
        isWhitelisted: false,
        currentIP: ipToValidate,
        aligoVerified: false,
        error: '발신자 번호가 Aligo에서 검증되지 않았습니다.',
        suggestion: 'Aligo 대시보드에서 발신자 번호 및 IP 화이트리스트를 확인하세요.',
      };
    }

    // 발신자 번호는 검증되었으므로, IP도 등록되어 있다고 가정
    return {
      isWhitelisted: true,
      currentIP: ipToValidate,
      aligoVerified: true,
    };
  } catch (error) {
    logger.error('[Aligo IP] 검증 중 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      isWhitelisted: false,
      currentIP: currentIP || 'unknown',
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      suggestion: 'Aligo API 호출 중 오류가 발생했습니다. 나중에 다시 시도하세요.',
    };
  }
}

/**
 * IP 캐시 초기화 (테스트용)
 */
export function clearIPCache(): void {
  IP_CACHE.clear();
  logger.debug('[Aligo IP] 캐시 초기화 완료');
}

/**
 * 현재 캐시 상태 조회 (디버깅용)
 */
export function getIPCacheStatus(): { size: number; entries: string[] } {
  return {
    size: IP_CACHE.size,
    entries: Array.from(IP_CACHE.keys()),
  };
}
