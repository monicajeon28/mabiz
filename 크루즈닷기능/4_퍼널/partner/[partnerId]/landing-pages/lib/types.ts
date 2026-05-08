/**
 * Landing Pages Library — Type Definitions
 * 모든 랜딩페이지 관련 타입을 중앙화
 */

/**
 * 기본 랜딩페이지 모델
 */
export interface LandingPage {
  id: number;
  title: string;
  category: string | null;
  pageGroup: string | null;
  viewCount: number;
  slug: string;
  shortcutUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  CustomerGroup: {
    id: number;
    name: string;
  } | null;
  _count?: {
    LandingPageRegistration: number;
  };
}

/**
 * 공유받은 랜딩페이지
 */
export interface SharedLandingPage extends LandingPage {
  sharedCategory?: string;
  sharedAt?: string;
}

/**
 * 랜딩페이지 통계 데이터
 */
export interface StatsData {
  views: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
  registrations: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
  conversionRate: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
  bounceRate: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
  };
}

/**
 * 대리점장 옵션 (공유 모달용)
 */
export interface BranchManagerOption {
  id: number;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string;
}

/**
 * API 응답에서 받은 대리점장 프로필
 */
export interface BranchManagerApiProfile {
  id: number;
  displayName?: string | null;
  nickname?: string | null;
  branchLabel?: string | null;
  affiliateCode: string;
}

/**
 * 랜딩페이지 등록 데이터 (고객 정보)
 */
export interface LandingPageRegistration {
  id: number;
  customerName: string;
  customerGroup: string | null;
  phone: string;
  email: string | null;
  registeredAt: string;
}

/**
 * 공유 대상 정보
 */
export interface SharedLandingRecipient {
  managerId: number;
  displayName: string | null;
  branchLabel: string | null;
  affiliateCode: string | null;
  category: string | null;
  sharedAt: string;
}

/**
 * 페이지 등록 그룹 선호도
 */
export interface RegistrationGroupPrefs {
  primaryGroupId?: number | null;
  additionalGroupId?: number | null;
}

/**
 * 제네릭 API 응답 포맷
 */
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

/**
 * 에러 응답 포맷
 */
export interface ErrorResponse {
  ok: false;
  error: string;
}

/**
 * 랜딩페이지 목록 조회 API 응답
 */
export interface FetchLandingPagesResponse {
  ok: boolean;
  ownedPages?: LandingPage[];
  landingPages?: LandingPage[];
  sharedPages?: SharedLandingPage[];
  error?: string;
}

/**
 * 보너스 공유 수량 조회 API 응답
 */
export interface FetchBonusShareCountResponse {
  ok: boolean;
  count?: number;
  error?: string;
}

/**
 * 통계 조회 API 응답
 */
export interface FetchStatsResponse {
  ok: boolean;
  stats?: StatsData;
  error?: string;
}

/**
 * 클론 생성 API 응답
 */
export interface ClonePageResponse {
  ok: boolean;
  landingPage?: {
    id: number;
  };
  error?: string;
}

/**
 * 숏컷 URL 생성 API 응답
 */
export interface GenerateShortcutResponse {
  ok: boolean;
  shortcutUrl?: string;
  error?: string;
}

/**
 * 공유 API 응답 (POST)
 */
export interface SharePageResponse {
  ok: boolean;
  sharedCount?: number;
  error?: string;
}

/**
 * 공유 현황 조회 API 응답
 */
export interface FetchShareRecipientsResponse {
  ok: boolean;
  sharedLandingPages?: SharedLandingRecipient[];
  error?: string;
}

/**
 * 공유 회수 API 응답
 */
export interface RevokeShareResponse {
  ok: boolean;
  revokedCount?: number;
  error?: string;
}

/**
 * 등록 데이터 조회 API 응답
 */
export interface FetchRegistrationsResponse {
  ok: boolean;
  registrations?: LandingPageRegistration[];
  groupPreferences?: RegistrationGroupPrefs | null;
  pagination?: {
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

/**
 * 등록 데이터 삭제 API 응답
 */
export interface DeleteRegistrationResponse {
  ok: boolean;
  error?: string;
}

/**
 * 랜딩페이지 삭제 API 응답
 */
export interface DeletePageResponse {
  ok: boolean;
  error?: string;
}

/**
 * 병렬 호출용 응답 (Promise.all)
 */
export interface FetchPagesWithQuotasResult {
  pages: FetchLandingPagesResponse;
  bonus: FetchBonusShareCountResponse;
}
