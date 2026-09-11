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
    const state = (() => value) as (() => T) & { set(next: T): void };
    state.set = (next: T): void => {
      value = next;
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
          ? { role: dto.profiles.quotation.role }
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
import { LoggerService } from '@app/shared/services/logger.service';
import { ToastService } from '@app/shared/services/toast.service';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { GoogleIdentityApi } from './google-identity.types';

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
  resolve(value: unknown): void;
}

class HttpClientBoundary {
  readonly requests: PendingHttpRequest[] = [];

  post<T>(url: string, body: unknown): Observable<T> {
    return new Observable<T>((subscriber) => {
      this.requests.push({
        url,
        body,
        resolve: (value: unknown): void => {
          subscriber.next(value as T);
          subscriber.complete();
        },
      });
    });
  }

  expectOne(url: string): PendingHttpRequest {
    const matching = this.requests.filter((request) => request.url === url);
    expect(matching).toHaveLength(1);
    return matching[0];
  }
}

describe('AuthService Google 授權碼登入', () => {
  let authService: AuthService;
  let http: HttpClientBoundary;
  let toast: { success: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    mockDependencies.clear();
    http = new HttpClientBoundary();
    toast = { success: jest.fn(), error: jest.fn() };
    mockDependencies.set(HttpClient, http);
    mockDependencies.set(AnalyticsService, { trackEvent: jest.fn() });
    mockDependencies.set(ToastService, toast);
    mockDependencies.set(LoggerService, { error: jest.fn(), warn: jest.fn() });
    mockDependencies.set(AuthApiService, { getUserMe: (): Observable<never> => new Observable() });
    authService = new AuthService();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'google');
    document.querySelector('script[src="https://accounts.google.com/gsi/client"]')?.remove();
  });

  it('僅在使用者登入時載入 GIS，並以授權碼交換既有 session', async () => {
    let callback: ((response: { code?: string; error?: string }) => void) | undefined;
    const requestCode = jest.fn();
    const google: GoogleIdentityApi = {
      accounts: {
        oauth2: {
          initCodeClient(config: { callback: typeof callback }): { requestCode(): void } {
            callback = config.callback;
            return { requestCode };
          },
        },
      },
    };
    Object.defineProperty(window, 'google', { configurable: true, value: google });

    expect(document.querySelector('script[src="https://accounts.google.com/gsi/client"]')).toBeNull();
    await authService.loginWithGoogle();
    expect(requestCode).toHaveBeenCalledTimes(1);

    callback?.({ code: 'authorization-code' });
    const request = http.expectOne(`${authUrl}/google/exchange`);
    expect(request.body).toEqual({ code: 'authorization-code' });
    request.resolve(loginResponse);
    await Promise.resolve();

    expect(authService.currentUser()?.email).toBe('member@example.com');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-token');
    expect(toast.success).toHaveBeenCalledWith('登入成功');
  });

  it('授權被取消時不建立登入狀態', async () => {
    let callback: ((response: { code?: string; error?: string }) => void) | undefined;
    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        accounts: {
          oauth2: {
            initCodeClient(config: { callback: typeof callback }): { requestCode(): void } {
              callback = config.callback;
              return { requestCode(): void {} };
            },
          },
        },
      } satisfies GoogleIdentityApi,
    });

    await authService.loginWithGoogle();
    callback?.({ error: 'access_denied' });

    expect(authService.isAuthenticated()).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('登入已取消');
  });
});
