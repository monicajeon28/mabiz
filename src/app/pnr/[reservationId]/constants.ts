export const TRAVELER_LIMITS = {
  MAX_TRAVELERS: 20,
  MAX_ROOM_NUMBER: 8,
  MIN_TRAVELERS: 1,
} as const;

export const RESIDENT_NUM_RULES = {
  FULL_LENGTH: 13,
  SHORT_LENGTHS: [6, 7],
  HYPHEN_POSITION: 6,
} as const;

export const UI_MESSAGES = {
  VERIFY: '본인 확인',
  VERIFYING: '확인 중...',
  ADD_TRAVELER: '동행자 추가',
  DELETE_TRAVELER: '삭제',
  SAVE: 'PNR 정보 저장하기',
  SAVING: '저장 중...',
  COMPLETE_TITLE: 'PNR 정보 등록 완료',
  COMPLETE_DESC: '여권 정보 등록하러 가기',
  MAX_TRAVELERS_ALERT: '최대 20명까지 추가 가능합니다.',
  MIN_TRAVELERS_ALERT: '최소 1명의 여행자가 필요합니다.',
  LOADING: '예약 정보를 불러오는 중...',
  NOT_FOUND: '예약 정보를 찾을 수 없습니다.',
  HOME: '홈으로 돌아가기',
  VERIFY_PHONE_REQUIRED: '전화번호를 입력해주세요.',
  VERIFY_PHONE_MISMATCH: '예약 정보를 찾을 수 없거나 전화번호가 일치하지 않습니다.',
  VERIFY_ERROR: '본인 확인 중 오류가 발생했습니다.',
  LOAD_ERROR: '예약 정보를 불러올 수 없습니다.',
  REQUIRED_NAME: '의 이름을 입력해주세요.',
  REQUIRED_RESIDENT: '의 주민등록번호를 입력해주세요.',
  INVALID_RESIDENT_FORMAT: '의 주민등록번호 형식이 올바르지 않습니다. (예: 000000-0000000)',
  REQUIRED_PHONE: '의 연락처를 입력해주세요.',
  SUBMIT_ERROR: '저장 실패:',
} as const;

export const API_ENDPOINTS = {
  VERIFY_PHONE: (id: string, phone: string) =>
    `/api/pnr/customer/${id}?phone=${encodeURIComponent(phone)}`,
  FETCH_RESERVATION: (id: string) =>
    `/api/pnr/customer/${id}`,
  SUBMIT: '/api/pnr/customer/submit',
  AUTH_ME: '/api/auth/me',
} as const;

export const LOCALE = 'ko-KR' as const;

export const REPRESENTATIVE_LABEL = '대표자' as const;
export const COMPANION_LABEL = '동행자' as const;
