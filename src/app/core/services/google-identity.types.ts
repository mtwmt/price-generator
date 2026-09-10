/** Google Identity Services 的登入按鈕最小型別，不依賴額外套件。 */
export interface GoogleCredentialResponse {
  readonly credential?: string;
  readonly select_by?: string;
}

export interface GoogleIdConfiguration {
  readonly client_id: string;
  readonly callback: (response: GoogleCredentialResponse) => void;
  readonly nonce: string;
  readonly auto_select: false;
  readonly ux_mode: 'popup';
}

export interface GoogleIdButtonConfiguration {
  readonly type: 'standard';
  readonly theme: 'outline';
  readonly size: 'large';
  readonly text: 'signin_with';
  readonly shape: 'rectangular';
}

export interface GoogleIdentityApi {
  readonly accounts?: {
    readonly id?: {
      initialize(configuration: GoogleIdConfiguration): void;
      renderButton(
        parent: HTMLElement,
        configuration: GoogleIdButtonConfiguration,
      ): void;
    };
    readonly oauth2?: unknown;
  };
}

/**
 * 不擴充全域 Window，避免與 Drive 既有的 GIS OAuth2 宣告互相衝突。
 * 兩種 GIS API 共用同一個 script，但各自只使用所需的最小交集型別。
 */
export interface GoogleIdentityWindow {
  readonly google?: GoogleIdentityApi;
}

export function getGoogleIdentityApi(
  target: Window = window,
): GoogleIdentityApi | undefined {
  return (target as unknown as GoogleIdentityWindow).google;
}
