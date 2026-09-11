import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { ToastService } from '@app/shared/services/toast.service';
import { LoggerService } from '@app/shared/services/logger.service';
import { UserData, D1UserResponseDTO } from '@app/features/user/user.model';
import { AuthApiService } from '@app/core/services/auth-api.service';
import { UserApiMapper } from '@app/core/mappers/user-api.mapper';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  getGoogleIdentityApi,
} from './google-identity.types';

/**
 * Google 使用者資料
 */
export interface GoogleUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
}

type GoogleLoginResponse = TokenPair & D1UserResponseDTO;

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

/**
 * 認證服務（永久登入版）
 * 採 Google Authorization Code（GIS popup）+ 後端自發 session token：
 * - access token（短效）打 API；過期前自動用 refresh token 換新（滑動續命）
 * - refresh token（長效）存 localStorage，常用即不掉線，登出或逾時才需重登
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly toastService = inject(ToastService);
  private readonly authApi = inject(AuthApiService);
  private readonly logger = inject(LoggerService);

  private readonly authBase = environment.portalApiUrl + '/api/auth';

  private accessToken: string | null = null;
  private accessExpiry = 0;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private gisPromise: Promise<void> | null = null;
  private refreshInFlight: Promise<boolean> | null = null;
  private authEpoch = 0;

  readonly currentUser = signal<GoogleUser | null>(null);
  readonly userData = signal<UserData | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userDisplayName = computed(
    () => this.userData()?.displayName || this.currentUser()?.displayName || '訪客',
  );
  readonly userPhotoURL = computed(() => this.currentUser()?.photoURL || null);
  readonly userEmail = computed(() => this.currentUser()?.email || null);
  readonly userId = computed(() => this.currentUser()?.uid || null);
  readonly isPremium = computed(() => this.userRole() === 'premium');
  readonly isAdmin = computed(() => this.userRole() === 'admin');
  readonly userRole = computed(() => this.userData()?.platforms?.quotation?.role || 'free');

  /**
   * 初始化：若本機有 refresh token，嘗試換新並還原登入狀態
   */
  async initializeAuth(): Promise<void> {
    const initializeEpoch = this.authEpoch;
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return;

    const ok = await this.refreshTokens();
    if (initializeEpoch !== this.authEpoch) return;
    if (ok) {
      await this.loadUserData(initializeEpoch);
    } else {
      this.clearLocal();
    }
  }

  /**
   * Google 登入（GIS popup 授權碼模式）
   */
  async loginWithGoogle(): Promise<void> {
    const loginEpoch = this.authEpoch;
    try {
      await this.loadGis();
    } catch {
      this.toastService.error('無法載入 Google 登入元件，請檢查網路');
      return;
    }

    const google = getGoogleIdentityApi();
    const oauth2 = google?.accounts?.oauth2 as
      | {
          initCodeClient(config: {
            readonly client_id: string;
            readonly scope: string;
            readonly ux_mode: 'popup';
            callback: (response: { readonly code?: string; readonly error?: string }) => void;
          }): { requestCode(): void };
        }
      | undefined;
    if (!oauth2) {
      this.toastService.error('Google 登入元件尚未就緒，請重試');
      return;
    }
    const codeClient = oauth2.initCodeClient({
      client_id: environment.googleClientId,
      scope: 'openid email profile',
      ux_mode: 'popup',
      callback: (response: { code?: string; error?: string }) => {
        if (response.code) {
          void this.exchangeCode(response.code, loginEpoch);
        } else {
          this.toastService.error('登入已取消');
        }
      },
    });
    codeClient.requestCode();
  }

  /** 以授權碼向後端換取 session token */
  private async exchangeCode(code: string, loginEpoch: number): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<GoogleLoginResponse>(
          `${this.authBase}/google/exchange`,
          { code },
        ),
      );
      if (!this.startNewSession(res, loginEpoch)) return;
      this.toastService.success('登入成功');
      this.analyticsService.trackEvent('user_signed_in', {
        method: 'google',
        user_id: res.user?.id,
        user_role: this.userRole(),
      });
    } catch (error) {
      if (loginEpoch !== this.authEpoch) return;
      this.logGoogleExchangeFailure('登入失敗（code 交換）', error);
      this.toastService.error('登入失敗，請稍後再試');
    }
  }

  /**
   * 取得有效 access token（給 interceptor 用）；過期則先換新
   */
  async getAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.accessExpiry - 10_000) {
      return this.accessToken;
    }
    const ok = await this.refreshTokens();
    return ok ? this.accessToken : null;
  }

  /** 介面相容：舊名稱 */
  async getIdToken(): Promise<string | null> {
    return this.getAccessToken();
  }

  /**
   * 用 refresh token 換新 access/refresh（滑動續命）。並行呼叫會共用同一個請求。
   */
  refreshTokens(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const refreshEpoch = this.authEpoch;
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const flight = (async () => {
      if (!refreshToken) return false;
      try {
        const res = await firstValueFrom(
          this.http.post<TokenPair>(`${this.authBase}/refresh`, { refreshToken }),
        );
        if (refreshEpoch !== this.authEpoch) return false;
        this.setTokens(res);
        return true;
      } catch (e) {
        if (refreshEpoch !== this.authEpoch) return false;
        this.logger.warn('refresh token 失效，需重新登入');
        this.clearLocal();
        this.currentUser.set(null);
        this.userData.set(null);
        return false;
      }
    })();
    this.refreshInFlight = flight;
    void flight.finally(() => {
      if (this.refreshInFlight === flight) {
        this.refreshInFlight = null;
      }
    });

    return flight;
  }

  /** 載入使用者 D1 資料（GET /me） */
  private async loadUserData(loadEpoch: number): Promise<void> {
    try {
      const dto = await firstValueFrom(this.authApi.getUserMe());
      if (loadEpoch !== this.authEpoch) return;
      this.applyUserDto(dto);
    } catch (error) {
      if (loadEpoch !== this.authEpoch) return;
      this.logger.error('無法從 D1 載入使用者資料:', error);
      this.userData.set(null);
    }
  }

  /** 套用 /me 或 /exchange 回傳的使用者資料到 signals */
  private applyUserDto(dto: D1UserResponseDTO): void {
    const data = UserApiMapper.mapD1ToUserData(dto);
    this.userData.set(data);
    this.currentUser.set({
      uid: data.uid,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      photoURL: data.photoURL ?? '',
    });
  }

  /** 登入會取代先前 session，並使該 session 的背景請求失效。 */
  private startNewSession(response: GoogleLoginResponse, expectedEpoch: number): boolean {
    if (expectedEpoch !== this.authEpoch) return false;

    this.authEpoch += 1;
    this.refreshInFlight = null;
    this.setTokens(response);
    this.applyUserDto(response);
    return true;
  }

  /** 儲存 token、排程續命 */
  private setTokens(t: TokenPair): void {
    this.accessToken = t.accessToken;
    this.accessExpiry = Date.now() + (t.expiresIn ?? 1800) * 1000;
    localStorage.setItem(ACCESS_KEY, t.accessToken);
    localStorage.setItem(REFRESH_KEY, t.refreshToken);
    this.scheduleRefresh();
  }

  /** access token 到期前 2 分鐘自動換新 */
  private scheduleRefresh(): void {
    this.clearRefreshTimer();
    const delay = Math.max(this.accessExpiry - Date.now() - 2 * 60 * 1000, 5_000);
    this.refreshTimer = setTimeout(() => {
      this.refreshTokens().then((ok) => {
        if (ok) this.scheduleRefresh();
      });
    }, delay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private clearLocal(): void {
    this.clearRefreshTimer();
    this.accessToken = null;
    this.accessExpiry = 0;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  /** 登出：立即清除本機 session，並在背景撤銷先前後端 session。 */
  async logout(): Promise<void> {
    const userId = this.userId();
    const accessToken = this.accessToken ?? localStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    this.authEpoch += 1;
    this.refreshInFlight = null;
    this.clearLocal();
    this.currentUser.set(null);
    this.userData.set(null);
    this.analyticsService.trackEvent('logout_success', { user_id: userId });

    if (refreshToken) {
      try {
        void firstValueFrom(
          this.http.post(`${this.authBase}/logout`, { refreshToken }, {
            headers: { Authorization: `Bearer ${accessToken ?? ''}` },
          }),
        ).catch(() => undefined);
      } catch {
        // 後端撤銷失敗不影響本機登出
      }
    }
  }

  /**
   * 更新使用者顯示名稱（僅本地狀態）
   */
  async updateDisplayName(newDisplayName: string): Promise<void> {
    const current = this.currentUser();
    if (!current) throw new Error('使用者未登入');

    const trimmedName = newDisplayName.trim();
    if (!trimmedName) throw new Error('顯示名稱不能為空');
    if (trimmedName.length > 50) throw new Error('顯示名稱不能超過 50 個字');

    this.currentUser.set({ ...current, displayName: trimmedName });
    const currentData = this.userData();
    if (currentData) {
      this.userData.set({ ...currentData, displayName: trimmedName });
    }
    this.toastService.success('顯示名稱已更新');
  }

  /** 動態載入 Google Identity Services 程式庫（只載一次） */
  private loadGis(): Promise<void> {
    if (getGoogleIdentityApi()?.accounts) return Promise.resolve();
    if (this.gisPromise) return this.gisPromise;

    this.gisPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${GIS_SRC}"]`,
      );
      const script = existing ?? document.createElement('script');
      const complete = (): void => {
        if (getGoogleIdentityApi()?.accounts) {
          resolve();
        } else {
          reject(new Error('GIS load completed without identity API'));
        }
      };
      const fail = (): void => reject(new Error('GIS load failed'));

      script.addEventListener('load', complete, { once: true });
      script.addEventListener('error', fail, { once: true });
      if (!existing) {
        script.src = GIS_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }).catch((error: unknown) => {
      this.gisPromise = null;
      document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)?.remove();
      throw error;
    });
    return this.gisPromise;
  }

  /** 僅留下可安全識別的 HTTP 狀態，避免日誌保留 Google credential 或回應物件。 */
  private logGoogleExchangeFailure(message: string, error: unknown): void {
    const status = this.getSafeHttpStatus(error);
    this.logger.error(status === null ? message : `${message}（HTTP ${status}）`);
  }

  private getSafeHttpStatus(error: unknown): number | null {
    if (error === null || typeof error !== 'object' || !('status' in error)) {
      return null;
    }
    const status = (error as { readonly status?: unknown }).status;
    return typeof status === 'number' && Number.isFinite(status) ? status : null;
  }
}
