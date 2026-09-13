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

import { HttpClient } from '@angular/common/http';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { AuthApiService } from '@app/core/services/auth-api.service';
import { LoggerService } from '@app/shared/services/logger.service';
import { ToastService } from '@app/shared/services/toast.service';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

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

interface GoogleCodeConfig {
  readonly client_id: string;
  readonly scope: string;
  readonly ux_mode: 'popup';
  readonly include_granted_scopes?: boolean;
  callback(response: { readonly code?: string; readonly error?: string }): void;
  error_callback?(error: { readonly type?: string }): void;
}

const requestCode = jest.fn();
const initCodeClient = jest.fn((config: GoogleCodeConfig) => {
  googleConfigs.push(config);
  return { requestCode };
});
let googleConfigs: GoogleCodeConfig[] = [];

function installGoogleIdentity(): void {
  (window as unknown as { google?: unknown }).google = {
    accounts: { oauth2: { initCodeClient } },
  };
}

function clearGoogleIdentity(): void {
  delete (window as unknown as { google?: unknown }).google;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('AuthService GIS popup 登入', () => {
  let auth: AuthService;
  let http: HttpBoundary;
  let toast: { success: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    dependencies.clear();
    clearGoogleIdentity();
    googleConfigs = [];
    requestCode.mockReset();
    initCodeClient.mockClear();
    http = new HttpBoundary();
    toast = { success: jest.fn(), error: jest.fn() };
    dependencies.set(HttpClient, http);
    dependencies.set(AnalyticsService, { trackEvent: jest.fn() });
    dependencies.set(ToastService, toast);
    dependencies.set(LoggerService, { error: jest.fn(), warn: jest.fn() });
    dependencies.set(AuthApiService, { getUserMe: (): Observable<never> => new Observable() });
    auth = new AuthService();
  });

  afterEach(() => {
    clearGoogleIdentity();
    document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')
      .forEach((script) => script.remove());
    jest.useRealTimers();
  });

  it('以 GIS popup 同步啟動，並依既有交換契約送出授權碼', async () => {
    installGoogleIdentity();
    auth.loginWithGoogle();
    auth.loginWithGoogle();
    expect(initCodeClient).toHaveBeenCalledTimes(1);
    expect(requestCode).toHaveBeenCalledTimes(1);
    expect(googleConfigs[0]).toMatchObject({
      client_id: 'google-client-id.test',
      scope: 'openid email profile https://www.googleapis.com/auth/drive.appdata',
      ux_mode: 'popup',
      include_granted_scopes: true,
    });
    expect(googleConfigs[0]).not.toHaveProperty('redirect_uri');

    window.history.replaceState({}, '', '/price-generator/localhost-route');
    googleConfigs[0].callback({ code: 'oauth-code' });
    await flush();
    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]).toMatchObject({
      url: 'https://portal.test/api/auth/google/exchange',
      body: { code: 'oauth-code', driveAuthorization: true },
      options: { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    });
    expect(http.requests[0].body).not.toHaveProperty('redirectUri');
    http.requests[0].resolve(loginResponse);
    await flush();
    expect(auth.currentUser()?.email).toBe('member@example.com');
  });

  it('接受第一個授權碼後忽略重複、空白與關閉 callback，且只交換一次', async () => {
    installGoogleIdentity();
    auth.loginWithGoogle();
    googleConfigs[0].callback({ code: 'only-once' });
    googleConfigs[0].callback({ code: 'replayed-code' });
    googleConfigs[0].callback({});
    googleConfigs[0].error_callback?.({ type: 'popup_closed' });
    await flush();
    expect(http.requests).toHaveLength(1);
    http.requests[0].resolve(loginResponse);
    await flush();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('登出後，等待載入、晚到 callback 與晚到交換回應都不可還原 session', async () => {
    auth.loginWithGoogle();
    await auth.logout();
    installGoogleIdentity();
    document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')!
      .dispatchEvent(new Event('load'));
    await flush();
    expect(initCodeClient).not.toHaveBeenCalled();

    auth.loginWithGoogle();
    googleConfigs[0].callback({ code: 'exchange-before-logout' });
    await flush();
    expect(http.requests).toHaveLength(1);
    await auth.logout();
    googleConfigs[0].callback({ code: 'late-code' });
    http.requests[0].resolve(loginResponse);
    await flush();

    expect(auth.isAuthenticated()).toBe(false);
  });

  it('封鎖、關閉、載入失敗與逾時皆會釋放登入流程供重試', async () => {
    installGoogleIdentity();
    auth.loginWithGoogle();
    googleConfigs[0].error_callback?.({ type: 'popup_failed_to_open' });
    auth.loginWithGoogle();
    googleConfigs[1].error_callback?.({ type: 'popup_closed' });

    clearGoogleIdentity();
    auth.loginWithGoogle();
    document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')!
      .dispatchEvent(new Event('error'));
    await flush();

    installGoogleIdentity();
    jest.useFakeTimers();
    auth.loginWithGoogle();
    jest.advanceTimersByTime(120_000);
    expect(toast.error).toHaveBeenCalledWith('登入逾時，請重新登入');
    auth.loginWithGoogle();
    expect(initCodeClient).toHaveBeenCalledTimes(4);
  });

  it('共用的 GIS script 載入失敗後，會略過失敗節點並建立新 script 重試', async () => {
    const sharedScript = document.createElement('script');
    sharedScript.src = 'https://accounts.google.com/gsi/client';
    document.head.appendChild(sharedScript);

    auth.loginWithGoogle();
    sharedScript.dispatchEvent(new Event('error'));
    await flush();

    auth.loginWithGoogle();
    const retryScript = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]'),
    ).find((script) => script !== sharedScript);
    expect(retryScript).toBeDefined();
    installGoogleIdentity();
    retryScript!.dispatchEvent(new Event('load'));
    await flush();

    expect(initCodeClient).toHaveBeenCalledTimes(1);
    expect(requestCode).toHaveBeenCalledTimes(1);
  });

  it('登入逾時後的晚到交換回應不可登入，也不可結束新的登入批次', async () => {
    installGoogleIdentity();
    jest.useFakeTimers();
    auth.loginWithGoogle();
    googleConfigs[0].callback({ code: 'old-code' });
    await flush();
    expect(http.requests).toHaveLength(1);

    jest.advanceTimersByTime(120_000);
    auth.loginWithGoogle();
    expect(initCodeClient).toHaveBeenCalledTimes(2);

    http.requests[0].resolve(loginResponse);
    await flush();
    expect(auth.isAuthenticated()).toBe(false);
    auth.loginWithGoogle();
    expect(initCodeClient).toHaveBeenCalledTimes(2);
  });

  it('舊 callback 不可結束新的登入批次', async () => {
    installGoogleIdentity();
    auth.loginWithGoogle();
    const firstConfig = googleConfigs[0];
    firstConfig.error_callback?.({ type: 'popup_closed' });

    auth.loginWithGoogle();
    const secondConfig = googleConfigs[1];
    firstConfig.callback({ code: 'old-code' });
    auth.loginWithGoogle();
    expect(initCodeClient).toHaveBeenCalledTimes(2);
    expect(http.requests).toHaveLength(0);

    secondConfig.callback({ code: 'new-code' });
    await flush();
    expect(http.requests).toHaveLength(1);
  });
});
