export interface ApiErrorResponse {
  ok: false;
  error?: string;
  message: string;
  errors?: Record<string, string>;
  details?: unknown;
}
