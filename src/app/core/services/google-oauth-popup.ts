import {
  isGoogleOAuthCallbackMessage,
} from './google-identity.types';

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const POPUP_TIMEOUT_MS = 120_000;
const POPUP_CLOSE_POLL_MS = 250;

export type GoogleOAuthPopupFailure =
  | 'popup_blocked'
  | 'cancelled'
  | 'timeout'
  | 'failed';

/** 僅含一次性授權碼與 PKCE 材料；不會寫入任何瀏覽器儲存空間。 */
export interface GoogleOAuthAuthorization {
  readonly code: string;
  readonly codeVerifier: string;
  readonly nonce: string;
  readonly redirectUri: string;
}

export class GoogleOAuthPopupError extends Error {
  constructor(readonly code: GoogleOAuthPopupFailure) {
    super(code);
  }
}

interface PendingAuthorization {
  readonly popup: Window;
  cancelled: boolean;
  cleanup?: () => void;
  reject?: (reason: GoogleOAuthPopupError) => void;
}

export interface GoogleOAuthPopupOptions {
  readonly targetWindow?: Window;
  readonly crypto?: Crypto;
  readonly timeoutMs?: number;
  readonly closePollMs?: number;
}

/**
 * 原生 OAuth redirect popup。state、nonce 與 PKCE verifier 都只存在這個 instance 的閉包中，
 * callback 頁只會把 authorization code 傳回同源 opener。
 */
export class GoogleOAuthPopup {
  private readonly targetWindow: Window;
  private readonly cryptoApi: Crypto;
  private readonly timeoutMs: number;
  private readonly closePollMs: number;
  private active: PendingAuthorization | null = null;

  constructor(options: GoogleOAuthPopupOptions = {}) {
    this.targetWindow = options.targetWindow ?? window;
    this.cryptoApi = options.crypto ?? globalThis.crypto;
    this.timeoutMs = options.timeoutMs ?? POPUP_TIMEOUT_MS;
    this.closePollMs = options.closePollMs ?? POPUP_CLOSE_POLL_MS;
  }

  /** 必須直接從使用者 click 呼叫，先開 about:blank 再非同步產生 PKCE。 */
  authorize(clientId: string): Promise<GoogleOAuthAuthorization> {
    if (this.active) return Promise.reject(new GoogleOAuthPopupError('failed'));

    const popup = this.targetWindow.open(
      'about:blank',
      'price-google-oauth',
      'popup,width=520,height=640,resizable=yes,scrollbars=yes',
    );
    if (!popup) return Promise.reject(new GoogleOAuthPopupError('popup_blocked'));

    const pending: PendingAuthorization = { popup, cancelled: false };
    this.active = pending;
    return this.startAuthorization(pending, clientId);
  }

  /** 登出或元件銷毀時中止尚未完成的 OAuth 視窗。 */
  cancel(): void {
    const pending = this.active;
    if (!pending) return;
    pending.cancelled = true;
    pending.popup.close();
    if (pending.reject) {
      pending.reject(new GoogleOAuthPopupError('cancelled'));
    }
  }

  private async startAuthorization(
    pending: PendingAuthorization,
    clientId: string,
  ): Promise<GoogleOAuthAuthorization> {
    try {
      const [state, nonce, codeVerifier] = await Promise.all([
        this.createRandomValue(),
        this.createRandomValue(),
        this.createRandomValue(),
      ]);
      const codeChallenge = await this.createCodeChallenge(codeVerifier);
      if (pending.cancelled || this.active !== pending || pending.popup.closed) {
        throw new GoogleOAuthPopupError('cancelled');
      }

      const redirectUri = new URL(
        'assets/google-auth-callback.html',
        this.targetWindow.document.baseURI,
      ).href;
      const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
      authorizationUrl.searchParams.set('client_id', clientId);
      authorizationUrl.searchParams.set('redirect_uri', redirectUri);
      authorizationUrl.searchParams.set('response_type', 'code');
      authorizationUrl.searchParams.set(
        'scope',
        `openid email profile ${DRIVE_APPDATA_SCOPE}`,
      );
      authorizationUrl.searchParams.set('access_type', 'offline');
      authorizationUrl.searchParams.set('include_granted_scopes', 'true');
      authorizationUrl.searchParams.set('prompt', 'select_account');
      authorizationUrl.searchParams.set('state', state);
      authorizationUrl.searchParams.set('nonce', nonce);
      authorizationUrl.searchParams.set('code_challenge', codeChallenge);
      authorizationUrl.searchParams.set('code_challenge_method', 'S256');

      return await this.waitForCallback(
        pending,
        authorizationUrl.href,
        state,
        { codeVerifier, nonce, redirectUri },
      );
    } catch (error) {
      const failure = error instanceof GoogleOAuthPopupError
        ? error
        : new GoogleOAuthPopupError('failed');
      this.finish(pending);
      throw failure;
    }
  }

  private waitForCallback(
    pending: PendingAuthorization,
    authorizationUrl: string,
    state: string,
    material: Omit<GoogleOAuthAuthorization, 'code'>,
  ): Promise<GoogleOAuthAuthorization> {
    const callbackOrigin = new URL(material.redirectUri).origin;
    return new Promise<GoogleOAuthAuthorization>((resolve, reject) => {
      const fail = (code: GoogleOAuthPopupFailure): void => {
        this.finish(pending);
        reject(new GoogleOAuthPopupError(code));
      };
      const onMessage = (event: MessageEvent<unknown>): void => {
        if (
          event.origin !== callbackOrigin ||
          event.source !== pending.popup ||
          !isGoogleOAuthCallbackMessage(event.data) ||
          event.data.state !== state
        ) {
          return;
        }
        this.finish(pending);
        if ('code' in event.data) {
          resolve({ code: event.data.code, ...material });
        } else {
          reject(new GoogleOAuthPopupError('cancelled'));
        }
      };
      const timer = this.targetWindow.setTimeout(() => fail('timeout'), this.timeoutMs);
      const closePoll = this.targetWindow.setInterval(() => {
        if (pending.popup.closed) fail('cancelled');
      }, this.closePollMs);

      pending.cleanup = () => {
        this.targetWindow.removeEventListener('message', onMessage);
        this.targetWindow.clearTimeout(timer);
        this.targetWindow.clearInterval(closePoll);
        if (this.active === pending) this.active = null;
      };
      pending.reject = (reason) => {
        this.finish(pending);
        reject(reason);
      };

      try {
        this.targetWindow.addEventListener('message', onMessage);
        pending.popup.location.href = authorizationUrl;
      } catch {
        fail('failed');
      }
    });
  }

  private finish(pending: PendingAuthorization): void {
    pending.cleanup?.();
    if (!pending.cleanup && this.active === pending) this.active = null;
    pending.cleanup = undefined;
    pending.reject = undefined;
    if (!pending.popup.closed) pending.popup.close();
  }

  private async createCodeChallenge(verifier: string): Promise<string> {
    if (!this.cryptoApi?.subtle) throw new GoogleOAuthPopupError('failed');
    const digest = await this.cryptoApi.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier),
    );
    return this.toBase64Url(new Uint8Array(digest));
  }

  private createRandomValue(): string {
    if (!this.cryptoApi?.getRandomValues) throw new GoogleOAuthPopupError('failed');
    const bytes = new Uint8Array(32);
    this.cryptoApi.getRandomValues(bytes);
    return this.toBase64Url(bytes);
  }

  private toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }
}
