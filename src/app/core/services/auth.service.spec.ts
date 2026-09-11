/** @jest-environment jsdom */
const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  computed: <T>(compute: () => T) => compute,
  inject: (token: unknown) => dependencies.get(token),
  signal: <T>(initial: T) => {
    let value = initial;
    const state = (() => value) as (() => T) & { set(next: T): void };
    state.set = (next: T): void => { value = next; };
    return state;
  },
}));
jest.mock('@angular/common/http', () => ({ HttpClient: class HttpClient {} }));
jest.mock('@app/core/services/analytics.service', () => ({ AnalyticsService: class AnalyticsService {} }), { virtual: true });
jest.mock('@app/core/services/auth-api.service', () => ({ AuthApiService: class AuthApiService {} }), { virtual: true });
jest.mock('@app/shared/services/logger.service', () => ({ LoggerService: class LoggerService {} }), { virtual: true });
jest.mock('@app/shared/services/toast.service', () => ({ ToastService: class ToastService {} }), { virtual: true });
jest.mock('@app/core/mappers/user-api.mapper', () => ({
  UserApiMapper: {
    mapD1ToUserData: (dto: typeof loginResponse) => ({
      uid: dto.user.id, email: dto.user.email, displayName: dto.user.displayName,
      photoURL: dto.user.photoURL, platforms: { quotation: { role: 'free' } },
    }),
  },
}), { virtual: true });
jest.mock('@app/features/user/user.model', () => ({}), { virtual: true });
jest.mock('src/environments/environment', () => ({
  environment: { portalApiUrl: 'https://portal.test', googleClientId: 'google-client-id.test' },
}), { virtual: true });

const authorize = jest.fn();
const cancel = jest.fn();
jest.mock('./google-oauth-popup', () => {
  class GoogleOAuthPopupError extends Error {
    constructor(readonly code: string) { super(code); }
  }
  return {
    GoogleOAuthPopup: jest.fn(() => ({ authorize, cancel })),
    GoogleOAuthPopupError,
  };
});

import { HttpClient } from '@angular/common/http';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { AuthApiService } from '@app/core/services/auth-api.service';
import { LoggerService } from '@app/shared/services/logger.service';
import { ToastService } from '@app/shared/services/toast.service';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { GoogleOAuthPopupError } from './google-oauth-popup';

const loginResponse = {
  accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 1800,
  user: { id: 'user-1', email: 'member@example.com', displayName: '會員', photoURL: null },
  profiles: { quotation: { role: 'free' } }, timestamp: 1,
};

interface PendingRequest {
  readonly url: string;
  readonly body: unknown;
  readonly options: unknown;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

class HttpBoundary {
  readonly requests: PendingRequest[] = [];

  post<T>(url: string, body: unknown, options?: unknown): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.requests.push({
        url, body, options,
        resolve: (value) => { subscriber.next(value as T); subscriber.complete(); },
        reject: (error) => subscriber.error(error),
      });
    });
  }
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe('AuthService 原生 OAuth PKCE 登入', () => {
  let auth: AuthService;
  let http: HttpBoundary;
  let toast: { success: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    dependencies.clear();
    authorize.mockReset();
    cancel.mockReset();
    http = new HttpBoundary();
    toast = { success: jest.fn(), error: jest.fn() };
    dependencies.set(HttpClient, http);
    dependencies.set(AnalyticsService, { trackEvent: jest.fn() });
    dependencies.set(ToastService, toast);
    dependencies.set(LoggerService, { error: jest.fn(), warn: jest.fn() });
    dependencies.set(AuthApiService, { getUserMe: (): Observable<never> => new Observable() });
    auth = new AuthService();
  });

  it('並行點擊只開一個 OAuth popup，成功後帶 PKCE 與 nonce 交換 session', async () => {
    const pending = deferred<{
      code: string; codeVerifier: string; nonce: string; redirectUri: string;
    }>();
    authorize.mockReturnValue(pending.promise);

    auth.loginWithGoogle();
    auth.loginWithGoogle();
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledWith('google-client-id.test');

    pending.resolve({
      code: 'oauth-code', codeVerifier: 'pkce-verifier', nonce: 'nonce-value',
      redirectUri: 'https://mtwmt.com/price-generator/assets/google-auth-callback.html',
    });
    await Promise.resolve();
    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]).toMatchObject({
      url: 'https://portal.test/api/auth/google/exchange',
      body: {
        code: 'oauth-code', driveAuthorization: true, flow: 'web',
        codeVerifier: 'pkce-verifier', nonce: 'nonce-value',
        redirectUri: 'https://mtwmt.com/price-generator/assets/google-auth-callback.html',
      },
      options: { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    });
    http.requests[0].resolve(loginResponse);
    await Promise.resolve();
    expect(auth.currentUser()?.email).toBe('member@example.com');
  });

  it('登出會取消 OAuth 視窗，且晚到授權碼不可交換或還原 session', async () => {
    const pending = deferred<{
      code: string; codeVerifier: string; nonce: string; redirectUri: string;
    }>();
    authorize.mockReturnValue(pending.promise);

    auth.loginWithGoogle();
    await auth.logout();
    expect(cancel).toHaveBeenCalledTimes(1);
    pending.resolve({
      code: 'late-code', codeVerifier: 'pkce-verifier', nonce: 'nonce-value',
      redirectUri: 'https://mtwmt.com/price-generator/assets/google-auth-callback.html',
    });
    await Promise.resolve();

    expect(http.requests).toHaveLength(0);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('popup 被封鎖時顯示可操作的安全訊息，並釋放下一次重試', async () => {
    authorize.mockRejectedValue(new GoogleOAuthPopupError('popup_blocked'));

    auth.loginWithGoogle();
    await Promise.resolve();
    await Promise.resolve();
    expect(toast.error).toHaveBeenCalledWith('瀏覽器封鎖登入視窗，請允許彈出視窗後重試');

    const retry = deferred<{
      code: string; codeVerifier: string; nonce: string; redirectUri: string;
    }>();
    authorize.mockReturnValue(retry.promise);
    auth.loginWithGoogle();
    expect(authorize).toHaveBeenCalledTimes(2);
  });
});
