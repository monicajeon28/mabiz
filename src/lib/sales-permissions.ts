/**
 * 판매 권한 관리 함수 모음
 * 역할별(관리자/대리점장/판매원) 데이터 접근 제어
 *
 * 규칙:
 * - 관리자(GLOBAL_ADMIN): 모든 데이터 조회
 * - 대리점장(OWNER): 자신의 팀만 조회
 * - 판매원(AGENT): 자신의 데이터만 조회
 */

// ============================================
// 📌 권한 함수 1: 팀 데이터 조회 권한
// ============================================

export function canViewTeamData(
  userRole: string | null | undefined,
  userTeamId: string | null | undefined
): boolean {
  // 관리자? → YES (전체 조회 권한)
  if (userRole === 'GLOBAL_ADMIN') return true;

  // 대리점장/판매원? → 자기 팀이 있어야 함
  if (userRole === 'OWNER' || userRole === 'AGENT') {
    return !!userTeamId;
  }

  // 그 외? → NO
  return false;
}

// ============================================
// 📌 권한 함수 2: 월말 정산 권한 (관리자만)
// ============================================

export function canSettleCommission(userRole: string | null | undefined): boolean {
  // 관리자만 가능
  return userRole === 'GLOBAL_ADMIN';
}

// ============================================
// 📌 권한 함수 3: 이의 제기 권한
// ============================================

export function canDispute(userRole: string | null | undefined): boolean {
  // 관리자 또는 대리점장만 가능
  return userRole === 'GLOBAL_ADMIN' || userRole === 'OWNER';
}

// ============================================
// 📌 권한 함수 4: 데이터 필터 자동 생성
// ============================================

export function getAppliedFilters(
  userRole: string | null | undefined,
  userId: string | null | undefined,
  userTeamId: string | null | undefined
): Record<string, any> | null {
  // 관리자? → 필터 없음 (모든 데이터)
  if (userRole === 'GLOBAL_ADMIN') {
    return {};
  }

  // 대리점장? → 자기 팀만
  if (userRole === 'OWNER') {
    if (!userTeamId) return null;
    return { teamId: userTeamId };
  }

  // 판매원? → 자기가 만든 것만
  if (userRole === 'AGENT') {
    if (!userId) return null;
    return { createdBy: userId };
  }

  // 그 외? → 권한 없음
  return null;
}

// ============================================
// 📌 권한 함수 5: 데이터 마스킹 (민감정보 숨김)
// ============================================

export function maskSensitiveData(
  data: any,
  userRole: string | null | undefined
): any {
  if (!data) return data;

  // 관리자? → 마스킹 안 함 (전체 조회 권한)
  if (userRole === 'GLOBAL_ADMIN') {
    return data;
  }

  // 배열인 경우
  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, userRole));
  }

  // 객체인 경우
  if (typeof data === 'object') {
    const masked = { ...data };

    // 민감한 필드 숨김
    const sensitiveFields = ['password', 'apiKey', 'secretKey', 'token'];
    sensitiveFields.forEach((field) => {
      if (masked[field]) {
        delete masked[field];
      }
    });

    // 이메일 일부 마스킹 (선택사항)
    if (masked.email && userRole !== 'GLOBAL_ADMIN') {
      const [name, domain] = masked.email.split('@');
      masked.email = `${name.substring(0, 2)}***@${domain}`;
    }

    return masked;
  }

  return data;
}

// ============================================
// 📌 권한 검증 함수 (API 에러 체크용)
// ============================================

export function validatePermission(
  userRole: string | null | undefined,
  userId: string | null | undefined,
  userTeamId: string | null | undefined,
  requiredRole?: string | string[]
): { isValid: boolean; error?: string } {
  // 사용자 정보 기본 검증
  if (!userRole || !userId) {
    return {
      isValid: false,
      error: '로그인이 필요합니다',
    };
  }

  // 특정 역할이 필요한 경우
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(userRole)) {
      return {
        isValid: false,
        error: '이 작업을 수행할 권한이 없습니다',
      };
    }
  }

  // 팀 데이터 조회 권한 필요 시
  if (!canViewTeamData(userRole, userTeamId)) {
    return {
      isValid: false,
      error: '팀 데이터를 볼 권한이 없습니다',
    };
  }

  return { isValid: true };
}

// ============================================
// 📌 조회 필터 빌더 (복잡한 조건용)
// ============================================

export function buildOrderFilter(
  userRole: string | null | undefined,
  userId: string | null | undefined,
  userTeamId: string | null | undefined,
  statusFilter?: string[] | null
): Record<string, any> | null {
  const baseFilter = getAppliedFilters(userRole, userId, userTeamId);

  if (baseFilter === null) {
    return null;
  }

  // 상태 필터 추가
  if (statusFilter && statusFilter.length > 0) {
    return {
      ...baseFilter,
      status: {
        in: statusFilter,
      },
    };
  }

  return baseFilter;
}

// ============================================
// 📌 팀 조회 권한 검증 (팀장이 다른 팀 조회 방지)
// ============================================

export function canViewTeamId(
  userRole: string | null | undefined,
  userTeamId: string | null | undefined,
  requestedTeamId: string | null | undefined
): boolean {
  // 관리자 → 모든 팀 조회 가능
  if (userRole === 'GLOBAL_ADMIN') {
    return true;
  }

  // 대리점장 → 자신의 팀만 조회 가능
  if (userRole === 'OWNER') {
    return userTeamId === requestedTeamId;
  }

  // 판매원 → 팀 조회 불가
  return false;
}

// ============================================
// 📌 정산 권한 검증 (월별 정산은 관리자만)
// ============================================

export function validateSettlementPermission(
  userRole: string | null | undefined
): { isValid: boolean; error?: string } {
  if (!canSettleCommission(userRole)) {
    return {
      isValid: false,
      error: '정산 관리는 관리자만 가능합니다',
    };
  }

  return { isValid: true };
}
