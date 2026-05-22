export interface ApiErrorResponse {
  ok: false;
  error?: string;
  message: string;
  errors?: Record<string, string>;
  details?: unknown;
}

export interface SendDbResponse {
  ok: boolean;
  agentName?: string;
  message?: string;
  transferLogId?: string;
}

export interface ContactDetailResponse {
  ok: boolean;
  contact: any;
  isCurrentUserAdmin?: boolean;
  sharedCallLogs?: any[];
}

export interface BaseApiResponse {
  ok: boolean;
  message?: string;
}

export interface ListApiResponse<T> extends BaseApiResponse {
  data?: T[];
  items?: T[];
}
