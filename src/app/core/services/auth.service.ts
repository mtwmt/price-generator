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
  type GoogleOAuth2Api,
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

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GIS_LOAD_TIMEOUT_MS = 15_000;
const GOOGLE_CODE_TIMEOUT_MS = 120_000;
const GOOGLE_LOGIN_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';

interface GoogleLoginFlight {
  readonly epoch: number;
  codeConsumed: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * 認證服務（永久登入版）
 * 採 Google Identity Services popup 授權碼模式 + 後端自發 session token：
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
  private refreshInFlight: Promise<boolean> | null = null;
  private gisPromise: Promise<void> | null = null;
  private readonly failedGisScripts = new WeakSet<HTMLScriptElement>();
  private googleLoginInFlight: GoogleLoginFlight | null = null;
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

  /** 從登入按鈕啟動 GIS popup；同一次授權尚未結束前不再開第二個視窗。 */
  loginWithGoogle(): void {
    if (this.isAuthenticated() || this.googleLoginInFlight) return;

    const flight: GoogleLoginFlight = {
      epoch: this.authEpoch,
      codeConsumed: false,
      timeoutId: null,
    };
    this.googleLoginInFlight = flight;

    // GIS 已就緒時，維持 requestCode 在 click 的同步呼叫堆疊內，避免失去使用者啟用狀態。
    const oauth2 = getGoogleIdentityApi()?.accounts?.oauth2;
    if (oauth2) {
      this.requestGoogleCode(oauth2, flight);
      return;
    }

    void this.loadGis().then(
      () => {
        if (!this.isCurrentGoogleLoginFlight(flight)) return;
        const loadedOauth2 = getGoogleIdentityApi()?.accounts?.oauth2;
        if (!loadedOauth2) {
          this.failGoogleLogin(flight, 'Google 登入元件尚未就緒，請重試');
          return;
        }
        this.requestGoogleCode(loadedOauth2, flight);
      },
      () => this.failGoogleLogin(flight, '無法載入 Google 登入元件，請檢查網路後重試'),
    );
  }

  private requestGoogleCode(oauth2: GoogleOAuth2Api, flight: GoogleLoginFlight): void {
    if (!this.isCurrentGoogleLoginFlight(flight)) return;
    try {
      const client = oauth2.initCodeClient({
        client_id: environment.googleClientId,
        scope: GOOGLE_LOGIN_SCOPE,
        ux_mode: 'popup',
        include_granted_scopes: true,
        callback: (response) => {
          if (!this.isCurrentGoogleLoginFlight(flight)) return;
          // GIS 可能在已回傳 code 後補送關閉或空回應；第一個 code 一旦接受，
          // 後續事件必須不能中斷既有交換或影響下一個登入批次。
          if (flight.codeConsumed) return;
          if (!response.code) {
            this.failGoogleLogin(flight, '登入已取消');
            return;
          }
          flight.codeConsumed = true;
          void this.exchangeGoogleCode(response.code, flight);
        },
        error_callback: (error) => {
          if (!this.isCurrentGoogleLoginFlight(flight)) return;
          if (flight.codeConsumed) return;
          this.failGoogleLogin(
            flight,
            error.type === 'popup_failed_to_open'
              ? 'Google 登入視窗無法開啟，請允許此網站的彈出視窗後重試'
              : error.type === 'popup_closed'
                ? '登入已取消'
                : 'Google 登入流程失敗，請重試',
          );
        },
      });
      flight.timeoutId = setTimeout(
        () => this.failGoogleLogin(flight, '登入逾時，請重新登入'),
        GOOGLE_CODE_TIMEOUT_MS,
      );
      client.requestCode();
    } catch {
      this.failGoogleLogin(flight, '無法開啟 Google 登入，請稍後再試');
    }
  }

  private async exchangeGoogleCode(code: string, flight: GoogleLoginFlight): Promise<void> {
    try {
      if (!this.isCurrentGoogleLoginFlight(flight)) return;
      const res = await firstValueFrom(
        this.http.post<GoogleLoginResponse>(
          `${this.authBase}/google/exchange`,
          {
            code,
            driveAuthorization: true,
          },
          { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
        ),
      );
      if (!this.isCurrentGoogleLoginFlight(flight)) return;
      if (!this.startNewSession(res, flight.epoch)) return;
      this.toastService.success('登入成功');
      this.analyticsService.trackEvent('user_signed_in', {
        method: 'google',
        user_id: res.user?.id,
        user_role: this.userRole(),
      });
    } catch (error) {
      if (!this.isCurrentGoogleLoginFlight(flight)) return;
      this.logGoogleExchangeFailure('登入失敗（code 交換）', error);
      this.toastService.error('登入失敗，請稍後再試');
    } finally {
      this.finishGoogleLogin(flight);
    }
  }

  private isCurrentGoogleLoginFlight(flight: GoogleLoginFlight): boolean {
    return this.googleLoginInFlight === flight && flight.epoch === this.authEpoch;
  }

  private failGoogleLogin(flight: GoogleLoginFlight, message: string): void {
    if (!this.isCurrentGoogleLoginFlight(flight)) return;
    this.toastService.error(message);
    this.finishGoogleLogin(flight);
  }

  private finishGoogleLogin(flight: GoogleLoginFlight): void {
    if (flight.timeoutId) {
      clearTimeout(flight.timeoutId);
      flight.timeoutId = null;
    }
    if (this.googleLoginInFlight === flight) {
      this.googleLoginInFlight = null;
    }
  }

  /** 載入或共用 GIS script；失敗後清空快取，讓下一次點擊可以重試。 */
  private loadGis(): Promise<void> {
    if (getGoogleIdentityApi()?.accounts?.oauth2) return Promise.resolve();
    if (this.gisPromise) return this.gisPromise;

    const promise = new Promise<void>((resolve, reject) => {
      const existing = Array.from(
        document.querySelectorAll<HTMLScriptElement>(`script[src="${GIS_SRC}"]`),
      ).find((candidate) => !this.failedGisScripts.has(candidate));
      const script = existing ?? document.createElement('script');
      const createdHere = !existing;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let settled = false;
      const cleanup = (): void => {
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
        if (timeoutId) clearTimeout(timeoutId);
      };
      const succeed = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const fail = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        this.failedGisScripts.add(script);
        if (createdHere) script.remove();
        reject(new Error('Google Identity Services 載入失敗'));
      };
      const onLoad = (): void => {
        if (getGoogleIdentityApi()?.accounts?.oauth2) {
          succeed();
        } else {
          fail();
        }
      };
      const onError = (): void => fail();

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      timeoutId = setTimeout(fail, GIS_LOAD_TIMEOUT_MS);
      if (createdHere) {
        script.src = GIS_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
    this.gisPromise = promise;
    void promise.catch(() => {
      if (this.gisPromise === promise) this.gisPromise = null;
    });
    return promise;
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
    this.authEpoch += 1;
    if (this.googleLoginInFlight) {
      this.finishGoogleLogin(this.googleLoginInFlight);
    }
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
