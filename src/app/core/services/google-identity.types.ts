/** 原生 OAuth callback 頁傳回 opener 的最小訊息格式。 */
export interface GoogleOAuthCallbackSuccess {
  readonly type: 'price-google-oauth';
  readonly state: string;
  readonly code: string;
}

export interface GoogleOAuthCallbackFailure {
  readonly type: 'price-google-oauth';
  readonly state: string;
  readonly error: string;
}

export type GoogleOAuthCallbackMessage =
  | GoogleOAuthCallbackSuccess
  | GoogleOAuthCallbackFailure;

export function isGoogleOAuthCallbackMessage(
  value: unknown,
): value is GoogleOAuthCallbackMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    record['type'] !== 'price-google-oauth' ||
    typeof record['state'] !== 'string' ||
    record['state'].length < 32 ||
    record['state'].length > 128
  ) {
    return false;
  }
  const hasCode = typeof record['code'] === 'string' && record['code'].length > 0;
  const hasError = typeof record['error'] === 'string' && record['error'].length > 0;
  return hasCode !== hasError;
}
