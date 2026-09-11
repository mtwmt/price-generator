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
  GoogleOAuthPopup,
  GoogleOAuthPopupError,
  type GoogleOAuthAuthorization,
} from './google-oauth-popup';

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

/**
 * 認證服務（永久登入版）
 * 採原生 Google OAuth popup（Authorization Code + PKCE）+ 後端自發 session token：
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
  private googleOAuthPopup: GoogleOAuthPopup | null = null;
  private googleOAuthLoginInFlight: Promise<void> | null = null;
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
   * 從原本的登入按鈕直接開啟原生 OAuth popup；同一次授權尚未結束前不再開第二個視窗。
   * popup 先同步開 about:blank，再建立 PKCE，避免被瀏覽器視為非使用者觸發的彈出視窗。
   */
  loginWithGoogle(): void {
    if (this.isAuthenticated() || this.googleOAuthLoginInFlight) return;

    const loginEpoch = this.authEpoch;
    const popup = new GoogleOAuthPopup();
    this.googleOAuthPopup = popup;
    const authorization = popup.authorize(environment.googleClientId);
    const flight = this.exchangeGoogleAuthorization(authorization, loginEpoch);
    this.googleOAuthLoginInFlight = flight;
    void flight.finally(() => {
      if (this.googleOAuthLoginInFlight === flight) {
        this.googleOAuthLoginInFlight = null;
        if (this.googleOAuthPopup === popup) this.googleOAuthPopup = null;
      }
    });
  }

  private async exchangeGoogleAuthorization(
    authorization: Promise<GoogleOAuthAuthorization>,
    exchangeEpoch: number,
  ): Promise<void> {
    try {
      const result = await authorization;
      if (exchangeEpoch !== this.authEpoch) return;
      const res = await firstValueFrom(
        this.http.post<GoogleLoginResponse>(
          `${this.authBase}/google/exchange`,
          {
            code: result.code,
            driveAuthorization: true,
            flow: 'web',
            codeVerifier: result.codeVerifier,
            nonce: result.nonce,
            redirectUri: result.redirectUri,
          },
          { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
        ),
      );
      if (!this.startNewSession(res, exchangeEpoch)) return;
      this.toastService.success('登入成功');
      this.analyticsService.trackEvent('user_signed_in', {
        method: 'google_oauth_pkce',
        user_id: res.user?.id,
        user_role: this.userRole(),
      });
    } catch (error) {
      if (exchangeEpoch !== this.authEpoch) return;
      if (error instanceof GoogleOAuthPopupError) {
        if (error.code === 'popup_blocked') {
          this.toastService.error('瀏覽器封鎖登入視窗，請允許彈出視窗後重試');
        } else if (error.code === 'cancelled') {
          this.toastService.error('登入已取消');
        } else if (error.code === 'timeout') {
          this.toastService.error('登入逾時，請重新登入');
        } else {
          this.toastService.error('無法開啟 Google 登入，請稍後再試');
        }
        return;
      }
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
    this.googleOAuthPopup?.cancel();
    this.googleOAuthPopup = null;
    this.googleOAuthLoginInFlight = null;
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
