/**
 * @jest-environment jsdom
 */
const mockDependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  AfterViewInit: class AfterViewInit {},
  ChangeDetectionStrategy: { OnPush: 'OnPush' },
  Component: () => (target: unknown) => target,
  Injectable: () => (target: unknown) => target,
  ElementRef: class ElementRef {},
  HostListener: () => () => undefined,
  InjectionToken: class InjectionToken<T> {
    constructor(readonly description: string) {}
  },
  OnDestroy: class OnDestroy {},
  computed: <T>(compute: () => T) => compute,
  inject: (token: unknown) => mockDependencies.get(token),
  input: <T>(initial: T) => () => initial,
  signal: <T>(initial: T) => {
    let value = initial;
    const state = (() => value) as (() => T) & { set(next: T): void };
    state.set = (next: T): void => {
      value = next;
    };
    return state;
  },
  viewChild: () => () => undefined,
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
    mapD1ToUserData: (dto: { user: { id: string; email: string; displayName: string | null; photoURL: string | null } }) => ({
      uid: dto.user.id,
      email: dto.user.email,
      displayName: dto.user.displayName,
      photoURL: dto.user.photoURL,
      platforms: {},
    }),
  },
}), { virtual: true });
jest.mock('@app/features/user/user.model', () => ({}), { virtual: true });
jest.mock('@app/core/config/auth.config', () => ({
  GOOGLE_ID_TOKEN_LOGIN_ENABLED: Symbol('GOOGLE_ID_TOKEN_LOGIN_ENABLED'),
}), { virtual: true });
jest.mock('src/environments/environment', () => ({
  environment: {
    portalApiUrl: 'https://portal.test',
    googleClientId: 'google-client-id.test',
  },
}), { virtual: true });
jest.mock('@app/core/services/auth.service', () =>
  jest.requireActual('../../../core/services/auth.service'), { virtual: true });

import { HttpClient } from '@angular/common/http';
import { GOOGLE_ID_TOKEN_LOGIN_ENABLED } from '@app/core/config/auth.config';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { AuthApiService } from '@app/core/services/auth-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleIdentityApi } from '../../../core/services/google-identity.types';
import { LoggerService } from '@app/shared/services/logger.service';
import { ToastService } from '@app/shared/services/toast.service';
import { Observable } from 'rxjs';
import { GoogleSignInComponent } from './google-sign-in.component';

class HttpBoundary {
  post<T>(): Observable<T> {
    return new Observable<T>();
  }
}

function createComponent(enabled: boolean): GoogleSignInComponent {
  mockDependencies.clear();
  mockDependencies.set(HttpClient, new HttpBoundary());
  mockDependencies.set(AnalyticsService, { trackEvent: jest.fn() });
  mockDependencies.set(ToastService, { success: jest.fn(), error: jest.fn() });
  mockDependencies.set(LoggerService, { error: jest.fn(), warn: jest.fn() });
  mockDependencies.set(AuthApiService, {
    getUserMe: (): Observable<never> => new Observable<never>(),
  });
  mockDependencies.set(GOOGLE_ID_TOKEN_LOGIN_ENABLED, enabled);
  const authService = new AuthService();
  mockDependencies.set(AuthService, authService);
  return new GoogleSignInComponent();
}

describe('GoogleSignInComponent', () => {
  afterEach(() => Reflect.deleteProperty(window, 'google'));

  it('旗標預設關閉時保留舊 OAuth 授權碼入口，不使用 ID token API', async () => {
    let codeClientCalls = 0;
    const google: GoogleIdentityApi = {
      accounts: {
        oauth2: {
          initCodeClient(): { requestCode(): void } {
            codeClientCalls += 1;
            return { requestCode(): void {} };
          },
        },
      },
    };
    Object.defineProperty(window, 'google', { configurable: true, value: google });
    const component = createComponent(false);

    expect(component.idTokenLoginEnabled).toBe(false);
    component.onLoginTrigger();
    await Promise.resolve();

    expect(codeClientCalls).toBe(1);
  });

  it('旗標開啟時原樣式按鈕只展開官方帳號選擇器，不呼叫舊 OAuth', () => {
    const component = createComponent(true);
    const legacyLogin = jest.spyOn(component, 'loginWithLegacyGoogle');

    component.onLoginTrigger();

    expect(legacyLogin).not.toHaveBeenCalled();
    expect(component.menuOpen()).toBe(true);
  });

  it('可用 Escape 關閉帳號選擇器並把焦點還給原登入按鈕', () => {
    const component = createComponent(true);
    const focus = jest.fn();
    Object.defineProperty(component, 'loginTrigger', {
      value: () => ({ nativeElement: { focus } }),
    });
    component.menuOpen.set(true);

    component.closeLoginMenu();

    expect(component.menuOpen()).toBe(false);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('旗標開啟時使用 service 渲染 GIS 官方按鈕', async () => {
    let renderCalls = 0;
    const google: GoogleIdentityApi = {
      accounts: {
        id: {
          initialize(): void {},
          renderButton(parent): void {
            renderCalls += 1;
            parent.append(document.createElement('iframe'));
          },
        },
      },
    };
    Object.defineProperty(window, 'google', { configurable: true, value: google });
    const component = createComponent(true);
    const host = document.createElement('div');
    Object.defineProperty(component, 'googleButton', {
      value: () => ({ nativeElement: host }),
    });

    component.ngAfterViewInit();
    await Promise.resolve();

    expect(renderCalls).toBe(1);
    expect(host.querySelector('iframe')).not.toBeNull();
  });

  it('旗標關閉時初始化不載入 GIS，維持使用者點擊後才登入', () => {
    const component = createComponent(false);
    const renderOfficialButton = jest.spyOn(
      component as unknown as { renderOfficialButton(): Promise<void> },
      'renderOfficialButton',
    );

    component.ngAfterViewInit();

    expect(renderOfficialButton).not.toHaveBeenCalled();
  });
});
