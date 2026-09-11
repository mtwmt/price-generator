export interface GoogleIdentityApi {
  readonly accounts?: {
    readonly oauth2?: unknown;
  };
}

/**
 * 不擴充全域 Window，避免與 Drive 既有的 GIS OAuth2 宣告互相衝突。
 */
export interface GoogleIdentityWindow {
  readonly google?: GoogleIdentityApi;
}

export function getGoogleIdentityApi(
  target: Window = window,
): GoogleIdentityApi | undefined {
  return (target as unknown as GoogleIdentityWindow).google;
}
