/**
 * Landing Pages API Client
 * 모든 랜딩페이지 관련 API 호출을 중앙화
 * 성능 최적화: Promise.all로 병렬 호출
 */

import { logger } from '@/lib/logger';
import { csrfFetch } from '@/lib/csrf-client';
import type {
  LandingPage,
  SharedLandingPage,
  StatsData,
  BranchManagerOption,
  BranchManagerApiProfile,
  LandingPageRegistration,
  SharedLandingRecipient,
  FetchLandingPagesResponse,
  FetchBonusShareCountResponse,
  FetchStatsResponse,
  ClonePageResponse,
  GenerateShortcutResponse,
  SharePageResponse,
  FetchShareRecipientsResponse,
  RevokeShareResponse,
  FetchRegistrationsResponse,
  DeleteRegistrationResponse,
  DeletePageResponse,
  FetchPagesWithQuotasResult,
} from '../types';

/**
 * 랜딩페이지 목록과 보너스 공유 수량을 병렬로 조회
 * Promise.all로 성능 최적화 (2개 API 동시 호출)
 *
 * @param category - 필터링할 카테고리 (생략 시 전체)
 * @returns 랜딩페이지 목록과 보너스 공유 수량
 */
export async function fetchLandingPagesWithQuotas(
  category?: string
): Promise<FetchPagesWithQuotasResult> {
  try {
    const pagesUrl = category && category !== '전체'
      ? `/api/partner/landing-pages?category=${encodeURIComponent(category)}`
      : '/api/partner/landing-pages';

    // Promise.all로 2개 API를 동시에 호출 (성능 개선)
    const [pagesRes, bonusRes] = await Promise.all([
      fetch(pagesUrl, { credentials: 'include' }),
      fetch('/api/partner/landing-pages/shared-by-me', { credentials: 'include' }),
    ]);

    const [pagesData, bonusData] = await Promise.all([
      pagesRes.json() as Promise<FetchLandingPagesResponse>,
      bonusRes.json() as Promise<FetchBonusShareCountResponse>,
    ]);

    // 첫 번째 API 에러 체크
    if (!pagesRes.ok || !pagesData.ok) {
      throw new Error(
        pagesData.error || '랜딩페이지 목록을 불러올 수 없습니다.'
      );
    }

    // 두 번째 API 에러는 기본값 처리 (선택적)
    const bonusCount = bonusRes.ok && bonusData.ok ? bonusData.count ?? 0 : 0;

    return {
      pages: pagesData,
      bonus: { ok: true, count: bonusCount },
    };
  } catch (error) {
    logger.error('[fetchLandingPagesWithQuotas] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 랜딩페이지 목록 조회 (카테고리 필터 선택)
 *
 * @param category - 필터링할 카테고리
 * @returns 랜딩페이지 목록 응답
 */
export async function fetchLandingPages(
  category?: string
): Promise<FetchLandingPagesResponse> {
  try {
    const url = category && category !== '전체'
      ? `/api/partner/landing-pages?category=${encodeURIComponent(category)}`
      : '/api/partner/landing-pages';

    const response = await fetch(url, { credentials: 'include' });
    const data = (await response.json()) as FetchLandingPagesResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '랜딩페이지 목록을 불러올 수 없습니다.');
    }

    return data;
  } catch (error) {
    logger.error('[fetchLandingPages] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 보너스 공유 수량 조회
 *
 * @returns 자신이 공유한 페이지 개수
 */
export async function fetchBonusShareCount(): Promise<number> {
  try {
    const response = await fetch('/api/partner/landing-pages/shared-by-me', {
      credentials: 'include',
    });
    const data = (await response.json()) as FetchBonusShareCountResponse;

    return data.ok ? data.count ?? 0 : 0;
  } catch (error) {
    logger.error('[fetchBonusShareCount] Error:', error instanceof Error ? error.message : String(error));
    return 0; // 에러 시 0 반환
  }
}

/**
 * 랜딩페이지 삭제
 *
 * @param pageId - 삭제할 페이지 ID
 * @returns 삭제 성공 여부
 */
export async function deleteLandingPage(pageId: number): Promise<boolean> {
  try {
    const response = await csrfFetch(`/api/partner/landing-pages/${pageId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const data = (await response.json()) as DeletePageResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '랜딩페이지 삭제에 실패했습니다.');
    }

    return true;
  } catch (error) {
    logger.error('[deleteLandingPage] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 공유받은 랜딩페이지 복제 (내 계정으로 복사)
 *
 * @param pageId - 복제할 페이지 ID
 * @returns 새로 생성된 페이지 ID
 */
export async function cloneLandingPage(pageId: number): Promise<number> {
  try {
    const response = await csrfFetch(`/api/partner/landing-pages/${pageId}/clone`, {
      method: 'POST',
      credentials: 'include',
    });

    const data = (await response.json()) as ClonePageResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '랜딩페이지 복사에 실패했습니다.');
    }

    if (!data.landingPage?.id) {
      throw new Error('복제된 페이지 ID를 받을 수 없습니다.');
    }

    return data.landingPage.id;
  } catch (error) {
    logger.error('[cloneLandingPage] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 숏컷 URL 생성/재생성
 *
 * @param pageId - 페이지 ID
 * @returns 생성된 숏컷 URL
 */
export async function generateShortcutUrl(pageId: number): Promise<string> {
  try {
    const response = await csrfFetch(`/api/admin/landing-pages/${pageId}/shortcut`, {
      method: 'POST',
      credentials: 'include',
    });

    const data = (await response.json()) as GenerateShortcutResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '바로가기 URL 생성에 실패했습니다.');
    }

    if (!data.shortcutUrl) {
      throw new Error('생성된 URL이 없습니다.');
    }

    return data.shortcutUrl;
  } catch (error) {
    logger.error('[generateShortcutUrl] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 랜딩페이지 통계 조회
 *
 * @param pageId - 페이지 ID
 * @returns 통계 데이터
 */
export async function fetchStats(pageId: number): Promise<StatsData> {
  try {
    const response = await fetch(`/api/partner/landing-pages/${pageId}/stats`, {
      credentials: 'include',
    });

    const data = (await response.json()) as FetchStatsResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '통계 데이터를 불러올 수 없습니다.');
    }

    if (!data.stats) {
      throw new Error('통계 데이터가 없습니다.');
    }

    return data.stats;
  } catch (error) {
    logger.error('[fetchStats] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 대리점장 목록 조회 (공유 모달용)
 *
 * @returns 대리점장 옵션 목록
 */
export async function fetchBranchManagers(): Promise<BranchManagerOption[]> {
  try {
    const response = await fetch(
      '/api/partner/affiliate/profiles?type=BRANCH_MANAGER&status=ACTIVE',
      { credentials: 'include' }
    );

    const data = (await response.json()) as {
      ok: boolean;
      profiles?: BranchManagerApiProfile[];
      error?: string;
    };

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || '대리점장 목록을 불러올 수 없습니다.'
      );
    }

    const profiles = data.profiles ?? [];
    return profiles.map((profile: BranchManagerApiProfile) => ({
      id: profile.id,
      displayName: profile.displayName ?? profile.nickname ?? null,
      branchLabel: profile.branchLabel ?? null,
      affiliateCode: profile.affiliateCode,
    }));
  } catch (error) {
    logger.error('[fetchBranchManagers] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 랜딩페이지 공유
 *
 * @param pageId - 공유할 페이지 ID
 * @param managerIds - 공유 대상 대리점장 ID 배열
 * @param shareToAdmin - 본사에게도 공유할지 여부
 * @param category - 공유 카테고리
 * @returns 공유된 대상 수
 */
export async function sharePageToManagers(
  pageId: number,
  managerIds: number[],
  shareToAdmin: boolean,
  category: string | null
): Promise<number> {
  try {
    const response = await csrfFetch(`/api/partner/landing-pages/${pageId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        managerIds,
        shareToAdmin,
        category: category?.trim() || null,
      }),
    });

    const data = (await response.json()) as SharePageResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '랜딩페이지 공유에 실패했습니다.');
    }

    return data.sharedCount ?? managerIds.length;
  } catch (error) {
    logger.error('[sharePageToManagers] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 공유 현황 조회
 *
 * @param pageId - 페이지 ID
 * @returns 공유 대상 목록
 */
export async function fetchShareRecipients(
  pageId: number
): Promise<SharedLandingRecipient[]> {
  try {
    const response = await fetch(`/api/partner/landing-pages/${pageId}/share`, {
      credentials: 'include',
    });

    const data = (await response.json()) as FetchShareRecipientsResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '공유 현황을 불러올 수 없습니다.');
    }

    return data.sharedLandingPages ?? [];
  } catch (error) {
    logger.error('[fetchShareRecipients] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 공유 회수
 *
 * @param pageId - 페이지 ID
 * @param managerIds - 회수 대상 대리점장 ID 배열 (생략 시 모두 회수)
 * @returns 회수된 공유 개수
 */
export async function revokePageShare(
  pageId: number,
  managerIds?: number[]
): Promise<number> {
  try {
    const body = managerIds
      ? { managerIds }
      : { revokeAll: true };

    const response = await csrfFetch(`/api/partner/landing-pages/${pageId}/share`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as RevokeShareResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '공유 회수에 실패했습니다.');
    }

    return data.revokedCount ?? 0;
  } catch (error) {
    logger.error('[revokePageShare] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 등록 데이터(고객 정보) 조회
 *
 * @param pageId - 페이지 ID
 * @param page - 페이지 번호 (1부터 시작)
 * @param limit - 페이지당 항목 수
 * @returns 등록 데이터 응답
 */
export async function fetchRegistrations(
  pageId: number,
  page: number = 1,
  limit: number = 50
): Promise<FetchRegistrationsResponse> {
  try {
    const response = await fetch(
      `/api/partner/landing-pages/${pageId}/registrations?page=${page}&limit=${limit}`,
      { credentials: 'include' }
    );

    const data = (await response.json()) as FetchRegistrationsResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || '등록 데이터를 불러올 수 없습니다.'
      );
    }

    return data;
  } catch (error) {
    logger.error('[fetchRegistrations] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 등록 데이터 삭제
 *
 * @param pageId - 페이지 ID
 * @param registrationId - 삭제할 등록 ID
 * @returns 삭제 성공 여부
 */
export async function deleteRegistration(
  pageId: number,
  registrationId: number
): Promise<boolean> {
  try {
    const response = await csrfFetch(
      `/api/partner/landing-pages/${pageId}/registrations`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ registrationId }),
      }
    );

    const data = (await response.json()) as DeleteRegistrationResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || '등록 데이터 삭제에 실패했습니다.');
    }

    return true;
  } catch (error) {
    logger.error('[deleteRegistration] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
