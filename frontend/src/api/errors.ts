import { hasMessage, t } from '../i18n';

export const NETWORK_ERROR = 'NETWORK_ERROR';

/** Error thrown by the API client. `code` is the backend's machine-readable error code. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Converts anything thrown by the API layer into a sentence a parent can understand, in the
 * current UI language (dictionary keys `err.<CODE>` in src/i18n/messages.ts).
 */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `err.${error.code}`;
    if (hasMessage(key)) return t(key);
    if (error.status >= 500) return t('err.INTERNAL_ERROR');
    if (error.status === 404) return t('err.NOT_FOUND_GENERIC');
  }
  return t('err.FALLBACK');
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}
