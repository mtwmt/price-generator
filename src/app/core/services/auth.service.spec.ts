/**
 * @jest-environment jsdom
 */
const mockDependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  computed: <T>(compute: () => T) => compute,
  inject: (token: unknown) => mockDependencies.get(token),
  signal: <T>(initial: T) => {
    let value = initial;
    const state = (() => value) as (() => T) & {
      set(next: T): void;
      update(updater: (current: T) => T): void;
    };
    state.set = (next: T): void => {
      value = next;
    };
    state.update = (updater: (current: T) => T): void => {
      value = updater(value);
    };
    return state;
  },
}));

jest.mock('@angular/common/http', () => ({ HttpClient: class HttpClient {} }));
jest.mock('@app/core/services/analytics.service', () => ({
  AnalyticsService: class AnalyticsService {},
}), { virtual: true });
jest.mock('@app/core/services/auth-api.service', () => ({
  AuthApiService: class AuthApiService {},
}), { virtual: true });
jest.mock('@app/shared/services/logger.service', () => ({
  LoggerService: class LoggerService {},
}), { virtual: true });
jest.mock('@app/shared/services/toast.service', () => ({
  ToastService: class ToastService {},
}), { virtual: true });
jest.mock('@app/core/mappers/user-api.mapper', () => ({
  UserApiMapper: {
    mapD1ToUserData: (dto: typeof loginResponse) => ({
      uid: dto.user.id,
      email: dto.user.email,
      displayName: dto.user.displayName,
      photoURL: dto.user.photoURL,
      platforms: {
        quotation: dto.profiles.quotation
          ? {
              role: dto.profiles.quotation.role,
              premiumUntil: dto.profiles.quotation.premiumUntil,
              firstAccessTime: dto.profiles.quotation.firstAccessTime,
              lastAccessTime: dto.profiles.quotation.lastAccessTime,
            }
          : undefined,
      },
    }),
  },
}), { virtual: true });
jest.mock('@app/features/user/user.model', () => ({}), { virtual: true });
jest.mock('src/environments/environment', () => ({
  environment: {
    portalApiUrl: 'https://portal.test',
    googleClientId: 'google-client-id.test',
  },
}), { virtual: true });

import { HttpClient } from '@angular/common/http';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { AuthApiService } from '@app/core/services/auth-api.service';
import { AuthService } from './auth.service';
import { GoogleIdConfiguration, GoogleIdentityApi } from './google-identity.types';
import { LoggerService } from '@app/shared/services/logger.service';
import { ToastService } from '@app/shared/services/toast.service';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

const authUrl = `${environment.portalApiUrl}/api/auth`;

const loginResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 1800,
  user: {
    id: 'user-1',
    email: 'member@example.com',
    displayName: '會員',
    photoURL: null,
    createdAt: 1,
    updatedAt: 1,
  },
  profiles: {
    quotation: {
      uid: 'user-1',
      role: 'free' as const,
      premiumUntil: null,
      firstAccessTime: 1,
      lastAccessTime: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  },
  timestamp: 1,
};

interface PendingHttpRequest {
  readonly url: string;
  readonly body: unknown;
  readonly options: unknown;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

interface PendingUserMeRequest {
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

class HttpClientBoundary {
  readonly requests: PendingHttpRequest[] = [];

  post<T>(url: string, body: unknown, options?: unknown): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.requests.push({
        url,
        body,
        options,
        resolve: (value: unknown): void => {
          subscriber.next(value as T);
          subscriber.complete();
        },
        reject: (error: unknown): void => subscriber.error(error),
      });
    });
  }

  expectOne(url: string): PendingHttpRequest {
    const matching = this.requests.filter((request) => request.url === url);
    expect(matching).toHaveLength(1);
    return matching[0];
  }

  expectNone(url: string): void {
    expect(this.requests.filter((request) => request.url === url)).toHaveLength(0);
  }
}

class AuthApiBoundary {
  readonly userMeRequests: PendingUserMeRequest[] = [];

  getUserMe(): Observable<typeof loginResponse> {
    return new Observable<typeof loginResponse>((subscriber) => {
      this.userMeRequests.push({
        resolve: (value: unknown): void => {
          subscriber.next(value as typeof loginResponse);
          subscriber.complete();
        },
        reject: (error: unknown): void => subscriber.error(error),
      });
    });
  }

  expectOneUserMe(): PendingUserMeRequest {
    expect(this.userMeRequests).toHaveLength(1);
    return this.userMeRequests[0];
  }
}

describe('AuthService Google ID token 登入', () => {
  let authService: AuthService;
  let http: HttpClientBoundary;
  let authApi: AuthApiBoundary;
  let initializeConfiguration: GoogleIdConfiguration | undefined;
  let initializeConfigurations: GoogleIdConfiguration[];
  let initializeCalls: number;
  let renderCalls: number;
  let disableAutoSelect: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    mockDependencies.clear();
    initializeConfiguration = undefined;
    initializeConfigurations = [];
    initializeCalls = 0;
    renderCalls = 0;
    disableAutoSelect = jest.fn();
    const google = {
      accounts: {
        id: {
          initialize(configuration: GoogleIdConfiguration): void {
            initializeCalls += 1;
            initializeConfiguration = configuration;
            initializeConfigurations.push(configuration);
          },
          renderButton(): void {
            renderCalls += 1;
          },
          disableAutoSelect,
        },
      },
    } as unknown as GoogleIdentityApi;
    Object.defineProperty(window, 'google', { configurable: true, value: google });
    http = new HttpClientBoundary();
    authApi = new AuthApiBoundary();
    mockDependencies.set(HttpClient, http);
    mockDependencies.set(AnalyticsService, { trackEvent: jest.fn() });
    mockDependencies.set(ToastService, { success: jest.fn(), error: jest.fn() });
    mockDependencies.set(LoggerService, { error: jest.fn(), warn: jest.fn() });
    mockDependencies.set(AuthApiService, authApi);
    authService = new AuthService();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    Reflect.deleteProperty(window, 'google');
    document.querySelector('script[src="https://accounts.google.com/gsi/client"]')?.remove();
  });

  it('多個入口只 initialize 一次，且各自渲染官方按鈕與 nonce', async () => {
    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    await authService.renderGoogleIdSignInButton(document.createElement('div'));

    expect(initializeCalls).toBe(1);
    expect(renderCalls).toBe(2);
    expect(initializeConfiguration).toMatchObject({
      client_id: environment.googleClientId,
      auto_select: false,
      ux_mode: 'popup',
    });
    expect(initializeConfiguration?.nonce).toEqual(expect.any(String));
    expect(initializeConfiguration?.nonce.length).toBeGreaterThan(0);
  });

  it('GIS script 載入失敗後可重新嘗試', async () => {
    Reflect.deleteProperty(window, 'google');
    const host = document.createElement('div');
    const firstAttempt = authService.renderGoogleIdSignInButton(host);
    const failedScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    expect(failedScript).not.toBeNull();
    failedScript?.dispatchEvent(new Event('error'));
    await expect(firstAttempt).rejects.toThrow('GIS load failed');

    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        accounts: {
          id: {
            initialize(): void {},
            renderButton(): void {},
          },
        },
      } satisfies GoogleIdentityApi,
    });
    await expect(authService.renderGoogleIdSignInButton(host)).resolves.toBeUndefined();
  });

  it('登出後即使新按鈕已渲染，舊 callback 仍不可交換 ID token', async () => {
    const firstHost = document.createElement('div');
    await authService.renderGoogleIdSignInButton(firstHost);
    const oldConfiguration = initializeConfigurations[0];

    await authService.logout();
    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    const nextConfiguration = initializeConfigurations[1];

    expect(initializeCalls).toBe(2);
    expect(renderCalls).toBe(2);
    expect(nextConfiguration.nonce).not.toBe(oldConfiguration.nonce);
    oldConfiguration.callback({ credential: 'late-old-google-id-token' });

    http.expectNone(`${authUrl}/google/login`);
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('登出會立即清除 session，以舊 access 明確授權背景撤銷且不等待回應', async () => {
    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    initializeConfiguration?.callback({ credential: 'google-id-token' });
    const loginRequest = http.expectOne(`${authUrl}/google/login`);
    loginRequest.resolve(loginResponse);
    await Promise.resolve();

    const loggingOut = authService.logout();
    const logoutRequest = http.expectOne(`${authUrl}/logout`);

    expect(authService.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(logoutRequest.body).toEqual({ refreshToken: 'refresh-token' });
    expect(logoutRequest.options).toEqual({
      headers: { Authorization: 'Bearer access-token' },
    });
    expect(disableAutoSelect).toHaveBeenCalledTimes(1);
    await expect(loggingOut).resolves.toBeUndefined();
  });

  it('credential 僅送到新端點，帶 nonce 並沿用既有 session 狀態', async () => {
    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    initializeConfiguration?.callback({ credential: 'google-id-token' });

    const request = http.expectOne(`${authUrl}/google/login`);
    expect(request.body).toEqual({
      credential: 'google-id-token',
      nonce: initializeConfiguration?.nonce,
    });
    request.resolve(loginResponse);
    await Promise.resolve();

    expect(authService.currentUser()?.email).toBe('member@example.com');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-token');
  });

  it('同一個 initialize callback 成功登入後不會再次建立 session', async () => {
    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    const callback = initializeConfiguration?.callback;
    callback?.({ credential: 'first-google-id-token' });
    const firstRequest = http.expectOne(`${authUrl}/google/login`);
    firstRequest.resolve(loginResponse);
    await Promise.resolve();

    callback?.({ credential: 'second-google-id-token' });

    expect(authService.isAuthenticated()).toBe(true);
    expect(http.requests.filter((item) => item.url === `${authUrl}/google/login`)).toHaveLength(1);
  });

  it('失敗時不建立登入狀態，忽略並發交換且可重試', async () => {
    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    initializeConfiguration?.callback({ credential: 'google-id-token' });
    initializeConfiguration?.callback({ credential: 'google-id-token' });

    const request = http.expectOne(`${authUrl}/google/login`);
    request.reject(new Error('invalid token'));
    await Promise.resolve();
    await Promise.resolve();

    initializeConfiguration?.callback({ credential: 'retry-google-id-token' });

    expect(authService.isAuthenticated()).toBe(false);
    expect(http.requests.filter((item) => item.url === `${authUrl}/google/login`)).toHaveLength(2);
  });

  it('登出會使既有 callback 的晚到回應失效，不能重新登入', async () => {
    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    initializeConfiguration?.callback({ credential: 'google-id-token' });
    const request = http.expectOne(`${authUrl}/google/login`);

    await authService.logout();
    request.resolve(loginResponse);
    await Promise.resolve();

    expect(authService.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('保留既有 refresh token 換發路徑', async () => {
    localStorage.setItem('refresh_token', 'existing-refresh-token');
    const refreshing = authService.refreshTokens();
    const request = http.expectOne(`${authUrl}/refresh`);
    expect(request.body).toEqual({ refreshToken: 'existing-refresh-token' });
    request.resolve({
      accessToken: 'renewed-access-token',
      refreshToken: 'renewed-refresh-token',
      expiresIn: 1800,
    });

    await expect(refreshing).resolves.toBe(true);
    await expect(authService.getAccessToken()).resolves.toBe('renewed-access-token');
  });

  it('登出後晚到的 refresh 回應不可回寫 token', async () => {
    localStorage.setItem('refresh_token', 'existing-refresh-token');
    const refreshing = authService.refreshTokens();
    const refreshRequest = http.expectOne(`${authUrl}/refresh`);
    const loggingOut = authService.logout();
    const logoutRequest = http.expectOne(`${authUrl}/logout`);
    logoutRequest.resolve({});
    await loggingOut;

    refreshRequest.resolve({
      accessToken: 'late-access-token',
      refreshToken: 'late-refresh-token',
      expiresIn: 1800,
    });

    await expect(refreshing).resolves.toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('舊 refresh 的 finally 不會清除新 session 的 refresh flight', async () => {
    localStorage.setItem('refresh_token', 'old-refresh-token');
    const oldRefreshing = authService.refreshTokens();
    const oldRefreshRequest = http.expectOne(`${authUrl}/refresh`);

    await authService.logout();
    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    initializeConfiguration?.callback({ credential: 'new-google-id-token' });
    const loginRequest = http.expectOne(`${authUrl}/google/login`);
    loginRequest.resolve({ ...loginResponse, expiresIn: 120 });
    await Promise.resolve();

    jest.advanceTimersByTime(5_000);
    const refreshRequests = http.requests.filter((item) => item.url === `${authUrl}/refresh`);
    expect(refreshRequests).toHaveLength(2);
    const newRefreshRequest = refreshRequests[1];
    oldRefreshRequest.resolve({
      accessToken: 'old-late-access-token',
      refreshToken: 'old-late-refresh-token',
      expiresIn: 1800,
    });
    await expect(oldRefreshing).resolves.toBe(false);

    jest.advanceTimersByTime(106_000);
    const gettingAccessToken = authService.getAccessToken();
    expect(http.requests.filter((item) => item.url === `${authUrl}/refresh`)).toHaveLength(2);
    newRefreshRequest.resolve({
      accessToken: 'new-renewed-access-token',
      refreshToken: 'new-renewed-refresh-token',
      expiresIn: 1800,
    });
    await expect(gettingAccessToken).resolves.toBe('new-renewed-access-token');
  });

  it('初始化的晚到 /me 成功回應在登出後不可還原使用者', async () => {
    localStorage.setItem('refresh_token', 'existing-refresh-token');
    const initializing = authService.initializeAuth();
    http.expectOne(`${authUrl}/refresh`).resolve({
      accessToken: 'restored-access-token',
      refreshToken: 'restored-refresh-token',
      expiresIn: 1800,
    });
    await Promise.resolve();
    await Promise.resolve();
    const userMe = authApi.expectOneUserMe();

    await authService.logout();
    userMe.resolve(loginResponse);
    await initializing;

    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.userData()).toBeNull();
  });

  it('初始化的晚到 /me 失敗不可清除較新登入 session', async () => {
    localStorage.setItem('refresh_token', 'existing-refresh-token');
    const initializing = authService.initializeAuth();
    http.expectOne(`${authUrl}/refresh`).resolve({
      accessToken: 'restored-access-token',
      refreshToken: 'restored-refresh-token',
      expiresIn: 1800,
    });
    await Promise.resolve();
    await Promise.resolve();
    const userMe = authApi.expectOneUserMe();

    await authService.renderGoogleIdSignInButton(document.createElement('div'));
    initializeConfiguration?.callback({ credential: 'new-google-id-token' });
    http.expectOne(`${authUrl}/google/login`).resolve(loginResponse);
    await Promise.resolve();
    userMe.reject(new Error('late /me failed'));
    await initializing;

    expect(authService.currentUser()?.email).toBe('member@example.com');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-token');
  });
});
